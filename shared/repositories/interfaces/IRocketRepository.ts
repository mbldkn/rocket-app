import { Rocket } from '@prisma/client';
import { RocketStatus } from '../../types/messages.types';

export interface CreateRocketData {
    channel: string;
    type: string;
    currentSpeed: number;
    mission: string;
    status: RocketStatus;
    explosionReason: string | null;
    lastMessageNumber: number;
    lastMessageTime: Date;
}

export interface UpdateRocketData {
    currentSpeed?: number;
    mission?: string;
    status?: RocketStatus;
    explosionReason?: string | null;
    lastMessageNumber?: number;
    lastMessageTime?: Date;
}

export interface RocketQueryOptions {
    sortBy?: string;
    order?: 'asc' | 'desc';
    skip?: number;
    take?: number;
    where?: any;
}

export interface IRocketRepository {
    // Create
    create(data: CreateRocketData): Promise<Rocket>;

    // Read
    findByChannel(channel: string): Promise<Rocket | null>;
    findMany(options: RocketQueryOptions): Promise<Rocket[]>;
    count(where?: any): Promise<number>;

    // Update
    update(channel: string, data: UpdateRocketData): Promise<Rocket>;

    // Delete (if needed)
    delete(channel: string): Promise<void>;

    // Aggregations
    getAverageSpeed(where?: any): Promise<number>;
}