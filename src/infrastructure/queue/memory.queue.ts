/**
 * INDOBID — IN-MEMORY QUEUE IMPLEMENTATION
 */

import { IQueueProvider, JobHandler, QueueJob } from './queue.interface';

export class MemoryQueueProvider implements IQueueProvider {
  private handlers = new Map<string, JobHandler<any>[]>();

  async enqueue<T>(name: string, data: T): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job: QueueJob<T> = {
      id: jobId,
      name,
      data,
      timestamp: Date.now(),
    };

    const registeredHandlers = this.handlers.get(name) || [];
    
    // Execute asynchronously
    if (typeof setImmediate !== 'undefined') {
      setImmediate(async () => {
        for (const handler of registeredHandlers) {
          try {
            await handler(job.data);
          } catch (err) {
            console.error(`[Queue Error] Job ${name} (${jobId}) failed:`, err);
          }
        }
      });
    }

    return jobId;
  }

  process<T>(name: string, handler: JobHandler<T>): void {
    const existing = this.handlers.get(name) || [];
    existing.push(handler);
    this.handlers.set(name, existing);
  }
}

export const memoryQueueProvider = new MemoryQueueProvider();
