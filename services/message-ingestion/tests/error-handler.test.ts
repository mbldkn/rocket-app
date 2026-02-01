import { Request, Response, NextFunction } from 'express';
import {
    errorHandler,
    AppError,
    asyncHandler,
    notFoundHandler,
} from '../src/middleware/error-handler';

// Mock logger
jest.mock('@rocket-app/shared', () => {
    const actual = jest.requireActual('@rocket-app/shared');
    return {
        ...actual,
        logger: {
            warn: jest.fn(),
            error: jest.fn(),
        },
        logError: jest.fn(),
    };
});

describe('Error Handler Middleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockRequest = {
            path: '/test',
            method: 'POST',
            body: {},
        } as Partial<Request>;

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        mockNext = jest.fn();
    });

    describe('AppError', () => {
        it('should create AppError with custom message and status code', () => {
            const error = new AppError('Custom error', 400);

            expect(error.message).toBe('Custom error');
            expect(error.statusCode).toBe(400);
            expect(error.isOperational).toBe(true);
        });

        it('should create AppError with default status code 500', () => {
            const error = new AppError('Server error');

            expect(error.message).toBe('Server error');
            expect(error.statusCode).toBe(500);
            expect(error.isOperational).toBe(true);
        });

        it('should have proper stack trace', () => {
            const error = new AppError('Test error', 404);

            expect(error.stack).toBeDefined();
            expect(error instanceof Error).toBe(true);
        });
    });

    describe('errorHandler', () => {
        it('should handle AppError with custom status code', () => {
            const error = new AppError('Not found', 404);

            errorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Not found',
            });
        });

        it('should handle generic Error with 500 status', () => {
            const error = new Error('Generic error');

            errorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Generic error',
            });
        });

        it('should include stack trace in development mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const error = new Error('Dev error');
            error.stack = 'Error stack trace';

            errorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: 'Dev error',
                    stack: 'Error stack trace',
                })
            );

            process.env.NODE_ENV = originalEnv;
        });

        it('should not include stack trace in production mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const error = new Error('Prod error');

            errorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Prod error',
            });

            process.env.NODE_ENV = originalEnv;
        });

        it('should extract context from request body metadata', () => {
            mockRequest.body = {
                metadata: {
                    channel: '193270a9-c9cf-404a-8f83-838e71d9ae67',
                    messageType: 'RocketLaunched',
                    messageNumber: 1,
                },
            };

            const error = new AppError('Processing failed', 500);

            errorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalled();
        });

        it('should handle error without message', () => {
            const error = new Error();

            errorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Internal server error',
            });
        });

        it('should handle different HTTP methods', () => {
            mockRequest = {
                ...mockRequest,
                method: 'GET',
            } as Partial<Request>;

            const error = new AppError('Method error', 405);

            errorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(405);
        });

        it('should handle different paths', () => {
            mockRequest = {
                ...mockRequest,
                path: '/api/different/path',
            } as Partial<Request>;

            const error = new AppError('Path error', 400);

            errorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });
    });

    describe('asyncHandler', () => {
        it('should call the wrapped async function', async () => {
            const asyncFn = jest.fn().mockResolvedValue('success');
            const wrappedFn = asyncHandler(asyncFn);

            await wrappedFn(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(asyncFn).toHaveBeenCalledWith(
                mockRequest,
                mockResponse,
                mockNext
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should catch and forward errors to next middleware', async () => {
            const error = new Error('Async error');
            const asyncFn = jest.fn().mockRejectedValue(error);
            const wrappedFn = asyncHandler(asyncFn);

            await wrappedFn(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalledWith(error);
        });

        it('should handle AppError correctly', async () => {
            const error = new AppError('Custom async error', 400);
            const asyncFn = jest.fn().mockRejectedValue(error);
            const wrappedFn = asyncHandler(asyncFn);

            await wrappedFn(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalledWith(error);
        });

        it('should handle errors thrown in async function', async () => {
            const error = new Error('Async thrown error');
            const asyncFn = jest.fn().mockImplementation(async () => {
                throw error;
            });
            const wrappedFn = asyncHandler(asyncFn);

            await wrappedFn(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalledWith(error);
        });

        it('should handle Promise rejections', async () => {
            const error = new Error('Promise rejection');
            const asyncFn = jest.fn().mockRejectedValue(error);
            const wrappedFn = asyncHandler(asyncFn);

            await wrappedFn(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalledWith(error);
        });

        it('should allow function to complete successfully', async () => {
            const asyncFn = jest.fn().mockImplementation(async (_req, res) => {
                res.status(200).json({ success: true });
            });
            const wrappedFn = asyncHandler(asyncFn);

            await wrappedFn(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(asyncFn).toHaveBeenCalled();
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('notFoundHandler', () => {
        it('should return 404 with error message', () => {
            const req = {
                path: '/unknown/route',
                method: 'GET',
            } as Partial<Request>;

            notFoundHandler(
                req as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Route GET /unknown/route not found',
            });
        });

        it('should handle POST requests', () => {
            const req = {
                path: '/api/missing',
                method: 'POST',
            } as Partial<Request>;

            notFoundHandler(
                req as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Route POST /api/missing not found',
            });
        });

        it('should handle PUT requests', () => {
            const req = {
                path: '/api/resource',
                method: 'PUT',
            } as Partial<Request>;

            notFoundHandler(
                req as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(404);
        });

        it('should handle DELETE requests', () => {
            const req = {
                path: '/api/resource',
                method: 'DELETE',
            } as Partial<Request>;

            notFoundHandler(
                req as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(404);
        });

        it('should handle root path', () => {
            const req = {
                path: '/',
                method: 'GET',
            } as Partial<Request>;

            notFoundHandler(
                req as Request,
                mockResponse as Response
            );

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: 'Route GET / not found',
            });
        });
    });
});