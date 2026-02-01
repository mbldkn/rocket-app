import { IRocketRepository } from '@rocket-app/shared/repositories/interfaces/IRocketRepository';
import { Rocket } from '@prisma/client';
import { RocketListQuery, RocketState, RocketStatus } from '@rocket-app/shared/types/messages.types';
import { logError, logger } from '@rocket-app/shared/logger/logger';

export class RocketService {
  private rocketRepository: IRocketRepository;

  constructor(rocketRepository: IRocketRepository) {
    this.rocketRepository = rocketRepository;
  }

  async getRocketByChannel(channel: string): Promise<RocketState | null> {
    try {
      logger.debug('Fetching rocket by channel', { channel });

      const rocket = await this.rocketRepository.findByChannel(channel);

      if (!rocket) {
        logger.debug('Rocket not found', { channel });
        return null;
      }

      logger.info('Rocket retrieved', {
        channel: rocket.channel,
        rocketType: rocket.type,
        status: rocket.status,
      });

      return this.mapToRocketState(rocket);
    } catch (error) {
      logError('Error fetching rocket', error, { channel });
      throw error;
    }
  }

  async getAllRockets(query: RocketListQuery): Promise<{
    rockets: RocketState[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const {
        sortBy = 'createdAt',
        order = 'desc',
        page = 1,
        pageSize = 50,
        status,
      } = query;

      logger.debug('Fetching all rockets', {
        sortBy,
        order,
        page,
        pageSize,
        status,
      });

      const skip = (page - 1) * pageSize;
      const where = status ? { status } : undefined;

      const [rockets, total] = await Promise.all([
        this.rocketRepository.findMany({
          where,
          sortBy: sortBy === 'speed' ? 'currentSpeed' : sortBy,
          order,
          skip,
          take: pageSize,
        }),
        this.rocketRepository.count(where),
      ]);

      logger.info('Rockets retrieved', {
        count: rockets.length,
        total,
        page,
        pageSize,
      });

      return {
        rockets: rockets.map(this.mapToRocketState),
        total,
        page,
        pageSize,
      };
    } catch (error) {
      logError('Error fetching rockets', error, {});
      throw error;
    }
  }

  async getRocketStatistics(): Promise<{
    total: number;
    active: number;
    exploded: number;
    averageSpeed: number;
  }> {
    try {
      logger.debug('Fetching rocket statistics');

      const [total, active, exploded, averageSpeed] = await Promise.all([
        this.rocketRepository.count(),
        this.rocketRepository.count({ status: RocketStatus.ACTIVE }),
        this.rocketRepository.count({ status: RocketStatus.EXPLODED }),
        this.rocketRepository.getAverageSpeed({ status: RocketStatus.ACTIVE }),
      ]);

      logger.info('Statistics retrieved', {
        total,
        active,
        exploded,
        averageSpeed,
      });

      return {
        total,
        active,
        exploded,
        averageSpeed: Math.round(averageSpeed),
      };
    } catch (error) {
      logError('Error fetching statistics', error, {});
      throw error;
    }
  }

  private mapToRocketState(rocket: Rocket): RocketState {
    return {
      id: rocket.id,
      channel: rocket.channel,
      type: rocket.type,
      currentSpeed: rocket.currentSpeed,
      mission: rocket.mission,
      status: rocket.status as RocketStatus,
      explosionReason: rocket.explosionReason,
      lastMessageNumber: rocket.lastMessageNumber,
      lastMessageTime: rocket.lastMessageTime,
      createdAt: rocket.createdAt,
      updatedAt: rocket.updatedAt,
    };
  }
}