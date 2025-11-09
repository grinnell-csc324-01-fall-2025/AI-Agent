
import "./config.js";
import express from "express";
import cors from "cors";
import { router as apiRouter } from "./api/router.js";
import { authRouter } from "./auth/authRouter.js";
import { botAdapter, botListener } from "./bot/adapter.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static assets for the personal tab
app.use("/tabs/personal", express.static(path.join(__dirname, "../tabs/personal")));

// Auth + REST API
app.use("/auth", authRouter);
app.use("/api", apiRouter);

// Bot endpoint (required by Bot Framework)
app.post("/api/messages", (req, res) => {
  botAdapter.processActivity(req, res, async (context) => {
    await botListener.run(context);
  });
});

app.get("/", (_, res) => res.send("AI Teams Agent is running"));

const port = process.env.PORT || 3978;
app.listen(port, () => console.log(`✔ Server listening on :${port}`));
