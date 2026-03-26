import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';

export interface AuthRequest extends Request {
  user?: any;
}

/**
 * Verify JWT token middleware
 */
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = typeof authHeader === 'string' && authHeader.split(' ')[1]; 

    if (!token) {
      logger.warn('[Auth] Missing token in request to:', req.path);
      logger.debug('[Auth] Headers received:', JSON.stringify(req.headers, null, 2));
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const secret = process.env.JWT_SECRET || 'default-secret-key';
    jwt.verify(token, secret, (err: any, decoded: any) => {
      if (err) {
        logger.warn('[Auth] Invalid token attempt for:', req.path, 'Reason:', err.message);
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      req.user = decoded;
      next();
    });
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Check if user has specific role
 */
export const requireRole = (...roles: Array<'student' | 'teacher'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    jwt.verify(token, process.env.JWT_SECRET!, (err: any, decoded: any) => {
      if (!err) {
        req.user = decoded;
      }
      next();
    });
  } catch (error) {
    next();
  }
};

export default { authenticateToken, requireRole, optionalAuth };
