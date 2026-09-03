/**
 * INDOBID — DEBATE MODULE TYPES
 */

export interface CreateDebateDTO {
  title: string;
  content: string;
  categoryId: string;
  authorId: string;
  amountPaise?: number; // 0 = free post, >= 200 = paid backing
}

export interface UpdateDebateDTO {
  title?: string;
  content?: string;
}

export interface ContinueDebateDTO {
  debateId: string;
  userId: string;
  content: string;
  amountPaise: number;
}
