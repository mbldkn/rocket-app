import { Request, Response } from 'express';
import { MessageProcessorService } from '../services/message-processor.service';
import { logger } from '@rocket-app/shared/logger/logger';
import { IncomingMessage } from '@rocket-app/shared/types/messages.types';


export class MessageController {

    private messageProcessorService: MessageProcessorService;

    constructor(
        messageProcessorService: MessageProcessorService
    ) { 
        this.messageProcessorService = messageProcessorService;
    }

  /**
   * Handle incoming message POST requests
   */
  async receiveMessage(req: Request, res: Response): Promise<void> {
    try {
      const incomingMessage: IncomingMessage = req.body;
      const { channel, messageNumber, messageType } = incomingMessage.metadata;

      logger.info('Processing message', {
        channel,
        messageType,
        messageNumber,
      });

      await this.messageProcessorService.processMessage(incomingMessage);

      res.status(202).json({
        success: true,
        message: 'Message accepted for processing',
        data: {
          channel,
          messageNumber,
          messageType,
        },
      });
    } catch (error) {
      logger.error('Failed to process message', {
        error: error instanceof Error ? error.message : error,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to process message',
      });
    }
  }
}
