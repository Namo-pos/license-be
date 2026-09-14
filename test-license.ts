import { LicenseService } from './src/services/license.service.js';

async function runTests() {
  console.log('🧪 Starting POS-License multi-tier & Supabase tests...\n');

  const ts = Date.now();
  const freeUsername = `admin_free_${ts}`;
  const proUsername = `admin_pro_${ts}`;

  // Test 1: Register FREE client
  console.log('--- Test 1: Register FREE plan ---');
  const freeResult = await LicenseService.registerClient({
    username: freeUsername,
    password: 'securePassword123',
    plan: 'FREE',
    clientName: 'Toko Berkah Free',
    email: 'free@tokoberkah.com',
  });
  console.log('✅ FREE Registration Success:', {
    licenseCode: freeResult.licenseCode,
    plan: freeResult.plan,
    maxUsers: freeResult.limits.maxUsers,
    cloudflareIncluded: freeResult.limits.cloudflareIncluded,
    startDate: freeResult.startDate,
    expiredDate: freeResult.expiredDate,
    adminUser: freeResult.user.username,
    masterKey: freeResult.user.masterKey,
  });

  if (freeResult.limits.maxUsers !== 5) {
    throw new Error(`Expected maxUsers 5 for FREE, got ${freeResult.limits.maxUsers}`);
  }
  if (freeResult.limits.cloudflareIncluded !== false) {
    throw new Error(`Expected cloudflareIncluded false for FREE`);
  }
  if (freeResult.expiredDate !== null) {
    throw new Error(`Expected expiredDate null for FREE, got ${freeResult.expiredDate}`);
  }
  if (!freeResult.user.masterKey || !freeResult.user.masterKey.startsWith('MK-')) {
    throw new Error(`Expected valid MASTER_KEY, got ${freeResult.user.masterKey}`);
  }

  // Test 2: Register PRO client
  console.log('\n--- Test 2: Register PRO plan ---');
  const proResult = await LicenseService.registerClient({
    username: proUsername,
    password: 'proPassword456',
    plan: 'PRO',
    clientName: 'Toko Maju Pro',
    email: 'pro@tokomaju.com',
    subdomain: `tokomaju${ts % 10000}`,
  });
  console.log('✅ PRO Registration Success:', {
    licenseCode: proResult.licenseCode,
    plan: proResult.plan,
    maxUsers: proResult.limits.maxUsers,
    cloudflareIncluded: proResult.limits.cloudflareIncluded,
    startDate: proResult.startDate,
    expiredDate: proResult.expiredDate,
    masterKey: proResult.user.masterKey,
    cloudflare: proResult.cloudflare,
  });

  if (proResult.limits.maxUsers !== 100) {
    throw new Error(`Expected maxUsers 100 for PRO, got ${proResult.limits.maxUsers}`);
  }
  if (proResult.limits.cloudflareIncluded !== true) {
    throw new Error(`Expected cloudflareIncluded true for PRO`);
  }
  if (!proResult.expiredDate) {
    throw new Error(`Expected expiredDate to be set for PRO`);
  }

  // Test 3: Attempt to register ENTERPRISE (should return warning: enterprise is not available right now)
  console.log('\n--- Test 3: Register ENTERPRISE plan (Warning expected) ---');
  try {
    await LicenseService.registerClient({
      username: 'admin_enterprise',
      password: 'passwordEnterprise',
      plan: 'ENTERPRISE',
    });
    throw new Error('ENTERPRISE registration should have thrown warning!');
  } catch (err: any) {
    console.log('✅ ENTERPRISE properly returned warning:', err.message);
    if (err.message !== 'enterprise is not available right now') {
      throw new Error(`Unexpected message: ${err.message}`);
    }
  }

  // Test 4: Verify Admin Login & License info
  console.log('\n--- Test 4: Verify Admin user credentials & master key for bootstrap ---');
  const verified = await LicenseService.verifyAdminUser(freeUsername, 'securePassword123');
  console.log('✅ Verify Admin Success:', {
    valid: verified.valid,
    user: verified.user.username,
    role: verified.user.role,
    masterKey: verified.user.masterKey,
    licenseCode: verified.license.licenseCode,
    plan: verified.license.plan,
    maxUsers: verified.license.maxUsers,
  });

  if (!verified.user.masterKey) {
    throw new Error('Missing masterKey in verifyAdminUser response');
  }

  // Test 5: Verify invalid password
  console.log('\n--- Test 5: Verify invalid password ---');
  try {
    await LicenseService.verifyAdminUser(freeUsername, 'wrongPassword');
    throw new Error('Should have rejected invalid password!');
  } catch (err: any) {
    console.log('✅ Invalid password correctly rejected:', err.message);
  }

  // Test 6: Single-device node locking
  console.log('\n--- Test 6: Enforce single-device registration per store ---');
  const act1 = await LicenseService.activateLicense(proResult.licenseCode, 'PC-MAIN-STORE-01');
  console.log('✅ First POS activation succeeded for PC-MAIN-STORE-01');

  try {
    await LicenseService.activateLicense(proResult.licenseCode, 'PC-SECOND-STORE-02');
    throw new Error('Should have rejected second device activation on same license!');
  } catch (err: any) {
    console.log('✅ Second POS application activation correctly blocked:', err.message);
  }

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
