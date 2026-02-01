import dotenv from 'dotenv';
import { createServer } from './server';
import { connectDatabase, disconnectDatabase } from '@rocket-app/shared/database/client';
import { logger } from '@rocket-app/shared/logger/logger';

dotenv.config({ path: '../../.env' });

const PORT = process.env.INGESTION_PORT || 8088;
const HOST = process.env.INGESTION_HOST || '0.0.0.0';

async function startServer() {
    try {

        await connectDatabase();
        logger.info('Database connected successfully');

        const app = createServer();

        const server = app.listen(Number(PORT), HOST, () => {
            logger.info(`Message Ingestion Service started`, {
                port: PORT,
                host: HOST,
                environment: process.env.NODE_ENV || 'development',
            });
        });

        const shutdown = async (signal: string) => {
            logger.info(`${signal} received, shutting down gracefully`);

            server.close(async () => {
                logger.info('HTTP server closed');

                try {
                    await disconnectDatabase();
                    logger.info('Database connection closed');
                    process.exit(0);
                } catch (error) {
                    logger.error('Error during shutdown', { error });
                    process.exit(1);
                }
            });

            setTimeout(() => {
                logger.error('Forced shutdown due to timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (error) {
        logger.error('Failed to start server', { error });
        process.exit(1);
    }
}

startServer();
