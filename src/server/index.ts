// ============================================================================
// Server Entry Point
// ============================================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { apiRouter } from './api/routes';
import { errorHandler } from './api/middleware/error-handler';
import { requestLogger } from './api/middleware/request-logger';
import { tenantResolver } from './api/middleware/tenant-resolver';
import { createLogger } from './utils/logger';

const logger = createLogger('server');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.CLIENT_URL,
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Tenant resolution
app.use(config.API_PREFIX, tenantResolver);

// API routes
app.use(config.API_PREFIX, apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

app.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT} in ${config.NODE_ENV} mode`);
  logger.info(`API available at http://localhost:${config.PORT}${config.API_PREFIX}`);
});

export { app };
