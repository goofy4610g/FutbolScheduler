import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./db.js";
import { configRouter } from "./routes/config.js";
import { entitiesRouter } from "./routes/entities.js";
import { scheduleRouter } from "./routes/schedule.js";
import { uploadRouter } from "./routes/upload.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "data", "uploads")));

app.use("/api/upload", uploadRouter);
app.use("/api/config", configRouter);
app.use("/api", entitiesRouter);
app.use("/api/schedule", scheduleRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`FutbolScheduler API listening on http://localhost:${port}`);
});
