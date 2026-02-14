// ============================================================================
// API Router – All endpoints
// ============================================================================

import { Router } from 'express';
import { complaintRoutes } from './complaint.routes';
import { triageRoutes } from './triage.routes';
import { dashboardRoutes } from './dashboard.routes';
import { businessRoutes } from './business.routes';
import { intakeRoutes } from './intake.routes';
import { systemicRoutes } from './systemic.routes';
import { communicationRoutes } from './communication.routes';
import { authRoutes } from './auth.routes';

export const apiRouter = Router();

// Public routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/intake', intakeRoutes);

// Protected routes
apiRouter.use('/complaints', complaintRoutes);
apiRouter.use('/triage', triageRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/businesses', businessRoutes);
apiRouter.use('/systemic', systemicRoutes);
apiRouter.use('/communications', communicationRoutes);
