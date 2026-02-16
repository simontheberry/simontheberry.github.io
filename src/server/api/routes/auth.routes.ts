// ============================================================================
// Auth Routes
// ============================================================================

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createHash, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { config } from '../../config';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { AppError } from '../middleware/error-handler';
import { rateLimit } from '../middleware/rate-limiter';
import { createLogger } from '../../utils/logger';
import type { AuthTokenPayload, UserRole } from '../../../shared/types/user';

const logger = createLogger('auth-routes');

export const authRoutes = Router();

// Strict rate limit on login to prevent brute force attacks
const loginRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 10, message: 'Too many login attempts. Please try again later.' });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

// POST /api/v1/auth/login
authRoutes.post('/login', loginRateLimit, async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);

  // Resolve tenant from slug
  const tenant = await prisma.tenant.findUnique({
    where: { slug: body.tenantSlug },
  });

  if (!tenant || !tenant.isActive) {
    // Use generic message to prevent user enumeration
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Find user by email within tenant
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: body.email, isActive: true },
  });

  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Verify password using SHA-256 hash with timing-safe comparison.
  // NOTE: For production hardening, migrate to bcrypt or argon2.
  // SHA-256 is used here as bcrypt is not yet a project dependency.
  const passwordHash = createHash('sha256').update(body.password).digest('hex');
  const storedHash = Buffer.from(user.passwordHash);
  const providedHash = Buffer.from(passwordHash);

  if (storedHash.length !== providedHash.length || !timingSafeEqual(storedHash, providedHash)) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Generate JWT
  const tokenPayload: AuthTokenPayload = {
    userId: user.id,
    tenantId: tenant.id,
    role: user.role as UserRole,
    email: user.email,
  };

  const token = jwt.sign(tokenPayload, config.JWT_SECRET, { expiresIn: '8h' });

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Audit log (no PII in log values)
  await writeAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: 'user.login',
    entity: 'User',
    entityId: user.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  logger.info('User logged in', { userId: user.id, tenantId: tenant.id });

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: tenant.id,
        tenantName: tenant.name,
      },
    },
  });
});

// POST /api/v1/auth/refresh
authRoutes.post('/refresh', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'No token provided');
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), config.JWT_SECRET) as AuthTokenPayload;

    // Verify user still exists and is active
    const user = await prisma.user.findFirst({
      where: { id: payload.userId, tenantId: payload.tenantId, isActive: true },
    });

    if (!user) {
      throw new AppError(401, 'INVALID_TOKEN', 'User no longer active');
    }

    const newToken = jwt.sign(
      { userId: payload.userId, tenantId: payload.tenantId, role: payload.role, email: payload.email },
      config.JWT_SECRET,
      { expiresIn: '8h' },
    );

    res.json({ success: true, data: { token: newToken } });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, 'INVALID_TOKEN', 'Token expired or invalid');
  }
});

// GET /api/v1/auth/me -- Get current user info from token
authRoutes.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'No token provided');
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), config.JWT_SECRET) as AuthTokenPayload;

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, tenantId: payload.tenantId, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        teamId: true,
        tenant: { select: { name: true, slug: true } },
      },
    });

    if (!user) {
      throw new AppError(401, 'INVALID_TOKEN', 'User not found');
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        teamId: user.teamId,
        tenantName: user.tenant.name,
        tenantSlug: user.tenant.slug,
      },
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, 'INVALID_TOKEN', 'Token expired or invalid');
  }
});
