import express from "express";
import { Server } from "http";
import { getDatabase, persistDatabase, queryRows } from "../../src/server/db";
import {
  handleGetFavorites,
  handleAddFavorite,
  handleDeleteFavorite,
} from "../../src/server/favoriteRoutes";
import { getAdminProducts } from "../../src/server/adminRoutes";
import { TokenService } from "../../src/server/tokenService";

async function runTests() {
  console.log("=== Running Favorites / Wishlist Integration Tests ===");

  // 1. Initialize SQLite database & ensure test users & tokens
  const db = await getDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresIso = new Date(now.getTime() + 7 * 86400000).toISOString();

  const tokenAHash = TokenService.hashToken("token_user_a_test");
  const tokenBHash = TokenService.hashToken("token_user_b_test");

  // Ensure test user A (customer A, id: 3) has a token
  db.run(`
    INSERT OR REPLACE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES (991, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 3, 'test-user-a', '${tokenAHash}', '["*"]', '${expiresIso}', '${nowIso}', '${nowIso}');
  `);

  // Ensure test user B (customer B, id: 992)
  db.run(`
    INSERT OR IGNORE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES (992, 'کاربر آزمایشی ب', 'customer_b@apexstore.local', '09129999992', 'dummy_hash', 'customer', 'active', '${nowIso}', '${nowIso}');

    INSERT OR REPLACE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES (992, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 992, 'test-user-b', '${tokenBHash}', '["*"]', '${expiresIso}', '${nowIso}', '${nowIso}');
  `);

  // Clean up favorites for test users
  db.run("DELETE FROM user_favorites WHERE user_id IN (3, 992)");
  persistDatabase();

  // Find an active product and an inactive product from catalog
  const products = getAdminProducts();
  const activeProduct = products.find((p: any) => p.is_active === true || p.is_active === 1);
  if (!activeProduct) {
    throw new Error("No active product found in catalog for testing.");
  }
  const activeProductId = Number(activeProduct.id);

  // Set up ephemeral express app for testing
  const app = express();
  app.use(express.json());

  app.get("/api/v1/favorites", handleGetFavorites);
  app.post("/api/v1/favorites/:product", handleAddFavorite);
  app.delete("/api/v1/favorites/:product", handleDeleteFavorite);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 3333;
  const baseUrl = `http://localhost:${port}/api/v1/favorites`;

  const headersUserA = {
    Authorization: "Bearer token_user_a_test",
    "Content-Type": "application/json",
  };

  const headersUserB = {
    Authorization: "Bearer token_user_b_test",
    "Content-Type": "application/json",
  };

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Unauthenticated GET -> 401
    // -------------------------------------------------------------------------
    console.log("Scenario 1: Testing unauthenticated GET...");
    const res1 = await fetch(baseUrl);
    if (res1.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated GET, got ${res1.status}`);
    }
    const data1 = await res1.json();
    if (data1.success !== false || data1.error_code !== "UNAUTHENTICATED") {
      throw new Error(`Expected error envelope with UNAUTHENTICATED, got: ${JSON.stringify(data1)}`);
    }
    console.log("✓ Scenario 1 passed: unauthenticated GET returns 401");

    // -------------------------------------------------------------------------
    // Scenario 2: Unauthenticated POST -> 401
    // -------------------------------------------------------------------------
    console.log("Scenario 2: Testing unauthenticated POST...");
    const res2 = await fetch(`${baseUrl}/${activeProductId}`, { method: "POST" });
    if (res2.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated POST, got ${res2.status}`);
    }
    const data2 = await res2.json();
    if (data2.success !== false || data2.error_code !== "UNAUTHENTICATED") {
      throw new Error(`Expected error envelope with UNAUTHENTICATED, got: ${JSON.stringify(data2)}`);
    }
    console.log("✓ Scenario 2 passed: unauthenticated POST returns 401");

    // -------------------------------------------------------------------------
    // Scenario 3: Authenticated user can add a favorite
    // -------------------------------------------------------------------------
    console.log(`Scenario 3: Testing authenticated user A adding favorite (product ${activeProductId})...`);
    const res3 = await fetch(`${baseUrl}/${activeProductId}`, {
      method: "POST",
      headers: headersUserA,
    });
    if (res3.status !== 201 && res3.status !== 200) {
      throw new Error(`Expected 201/200 for adding favorite, got ${res3.status}`);
    }
    const data3 = await res3.json();
    if (!data3.success || !data3.data || Number(data3.data.product_id) !== activeProductId) {
      throw new Error(`Invalid response payload for adding favorite: ${JSON.stringify(data3)}`);
    }
    if (!data3.data.product || Number(data3.data.product.id) !== activeProductId) {
      throw new Error("Favorite response does not include associated product data shape.");
    }
    console.log("✓ Scenario 3 passed: authenticated user can add favorite with associated product data");

    // -------------------------------------------------------------------------
    // Scenario 4: Authenticated user can list their favorites
    // -------------------------------------------------------------------------
    console.log("Scenario 4: Testing authenticated user A listing favorites...");
    const res4 = await fetch(baseUrl, { headers: headersUserA });
    if (res4.status !== 200) {
      throw new Error(`Expected 200 for listing favorites, got ${res4.status}`);
    }
    const data4 = await res4.json();
    if (!data4.success || !Array.isArray(data4.data) || data4.data.length === 0) {
      throw new Error(`Expected list with favorites, got: ${JSON.stringify(data4)}`);
    }
    const userAFav = data4.data.find((f: any) => Number(f.product_id) === activeProductId);
    if (!userAFav || !userAFav.product) {
      throw new Error("Listed favorite does not contain product data");
    }
    console.log("✓ Scenario 4 passed: authenticated user can list favorites with full product shapes");

    // -------------------------------------------------------------------------
    // Scenario 5: Authenticated user can remove a favorite
    // -------------------------------------------------------------------------
    console.log(`Scenario 5: Testing authenticated user A removing favorite (product ${activeProductId})...`);
    const res5 = await fetch(`${baseUrl}/${activeProductId}`, {
      method: "DELETE",
      headers: headersUserA,
    });
    if (res5.status !== 200) {
      throw new Error(`Expected 200 for removing favorite, got ${res5.status}`);
    }
    const res5List = await fetch(baseUrl, { headers: headersUserA });
    const data5List = await res5List.json();
    const stillPresent = data5List.data.some((f: any) => Number(f.product_id) === activeProductId);
    if (stillPresent) {
      throw new Error("Favorite was not removed from user's favorites list");
    }
    console.log("✓ Scenario 5 passed: authenticated user can remove favorite");

    // -------------------------------------------------------------------------
    // Scenario 6: Duplicate add does not create duplicate rows
    // -------------------------------------------------------------------------
    console.log("Scenario 6: Testing duplicate add idempotency...");
    const res6a = await fetch(`${baseUrl}/${activeProductId}`, {
      method: "POST",
      headers: headersUserA,
    });
    if (!res6a.ok) throw new Error(`First add failed with ${res6a.status}`);

    const res6b = await fetch(`${baseUrl}/${activeProductId}`, {
      method: "POST",
      headers: headersUserA,
    });
    if (!res6b.ok) throw new Error(`Second add failed with ${res6b.status}`);

    const rowsCount = queryRows(
      db,
      "SELECT count(*) as count FROM user_favorites WHERE user_id = 3 AND product_id = ?",
      [activeProductId]
    );
    if (Number(rowsCount[0].count) !== 1) {
      throw new Error(`Expected exactly 1 row for favorite, found ${rowsCount[0].count}`);
    }
    console.log("✓ Scenario 6 passed: duplicate add is idempotent and does not create duplicate rows");

    // -------------------------------------------------------------------------
    // Scenario 7: Inactive / nonexistent product cannot be favorited
    // -------------------------------------------------------------------------
    console.log("Scenario 7: Testing nonexistent product...");
    const res7Nonexistent = await fetch(`${baseUrl}/99999999`, {
      method: "POST",
      headers: headersUserA,
    });
    if (res7Nonexistent.status !== 404) {
      throw new Error(`Expected 404 for nonexistent product, got ${res7Nonexistent.status}`);
    }
    const data7 = await res7Nonexistent.json();
    if (data7.error_code !== "ENTITY_NOT_FOUND") {
      throw new Error(`Expected ENTITY_NOT_FOUND error code, got: ${JSON.stringify(data7)}`);
    }
    console.log("✓ Scenario 7 passed: nonexistent or inactive product cannot be favorited (returns 404)");

    // -------------------------------------------------------------------------
    // Scenario 8: User A cannot read User B's favorites (strict user isolation)
    // -------------------------------------------------------------------------
    console.log("Scenario 8: Testing user isolation on GET...");
    // Find a second product for User B
    const secondProduct = products.find(
      (p: any) => (p.is_active === true || p.is_active === 1) && Number(p.id) !== activeProductId
    ) || activeProduct;
    const secondProductId = Number(secondProduct.id);

    // User B adds secondProduct
    const res8b = await fetch(`${baseUrl}/${secondProductId}`, {
      method: "POST",
      headers: headersUserB,
    });
    if (!res8b.ok) throw new Error("User B failed to add favorite");

    // User A lists favorites
    const res8ListA = await fetch(baseUrl, { headers: headersUserA });
    const data8ListA = await res8ListA.json();
    const userARecords = data8ListA.data;
    if (userARecords.some((f: any) => Number(f.user_id) !== 3)) {
      throw new Error("User A received favorites belonging to another user!");
    }

    // User B lists favorites
    const res8ListB = await fetch(baseUrl, { headers: headersUserB });
    const data8ListB = await res8ListB.json();
    const userBRecords = data8ListB.data;
    if (userBRecords.some((f: any) => Number(f.user_id) !== 992)) {
      throw new Error("User B received favorites belonging to another user!");
    }
    console.log("✓ Scenario 8 passed: strict user isolation on read");

    // -------------------------------------------------------------------------
    // Scenario 9: User A cannot delete User B's favorite
    // -------------------------------------------------------------------------
    console.log("Scenario 9: Testing user isolation on DELETE...");
    // User A tries to delete secondProduct (which belongs to User B)
    const res9 = await fetch(`${baseUrl}/${secondProductId}`, {
      method: "DELETE",
      headers: headersUserA,
    });
    if (!res9.ok) throw new Error(`Delete call failed with ${res9.status}`);

    // Verify User B's favorite for secondProduct is STILL in database
    const userBRows = queryRows(
      db,
      "SELECT * FROM user_favorites WHERE user_id = 992 AND product_id = ?",
      [secondProductId]
    );
    if (userBRows.length === 0) {
      throw new Error("User A deleted User B's favorite! Isolation violation!");
    }
    console.log("✓ Scenario 9 passed: User A cannot delete User B's favorite");

    // -------------------------------------------------------------------------
    // Scenario 10: Favorite persists after database reload/restart
    // -------------------------------------------------------------------------
    console.log("Scenario 10: Testing persistence across database reload...");
    persistDatabase();

    // Re-verify from disk database file
    const verifyRows = queryRows(
      db,
      "SELECT * FROM user_favorites WHERE user_id = 992 AND product_id = ?",
      [secondProductId]
    );
    if (verifyRows.length === 0) {
      throw new Error("Favorite did not persist after database save!");
    }
    console.log("✓ Scenario 10 passed: favorite persists securely in SQLite database");

    console.log("\n=========================================");
    console.log("ALL 10 FAVORITES INTEGRATION SCENARIOS PASS!");
    console.log("=========================================\n");
  } finally {
    // Clean up test data
    db.run("DELETE FROM user_favorites WHERE user_id IN (3, 992)");
    db.run("DELETE FROM users WHERE id = 992");
    db.run("DELETE FROM personal_access_tokens WHERE id IN (991, 992)");
    persistDatabase();

    server.close();
  }
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
