import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/logger';

// Singleton pattern for Prisma Client
class DatabaseClient {
    private static instance: PrismaClient;

    private constructor() { }

    public static getInstance(): PrismaClient {
        if (!DatabaseClient.instance) {
            DatabaseClient.instance = new PrismaClient({
                log: [
                    { level: 'query', emit: 'event' },
                    { level: 'error', emit: 'event' },
                    { level: 'warn', emit: 'event' },
                ],
            });

            // Log database queries in development
            if (process.env.NODE_ENV === 'development') {
                DatabaseClient.instance.$on('query' as never, (e: any) => {
                    logger.debug('Database Query', {
                        query: e.query,
                        params: e.params,
                        duration: `${e.duration}ms`,
                    });
                });
            }

            DatabaseClient.instance.$on('error' as never, (e: any) => {
                logger.error('Database Error', { error: e });
            });

            DatabaseClient.instance.$on('warn' as never, (e: any) => {
                logger.warn('Database Warning', { warning: e });
            });
        }

        return DatabaseClient.instance;
    }

    public static async disconnect(): Promise<void> {
        if (DatabaseClient.instance) {
            await DatabaseClient.instance.$disconnect();
            logger.info('Database connection closed');
        }
    }

    public static async connect(): Promise<void> {
        const client = DatabaseClient.getInstance();
        try {
            await client.$connect();
            logger.info('Database connection established');
        } catch (error) {
            logger.error('Failed to connect to database', { error });
            throw error;
        }
    }
}

export const prisma = DatabaseClient.getInstance();
export const connectDatabase = DatabaseClient.connect;
export const disconnectDatabase = DatabaseClient.disconnect;
