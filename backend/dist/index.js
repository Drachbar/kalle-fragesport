"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const port = process.env.PORT ?? 3000;
app.use(express_1.default.json());
app.get("/", (_req, res) => {
    res.json({ message: "Hej från Kalle Frågesport backend!" });
});
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
app.listen(port, () => {
    console.log(`Servern lyssnar på http://localhost:${port}`);
});
