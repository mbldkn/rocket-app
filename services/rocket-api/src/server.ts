import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rocketsRouter from './routes/rockets.route';
import { logger } from '@rocket-app/shared/logger/logger';

export function createServer(): Application {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug('Incoming request', {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
    });
    next();
  });

  // Routes
  app.use('/', rocketsRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    logger.warn('Route not found', {
      path: req.path,
      method: req.method,
    });

    res.status(404).json({
      success: false,
      error: `Route ${req.method} ${req.path} not found`,
    });
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && {
        details: err.message,
        stack: err.stack,
      }),
    });
  });

  return app;
}
