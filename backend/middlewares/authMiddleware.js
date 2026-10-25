/**
 * DataForge — Authentication & RBAC Middlewares
 * Architecture: MVC Middleware Layer (Assigned to: Person 2 / Auth & Security)
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Protect routes - verifies JWT Bearer token and attaches user to req.user
 */
export async function protect(req, res, next) {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract token from Bearer header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const secret =
        process.env.JWT_SECRET ||
        'dataforge_super_secure_jwt_secret_key_2026_production';
      const decoded = jwt.verify(token, secret);

      // Find user by ID and exclude password
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        res.status(401);
        throw new Error('Not authorized, user not found');
      }

      return next();
    } catch (error) {
      res.status(401);
      return next(error);
    }
  }

  if (!token) {
    res.status(401);
    return next(new Error('Not authorized, no token provided'));
  }
}

/**
 * Role-Based Access Control (RBAC) middleware
 * Restricts access to specified roles
 * @param  {...string} roles - Allowed roles (e.g. 'admin', 'data_scientist')
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      return next(new Error('Not authorized, user authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      res.status(403);
      return next(
        new Error(
          `User role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
}

export default { protect, authorize };
