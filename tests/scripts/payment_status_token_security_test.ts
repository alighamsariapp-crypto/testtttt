import crypto from "crypto";
import {
  generatePaymentStatusToken,
  verifyPaymentStatusToken,
  getPaymentStatusSigningKey,
  getPaymentStatusCandidateKeys,
} from "../../src/server/services/paymentStatusTokenService";

async function runPaymentStatusTokenSecurityTests() {
  console.log("=== Starting Payment Status Token Security & Invariant Tests ===");

  const originalAppKey = process.env.APP_KEY;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPreviousKeys = process.env.APP_PREVIOUS_KEYS;

  const validKey = "base64:zP7F+6U556w3Fp6x856vT6l6L9k5z5f6G7h8j9k0l1m=";

  try {
    // -------------------------------------------------------------------------
    // Test 1: Missing APP_KEY in production throws clear security fatal error
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Missing APP_KEY in production...");
    process.env.NODE_ENV = "production";
    delete process.env.APP_KEY;
    delete process.env.PAYMENT_STATUS_TOKEN_SECRET;
    delete process.env.JWT_SECRET;

    let threwMissingProd = false;
    try {
      getPaymentStatusSigningKey();
    } catch (e: any) {
      threwMissingProd = true;
      if (!e.message.includes("[SECURITY FATAL] APP_KEY is missing")) {
        throw new Error(`Unexpected error message: ${e.message}`);
      }
    }
    if (!threwMissingProd) {
      throw new Error("Expected getPaymentStatusSigningKey() to throw when APP_KEY is missing in production!");
    }
    console.log("✓ Correctly threw fatal error when APP_KEY was missing in production.");

    // -------------------------------------------------------------------------
    // Test 2: Insecure placeholders are rejected
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Insecure placeholder rejection...");
    const placeholders = [
      "apexstore-fallback",
      "CHANGEME",
      "base64:CHANGEME",
      "SomeRandomString",
      "YOUR_APP_KEY",
      "secret",
    ];

    for (const ph of placeholders) {
      process.env.APP_KEY = ph;
      let threwPlaceholder = false;
      try {
        getPaymentStatusSigningKey();
      } catch (e: any) {
        threwPlaceholder = true;
        if (!e.message.includes("[SECURITY FATAL]")) {
          throw new Error(`Unexpected error for placeholder ${ph}: ${e.message}`);
        }
      }
      if (!threwPlaceholder) {
        throw new Error(`Expected placeholder '${ph}' to be rejected!`);
      }
    }
    console.log("✓ All forbidden placeholders and default secrets were rejected.");

    // -------------------------------------------------------------------------
    // Test 3: Short or malformed keys are rejected
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Short/malformed keys rejection...");
    process.env.APP_KEY = "too-short-key";
    let threwShort = false;
    try {
      getPaymentStatusSigningKey();
    } catch (e: any) {
      threwShort = true;
    }
    if (!threwShort) {
      throw new Error("Expected short APP_KEY to be rejected!");
    }
    console.log("✓ Short APP_KEY rejected.");

    // -------------------------------------------------------------------------
    // Test 4: Valid APP_KEY enables signing and verification
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Valid APP_KEY token generation & verification...");
    process.env.APP_KEY = validKey;
    delete process.env.APP_PREVIOUS_KEYS;

    const token = generatePaymentStatusToken(501, "ORD-501", 10, 1800);
    if (!token || !token.includes(".")) {
      throw new Error(`Generated token format invalid: ${token}`);
    }

    const payload = verifyPaymentStatusToken(token, 501, "ORD-501");
    if (!payload || payload.order_id !== 501 || payload.order_number !== "ORD-501" || payload.user_id !== 10) {
      throw new Error(`Token verification failed with valid key: ${JSON.stringify(payload)}`);
    }
    console.log("✓ Token generation and verification succeeded with valid key.");

    // -------------------------------------------------------------------------
    // Test 5: Tampered signature rejection
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Tampered signature rejection...");
    const [b64, sig] = token.split(".");
    const tamperedSig = sig.slice(0, -4) + "0000";
    const tamperedToken = `${b64}.${tamperedSig}`;
    const resultTamperedSig = verifyPaymentStatusToken(tamperedToken, 501, "ORD-501");
    if (resultTamperedSig !== null) {
      throw new Error("Tampered signature was accepted!");
    }
    console.log("✓ Tampered signature rejected.");

    // -------------------------------------------------------------------------
    // Test 6: Tampered payload rejection
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Tampered payload rejection...");
    const forgedPayload = {
      order_id: 999,
      order_number: "ORD-999",
      user_id: 10,
      purpose: "payment_status",
      exp: Math.floor(Date.now() / 1000) + 1800,
      nonce: "1234567890abcdef",
    };
    const forgedB64 = Buffer.from(JSON.stringify(forgedPayload), "utf-8").toString("base64url");
    const forgedToken = `${forgedB64}.${sig}`;
    const resultTamperedPayload = verifyPaymentStatusToken(forgedToken, 999, "ORD-999");
    if (resultTamperedPayload !== null) {
      throw new Error("Tampered payload with original signature was accepted!");
    }
    console.log("✓ Tampered payload rejected.");

    // -------------------------------------------------------------------------
    // Test 7: Expired token rejection
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Expired token rejection...");
    const expiredToken = generatePaymentStatusToken(502, "ORD-502", 10, -60); // Expired 60s ago
    const resultExpired = verifyPaymentStatusToken(expiredToken, 502, "ORD-502");
    if (resultExpired !== null) {
      throw new Error("Expired token was accepted!");
    }
    console.log("✓ Expired token rejected.");

    // -------------------------------------------------------------------------
    // Test 8: Order ID / order number mismatch rejection
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Order identifier mismatch rejection...");
    const resultMismatchId = verifyPaymentStatusToken(token, 9999, "ORD-501");
    if (resultMismatchId !== null) {
      throw new Error("Mismatched order ID was accepted!");
    }
    const resultMismatchNumber = verifyPaymentStatusToken(token, 501, "ORD-WRONG");
    if (resultMismatchNumber !== null) {
      throw new Error("Mismatched order number was accepted!");
    }
    console.log("✓ Mismatched order identifiers correctly rejected.");

    // -------------------------------------------------------------------------
    // Test 9: Graceful key rotation with candidate previous keys
    // -------------------------------------------------------------------------
    console.log("\n[Test 9] Graceful key rotation with previous keys...");
    const oldKey = validKey;
    const newKey = "base64:dGVzdG5ld2tleWZvcmFwcHNlY3VyaXR5MTIzNDU2Nzg5MDEy";

    // Token generated under old key
    process.env.APP_KEY = oldKey;
    delete process.env.APP_PREVIOUS_KEYS;
    const preRotationToken = generatePaymentStatusToken(503, "ORD-503", 10, 1800);

    // Rotate to new key, adding old key to APP_PREVIOUS_KEYS
    process.env.APP_KEY = newKey;
    process.env.APP_PREVIOUS_KEYS = oldKey;

    const rotatedVerifySuccess = verifyPaymentStatusToken(preRotationToken, 503, "ORD-503");
    if (!rotatedVerifySuccess || rotatedVerifySuccess.order_id !== 503) {
      throw new Error("Key rotation verification failed! Old token should be valid under APP_PREVIOUS_KEYS.");
    }

    // Now remove old key from previous keys; verification MUST fail
    delete process.env.APP_PREVIOUS_KEYS;
    const rotatedVerifyFail = verifyPaymentStatusToken(preRotationToken, 503, "ORD-503");
    if (rotatedVerifyFail !== null) {
      throw new Error("Token signed with old key was accepted without previous_keys configured!");
    }
    console.log("✓ Key rotation successfully allowed pre-rotation token via APP_PREVIOUS_KEYS and rejected without it.");

    console.log("\n============================================================");
    console.log("🎉 ALL PAYMENT STATUS TOKEN SECURITY TESTS PASSED!");
    console.log("============================================================\n");
  } finally {
    if (originalAppKey !== undefined) {
      process.env.APP_KEY = originalAppKey;
    } else {
      delete process.env.APP_KEY;
    }
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalPreviousKeys !== undefined) {
      process.env.APP_PREVIOUS_KEYS = originalPreviousKeys;
    } else {
      delete process.env.APP_PREVIOUS_KEYS;
    }
  }
}

runPaymentStatusTokenSecurityTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
