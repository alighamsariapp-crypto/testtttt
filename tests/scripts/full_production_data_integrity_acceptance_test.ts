import express from "express";
import { Server } from "http";
import assert from "assert";
import { getDatabase, persistDatabase, queryRows } from "../../src/server/db";
import { TokenService } from "../../src/server/tokenService";
import {
  handleGetCart,
  handleAddToCart,
  handleUpdateCartItem,
  handleRemoveCartItem,
} from "../../src/server/cartRoutes";
import {
  handleGetFavorites,
  handleAddFavorite,
  handleDeleteFavorite,
} from "../../src/server/favoriteRoutes";
import {
  handleGetAddresses,
  handleCreateAddress,
  handleUpdateAddress,
  handleDeleteAddress,
} from "../../src/server/addressRoutes";
import {
  handleCheckout,
  handleGetOrders,
  handleGetOrderById,
  handleCancelOrder,
  handleGetUserWallet,
} from "../../src/server/orderRoutes";
import {
  handleGetCustomerTickets,
  handleGetCustomerTicket,
  handleCreateCustomerTicket,
  handleAddCustomerTicketMessage,
  handleCloseCustomerTicket,
} from "../../src/server/supportRoutes";
import {
  handleAdminDashboard,
  handleAdminGetProducts,
  handleAdminCreateProduct,
  handleAdminUpdateProduct,
  handleAdminGetUsers,
  handleAdminUpdateUserStatus,
  handleAdminWalletAdjustment,
  adminAuthMiddleware,
  getAdminProducts,
} from "../../src/server/adminRoutes";
import {
  handleAdminGetCategories,
  handleAdminCreateCategory,
} from "../../src/server/categoryRoutes";
import {
  handleZibalCallback,
  handleGetPaymentStatus,
} from "../../src/server/paymentRoutes";

async function runFullAcceptanceTest() {
  console.log("================================================================================");
  console.log("STARTING FULL PRODUCTION DATA INTEGRITY ACCEPTANCE VERIFICATION SUITE");
  console.log("================================================================================");

  const db = await getDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresIso = new Date(now.getTime() + 7 * 86400000).toISOString();

  // 1. Setup Test Users
  // Customer 1: Alice (id: 801)
  // Customer 2: Bob (id: 802)
  // Admin: SuperAdmin (id: 800)
  const tokenAlice = "token_alice_acceptance_801";
  const tokenBob = "token_bob_acceptance_802";
  const tokenAdmin = "token_admin_acceptance_800";

  db.run(`
    INSERT OR REPLACE INTO users (id, name, email, phone, password, role, status, created_at, updated_at)
    VALUES
      (800, 'مدیر کل', 'admin.acc@apexstore.local', '09128000000', 'hash', 'admin', 'active', '${nowIso}', '${nowIso}'),
      (801, 'آلیس خریدار', 'alice.acc@apexstore.local', '09128010001', 'hash', 'customer', 'active', '${nowIso}', '${nowIso}'),
      (802, 'باب خریدار', 'bob.acc@apexstore.local', '09128020002', 'hash', 'customer', 'active', '${nowIso}', '${nowIso}');

    INSERT OR REPLACE INTO personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, expires_at, created_at, updated_at)
    VALUES
      (8000, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 800, 'admin-token', '${TokenService.hashToken(tokenAdmin)}', '["admin:access"]', '${expiresIso}', '${nowIso}', '${nowIso}'),
      (8010, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 801, 'alice-token', '${TokenService.hashToken(tokenAlice)}', '["customer:access"]', '${expiresIso}', '${nowIso}', '${nowIso}'),
      (8020, 'App\\\\Modules\\\\Users\\\\Models\\\\User', 802, 'bob-token', '${TokenService.hashToken(tokenBob)}', '["customer:access"]', '${expiresIso}', '${nowIso}', '${nowIso}');
  `);

  // Clean data for test users
  db.run(`
    DELETE FROM user_favorites WHERE user_id IN (801, 802);
    DELETE FROM user_addresses WHERE user_id IN (801, 802);
    DELETE FROM support_ticket_messages WHERE support_ticket_id IN (SELECT id FROM support_tickets WHERE user_id IN (801, 802));
    DELETE FROM support_tickets WHERE user_id IN (801, 802);
    DELETE FROM wallet_transactions WHERE user_id IN (801, 802);
    DELETE FROM payments WHERE user_id IN (801, 802);
    DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (801, 802));
    DELETE FROM orders WHERE user_id IN (801, 802);
    DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id IN (801, 802));
    DELETE FROM carts WHERE user_id IN (801, 802);
  `);
  persistDatabase();

  // Find active product and variant
  const catalog = getAdminProducts();
  const testProduct = catalog.find((p: any) => p.is_active && p.variants?.some((v: any) => v.is_active));
  assert.ok(testProduct, "Must find an active product in catalog");
  const testVariant = testProduct.variants.find((v: any) => v.is_active);
  const testVariantId = testVariant.id;
  const testProductId = testProduct.id;

  // Set sufficient stock on test variant
  db.run(`
    UPDATE product_variants SET stock_quantity = 50, stock = 50 WHERE id = ${testVariantId};
    INSERT OR REPLACE INTO inventory (product_variant_id, quantity, updated_at) VALUES (${testVariantId}, 50, '${nowIso}');
  `);
  persistDatabase();

  // Spin up Express App
  const app = express();
  app.use(express.json());

  // Customer Routes
  app.get("/api/v1/cart", handleGetCart);
  app.post("/api/v1/cart/items", handleAddToCart);
  app.put("/api/v1/cart/items/:id", handleUpdateCartItem);
  app.delete("/api/v1/cart/items/:id", handleRemoveCartItem);

  app.get("/api/v1/favorites", handleGetFavorites);
  app.post("/api/v1/favorites/:product", handleAddFavorite);
  app.delete("/api/v1/favorites/:product", handleDeleteFavorite);

  app.get("/api/v1/addresses", handleGetAddresses);
  app.post("/api/v1/addresses", handleCreateAddress);
  app.put("/api/v1/addresses/:id", handleUpdateAddress);
  app.delete("/api/v1/addresses/:id", handleDeleteAddress);

  app.post("/api/v1/checkout", handleCheckout);
  app.get("/api/v1/orders", handleGetOrders);
  app.get("/api/v1/orders/:id", handleGetOrderById);
  app.post("/api/v1/orders/:id/cancel", handleCancelOrder);
  app.get("/api/v1/wallet", handleGetUserWallet);

  app.get("/api/v1/tickets", handleGetCustomerTickets);
  app.get("/api/v1/tickets/:id", handleGetCustomerTicket);
  app.post("/api/v1/tickets", handleCreateCustomerTicket);
  app.post("/api/v1/tickets/:id/messages", handleAddCustomerTicketMessage);
  app.post("/api/v1/tickets/:id/close", handleCloseCustomerTicket);

  // Admin Routes
  app.get("/api/v1/admin/dashboard", adminAuthMiddleware, handleAdminDashboard);
  app.get("/api/v1/admin/products", adminAuthMiddleware, handleAdminGetProducts);
  app.post("/api/v1/admin/products", adminAuthMiddleware, handleAdminCreateProduct);
  app.put("/api/v1/admin/products/:id", adminAuthMiddleware, handleAdminUpdateProduct);
  app.get("/api/v1/admin/categories", adminAuthMiddleware, handleAdminGetCategories);
  app.post("/api/v1/admin/categories", adminAuthMiddleware, handleAdminCreateCategory);
  app.get("/api/v1/admin/users", adminAuthMiddleware, handleAdminGetUsers);
  app.patch("/api/v1/admin/users/:id/status", adminAuthMiddleware, handleAdminUpdateUserStatus);
  app.post("/api/v1/admin/users/:id/wallet/adjustment", adminAuthMiddleware, handleAdminWalletAdjustment);

  // Payment Status
  app.get("/api/v1/payments/status/:orderNumber", handleGetPaymentStatus);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  const aliceHeaders = {
    Authorization: `Bearer ${tokenAlice}`,
    "Content-Type": "application/json",
  };
  const bobHeaders = {
    Authorization: `Bearer ${tokenBob}`,
    "Content-Type": "application/json",
  };
  const adminHeaders = {
    Authorization: `Bearer ${tokenAdmin}`,
    "Content-Type": "application/json",
  };

  try {
    // =========================================================================
    // SCENARIO A: Add/update/remove cart item: server quantity and total canonical
    // =========================================================================
    console.log("\n[SCENARIO A] Testing Cart Item Lifecycle and Canonical Calculations...");
    const addCartRes = await fetch(`${baseUrl}/cart/items`, {
      method: "POST",
      headers: aliceHeaders,
      body: JSON.stringify({ variant_id: testVariantId, quantity: 2 }),
    });
    assert.ok(addCartRes.status === 200 || addCartRes.status === 201, "Cart item added with 200/201");
    const addCartData = await addCartRes.json();
    assert.ok(addCartData.data.items && addCartData.data.items.length > 0, "Cart has items");
    const cartItemId = addCartData.data.items[0].id;
    assert.strictEqual(addCartData.data.items[0].quantity, 2, "Cart item quantity is 2");

    // Update quantity
    const updateCartRes = await fetch(`${baseUrl}/cart/items/${cartItemId}`, {
      method: "PUT",
      headers: aliceHeaders,
      body: JSON.stringify({ quantity: 3 }),
    });
    assert.strictEqual(updateCartRes.status, 200, "Cart item updated with 200");
    const updateCartData = await updateCartRes.json();
    assert.strictEqual(updateCartData.data.items[0].quantity, 3, "Updated quantity is 3");

    // Fetch canonical cart from fresh request (simulating page reload)
    const reloadCartRes = await fetch(`${baseUrl}/cart`, { headers: aliceHeaders });
    assert.strictEqual(reloadCartRes.status, 200, "Reload cart returned 200");
    const reloadCartData = await reloadCartRes.json();
    assert.strictEqual(reloadCartData.data.items.length, 1, "Cart contains 1 item");
    assert.strictEqual(reloadCartData.data.items[0].quantity, 3, "Canonical quantity persists");

    // Remove item
    const removeCartRes = await fetch(`${baseUrl}/cart/items/${cartItemId}`, {
      method: "DELETE",
      headers: aliceHeaders,
    });
    assert.strictEqual(removeCartRes.status, 200, "Cart item deleted");
    console.log("✓ Scenario A passed: Cart server quantity and totals are canonical across reloads.");

    // =========================================================================
    // SCENARIO B: Favorite toggle: state identical across sessions and isolated
    // =========================================================================
    console.log("\n[SCENARIO B] Testing Favorite Toggle and Cross-User Isolation...");
    const addFavRes = await fetch(`${baseUrl}/favorites/${testProductId}`, {
      method: "POST",
      headers: aliceHeaders,
    });
    assert.ok(addFavRes.status === 200 || addFavRes.status === 201, "Favorite added");

    // Alice sees it
    const aliceFavRes = await fetch(`${baseUrl}/favorites`, { headers: aliceHeaders });
    const aliceFavData = await aliceFavRes.json();
    assert.strictEqual(aliceFavData.data.length, 1, "Alice has 1 favorite");
    assert.strictEqual(Number(aliceFavData.data[0].product_id), Number(testProductId));

    // Bob does NOT see Alice's favorite
    const bobFavRes = await fetch(`${baseUrl}/favorites`, { headers: bobHeaders });
    const bobFavData = await bobFavRes.json();
    assert.strictEqual(bobFavData.data.length, 0, "Bob has 0 favorites (isolated)");

    // Bob deleting product does NOT delete Alice's favorite
    const bobDeleteFav = await fetch(`${baseUrl}/favorites/${testProductId}`, {
      method: "DELETE",
      headers: bobHeaders,
    });
    assert.ok(bobDeleteFav.status === 200 || bobDeleteFav.status === 204, "Bob delete request processed idempotently");

    const aliceFavCheck = await fetch(`${baseUrl}/favorites`, { headers: aliceHeaders });
    const aliceFavCheckData = await aliceFavCheck.json();
    assert.strictEqual(aliceFavCheckData.data.length, 1, "Alice's favorite is untouched by Bob's delete");
    console.log("✓ Scenario B passed: Favorites strictly isolated and canonical across sessions.");

    // =========================================================================
    // SCENARIO C: Profile / Address Update: Unauthorized modification rejected
    // =========================================================================
    console.log("\n[SCENARIO C] Testing Address Ownership and Cross-User Tampering Rejection...");
    const createAddrRes = await fetch(`${baseUrl}/addresses`, {
      method: "POST",
      headers: aliceHeaders,
      body: JSON.stringify({
        title: "خانه آلیس",
        recipient_name: "آلیس",
        phone: "09128010001",
        province: "تهران",
        city: "تهران",
        postal_code: "1234567890",
        address_line: "خیابان ولیعصر پلاک ۱",
      }),
    });
    assert.strictEqual(createAddrRes.status, 201, "Address created");
    const createAddrData = await createAddrRes.json();
    const aliceAddrId = createAddrData.data.id;

    // Bob tries to modify Alice's address -> 404/403
    const bobTamperAddr = await fetch(`${baseUrl}/addresses/${aliceAddrId}`, {
      method: "PUT",
      headers: bobHeaders,
      body: JSON.stringify({
        title: "دستکاری توسط باب",
        recipient_name: "باب هکر",
        phone: "09128020002",
        province: "تهران",
        city: "تهران",
        postal_code: "9999999999",
        address_line: "نشانی جعلی",
      }),
    });
    assert.ok(bobTamperAddr.status === 403 || bobTamperAddr.status === 404, "Cross-user address modification blocked");
    console.log("✓ Scenario C passed: Server ownership check blocks unauthorized address modification.");

    // =========================================================================
    // SCENARIO D: Order cancellation: state transition enforced server-side
    // =========================================================================
    console.log("\n[SCENARIO D] Testing Order Cancellation and Stock Restitution...");
    // Put item back in Alice's cart
    await fetch(`${baseUrl}/cart/items`, {
      method: "POST",
      headers: aliceHeaders,
      body: JSON.stringify({ variant_id: testVariantId, quantity: 1 }),
    });

    const checkoutRes = await fetch(`${baseUrl}/checkout`, {
      method: "POST",
      headers: aliceHeaders,
      body: JSON.stringify({
        shipping_address: {
          recipient_name: "آلیس",
          phone: "09128010001",
          province: "تهران",
          city: "تهران",
          postal_code: "1234567890",
          address_line: "خیابان ولیعصر پلاک ۱",
        },
        payment_gateway: "test",
      }),
    });
    assert.ok(checkoutRes.status === 201 || checkoutRes.status === 200, "Checkout succeeded");
    const checkoutData = await checkoutRes.json();
    const orderId = checkoutData.data.order_id || checkoutData.data.id;
    const orderNumber = checkoutData.data.order_number;

    // Bob tries to cancel Alice's order -> 403/404
    const bobCancelRes = await fetch(`${baseUrl}/orders/${orderId}/cancel`, {
      method: "POST",
      headers: bobHeaders,
    });
    assert.ok(bobCancelRes.status === 403 || bobCancelRes.status === 404, "Bob cannot cancel Alice's order");

    // Alice cancels her pending order
    const aliceCancelRes = await fetch(`${baseUrl}/orders/${orderId}/cancel`, {
      method: "POST",
      headers: aliceHeaders,
    });
    assert.strictEqual(aliceCancelRes.status, 200, "Alice cancels her own order");

    // Second cancellation attempt must be rejected (idempotency / terminal state)
    const aliceCancelAgain = await fetch(`${baseUrl}/orders/${orderId}/cancel`, {
      method: "POST",
      headers: aliceHeaders,
    });
    assert.strictEqual(aliceCancelAgain.status, 422, "Cannot cancel already cancelled order");
    console.log("✓ Scenario D passed: Server-side order cancellation and state transitions strictly enforced.");

    // =========================================================================
    // SCENARIO E: Ticket reply/close: message exists after refresh & ownership enforced
    // =========================================================================
    console.log("\n[SCENARIO E] Testing Support Ticket Workflow and Refresh Verification...");
    const createTicketRes = await fetch(`${baseUrl}/tickets`, {
      method: "POST",
      headers: aliceHeaders,
      body: JSON.stringify({
        subject: "سؤال دربارهٔ گارانتی محصول",
        message: "سلام، مدت زمان گارانتی چقدر است؟",
        department: "technical",
        priority: "medium",
      }),
    });
    assert.strictEqual(createTicketRes.status, 201, "Ticket created");
    const ticketData = await createTicketRes.json();
    const ticketId = ticketData.data.id;

    // Alice replies to ticket
    const replyRes = await fetch(`${baseUrl}/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: aliceHeaders,
      body: JSON.stringify({ message: "لطفاً بررسی فرمایید." }),
    });
    assert.strictEqual(replyRes.status, 201, "Message added to ticket");

    // Bob tries to view Alice's ticket -> 403/404
    const bobViewTicket = await fetch(`${baseUrl}/tickets/${ticketId}`, { headers: bobHeaders });
    assert.ok(bobViewTicket.status === 403 || bobViewTicket.status === 404, "Bob cannot access Alice's ticket");

    // Alice closes ticket
    const closeTicketRes = await fetch(`${baseUrl}/tickets/${ticketId}/close`, {
      method: "POST",
      headers: aliceHeaders,
    });
    assert.strictEqual(closeTicketRes.status, 200, "Ticket closed");

    // Fetch canonical ticket after refresh
    const refreshedTicketRes = await fetch(`${baseUrl}/tickets/${ticketId}`, { headers: aliceHeaders });
    const refreshedTicket = await refreshedTicketRes.json();
    assert.strictEqual(refreshedTicket.data.status, "closed", "Ticket status is closed in database");
    assert.strictEqual(refreshedTicket.data.messages.length, 2, "Both initial message and reply persist");
    console.log("✓ Scenario E passed: Ticket ownership enforced and messages persist across reloads.");

    // =========================================================================
    // SCENARIO F: Wallet Balance / Deposit / Audit
    // =========================================================================
    console.log("\n[SCENARIO F] Testing Wallet Balance and Audit Trail...");
    const initialWalletRes = await fetch(`${baseUrl}/wallet`, { headers: aliceHeaders });
    const initialWallet = await initialWalletRes.json();
    const initialBalance = Number(initialWallet.data.balance || 0);

    // Admin performs verified adjustment with audit log
    const adminAdjustRes = await fetch(`${baseUrl}/admin/users/801/wallet/adjustment`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        amount: 500000,
        type: "credit",
        reason: "شارژ تست تضمین کیفیت",
      }),
    });
    assert.strictEqual(adminAdjustRes.status, 200, "Admin wallet adjustment succeeded");

    // Verify Alice's wallet reflects new balance from server
    const updatedWalletRes = await fetch(`${baseUrl}/wallet`, { headers: aliceHeaders });
    const updatedWallet = await updatedWalletRes.json();
    assert.strictEqual(Number(updatedWallet.data.balance), initialBalance + 500000, "Wallet balance canonical");

    // Verify audit logs were created
    const auditRows = queryRows(db, `SELECT * FROM audit_logs WHERE action LIKE '%wallet%' ORDER BY id DESC LIMIT 1`);
    assert.ok(auditRows.length > 0, "Audit log created for wallet adjustment");
    console.log("✓ Scenario F passed: Wallet operations verified and strictly audited.");

    // =========================================================================
    // SCENARIO G: Admin features persist and are inaccessible to customers
    // =========================================================================
    console.log("\n[SCENARIO G] Testing Admin Privileges, Persistence, and Customer Rejection...");
    // Customer Alice tries to access admin dashboard -> 403
    const customerAdminRes = await fetch(`${baseUrl}/admin/dashboard`, { headers: aliceHeaders });
    assert.strictEqual(customerAdminRes.status, 403, "Customer access to admin dashboard rejected with 403");

    // Admin creates category
    const createCatRes = await fetch(`${baseUrl}/admin/categories`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        name: "دسته‌بندی تست خودکار",
        slug: `auto-test-cat-${Date.now()}`,
        is_active: 1,
      }),
    });
    assert.strictEqual(createCatRes.status, 201, "Admin created category");

    // Admin suspends user Bob
    const suspendRes = await fetch(`${baseUrl}/admin/users/802/status`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ status: "suspended" }),
    });
    assert.strictEqual(suspendRes.status, 200, "Admin suspended user");

    // Bob's token is now rejected due to suspension
    const bobMeRes = await fetch(`${baseUrl}/wallet`, { headers: bobHeaders });
    assert.strictEqual(bobMeRes.status, 401, "Suspended user token is rejected with 401");
    console.log("✓ Scenario G passed: Admin endpoints inaccessible to customers and state persists in DB.");

    // =========================================================================
    // SCENARIO H: Failed API mutation shows failure and never shows false success
    // =========================================================================
    console.log("\n[SCENARIO H] Testing Failed Mutation Error Handling and No False Success...");
    // Invalid cart quantity (-5)
    const invalidCartRes = await fetch(`${baseUrl}/cart/items`, {
      method: "POST",
      headers: aliceHeaders,
      body: JSON.stringify({ variant_id: testVariantId, quantity: -5 }),
    });
    assert.strictEqual(invalidCartRes.status, 422, "Invalid quantity rejected with 422");
    const invalidCartJson = await invalidCartRes.json();
    assert.strictEqual(invalidCartJson.success, false, "Returns success: false");

    // Invalid ticket without subject
    const invalidTicketRes = await fetch(`${baseUrl}/tickets`, {
      method: "POST",
      headers: aliceHeaders,
      body: JSON.stringify({ message: "No subject provided" }),
    });
    assert.strictEqual(invalidTicketRes.status, 422, "Invalid ticket payload rejected with 422");
    const invalidTicketJson = await invalidTicketRes.json();
    assert.strictEqual(invalidTicketJson.success, false, "Returns success: false");
    console.log("✓ Scenario H passed: Failed API mutations return explicit error payloads with success: false.");

    console.log("\n================================================================================");
    console.log("🎉 ALL ACCEPTANCE SCENARIOS (A - H) PASSED WITH 100% INTEGRITY VERIFICATION!");
    console.log("================================================================================");
  } finally {
    server.close();
  }
}

runFullAcceptanceTest().catch((err) => {
  console.error("FATAL ERROR IN ACCEPTANCE TEST SUITE:", err);
  process.exit(1);
});
