import { Request, Response } from 'express';
import { LicenseService } from '../services/license.service.js';
import { CloudflareService } from '../services/cloudflare.service.js';
import { D1Database, D1Database as SupabaseDatabase, LicenseJsonData } from '../storage/d1.database.js';

export const LicenseController = {
  /**
   * Register a new client admin user & issue a license
   * POST /api/license/register
   * Body: { username, password, plan, clientName, email, subdomain }
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, password, plan, clientName, email, subdomain } = req.body;

      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: 'username and password are required fields',
        });
        return;
      }

      const result = await LicenseService.registerClient({
        username,
        password,
        plan,
        clientName,
        email,
        subdomain,
      });

      res.status(201).json({
        success: true,
        message: 'License registered and admin user created successfully',
        data: result,
      });
    } catch (err: any) {
      if (err.isWarning) {
        res.status(200).json({
          success: false,
          warning: true,
          message: err.message,
        });
        return;
      }
      res.status(400).json({
        success: false,
        error: err.message || 'Registration failed',
      });
    }
  },

  /**
   * Verify an admin user for initial POS SQLite bootstrap
   * POST /api/license/verify-admin
   * Body: { username, password }
   */
  async verifyAdmin(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: 'username and password are required',
        });
        return;
      }

      const verification = await LicenseService.verifyAdminUser(username, password);
      res.json({
        success: true,
        message: 'Admin credentials and license verified',
        data: verification,
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: err.message || 'Authentication failed',
      });
    }
  },

  /**
   * Activate a license from POS Desktop
   * POST /api/license/activate
   */
  async activate(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, licenseCode, machineId } = req.body;
      const code = licenseCode || licenseKey;

      if (!code) {
        res.status(400).json({
          success: false,
          error: 'licenseCode (or licenseKey) is required',
        });
        return;
      }

      const activationData = await LicenseService.activateLicense(code, machineId);
      res.json({
        success: true,
        message: 'License activated successfully',
        data: activationData,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'License activation failed',
      });
    }
  },

  /**
   * Check status of a license
   * GET /api/license/status/:key
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const key = (Array.isArray(req.params.key) ? req.params.key[0] : req.params.key) as string;
      const record = await SupabaseDatabase.findLicenseByCode(key);
      if (!record) {
        res.status(404).json({ success: false, error: 'License key not found' });
        return;
      }

      const json: LicenseJsonData =
        typeof record.LICENSE_JSON === 'string' ? JSON.parse(record.LICENSE_JSON) : record.LICENSE_JSON;

      res.json({
        success: true,
        data: {
          licenseId: record.LICENSE_ID,
          licenseCode: record.LICENSE_CODE,
          plan: json.plan,
          clientName: json.clientName,
          status: json.status,
          maxUsers: json.maxUsers,
          cloudflareIncluded: json.cloudflareIncluded,
          fullDomain: json.fullDomain || null,
          startDate: json.startDate,
          expiredDate: json.expiredDate,
          activatedAt: json.activatedAt || null,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  },

  /**
   * List all registered licenses
   * GET /api/license/list
   */
  async listAll(_req: Request, res: Response): Promise<void> {
    try {
      const rows = await SupabaseDatabase.getAllLicenses();
      const records = rows.map((r) => {
        const json: LicenseJsonData =
          typeof r.LICENSE_JSON === 'string' ? JSON.parse(r.LICENSE_JSON) : r.LICENSE_JSON;
        return {
          licenseId: r.LICENSE_ID,
          licenseCode: r.LICENSE_CODE,
          plan: json.plan,
          clientName: json.clientName,
          subdomain: json.subdomain,
          fullDomain: json.fullDomain,
          status: json.status,
          maxUsers: json.maxUsers,
          cloudflareIncluded: json.cloudflareIncluded,
          startDate: json.startDate,
          expiredDate: json.expiredDate,
          activatedAt: json.activatedAt || null,
          createdAt: r.CREATED_AT,
        };
      });
      res.json({ success: true, count: records.length, data: records });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  },

  /**
   * Delete or revoke license
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const key = (Array.isArray(req.params.key) ? req.params.key[0] : req.params.key) as string;
      const hardDelete = req.query.hard === 'true';
      const result = await LicenseService.revokeOrDeleteLicense(key, hardDelete);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Delete failed' });
    }
  },

  /**
   * Get all plan benefits from LICENSE_MASTER
   * GET /api/license/benefits
   */
  async getBenefits(_req: Request, res: Response): Promise<void> {
    try {
      const benefits = await LicenseService.getPlanBenefits();
      res.json({
        success: true,
        count: benefits.length,
        data: benefits,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
  },

  /**
   * Get benefit details for a specific plan
   * GET /api/license/benefits/:plan
   */
  async getBenefitByPlan(req: Request, res: Response): Promise<void> {
    try {
      const plan = (Array.isArray(req.params.plan) ? req.params.plan[0] : req.params.plan) as string;
      const result = await LicenseService.getPlanBenefit(plan);
      res.json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message || 'Plan not found' });
    }
  },

  /**
   * First device activation / re-activation with signed short-lived lease
   * POST /api/license/activate-device
   * Body: { username, password, deviceId, deviceName }
   */
  async activateDevice(req: Request, res: Response): Promise<void> {
    try {
      const { username, password, deviceId, deviceName } = req.body;
      const result = await LicenseService.activateDevice({
        username,
        password,
        deviceId,
        deviceName,
      });
      res.json({
        success: true,
        message: 'Device activated and signed license lease issued successfully',
        data: result,
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        code: err.code || 'ACTIVATION_FAILED',
        error: err.message || 'Device activation failed',
      });
    }
  },

  /**
   * Periodic background license refresh or manual check
   * POST /api/license/refresh-lease
   * Body: { licenseCode, deviceId }
   */
  async refreshLease(req: Request, res: Response): Promise<void> {
    try {
      const { licenseCode, deviceId } = req.body;
      const result = await LicenseService.refreshLease({
        licenseCode,
        deviceId,
      });
      res.json({
        success: true,
        message: 'License lease refreshed successfully',
        data: result,
      });
    } catch (err: any) {
      const statusCode = err.code === 'DEVICE_MISMATCH' ? 403 : err.code === 'SUBSCRIPTION_EXPIRED' ? 402 : 400;
      res.status(statusCode).json({
        success: false,
        code: err.code || 'REFRESH_FAILED',
        error: err.message || 'Failed to refresh license lease',
        expiredDate: err.expiredDate,
      });
    }
  },

  /**
   * Cumulative subscription renewal (Section 11)
   * POST /api/license/renew
   * Body: { licenseCode, durationDays }
   */
  async renew(req: Request, res: Response): Promise<void> {
    try {
      const { licenseCode, durationDays } = req.body;
      const result = await LicenseService.renewSubscription({
        licenseCode,
        durationDays: Number(durationDays || 365),
      });
      res.json({
        success: true,
        message: 'Subscription renewed successfully',
        data: result,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Subscription renewal failed',
      });
    }
  },

  /**
   * Explicit device deactivation (Section 26)
   * POST /api/license/deactivate-device
   * Body: { licenseCode, deviceId, username, password }
   */
  async deactivateDevice(req: Request, res: Response): Promise<void> {
    try {
      const { licenseCode, deviceId, username, password } = req.body;
      const result = await LicenseService.deactivateDevice({
        licenseCode,
        deviceId,
        username,
        password,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Deactivation failed',
      });
    }
  },

  /**
   * Public key for desktop license signature verification
   * GET /api/license/public-key
   */
  async getPublicKey(_req: Request, res: Response): Promise<void> {
    try {
      const publicKey = LicenseService.getPublicKeyPem();
      res.json({
        success: true,
        publicKey,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to get public key',
      });
    }
  },

  /**
   * Retroactively provision DNS for all existing domainless tunnels.
   * Call this after adding CLOUDFLARE_ZONE_ID and BASE_DOMAIN to env.
   * POST /api/license/provision-dns
   */
  async provisionDns(_req: Request, res: Response): Promise<void> {
    try {
      if (!CloudflareService.hasDomainConfig) {
        res.status(400).json({
          success: false,
          error: 'CLOUDFLARE_ZONE_ID and BASE_DOMAIN must be configured before provisioning DNS.',
        });
        return;
      }

      const allLicenses = await SupabaseDatabase.getAllLicenses();
      const results: any[] = [];

      for (const lic of allLicenses) {
        const json: LicenseJsonData =
          typeof lic.LICENSE_JSON === 'string' ? JSON.parse(lic.LICENSE_JSON) : lic.LICENSE_JSON;

        // Skip licenses without tunnel or already with DNS
        if (!json.tunnelId || json.dnsRecordId) continue;
        if (!json.subdomain) continue;

        try {
          const dns = await CloudflareService.provisionDnsForExistingTunnel(
            json.tunnelId,
            json.subdomain
          );

          // Update LICENSE_JSON with new fullDomain and dnsRecordId
          await SupabaseDatabase.updateLicense(lic.LICENSE_CODE, {
            fullDomain: dns.fullDomain,
            dnsRecordId: dns.dnsRecordId,
          });

          results.push({
            licenseCode: lic.LICENSE_CODE,
            subdomain: json.subdomain,
            fullDomain: dns.fullDomain,
            status: 'provisioned',
          });
        } catch (err: any) {
          results.push({
            licenseCode: lic.LICENSE_CODE,
            subdomain: json.subdomain,
            status: 'failed',
            error: err.message,
          });
        }
      }

      res.json({
        success: true,
        message: `DNS provisioning complete. ${results.filter(r => r.status === 'provisioned').length} of ${results.length} tunnels updated.`,
        data: results,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'DNS provisioning failed',
      });
    }
  },
};
