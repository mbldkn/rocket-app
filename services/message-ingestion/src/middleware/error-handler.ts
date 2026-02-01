import { logError, logger } from '@rocket-app/shared/logger/logger';
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const errorHandler = (
    error: Error | AppError,
    req: Request,
    res: Response): void => {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const message = error.message || 'Internal server error';

    const context: any = {
        path: req.path,
        method: req.method,
    };

    if (req.body?.metadata) {
        context.channel = req.body.metadata.channel;
        context.messageType = req.body.metadata.messageType;
        context.messageNumber = req.body.metadata.messageNumber;
    }

    logError(message, error, context);

    // Don't leak error details in production
    const errorResponse = {
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack,
            details: error,
        }),
    };

    res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export const notFoundHandler = (
    req: Request,
    res: Response): void => {
    logger.warn('Route not found', {
        path: req.path,
        method: req.method,
    });

    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.path} not found`,
    });
};
