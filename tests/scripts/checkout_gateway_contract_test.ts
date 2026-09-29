import express from "express";
import { Server } from "http";
import assert from "assert";
import { getDatabase, persistDatabase } from "../../src/server/db";
import {
  handleCheckout,
  handleGetCheckoutConfiguration,
  getAvailablePaymentGateways,
} from "../../src/server/orderRoutes";
import { getAdminProducts } from "../../src/server/adminRoutes";
import { TokenService } from "../../src/server/tokenService";

async function runCheckoutGatewayContractTests() {
  console.log("=== Starting Dynamic Checkout Gateway & Configuration Contract Tests ===");

  const db = await getDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresIso = new Date(now.getTime() + 7 * 86400000).toISOString();

  // Find a valid active product variant from catalog
  const catalogProducts = getAdminProducts();
  const validProduct = catalogProducts.find(
    (p: any) =>
      p.is_active &&
      p.variants?.some(
        (v: any) =>
          v.is_active &&
          Number(v.stock_quantity ?? v.inventory?.quantity ?? 0) > 10
      )
  );
  if (!validProduct)
    throw new Error("No active product with variants found in catalog");
  const validVariant = validProduct.variants.find(
    (v: any) =>
      v.is_active &&
      Number(v.stock_quantity ?? v.inventory?.quantity ?? 0) > 10
  );
  const testVariantId = validVariant.id;

  // 1. Setup test customer and token
  const testUserId = 899;
  const testUserToken = "token_checkout_gateway_test_899";
  const testUserTokenHash = TokenService.hashToken(testUserToken);

  db.run(`
    INSERT OR IGNORE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES (${testUserId}, 'تست‌کننده درگاه تسویه', 'gateway_tester@apexstore.local', '09127777899', 'dummy_hash', 'customer', 'active', '${nowIso}', '${nowIso}');

    INSERT OR REPLACE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES (${testUserId}, 'App\\\\Modules\\\\Users\\\\Models\\\\User', ${testUserId}, 'test-gateway-token', '${testUserTokenHash}', '["customer:access"]', '${expiresIso}', '${nowIso}', '${nowIso}');
  `);

  // Ensure fresh cart
  db.run(`
    DELETE FROM payments WHERE user_id = ${testUserId};
    DELETE FROM orders WHERE user_id = ${testUserId};
    DELETE FROM checkout_idempotency WHERE user_id = ${testUserId};

    INSERT OR IGNORE INTO carts (id, user_id, session_id, created_at, updated_at)
    VALUES (${testUserId}, ${testUserId}, 'session_checkout_tester_${testUserId}', '${nowIso}', '${nowIso}');

    DELETE FROM cart_items WHERE cart_id = ${testUserId};
  `);

  // Seed item in cart
  db.run(`
    INSERT INTO cart_items (cart_id, product_variant_id, quantity, created_at, updated_at)
    VALUES (${testUserId}, ${testVariantId}, 1, '${nowIso}', '${nowIso}');
  `);

  // Spin up test server
  const app = express();
  app.use(express.json());
  app.get("/api/v1/checkout/configuration", handleGetCheckoutConfiguration);
  app.post("/api/v1/checkout", handleCheckout);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Dynamic Checkout Configuration Endpoint
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Verifying GET /api/v1/checkout/configuration structure...");
    const configRes = await fetch(`${baseUrl}/api/v1/checkout/configuration`);
    assert.strictEqual(configRes.status, 200, "Checkout configuration returned 200");
    const configJson = await configRes.json();
    assert.strictEqual(configJson.success, true, "Success is true");
    const configData = configJson.data;

    assert.ok(Array.isArray(configData.gateways), "Root gateways is an array");
    assert.ok(Array.isArray(configData.payment.gateways), "Payment gateways is an array");
    assert.ok(configData.gateways.length > 0, "At least one gateway is returned");

    // Verify properties of each gateway
    for (const gw of configData.gateways) {
      assert.ok(gw.id, "Gateway has stable id");
      assert.ok(gw.name, "Gateway has name");
      assert.ok(gw.title, "Gateway has title");
      assert.ok(gw.display_label, "Gateway has display_label");
      assert.ok(gw.environment, "Gateway has environment");
      assert.ok(gw.environment_label, "Gateway has environment_label");
      assert.strictEqual(typeof gw.is_test, "boolean", "Gateway has is_test boolean");
      assert.strictEqual(gw.enabled, true, "Returned gateway is enabled");
      assert.ok(Array.isArray(gw.capabilities), "Gateway has capabilities array");

      // Verify NO secrets or merchant tokens leaked
      assert.strictEqual((gw as any).merchant, undefined, "No merchant code in gateway");
      assert.strictEqual((gw as any).merchant_id, undefined, "No merchant_id in gateway");
      assert.strictEqual((gw as any).api_key, undefined, "No api_key in gateway");
      assert.strictEqual((gw as any).secret, undefined, "No secret in gateway");
    }

    // Verify implemented gateways are present
    const gatewayIds = configData.gateways.map((g: any) => g.id);
    console.log("Returned available gateway IDs:", gatewayIds);
    assert.ok(gatewayIds.includes("zibal"), "Zibal is present in non-prod");
    assert.ok(gatewayIds.includes("wallet"), "Wallet is present");
    assert.ok(gatewayIds.includes("bank_transfer"), "Bank transfer is present");
    assert.ok(gatewayIds.includes("test"), "Test gateway is present in non-prod");

    // Verify unimplemented gateways are NOT returned
    assert.strictEqual(gatewayIds.includes("zarinpal"), false, "Zarinpal is not returned");
    assert.strictEqual(gatewayIds.includes("shaparak_test"), false, "shaparak_test is not returned");

    console.log("PASS: Configuration returns only implemented, configured gateways without leaking secrets.");

    // -------------------------------------------------------------------------
    // TEST 2: Environment Filter - Test Gateway Forbidden in Production
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Verifying test gateway is forbidden in production environment...");
    const prodGateways = getAvailablePaymentGateways(true); // force production
    const prodGatewayIds = prodGateways.map((g) => g.id);
    console.log("Production available gateways:", prodGatewayIds);
    assert.strictEqual(
      prodGatewayIds.includes("test"),
      false,
      "Test simulator gateway MUST NOT be present in production gateways"
    );
    console.log("PASS: Test simulator gateway is excluded from production environment.");

    // -------------------------------------------------------------------------
    // TEST 3: Validation - Reject Unimplemented / Unconfigured Gateways (422)
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Verifying rejection of unconfigured / unimplemented gateways...");

    // 3a. Reject zarinpal
    const zarinpalRes = await fetch(`${baseUrl}/api/v1/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testUserToken}`,
      },
      body: JSON.stringify({
        shipping_address: {
          recipient_name: "تست‌کننده درگاه",
          phone: "09127777899",
          province: "تهران",
          city: "تهران",
          postal_code: "1234567890",
          address_line: "خیابان آزادی پلاک ۱",
        },
        payment_gateway: "zarinpal",
      }),
    });
    assert.strictEqual(zarinpalRes.status, 422, "zarinpal is rejected with 422");
    const zarinpalJson = await zarinpalRes.json();
    assert.strictEqual(zarinpalJson.error_code, "INVALID_PAYMENT_GATEWAY", "Error code is INVALID_PAYMENT_GATEWAY");
    console.log("PASS: Unimplemented zarinpal rejected with 422 INVALID_PAYMENT_GATEWAY.");

    // 3b. Reject ambiguous shaparak_test
    const shaparakTestRes = await fetch(`${baseUrl}/api/v1/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testUserToken}`,
      },
      body: JSON.stringify({
        shipping_address: {
          recipient_name: "تست‌کننده درگاه",
          phone: "09127777899",
          province: "تهران",
          city: "تهران",
          postal_code: "1234567890",
          address_line: "خیابان آزادی پلاک ۱",
        },
        payment_gateway: "shaparak_test",
      }),
    });
    assert.strictEqual(shaparakTestRes.status, 422, "shaparak_test is rejected with 422");
    const shaparakTestJson = await shaparakTestRes.json();
    assert.strictEqual(shaparakTestJson.error_code, "INVALID_PAYMENT_GATEWAY", "Error code is INVALID_PAYMENT_GATEWAY");
    console.log("PASS: Ambiguous shaparak_test rejected with 422 INVALID_PAYMENT_GATEWAY.");

    // 3c. Reject completely invalid string
    const invalidGwRes = await fetch(`${baseUrl}/api/v1/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testUserToken}`,
      },
      body: JSON.stringify({
        shipping_address: {
          recipient_name: "تست‌کننده درگاه",
          phone: "09127777899",
          province: "تهران",
          city: "تهران",
          postal_code: "1234567890",
          address_line: "خیابان آزادی پلاک ۱",
        },
        payment_gateway: "non_existent_gateway_xyz",
      }),
    });
    assert.strictEqual(invalidGwRes.status, 422, "Invalid gateway is rejected with 422");
    console.log("PASS: Arbitrary non-existent gateway rejected with 422.");

    // -------------------------------------------------------------------------
    // TEST 4: Successful Order with Test Gateway in Non-Production
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Verifying successful order with 'test' simulator in non-prod...");
    // Re-seed cart item
    db.run(`
      DELETE FROM cart_items WHERE cart_id = ${testUserId};
      INSERT INTO cart_items (cart_id, product_variant_id, quantity, created_at, updated_at)
      VALUES (${testUserId}, ${testVariantId}, 1, '${now}', '${now}');
    `);

    const testCheckoutRes = await fetch(`${baseUrl}/api/v1/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testUserToken}`,
      },
      body: JSON.stringify({
        shipping_address: {
          recipient_name: "تست‌کننده درگاه",
          phone: "09127777899",
          province: "تهران",
          city: "تهران",
          postal_code: "1234567890",
          address_line: "خیابان آزادی پلاک ۱",
        },
        payment_gateway: "test",
        idempotency_key: "idemp_test_gateway_001",
      }),
    });

    assert.strictEqual(testCheckoutRes.status, 201, "Checkout with test gateway succeeded with 201");
    const testCheckoutJson = await testCheckoutRes.json();
    assert.strictEqual(testCheckoutJson.success, true, "Order succeeded");
    assert.ok(testCheckoutJson.data.payment_intent, "payment_intent is present");
    assert.strictEqual(
      testCheckoutJson.data.payment_intent.gateway,
      "test",
      "payment_intent.gateway is exactly 'test'"
    );

    // Verify database record
    const createdOrderId = testCheckoutJson.data.id;
    const paymentRows = (db as any).exec(
      `SELECT gateway, amount, status FROM payments WHERE order_id = ${createdOrderId}`
    );
    assert.ok(paymentRows.length > 0 && paymentRows[0].values.length > 0, "Payment record exists in DB");
    assert.strictEqual(paymentRows[0].values[0][0], "test", "Database payments.gateway is 'test'");
    console.log("PASS: Order created and payment_intent gateway matches database payment gateway ('test').");

    // -------------------------------------------------------------------------
    // TEST 5: Authoritative Server Calculations (Client cannot tamper)
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Verifying server calculates all totals (ignoring client tamper)...");
    db.run(`
      DELETE FROM cart_items WHERE cart_id = ${testUserId};
      INSERT INTO cart_items (cart_id, product_variant_id, quantity, created_at, updated_at)
      VALUES (${testUserId}, ${testVariantId}, 2, '${now}', '${now}');
    `);

    const tamperRes = await fetch(`${baseUrl}/api/v1/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testUserToken}`,
      },
      body: JSON.stringify({
        shipping_address: {
          recipient_name: "تست‌کننده درگاه",
          phone: "09127777899",
          province: "تهران",
          city: "تهران",
          postal_code: "1234567890",
          address_line: "خیابان آزادی پلاک ۱",
        },
        payment_gateway: "bank_transfer",
        // Malicious client tampering:
        subtotal: 100,
        grand_total: 100,
        amount: 100,
        shipping_total: 0,
        idempotency_key: "idemp_tamper_test_002",
      }),
    });

    assert.strictEqual(tamperRes.status, 201, "Checkout with bank_transfer succeeded with 201");
    const tamperJson = await tamperRes.json();
    // Expected: subtotal is 2 * effective price, NOT 100
    assert.ok(tamperJson.data.subtotal >= 1000000, "Server calculated subtotal authoritatively");
    assert.ok(tamperJson.data.grand_total >= 1000000, "Server calculated grand_total authoritatively");
    assert.strictEqual(
      tamperJson.data.payment_intent.gateway,
      "bank_transfer",
      "payment_intent.gateway is exactly 'bank_transfer'"
    );
    console.log("PASS: Server-calculated totals strictly override client tampering.");

    console.log("\n=== ALL CHECKOUT GATEWAY CONTRACT TESTS PASSED SUCCESSFULLY! ===");
  } finally {
    server.close();
  }
}

runCheckoutGatewayContractTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
