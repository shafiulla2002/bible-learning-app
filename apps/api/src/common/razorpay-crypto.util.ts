import * as crypto from 'crypto';

export interface RazorpayConfig {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  mode: 'LIVE' | 'TEST' | 'UNCONFIGURED';
}

function deriveAesKey(): Buffer {
  const secret =
    process.env.RAZORPAY_MASTER_KEY ||
    process.env.CREDENTIALS_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'bible-lms-dev-encryption-key-change-me';
  return crypto.scryptSync(secret, 'bible-lms-razorpay-salt', 32);
}

/**
 * Encrypts per-institute Razorpay credentials JSON using AES-256-GCM.
 */
export function encryptRazorpayCredentials(payload: {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}): string {
  const iv = crypto.randomBytes(12);
  const key = deriveAesKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const serialized = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts per-institute Razorpay credentials stored in InstituteSettings.razorpayKeyEncrypted.
 * Supports encrypted `enc:v1:...` payloads as well as legacy JSON strings safely.
 */
export function resolveRazorpayConfig(encryptedValue?: string | null): RazorpayConfig {
  let keyId = process.env.RAZORPAY_KEY_ID?.trim();
  let keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  let webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

  if (encryptedValue && typeof encryptedValue === 'string') {
    try {
      let decoded: any = null;
      if (encryptedValue.startsWith('enc:v1:')) {
        const parts = encryptedValue.split(':');
        if (parts.length === 5) {
          const iv = Buffer.from(parts[2], 'hex');
          const tag = Buffer.from(parts[3], 'hex');
          const ciphertext = Buffer.from(parts[4], 'hex');
          const decipher = crypto.createDecipheriv('aes-256-gcm', deriveAesKey(), iv);
          decipher.setAuthTag(tag);
          const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
          decoded = JSON.parse(plain);
        }
      } else if (encryptedValue.trim().startsWith('{')) {
        decoded = JSON.parse(encryptedValue);
      }
      if (decoded?.keyId) keyId = String(decoded.keyId).trim();
      if (decoded?.keySecret) keySecret = String(decoded.keySecret).trim();
      if (decoded?.webhookSecret) webhookSecret = String(decoded.webhookSecret).trim();
    } catch {
      // Never leak decryption errors or broken stored payloads
    }
  }

  if (!keyId || !keySecret) {
    return { mode: 'UNCONFIGURED', webhookSecret };
  }

  const mode: 'LIVE' | 'TEST' = keyId.startsWith('rzp_live_') ? 'LIVE' : 'TEST';
  return { keyId, keySecret, webhookSecret, mode };
}

/**
 * Constant-time HMAC-SHA256 verification for Razorpay Checkout payment callbacks.
 */
export function verifyRazorpayPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  keySecret: string;
}): boolean {
  if (
    !params.razorpayOrderId ||
    !params.razorpayPaymentId ||
    !params.razorpaySignature ||
    !params.keySecret
  ) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', params.keySecret)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(params.razorpaySignature.trim(), 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Constant-time HMAC-SHA256 verification for Razorpay Server Webhooks (`X-Razorpay-Signature`).
 */
export function verifyRazorpayWebhookSignature(params: {
  rawBody: string | Buffer;
  signature: string;
  webhookSecret: string;
}): boolean {
  if (!params.rawBody || !params.signature || !params.webhookSecret) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', params.webhookSecret)
    .update(params.rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(params.signature.trim(), 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Calls Razorpay Orders API directly via Node fetch without extra SDK lock-in.
 */
export async function createRazorpayRemoteOrder(params: {
  keyId: string;
  keySecret: string;
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string; status: string }> {
  const auth = Buffer.from(`${params.keyId}:${params.keySecret}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: params.currency || 'INR',
      receipt: params.receipt,
      notes: params.notes || {},
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Razorpay order creation failed (${res.status}): ${errText}`);
  }

  return res.json() as Promise<{ id: string; amount: number; currency: string; status: string }>;
}

