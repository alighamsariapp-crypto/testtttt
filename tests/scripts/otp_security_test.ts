import assert from "assert";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  handleSendOtp,
  handleVerifyOtp,
  normalizeIranianPhone,
  redactPhone,
  resetRateLimits,
  setSmsMockHook,
} from "../../src/server/authRoutes";
import { getDatabase } from "../../src/server/db";

// Lightweight Express req/res mocks for unit and integration testing
function createMockRequest(body: any = {}, headers: any = {}, ip = "127.0.0.1") {
  return {
    body,
    headers,
    ip,
    socket: { remoteAddress: ip },
  } as any;
}

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
    send(data: any) {
      res.body = data;
      return res;
    },
  };
  return res;
}

async function runOtpSecurityTestSuite() {
  console.log("=== STARTING OTP SECURITY ACCEPTANCE TEST SUITE ===");
  const db = await getDatabase();
  db.run("DELETE FROM phone_verification_codes");

  // 1. Phone Normalization Tests
  console.log("\n[Test 1] Testing Phone Normalization...");
  assert.strictEqual(normalizeIranianPhone("09123456789"), "09123456789");
  assert.strictEqual(normalizeIranianPhone("+989123456789"), "09123456789");
  assert.strictEqual(normalizeIranianPhone("00989123456789"), "09123456789");
  assert.strictEqual(normalizeIranianPhone("989123456789"), "09123456789");
  assert.strictEqual(normalizeIranianPhone("۰۹۱۲۳۴۵۶۷۸۹"), "09123456789", "Persian digits failed to normalize");
  assert.strictEqual(normalizeIranianPhone("٠٩١٢٣٤٥٦٧٨٩"), "09123456789", "Arabic digits failed to normalize");
  assert.throws(() => normalizeIranianPhone("08123456789"), /A valid Iranian mobile number is required/);
  assert.throws(() => normalizeIranianPhone("12345"), /A valid Iranian mobile number is required/);
  console.log("✓ Phone normalization verified.");

  // 2. Phone Redaction Tests
  console.log("\n[Test 2] Testing Phone Redaction in Logs...");
  assert.strictEqual(redactPhone("09123456789"), "0912****89");
  assert.strictEqual(redactPhone(""), "***");
  console.log("✓ Phone redaction verified.");

  // 3. Acceptance Test F: SMS-disabled configuration returns 503 and does not authenticate
  console.log("\n[Acceptance Test F] SMS-disabled configuration returns 503...");
  setSmsMockHook(null);
  delete (global as any).__SMS_MOCK__;
  delete process.env.KAVENEGAR_API_KEY;

  // Temporarily disable sms_config in database
  db.run("UPDATE settings SET value = '{\"provider\":\"kavenegar\",\"is_active\":false,\"api_key\":\"\"}' WHERE key = 'sms_config.config'");

  const reqF = createMockRequest({ phone: "09129990001" }, {}, "10.0.0.1");
  const resF = createMockResponse();
  await handleSendOtp(reqF, resF);

  assert.strictEqual(resF.statusCode, 503, `Expected 503 for unconfigured SMS, got ${resF.statusCode}`);
  assert.strictEqual(resF.body.error_code, "SMS_NOT_CONFIGURED");
  console.log("✓ Acceptance Test F PASSED: Unconfigured/disabled SMS returned 503.");

  // Configure SMS mock transport for subsequent tests
  let lastDispatchedOtp: { phone: string; code: string } | null = null;
  setSmsMockHook(async (phone, code) => {
    lastDispatchedOtp = { phone, code };
    return true;
  });

  // 4. Acceptance Test A: Two codes for the same phone cannot be requested inside resend window
  console.log("\n[Acceptance Test A] Two codes for same phone inside resend window...");
  resetRateLimits();
  const testPhoneA = "09121110001";
  const reqA1 = createMockRequest({ phone: testPhoneA }, {}, "10.0.0.2");
  const resA1 = createMockResponse();
  await handleSendOtp(reqA1, resA1);
  assert.strictEqual(resA1.statusCode, 200);
  assert.strictEqual(resA1.body.data.resend_in, 60);

  // Second immediate send request must fail with 429 OTP_RESEND_TOO_SOON
  const reqA2 = createMockRequest({ phone: testPhoneA }, {}, "10.0.0.2");
  const resA2 = createMockResponse();
  await handleSendOtp(reqA2, resA2);
  assert.strictEqual(resA2.statusCode, 429);
  assert.strictEqual(resA2.body.error_code, "OTP_RESEND_TOO_SOON");
  console.log("✓ Acceptance Test A PASSED: Cooldown enforced inside resend window.");

  // 5. Acceptance Test H: OTP values and hashes are absent from logs and responses
  console.log("\n[Acceptance Test H] OTP values and hashes are absent from responses...");
  const responseJson = JSON.stringify(resA1.body);
  assert(!responseJson.includes("code_hash"), "Response must NOT contain code_hash");
  assert(!responseJson.includes('"code":'), "Response must NOT contain code");
  assert(resA1.body.data.expires_in === 120);
  assert(resA1.body.data.resend_in === 60);

  // Check stored record: code_hash must be a bcrypt hash, NOT plaintext
  const rowH = db.exec("SELECT code_hash FROM phone_verification_codes WHERE phone = '" + testPhoneA + "'")[0].values[0];
  const storedHash = String(rowH[0]);
  assert(storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$"), "Must store bcrypt hash");
  assert(!storedHash.includes(lastDispatchedOtp?.code || ""), "Stored hash must never match raw code plaintext");
  console.log("✓ Acceptance Test H PASSED: Plaintext OTP and hashes absent from response.");

  // 6. Acceptance Test B: A random valid code succeeds once and only once
  console.log("\n[Acceptance Test B] A random valid code succeeds once and only once...");
  const testPhoneB = "09122220002";
  resetRateLimits();
  const reqB = createMockRequest({ phone: testPhoneB }, {}, "10.0.0.3");
  const resB = createMockResponse();
  await handleSendOtp(reqB, resB);
  assert.strictEqual(resB.statusCode, 200);

  const sentCodeB = lastDispatchedOtp!.code;
  assert(sentCodeB && sentCodeB.length === 6, "Must generate a 6-digit code");

  // First verification must succeed
  const verifyReqB1 = createMockRequest({ phone: testPhoneB, code: sentCodeB }, {}, "10.0.0.3");
  const verifyResB1 = createMockResponse();
  await handleVerifyOtp(verifyReqB1, verifyResB1);
  assert.strictEqual(verifyResB1.statusCode, 200);
  assert(verifyResB1.body.data.token, "Must issue authentication token");
  assert(verifyResB1.body.data.user.phone === testPhoneB);

  // Second verification with the same code must FAIL (consumed_at is set)
  const verifyReqB2 = createMockRequest({ phone: testPhoneB, code: sentCodeB }, {}, "10.0.0.3");
  const verifyResB2 = createMockResponse();
  await handleVerifyOtp(verifyReqB2, verifyResB2);
  assert.strictEqual(verifyResB2.statusCode, 422);
  assert.strictEqual(verifyResB2.body.error_code, "OTP_INVALID_OR_EXPIRED");
  console.log("✓ Acceptance Test B PASSED: Valid code succeeded once and was rejected on second use.");

  // 7. Acceptance Test C: 123456 does not succeed unless it was actually randomly generated
  console.log("\n[Acceptance Test C] 123456 does not succeed as universal bypass...");
  const testPhoneC = "09123330003";
  const realCodeC = "748291"; // Known different code
  const codeHashC = bcrypt.hashSync(realCodeC, 10);
  const nowIso = new Date().toISOString();
  const expIso = new Date(Date.now() + 120000).toISOString();

  db.run("DELETE FROM phone_verification_codes WHERE phone = ?", [testPhoneC]);
  db.run(
    "INSERT INTO phone_verification_codes (phone, code_hash, issued_at, resend_available_at, expires_at, consumed_at, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?)",
    [testPhoneC, codeHashC, nowIso, nowIso, expIso, nowIso, nowIso]
  );

  resetRateLimits();
  // Attempt verification using universal bypass 123456
  const reqC = createMockRequest({ phone: testPhoneC, code: "123456" }, {}, "10.0.0.4");
  const resC = createMockResponse();
  await handleVerifyOtp(reqC, resC);
  assert.strictEqual(resC.statusCode, 422, "123456 must NOT succeed when real code is different");
  assert.strictEqual(resC.body.error_code, "OTP_INVALID_OR_EXPIRED");
  console.log("✓ Acceptance Test C PASSED: Universal 123456 bypass is completely eliminated.");

  // 8. Acceptance Test D: An expired code fails
  console.log("\n[Acceptance Test D] An expired code fails...");
  const testPhoneD = "09124440004";
  const expiredCode = "654321";
  const expiredHash = bcrypt.hashSync(expiredCode, 10);
  const pastIso = new Date(Date.now() - 60000).toISOString(); // 1 min in the past

  db.run("DELETE FROM phone_verification_codes WHERE phone = ?", [testPhoneD]);
  db.run(
    "INSERT INTO phone_verification_codes (phone, code_hash, issued_at, resend_available_at, expires_at, consumed_at, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?)",
    [testPhoneD, expiredHash, pastIso, pastIso, pastIso, pastIso, pastIso]
  );

  resetRateLimits();
  const reqD = createMockRequest({ phone: testPhoneD, code: expiredCode }, {}, "10.0.0.5");
  const resD = createMockResponse();
  await handleVerifyOtp(reqD, resD);
  assert.strictEqual(resD.statusCode, 422);
  assert.strictEqual(resD.body.error_code, "OTP_INVALID_OR_EXPIRED");
  console.log("✓ Acceptance Test D PASSED: Expired code fails.");

  // 9. Acceptance Test E: A wrong code increments attempts and eventually locks out
  console.log("\n[Acceptance Test E] Wrong code increments attempts and locks out...");
  const testPhoneE = "09125550005";
  const validCodeE = "998877";
  const codeHashE = bcrypt.hashSync(validCodeE, 10);
  const futureIso = new Date(Date.now() + 120000).toISOString();

  db.run("DELETE FROM phone_verification_codes WHERE phone = ?", [testPhoneE]);
  db.run(
    "INSERT INTO phone_verification_codes (phone, code_hash, issued_at, resend_available_at, expires_at, consumed_at, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?)",
    [testPhoneE, codeHashE, nowIso, nowIso, futureIso, nowIso, nowIso]
  );

  resetRateLimits();
  // 4 incorrect attempts: each returns 422
  for (let attempt = 1; attempt <= 4; attempt++) {
    const reqE = createMockRequest({ phone: testPhoneE, code: "000000" }, {}, "10.0.0.6");
    const resE = createMockResponse();
    await handleVerifyOtp(reqE, resE);
    assert.strictEqual(resE.statusCode, 422);
  }

  // 5th incorrect attempt: must trigger lockout (429 OTP_ATTEMPT_LIMIT_REACHED)
  const reqE5 = createMockRequest({ phone: testPhoneE, code: "000000" }, {}, "10.0.0.6");
  const resE5 = createMockResponse();
  await handleVerifyOtp(reqE5, resE5);
  assert.strictEqual(resE5.statusCode, 429);
  assert.strictEqual(resE5.body.error_code, "OTP_ATTEMPT_LIMIT_REACHED");

  // Subsequent attempt even after rate limiter window (resetRateLimits) must still fail because record was locked out
  resetRateLimits();
  const reqEValid = createMockRequest({ phone: testPhoneE, code: validCodeE }, {}, "10.0.0.6");
  const resEValid = createMockResponse();
  await handleVerifyOtp(reqEValid, resEValid);
  assert.strictEqual(resEValid.statusCode, 429);
  assert.strictEqual(resEValid.body.error_code, "OTP_ATTEMPT_LIMIT_REACHED");
  console.log("✓ Acceptance Test E PASSED: Maximum attempts locks out and invalidates code.");

  // 10. Acceptance Test G: Concurrent verification requests result in at most one successful token
  console.log("\n[Acceptance Test G] Concurrent verification requests result in at most one successful token...");
  const testPhoneG = "09127770007";
  const validCodeG = "554433";
  const codeHashG = bcrypt.hashSync(validCodeG, 10);

  db.run("DELETE FROM phone_verification_codes WHERE phone = ?", [testPhoneG]);
  db.run(
    "INSERT INTO phone_verification_codes (phone, code_hash, issued_at, resend_available_at, expires_at, consumed_at, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?)",
    [testPhoneG, codeHashG, nowIso, nowIso, futureIso, nowIso, nowIso]
  );

  resetRateLimits();
  // Fire 5 concurrent verify requests
  const responsesG: any[] = [];
  const promises = Array.from({ length: 5 }).map(async (_, idx) => {
    const req = createMockRequest({ phone: testPhoneG, code: validCodeG }, {}, `10.0.1.${idx + 1}`);
    const res = createMockResponse();
    await handleVerifyOtp(req, res);
    responsesG.push(res);
  });

  await Promise.all(promises);

  const successResponses = responsesG.filter((r) => r.statusCode === 200);
  const failureResponses = responsesG.filter((r) => r.statusCode === 422);

  assert.strictEqual(successResponses.length, 1, `Expected exactly 1 success response, got ${successResponses.length}`);
  assert.strictEqual(failureResponses.length, 4, `Expected exactly 4 failure responses, got ${failureResponses.length}`);
  console.log("✓ Acceptance Test G PASSED: Atomicity guaranteed. Exactly one token issued among concurrent requests.");

  console.log("\n========================================================");
  console.log("ALL ACCEPTANCE TESTS A THROUGH H PASSED WITH 100% SUCCESS!");
  console.log("========================================================\n");
}

runOtpSecurityTestSuite().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
