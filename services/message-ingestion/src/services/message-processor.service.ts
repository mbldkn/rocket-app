import { IRocketRepository } from '@rocket-app/shared/repositories/interfaces/IRocketRepository';
import { IMessageRepository } from '@rocket-app/shared/repositories/interfaces/IMessageRepository';
import { IBufferedMessageRepository } from '@rocket-app/shared/repositories/interfaces/IBufferedMessageRepository';
import { Rocket } from '@prisma/client';
import { IncomingMessage, logError, logger, logMessageDuplicate, logMessageOutOfOrder, logMessageProcessed, logMessageReceived, logRocketStateChange, MessageType, RocketStatus } from '@rocket-app/shared';

export class MessageProcessorService {
  private rocketRepository: IRocketRepository;
  private messageRepository: IMessageRepository;
  private bufferedMessageRepository: IBufferedMessageRepository;

  constructor(
    rocketRepository: IRocketRepository,
    messageRepository: IMessageRepository,
    bufferedMessageRepository: IBufferedMessageRepository
  ) {
    this.rocketRepository = rocketRepository;
    this.messageRepository = messageRepository;
    this.bufferedMessageRepository = bufferedMessageRepository;
  }

  async processMessage(incomingMessage: IncomingMessage): Promise<void> {
    const { metadata, message } = incomingMessage;
    const { channel, messageNumber, messageTime, messageType } = metadata;

    try {
      logMessageReceived(channel, messageType, messageNumber);

      // Check for duplicate in processed messages
      const existingMessage = await this.messageRepository.findUnique(
        channel,
        messageNumber
      );

      if (existingMessage) {
        logMessageDuplicate(channel, messageNumber, existingMessage.id);
        return;
      }

      // Check for duplicate in buffered messages
      const bufferedDuplicate = await this.bufferedMessageRepository.findUnique(
        channel,
        messageNumber
      );

      if (bufferedDuplicate) {
        logger.debug('Duplicate buffered message, ignoring', {
          channel,
          messageNumber,
        });
        return;
      }

      // Get current rocket state
      let rocket = await this.rocketRepository.findByChannel(channel);

      // Handle message ordering
      if (rocket) {
        if (messageNumber < rocket.lastMessageNumber) {
          // Out-of-order: Message from the past
          logMessageOutOfOrder(channel, messageNumber, rocket.lastMessageNumber);
          
          // Store in message table for audit (but don't apply state)
          await this.messageRepository.create({
            channel,
            messageNumber,
            messageTime: new Date(messageTime),
            messageType,
            payload: JSON.stringify(message),
          });
          return;
        } else if (messageNumber > rocket.lastMessageNumber + 1) {
          // Future message: Gap in sequence - buffer it
          logger.info('Future message detected, buffering', {
            channel,
            messageNumber,
            expectedNext: rocket.lastMessageNumber + 1,
            gap: messageNumber - rocket.lastMessageNumber - 1,
          });

          await this.bufferedMessageRepository.create({
            channel,
            messageNumber,
            messageTime: new Date(messageTime),
            messageType,
            payload: JSON.stringify(message),
          });

          logger.info('Message buffered successfully', {
            channel,
            messageNumber,
          });
          return;
        }
      }

      // Apply state change
      rocket = await this.applyStateChange(rocket, incomingMessage);

      // Store message for audit trail
      await this.messageRepository.create({
        channel,
        messageNumber,
        messageTime: new Date(messageTime),
        messageType,
        payload: JSON.stringify(message),
      });

      logMessageProcessed(channel, rocket.type, messageType, messageNumber);

      // After processing, check if buffered messages can now be processed
      await this.processBufferedMessages(channel, messageNumber + 1);
    } catch (error) {
      logError('Failed to process message', error, {
        channel,
        messageType,
        messageNumber,
      });
      throw error;
    }
  }

  /**
   * Recursively process buffered messages when gaps are filled
   */
  private async processBufferedMessages(
    channel: string,
    expectedMessageNumber: number
  ): Promise<void> {
    try {
      const buffered = await this.bufferedMessageRepository.findUnique(
        channel,
        expectedMessageNumber
      );

      if (!buffered) {
        // No buffered message for this number, stop recursion
        return;
      }

      logger.info('Processing buffered message', {
        channel,
        messageNumber: buffered.messageNumber,
      });

      // Reconstruct the message
      const message = JSON.parse(buffered.payload);
      const incomingMessage: IncomingMessage = {
        metadata: {
          channel: buffered.channel,
          messageNumber: buffered.messageNumber,
          messageTime: buffered.messageTime.toISOString(),
          messageType: buffered.messageType as MessageType,
        },
        message,
      };

      // Get current rocket state
      const rocket = await this.rocketRepository.findByChannel(channel);

      if (!rocket) {
        logger.error('Rocket not found for buffered message', {
          channel,
          messageNumber: buffered.messageNumber,
        });
        // Delete the buffered message as we can't process it
        await this.bufferedMessageRepository.delete(buffered.id);
        return;
      }

      // Apply state change
      const updatedRocket = await this.applyStateChange(rocket, incomingMessage);

      // Store message for audit trail
      await this.messageRepository.create({
        channel: buffered.channel,
        messageNumber: buffered.messageNumber,
        messageTime: buffered.messageTime,
        messageType: buffered.messageType,
        payload: buffered.payload,
      });

      logMessageProcessed(
        channel,
        updatedRocket.type,
        buffered.messageType,
        buffered.messageNumber
      );

      // Delete from buffer
      await this.bufferedMessageRepository.delete(buffered.id);

      logger.info('Buffered message processed and removed from buffer', {
        channel,
        messageNumber: buffered.messageNumber,
      });

      // Recursively check for next buffered message
      await this.processBufferedMessages(channel, expectedMessageNumber + 1);
    } catch (error) {
      logError('Failed to process buffered messages', error, {
        channel,
        expectedMessageNumber,
      });
      // Don't throw - don't want to fail the current message processing
    }
  }

  private async applyStateChange(
    rocket: Rocket | null,
    incomingMessage: IncomingMessage
  ): Promise<Rocket> {
    const { metadata, message } = incomingMessage;
    const { messageType } = metadata;

    const ensureRocket = (r: Rocket | null): Rocket => {
      if (!r) {
        throw new Error(`Rocket not found for channel ${metadata.channel}`);
      }
      return r;
    };

    switch (messageType) {
      case MessageType.ROCKET_LAUNCHED:
        if (rocket) {
          logger.warn('Rocket already exists for channel, ignoring launch', {
            channel: metadata.channel,
          });
          return rocket;
        }

        const launchPayload = message as {
          type: string;
          launchSpeed: number;
          mission: string;
        };

        const newRocket = await this.rocketRepository.create({
          channel: metadata.channel,
          type: launchPayload.type,
          currentSpeed: launchPayload.launchSpeed,
          mission: launchPayload.mission,
          status: RocketStatus.ACTIVE,
          explosionReason: null,
          lastMessageNumber: metadata.messageNumber,
          lastMessageTime: new Date(metadata.messageTime),
        });

        logRocketStateChange(
          metadata.channel,
          launchPayload.type,
          'CREATED',
          RocketStatus.ACTIVE,
          launchPayload.launchSpeed
        );

        return newRocket;

      case MessageType.ROCKET_SPEED_INCREASED: {
        const existingRocket = ensureRocket(rocket);
        
        if (existingRocket.status === RocketStatus.EXPLODED) {
          logger.warn('Ignoring speed increase for exploded rocket', {
            channel: existingRocket.channel,
            rocketType: existingRocket.type,
            messageNumber: metadata.messageNumber,
          });
          return existingRocket;
        }

        const increasePayload = message as { by: number };
        const newSpeed = existingRocket.currentSpeed + increasePayload.by;

        const updated = await this.rocketRepository.update(metadata.channel, {
          currentSpeed: newSpeed,
          lastMessageNumber: metadata.messageNumber,
          lastMessageTime: new Date(metadata.messageTime),
        });

        logRocketStateChange(
          metadata.channel,
          existingRocket.type,
          'SPEED_INCREASED',
          existingRocket.status,
          newSpeed
        );

        return updated;
      }

      case MessageType.ROCKET_SPEED_DECREASED: {
        const existingRocket = ensureRocket(rocket);
        
        if (existingRocket.status === RocketStatus.EXPLODED) {
          logger.warn('Ignoring speed decrease for exploded rocket', {
            channel: existingRocket.channel,
            rocketType: existingRocket.type,
            messageNumber: metadata.messageNumber,
          });
          return existingRocket;
        }

        const decreasePayload = message as { by: number };
        const newSpeed = Math.max(
          0,
          existingRocket.currentSpeed - decreasePayload.by
        );

        if (
          newSpeed === 0 &&
          existingRocket.currentSpeed - decreasePayload.by < 0
        ) {
          logger.warn('Speed decrease would result in negative speed, clamping to 0', {
            channel: existingRocket.channel,
            rocketType: existingRocket.type,
            currentSpeed: existingRocket.currentSpeed,
            decreaseBy: decreasePayload.by,
            messageNumber: metadata.messageNumber,
          });
        }

        const updated = await this.rocketRepository.update(metadata.channel, {
          currentSpeed: newSpeed,
          lastMessageNumber: metadata.messageNumber,
          lastMessageTime: new Date(metadata.messageTime),
        });

        logRocketStateChange(
          metadata.channel,
          existingRocket.type,
          'SPEED_DECREASED',
          existingRocket.status,
          newSpeed
        );

        return updated;
      }

      case MessageType.ROCKET_EXPLODED: {
        const existingRocket = ensureRocket(rocket);

        const explodedPayload = message as { reason: string };

        const updated = await this.rocketRepository.update(metadata.channel, {
          status: RocketStatus.EXPLODED,
          explosionReason: explodedPayload.reason,
          currentSpeed: 0,
          lastMessageNumber: metadata.messageNumber,
          lastMessageTime: new Date(metadata.messageTime),
        });

        logRocketStateChange(
          metadata.channel,
          existingRocket.type,
          'EXPLODED',
          RocketStatus.EXPLODED,
          0,
          explodedPayload.reason
        );

        return updated;
      }

      case MessageType.ROCKET_MISSION_CHANGED: {
        const existingRocket = ensureRocket(rocket);
        
        if (existingRocket.status === RocketStatus.EXPLODED) {
          logger.warn('Ignoring mission change for exploded rocket', {
            channel: existingRocket.channel,
            rocketType: existingRocket.type,
            messageNumber: metadata.messageNumber,
          });
          return existingRocket;
        }

        const missionPayload = message as { newMission: string };

        const updated = await this.rocketRepository.update(metadata.channel, {
          mission: missionPayload.newMission,
          lastMessageNumber: metadata.messageNumber,
          lastMessageTime: new Date(metadata.messageTime),
        });

        logRocketStateChange(
          metadata.channel,
          existingRocket.type,
          'MISSION_CHANGED',
          existingRocket.status,
          existingRocket.currentSpeed,
          undefined,
          missionPayload.newMission
        );

        return updated;
      }

      default:
        throw new Error(`Unknown message type: ${messageType}`);
    }
  }
}