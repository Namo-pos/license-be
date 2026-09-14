import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LicenseLeasePayload {
  accountId: string;
  subscriptionId: string;
  licenseCode: string;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE' | string;
  clientName: string;
  maxUsers: number;
  subscriptionValidUntil: string | null;
  deviceId: string;
  deviceName?: string;
  issuedAt: string;
  refreshAfter: string;
  leaseValidUntil: string;
  gracePeriodUntil: string;
  serverTime: string;
  features?: Record<string, any>;
}

export class LicenseSigner {
  private static privateKeyPem: string | null = null;
  private static publicKeyPem: string | null = null;

  /**
   * Initialize or load Ed25519 keypair
   */
  private static initKeys() {
    if (this.privateKeyPem && this.publicKeyPem) {
      return;
    }

    // 1. Check environment variables
    if (process.env.LICENSE_PRIVATE_KEY && process.env.LICENSE_PUBLIC_KEY) {
      this.privateKeyPem = process.env.LICENSE_PRIVATE_KEY.replace(/\\n/g, '\n');
      this.publicKeyPem = process.env.LICENSE_PUBLIC_KEY.replace(/\\n/g, '\n');
      return;
    }

    // 2. Check local key storage file
    const keyFilePath = path.resolve(__dirname, '../../data/license_keypair.json');
    if (fs.existsSync(keyFilePath)) {
      try {
        const raw = fs.readFileSync(keyFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.privateKey && parsed.publicKey) {
          this.privateKeyPem = parsed.privateKey;
          this.publicKeyPem = parsed.publicKey;
          return;
        }
      } catch (e) {
        console.warn('[LicenseSigner] Could not read existing key file, generating new pair...', e);
      }
    }

    // 3. Generate a new Ed25519 keypair
    console.log('[LicenseSigner] Generating persistent Ed25519 keypair for license signing...');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    this.privateKeyPem = privateKey;
    this.publicKeyPem = publicKey;

    // Persist to file
    try {
      const dir = path.dirname(keyFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(keyFilePath, JSON.stringify({ privateKey, publicKey }, null, 2), 'utf-8');
      console.log(`[LicenseSigner] Ed25519 keypair successfully saved to ${keyFilePath}`);
    } catch (err: any) {
      console.error('[LicenseSigner] Warning: Failed to persist keys to disk:', err.message);
    }
  }

  /**
   * Get public key in PEM format (to be shared with desktop clients)
   */
  static getPublicKeyPem(): string {
    this.initKeys();
    return this.publicKeyPem!;
  }

  /**
   * Canonicalize object for deterministic signature calculation
   */
  static canonicalString(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map((item) => this.canonicalString(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + this.canonicalString(obj[k])).join(',') + '}';
  }

  /**
   * Sign a license lease payload using Ed25519 private key
   * Returns Base64-encoded digital signature
   */
  static signLease(payload: LicenseLeasePayload): string {
    this.initKeys();
    const canonical = this.canonicalString(payload);
    const data = Buffer.from(canonical, 'utf-8');
    const signature = crypto.sign(null, data, this.privateKeyPem!);
    return signature.toString('base64');
  }

  /**
   * Verify a license lease payload with the public key
   */
  static verifyLease(payload: LicenseLeasePayload, signatureBase64: string): boolean {
    this.initKeys();
    try {
      const canonical = this.canonicalString(payload);
      const data = Buffer.from(canonical, 'utf-8');
      const signature = Buffer.from(signatureBase64, 'base64');
      return crypto.verify(null, data, this.publicKeyPem!, signature);
    } catch {
      return false;
    }
  }
}
