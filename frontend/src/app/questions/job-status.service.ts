import { Inject, Injectable, InjectionToken } from '@angular/core';
import { io } from 'socket.io-client';
import { Observable } from 'rxjs';
import type { AutoUpdateJobStatus } from './questions.service';

export interface JobStatusSocketClient {
  connect(): void;
  close(): void;
  on(event: string, handler: (...args: never[]) => void): this;
  emit(
    event: string,
    payload: { jobId: string },
    acknowledge: (result: { ok: boolean; error?: string }) => void,
  ): void;
}

type JobStatusSocketFactory = () => JobStatusSocketClient;

export const JOB_STATUS_SOCKET_FACTORY =
  new InjectionToken<JobStatusSocketFactory>('JOB_STATUS_SOCKET_FACTORY', {
    providedIn: 'root',
    factory: () => () =>
      io({
        path: '/api/socket.io',
        transports: ['websocket'],
        withCredentials: true,
        autoConnect: false,
      }) as unknown as JobStatusSocketClient,
  });

@Injectable({ providedIn: 'root' })
export class JobStatusService {
  constructor(
    @Inject(JOB_STATUS_SOCKET_FACTORY)
    private readonly createSocket: JobStatusSocketFactory,
  ) {}

  watch(jobId: string): Observable<AutoUpdateJobStatus> {
    return new Observable<AutoUpdateJobStatus>((observer) => {
      const socket = this.createSocket();

      socket.on('connect', () => {
        socket.emit('subscribe-job', { jobId }, (result) => {
          if (!result.ok) {
            observer.error(new Error(result.error ?? 'Kunde inte följa jobbet'));
          }
        });
      });
      socket.on('job-status', (status: AutoUpdateJobStatus) => {
        if (status.id !== jobId) return;
        observer.next(status);
        if (status.status === 'completed' || status.status === 'failed') {
          observer.complete();
        }
      });
      socket.on('connect_error', (error: Error) => {
        if (error.message === 'unauthorized' || error.message === 'forbidden') {
          observer.error(error);
        }
      });

      socket.connect();
      return () => socket.close();
    });
  }
}
