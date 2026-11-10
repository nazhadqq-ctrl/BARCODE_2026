import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Vite and SPA dynamic assets require relaxed CSP
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS configuration: strictly allow local and LAN addresses with credentials
const allowedOrigins = [
  "https://localhost:5000",
  "https://127.0.0.1:5000",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  process.env.CORS_ORIGIN,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile webview, curl, or same-origin)
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.startsWith("http://192.168.") ||
        origin.startsWith("https://192.168.") ||
        origin.startsWith("http://10.") ||
        origin.startsWith("https://10.")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Blocked by CORS policy: Origin not allowed"));
      }
    },
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production the Express server also serves the built React frontend.
if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(__dirname, "../../barcode-app/dist/public");
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    // Express 5 requires named wildcard — serve index.html for all SPA routes
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
    logger.info({ staticDir }, "Serving static frontend");
  } else {
    logger.warn({ staticDir }, "Static dir not found — API-only mode");
  }
}

export default app;
