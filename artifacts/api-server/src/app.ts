import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production the Express server also serves the built React frontend.
// __dirname is injected by the esbuild banner → resolves to
// <project-root>/artifacts/api-server/dist, so ../../barcode-app/dist/public
// lands at <project-root>/artifacts/barcode-app/dist/public.
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
