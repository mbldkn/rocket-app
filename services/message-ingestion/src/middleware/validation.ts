import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '@rocket-app/shared/logger/logger';

// Zod schema for message validation
const MessageMetadataSchema = z.object({
  channel: z.string().uuid('Channel must be a valid UUID'),
  messageNumber: z.number().int().positive('Message number must be a positive integer'),
  messageTime: z.string().refine((val) => {
    // Accept any valid date string that can be parsed
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, 'Message time must be a valid datetime string'),
  messageType: z.enum([
    'RocketLaunched',
    'RocketSpeedIncreased',
    'RocketSpeedDecreased',
    'RocketExploded',
    'RocketMissionChanged',
  ]),
});

const RocketLaunchedSchema = z.object({
  type: z.string().min(1, 'Rocket type is required'),
  launchSpeed: z.number().int().nonnegative('Launch speed must be non-negative'),
  mission: z.string().min(1, 'Mission is required'),
});

const RocketSpeedIncreasedSchema = z.object({
  by: z.number().int().positive('Speed increase must be positive'),
});

const RocketSpeedDecreasedSchema = z.object({
  by: z.number().int().positive('Speed decrease must be positive'),
});

const RocketExplodedSchema = z.object({
  reason: z.string().min(1, 'Explosion reason is required'),
});

const RocketMissionChangedSchema = z.object({
  newMission: z.string().min(1, 'New mission is required'),
});

const IncomingMessageSchema = z.object({
  metadata: MessageMetadataSchema,
  message: z.union([
    RocketLaunchedSchema,
    RocketSpeedIncreasedSchema,
    RocketSpeedDecreasedSchema,
    RocketExplodedSchema,
    RocketMissionChangedSchema,
  ]),
});

export const validateMessage = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validatedData = IncomingMessageSchema.parse(req.body);
    req.body = validatedData; // Replace with validated data
    
    logger.debug('Message validation successful', {
      channel: validatedData.metadata.channel,
      messageType: validatedData.metadata.messageType,
      messageNumber: validatedData.metadata.messageNumber,
    });
    
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      
      logger.warn('Message validation failed', {
        errors,
        body: req.body,
      });
      
      res.status(400).json({
        success: false,
        error: 'Invalid message format',
        details: errors,
      });
      return;
    }
    
    logger.error('Unexpected validation error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error during validation',
    });
  }
};

export { IncomingMessageSchema };