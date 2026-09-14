import crypto from 'crypto';
import { config } from '../config/env.js';

export interface TunnelProvisionResult {
  tunnelId: string;
  tunnelToken: string;
  fullDomain: string;
  dnsRecordId?: string;
  isMock: boolean;
}

export class CloudflareService {
  /**
   * Automate creating a Cloudflare Tunnel, Ingress rule, and DNS CNAME record for a client subdomain.
   */
  static async provisionClientTunnel(subdomain: string): Promise<TunnelProvisionResult> {
    const cleanSubdomain = subdomain.trim().toLowerCase();
    const fullDomain = `${cleanSubdomain}.${config.baseDomain}`;

    // 1. Sandbox / Mock Mode
    if (config.cfSandbox) {
      const mockTunnelId = `cft_${crypto.randomUUID()}`;
      // Generate a mock base64 token structure matching cloudflared runner token
      const mockPayload = {
        a: config.cfAccountId || 'mock_account_id',
        t: mockTunnelId,
        s: crypto.randomBytes(32).toString('base64'),
      };
      const mockTunnelToken = Buffer.from(JSON.stringify(mockPayload)).toString('base64');

      console.log(`[CF-SANDBOX] Provisioned Cloudflare Tunnel for: ${fullDomain}`);
      console.log(`[CF-SANDBOX] Tunnel ID: ${mockTunnelId}`);
      console.log(`[CF-SANDBOX] CNAME Route: ${fullDomain} -> ${mockTunnelId}.cfargotunnel.com`);

      return {
        tunnelId: mockTunnelId,
        tunnelToken: mockTunnelToken,
        fullDomain,
        dnsRecordId: `dns_mock_${crypto.randomBytes(4).toString('hex')}`,
        isMock: true,
      };
    }

    // 2. Real Cloudflare API Provisioning
    if (!config.cfAccountId || !config.cfApiToken || !config.cfZoneId) {
      throw new Error(
        'Cloudflare configuration missing (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID required when CF_SANDBOX=false)'
      );
    }

    const headers = {
      Authorization: `Bearer ${config.cfApiToken}`,
      'Content-Type': 'application/json',
    };

    // Step A: Create Cloudflare Tunnel
    const tunnelSecret = crypto.randomBytes(32).toString('base64');
    const tunnelName = `noma-pos-${cleanSubdomain}`;

    const createTunnelRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/cfd_tunnel`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: tunnelName,
          tunnel_secret: tunnelSecret,
        }),
      }
    );

    const createTunnelData: any = await createTunnelRes.json();
    if (!createTunnelRes.ok || !createTunnelData.success) {
      const errDetail = createTunnelData.errors?.[0]?.message || createTunnelRes.statusText;
      throw new Error(`Failed to create Cloudflare Tunnel: ${errDetail}`);
    }

    const tunnelId = createTunnelData.result.id;

    // Step B: Retrieve the runner Tunnel Token
    const tokenRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/cfd_tunnel/${tunnelId}/token`,
      { method: 'GET', headers }
    );

    const tokenData: any = await tokenRes.json();
    const tunnelToken = tokenData?.result || createTunnelData.result.token;
    if (!tunnelToken) {
      throw new Error('Failed to retrieve tunnel runner token from Cloudflare API');
    }

    // Step C: Configure Ingress rule (route fullDomain to local POS server on client machine)
    const configRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/cfd_tunnel/${tunnelId}/configurations`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          config: {
            ingress: [
              {
                hostname: fullDomain,
                service: config.localTargetService,
              },
              {
                service: 'http_status:404',
              },
            ],
          },
        }),
      }
    );

    const configData: any = await configRes.json();
    if (!configRes.ok || !configData.success) {
      console.warn('Warning: Could not configure tunnel ingress routing:', configData.errors);
    }

    // Step D: Create DNS CNAME Record in Cloudflare Zone
    const dnsRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${config.cfZoneId}/dns_records`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'CNAME',
          name: cleanSubdomain,
          content: `${tunnelId}.cfargotunnel.com`,
          ttl: 1, // Auto TTL
          proxied: true, // Cloudflare Orange Cloud Proxy
        }),
      }
    );

    const dnsData: any = await dnsRes.json();
    const dnsRecordId = dnsData?.result?.id;

    return {
      tunnelId,
      tunnelToken,
      fullDomain,
      dnsRecordId,
      isMock: false,
    };
  }

  static async deleteClientTunnel(tunnelId: string, dnsRecordId?: string): Promise<boolean> {
    if (config.cfSandbox) {
      console.log(`[CF-SANDBOX] Deleted Cloudflare Tunnel: ${tunnelId}`);
      return true;
    }
    const headers = {
      Authorization: `Bearer ${config.cfApiToken}`,
      'Content-Type': 'application/json',
    };
    if (dnsRecordId && config.cfZoneId) {
      try {
        await fetch(
          `https://api.cloudflare.com/client/v4/zones/${config.cfZoneId}/dns_records/${dnsRecordId}`,
          { method: 'DELETE', headers }
        );
      } catch (err) {
        console.warn('Failed to delete DNS record:', err);
      }
    }
    try {
      const delRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/cfd_tunnel/${tunnelId}`,
        { method: 'DELETE', headers }
      );
      const delData = await delRes.json();
      return Boolean(delData?.success);
    } catch (err) {
      console.warn('Failed to delete tunnel:', err);
      return false;
    }
  }
}
