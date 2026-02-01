import request from 'supertest';
import { Application } from 'express';

// Avoid hitting the database in integration tests by mocking the service layer
jest.mock('../src/services/rocket.service', () => {
  return {
    RocketService: jest.fn().mockImplementation(() => ({
      getAllRockets: jest.fn().mockImplementation(async (query: any = {}) => ({
        rockets: [],
        total: 0,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 50,
      })),
      getRocketByChannel: jest.fn().mockResolvedValue(null),
      getRocketStatistics: jest.fn().mockResolvedValue({
        total: 0,
        active: 0,
        exploded: 0,
        averageSpeed: 0,
      }),
    })),
  };
});

// Use require to ensure the mock is applied before the module is loaded
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createServer } = require('../src/server');

describe('Rocket API - Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createServer();
  });

  describe('GET /api/rockets', () => {
    it('should return list of rockets', async () => {
      const response = await request(app)
        .get('/api/rockets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should accept sorting parameters', async () => {
      const response = await request(app)
        .get('/api/rockets?sortBy=speed&order=desc')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept sorting by mission', async () => {
      const response = await request(app)
        .get('/api/rockets?sortBy=mission&order=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept sorting by status', async () => {
      const response = await request(app)
        .get('/api/rockets?sortBy=status&order=desc')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept sorting by type', async () => {
      const response = await request(app)
        .get('/api/rockets?sortBy=type&order=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept pagination parameters', async () => {
      const response = await request(app)
        .get('/api/rockets?page=1&pageSize=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.pageSize).toBe(10);
    });

    it('should accept status filter for ACTIVE', async () => {
      const response = await request(app)
        .get('/api/rockets?status=ACTIVE')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept status filter for EXPLODED', async () => {
      const response = await request(app)
        .get('/api/rockets?status=EXPLODED')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should combine multiple query parameters', async () => {
      const response = await request(app)
        .get('/api/rockets?sortBy=speed&order=desc&page=1&pageSize=5&status=ACTIVE')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.pageSize).toBe(5);
    });

    it('should handle invalid sort field gracefully', async () => {
      const response = await request(app)
        .get('/api/rockets?sortBy=invalidField&order=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should fall back to default sorting
    });

    it('should handle page=0 gracefully', async () => {
      const response = await request(app)
        .get('/api/rockets?page=0')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle negative pageSize gracefully', async () => {
      const response = await request(app)
        .get('/api/rockets?pageSize=-5')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/rockets/:channel', () => {
    it('should return 404 for non-existent rocket', async () => {
      const response = await request(app)
        .get('/api/rockets/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Rocket not found');
    });

    it('should return 404 for invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/rockets/not-a-valid-uuid')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle very long channel IDs', async () => {
      const longId = 'a'.repeat(200);
      const response = await request(app)
        .get(`/api/rockets/${longId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/rockets/stats', () => {
    it('should return statistics', async () => {
      const response = await request(app)
        .get('/api/rockets/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('active');
      expect(response.body.data).toHaveProperty('exploded');
      expect(response.body.data).toHaveProperty('averageSpeed');
      expect(typeof response.body.data.total).toBe('number');
      expect(typeof response.body.data.active).toBe('number');
      expect(typeof response.body.data.exploded).toBe('number');
      expect(typeof response.body.data.averageSpeed).toBe('number');
    });
  });

  describe('404 Not Found', () => {
    it('should return 404 for unknown routes', async () => {
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

    it('should return 404 for unknown PUT routes', async () => {
      const response = await request(app)
        .put('/api/rockets/123')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for unknown DELETE routes', async () => {
      const response = await request(app)
        .delete('/api/rockets/123')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed query parameters', async () => {
      const response = await request(app)
        .get('/api/rockets?page=notanumber')
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should handle gracefully with default values
    });

    it('should handle empty query strings', async () => {
      const response = await request(app)
        .get('/api/rockets?')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
