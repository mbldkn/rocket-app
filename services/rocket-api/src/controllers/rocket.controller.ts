import { Request, Response } from 'express';
import { RocketService } from '../services/rocket.service';
import { logger } from '@rocket-app/shared/logger/logger';
import { RocketListQuery } from '@rocket-app/shared/types/messages.types';

export class RocketController {

  private rocketService: RocketService;

  constructor(rocketService: RocketService) {
    this.rocketService = rocketService;
  }

  /**
   * GET /api/rockets/:channel
   * Get a specific rocket by channel ID
   */
  async getRocketByChannel(req: Request, res: Response): Promise<void> {
    try {
      const { channel } = req.params;

      logger.debug('Request for rocket by channel', { channel });

      const rocket = await this.rocketService.getRocketByChannel(channel);

      if (!rocket) {
        res.status(404).json({
          success: false,
          error: 'Rocket not found',
          channel,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: rocket,
      });
    } catch (error) {
      logger.error('Error in getRocketByChannel', {
        error: error instanceof Error ? error.message : error,
        channel: req.params.channel,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve rocket',
      });
    }
  }

  /**
   * GET /api/rockets
   * Get all rockets with optional sorting and filtering
   */
  async getAllRockets(req: Request, res: Response): Promise<void> {
  try {
    // Parse and validate query parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize as string) || 50));

    const query: RocketListQuery = {
      sortBy: req.query.sortBy as any,
      order: req.query.order as any,
      page: page,
      pageSize: pageSize,
      status: req.query.status as any,
    };

    logger.debug('Request for all rockets', query);

    const result = await this.rocketService.getAllRockets(query);

    res.status(200).json({
      success: true,
      data: result.rockets,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
    });
  } catch (error) {
    logger.error('Error in getAllRockets', {
      error: error instanceof Error ? error.message : error,
      query: req.query,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rockets',
    });
  }
}

  /**
   * GET /api/rockets/stats
   * Get rocket statistics
   */
  async getStatistics(_req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Request for rocket statistics');

      const stats = await this.rocketService.getRocketStatistics();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error in getStatistics', {
        error: error instanceof Error ? error.message : error,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics',
      });
    }
  }
}
