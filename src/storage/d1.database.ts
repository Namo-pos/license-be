import { getPrisma, isPrismaConfigured } from './prisma.client.js';
import crypto from 'crypto';

export interface LicenseJsonData {
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  clientName?: string;
  email?: string;
  subdomain?: string;
  fullDomain?: string;
  tunnelId?: string;
  tunnelToken?: string;
  dnsRecordId?: string;
  maxUsers: number;
  cloudflareIncluded: boolean;
  startDate: string | null;
  expiredDate: string | null;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  features: {
    tunnel: boolean;
    maxUsers: number;
    [key: string]: any;
  };
  activatedAt?: string;
  activatedMachineId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LicenseRow {
  LICENSE_ID: string;
  LICENSE_CODE: string;
  PLAN_TYPE: string;
  LICENSE_JSON: LicenseJsonData | string;
  IS_ACTIVE: boolean;
  CREATED_AT?: string;
  UPDATED_AT?: string;
}

export interface UserRow {
  USER_ID: string;
  USERNAME: string;
  PASSWORD: string;
  MASTER_KEY: string;
  LICENSE_ID: string;
  ROLE: string;
  CREATED_AT?: string;
  UPDATED_AT?: string;
}

export interface LicenseMasterRow {
  LICENSE_MASTER_ID: string;
  LICENSE_PLAN_CODE: string;
  LICENSE_JSON: any;
  CREATED_AT?: string;
  UPDATED_AT?: string;
}

// In-memory fallback for unit tests and when database password has not yet been populated in .env
const memoryLicenses: LicenseRow[] = [];
const memoryUsers: UserRow[] = [];
const memoryMasters: LicenseMasterRow[] = [];

export const D1Database = {
  /**
   * Insert a new License record via Prisma Cloudflare D1
   */
  async createLicense(data: {
    licenseCode: string;
    planType: string;
    licenseJson: LicenseJsonData;
  }): Promise<LicenseRow> {
    const jsonString = JSON.stringify(data.licenseJson);

    if (isPrismaConfigured()) {
      const prisma = getPrisma();
      const created = await prisma.license.create({
        data: {
          LicenseCode: data.licenseCode,
          PlanType: data.planType,
          LicenseJson: jsonString,
          IsActive: true,
        },
      });

      return {
        LICENSE_ID: created.LicenseId,
        LICENSE_CODE: created.LicenseCode,
        PLAN_TYPE: created.PlanType,
        LICENSE_JSON: data.licenseJson,
        IS_ACTIVE: created.IsActive,
        CREATED_AT: created.CreatedAt.toISOString(),
        UPDATED_AT: created.UpdatedAt.toISOString(),
      };
    }

    // Memory fallback
    const licenseId = crypto.randomUUID();
    const newRecord: LicenseRow = {
      LICENSE_ID: licenseId,
      LICENSE_CODE: data.licenseCode,
      PLAN_TYPE: data.planType,
      LICENSE_JSON: data.licenseJson,
      IS_ACTIVE: true,
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString(),
    };
    memoryLicenses.push(newRecord);
    return newRecord;
  },

  /**
   * Insert a new User record via Prisma PostgreSQL (or in-memory fallback)
   */
  async createUser(data: {
    username: string;
    passwordHash: string;
    masterKey: string;
    licenseId: string;
    role?: string;
  }): Promise<UserRow> {
    if (isPrismaConfigured()) {
      const prisma = getPrisma();
      const created = await prisma.user.create({
        data: {
          Username: data.username.trim(),
          Password: data.passwordHash,
          MasterKey: data.masterKey,
          LicenseId: data.licenseId,
          Role: data.role || 'ADMIN',
        },
      });

      return {
        USER_ID: created.UserId,
        USERNAME: created.Username,
        PASSWORD: created.Password,
        MASTER_KEY: created.MasterKey,
        LICENSE_ID: created.LicenseId,
        ROLE: created.Role,
        CREATED_AT: created.CreatedAt.toISOString(),
        UPDATED_AT: created.UpdatedAt.toISOString(),
      };
    }

    // Memory fallback
    const userId = crypto.randomUUID();
    const newRecord: UserRow = {
      USER_ID: userId,
      USERNAME: data.username.trim(),
      PASSWORD: data.passwordHash,
      MASTER_KEY: data.masterKey,
      LICENSE_ID: data.licenseId,
      ROLE: data.role || 'ADMIN',
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString(),
    };
    memoryUsers.push(newRecord);
    return newRecord;
  },

  /**
   * Find a user by username
   */
  async findUserByUsername(username: string): Promise<UserRow | null> {
    const normalized = username.trim().toLowerCase();

    if (isPrismaConfigured()) {
      const prisma = getPrisma();
      const found = await prisma.user.findFirst({
        where: {
          Username: normalized,
        },
      });

      if (!found) return null;
      return {
        USER_ID: found.UserId,
        USERNAME: found.Username,
        PASSWORD: found.Password,
        MASTER_KEY: found.MasterKey,
        LICENSE_ID: found.LicenseId,
        ROLE: found.Role,
        CREATED_AT: found.CreatedAt.toISOString(),
        UPDATED_AT: found.UpdatedAt.toISOString(),
      };
    }

    const found = memoryUsers.find((u) => u.USERNAME.toLowerCase() === normalized);
    return found || null;
  },

  /**
   * Find a user by license ID
   */
  async findUserByLicenseId(licenseId: string): Promise<UserRow | null> {
    if (isPrismaConfigured()) {
      const prisma = getPrisma();
      const found = await prisma.user.findFirst({
        where: { LicenseId: licenseId },
      });

      if (!found) return null;
      return {
        USER_ID: found.UserId,
        USERNAME: found.Username,
        PASSWORD: found.Password,
        MASTER_KEY: found.MasterKey,
        LICENSE_ID: found.LicenseId,
        ROLE: found.Role,
        CREATED_AT: found.CreatedAt.toISOString(),
        UPDATED_AT: found.UpdatedAt.toISOString(),
      };
    }

    const found = memoryUsers.find((u) => u.LICENSE_ID === licenseId);
    return found || null;
  },

  /**
   * Find a license by license code
   */
  async findLicenseByCode(licenseCode: string): Promise<LicenseRow | null> {
    const code = licenseCode.trim().toUpperCase();

    if (isPrismaConfigured()) {
      const prisma = getPrisma();
      const found = await prisma.license.findUnique({
        where: { LicenseCode: code },
      });

      if (!found) return null;
      return {
        LICENSE_ID: found.LicenseId,
        LICENSE_CODE: found.LicenseCode,
        PLAN_TYPE: found.PlanType,
        LICENSE_JSON: JSON.parse(found.LicenseJson),
        IS_ACTIVE: found.IsActive,
        CREATED_AT: found.CreatedAt.toISOString(),
        UPDATED_AT: found.UpdatedAt.toISOString(),
      };
    }

    const found = memoryLicenses.find((l) => l.LICENSE_CODE.toUpperCase() === code);
    return found || null;
  },

  /**
   * Find a license by license ID
   */
  async findLicenseById(licenseId: string): Promise<LicenseRow | null> {
    if (isPrismaConfigured()) {
      const prisma = getPrisma();
      const found = await prisma.license.findUnique({
        where: { LicenseId: licenseId },
      });

      if (!found) return null;
      return {
        LICENSE_ID: found.LicenseId,
        LICENSE_CODE: found.LicenseCode,
        PLAN_TYPE: found.PlanType,
        LICENSE_JSON: JSON.parse(found.LicenseJson),
        IS_ACTIVE: found.IsActive,
        CREATED_AT: found.CreatedAt.toISOString(),
        UPDATED_AT: found.UpdatedAt.toISOString(),
      };
    }

    const found = memoryLicenses.find((l) => l.LICENSE_ID === licenseId);
    return found || null;
  },

  /**
   * Update license JSON or status
   */
  async updateLicense(licenseCode: string, patch: Partial<LicenseJsonData>): Promise<LicenseRow | null> {
    const existing = await this.findLicenseByCode(licenseCode);
    if (!existing) return null;

    const existingJson: LicenseJsonData =
      typeof existing.LICENSE_JSON === 'string' ? JSON.parse(existing.LICENSE_JSON) : existing.LICENSE_JSON;
    const mergedJson: LicenseJsonData = { ...existingJson, ...patch, updatedAt: new Date().toISOString() };

    if (isPrismaConfigured()) {
      const prisma = getPrisma();
      const updated = await prisma.license.update({
        where: { LicenseCode: licenseCode.trim().toUpperCase() },
        data: {
          LicenseJson: JSON.stringify(mergedJson),
          IsActive: patch.status ? patch.status === 'ACTIVE' : existing.IS_ACTIVE,
        },
      });

      return {
        LICENSE_ID: updated.LicenseId,
        LICENSE_CODE: updated.LicenseCode,
        PLAN_TYPE: updated.PlanType,
        LICENSE_JSON: mergedJson,
        IS_ACTIVE: updated.IsActive,
        CREATED_AT: updated.CreatedAt.toISOString(),
        UPDATED_AT: updated.UpdatedAt.toISOString(),
      };
    }

    existing.LICENSE_JSON = mergedJson;
    existing.UPDATED_AT = new Date().toISOString();
    return existing;
  },

  /**
   * List all licenses
   */
  async getAllLicenses(): Promise<LicenseRow[]> {
    if (isPrismaConfigured()) {
      const prisma = getPrisma();
      const list = await prisma.license.findMany({
        orderBy: { CreatedAt: 'desc' },
      });

      return list.map((item) => ({
        LICENSE_ID: item.LicenseId,
        LICENSE_CODE: item.LicenseCode,
        PLAN_TYPE: item.PlanType,
        LICENSE_JSON: JSON.parse(item.LicenseJson),
        IS_ACTIVE: item.IsActive,
        CREATED_AT: item.CreatedAt.toISOString(),
        UPDATED_AT: item.UpdatedAt.toISOString(),
      }));
    }

    return [...memoryLicenses];
  },

  /**
   * Check if a subdomain is already in use by an existing license
   */
  async isSubdomainTaken(subdomain: string): Promise<boolean> {
    const clean = subdomain.trim().toLowerCase();
    if (!clean) return false;

    if (isPrismaConfigured()) {
      const prisma = getPrisma();
      const candidates = await prisma.license.findMany({
        where: {
          LicenseJson: {
            contains: clean,
          },
        },
      });

      for (const item of candidates) {
        try {
          const json: LicenseJsonData =
            typeof item.LicenseJson === 'string' ? JSON.parse(item.LicenseJson) : item.LicenseJson;
          if (json.subdomain && json.subdomain.toLowerCase() === clean) {
            return true;
          }
        } catch {}
      }
      return false;
    }

    return memoryLicenses.some((l) => {
      const json: LicenseJsonData =
        typeof l.LICENSE_JSON === 'string' ? JSON.parse(l.LICENSE_JSON) : l.LICENSE_JSON;
      return json.subdomain && json.subdomain.toLowerCase() === clean;
    });
  },

  /**
   * Delete a license by code
   */
  async deleteLicense(licenseCode: string): Promise<boolean> {
    const code = licenseCode.trim().toUpperCase();

    if (isPrismaConfigured()) {
      const prisma = getPrisma();
      await prisma.license.delete({
        where: { LicenseCode: code },
      });
      return true;
    }

    const index = memoryLicenses.findIndex((l) => l.LICENSE_CODE.toUpperCase() === code);
    if (index === -1) return false;
    memoryLicenses.splice(index, 1);
    return true;
  },

  /**
   * Find benefit template for a specific plan code from LICENSE_MASTER
   */
  async findPlanBenefit(planCode: string): Promise<LicenseMasterRow | null> {
    const code = planCode.trim().toUpperCase();

    if (isPrismaConfigured()) {
      const prisma = getPrisma();
      const found = await prisma.licenseMaster.findUnique({
        where: { LicensePlanCode: code },
      });

      if (!found) return null;
      return {
        LICENSE_MASTER_ID: found.LicenseMasterId,
        LICENSE_PLAN_CODE: found.LicensePlanCode,
        LICENSE_JSON: JSON.parse(found.LicenseJson),
        CREATED_AT: found.CreatedAt.toISOString(),
        UPDATED_AT: found.UpdatedAt.toISOString(),
      };
    }

    const found = memoryMasters.find((m) => m.LICENSE_PLAN_CODE.toUpperCase() === code);
    return found || null;
  },

  /**
   * Upsert a plan benefit template into LICENSE_MASTER
   */
  async upsertPlanBenefit(planCode: string, benefitJson: any): Promise<LicenseMasterRow> {
    const code = planCode.trim().toUpperCase();
    const jsonStr = JSON.stringify(benefitJson);

    if (isPrismaConfigured()) {
      const prisma = getPrisma();
      const upserted = await prisma.licenseMaster.upsert({
        where: { LicensePlanCode: code },
        create: {
          LicensePlanCode: code,
          LicenseJson: jsonStr,
        },
        update: {
          LicenseJson: jsonStr,
        },
      });

      return {
        LICENSE_MASTER_ID: upserted.LicenseMasterId,
        LICENSE_PLAN_CODE: upserted.LicensePlanCode,
        LICENSE_JSON: benefitJson,
        CREATED_AT: upserted.CreatedAt.toISOString(),
        UPDATED_AT: upserted.UpdatedAt.toISOString(),
      };
    }

    const idx = memoryMasters.findIndex((m) => m.LICENSE_PLAN_CODE.toUpperCase() === code);
    const row: LicenseMasterRow = {
      LICENSE_MASTER_ID: crypto.randomUUID(),
      LICENSE_PLAN_CODE: code,
      LICENSE_JSON: benefitJson,
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString(),
    };

    if (idx !== -1) {
      memoryMasters[idx] = row;
    } else {
      memoryMasters.push(row);
    }
    return row;
  },

  /**
   * Get all plan benefits from LICENSE_MASTER
   */
  async getAllPlanBenefits(): Promise<LicenseMasterRow[]> {
    if (isPrismaConfigured()) {
      const prisma = getPrisma();
      const list = await prisma.licenseMaster.findMany({
        orderBy: { LicensePlanCode: 'asc' },
      });

      return list.map((item) => ({
        LICENSE_MASTER_ID: item.LicenseMasterId,
        LICENSE_PLAN_CODE: item.LicensePlanCode,
        LICENSE_JSON: JSON.parse(item.LicenseJson),
        CREATED_AT: item.CreatedAt.toISOString(),
        UPDATED_AT: item.UpdatedAt.toISOString(),
      }));
    }

    return [...memoryMasters];
  },

  /**
   * Seed default plan benefits for FREE, PRO, and ENTERPRISE into LICENSE_MASTER
   */
  async seedDefaultPlanBenefits(): Promise<void> {
    const defaults = [
      {
        planCode: 'FREE',
        json: {
          plan: 'FREE',
          name: 'Free Starter',
          maxUsers: 5,
          maxStaff: 4,
          includeAdmin: true,
          cloudflareIncluded: false,
          validityDays: null,
          isInfinite: true,
          description: 'Free tier for small stores: up to 5 users (1 Admin + 4 Staff), offline-ready local POS',
          features: {
            remoteAccess: false,
            mobileApp: false,
            maxUsers: 5,
          },
        },
      },
      {
        planCode: 'PRO',
        json: {
          plan: 'PRO',
          name: 'Professional Tier',
          maxUsers: 100,
          includeAdmin: true,
          cloudflareIncluded: true,
          validityDays: 365,
          isInfinite: false,
          description: 'Professional tier: up to 100 mobile users, Cloudflare remote tunnel included, 1 year validity',
          features: {
            remoteAccess: true,
            mobileApp: true,
            maxUsers: 100,
          },
        },
      },
      {
        planCode: 'ENTERPRISE',
        json: {
          plan: 'ENTERPRISE',
          name: 'Enterprise Cloud',
          maxUsers: 9999,
          includeAdmin: true,
          cloudflareIncluded: true,
          validityDays: null,
          isInfinite: false,
          status: 'NOT_AVAILABLE_SELF_SERVICE',
          description: 'Custom cloud enterprise deployment. Currently not available for self-service registration.',
          features: {
            remoteAccess: true,
            mobileApp: true,
            dedicatedCloud: true,
            prioritySupport: true,
          },
        },
      },
    ];

    for (const item of defaults) {
      await this.upsertPlanBenefit(item.planCode, item.json);
    }
  },
};

export { D1Database as SupabaseDatabase };
