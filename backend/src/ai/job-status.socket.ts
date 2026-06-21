import type { Server as HttpServer } from "node:http";
import type { Request, RequestHandler } from "express";
import { Server as SocketServer } from "socket.io";
import {
  jobsRepository,
  type AutoUpdateJob,
  type JobsRepository,
} from "../questions/jobs.repository";
import {
  PgJobStatusListener,
  type JobStatusListener,
} from "./job-status-listener";

const ROOM_PREFIX = "job:";

export interface PublicJobStatus {
  id: string;
  status: AutoUpdateJob["status"];
  total: number;
  processed: number;
  suggestionsCreated: number;
  error: string | null;
}

export interface JobStatusSocketDeps {
  jobsRepo: Pick<JobsRepository, "getById">;
  listener: JobStatusListener;
}

export interface JobStatusSocket {
  close(): Promise<void>;
}

const defaultDeps: JobStatusSocketDeps = {
  jobsRepo: jobsRepository,
  listener: new PgJobStatusListener(),
};

function publicStatus(job: AutoUpdateJob): PublicJobStatus {
  return {
    id: job.id,
    status: job.status,
    total: job.total,
    processed: job.processed,
    suggestionsCreated: job.suggestionsCreated,
    error: job.error,
  };
}

/** Kopplar poddens Socket.IO-server till PostgreSQL-notifieringar. */
export async function createJobStatusSocket(
  httpServer: HttpServer,
  sessionMiddleware: RequestHandler,
  deps: JobStatusSocketDeps = defaultDeps,
): Promise<JobStatusSocket> {
  const io = new SocketServer(httpServer, {
    path: "/api/socket.io",
    transports: ["websocket"],
  });

  // Engine.IO-handshaken är ett vanligt HTTP-anrop, så samma signerade
  // sessionscookie och PostgreSQL-store kan återanvändas av alla pods.
  io.engine.use(sessionMiddleware);
  io.use((socket, next) => {
    const request = socket.request as Request;
    if (!request.session?.userId) {
      next(new Error("unauthorized"));
      return;
    }
    if (request.session.role !== "admin") {
      next(new Error("forbidden"));
      return;
    }
    next();
  });

  async function emitCurrent(jobId: string): Promise<void> {
    const job = await deps.jobsRepo.getById(jobId);
    if (job) {
      io.to(`${ROOM_PREFIX}${jobId}`).emit("job-status", publicStatus(job));
    }
  }

  async function resyncRooms(): Promise<void> {
    const rooms = [...io.sockets.adapter.rooms.keys()].filter((room) =>
      room.startsWith(ROOM_PREFIX),
    );
    await Promise.all(
      rooms.map((room) => emitCurrent(room.slice(ROOM_PREFIX.length))),
    );
  }

  io.on("connection", (socket) => {
    socket.on(
      "subscribe-job",
      async (
        payload: { jobId?: unknown },
        acknowledge?: (result: { ok: boolean; error?: string }) => void,
      ) => {
        const jobId =
          typeof payload?.jobId === "string" ? payload.jobId.trim() : "";
        if (!jobId) {
          acknowledge?.({ ok: false, error: "Ogiltigt jobb-id" });
          return;
        }

        try {
          // Gå med i rummet före DB-läsningen så att en statusändring som sker
          // samtidigt med prenumerationen inte tappas mellan läsning och join.
          await socket.join(`${ROOM_PREFIX}${jobId}`);
          const job = await deps.jobsRepo.getById(jobId);
          if (!job) {
            await socket.leave(`${ROOM_PREFIX}${jobId}`);
            acknowledge?.({ ok: false, error: "Jobbet hittades inte" });
            return;
          }

          socket.emit("job-status", publicStatus(job));
          acknowledge?.({ ok: true });
        } catch {
          await socket.leave(`${ROOM_PREFIX}${jobId}`);
          acknowledge?.({ ok: false, error: "Kunde inte läsa jobbstatus" });
        }
      },
    );
  });

  await deps.listener.start({
    onJobChanged: (jobId) => {
      void emitCurrent(jobId).catch((error: unknown) =>
        console.error("Kunde inte skicka jobbstatus:", error),
      );
    },
    onReconnect: () => {
      void resyncRooms().catch((error: unknown) =>
        console.error("Kunde inte synkronisera jobbstatus:", error),
      );
    },
  });

  return {
    async close() {
      await deps.listener.stop();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
