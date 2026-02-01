import { Router } from 'express';
import { RocketController } from '../controllers/rocket.controller';
import { IRocketRepository } from '@rocket-app/shared/repositories/interfaces/IRocketRepository';
import { RocketRepository } from '@rocket-app/shared/repositories/RocketRepository';
import { RocketService } from '../services/rocket.service';

const router: Router = Router();
const rocketRepository: IRocketRepository = new RocketRepository();
const rocketService: RocketService = new RocketService(rocketRepository);
const rocketController: RocketController = new RocketController(rocketService);

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', (req, res) => rocketController.healthCheck(req, res));

/**
 * GET /api/rockets/stats
 * Get rocket statistics
 */
router.get('/api/rockets/stats', (req, res) =>
  rocketController.getStatistics(req, res)
);

/**
 * GET /api/rockets/:channel
 * Get a specific rocket by channel ID
 */
router.get('/api/rockets/:channel', (req, res) =>
  rocketController.getRocketByChannel(req, res)
);

/**
 * GET /api/rockets
 * Get all rockets with optional sorting and filtering
 * Query params:
 *   - sortBy: 'speed' | 'mission' | 'status' | 'type' | 'createdAt'
 *   - order: 'asc' | 'desc'
 *   - page: number
 *   - pageSize: number
 *   - status: 'ACTIVE' | 'EXPLODED'
 */
router.get('/api/rockets', (req, res) =>
  rocketController.getAllRockets(req, res)
);

export default router;
