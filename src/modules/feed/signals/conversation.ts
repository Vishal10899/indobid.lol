/**
 * INDOBID — CONVERSATION DEPTH & DIALOGUE SIGNAL
 * Rewards multi-party perspective exchanges and reply sequence depth.
 */

export const CONVERSATION_CONFIG = {
  RESPONSE_WEIGHT: 15,
  UNIQUE_PARTICIPANT_WEIGHT: 10,
  MAX_PARTICIPANT_BONUS: 80,
};

export function calculateConversationScore(contributionCount: number, uniqueParticipants: number): number {
  const replyCount = Math.max(0, contributionCount - 1);
  const responseScore = Math.log1p(replyCount) * CONVERSATION_CONFIG.RESPONSE_WEIGHT;
  const participantScore = Math.min(
    CONVERSATION_CONFIG.MAX_PARTICIPANT_BONUS,
    uniqueParticipants * CONVERSATION_CONFIG.UNIQUE_PARTICIPANT_WEIGHT
  );
  return responseScore + participantScore;
}
