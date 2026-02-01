import express, { Application } from 'express';
import cors from 'cors';
import messagesRouter from './routes/messages.route';
import {
    errorHandler,
    notFoundHandler,
} from './middleware/error-handler';
import { logger } from '@rocket-app/shared/logger/logger';

export function createServer(): Application {
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Request logging
    app.use((req, _res, next) => {
        logger.debug('Incoming request', {
            method: req.method,
            path: req.path,
            ip: req.ip,
        });
        next();
    });

    // Routes
    app.use('/', messagesRouter);

    // Error handlers
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
