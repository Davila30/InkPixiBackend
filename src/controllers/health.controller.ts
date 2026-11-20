import type { Request, Response } from 'express';
import { checkDatabaseHealth } from '../services/health.service.js';

export const getHealth = async (_req: Request, res: Response): Promise<void> => {
  try {
    await checkDatabaseHealth();
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
    });
  }
};