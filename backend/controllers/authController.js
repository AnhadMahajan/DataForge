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

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export async function loginUser(req, res, next) {
  try {
    const { email, password } = req.body;

    // Validate email and password inputs
    if (!email || !password) {
      res.status(400);
      throw new Error('Please provide both email and password');
    }

    // Find user by lowercase email
    const user = await User.findOne({ email: email.toLowerCase() });

    // Verify credentials with bcrypt matchPassword method
    if (user && (await user.matchPassword(password))) {
      const token = generateToken(user._id);

      res.status(200).json({
        success: true,
        message: 'Login successful',
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
    } else {
      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private (Protected)
 */
export async function getMe(req, res, next) {
  try {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized, user profile not available');
    }

    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Update password for authenticated user
 * @route   PUT /api/auth/password
 * @access  Private (Protected)
 */
export async function updatePassword(req, res, next) {
  try {
    const { currentPassword, oldPassword, newPassword, password } = req.body;
    const oldPass = currentPassword || oldPassword;
    const newPass = newPassword || password;

    if (!oldPass || !newPass) {
      res.status(400);
      throw new Error('Please provide both current password and new password');
    }

    if (newPass.length < 6) {
      res.status(400);
      throw new Error('New password must be at least 6 characters long');
    }

    // Get user from database with password field
    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Validate current password
    const isMatch = await user.matchPassword(oldPass);
    if (!isMatch) {
      res.status(401);
      throw new Error('Current password is incorrect');
    }

    // Set new password (pre-save middleware handles hashing)
    user.password = newPass;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
}



