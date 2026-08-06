import { useEffect, useRef, useState, useCallback } from "react";
import { getScannerSettings } from "@/lib/store";
import {
  MultiFormatReader,
  BinaryBitmap,
  HybridBinarizer,
  HTMLCanvasElementLuminanceSource,
  BarcodeFormat,
  DecodeHintType,
  NotFoundException,
} from "@zxing/library";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, CameraOff, Zap, ZoomIn, ZoomOut } from "lucide-react";

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  detect(source: HTMLVideoElement | HTMLCanvasElement): Promise<Array<{ rawValue: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

interface ScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecode: (text: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ZXing decode helper — correct API for @zxing/library v0.21
// ─────────────────────────────────────────────────────────────────────────────

function decodeCanvas(canvas: HTMLCanvasElement, reader: MultiFormatReader): string {
  const source  = new HTMLCanvasElementLuminanceSource(canvas);
  const bitmap  = new BinaryBitmap(new HybridBinarizer(source));
  return reader.decode(bitmap).getText();
}

// ─────────────────────────────────────────────────────────────────────────────
// Image helpers
// ─────────────────────────────────────────────────────────────────────────────

function cropRect(video: HTMLVideoElement, dz: number) {
  const W = video.videoWidth  || 640;
  const H = video.videoHeight || 480;
  const cw = W / dz;
  const ch = H / dz;
  return { sx: (W - cw) / 2, sy: (H - ch) / 2, sw: cw, sh: ch, W, H };
}

/** Full (optionally zoomed) frame at native resolution. */
function drawFull(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  dz = 1,
) {
  const { sx, sy, sw, sh, W, H } = cropRect(video, dz);
  canvas.width  = W;
  canvas.height = H;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
}

/**
 * Horizontal strip cropped from the (optionally zoomed) area and scaled UP 2×.
 * This is the key fix for long barcodes — thin bars become reliably thick.
 */
function drawStrip(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  stripFrac = 0.30,
  scale     = 2.0,
  yFrac     = 0.5,
  dz        = 1,
) {
  const { sx, sy: visY, sw, sh: visH } = cropRect(video, dz);
  const stripH = Math.max(1, Math.round(visH * stripFrac));
  const stripY = visY + Math.max(0, Math.min(visH - stripH, Math.round(visH * yFrac - stripH / 2)));
  canvas.width  = Math.round(sw * scale);
  canvas.height = Math.round(stripH * scale);
  ctx.drawImage(video, sx, stripY, sw, stripH, 0, 0, canvas.width, canvas.height);
}

/** Grayscale + histogram-stretch in-place — normalises coloured paper. */
function grayStretch(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d    = img.data;
  const len  = d.length;
  const gray = new Uint8ClampedArray(len >> 2);
  let lo = 255, hi = 0;
  for (let i = 0, p = 0; i < len; i += 4, p++) {
    const g = (77 * d[i] + 150 * d[i + 1] + 29 * d[i + 2]) >> 8;
    gray[p] = g;
    if (g < lo) lo = g;
    if (g > hi) hi = g;
  }
  const range = hi - lo || 1;
  for (let i = 0, p = 0; i < len; i += 4, p++) {
    const v = ((gray[p] - lo) * 255 / range) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const DIGITAL_ZOOM_MAX = 4;

export function ScannerModal({ open, onOpenChange, onDecode }: ScannerModalProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef   = useRef(false);
  const lastCodeRef = useRef<string | null>(null);

  const zoomRef           = useRef(1);
  const hasNativeZoomRef  = useRef(false);
  const zoomMinRef        = useRef(1);
  const zoomMaxRef        = useRef(DIGITAL_ZOOM_MAX);

  const pinchDistRef      = useRef<number | null>(null);
  const pinchZoomStartRef = useRef(1);

  const [error, setError]       = useState("");
  const [ready, setReady]       = useState(false);
  const [torch, setTorch]       = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [zoom, setZoom]         = useState(1);
  const [zoomMin, setZoomMin]   = useState(1);
  const [zoomMax, setZoomMax]   = useState(DIGITAL_ZOOM_MAX);
  const [hasNativeZoom, setHasNativeZoom] = useState(false);

  const stopAll = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    lastCodeRef.current = null;
    zoomRef.current = 1;
    hasNativeZoomRef.current = false;
    zoomMinRef.current = 1;
    zoomMaxRef.current = DIGITAL_ZOOM_MAX;
    setReady(false); setTorch(false); setHasTorch(false);
    setZoom(1); setZoomMin(1); setZoomMax(DIGITAL_ZOOM_MAX); setHasNativeZoom(false);
  }, []);

  const applyTorch = useCallback(async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try { await (track as any).applyConstraints({ advanced: [{ torch: on }] }); setTorch(on); }
    catch { /* not supported */ }
  }, []);

  const applyZoom = useCallback(async (level: number) => {
    const clamped = Math.max(zoomMinRef.current, Math.min(zoomMaxRef.current, level));
    zoomRef.current = clamped;
    setZoom(clamped);
    if (hasNativeZoomRef.current) {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        try { await (track as any).applyConstraints({ advanced: [{ zoom: clamped }] }); }
        catch { /* ignore */ }
      }
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDistRef.current      = Math.hypot(dx, dy);
      pinchZoomStartRef.current = zoomRef.current;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchDistRef.current !== null) {
      e.preventDefault();
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      applyZoom(pinchZoomStartRef.current * (dist / pinchDistRef.current));
    }
  }, [applyZoom]);

  const handleTouchEnd = useCallback(() => { pinchDistRef.current = null; }, []);

  useEffect(() => {
    if (!open) { stopAll(); setError(""); return; }

    let cancelled = false;
    activeRef.current = true;

    async function run() {
      setError(""); setReady(false);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width:  { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
          },
        });
      } catch {
        if (!cancelled) setError("Camera access denied — allow camera permission and reload.");
        return;
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps  = (track.getCapabilities?.() ?? {}) as any;

      if (caps.torch) { setHasTorch(true); if (getScannerSettings().autoTorch) applyTorch(true); }

      try {
        if (caps.focusMode?.includes?.("continuous")) {
          await (track as any).applyConstraints({ advanced: [{ focusMode: "continuous" }] });
        }
      } catch { /* unsupported */ }

      if (caps.zoom) {
        hasNativeZoomRef.current = true;
        setHasNativeZoom(true);
        const min = Math.max(1, caps.zoom.min ?? 1);
        const max = Math.min(8,  caps.zoom.max ?? 8);
        zoomMinRef.current = min; zoomMaxRef.current = max;
        setZoomMin(min); setZoomMax(max);
      } else {
        hasNativeZoomRef.current = false;
        setHasNativeZoom(false);
        zoomMinRef.current = 1; zoomMaxRef.current = DIGITAL_ZOOM_MAX;
        setZoomMin(1); setZoomMax(DIGITAL_ZOOM_MAX);
      }
      zoomRef.current = 1; setZoom(1);

      const video = videoRef.current!;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      try { await video.play(); } catch {
        if (!cancelled) setError("Video playback failed."); return;
      }
      if (cancelled) return;
      setReady(true);

      const canvas = canvasRef.current!;
      const ctx    = canvas.getContext("2d", { willReadFrequently: true })!;

      // ── ZXing MultiFormatReader — correct API for @zxing/library v0.21 ──
      const hints = new Map<DecodeHintType, unknown>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,  BarcodeFormat.CODE_93,
        BarcodeFormat.EAN_13,   BarcodeFormat.EAN_8,    BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,    BarcodeFormat.ITF,      BarcodeFormat.CODABAR,
        BarcodeFormat.QR_CODE,  BarcodeFormat.DATA_MATRIX,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new MultiFormatReader();
      reader.setHints(hints);

      // ── Native BarcodeDetector (Chrome/Android, hardware) ──
      let nativeDetector: InstanceType<typeof BarcodeDetector> | null = null;
      if (typeof BarcodeDetector !== "undefined") {
        try {
          const fmts = await BarcodeDetector.getSupportedFormats();
          nativeDetector = new BarcodeDetector({ formats: fmts });
        } catch { /* unavailable */ }
      }

      // ── Scan loop ─────────────────────────────────────────────────────────
      const scan = async () => {
        if (!activeRef.current || cancelled) return;
        if (video.readyState < 2 || !video.videoWidth) {
          timerRef.current = setTimeout(scan, 100); return;
        }

        const dz = hasNativeZoomRef.current ? 1 : zoomRef.current;
        let code: string | null = null;

        // Pass 1 — Native BarcodeDetector on live <video> (hardware, best quality)
        if (!code && nativeDetector) {
          try {
            const hits = await nativeDetector.detect(video);
            if (hits.length) code = hits[0].rawValue;
          } catch { /* miss */ }
        }

        // Pass 2 — ZXing on full frame
        if (!code) {
          try { drawFull(video, canvas, ctx, dz); code = decodeCanvas(canvas, reader); }
          catch (e) { if (!(e instanceof NotFoundException)) console.warn("ZXing P2:", e); }
        }

        // Pass 3 — ZXing on 2× upscaled center strip (KEY: long barcodes)
        if (!code) {
          try { drawStrip(video, canvas, ctx, 0.30, 2.0, 0.5, dz); code = decodeCanvas(canvas, reader); }
          catch (e) { if (!(e instanceof NotFoundException)) console.warn("ZXing P3:", e); }
        }

        // Pass 4 — upper-third strip
        if (!code) {
          try { drawStrip(video, canvas, ctx, 0.30, 2.0, 0.33, dz); code = decodeCanvas(canvas, reader); }
          catch (e) { if (!(e instanceof NotFoundException)) console.warn("ZXing P4:", e); }
        }

        // Pass 5 — lower-third strip
        if (!code) {
          try { drawStrip(video, canvas, ctx, 0.30, 2.0, 0.67, dz); code = decodeCanvas(canvas, reader); }
          catch (e) { if (!(e instanceof NotFoundException)) console.warn("ZXing P5:", e); }
        }

        // Pass 6 — grayscale-stretched full frame (coloured paper)
        if (!code) {
          try {
            drawFull(video, canvas, ctx, dz); grayStretch(canvas, ctx);
            code = decodeCanvas(canvas, reader);
          } catch (e) { if (!(e instanceof NotFoundException)) console.warn("ZXing P6:", e); }
        }

        // Pass 7 — grayscale-stretched center strip (long barcode + colour)
        if (!code) {
          try {
            drawStrip(video, canvas, ctx, 0.30, 2.0, 0.5, dz); grayStretch(canvas, ctx);
            code = decodeCanvas(canvas, reader);
          } catch (e) { if (!(e instanceof NotFoundException)) console.warn("ZXing P7:", e); }
        }

        // Pass 8 — native detector on grayscale-stretched frame
        if (!code && nativeDetector) {
          try {
            drawFull(video, canvas, ctx, dz); grayStretch(canvas, ctx);
            const hits = await nativeDetector.detect(canvas);
            if (hits.length) code = hits[0].rawValue;
          } catch { /* miss */ }
        }

        // Two consecutive identical reads = confirmed
        if (code) {
          if (lastCodeRef.current === code) {
            onDecode(code);
            onOpenChange(false);
            return;
          }
          lastCodeRef.current = code;
        } else {
          lastCodeRef.current = null;
        }

        if (activeRef.current && !cancelled)
          timerRef.current = setTimeout(scan, 120);
      };

      scan();
    }

    run().catch(() => { if (!cancelled) setError("Camera error — reload and try again."); });
    return () => { cancelled = true; stopAll(); };
  }, [open, onDecode, onOpenChange, stopAll, applyTorch]);

  const videoStyle: React.CSSProperties =
    !hasNativeZoom && zoom > 1
      ? { transform: `scale(${zoom})`, transformOrigin: "center center" }
      : {};

  const stepZoom = (delta: number) =>
    applyZoom(Math.round((zoomRef.current + delta) * 10) / 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-full w-full sm:max-w-3xl p-0 overflow-hidden bg-black border-none"
        aria-describedby="scanner-description"
      >
        <DialogTitle className="sr-only">Barcode Scanner</DialogTitle>
        <DialogDescription id="scanner-description" className="sr-only">Scan a barcode using the camera.</DialogDescription>

        <div
          className="relative w-full bg-black overflow-hidden"
          style={{ aspectRatio: "16/9" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {error ? (
            <div className="absolute inset-0 text-white flex flex-col items-center justify-center gap-4 p-6">
              <CameraOff className="w-8 h-8 text-destructive" />
              <p className="text-sm text-center">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-150"
                style={videoStyle}
                playsInline muted autoPlay
              />
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}

          {!error && (
            <>
              {/* Scan-zone overlay — wide flat strip for long barcodes */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute top-0 left-0 right-0 bg-black/60"    style={{ height: "25%" }} />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60" style={{ height: "25%" }} />
                <div className="absolute left-0  bg-black/60" style={{ top: "25%", bottom: "25%", width: "1.5%" }} />
                <div className="absolute right-0 bg-black/60" style={{ top: "25%", bottom: "25%", width: "1.5%" }} />
                <div
                  className="absolute border border-primary/50"
                  style={{ top: "25%", bottom: "25%", left: "1.5%", right: "1.5%" }}
                >
                  <span className="absolute top-0    left-0  w-6 h-6 border-t-2 border-l-2 border-primary" />
                  <span className="absolute top-0    right-0 w-6 h-6 border-t-2 border-r-2 border-primary" />
                  <span className="absolute bottom-0 left-0  w-6 h-6 border-b-2 border-l-2 border-primary" />
                  <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary" />
                  <div className="absolute top-1/2 left-0 w-full h-[1px] -translate-y-1/2 bg-destructive" />
                </div>
              </div>

              {/* Zoom controls */}
              {ready && (
                <div className="absolute bottom-10 left-0 right-0 z-20 flex flex-col items-center gap-1.5 px-4">
                  <div className="flex items-center gap-3 bg-black/60 rounded-full px-3 py-1.5 backdrop-blur-sm">
                    <button
                      className="text-white/80 hover:text-white disabled:opacity-30 transition-colors"
                      onClick={() => stepZoom(-0.5)}
                      disabled={zoom <= zoomMin}
                      aria-label="Zoom out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <input
                      type="range"
                      min={zoomMin}
                      max={zoomMax}
                      step={0.1}
                      value={zoom}
                      onChange={(e) => applyZoom(parseFloat(e.target.value))}
                      className="w-32 h-1 accent-yellow-400 cursor-pointer"
                      aria-label="Zoom level"
                    />
                    <button
                      className="text-white/80 hover:text-white disabled:opacity-30 transition-colors"
                      onClick={() => stepZoom(0.5)}
                      disabled={zoom >= zoomMax}
                      aria-label="Zoom in"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <span className="text-yellow-300 text-xs font-mono w-10 text-right tabular-nums">
                      {zoom.toFixed(1)}×
                    </span>
                  </div>
                </div>
              )}

              {/* Hint */}
              <div className="absolute bottom-2 left-0 right-0 z-20 text-center pointer-events-none">
                <p className="bg-black/65 text-white px-4 py-1 inline-block rounded-full text-xs">
                  {ready
                    ? "Align barcode within the frame · Pinch or use slider to zoom"
                    : "Starting camera…"}
                </p>
              </div>
            </>
          )}

          {/* Top-right controls */}
          <div className="absolute top-3 right-3 z-20 flex gap-2">
            {hasTorch && (
              <Button variant="secondary" size="icon"
                className={`rounded-full border-none ${torch ? "bg-yellow-400 text-black" : "bg-black/50 text-white hover:bg-black/70"}`}
                onClick={() => applyTorch(!torch)}>
                <Zap className="w-5 h-5" />
              </Button>
            )}
            <Button variant="secondary" size="icon"
              className="rounded-full bg-black/50 text-white hover:bg-black/70 border-none"
              onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
