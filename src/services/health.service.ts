import { prisma } from '../config/prisma.js';

export const checkDatabaseHealth = async (): Promise<boolean> => {
  await prisma.$queryRaw`SELECT 1`;
  return true;
};