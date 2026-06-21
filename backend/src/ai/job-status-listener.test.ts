import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PgJobStatusListener,
  type NotificationClient,
} from "./job-status-listener";

class FakeClient extends EventEmitter implements NotificationClient {
  connect = vi.fn().mockResolvedValue(undefined);
  query = vi.fn().mockResolvedValue(undefined);
  end = vi.fn().mockResolvedValue(undefined);
}

afterEach(() => vi.useRealTimers());

describe("PgJobStatusListener", () => {
  it("lyssnar på kanalen och skickar vidare jobb-id", async () => {
    const client = new FakeClient();
    const onJobChanged = vi.fn();
    const listener = new PgJobStatusListener(() => client, 100);

    await listener.start({ onJobChanged, onReconnect: vi.fn() });
    client.emit("notification", {
      channel: "auto_update_job_status",
      payload: "job-1",
    });

    expect(client.query).toHaveBeenCalledWith(
      "LISTEN auto_update_job_status",
    );
    expect(onJobChanged).toHaveBeenCalledWith("job-1");
    await listener.stop();
  });

  it("återansluter och begär omsynkronisering efter anslutningsfel", async () => {
    vi.useFakeTimers();
    const first = new FakeClient();
    const second = new FakeClient();
    const clients = [first, second];
    const onReconnect = vi.fn();
    const listener = new PgJobStatusListener(
      () => clients.shift() ?? second,
      100,
    );

    await listener.start({ onJobChanged: vi.fn(), onReconnect });
    first.emit("error", new Error("connection lost"));
    await vi.advanceTimersByTimeAsync(100);

    expect(second.connect).toHaveBeenCalledOnce();
    expect(second.query).toHaveBeenCalledWith("LISTEN auto_update_job_status");
    expect(onReconnect).toHaveBeenCalledOnce();
    await listener.stop();
  });
});
