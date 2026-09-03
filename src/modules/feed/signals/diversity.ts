/**
 * INDOBID — AUTHOR DIVERSITY SIGNAL & SPACING CONSTRAINT
 * Enforces creator spacing across feeds so no single author occupies more than 2 consecutive slots.
 */

export function applyAuthorDiversity<T extends { authorUsername: string }>(items: T[], maxConsecutive = 2): T[] {
  if (items.length <= maxConsecutive) return [...items];

  const pool = [...items];
  const diversified: T[] = [];
  let lastAuthor: string | null = null;
  let consecutiveCount = 0;

  while (pool.length > 0) {
    let pickIndex = 0;
    if (lastAuthor && consecutiveCount >= maxConsecutive) {
      const altIndex = pool.findIndex((p) => p.authorUsername !== lastAuthor);
      if (altIndex !== -1) {
        pickIndex = altIndex;
      }
    }

    const picked = pool.splice(pickIndex, 1)[0];
    if (picked.authorUsername === lastAuthor) {
      consecutiveCount++;
    } else {
      lastAuthor = picked.authorUsername;
      consecutiveCount = 1;
    }
    diversified.push(picked);
  }

  return diversified;
}
