import { Router } from 'express';
import { validateMessage } from '../middleware/validation';
import { asyncHandler } from '../middleware/error-handler';
import { MessageController } from '../controller/message.controller';
import { MessageProcessorService } from '../services/message-processor.service';
import { IRocketRepository } from '@rocket-app/shared/repositories/interfaces/IRocketRepository';
import { IMessageRepository } from '@rocket-app/shared/repositories/interfaces/IMessageRepository';
import { RocketRepository } from '@rocket-app/shared/repositories/RocketRepository';
import { MessageRepository } from '@rocket-app/shared/repositories/MessageRepository';
import { BufferedMessageRepository, IBufferedMessageRepository } from '@rocket-app/shared';

const router: Router = Router();
const rocketRepository: IRocketRepository = new RocketRepository();
const messageRepository: IMessageRepository = new MessageRepository();
const bufferedMessageRepository: IBufferedMessageRepository = new BufferedMessageRepository();
const messageProcessorService: MessageProcessorService = new MessageProcessorService(rocketRepository, messageRepository, bufferedMessageRepository);
const messageController: MessageController = new MessageController(messageProcessorService);

/**
 * POST /messages
 * Receive and process rocket messages
 */
router.post(
  '/messages',
  validateMessage,
  asyncHandler((req, res) => messageController.receiveMessage(req, res))
);

export default router;