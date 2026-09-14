import fs from 'fs';
import path from 'path';

export interface LicenseRecord {
  id: string;
  licenseKey: string;
  clientName: string;
  email: string;
  subdomain: string;
  fullDomain: string;
  plan: 'PRO' | 'STANDARD' | 'ENTERPRISE';
  tunnelId: string;
  tunnelToken: string;
  dnsRecordId?: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  createdAt: string;
  activatedAt?: string;
  activatedMachineId?: string;
  expiresAt: string;
}

const dbPath = path.resolve('data/licenses.json');

function ensureDb() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([], null, 2), 'utf8');
  }
}

export const Database = {
  getAll(): LicenseRecord[] {
    ensureDb();
    try {
      const data = fs.readFileSync(dbPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  findByKey(licenseKey: string): LicenseRecord | undefined {
    const list = this.getAll();
    return list.find((item) => item.licenseKey.toUpperCase() === licenseKey.trim().toUpperCase());
  },

  findBySubdomain(subdomain: string): LicenseRecord | undefined {
    const list = this.getAll();
    return list.find((item) => item.subdomain.toLowerCase() === subdomain.trim().toLowerCase());
  },

  save(record: LicenseRecord): void {
    ensureDb();
    const list = this.getAll();
    const existingIndex = list.findIndex((item) => item.id === record.id);
    if (existingIndex !== -1) {
      list[existingIndex] = record;
    } else {
      list.push(record);
    }
    fs.writeFileSync(dbPath, JSON.stringify(list, null, 2), 'utf8');
  },

  delete(licenseKey: string): boolean {
    ensureDb();
    const list = this.getAll();
    const initialLen = list.length;
    const filtered = list.filter((item) => item.licenseKey.toUpperCase() !== licenseKey.trim().toUpperCase());
    if (filtered.length === initialLen) return false;
    fs.writeFileSync(dbPath, JSON.stringify(filtered, null, 2), 'utf8');
    return true;
  },

  update(licenseKey: string, patch: Partial<LicenseRecord>): LicenseRecord | null {
    ensureDb();
    const list = this.getAll();
    const index = list.findIndex((item) => item.licenseKey.toUpperCase() === licenseKey.trim().toUpperCase());
    if (index === -1) return null;
    list[index] = { ...list[index], ...patch };
    fs.writeFileSync(dbPath, JSON.stringify(list, null, 2), 'utf8');
    return list[index];
  },
};
