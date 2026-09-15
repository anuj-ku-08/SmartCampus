import crypto from 'crypto';

const SECRET_KEY = process.env.QR_SECRET_KEY || 'campus-attendance-secure-salt-2026';

export interface RollingTokenPayload {
  sessionId: string;
  timestamp: number;
  ttl: number; // in ms, default 10000
  seq: number;
}

export function generateRollingToken(sessionId: string, seq: number, ttl: number = 10000): {
  token: string;
  payload: RollingTokenPayload;
  expiresAt: number;
} {
  const now = Date.now();
  const payload: RollingTokenPayload = {
    sessionId,
    timestamp: now,
    ttl,
    seq,
  };

  const serialized = JSON.stringify(payload);
  const base64Data = Buffer.from(serialized).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(base64Data)
    .digest('base64url');

  const token = `${base64Data}.${signature}`;
  return {
    token,
    payload,
    expiresAt: now + ttl,
  };
}

export function verifyRollingToken(token: string): {
  isValid: boolean;
  reason?: string;
  payload?: RollingTokenPayload;
} {
  if (!token || typeof token !== 'string') {
    return { isValid: false, reason: 'Missing or invalid token format' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { isValid: false, reason: 'Malformed QR code token structure' };
  }

  const [base64Data, providedSignature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(base64Data)
    .digest('base64url');

  if (providedSignature !== expectedSignature) {
    return { isValid: false, reason: 'Tampered or counterfeit QR token signature' };
  }

  try {
    const raw = Buffer.from(base64Data, 'base64url').toString('utf-8');
    const payload: RollingTokenPayload = JSON.parse(raw);
    const now = Date.now();
    const elapsed = now - payload.timestamp;

    // Strict 10-second TTL + 2.5 second network latency / clock jitter allowance
    const maxAllowedAge = (payload.ttl || 10000) + 2500;
    if (elapsed > maxAllowedAge) {
      const expiredBySec = ((elapsed - (payload.ttl || 10000)) / 1000).toFixed(1);
      return {
        isValid: false,
        reason: `Expired QR code (${expiredBySec}s beyond the 10-second validity window). Please scan the current live code.`,
        payload,
      };
    }

    if (elapsed < -5000) {
      return { isValid: false, reason: 'Future timestamp detected on client clock', payload };
    }

    return { isValid: true, payload };
  } catch (err) {
    return { isValid: false, reason: 'Failed to decode token payload' };
  }
}
