import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const pnpmExecutable = isWindows ? "pnpm.cmd" : "pnpm";

console.log("=== Starting Barcode System ===");

// 1. Start API Server (Port 8000)
const api = spawn("node", ["--enable-source-maps", "artifacts/api-server/dist/index.mjs"], {
  env: { ...process.env, PORT: "8000" },
  stdio: "inherit",
});

// 2. Start Frontend Dev Server (Port 5000)
const frontend = spawn(pnpmExecutable, ["--filter", "@workspace/barcode-app", "run", "dev"], {
  env: { ...process.env, PORT: "5000", BASE_PATH: "/", API_PORT: "8000" },
  stdio: "inherit",
  shell: isWindows,
});

api.on("error", (err) => console.error("API error:", err));
frontend.on("error", (err) => console.error("Frontend error:", err));

function cleanup() {
  console.log("\nShutting down servers...");
  try { api.kill(); } catch {}
  try { frontend.kill(); } catch {}
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
