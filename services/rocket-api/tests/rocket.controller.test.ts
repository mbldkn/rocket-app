import { Request, Response } from 'express';
import { RocketController } from '../src/controllers/rocket.controller';
import { RocketService } from '../src/services/rocket.service';
import { RocketStatus } from '@rocket-app/shared/types/messages.types';

// Mock the service
jest.mock('../src/services/rocket.service');

// Mock logger
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
    };
});

describe('RocketController', () => {
    let controller: RocketController;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockRocketService: jest.Mocked<Pick<RocketService,
        "getRocketByChannel" | "getAllRockets" | "getRocketStatistics"
    >>;

    beforeEach(() => {
        mockRocketService = {
            getRocketByChannel: jest.fn(),
            getAllRockets: jest.fn(),
            getRocketStatistics: jest.fn(),
        };

        controller = new RocketController(mockRocketService as any);

        mockRequest = {
            params: {},
            query: {},
        };

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

    });

    describe('getRocketByChannel', () => {
        it('should return rocket when found', async () => {
            const mockRocket = {
                id: 'rocket-id',
                channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
                type: 'Falcon-9',
                currentSpeed: 5000,
                mission: 'ARTEMIS',
                status: RocketStatus.ACTIVE,
                explosionReason: null,
                lastMessageNumber: 10,
                lastMessageTime: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockRequest.params = { channel: '193270a9-c9cf-404a-8f83-838e71d9ae67' };
            mockRocketService.getRocketByChannel = jest.fn().mockResolvedValue(mockRocket);

            await controller.getRocketByChannel(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: mockRocket,
            });
        });

        it('should return 404 when rocket not found', async () => {
            mockRequest.params = { channel: '193270a9-c9cf-404a-8f83-838e71d9ae67' };
            mockRocketService.getRocketByChannel = jest.fn().mockResolvedValue(null);

            await controller.getRocketByChannel(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Rocket not found',
                channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
            });
        });

        it('should handle service errors', async () => {
            mockRequest.params = { channel: '193270a9-c9cf-404a-8f83-838e71d9ae67' };
            mockRocketService.getRocketByChannel = jest.fn().mockRejectedValue(new Error('Database error'));

            await controller.getRocketByChannel(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to retrieve rocket',
            });
        });

        it('should handle missing channel parameter', async () => {
            mockRequest.params = {};
            mockRocketService.getRocketByChannel = jest.fn().mockResolvedValue(null);

            await controller.getRocketByChannel(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(404);
        });
    });

    describe('getAllRockets', () => {
        const mockRockets = [
            {
                id: 'rocket-1',
                channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
                type: 'Falcon-9',
                currentSpeed: 5000,
                mission: 'ARTEMIS',
                status: RocketStatus.ACTIVE,
                explosionReason: null,
                lastMessageNumber: 10,
                lastMessageTime: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ];

        it('should return all rockets with default parameters', async () => {
            mockRequest.query = {};
            mockRocketService.getAllRockets = jest.fn().mockResolvedValue({
                rockets: mockRockets,
                total: 1,
                page: 1,
                pageSize: 50,
            });

            await controller.getAllRockets(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: mockRockets,
                pagination: {
                    total: 1,
                    page: 1,
                    pageSize: 50,
                    totalPages: 1,
                },
            });
        });

        it('should handle sorting parameters', async () => {
            mockRequest.query = { sortBy: 'speed', order: 'desc' };
            mockRocketService.getAllRockets = jest.fn().mockResolvedValue({
                rockets: mockRockets,
                total: 1,
                page: 1,
                pageSize: 50,
            });

            await controller.getAllRockets(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockRocketService.getAllRockets).toHaveBeenCalledWith(
                expect.objectContaining({
                    sortBy: 'speed',
                    order: 'desc',
                })
            );
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it('should handle pagination parameters', async () => {
            mockRequest.query = { page: '2', pageSize: '10' };
            mockRocketService.getAllRockets = jest.fn().mockResolvedValue({
                rockets: mockRockets,
                total: 100,
                page: 2,
                pageSize: 10,
            });

            await controller.getAllRockets(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockRocketService.getAllRockets).toHaveBeenCalledWith(
                expect.objectContaining({
                    page: 2,
                    pageSize: 10,
                })
            );
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it('should handle status filter', async () => {
            mockRequest.query = { status: 'ACTIVE' };
            mockRocketService.getAllRockets = jest.fn().mockResolvedValue({
                rockets: mockRockets,
                total: 1,
                page: 1,
                pageSize: 50,
            });

            await controller.getAllRockets(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockRocketService.getAllRockets).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'ACTIVE',
                })
            );
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it('should handle page=0 by defaulting to page=1', async () => {
            mockRequest.query = { page: '0' };
            mockRocketService.getAllRockets = jest.fn().mockResolvedValue({
                rockets: mockRockets,
                total: 1,
                page: 1,
                pageSize: 50,
            });

            await controller.getAllRockets(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockRocketService.getAllRockets).toHaveBeenCalledWith(
                expect.objectContaining({
                    page: 1,
                })
            );
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it('should handle negative pageSize by defaulting to 1', async () => {
            mockRequest.query = { pageSize: '-10' };
            mockRocketService.getAllRockets = jest.fn().mockResolvedValue({
                rockets: mockRockets,
                total: 1,
                page: 1,
                pageSize: 1,
            });

            await controller.getAllRockets(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockRocketService.getAllRockets).toHaveBeenCalledWith(
                expect.objectContaining({
                    pageSize: 1,
                })
            );
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it('should handle invalid pageSize string by defaulting to 50', async () => {
            mockRequest.query = { pageSize: 'notanumber' };
            mockRocketService.getAllRockets = jest.fn().mockResolvedValue({
                rockets: mockRockets,
                total: 1,
                page: 1,
                pageSize: 50,
            });

            await controller.getAllRockets(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockRocketService.getAllRockets).toHaveBeenCalledWith(
                expect.objectContaining({
                    pageSize: 50,
                })
            );
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it('should handle pageSize=0 by defaulting to 50', async () => {
            mockRequest.query = { pageSize: '0' };
            mockRocketService.getAllRockets = jest.fn().mockResolvedValue({
                rockets: mockRockets,
                total: 1,
                page: 1,
                pageSize: 50,
            });

            await controller.getAllRockets(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockRocketService.getAllRockets).toHaveBeenCalledWith(
                expect.objectContaining({
                    pageSize: 50,
                })
            );
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it('should cap pageSize at 100', async () => {
            mockRequest.query = { pageSize: '500' };
            mockRocketService.getAllRockets = jest.fn().mockResolvedValue({
                rockets: mockRockets,
                total: 1,
                page: 1,
                pageSize: 100,
            });

            await controller.getAllRockets(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockRocketService.getAllRockets).toHaveBeenCalledWith(
                expect.objectContaining({
                    pageSize: 100,
                })
            );
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it('should handle service errors', async () => {
            mockRequest.query = {};
            mockRocketService.getAllRockets = jest.fn().mockRejectedValue(new Error('Database error'));

            await controller.getAllRockets(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to retrieve rockets',
            });
        });

        it('should calculate totalPages correctly', async () => {
            mockRequest.query = { pageSize: '10' };
            mockRocketService.getAllRockets = jest.fn().mockResolvedValue({
                rockets: mockRockets,
                total: 95,
                page: 1,
                pageSize: 10,
            });

            await controller.getAllRockets(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    pagination: expect.objectContaining({
                        totalPages: 10, // Math.ceil(95 / 10)
                    }),
                })
            );
        });

        it('should handle empty results', async () => {
            mockRequest.query = {};
            mockRocketService.getAllRockets = jest.fn().mockResolvedValue({
                rockets: [],
                total: 0,
                page: 1,
                pageSize: 50,
            });

            await controller.getAllRockets(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: [],
                pagination: {
                    total: 0,
                    page: 1,
                    pageSize: 50,
                    totalPages: 0,
                },
            });
        });
    });

    describe('getStatistics', () => {
        it('should return rocket statistics', async () => {
            const mockStats = {
                total: 100,
                active: 85,
                exploded: 15,
                averageSpeed: 4200,
            };

            mockRocketService.getRocketStatistics = jest.fn().mockResolvedValue(mockStats);

            await controller.getStatistics(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: mockStats,
            });
        });

        it('should handle zero statistics', async () => {
            const mockStats = {
                total: 0,
                active: 0,
                exploded: 0,
                averageSpeed: 0,
            };

            mockRocketService.getRocketStatistics = jest.fn().mockResolvedValue(mockStats);

            await controller.getStatistics(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: mockStats,
            });
        });

        it('should handle service errors', async () => {
            mockRocketService.getRocketStatistics = jest.fn().mockRejectedValue(new Error('Database error'));

            await controller.getStatistics(
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to retrieve statistics',
            });
        });
    });
});
