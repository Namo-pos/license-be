import crypto from 'crypto';

/**
 * Hash a plain text password using PBKDF2 with SHA-512 and 100,000 iterations.
 * Compatible with POS-v2 backend format: pbkdf2$iterations$salt$hash
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 100000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

/**
 * Verify a plain text password against a stored PBKDF2 hash or plain string.
 */
export function verifyPassword(password: string, hashedPassword: string): boolean {
  if (!hashedPassword) return false;
  
  if (!hashedPassword.startsWith('pbkdf2$')) {
    return password === hashedPassword;
  }
  
  const parts = hashedPassword.split('$');
  if (parts.length !== 4) {
    return false;
  }
  
  const iterations = parseInt(parts[1], 10);
  const salt = parts[2];
  const hash = parts[3];
  
  const testHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  return hash === testHash;
}
