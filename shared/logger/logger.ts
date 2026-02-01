import winston from 'winston';
import { mkdirSync } from 'fs';

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Add rocket-specific context if available
    const context: string[] = [];
    if (metadata.channel) {
      context.push(`Channel: ${metadata.channel}`);
    }
    if (metadata.rocketType) {
      context.push(`Type: ${metadata.rocketType}`);
    }
    if (metadata.messageId) {
      context.push(`MessageId: ${metadata.messageId}`);
    }
    if (metadata.messageNumber !== undefined) {
      context.push(`MsgNum: ${metadata.messageNumber}`);
    }
    if (metadata.messageType) {
      context.push(`MsgType: ${metadata.messageType}`);
    }

    if (context.length > 0) {
      logMessage += ` | ${context.join(' | ')}`;
    }

    // Add remaining metadata
    const remainingMeta = { ...metadata };
    delete remainingMeta.channel;
    delete remainingMeta.rocketType;
    delete remainingMeta.messageId;
    delete remainingMeta.messageNumber;
    delete remainingMeta.messageType;

    if (Object.keys(remainingMeta).length > 0) {
      logMessage += ` | ${JSON.stringify(remainingMeta)}`;
    }

    return logMessage;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      ),
    }),
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.json(),
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.json(),
    }),
  ],
});

// Helper functions for consistent logging
export const logRocketOperation = (
  level: 'info' | 'warn' | 'error',
  message: string,
  context: {
    channel?: string;
    rocketType?: string;
    messageId?: string;
    messageNumber?: number;
    messageType?: string;
    [key: string]: any;
  }
) => {
  logger.log(level, message, context);
};

export const logMessageReceived = (
  channel: string,
  messageType: string,
  messageNumber: number,
  messageId?: string
) => {
  logger.info('Message received', {
    channel,
    messageType,
    messageNumber,
    messageId,
  });
};

export const logMessageProcessed = (
  channel: string,
  rocketType: string,
  messageType: string,
  messageNumber: number,
  messageId?: string
) => {
  logger.info('Message processed successfully', {
    channel,
    rocketType,
    messageType,
    messageNumber,
    messageId,
  });
};

export const logMessageDuplicate = (
  channel: string,
  messageNumber: number,
  messageId?: string
) => {
  logger.warn('Duplicate message detected, skipping', {
    channel,
    messageNumber,
    messageId,
  });
};

export const logMessageOutOfOrder = (
  channel: string,
  messageNumber: number,
  lastMessageNumber: number,
  messageId?: string
) => {
  logger.warn('Out-of-order message received', {
    channel,
    messageNumber,
    lastMessageNumber,
    messageId,
    gap: lastMessageNumber - messageNumber,
  });
};

export const logRocketStateChange = (
  channel: string,
  rocketType: string,
  operation: string,
  details: any,
  speed: number = 0,
  reason: string | null= null,
  newMission: string | null = null
) => {
  logger.info(`Rocket state changed: ${operation}`, {
    channel,
    rocketType,
    ...details,
    speed,
    reason,
    newMission,
  });
};

export const logError = (
  message: string,
  error: any,
  context?: {
    channel?: string;
    rocketType?: string;
    messageId?: string;
    [key: string]: any;
  }
) => {
  logger.error(message, {
    error: error.message || error,
    stack: error.stack,
    ...context,
  });
};

// Create logs directory if it doesn't exist
try {
  mkdirSync('logs', { recursive: true });
} catch (err) {
  // Directory might already exist
}
