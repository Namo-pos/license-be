import crypto from 'crypto';
import { config } from '../config/env.js';

export interface TunnelProvisionResult {
  subdomain: string;
  tunnelId: string;
  tunnelToken: string;
  fullDomain: string;
  dnsRecordId?: string;
  isMock: boolean;
  hasDns: boolean;
}

export class CloudflareService {
  /**
   * Check if custom domain DNS is configured (Zone ID + Base Domain present).
   */
  static get hasDomainConfig(): boolean {
    return !!(config.cfZoneId && config.baseDomain && config.baseDomain !== 'nomapos.com.placeholder');
  }

  /**
   * Automate creating a Cloudflare Tunnel, Ingress rule, and (optionally) DNS CNAME record.
   *
   * Modes:
   * - CF_SANDBOX=true  → Mock mode (fake token for development)
   * - CF_SANDBOX=false, no ZONE_ID → Real tunnel + token, but NO DNS (domainless mode)
   * - CF_SANDBOX=false, with ZONE_ID → Full production mode (tunnel + DNS CNAME)
   */
  static async provisionClientTunnel(subdomain: string): Promise<TunnelProvisionResult> {
    const cleanSubdomain = subdomain.trim().toLowerCase();

    // 1. Sandbox / Mock Mode
    if (config.cfSandbox) {
      const mockFullDomain = `${cleanSubdomain}.${config.baseDomain}`;
      const mockTunnelId = `cft_${crypto.randomUUID()}`;
      // Generate a mock base64 token structure matching cloudflared runner token
      const mockPayload = {
        a: config.cfAccountId || 'mock_account_id',
        t: mockTunnelId,
        s: crypto.randomBytes(32).toString('base64'),
      };
      const mockTunnelToken = Buffer.from(JSON.stringify(mockPayload)).toString('base64');

      console.log(`[CF-SANDBOX] Provisioned Cloudflare Tunnel for: ${mockFullDomain}`);
      console.log(`[CF-SANDBOX] Tunnel ID: ${mockTunnelId}`);
      console.log(`[CF-SANDBOX] CNAME Route: ${mockFullDomain} -> ${mockTunnelId}.cfargotunnel.com`);

      return {
        subdomain: cleanSubdomain,
        tunnelId: mockTunnelId,
        tunnelToken: mockTunnelToken,
        fullDomain: mockFullDomain,
        dnsRecordId: `dns_mock_${crypto.randomBytes(4).toString('hex')}`,
        isMock: true,
        hasDns: false,
      };
    }

    // 2. Real Cloudflare API Provisioning (requires Account ID + API Token at minimum)
    if (!config.cfAccountId || !config.cfApiToken) {
      throw new Error(
        'Cloudflare configuration missing: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required when CF_SANDBOX=false'
      );
    }

    const hasDomain = this.hasDomainConfig;
    const fullDomain = hasDomain
      ? `${cleanSubdomain}.${config.baseDomain}`
      : ''; // Will be set after tunnel creation

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

    // Step C: Configure Ingress rule
    // With domain: route hostname to local POS server
    // Without domain: catch-all routes everything to local POS server
    const ingressRules: any[] = [];

    if (hasDomain) {
      ingressRules.push({
        hostname: fullDomain,
        service: config.localTargetService,
      });
    }

    // Catch-all rule (required by Cloudflare)
    // Without domain, this becomes the primary route — cloudflared will forward all traffic to local POS
    ingressRules.push({
      service: hasDomain ? 'http_status:404' : config.localTargetService,
    });

    const configRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/cfd_tunnel/${tunnelId}/configurations`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          config: { ingress: ingressRules },
        }),
      }
    );

    const configData: any = await configRes.json();
    if (!configRes.ok || !configData.success) {
      console.warn('Warning: Could not configure tunnel ingress routing:', configData.errors);
    }

    // Step D: Create DNS CNAME Record (ONLY if Zone ID is configured)
    let dnsRecordId: string | undefined;

    if (hasDomain && config.cfZoneId) {
      console.log(`[CF-REAL] Creating DNS CNAME: ${fullDomain} -> ${tunnelId}.cfargotunnel.com`);

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
      dnsRecordId = dnsData?.result?.id;

      if (!dnsRes.ok || !dnsData.success) {
        console.warn('Warning: Could not create DNS CNAME record:', dnsData.errors);
      }
    } else {
      console.log(`[CF-REAL] Domainless mode — tunnel created without DNS. Tunnel ID: ${tunnelId}`);
      console.log(`[CF-REAL] To enable public access later, add CLOUDFLARE_ZONE_ID and BASE_DOMAIN to env.`);
    }

    // Determine the final fullDomain
    const resolvedFullDomain = hasDomain
      ? fullDomain
      : `${tunnelId}.cfargotunnel.com`; // Placeholder — not publicly browsable without DNS

    return {
      subdomain: cleanSubdomain,
      tunnelId,
      tunnelToken,
      fullDomain: resolvedFullDomain,
      dnsRecordId,
      isMock: false,
      hasDns: hasDomain,
    };
  }

  /**
   * Retroactively provision DNS CNAME for an existing tunnel that was created in domainless mode.
   * Call this after adding CLOUDFLARE_ZONE_ID and BASE_DOMAIN to env.
   */
  static async provisionDnsForExistingTunnel(
    tunnelId: string,
    subdomain: string
  ): Promise<{ fullDomain: string; dnsRecordId: string }> {
    if (!config.cfZoneId || !config.baseDomain) {
      throw new Error('CLOUDFLARE_ZONE_ID and BASE_DOMAIN must be configured to provision DNS');
    }
    if (!config.cfApiToken) {
      throw new Error('CLOUDFLARE_API_TOKEN is required');
    }

    const cleanSubdomain = subdomain.trim().toLowerCase();
    const fullDomain = `${cleanSubdomain}.${config.baseDomain}`;

    const headers = {
      Authorization: `Bearer ${config.cfApiToken}`,
      'Content-Type': 'application/json',
    };

    // Update ingress to include the hostname
    const configRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/cfd_tunnel/${tunnelId}/configurations`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          config: {
            ingress: [
              { hostname: fullDomain, service: config.localTargetService },
              { service: 'http_status:404' },
            ],
          },
        }),
      }
    );

    const configData: any = await configRes.json();
    if (!configRes.ok || !configData.success) {
      console.warn('Warning: Could not update tunnel ingress:', configData.errors);
    }

    // Create DNS CNAME
    const dnsRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${config.cfZoneId}/dns_records`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'CNAME',
          name: cleanSubdomain,
          content: `${tunnelId}.cfargotunnel.com`,
          ttl: 1,
          proxied: true,
        }),
      }
    );

    const dnsData: any = await dnsRes.json();
    if (!dnsRes.ok || !dnsData.success) {
      const errDetail = dnsData.errors?.[0]?.message || 'Unknown DNS error';
      throw new Error(`Failed to create DNS CNAME: ${errDetail}`);
    }

    console.log(`[CF-REAL] DNS provisioned: ${fullDomain} -> ${tunnelId}.cfargotunnel.com`);

    return {
      fullDomain,
      dnsRecordId: dnsData.result.id,
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
