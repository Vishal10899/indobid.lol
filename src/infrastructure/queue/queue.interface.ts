/**
 * INDOBID — BACKGROUND QUEUE INTERFACE
 * Abstraction enabling asynchronous task execution (In-Memory, BullMQ, SQS)
 */

export interface QueueJob<T = any> {
  id: string;
  name: string;
  data: T;
  timestamp: number;
}

export type JobHandler<T = any> = (data: T) => Promise<void>;

export interface IQueueProvider {
  enqueue<T>(name: string, data: T): Promise<string>;
  process<T>(name: string, handler: JobHandler<T>): void;
}
