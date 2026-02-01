import { BufferedMessage } from '@prisma/client';
import { prisma } from '../database/client';
import {
  IBufferedMessageRepository,
  CreateBufferedMessageData,
} from './interfaces/IBufferedMessageRepository';
import { logger } from '../logger/logger';

export class BufferedMessageRepository implements IBufferedMessageRepository {
  async create(data: CreateBufferedMessageData): Promise<BufferedMessage> {
    try {
      logger.debug('Buffering message', {
        channel: data.channel,
        messageNumber: data.messageNumber,
      });

      return await prisma.bufferedMessage.create({ data });
    } catch (error) {
      logger.error('Failed to buffer message', {
        error,
        channel: data.channel,
        messageNumber: data.messageNumber,
      });
      throw error;
    }
  }

  async findUnique(
    channel: string,
    messageNumber: number
  ): Promise<BufferedMessage | null> {
    try {
      return await prisma.bufferedMessage.findUnique({
        where: {
          channel_messageNumber: {
            channel,
            messageNumber,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find buffered message', {
        error,
        channel,
        messageNumber,
      });
      throw error;
    }
  }

  async findByChannel(channel: string): Promise<BufferedMessage[]> {
    try {
      return await prisma.bufferedMessage.findMany({
        where: { channel },
        orderBy: { messageNumber: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to find buffered messages', { error, channel });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      logger.debug('Deleting buffered message', { id });
      await prisma.bufferedMessage.delete({ where: { id } });
    } catch (error) {
      logger.error('Failed to delete buffered message', { error, id });
      throw error;
    }
  }

  async deleteByChannel(channel: string): Promise<number> {
    try {
      logger.debug('Deleting all buffered messages for channel', { channel });
      const result = await prisma.bufferedMessage.deleteMany({
        where: { channel },
      });
      return result.count;
    } catch (error) {
      logger.error('Failed to delete buffered messages', { error, channel });
      throw error;
    }
  }
}