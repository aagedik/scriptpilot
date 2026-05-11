import bcrypt from 'bcryptjs';

// Admin authentication service with security hardening

const SALT_ROUNDS = 12;
const SESSION_EXPIRY_HOURS = 24;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// Track failed login attempts in memory (in production, use Redis/database)
const failedLoginAttempts = new Map();
const lockedAccounts = new Map();

export async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

export function isAccountLocked(email) {
  const lockInfo = lockedAccounts.get(email);
  if (!lockInfo) return false;
  
  const now = Date.now();
  if (now > lockInfo.expiresAt) {
    lockedAccounts.delete(email);
    return false;
  }
  
  return true;
}

export function recordFailedLogin(email) {
  const attempts = (failedLoginAttempts.get(email) || 0) + 1;
  failedLoginAttempts.set(email, attempts);
  
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    lockedAccounts.set(email, {
      expiresAt: Date.now() + (LOCKOUT_DURATION_MINUTES * 60 * 1000)
    });
    failedLoginAttempts.delete(email);
  }
}

export function resetFailedLoginAttempts(email) {
  failedLoginAttempts.delete(email);
  lockedAccounts.delete(email);
}

export async function createAdminSession(email) {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000));
  
  // In production, store session in Redis/database with secure flags
  return {
    token,
    email,
    expiresAt
  };
}

export function generateSecureToken() {
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

export function validateAdminSession(session) {
  if (!session || !session.email || !session.expiresAt) {
    return false;
  }
  
  if (new Date() > new Date(session.expiresAt)) {
    return false;
  }
  
  return true;
}

export async function verifyAdminCredentials(email, password) {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
  
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) {
    throw new Error('Admin credentials not configured in environment');
  }
  
  if (email !== ADMIN_EMAIL) {
    return false;
  }
  
  const isValid = await verifyPassword(password, ADMIN_PASSWORD_HASH);
  return isValid;
}

// CSRF token generation and validation
export function generateCSRFToken() {
  return generateSecureToken();
}

export function validateCSRFToken(token, sessionToken) {
  // In production, validate CSRF token against session
  // For now, basic check that token exists and is valid format
  return token && token.length === 32;
}
