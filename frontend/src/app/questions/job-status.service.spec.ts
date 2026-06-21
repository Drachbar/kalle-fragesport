import { TestBed } from '@angular/core/testing';
import {
  JOB_STATUS_SOCKET_FACTORY,
  JobStatusService,
  type JobStatusSocketClient,
} from './job-status.service';
import type { AutoUpdateJobStatus } from './questions.service';

class FakeSocket implements JobStatusSocketClient {
  private readonly handlers = new Map<string, Set<(...args: never[]) => void>>();
  connect = vi.fn(() => this);
  close = vi.fn(() => this);
  emit = vi.fn();

  on(event: string, handler: (...args: never[]) => void): this {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler);
    this.handlers.set(event, handlers);
    return this;
  }

  trigger(event: string, value?: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(value as never);
    }
  }
}

describe('JobStatusService', () => {
  it('prenumererar på jobbet efter anslutning och skickar status vidare', () => {
    const socket = new FakeSocket();
    TestBed.configureTestingModule({
      providers: [
        JobStatusService,
        { provide: JOB_STATUS_SOCKET_FACTORY, useValue: () => socket },
      ],
    });
    const service = TestBed.inject(JobStatusService);
    let received: AutoUpdateJobStatus | undefined;

    service.watch('job-1').subscribe((status) => (received = status));
    socket.trigger('connect');
    expect(socket.emit).toHaveBeenCalledWith(
      'subscribe-job',
      { jobId: 'job-1' },
      expect.any(Function),
    );

    const status: AutoUpdateJobStatus = {
      id: 'job-1',
      status: 'running',
      total: 2,
      processed: 1,
      suggestionsCreated: 0,
      error: null,
    };
    socket.trigger('job-status', status);
    expect(received).toEqual(status);
  });

  it('stänger socketen när prenumerationen avslutas', () => {
    const socket = new FakeSocket();
    TestBed.configureTestingModule({
      providers: [
        JobStatusService,
        { provide: JOB_STATUS_SOCKET_FACTORY, useValue: () => socket },
      ],
    });
    const subscription = TestBed.inject(JobStatusService)
      .watch('job-1')
      .subscribe();

    subscription.unsubscribe();

    expect(socket.close).toHaveBeenCalledOnce();
  });

  it('slutför och stänger anslutningen vid terminal jobbstatus', () => {
    const socket = new FakeSocket();
    TestBed.configureTestingModule({
      providers: [
        JobStatusService,
        { provide: JOB_STATUS_SOCKET_FACTORY, useValue: () => socket },
      ],
    });
    const complete = vi.fn();
    TestBed.inject(JobStatusService).watch('job-1').subscribe({ complete });

    socket.trigger('job-status', {
      id: 'job-1',
      status: 'completed',
      total: 2,
      processed: 2,
      suggestionsCreated: 1,
      error: null,
    } satisfies AutoUpdateJobStatus);

    expect(complete).toHaveBeenCalledOnce();
    expect(socket.close).toHaveBeenCalledOnce();
  });
});
