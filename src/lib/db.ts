/**
 * INDOBID — DATABASE SINGLETON (BACKWARD COMPATIBILITY GATEWAY)
 * Delegates to centralized infrastructure layer: src/infrastructure/database/prisma.ts
 */

import { prisma } from '../infrastructure/database/prisma';

export { prisma };
export default prisma;
