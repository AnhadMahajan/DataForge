/**
 * DataForge — JWT Token Generator Utility
 * Architecture: Security & Auth Layer (Assigned to: Person 2 / Auth & Security)
 */

import jwt from 'jsonwebtoken';

/**
 * Generate JSON Web Token for authenticated user
 * @param {string|Object} id - User ObjectId or identifier
 * @returns {string} Signed JWT Token
 */
export const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'dataforge_super_secure_jwt_secret_key_2026_production',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

export default generateToken;
