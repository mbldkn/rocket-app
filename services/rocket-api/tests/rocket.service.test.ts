import { RocketStatus } from '@rocket-app/shared/types/messages.types';
import { RocketService } from '../src/services/rocket.service';
import type { IRocketRepository } from '@rocket-app/shared/repositories/interfaces/IRocketRepository';

// Silence logger + logError side effects in tests
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
    logError: jest.fn(),
  };
});

function makeRocket(overrides: Partial<any> = {}) {
  return {
    id: 'r1',
    channel: 'ch-1',
    type: 'Falcon-9',
    currentSpeed: 5000,
    mission: 'ARTEMIS',
    status: RocketStatus.ACTIVE,
    explosionReason: null,
    lastMessageNumber: 10,
    lastMessageTime: new Date('2026-01-01T10:00:00.000Z'),
    createdAt: new Date('2026-01-01T09:00:00.000Z'),
    updatedAt: new Date('2026-01-01T11:00:00.000Z'),
    ...overrides,
  };
}

describe('RocketService', () => {
  let repo: jest.Mocked<IRocketRepository>;
  let service: RocketService;

  beforeEach(() => {
    repo = {
      findByChannel: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      getAverageSpeed: jest.fn(),
      // if your interface has more methods, add them here as jest.fn()
    } as any;

    service = new RocketService(repo);
  });

  describe('getRocketByChannel', () => {
    it('returns null when rocket not found', async () => {
      repo.findByChannel.mockResolvedValue(null as any);

      const result = await service.getRocketByChannel('missing-channel');

      expect(repo.findByChannel).toHaveBeenCalledWith('missing-channel');
      expect(result).toBeNull();
    });

    it('maps repository rocket to RocketState when found', async () => {
      const rocket = makeRocket({ channel: 'ch-99', currentSpeed: 1234 });
      repo.findByChannel.mockResolvedValue(rocket as any);

      const result = await service.getRocketByChannel('ch-99');

      expect(repo.findByChannel).toHaveBeenCalledWith('ch-99');
      expect(result).toEqual(
        expect.objectContaining({
          id: rocket.id,
          channel: 'ch-99',
          type: rocket.type,
          currentSpeed: 1234,
          mission: rocket.mission,
          status: RocketStatus.ACTIVE,
          explosionReason: null,
          lastMessageNumber: rocket.lastMessageNumber,
          lastMessageTime: rocket.lastMessageTime,
          createdAt: rocket.createdAt,
          updatedAt: rocket.updatedAt,
        })
      );
    });

    it('rethrows errors from repository', async () => {
      repo.findByChannel.mockRejectedValue(new Error('repo failed'));

      await expect(service.getRocketByChannel('ch-1')).rejects.toThrow('repo failed');
    });
  });

  describe('getAllRockets', () => {
    it('uses defaults and returns mapped rockets', async () => {
      const rockets = [makeRocket({ id: 'a' }), makeRocket({ id: 'b' })];
      repo.findMany.mockResolvedValue(rockets as any);
      repo.count.mockResolvedValue(2);

      const result = await service.getAllRockets({} as any);

      // defaults: sortBy=createdAt, order=desc, page=1, pageSize=50
      expect(repo.findMany).toHaveBeenCalledWith({
        where: undefined,
        sortBy: 'createdAt',
        order: 'desc',
        skip: 0,
        take: 50,
      });
      expect(repo.count).toHaveBeenCalledWith(undefined);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
      expect(result.total).toBe(2);
      expect(result.rockets).toHaveLength(2);
      expect(result.rockets[0]).toEqual(expect.objectContaining({ id: 'a' }));
    });

    it('applies status filter and calculates skip correctly', async () => {
      repo.findMany.mockResolvedValue([] as any);
      repo.count.mockResolvedValue(0);

      await service.getAllRockets({
        page: 3,
        pageSize: 10,
        status: RocketStatus.ACTIVE,
        sortBy: 'createdAt',
        order: 'asc',
      } as any);

      // skip = (page-1)*pageSize = (3-1)*10 = 20
      expect(repo.findMany).toHaveBeenCalledWith({
        where: { status: RocketStatus.ACTIVE },
        sortBy: 'createdAt',
        order: 'asc',
        skip: 20,
        take: 10,
      });
      expect(repo.count).toHaveBeenCalledWith({ status: RocketStatus.ACTIVE });
    });

    it('maps sortBy="speed" to sortBy="currentSpeed"', async () => {
      repo.findMany.mockResolvedValue([] as any);
      repo.count.mockResolvedValue(0);

      await service.getAllRockets({
        sortBy: 'speed',
        order: 'desc',
        page: 1,
        pageSize: 5,
      } as any);

      expect(repo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'currentSpeed',
          take: 5,
        })
      );
    });

    it('rethrows errors from repository calls', async () => {
      repo.findMany.mockRejectedValue(new Error('findMany failed'));
      repo.count.mockResolvedValue(0);

      await expect(service.getAllRockets({} as any)).rejects.toThrow('findMany failed');
    });
  });

  describe('getRocketStatistics', () => {
    it('returns statistics and rounds averageSpeed', async () => {
      repo.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80)  // active
        .mockResolvedValueOnce(20); // exploded
      repo.getAverageSpeed.mockResolvedValue(1234.56);

      const stats = await service.getRocketStatistics();

      expect(repo.count).toHaveBeenNthCalledWith(1);
      expect(repo.count).toHaveBeenNthCalledWith(2, { status: RocketStatus.ACTIVE });
      expect(repo.count).toHaveBeenNthCalledWith(3, { status: RocketStatus.EXPLODED });
      expect(repo.getAverageSpeed).toHaveBeenCalledWith({ status: RocketStatus.ACTIVE });

      expect(stats).toEqual({
        total: 100,
        active: 80,
        exploded: 20,
        averageSpeed: 1235, // rounded
      });
    });

    it('rethrows errors', async () => {
      repo.count.mockRejectedValue(new Error('count failed'));

      await expect(service.getRocketStatistics()).rejects.toThrow('count failed');
    });
  });
});
