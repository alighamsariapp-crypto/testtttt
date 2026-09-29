import { Request, Response } from "express";
import { getDatabase, getDatabaseSync, persistDatabase, queryRows, formatProductFromDb } from "./db";
import { authenticateToken } from "./authRoutes";

export function findProductAndVariant(variantOrProductId: number, dbParam?: any): { product: any; variant: any } | null {
  const db = dbParam || getDatabaseSync();
  if (!db) {
    return null;
  }
  const targetId = Number(variantOrProductId);
  if (!targetId || isNaN(targetId)) return null;

  // 1. First, search in SQLite product_variants table
  const variantRows = queryRows(
    db,
    `SELECT pv.*, 
            COALESCE(i.quantity, pv.stock_quantity, pv.stock, 0) as inv_quantity,
            COALESCE(i.reserved_quantity, 0) as inv_reserved,
            COALESCE(i.safety_threshold, 0) as inv_safety
     FROM product_variants pv
     LEFT JOIN inventory i ON i.product_variant_id = pv.id
     WHERE pv.id = ?
     LIMIT 1`,
    [targetId]
  );

  if (variantRows.length > 0) {
    const vRow = variantRows[0];
    const productId = Number(vRow.product_id);
    const pRows = queryRows(db, "SELECT * FROM products WHERE id = ? LIMIT 1", [productId]);
    if (pRows.length > 0) {
      const product = formatProductFromDb(db, pRows[0]);
      const variant = product.variants.find((v: any) => Number(v.id) === targetId) || {
        id: Number(vRow.id),
        product_id: productId,
        name: String(vRow.name || "استاندارد"),
        sku: String(vRow.sku || `SKU-${vRow.id}`),
        price_override: vRow.price_override !== null ? Number(vRow.price_override) : null,
        original_price: Number(vRow.original_price ?? product.base_price),
        discount_price: vRow.discount_price !== null ? Number(vRow.discount_price) : null,
        discount_percent: vRow.discount_percent !== null ? Number(vRow.discount_percent) : null,
        discount_percentage: vRow.discount_percent !== null ? Number(vRow.discount_percent) : null,
        price: Number(vRow.price ?? vRow.effective_price ?? product.effective_price),
        effective_price: Number(vRow.effective_price ?? vRow.price ?? product.effective_price),
        stock_quantity: Number(vRow.inv_quantity),
        stock: Number(vRow.inv_quantity),
        inventory: {
          quantity: Number(vRow.inv_quantity),
          reserved_quantity: Number(vRow.inv_reserved),
          safety_threshold: Number(vRow.inv_safety),
        },
        is_active: Boolean(vRow.is_active),
        image_url: vRow.image_url || undefined,
        images: vRow.images ? JSON.parse(vRow.images) : [],
        attributes: vRow.attributes ? JSON.parse(vRow.attributes) : {},
      };
      return { product, variant };
    }
  }

  // 2. If not found by variant ID, check if targetId matches a product in SQLite products table
  const prodRows = queryRows(db, "SELECT * FROM products WHERE id = ? LIMIT 1", [targetId]);
  if (prodRows.length > 0) {
    const product = formatProductFromDb(db, prodRows[0]);
    if (product.variants && product.variants.length > 0) {
      return { product, variant: product.variants[0] };
    }
    const defaultVariant = {
      id: product.id,
      product_id: product.id,
      name: "استاندارد",
      sku: product.sku || "",
      is_active: product.is_active,
      price: product.effective_price ?? product.base_price,
      effective_price: product.effective_price ?? product.base_price,
      stock_quantity: product.stock_quantity ?? 0,
      stock: product.stock_quantity ?? 0,
      inventory: {
        quantity: product.stock_quantity ?? 0,
        reserved_quantity: 0,
        safety_threshold: 0,
      },
    };
    return { product, variant: defaultVariant };
  }

  return null;
}

export function getAvailableStock(product: any, variant: any, dbParam?: any): number {
  if (!product || !variant) return 0;
  if (product.is_active === false || variant.is_active === false) {
    return 0;
  }

  const db = dbParam || getDatabaseSync();
  if (db && variant.id) {
    const inv = queryRows(
      db,
      "SELECT quantity, reserved_quantity FROM inventory WHERE product_variant_id = ? LIMIT 1",
      [Number(variant.id)]
    );
    if (inv.length > 0) {
      const q = Number(inv[0].quantity || 0);
      const res = Number(inv[0].reserved_quantity || 0);
      return Math.max(0, q - res);
    }
  }

  if (variant.inventory?.quantity !== undefined) {
    const qty = Number(variant.inventory.quantity);
    const reserved = Number(variant.inventory.reserved_quantity || 0);
    return Math.max(0, qty - reserved);
  }
  if (variant.stock_quantity !== undefined) {
    return Number(variant.stock_quantity);
  }
  if (variant.stock !== undefined) {
    return Number(variant.stock);
  }
  if (product.stock_quantity !== undefined) {
    return Number(product.stock_quantity);
  }
  return product.in_stock ? 10 : 0;
}

export function getEffectivePrice(product: any, variant: any, dbParam?: any): number {
  const db = dbParam || getDatabaseSync();
  if (db && variant?.id) {
    const vRows = queryRows(
      db,
      "SELECT price_override, effective_price, price, discount_price, original_price FROM product_variants WHERE id = ? LIMIT 1",
      [Number(variant.id)]
    );
    if (vRows.length > 0) {
      const v = vRows[0];
      if (v.price_override !== null && v.price_override !== undefined) return Number(v.price_override);
      if (v.effective_price !== null && v.effective_price !== undefined) return Number(v.effective_price);
      if (v.price !== null && v.price !== undefined) return Number(v.price);
      if (v.discount_price !== null && v.discount_price !== undefined) return Number(v.discount_price);
    }
  }
  if (db && product?.id) {
    const pRows = queryRows(
      db,
      "SELECT effective_price, discount_price, base_price FROM products WHERE id = ? LIMIT 1",
      [Number(product.id)]
    );
    if (pRows.length > 0) {
      const p = pRows[0];
      if (p.effective_price !== null && p.effective_price !== undefined) return Number(p.effective_price);
      if (p.discount_price !== null && p.discount_price !== undefined) return Number(p.discount_price);
      if (p.base_price !== null && p.base_price !== undefined) return Number(p.base_price);
    }
  }

  if (variant?.price_override !== undefined && variant?.price_override !== null) return Number(variant.price_override);
  if (variant?.effective_price !== undefined && variant?.effective_price !== null) return Number(variant.effective_price);
  if (variant?.price !== undefined && variant?.price !== null) return Number(variant.price);
  if (variant?.base_price !== undefined && variant?.base_price !== null) return Number(variant.base_price);
  if (product?.effective_price !== undefined && product?.effective_price !== null) return Number(product.effective_price);
  if (product?.discount_price !== undefined && product?.discount_price !== null) return Number(product.discount_price);
  if (product?.base_price !== undefined && product?.base_price !== null) return Number(product.base_price);
  return 0;
}

export function getVariantImage(product: any, variant: any, dbParam?: any): string {
  const variantImg = variant?.image_url || variant?.attributes?.image_url;
  if (variantImg && typeof variantImg === "string" && variantImg.trim() !== "") {
    return variantImg;
  }
  if (Array.isArray(variant?.images) && variant.images.length > 0 && typeof variant.images[0] === "string") {
    return variant.images[0];
  }

  const db = dbParam || getDatabaseSync();
  if (db && product?.id) {
    const imgRows = queryRows(
      db,
      "SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC LIMIT 1",
      [Number(product.id)]
    );
    if (imgRows.length > 0 && imgRows[0].image_url) {
      return imgRows[0].image_url;
    }
  }

  if (Array.isArray(product?.images) && product.images.length > 0 && typeof product.images[0] === "string") {
    return product.images[0];
  }
  if (product?.image_url) return product.image_url;
  return "/images/product-placeholder.svg";
}

export async function getOrCreateCart(req: Request): Promise<{ id: number; user_id: number | null; session_id: string | null }> {
  const user = await authenticateToken(req);
  const rawSessionId = req.headers["x-session-id"] || req.headers["x-cart-session-id"] || req.ip || "guest_default";
  const sessionId = typeof rawSessionId === "string" ? rawSessionId.trim() : String(rawSessionId);
  const db = await getDatabase();

  if (user) {
    const userCartQuery = db.exec(`SELECT id, user_id, session_id FROM carts WHERE user_id = ${user.id} LIMIT 1`);
    let userCartId: number;

    if (userCartQuery.length === 0 || userCartQuery[0].values.length === 0) {
      db.run(
        "INSERT INTO carts (user_id, session_id, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
        [user.id, sessionId || null]
      );
      persistDatabase();
      const createdQuery = db.exec(`SELECT id FROM carts WHERE user_id = ${user.id} ORDER BY id DESC LIMIT 1`);
      userCartId = Number(createdQuery[0].values[0][0]);
    } else {
      userCartId = Number(userCartQuery[0].values[0][0]);
    }

    // Merge guest cart if available
    if (sessionId) {
      const cleanSessionId = sessionId.replace(/'/g, "''");
      const guestCartQuery = db.exec(
        `SELECT id FROM carts WHERE session_id = '${cleanSessionId}' AND user_id IS NULL LIMIT 1`
      );

      if (guestCartQuery.length > 0 && guestCartQuery[0].values.length > 0) {
        const guestCartId = Number(guestCartQuery[0].values[0][0]);
        if (guestCartId !== userCartId) {
          const guestItems = db.exec(
            `SELECT id, product_variant_id, quantity FROM cart_items WHERE cart_id = ${guestCartId}`
          );
          if (guestItems.length > 0 && guestItems[0].values.length > 0) {
            for (const row of guestItems[0].values) {
              const pvId = Number(row[1]);
              const qty = Number(row[2]);
              const existingItem = db.exec(
                `SELECT id, quantity FROM cart_items WHERE cart_id = ${userCartId} AND product_variant_id = ${pvId} LIMIT 1`
              );
              if (existingItem.length > 0 && existingItem[0].values.length > 0) {
                const existingId = Number(existingItem[0].values[0][0]);
                const existingQty = Number(existingItem[0].values[0][1]);
                db.run(
                  "UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?",
                  [existingQty + qty, existingId]
                );
              } else {
                db.run(
                  "INSERT INTO cart_items (cart_id, product_variant_id, quantity, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
                  [userCartId, pvId, qty]
                );
              }
            }
          }
          db.run("DELETE FROM cart_items WHERE cart_id = ?", [guestCartId]);
          db.run("DELETE FROM carts WHERE id = ?", [guestCartId]);
          persistDatabase();
        }
      }
    }

    return { id: userCartId, user_id: user.id, session_id: sessionId };
  }

  // Guest cart by session ID
  const cleanSessionId = sessionId.replace(/'/g, "''");
  const guestCartQuery = db.exec(
    `SELECT id, user_id, session_id FROM carts WHERE session_id = '${cleanSessionId}' AND user_id IS NULL LIMIT 1`
  );
  let guestCartId: number;

  if (guestCartQuery.length === 0 || guestCartQuery[0].values.length === 0) {
    db.run(
      "INSERT INTO carts (user_id, session_id, created_at, updated_at) VALUES (NULL, ?, datetime('now'), datetime('now'))",
      [sessionId]
    );
    persistDatabase();
    const createdGuestQuery = db.exec(
      `SELECT id FROM carts WHERE session_id = '${cleanSessionId}' AND user_id IS NULL ORDER BY id DESC LIMIT 1`
    );
    guestCartId = Number(createdGuestQuery[0].values[0][0]);
  } else {
    guestCartId = Number(guestCartQuery[0].values[0][0]);
  }

  return { id: guestCartId, user_id: null, session_id: sessionId };
}

export async function getCartSummary(cartId: number): Promise<any> {
  const db = await getDatabase();
  const itemsQuery = db.exec(
    `SELECT id, product_variant_id, quantity FROM cart_items WHERE cart_id = ${cartId} ORDER BY id ASC`
  );

  if (itemsQuery.length === 0 || itemsQuery[0].values.length === 0) {
    return {
      cart_id: cartId,
      items: [],
      item_count: 0,
      subtotal: 0,
      discount_total: 0,
      coupon_discount: 0,
      tax: 0,
      tax_total: 0,
      shipping_total: 0,
      grand_total: 0,
      currency: "IRR",
      applied_coupon: null,
    };
  }

  let subtotal = 0;
  let itemCount = 0;
  const itemsData: any[] = [];

  for (const row of itemsQuery[0].values) {
    const itemId = Number(row[0]);
    const variantId = Number(row[1]);
    const quantity = Number(row[2]);

    const found = findProductAndVariant(variantId, db);
    if (!found) {
      // Stale or deleted item: mark unavailable
      itemsData.push({
        id: itemId,
        product_id: 0,
        variant_id: variantId,
        product_name: "کالای نامشخص",
        variant_name: "نامشخص",
        variant_sku: "",
        unit_price: 0,
        currency: "IRR",
        quantity,
        total_price: 0,
        available_stock: 0,
        is_in_stock: false,
        is_out_of_stock: true,
        has_insufficient_stock: true,
        image_url: "/images/product-placeholder.svg",
      });
      continue;
    }

    const { product, variant } = found;
    const availableStock = getAvailableStock(product, variant, db);
    const isOutOfStock = availableStock <= 0;
    const hasInsufficientStock = quantity > availableStock;
    const isInStock = !isOutOfStock && !hasInsufficientStock;

    const unitPrice = getEffectivePrice(product, variant, db);
    const totalPrice = unitPrice * quantity;

    subtotal += totalPrice;
    itemCount += quantity;

    itemsData.push({
      id: itemId,
      product_id: product.id,
      variant_id: variant.id,
      product_name: product.name,
      variant_name: variant.name || "استاندارد",
      variant_sku: variant.sku || product.sku || "",
      unit_price: unitPrice,
      currency: product.currency || "IRR",
      quantity,
      total_price: totalPrice,
      available_stock: availableStock,
      is_in_stock: isInStock,
      is_out_of_stock: isOutOfStock,
      has_insufficient_stock: hasInsufficientStock,
      image_url: getVariantImage(product, variant, db),
    });
  }

  return {
    cart_id: cartId,
    items: itemsData,
    item_count: itemCount,
    subtotal,
    discount_total: 0,
    coupon_discount: 0,
    tax: 0,
    tax_total: 0,
    shipping_total: 0,
    grand_total: subtotal,
    currency: "IRR",
    applied_coupon: null,
  };
}

// Route handlers
export async function handleGetCart(req: Request, res: Response) {
  try {
    const cart = await getOrCreateCart(req);
    const summary = await getCartSummary(cart.id);
    return res.json({
      success: true,
      data: summary,
      message: "Cart retrieved successfully.",
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to retrieve cart.",
    });
  }
}

export async function handleAddToCart(req: Request, res: Response) {
  try {
    const rawVariantId = req.body.product_variant_id ?? req.body.variant_id;
    const variantId = Number(rawVariantId);
    const quantity = Number(req.body.quantity ?? 1);

    if (!variantId || isNaN(variantId)) {
      return res.status(422).json({
        success: false,
        error_code: "VALIDATION_ERROR",
        message: "شناسه تنوع یا محصول نامعتبر است.",
      });
    }

    if (isNaN(quantity) || quantity <= 0) {
      return res.status(422).json({
        success: false,
        error_code: "INVALID_QUANTITY",
        message: "تعداد باید بزرگتر از صفر باشد.",
      });
    }

    const cart = await getOrCreateCart(req);
    const db = await getDatabase();

    const found = findProductAndVariant(variantId, db);
    if (!found || found.product.is_active === false || found.variant.is_active === false) {
      return res.status(404).json({
        success: false,
        error_code: "ENTITY_NOT_FOUND",
        message: "محصول یا تنوع مورد نظر نامعتبر یا غیرفعال است.",
      });
    }

    const availableStock = getAvailableStock(found.product, found.variant, db);
    if (availableStock <= 0) {
      return res.status(400).json({
        success: false,
        error_code: "INSUFFICIENT_STOCK",
        message: `موجودی این کالا به پایان رسیده است. موجودی فعلی: ۰`,
      });
    }

    const existingItemQuery = db.exec(
      `SELECT id, quantity FROM cart_items WHERE cart_id = ${cart.id} AND product_variant_id = ${found.variant.id} LIMIT 1`
    );

    let currentQtyInCart = 0;
    let existingItemId: number | null = null;

    if (existingItemQuery.length > 0 && existingItemQuery[0].values.length > 0) {
      existingItemId = Number(existingItemQuery[0].values[0][0]);
      currentQtyInCart = Number(existingItemQuery[0].values[0][1]);
    }

    const requestedTotal = currentQtyInCart + quantity;
    if (requestedTotal > availableStock) {
      return res.status(400).json({
        success: false,
        error_code: "INSUFFICIENT_STOCK",
        message: `تعداد درخواستی (${requestedTotal}) بیشتر از موجودی انبار (${availableStock}) است.`,
      });
    }

    if (existingItemId !== null) {
      db.run(
        "UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?",
        [requestedTotal, existingItemId]
      );
    } else {
      db.run(
        "INSERT INTO cart_items (cart_id, product_variant_id, quantity, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        [cart.id, found.variant.id, quantity]
      );
    }

    persistDatabase();

    const summary = await getCartSummary(cart.id);
    return res.json({
      success: true,
      data: summary,
      message: "Item added to cart.",
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to add item to cart.",
    });
  }
}

export async function handleUpdateCartItem(req: Request, res: Response) {
  try {
    const rawId = req.params.id;
    const numId = Number(rawId);
    const quantity = Number(req.body.quantity);

    if (isNaN(quantity)) {
      return res.status(422).json({
        success: false,
        error_code: "INVALID_QUANTITY",
        message: "تعداد نامعتبر است.",
      });
    }

    const cart = await getOrCreateCart(req);
    const db = await getDatabase();

    // Support lookup by cart_item id OR product_variant_id
    const itemQuery = db.exec(
      `SELECT id, product_variant_id, quantity FROM cart_items WHERE cart_id = ${cart.id} AND (id = ${numId} OR product_variant_id = ${numId}) LIMIT 1`
    );

    if (itemQuery.length === 0 || itemQuery[0].values.length === 0) {
      return res.status(404).json({
        success: false,
        error_code: "ENTITY_NOT_FOUND",
        message: "آیتم مورد نظر در سبد خرید یافت نشد.",
      });
    }

    const itemId = Number(itemQuery[0].values[0][0]);
    const variantId = Number(itemQuery[0].values[0][1]);

    if (quantity <= 0) {
      db.run("DELETE FROM cart_items WHERE id = ?", [itemId]);
      persistDatabase();
      const summary = await getCartSummary(cart.id);
      return res.json({
        success: true,
        data: summary,
        message: "Cart item removed.",
      });
    }

    const found = findProductAndVariant(variantId, db);
    if (!found) {
      return res.status(404).json({
        success: false,
        error_code: "ENTITY_NOT_FOUND",
        message: "محصول مربوط به این آیتم یافت نشد.",
      });
    }

    const availableStock = getAvailableStock(found.product, found.variant, db);
    if (quantity > availableStock) {
      return res.status(400).json({
        success: false,
        error_code: "INSUFFICIENT_STOCK",
        message: `تعداد درخواستی (${quantity}) بیشتر از موجودی انبار (${availableStock}) است.`,
      });
    }

    db.run(
      "UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?",
      [quantity, itemId]
    );
    persistDatabase();

    const summary = await getCartSummary(cart.id);
    return res.json({
      success: true,
      data: summary,
      message: "Cart item updated.",
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to update cart item.",
    });
  }
}

export async function handleRemoveCartItem(req: Request, res: Response) {
  try {
    const rawId = req.params.id;
    const numId = Number(rawId);

    const cart = await getOrCreateCart(req);
    const db = await getDatabase();

    const itemQuery = db.exec(
      `SELECT id FROM cart_items WHERE cart_id = ${cart.id} AND (id = ${numId} OR product_variant_id = ${numId}) LIMIT 1`
    );

    if (itemQuery.length === 0 || itemQuery[0].values.length === 0) {
      return res.status(404).json({
        success: false,
        error_code: "ENTITY_NOT_FOUND",
        message: "آیتم مورد نظر در سبد خرید یافت نشد.",
      });
    }

    const itemId = Number(itemQuery[0].values[0][0]);
    db.run("DELETE FROM cart_items WHERE id = ?", [itemId]);
    persistDatabase();

    const summary = await getCartSummary(cart.id);
    return res.json({
      success: true,
      data: summary,
      message: "Item removed from cart.",
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to remove item from cart.",
    });
  }
}

export async function handleClearCart(req: Request, res: Response) {
  try {
    const cart = await getOrCreateCart(req);
    const db = await getDatabase();

    db.run("DELETE FROM cart_items WHERE cart_id = ?", [cart.id]);
    persistDatabase();

    return res.json({
      success: true,
      data: null,
      message: "Cart cleared successfully.",
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to clear cart.",
    });
  }
}
