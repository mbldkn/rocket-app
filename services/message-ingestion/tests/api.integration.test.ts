import request from 'supertest';
import { Application } from 'express';

jest.mock('../src/services/message-processor.service', () => {
  return {
    MessageProcessorService: jest.fn().mockImplementation(() => ({
      processMessage: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

const { createServer } = require('../src/server');

describe('Message Ingestion API - Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createServer();
  });

  describe('POST /messages', () => {
    describe('Valid Messages', () => {
      it('should accept valid RocketLaunched message', async () => {
        const validMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 1,
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(validMessage)
          .expect(202);

        expect(response.body.success).toBe(true);
        expect(response.body.data.channel).toBe(validMessage.metadata.channel);
        expect(response.body.data.messageNumber).toBe(1);
        expect(response.body.data.messageType).toBe('RocketLaunched');
      });

      it('should accept message with zero launch speed', async () => {
        const validMessage = {
          metadata: {
            channel: '693270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 1,
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Test-Rocket',
            launchSpeed: 0,
            mission: 'TEST',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(validMessage)
          .expect(202);

        expect(response.body.success).toBe(true);
      });

      it('should accept message with alternative datetime format', async () => {
        const validMessage = {
          metadata: {
            channel: '793270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 1,
            messageTime: '2022-02-02T19:39:05+01:00', // With timezone
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(validMessage)
          .expect(202);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Invalid Channel', () => {
      it('should reject message with invalid channel UUID', async () => {
        const invalidMessage = {
          metadata: {
            channel: 'not-a-uuid',
            messageNumber: 1,
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Invalid message format');
        expect(response.body.details).toBeDefined();
      });

      it('should reject message with missing channel', async () => {
        const invalidMessage = {
          metadata: {
            messageNumber: 1,
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject message with empty channel', async () => {
        const invalidMessage = {
          metadata: {
            channel: '',
            messageNumber: 1,
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Invalid Message Number', () => {
      it('should reject message with negative message number', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: -1,
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject message with zero message number', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 0,
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject message with missing message number', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject message with string message number', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 'one',
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Invalid Message Time', () => {
      it('should reject message with invalid datetime format', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 1,
            messageTime: 'not-a-date',
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject message with missing message time', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 1,
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Invalid Message Type', () => {
      it('should reject message with invalid message type', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 1,
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'InvalidMessageType',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject message with missing message type', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 1,
            messageTime: '2022-02-02T19:39:05.863Z',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Invalid Message Payloads', () => {
      it('should reject RocketLaunched with negative speed', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 1,
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: -500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject RocketLaunched with missing type', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 1,
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'RocketLaunched',
          },
          message: {
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject RocketLaunched with missing mission', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 1,
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'RocketLaunched',
          },
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject RocketSpeedIncreased with negative value', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 2,
            messageTime: '2022-02-02T19:40:05.863Z',
            messageType: 'RocketSpeedIncreased',
          },
          message: {
            by: -1000,
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject RocketSpeedIncreased with zero value', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 2,
            messageTime: '2022-02-02T19:40:05.863Z',
            messageType: 'RocketSpeedIncreased',
          },
          message: {
            by: 0,
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject RocketSpeedDecreased with missing by field', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 3,
            messageTime: '2022-02-02T19:41:05.863Z',
            messageType: 'RocketSpeedDecreased',
          },
          message: {},
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject RocketExploded with missing reason', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 4,
            messageTime: '2022-02-02T19:42:05.863Z',
            messageType: 'RocketExploded',
          },
          message: {},
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject RocketMissionChanged with empty mission', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 5,
            messageTime: '2022-02-02T19:43:05.863Z',
            messageType: 'RocketMissionChanged',
          },
          message: {
            newMission: '',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Malformed Requests', () => {
      it('should reject empty body', async () => {
        const response = await request(app)
          .post('/messages')
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject request with missing metadata', async () => {
        const invalidMessage = {
          message: {
            type: 'Falcon-9',
            launchSpeed: 500,
            mission: 'ARTEMIS',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject request with missing message', async () => {
        const invalidMessage = {
          metadata: {
            channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            messageNumber: 1,
            messageTime: '2022-02-02T19:39:05.863Z',
            messageType: 'RocketLaunched',
          },
        };

        const response = await request(app)
          .post('/messages')
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('404 Not Found', () => {
    it('should return 404 for unknown GET routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for unknown POST routes', async () => {
      const response = await request(app)
        .post('/api/unknown')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for GET on /messages', async () => {
      const response = await request(app)
        .get('/messages')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for PUT requests', async () => {
      const response = await request(app)
        .put('/messages')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for DELETE requests', async () => {
      const response = await request(app)
        .delete('/messages')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

});
