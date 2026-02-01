import { Message } from '@prisma/client';
import { prisma } from '../database/client';
import {
    IMessageRepository,
    CreateMessageData,
} from './interfaces/IMessageRepository';
import { logger } from '../logger/logger';

export class MessageRepository implements IMessageRepository {
    public async create(data: CreateMessageData): Promise<Message> {
        try {
            logger.debug('Creating message', {
                channel: data.channel,
                messageNumber: data.messageNumber,
            });
            return await prisma.message.create({ data });
        } catch (error) {
            if (error instanceof Error && error.message.includes('Unique constraint')) {
                logger.debug('Message already exists', {
                    channel: data.channel,
                    messageNumber: data.messageNumber,
                });
                throw error;
            }
            logger.error('Failed to create message', { error, data });
            throw error;
        }
    }

    public async findUnique(channel: string, messageNumber: number): Promise<Message | null> {
        try {
            logger.debug('Finding message', { channel, messageNumber });
            return await prisma.message.findUnique({
                where: {
                    channel_messageNumber: {
                        channel,
                        messageNumber,
                    },
                },
            });
        } catch (error) {
            logger.error('Failed to find message', { error, channel, messageNumber });
            throw error;
        }
    }

    public async findByChannel(channel: string): Promise<Message[]> {
        try {
            logger.debug('Finding messages by channel', { channel });
            return await prisma.message.findMany({
                where: { channel },
                orderBy: { messageNumber: 'asc' },
            });
        } catch (error) {
            logger.error('Failed to find messages', { error, channel });
            throw error;
        }
    }
}