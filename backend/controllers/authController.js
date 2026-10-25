/**
 * DataForge — Authentication Controller
 * Architecture: MVC Controller Layer (Assigned to: Person 2 / Auth & Security)
 */

import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export async function registerUser(req, res, next) {
  try {
    const { name, email, password, role, preferences } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Please provide name, email, and password');
    }

    // Check if user already exists
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists with this email address');
    }

    // Create user in MongoDB (pre-save hook hashes password)
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: role || 'user',
      preferences: preferences || {},
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferences: user.preferences,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
