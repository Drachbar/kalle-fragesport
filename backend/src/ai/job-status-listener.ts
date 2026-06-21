import { Client, type Notification } from "pg";
import { getDbConfig } from "../db/config";

const CHANNEL = "auto_update_job_status";

export interface NotificationClient {
  connect(): Promise<unknown>;
  query(sql: string): Promise<unknown>;
  end(): Promise<void>;
  on(event: "notification", listener: (message: Notification) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "end", listener: () => void): this;
}

export interface JobStatusListenerHandlers {
  onJobChanged(jobId: string): void;
  onReconnect(): void;
}

export interface JobStatusListener {
  start(handlers: JobStatusListenerHandlers): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Dedikerad LISTEN-anslutning. En vanlig pg-pool kan inte användas eftersom
 * LISTEN måste ligga kvar på samma anslutning under hela poddens livstid.
 */
export class PgJobStatusListener implements JobStatusListener {
  private client: NotificationClient | null = null;
  private handlers: JobStatusListenerHandlers | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private connecting = false;
  private nextReconnectDelayMs: number;

  constructor(
    private readonly createClient: () => NotificationClient = () =>
      new Client(getDbConfig()),
    private readonly reconnectDelayMs = 1_000,
  ) {
    this.nextReconnectDelayMs = reconnectDelayMs;
  }

  async start(handlers: JobStatusListenerHandlers): Promise<void> {
    this.handlers = handlers;
    this.stopped = false;
    await this.connect(false);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const client = this.client;
    this.client = null;
    if (client) {
      await client.end();
    }
  }

  private async connect(isReconnect: boolean): Promise<void> {
    if (this.stopped || this.connecting) {
      return;
    }
    this.connecting = true;
    const client = this.createClient();
    this.client = client;
    client.on("notification", (message) => {
      if (message.channel === CHANNEL && message.payload) {
        this.handlers?.onJobChanged(message.payload);
      }
    });
    client.on("error", () => this.handleDisconnect(client));
    client.on("end", () => this.handleDisconnect(client));

    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      this.nextReconnectDelayMs = this.reconnectDelayMs;
      if (isReconnect) {
        this.handlers?.onReconnect();
      }
    } catch (error) {
      this.handleDisconnect(client);
      if (!isReconnect) {
        throw error;
      }
    } finally {
      this.connecting = false;
    }
  }

  private handleDisconnect(client: NotificationClient): void {
    if (this.stopped || this.client !== client || this.reconnectTimer) {
      return;
    }
    this.client = null;
    void client.end().catch(() => undefined);
    const delay = this.nextReconnectDelayMs;
    this.nextReconnectDelayMs = Math.min(delay * 2, 30_000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect(true);
    }, delay);
  }
}
