"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const migrate_1 = require("./db/migrate");
const session_store_1 = require("./auth/session-store");
const auth_routes_1 = require("./auth/auth.routes");
const questions_routes_1 = require("./questions/questions.routes");
const auto_update_routes_1 = require("./ai/auto-update.routes");
const job_status_socket_1 = require("./ai/job-status.socket");
const load_env_1 = require("./load-env");
(0, load_env_1.loadBackendEnv)();
const app = (0, express_1.default)();
const httpServer = (0, node_http_1.createServer)(app);
const port = process.env.PORT ?? 3000;
const isProd = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET ?? (isProd ? undefined : "dev-only-insecure-secret");
if (!sessionSecret) {
    throw new Error("SESSION_SECRET måste sättas i produktion");
}
app.use(express_1.default.json());
if (isProd) {
    // Krävs för secure-cookies bakom en reverse proxy.
    app.set("trust proxy", 1);
}
const sessionMiddleware = (0, express_session_1.default)({
    store: new session_store_1.DbSessionStore(),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dagar
    },
});
app.use(sessionMiddleware);
app.get("/", (_req, res) => {
    res.json({ message: "Hej från Kalle Frågesport backend!" });
});
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
// API:t exponeras under /api (matchar frontends proxy.conf.json).
app.use("/api/auth", (0, auth_routes_1.createAuthRouter)());
// AI-routerna måste ligga före questions-routern så att t.ex.
// /api/questions/suggestions inte fångas av GET /:id.
app.use("/api/questions", (0, auto_update_routes_1.createAutoUpdateRouter)());
app.use("/api/questions", (0, questions_routes_1.createQuestionsRouter)());
async function start() {
    await (0, migrate_1.runMigrations)();
    await (0, job_status_socket_1.createJobStatusSocket)(httpServer, sessionMiddleware);
    httpServer.listen(port, () => {
        console.log(`Servern lyssnar på http://localhost:${port}`);
    });
}
start().catch((err) => {
    console.error("Kunde inte starta servern:", err);
    process.exit(1);
});
