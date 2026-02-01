import { Message } from '@prisma/client';

export interface CreateMessageData {
    channel: string;
    messageNumber: number;
    messageTime: Date;
    messageType: string;
    payload: string;
}

export interface IMessageRepository {
    create(data: CreateMessageData): Promise<Message>;
    findUnique(channel: string, messageNumber: number): Promise<Message | null>;
    findByChannel(channel: string): Promise<Message[]>;
}