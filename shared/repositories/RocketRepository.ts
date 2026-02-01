import { Rocket } from '@prisma/client';
import { prisma } from '../database/client';
import {
    IRocketRepository,
    CreateRocketData,
    UpdateRocketData,
    RocketQueryOptions,
} from './interfaces/IRocketRepository';
import { logger } from '../logger/logger';

export class RocketRepository implements IRocketRepository {
    public async create(data: CreateRocketData): Promise<Rocket> {
        try {
            logger.debug('Creating rocket', { channel: data.channel });
            return await prisma.rocket.create({ data });
        } catch (error) {
            logger.error('Failed to create rocket', { error, channel: data.channel });
            throw error;
        }
    }

    public async findByChannel(channel: string): Promise<Rocket | null> {
        try {
            logger.debug('Finding rocket by channel', { channel });
            return await prisma.rocket.findUnique({
                where: { channel },
            });
        } catch (error) {
            logger.error('Failed to find rocket', { error, channel });
            throw error;
        }
    }

    public async findMany(options: RocketQueryOptions): Promise<Rocket[]> {
        try {
            const { sortBy, order, skip, take, where } = options;

            logger.debug('Finding rockets', options);

            return await prisma.rocket.findMany({
                where,
                orderBy: sortBy ? { [sortBy]: order || 'asc' } : undefined,
                skip,
                take,
            });
        } catch (error) {
            logger.error('Failed to find rockets', { error, options });
            throw error;
        }
    }

    public async count(where?: any): Promise<number> {
        try {
            return await prisma.rocket.count({ where });
        } catch (error) {
            logger.error('Failed to count rockets', { error, where });
            throw error;
        }
    }

    public async update(channel: string, data: UpdateRocketData): Promise<Rocket> {
        try {
            logger.debug('Updating rocket', { channel, data });
            return await prisma.rocket.update({
                where: { channel },
                data,
            });
        } catch (error) {
            logger.error('Failed to update rocket', { error, channel });
            throw error;
        }
    }

    public async delete(channel: string): Promise<void> {
        try {
            logger.debug('Deleting rocket', { channel });
            await prisma.rocket.delete({
                where: { channel },
            });
        } catch (error) {
            logger.error('Failed to delete rocket', { error, channel });
            throw error;
        }
    }

    public async getAverageSpeed(where?: any): Promise<number> {
        try {
            const result = await prisma.rocket.aggregate({
                _avg: { currentSpeed: true },
                where,
            });
            return result._avg.currentSpeed || 0;
        } catch (error) {
            logger.error('Failed to get average speed', { error, where });
            throw error;
        }
    }
}