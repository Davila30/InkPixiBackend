import { checkDatabaseHealth } from '../services/health.service.js';
export const getHealth = async (_req, res) => {
    try {
        await checkDatabaseHealth();
        res.status(200).json({
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'error',
            database: 'disconnected',
        });
    }
};
