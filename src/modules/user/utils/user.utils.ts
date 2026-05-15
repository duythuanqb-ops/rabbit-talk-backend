import { randomBytes, scryptSync } from 'crypto';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function parseDuplicateKeyError(error: any): string | null {
  if (error?.code !== 'ER_DUP_ENTRY') {
    return null;
  }

  const message = String(error.sqlMessage || error.message || '');
  if (message.includes("for key 'users.username'") || message.includes("for key 'username'")) {
    return 'Username already exists';
  }

  if (message.includes("for key 'users.email'") || message.includes("for key 'email'")) {
    return 'Email already exists';
  }

  const match = /Duplicate entry '.*' for key '([^']+)'/.exec(message);
  if (match) {
    const keyName = match[1].replace(/^users\./, '');
    return `${keyName} already exists`;
  }

  return 'Duplicate entry detected';
}
