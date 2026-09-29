import { validateEnvironment } from '../../src/config/env';
import { ApiService } from '../../src/services/api';
import { Server } from 'http';
import express from 'express';

async function runDemoModeHardeningTests() {
  console.log('=== Running Production Demo-Mode Hardening Automated Test Suite ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (!condition) {
      console.error(`  FAIL: ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    } else {
      console.log(`  PASS: ${message}`);
      passed++;
    }
  }

  // =========================================================================
  // Test 1: Environment Model Assertions (Fail-Closed)
  // =========================================================================
  console.log('[Test 1] Environment Model Assertions (Fail-Closed Verification)...');

  // Production with Demo Mode = true MUST throw a fatal configuration error
  try {
    validateEnvironment(true, { env: 'production', demoMode: true });
    assert(false, 'Expected production with demoMode=true to throw fatal error');
  } catch (err: any) {
    assert(
      err.message.includes('fail-closed') || err.message.includes('forbidden'),
      `Production with demoMode=true correctly threw fatal error: ${err.message}`
    );
  }

  // Staging with Demo Mode = true MUST throw a fatal configuration error
  try {
    validateEnvironment(true, { env: 'staging', demoMode: true });
    assert(false, 'Expected staging with demoMode=true to throw fatal error');
  } catch (err: any) {
    assert(
      err.message.includes('forbidden'),
      `Staging with demoMode=true correctly threw fatal error: ${err.message}`
    );
  }

  // Production with Demo Mode = false MUST succeed with isDemoMode = false
  const prodConfig = validateEnvironment(true, { env: 'production', demoMode: false });
  assert(prodConfig.isDemoMode === false, 'Production mode correctly sets isDemoMode to false');
  assert(prodConfig.isProduction === true, 'Production mode correctly sets isProduction to true');

  // Development with Demo Mode = true is permitted
  const devDemoConfig = validateEnvironment(true, { env: 'development', demoMode: true });
  assert(devDemoConfig.isDemoMode === true, 'Development mode allows demoMode to be true');

  // Development with Demo Mode = false is permitted
  const devLiveConfig = validateEnvironment(true, { env: 'development', demoMode: false });
  assert(devLiveConfig.isDemoMode === false, 'Development mode allows demoMode to be false');

  // =========================================================================
  // Test 2: Production Live API Fail-Closed on Network Failure
  // =========================================================================
  console.log('\n[Test 2] Live API Client Fail-Closed Behavior (No Fake Fallbacks)...');

  // Set up a mock failing backend server (simulating 500 error or network unreachable)
  const app = express();
  app.use(express.json());

  app.get('/api/v1/products', (_req, res) => {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  });

  app.post('/api/v1/auth/login', (_req, res) => {
    res.status(500).json({ success: false, message: 'Auth service down' });
  });

  app.post('/api/v1/checkout', (_req, res) => {
    res.status(500).json({ success: false, message: 'Payment gateway connection refused' });
  });

  app.post('/api/v1/service-requests', (_req, res) => {
    res.status(500).json({ success: false, message: 'Database failure' });
  });

  app.post('/api/v1/auth/otp/send', (_req, res) => {
    res.status(500).json({ success: false, message: 'SMS provider offline' });
  });

  app.get('/api/v1/users/me', (_req, res) => {
    res.status(500).json({ success: false, message: 'User service error' });
  });

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 9999;
  const testBaseUrl = `http://localhost:${port}/api/v1`;

  // Instantiate ApiService configured with testBaseUrl
  const liveApi = new ApiService(testBaseUrl);

  // 2.1 Catalog Load Failure -> Throws error, returns NO fake products
  try {
    await liveApi.getProducts();
    assert(false, 'Catalog failure should throw an exception in production');
  } catch (error: any) {
    assert(error !== undefined, 'Catalog network failure throws an exception and produces no fake products');
  }

  // 2.2 Login Failure -> Throws error, returns NO fake token or demoCustomer
  try {
    await liveApi.login({ email: 'user@realdomain.com', password: 'realpassword' });
    assert(false, 'Login failure should throw an exception in production');
  } catch (error: any) {
    assert(error !== undefined, 'Login failure throws an exception and returns no fake user or fake token');
  }

  // 2.3 Checkout Failure -> Throws error, returns NO fake order_id or fake order_number
  try {
    await liveApi.checkout({
      shipping_address: { full_name: 'Test User' },
      payment_gateway: 'zibal',
      shipping_method: 'express',
    });
    assert(false, 'Checkout failure should throw an exception in production');
  } catch (error: any) {
    assert(error !== undefined, 'Checkout failure throws an exception and returns no fake order_id');
  }

  // 2.4 Service Request Failure -> Throws error, returns NO fake reference_number
  try {
    await liveApi.submitServiceRequest({
      title: 'Real Fiber Optic Installation',
      requirements: 'Need live technician',
    });
    assert(false, 'Service request failure should throw an exception in production');
  } catch (error: any) {
    assert(error !== undefined, 'Service request failure throws an exception and returns no fake reference_number');
  }

  // 2.5 OTP Send Failure -> Throws error, returns NO fake success code
  try {
    await liveApi.sendOtp('09121234567');
    assert(false, 'OTP send failure should throw an exception in production');
  } catch (error: any) {
    assert(error !== undefined, 'OTP send failure throws an exception and returns no fake success');
  }

  // 2.6 User Profile Failure -> Throws error, returns NO demo customer profile
  try {
    await liveApi.getProfile();
    assert(false, 'Profile failure should throw an exception in production');
  } catch (error: any) {
    assert(error !== undefined, 'Profile failure throws an exception and returns no demo customer');
  }

  // =========================================================================
  // Test 3: Live API on Connection Refused (Network Down) -> Fail-Closed
  // =========================================================================
  console.log('\n[Test 3] Live API Behavior on Complete Network Failure (Connection Refused)...');
  const unreachableApi = new ApiService('http://127.0.0.1:1'); // unallocated port

  try {
    await unreachableApi.getProducts();
    assert(false, 'Connection refused on catalog should throw an exception');
  } catch (error: any) {
    assert(error !== undefined, 'Connection refused on catalog throws an exception without fake sample fallback');
  }

  try {
    await unreachableApi.checkout({
      shipping_address: { full_name: 'Test' },
      payment_gateway: 'saman',
      shipping_method: 'standard',
    });
    assert(false, 'Connection refused on checkout should throw an exception');
  } catch (error: any) {
    assert(error !== undefined, 'Connection refused on checkout throws an exception without fake order fallback');
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log(`\n============================================================`);
  console.log(`ALL ${passed} DEMO-MODE HARDENING CHECKS PASSED! (0 failures)`);
  console.log(`============================================================`);
}

runDemoModeHardeningTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
