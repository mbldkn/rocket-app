import { BufferedMessage } from '@prisma/client';

export interface CreateBufferedMessageData {
  channel: string;
  messageNumber: number;
  messageTime: Date;
  messageType: string;
  payload: string;
}

export interface IBufferedMessageRepository {
  /**
   * Create a buffered message
   */
  create(data: CreateBufferedMessageData): Promise<BufferedMessage>;

  /**
   * Find a buffered message by channel and message number
   */
  findUnique(channel: string, messageNumber: number): Promise<BufferedMessage | null>;

  /**
   * Find all buffered messages for a channel, ordered by messageNumber
   */
  findByChannel(channel: string): Promise<BufferedMessage[]>;

  /**
   * Delete a buffered message by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all buffered messages for a channel
   */
  deleteByChannel(channel: string): Promise<number>;
}