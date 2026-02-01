import { MessageProcessorService } from '../src/services/message-processor.service';
import { IRocketRepository } from '@rocket-app/shared/repositories/interfaces/IRocketRepository';
import { IMessageRepository } from '@rocket-app/shared/repositories/interfaces/IMessageRepository';
import { IncomingMessage, MessageType, RocketStatus } from '@rocket-app/shared/types/messages.types';
import { IBufferedMessageRepository } from '@rocket-app/shared';


jest.mock('@rocket-app/shared', () => {
  const actual = jest.requireActual('@rocket-app/shared');
  return {
    ...actual,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    },
    logMessageReceived: jest.fn(),
    logMessageProcessed: jest.fn(),
    logMessageDuplicate: jest.fn(),
    logMessageOutOfOrder: jest.fn(),
    logRocketStateChange: jest.fn(),
    logError: jest.fn(),
  };
});

describe('MessageProcessorService', () => {
  let service: MessageProcessorService;
  let rocketRepo: jest.Mocked<IRocketRepository>;
  let messageRepo: jest.Mocked<IMessageRepository>;
  let bufferedMessageRepo: jest.Mocked<IBufferedMessageRepository>;

  const channel = '193270a9-c9cf-404a-8f83-838e71d9ae67';

  const makeRocket = (overrides: Partial<any> = {}) => ({
    id: 'rocket-id',
    channel,
    type: 'Falcon-9',
    currentSpeed: 500,
    mission: 'ARTEMIS',
    status: RocketStatus.ACTIVE,
    explosionReason: null,
    lastMessageNumber: 1,
    lastMessageTime: new Date('2022-02-02T19:39:05.863Z'),
    createdAt: new Date('2022-02-02T19:39:05.863Z'),
    updatedAt: new Date('2022-02-02T19:39:05.863Z'),
    ...overrides,
  });

  beforeEach(() => {
    rocketRepo = {
      create: jest.fn(),
      findByChannel: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getAverageSpeed: jest.fn(),
    };

    messageRepo = {
      create: jest.fn(),
      findUnique: jest.fn(),
      findByChannel: jest.fn(),
    };

    bufferedMessageRepo = {
      create: jest.fn(),
      findUnique: jest.fn(),
      findByChannel: jest.fn(),
      delete: jest.fn(),
      deleteByChannel: jest.fn(),
    };

    service = new MessageProcessorService(rocketRepo, messageRepo, bufferedMessageRepo);
    jest.clearAllMocks();
  });

  it('should create rocket on launch', async () => {
    const msg: IncomingMessage = {
      metadata: {
        channel,
        messageNumber: 1,
        messageTime: '2022-02-02T19:39:05.863Z',
        messageType: MessageType.ROCKET_LAUNCHED,
      },
      message: {
        type: 'Falcon-9',
        launchSpeed: 500,
        mission: 'ARTEMIS',
      },
    };

    messageRepo.findUnique.mockResolvedValue(null);
    rocketRepo.findByChannel.mockResolvedValue(null);
    rocketRepo.create.mockResolvedValue(makeRocket({ currentSpeed: 500 }));
    messageRepo.create.mockResolvedValue({} as any);

    await service.processMessage(msg);

    expect(rocketRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel,
        type: 'Falcon-9',
        currentSpeed: 500,
        mission: 'ARTEMIS',
        status: RocketStatus.ACTIVE,
        explosionReason: null,
        lastMessageNumber: 1,
        lastMessageTime: new Date(msg.metadata.messageTime),
      })
    );
    expect(messageRepo.create).toHaveBeenCalled();
  });

  describe('processMessage - Duplicate Messages', () => {
    it('should ignore duplicate messages', async () => {
      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 1,
          messageTime: '2022-02-02T19:39:05.863Z',
          messageType: MessageType.ROCKET_LAUNCHED,
        },
        message: {
          type: 'Falcon-9',
          launchSpeed: 500,
          mission: 'ARTEMIS',
        },
      };

      messageRepo.findUnique.mockResolvedValue({ id: 'existing-message-id' } as any);

      await service.processMessage(msg);

      expect(rocketRepo.create).not.toHaveBeenCalled();
      expect(rocketRepo.update).not.toHaveBeenCalled();
      expect(messageRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('processMessage - Out of Order Messages', () => {
    it('should not apply state changes for out-of-order messages but should store audit record', async () => {
      const existingRocket = makeRocket({ currentSpeed: 3000, lastMessageNumber: 5 });

      const oldMsg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 3,
          messageTime: '2022-02-02T19:39:05.863Z',
          messageType: MessageType.ROCKET_SPEED_INCREASED,
        },
        message: { by: 1000 },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(existingRocket);
      messageRepo.create.mockResolvedValue({} as any);

      await service.processMessage(oldMsg);

      expect(rocketRepo.update).not.toHaveBeenCalled();
      expect(rocketRepo.create).not.toHaveBeenCalled();
      expect(messageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channel,
          messageNumber: 3,
          messageType: MessageType.ROCKET_SPEED_INCREASED,
        })
      );
    });
  });

  describe('processMessage - RocketSpeedIncreased', () => {
    it('should increase rocket speed correctly', async () => {
      const existingRocket = makeRocket({ currentSpeed: 500, lastMessageNumber: 1 });

      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 2,
          messageTime: '2022-02-02T19:40:05.863Z',
          messageType: MessageType.ROCKET_SPEED_INCREASED,
        },
        message: { by: 3000 },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(existingRocket);
      rocketRepo.update.mockResolvedValue(
        makeRocket({ currentSpeed: 3500, lastMessageNumber: 2 })
      );
      messageRepo.create.mockResolvedValue({} as any);

      await service.processMessage(msg);

      expect(rocketRepo.update).toHaveBeenCalledWith(channel, {
        currentSpeed: 3500,
        lastMessageNumber: 2,
        lastMessageTime: new Date(msg.metadata.messageTime),
      });
    });

    it('should not update speed for exploded rockets', async () => {
      const explodedRocket = makeRocket({
        status: RocketStatus.EXPLODED,
        currentSpeed: 0,
        explosionReason: 'PRESSURE_VESSEL_FAILURE',
        lastMessageNumber: 5,
      });

      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 6,
          messageTime: '2022-02-02T19:40:05.863Z',
          messageType: MessageType.ROCKET_SPEED_INCREASED,
        },
        message: { by: 1000 },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(explodedRocket);
      messageRepo.create.mockResolvedValue({} as any);

      await service.processMessage(msg);

      expect(rocketRepo.update).not.toHaveBeenCalled();
      expect(messageRepo.create).toHaveBeenCalled();
    });
  });

  describe('processMessage - RocketSpeedDecreased', () => {
    it('should decrease rocket speed correctly', async () => {
      const existingRocket = makeRocket({ currentSpeed: 5000, lastMessageNumber: 2 });

      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 3,
          messageTime: '2022-02-02T19:41:05.863Z',
          messageType: MessageType.ROCKET_SPEED_DECREASED,
        },
        message: { by: 2500 },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(existingRocket);
      rocketRepo.update.mockResolvedValue(
        makeRocket({ currentSpeed: 2500, lastMessageNumber: 3 })
      );
      messageRepo.create.mockResolvedValue({} as any);

      await service.processMessage(msg);

      expect(rocketRepo.update).toHaveBeenCalledWith(channel, {
        currentSpeed: 2500,
        lastMessageNumber: 3,
        lastMessageTime: new Date(msg.metadata.messageTime),
      });
    });

    it('should clamp speed to 0 if decrease would result in negative', async () => {
      const existingRocket = makeRocket({ currentSpeed: 1000, lastMessageNumber: 2 });

      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 3,
          messageTime: '2022-02-02T19:41:05.863Z',
          messageType: MessageType.ROCKET_SPEED_DECREASED,
        },
        message: { by: 2000 },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(existingRocket);
      rocketRepo.update.mockResolvedValue(
        makeRocket({ currentSpeed: 0, lastMessageNumber: 3 })
      );
      messageRepo.create.mockResolvedValue({} as any);

      await service.processMessage(msg);

      expect(rocketRepo.update).toHaveBeenCalledWith(channel, {
        currentSpeed: 0,
        lastMessageNumber: 3,
        lastMessageTime: new Date(msg.metadata.messageTime),
      });
    });
  });

  describe('processMessage - RocketExploded', () => {
    it('should mark rocket as exploded', async () => {
      const existingRocket = makeRocket({ currentSpeed: 3000, lastMessageNumber: 3 });

      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 4,
          messageTime: '2022-02-02T19:42:05.863Z',
          messageType: MessageType.ROCKET_EXPLODED,
        },
        message: { reason: 'PRESSURE_VESSEL_FAILURE' },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(existingRocket);
      rocketRepo.update.mockResolvedValue(
        makeRocket({
          status: RocketStatus.EXPLODED,
          explosionReason: 'PRESSURE_VESSEL_FAILURE',
          currentSpeed: 0,
          lastMessageNumber: 4,
        })
      );
      messageRepo.create.mockResolvedValue({} as any);

      await service.processMessage(msg);

      expect(rocketRepo.update).toHaveBeenCalledWith(channel, {
        status: RocketStatus.EXPLODED,
        explosionReason: 'PRESSURE_VESSEL_FAILURE',
        currentSpeed: 0,
        lastMessageNumber: 4,
        lastMessageTime: new Date(msg.metadata.messageTime),
      });
    });
  });

  describe('processMessage - RocketMissionChanged', () => {
    it('should update rocket mission', async () => {
      const existingRocket = makeRocket({ currentSpeed: 3000, lastMessageNumber: 3 });

      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 4,
          messageTime: '2022-02-02T19:43:05.863Z',
          messageType: MessageType.ROCKET_MISSION_CHANGED,
        },
        message: { newMission: 'SHUTTLE_MIR' },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(existingRocket);
      rocketRepo.update.mockResolvedValue(
        makeRocket({ mission: 'SHUTTLE_MIR', lastMessageNumber: 4 })
      );
      messageRepo.create.mockResolvedValue({} as any);

      await service.processMessage(msg);

      expect(rocketRepo.update).toHaveBeenCalledWith(channel, {
        mission: 'SHUTTLE_MIR',
        lastMessageNumber: 4,
        lastMessageTime: new Date(msg.metadata.messageTime),
      });
    });

    it('should not update mission for exploded rockets', async () => {
      const explodedRocket = makeRocket({
        status: RocketStatus.EXPLODED,
        currentSpeed: 0,
        explosionReason: 'PRESSURE_VESSEL_FAILURE',
        lastMessageNumber: 5,
      });

      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 6,
          messageTime: '2022-02-02T19:44:05.863Z',
          messageType: MessageType.ROCKET_MISSION_CHANGED,
        },
        message: { newMission: 'NEW_MISSION' },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(explodedRocket);
      messageRepo.create.mockResolvedValue({} as any);

      await service.processMessage(msg);

      expect(rocketRepo.update).not.toHaveBeenCalled();
      expect(messageRepo.create).toHaveBeenCalled();
    });
  });

  describe('processMessage - Error Cases', () => {
    it('should throw error when RocketSpeedIncreased for non-existent rocket', async () => {
      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 2,
          messageTime: '2022-02-02T19:40:05.863Z',
          messageType: MessageType.ROCKET_SPEED_INCREASED,
        },
        message: { by: 1000 },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(null);

      await expect(service.processMessage(msg)).rejects.toThrow(
        'Rocket not found for channel'
      );
    });

    it('should throw error when RocketMissionChanged for non-existent rocket', async () => {
      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 2,
          messageTime: '2022-02-02T19:40:05.863Z',
          messageType: MessageType.ROCKET_MISSION_CHANGED,
        },
        message: { newMission: 'SHUTTLE_MIR' },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(null);

      await expect(service.processMessage(msg)).rejects.toThrow(
        'Rocket not found for channel'
      );
    });
  });

  describe('processMessage - Database Error Handling', () => {
    it('should propagate errors when checking for duplicates', async () => {
      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 1,
          messageTime: '2022-02-02T19:39:05.863Z',
          messageType: MessageType.ROCKET_LAUNCHED,
        },
        message: {
          type: 'Falcon-9',
          launchSpeed: 500,
          mission: 'ARTEMIS',
        },
      };

      messageRepo.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.processMessage(msg)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should propagate errors when creating rockets', async () => {
      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 1,
          messageTime: '2022-02-02T19:39:05.863Z',
          messageType: MessageType.ROCKET_LAUNCHED,
        },
        message: {
          type: 'Falcon-9',
          launchSpeed: 500,
          mission: 'ARTEMIS',
        },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(null);
      rocketRepo.create.mockRejectedValue(new Error('Failed to create rocket'));

      await expect(service.processMessage(msg)).rejects.toThrow(
        'Failed to create rocket'
      );
    });

    it('should propagate errors when updating rockets', async () => {
      const existingRocket = makeRocket({ currentSpeed: 500, lastMessageNumber: 1 });
      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 2,
          messageTime: '2022-02-02T19:40:05.863Z',
          messageType: MessageType.ROCKET_SPEED_INCREASED,
        },
        message: { by: 3000 },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(existingRocket);
      rocketRepo.update.mockRejectedValue(new Error('Failed to update rocket'));

      await expect(service.processMessage(msg)).rejects.toThrow(
        'Failed to update rocket'
      );
    });

    it('should propagate errors when storing audit message', async () => {
      const existingRocket = makeRocket({ currentSpeed: 500, lastMessageNumber: 1 });
      const msg: IncomingMessage = {
        metadata: {
          channel,
          messageNumber: 2,
          messageTime: '2022-02-02T19:40:05.863Z',
          messageType: MessageType.ROCKET_SPEED_INCREASED,
        },
        message: { by: 3000 },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(existingRocket);
      rocketRepo.update.mockResolvedValue(
        makeRocket({ currentSpeed: 3500, lastMessageNumber: 2 })
      );
      messageRepo.create.mockRejectedValue(new Error('Storage failed'));

      await expect(service.processMessage(msg)).rejects.toThrow('Storage failed');
    });
  });

  describe('Out-of-Order Buffering', () => {
    it('should buffer message #3 when current is #1', async () => {
      const existingRocket = {
        id: 'rocket-id',
        channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
        type: 'Falcon-9',
        currentSpeed: 500,
        mission: 'ARTEMIS',
        status: RocketStatus.ACTIVE,
        explosionReason: null,
        lastMessageNumber: 1,
        lastMessageTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message3: IncomingMessage = {
        metadata: {
          channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
          messageNumber: 3,
          messageTime: '2022-02-02T19:41:05.863Z',
          messageType: MessageType.ROCKET_SPEED_INCREASED,
        },
        message: {
          by: 1000,
        },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      bufferedMessageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(existingRocket);
      bufferedMessageRepo.create.mockResolvedValue({
        id: 'buffered-id',
        channel: message3.metadata.channel,
        messageNumber: 3,
        messageTime: new Date(message3.metadata.messageTime),
        messageType: message3.metadata.messageType,
        payload: JSON.stringify(message3.message),
        bufferedAt: new Date(),
      });

      await service.processMessage(message3);

      expect(bufferedMessageRepo.create).toHaveBeenCalledWith({
        channel: message3.metadata.channel,
        messageNumber: 3,
        messageTime: new Date(message3.metadata.messageTime),
        messageType: message3.metadata.messageType,
        payload: JSON.stringify(message3.message),
      });

      // Should NOT process the message
      expect(rocketRepo.update).not.toHaveBeenCalled();
      expect(messageRepo.create).not.toHaveBeenCalled();
    });

    it('should process message #2 and then process buffered message #3', async () => {
      const existingRocket = {
        id: 'rocket-id',
        channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
        type: 'Falcon-9',
        currentSpeed: 500,
        mission: 'ARTEMIS',
        status: RocketStatus.ACTIVE,
        explosionReason: null,
        lastMessageNumber: 1,
        lastMessageTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message2: IncomingMessage = {
        metadata: {
          channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
          messageNumber: 2,
          messageTime: '2022-02-02T19:40:05.863Z',
          messageType: MessageType.ROCKET_SPEED_INCREASED,
        },
        message: {
          by: 500,
        },
      };

      const bufferedMessage3 = {
        id: 'buffered-id',
        channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
        messageNumber: 3,
        messageTime: new Date('2022-02-02T19:41:05.863Z'),
        messageType: MessageType.ROCKET_SPEED_INCREASED,
        payload: JSON.stringify({ by: 1000 }),
        bufferedAt: new Date(),
      };

      const updatedRocketAfter2 = {
        ...existingRocket,
        currentSpeed: 1000,
        lastMessageNumber: 2,
      };

      const updatedRocketAfter3 = {
        ...updatedRocketAfter2,
        currentSpeed: 2000,
        lastMessageNumber: 3,
      };

      // Setup mocks
      messageRepo.findUnique.mockResolvedValue(null);
      bufferedMessageRepo.findUnique
        .mockResolvedValueOnce(null) // Initial check for message 2
        .mockResolvedValueOnce(bufferedMessage3) // Check for buffered message 3
        .mockResolvedValueOnce(null); // No message 4 buffered

      rocketRepo.findByChannel
        .mockResolvedValueOnce(existingRocket) // When processing message 2
        .mockResolvedValueOnce(updatedRocketAfter2); // When processing buffered message 3

      rocketRepo.update
        .mockResolvedValueOnce(updatedRocketAfter2) // Update for message 2
        .mockResolvedValueOnce(updatedRocketAfter3); // Update for message 3

      messageRepo.create.mockResolvedValue({} as any);
      bufferedMessageRepo.delete.mockResolvedValue(undefined);

      // Process message 2
      await service.processMessage(message2);

      // Verify message 2 was processed
      expect(rocketRepo.update).toHaveBeenCalledWith(
        message2.metadata.channel,
        expect.objectContaining({
          currentSpeed: 1000,
          lastMessageNumber: 2,
        })
      );

      // Verify buffered message 3 was looked up
      expect(bufferedMessageRepo.findUnique).toHaveBeenCalledWith(
        message2.metadata.channel,
        3
      );

      // Verify message 3 was processed
      expect(rocketRepo.update).toHaveBeenCalledWith(
        message2.metadata.channel,
        expect.objectContaining({
          currentSpeed: 2000,
          lastMessageNumber: 3,
        })
      );

      // Verify buffered message was deleted
      expect(bufferedMessageRepo.delete).toHaveBeenCalledWith('buffered-id');

      // Verify both messages were stored in Message table
      expect(messageRepo.create).toHaveBeenCalledTimes(2);
    });

    it('should handle message sequence 1, 3, 4, 2', async () => {
      const existingRocket = {
        id: 'rocket-id',
        channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
        type: 'Falcon-9',
        currentSpeed: 500,
        mission: 'ARTEMIS',
        status: RocketStatus.ACTIVE,
        explosionReason: null,
        lastMessageNumber: 1,
        lastMessageTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Message 3 arrives - should be buffered
      const message3: IncomingMessage = {
        metadata: {
          channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
          messageNumber: 3,
          messageTime: '2022-02-02T19:41:05.863Z',
          messageType: MessageType.ROCKET_SPEED_INCREASED,
        },
        message: { by: 1000 },
      };

      messageRepo.findUnique.mockResolvedValue(null);
      bufferedMessageRepo.findUnique.mockResolvedValue(null);
      rocketRepo.findByChannel.mockResolvedValue(existingRocket);
      bufferedMessageRepo.create.mockResolvedValue({} as any);

      await service.processMessage(message3);

      expect(bufferedMessageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ messageNumber: 3 })
      );

      // Message 4 arrives - should also be buffered
      const message4: IncomingMessage = {
        metadata: {
          channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
          messageNumber: 4,
          messageTime: '2022-02-02T19:42:05.863Z',
          messageType: MessageType.ROCKET_SPEED_INCREASED,
        },
        message: { by: 500 },
      };

      bufferedMessageRepo.create.mockResolvedValue({} as any);

      await service.processMessage(message4);

      expect(bufferedMessageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ messageNumber: 4 })
      );

      // Now message 2 arrives - should process 2, then 3, then 4
      const message2: IncomingMessage = {
        metadata: {
          channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
          messageNumber: 2,
          messageTime: '2022-02-02T19:40:05.863Z',
          messageType: MessageType.ROCKET_SPEED_INCREASED,
        },
        message: { by: 200 },
      };

      const buffered3 = {
        id: 'buffered-3',
        channel: message3.metadata.channel,
        messageNumber: 3,
        messageTime: new Date(message3.metadata.messageTime),
        messageType: message3.metadata.messageType,
        payload: JSON.stringify(message3.message),
        bufferedAt: new Date(),
      };

      const buffered4 = {
        id: 'buffered-4',
        channel: message4.metadata.channel,
        messageNumber: 4,
        messageTime: new Date(message4.metadata.messageTime),
        messageType: message4.metadata.messageType,
        payload: JSON.stringify(message4.message),
        bufferedAt: new Date(),
      };

      const rocketAfter2 = { ...existingRocket, currentSpeed: 700, lastMessageNumber: 2 };
      const rocketAfter3 = { ...rocketAfter2, currentSpeed: 1700, lastMessageNumber: 3 };
      const rocketAfter4 = { ...rocketAfter3, currentSpeed: 2200, lastMessageNumber: 4 };

      bufferedMessageRepo.findUnique
        .mockResolvedValueOnce(null) // Check for duplicate in buffer
        .mockResolvedValueOnce(buffered3) // After processing 2, find 3
        .mockResolvedValueOnce(buffered4) // After processing 3, find 4
        .mockResolvedValueOnce(null); // After processing 4, no 5

      rocketRepo.findByChannel
        .mockResolvedValueOnce(existingRocket) // Processing message 2
        .mockResolvedValueOnce(rocketAfter2) // Processing buffered 3
        .mockResolvedValueOnce(rocketAfter3); // Processing buffered 4

      rocketRepo.update
        .mockResolvedValueOnce(rocketAfter2)
        .mockResolvedValueOnce(rocketAfter3)
        .mockResolvedValueOnce(rocketAfter4);

      messageRepo.create.mockResolvedValue({} as any);
      bufferedMessageRepo.delete.mockResolvedValue(undefined);

      await service.processMessage(message2);

      // All three updates should have happened
      expect(rocketRepo.update).toHaveBeenCalledTimes(3);
      expect(bufferedMessageRepo.delete).toHaveBeenCalledTimes(2);
      expect(messageRepo.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('Duplicate Detection in Buffer', () => {
    it('should not buffer a message that is already buffered', async () => {
      const existingRocket = {
        id: 'rocket-id',
        channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
        type: 'Falcon-9',
        currentSpeed: 500,
        mission: 'ARTEMIS',
        status: RocketStatus.ACTIVE,
        explosionReason: null,
        lastMessageNumber: 1,
        lastMessageTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message3: IncomingMessage = {
        metadata: {
          channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
          messageNumber: 3,
          messageTime: '2022-02-02T19:41:05.863Z',
          messageType: MessageType.ROCKET_SPEED_INCREASED,
        },
        message: { by: 1000 },
      };

      const alreadyBuffered = {
        id: 'buffered-id',
        channel: message3.metadata.channel,
        messageNumber: 3,
        messageTime: new Date(message3.metadata.messageTime),
        messageType: message3.metadata.messageType,
        payload: JSON.stringify(message3.message),
        bufferedAt: new Date(),
      };

      messageRepo.findUnique.mockResolvedValue(null);
      bufferedMessageRepo.findUnique.mockResolvedValue(alreadyBuffered);
      rocketRepo.findByChannel.mockResolvedValue(existingRocket);

      await service.processMessage(message3);

      // Should not create another buffered message
      expect(bufferedMessageRepo.create).not.toHaveBeenCalled();
      expect(rocketRepo.update).not.toHaveBeenCalled();
    });
  });
});

