// ============================================================================
// Auth Routes
// ============================================================================

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../../config';
import { rateLimit } from '../middleware/rate-limiter';

export const authRoutes = Router();

// Rate limit login: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

// Rate limit refresh: 30 per 15 minutes
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: 'Too many token refresh attempts. Please try again later.',
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

// POST /api/v1/auth/login
authRoutes.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);

  // TODO: Replace with actual DB lookup + bcrypt verify
  // For scaffolding, generate a demo token
  const token = jwt.sign(
    {
      userId: 'demo-user-id',
      tenantId: 'demo-tenant-id',
      role: 'complaint_officer',
      email: body.email,
    },
    config.JWT_SECRET,
    { expiresIn: '8h' },
  );

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: 'demo-user-id',
        email: body.email,
        firstName: 'Demo',
        lastName: 'User',
        role: 'complaint_officer',
        tenantId: 'demo-tenant-id',
      },
    },
  });
});

// POST /api/v1/auth/refresh
authRoutes.post('/refresh', refreshLimiter, async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token provided' } });
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), config.JWT_SECRET) as Record<string, unknown>;
    const newToken = jwt.sign(
      { userId: payload.userId, tenantId: payload.tenantId, role: payload.role, email: payload.email },
      config.JWT_SECRET,
      { expiresIn: '8h' },
    );
    res.json({ success: true, data: { token: newToken } });
  } catch {
    res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Token expired or invalid' } });
  }
});
