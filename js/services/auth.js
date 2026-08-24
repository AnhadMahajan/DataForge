import * as storage from './storage.js';
import { generateUUID, hashString } from '../utils/math.js';

const USERS_KEY = 'users';
const SESSION_KEY = 'session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---- Password Hashing ----
async function hashPassword(password) {
  return hashString(password + '_dataforge_salt_v1');
}

// ---- User Management ----

/**
 * Register a new user.
 * Returns { success, data: { user, session } } or { success, error }
 */
export async function signup(name, email, password) {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  // Check for duplicate email
  const users = storage.getCollection(USERS_KEY);
  const existing = users.find(u => u.email === trimmedEmail);
  if (existing) {
    return { success: false, error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' } };
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const user = {
    id: generateUUID(),
    name: trimmedName,
    email: trimmedEmail,
    passwordHash,
    createdAt: now,
    lastLoginAt: now,
  };


  const writeResult = storage.addToCollection(USERS_KEY, user);
  if (!writeResult.success) return writeResult;

  // Create default preferences
  storage.set(`preferences_${user.id}`, {
    defaultEvaluationRuns: 5,
    defaultTrainTestSplit: 0.8,
    defaultModel: 'knn',
  });

  // Auto-login after signup
  const session = createSession(user.id);
  const sessionResult = storage.set(SESSION_KEY, session);
  if (!sessionResult.success) return sessionResult;

  // Return user without passwordHash
  const { passwordHash: _, ...safeUser } = user;
  return { success: true, data: { user: safeUser, session } };
}

/**
 * Authenticate an existing user.
 * Returns { success, data: { user, session } } or { success, error }
 */
export async function login(email, password) {
  const trimmedEmail = email.trim().toLowerCase();
  const users = storage.getCollection(USERS_KEY);
  const user = users.find(u => u.email === trimmedEmail);

  if (!user) {
    return { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } };
  }

  const passwordHash = await hashPassword(password);
  if (user.passwordHash !== passwordHash) {
    return { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } };
  }

  // Update last login
  storage.updateInCollection(USERS_KEY, user.id, { lastLoginAt: new Date().toISOString() });

  // Create session
  const session = createSession(user.id);
  const sessionResult = storage.set(SESSION_KEY, session);
  if (!sessionResult.success) return sessionResult;

  const { passwordHash: _, ...safeUser } = user;
  return { success: true, data: { user: safeUser, session } };
}

/**
 * Log out the current user by clearing the session.
 */
export function logout() {
  storage.remove(SESSION_KEY);
  window.location.href = 'login.html';
}

// ---- Session Management ----

function createSession(userId) {
  const now = new Date();
  return {
    userId,
    token: generateUUID(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS).toISOString(),
  };
}

/**
 * Get the current session if valid, or null.
 */
export function getSession() {
  const session = storage.get(SESSION_KEY);
  if (!session) return null;

  // Check expiry
  if (new Date(session.expiresAt) < new Date()) {
    storage.remove(SESSION_KEY);
    return null;
  }

  return session;
}

/**
 * Require a valid session — redirect to login if none exists.
 * Call this at the top of every protected page's init function.
 */
export function requireSession() {
  const session = getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

/**
 * Check if a valid session exists (without redirecting).
 */
export function isLoggedIn() {
  return getSession() !== null;
}

/**
 * Get the current user's profile (without passwordHash).
 */
export function getCurrentUser() {
  const session = getSession();
  if (!session) return null;

  const users = storage.getCollection(USERS_KEY);
  const user = users.find(u => u.id === session.userId);
  if (!user) return null;

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Update the current user's profile.
 */
export function updateProfile(updates) {
  const session = getSession();
  if (!session) {
    return { success: false, error: { code: 'NO_SESSION', message: 'Not logged in.' } };
  }

  // Prevent updating sensitive fields through this method
  const { passwordHash, id, email, ...safeUpdates } = updates;
  return storage.updateInCollection(USERS_KEY, session.userId, safeUpdates);
}

/**
 * Change the current user's password.
 */
export async function changePassword(currentPassword, newPassword) {
  const session = getSession();
  if (!session) {
    return { success: false, error: { code: 'NO_SESSION', message: 'Not logged in.' } };
  }

  const users = storage.getCollection(USERS_KEY);
  const user = users.find(u => u.id === session.userId);
  if (!user) {
    return { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } };
  }

  const currentHash = await hashPassword(currentPassword);
  if (user.passwordHash !== currentHash) {
    return { success: false, error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect.' } };
  }

  const newHash = await hashPassword(newPassword);
  return storage.updateInCollection(USERS_KEY, session.userId, { passwordHash: newHash });
}

/**
 * Get user preferences.
 */
export function getPreferences() {
  const session = getSession();
  if (!session) return null;
  return storage.get(`preferences_${session.userId}`) || {
    defaultEvaluationRuns: 5,
    defaultTrainTestSplit: 0.8,
    defaultModel: 'knn',
  };
}

/**
 * Update user preferences.
 */
export function updatePreferences(updates) {
  const session = getSession();
  if (!session) {
    return { success: false, error: { code: 'NO_SESSION', message: 'Not logged in.' } };
  }
  const current = getPreferences();
  return storage.set(`preferences_${session.userId}`, { ...current, ...updates });
}
