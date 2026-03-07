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
import { evidenceRoutes } from './evidence.routes';

export const apiRouter = Router();

// Public routes (no authentication required)
apiRouter.use('/auth', authRoutes);
apiRouter.use('/intake', intakeRoutes);
apiRouter.use('/businesses', businessRoutes); // ABR business lookup (public)

// Protected routes (authentication required)
apiRouter.use('/complaints', complaintRoutes);
apiRouter.use('/triage', triageRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/systemic', systemicRoutes);
apiRouter.use('/communications', communicationRoutes);
apiRouter.use('/evidence', evidenceRoutes);
