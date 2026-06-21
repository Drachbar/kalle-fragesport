import { createServer, type Server as HttpServer } from "node:http";
import express from "express";
import session from "express-session";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createJobStatusSocket } from "./job-status.socket";
import type {
  JobStatusListener,
  JobStatusListenerHandlers,
} from "./job-status-listener";
import type { AutoUpdateJob } from "../questions/jobs.repository";

class FakeListener implements JobStatusListener {
  handlers: JobStatusListenerHandlers | null = null;
  start = vi.fn(async (handlers: JobStatusListenerHandlers) => {
    this.handlers = handlers;
  });
  stop = vi.fn().mockResolvedValue(undefined);
}

function makeJob(over: Partial<AutoUpdateJob> = {}): AutoUpdateJob {
  return {
    id: "job-1",
    status: "running",
    total: 3,
    processed: 1,
    suggestionsCreated: 0,
    error: null,
    createdAt: new Date(),
    finishedAt: null,
    ...over,
  };
}

const sockets: ClientSocket[] = [];
const servers: HttpServer[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.close();
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

async function setup(role: "admin" | "user") {
  const app = express();
  const sessionMiddleware = session({
    secret: "test-secret",
    resave: false,
    saveUninitialized: false,
  });
  app.use(sessionMiddleware);
  app.post("/login", (req, res) => {
    req.session.userId = "user-1";
    req.session.role = role;
    res.sendStatus(204);
  });
  const server = createServer(app);
  servers.push(server);
  const listener = new FakeListener();
  const getById = vi.fn().mockResolvedValue(makeJob());
  await createJobStatusSocket(server, sessionMiddleware, {
    jobsRepo: { getById },
    listener,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Ingen port");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const login = await request(server).post("/login");
  const cookie = login.headers["set-cookie"]?.[0];
  if (!cookie) throw new Error("Ingen sessionscookie");
  return { baseUrl, cookie, listener, getById };
}

function connect(baseUrl: string, cookie: string): ClientSocket {
  const socket = createClient(baseUrl, {
    path: "/api/socket.io",
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie },
    forceNew: true,
  });
  sockets.push(socket);
  return socket;
}

describe("jobbstatus via Socket.IO", () => {
  it("skickar aktuell status direkt och vidarebefordrar databasnotiser", async () => {
    const { baseUrl, cookie, listener, getById } = await setup("admin");
    const socket = connect(baseUrl, cookie);

    const firstStatus = new Promise<Record<string, unknown>>((resolve) =>
      socket.once("job-status", resolve),
    );
    socket.emit("subscribe-job", { jobId: "job-1" });

    await expect(firstStatus).resolves.toMatchObject({
      id: "job-1",
      status: "running",
      processed: 1,
    });

    getById.mockResolvedValue(makeJob({ status: "completed", processed: 3 }));
    const completed = new Promise<Record<string, unknown>>((resolve) =>
      socket.once("job-status", resolve),
    );
    listener.handlers?.onJobChanged("job-1");

    await expect(completed).resolves.toMatchObject({
      status: "completed",
      processed: 3,
    });

    getById.mockResolvedValue(makeJob({ status: "failed", processed: 3 }));
    const resynced = new Promise<Record<string, unknown>>((resolve) =>
      socket.once("job-status", resolve),
    );
    listener.handlers?.onReconnect();
    await expect(resynced).resolves.toMatchObject({ status: "failed" });
  });

  it("nekar en inloggad icke-admin", async () => {
    const { baseUrl, cookie } = await setup("user");
    const socket = connect(baseUrl, cookie);

    const error = await new Promise<Error>((resolve) =>
      socket.once("connect_error", resolve),
    );

    expect(error.message).toBe("forbidden");
  });

  it("nekar en oinloggad klient", async () => {
    const { baseUrl } = await setup("admin");
    const socket = connect(baseUrl, "");

    const error = await new Promise<Error>((resolve) =>
      socket.once("connect_error", resolve),
    );

    expect(error.message).toBe("unauthorized");
  });
});
