import assert from "node:assert/strict";
import { getDatabase, queryProductsFromDatabase, formatProductFromDb, queryRows } from "../../src/server/db";
import {
  findCategoryBySlug,
  normalizeCategorySlug,
  getCategoryAncestors,
  getCategoryDescendantSlugs,
  resolveCategoryForQuickAccess,
  flattenCategories,
} from "../../src/utils/categoryHelpers";
import { getStorefrontProducts, isStorefrontReadyProduct } from "../../src/utils/catalogQuality";
import { mapProduct } from "../../src/services/apiMappers";
import type { Category, Product, HomepageQuickAccessItem } from "../../src/types";

async function runTests() {
  console.log("=== Running Storefront Category and Product Regression Tests ===");

  const db = await getDatabase();

  // Load canonical categories from SQLite database
  const catRows = queryRows(
    db,
    "SELECT id, parent_id, name, slug, description, is_active, sort_order FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC"
  );
  assert.ok(catRows.length > 0, "SQLite categories table must contain categories.");

  // Build tree like categoryRoutes.ts does
  const categoryMap = new Map<number, Category>();
  catRows.forEach((cat: any) => {
    categoryMap.set(Number(cat.id), {
      id: Number(cat.id),
      parent_id: cat.parent_id !== null && cat.parent_id !== undefined ? Number(cat.parent_id) : null,
      name: String(cat.name),
      slug: String(cat.slug),
      description: cat.description || undefined,
      is_active: Boolean(cat.is_active),
      sort_order: Number(cat.sort_order || 0),
      children: [],
    });
  });

  const categoriesTree: Category[] = [];
  catRows.forEach((cat: any) => {
    const node = categoryMap.get(Number(cat.id))!;
    if (cat.parent_id === null || cat.parent_id === undefined || !categoryMap.has(Number(cat.parent_id))) {
      categoriesTree.push(node);
    } else {
      const parent = categoryMap.get(Number(cat.parent_id));
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
    }
  });

  console.log(`Loaded ${catRows.length} canonical categories from SQLite.`);

  // -------------------------------------------------------------
  // Test A — Quick Access category resolution
  // -------------------------------------------------------------
  console.log("Running Test A: Quick Access category resolution...");

  // Item with 'modem-internet' should resolve to canonical 'modems' (Category 6)
  const modemItem: HomepageQuickAccessItem = {
    id: "modem",
    title: "مودم",
    icon: "wifi",
    category: "modem-internet",
    destination: "store",
    isVisible: true,
  };
  const resolvedModem = resolveCategoryForQuickAccess(modemItem.category, categoriesTree, modemItem.title);
  assert.ok(resolvedModem, "Modem Quick Access item must resolve against database categories.");
  assert.equal(resolvedModem.slug, "modems", "Resolved category slug for modem must be 'modems'.");
  assert.equal(resolvedModem.id, 6, "Resolved category ID for modem must be 6.");

  // Item with 'laptops' should resolve to canonical 'laptops' (Category 1)
  const laptopItem: HomepageQuickAccessItem = {
    id: "laptop",
    title: "لپ‌تاپ",
    icon: "laptop",
    category: "laptops",
    destination: "store",
    isVisible: true,
  };
  const resolvedLaptop = resolveCategoryForQuickAccess(laptopItem.category, categoriesTree, laptopItem.title);
  assert.ok(resolvedLaptop, "Laptop Quick Access item must resolve against database categories.");
  assert.equal(resolvedLaptop.slug, "laptops", "Resolved category slug for laptop must be 'laptops'.");
  assert.equal(resolvedLaptop.id, 1, "Resolved category ID for laptop must be 1.");

  // Preserves hierarchical category ancestors
  const laptopAncestors = getCategoryAncestors(resolvedLaptop.slug, categoriesTree);
  assert.deepEqual(laptopAncestors.map((c) => c.slug), ["laptops"]);

  console.log("  ✓ Test A PASSED: Quick Access resolves to canonical database category slug/path.");

  // -------------------------------------------------------------
  // Test B — Invalid Quick Access category
  // -------------------------------------------------------------
  console.log("Running Test B: Invalid Quick Access category handling...");

  // Item pointing to category that does not exist in SQLite
  const simItem: HomepageQuickAccessItem = {
    id: "simcard",
    title: "سیم‌کارت",
    icon: "simcard",
    category: "simcard",
    destination: "store",
    isVisible: true,
  };
  const resolvedSim = resolveCategoryForQuickAccess(simItem.category, categoriesTree, simItem.title);
  assert.equal(resolvedSim, undefined, "Non-existent category reference 'simcard' must NOT resolve to a fake category.");

  const networkItem: HomepageQuickAccessItem = {
    id: "network",
    title: "تجهیزات شبکه",
    icon: "network",
    category: "networking-equipment",
    destination: "store",
    isVisible: true,
  };
  const resolvedNet = resolveCategoryForQuickAccess(networkItem.category, categoriesTree, networkItem.title);
  assert.equal(resolvedNet, undefined, "Non-existent category 'networking-equipment' must return undefined.");

  const fakeItem: HomepageQuickAccessItem = {
    id: "fake",
    title: "کالای خیالی",
    icon: "tag",
    category: "non-existent-category-12345",
    destination: "store",
    isVisible: true,
  };
  const resolvedFake = resolveCategoryForQuickAccess(fakeItem.category, categoriesTree, fakeItem.title);
  assert.equal(resolvedFake, undefined, "Arbitrary invalid category must return undefined.");

  console.log("  ✓ Test B PASSED: Invalid categories safely return undefined without creating fake categories.");

  // -------------------------------------------------------------
  // Test C — Store root products
  // -------------------------------------------------------------
  console.log("Running Test C: Store root products from SQLite...");

  const rawProducts = queryProductsFromDatabase(db);
  assert.ok(rawProducts.length > 0, "Products must be fetched from SQLite.");

  const mappedProducts: Product[] = rawProducts.map(mapProduct);
  const storefrontProducts = getStorefrontProducts(mappedProducts);

  assert.ok(storefrontProducts.length >= 4, "Storefront must contain valid seeded products.");
  assert.ok(storefrontProducts.some((p) => p.id === 101), "Product 101 (Asus TUF A15) must be present.");
  assert.ok(storefrontProducts.some((p) => p.id === 102), "Product 102 (Lenovo ThinkPad E16) must be present.");
  assert.ok(storefrontProducts.some((p) => p.id === 103), "Product 103 (Samsung S24) must be present.");
  assert.ok(storefrontProducts.some((p) => p.id === 104), "Product 104 (Huawei 5G Modem) must be present.");

  console.log(`  ✓ Test C PASSED: ${storefrontProducts.length} valid storefront products loaded from SQLite.`);

  // -------------------------------------------------------------
  // Test D — Root category products
  // -------------------------------------------------------------
  console.log("Running Test D: Root category products display...");

  // Select root category 'laptops'
  const rootCategorySlug = "laptops";
  const rootDescendantSlugs = getCategoryDescendantSlugs(rootCategorySlug, categoriesTree);
  assert.ok(rootDescendantSlugs.includes("laptops"), "Descendants must include root slug 'laptops'.");
  assert.ok(rootDescendantSlugs.includes("gaming-laptops"), "Descendants must include child slug 'gaming-laptops'.");
  assert.ok(rootDescendantSlugs.includes("ultrabooks"), "Descendants must include child slug 'ultrabooks'.");

  // Filter products for 'laptops'
  const laptopProducts = storefrontProducts.filter((p) => {
    return (
      rootDescendantSlugs.includes(p.category_slug || "") ||
      (p.subcategory_slug && rootDescendantSlugs.includes(p.subcategory_slug)) ||
      (p.category_path && p.category_path.some((s) => rootDescendantSlugs.includes(s)))
    );
  });

  assert.ok(laptopProducts.some((p) => p.id === 101), "Product 101 (gaming laptop) must appear under root category 'laptops'.");
  assert.ok(laptopProducts.some((p) => p.id === 102), "Product 102 (ultrabook) must appear under root category 'laptops'.");
  assert.ok(!laptopProducts.some((p) => p.id === 103), "Product 103 (mobile) must NOT appear under 'laptops'.");
  assert.ok(!laptopProducts.some((p) => p.id === 104), "Product 104 (modem) must NOT appear under 'laptops'.");

  console.log(`  ✓ Test D PASSED: Root category 'laptops' correctly includes child category products.`);

  // -------------------------------------------------------------
  // Test E — Nested category products
  // -------------------------------------------------------------
  console.log("Running Test E: Nested category products display...");

  // Select child category 'gaming-laptops'
  const childCategorySlug = "gaming-laptops";
  const childDescendantSlugs = getCategoryDescendantSlugs(childCategorySlug, categoriesTree);
  assert.deepEqual(childDescendantSlugs, ["gaming-laptops"]);

  const gamingLaptopProducts = storefrontProducts.filter((p) => {
    return (
      childDescendantSlugs.includes(p.category_slug || "") ||
      (p.subcategory_slug && childDescendantSlugs.includes(p.subcategory_slug)) ||
      (p.category_path && p.category_path.some((s) => childDescendantSlugs.includes(s)))
    );
  });

  assert.ok(gamingLaptopProducts.some((p) => p.id === 101), "Product 101 must appear under child category 'gaming-laptops'.");
  assert.ok(!gamingLaptopProducts.some((p) => p.id === 102), "Product 102 (ultrabook) must NOT appear under 'gaming-laptops'.");
  assert.ok(!gamingLaptopProducts.some((p) => p.id === 103), "Product 103 (mobile) must NOT appear under 'gaming-laptops'.");

  // Select child category 'ultrabooks'
  const ultrabooksDescendantSlugs = getCategoryDescendantSlugs("ultrabooks", categoriesTree);
  const ultrabookProducts = storefrontProducts.filter((p) => {
    return (
      ultrabooksDescendantSlugs.includes(p.category_slug || "") ||
      (p.subcategory_slug && ultrabooksDescendantSlugs.includes(p.subcategory_slug)) ||
      (p.category_path && p.category_path.some((s) => ultrabooksDescendantSlugs.includes(s)))
    );
  });

  assert.ok(ultrabookProducts.some((p) => p.id === 102), "Product 102 must appear under child category 'ultrabooks'.");
  assert.ok(!ultrabookProducts.some((p) => p.id === 101), "Product 101 must NOT appear under 'ultrabooks'.");

  console.log("  ✓ Test E PASSED: Child categories display only products specifically assigned to them.");

  // -------------------------------------------------------------
  // Test F — Category/product consistency
  // -------------------------------------------------------------
  console.log("Running Test F: Category/product consistency with valid database relationship...");

  // Simulate a product whose frontend derived category_slug was missing or corrupted,
  // but which has a valid category_id = 2 in the database.
  const productWithMissingSlug: Product = {
    ...storefrontProducts.find((p) => p.id === 101)!,
    category_slug: undefined as any,
    subcategory_slug: undefined as any,
    category_path: undefined as any,
  };

  // Using the canonical database category relationship:
  const flatCats = flattenCategories(categoriesTree);
  const targetCategory = findCategoryBySlug("laptops", categoriesTree)!;
  const descendantIds: number[] = [targetCategory.id];
  const findChildIds = (parentId: number) => {
    flatCats.filter((c) => c.parent_id === parentId).forEach((child) => {
      if (!descendantIds.includes(child.id)) {
        descendantIds.push(child.id);
        findChildIds(child.id);
      }
    });
  };
  findChildIds(targetCategory.id);

  // The product has category_id: 2, which is inside [1, 2, 3]
  assert.ok(
    descendantIds.includes(productWithMissingSlug.category_id),
    "Product with category_id: 2 must match root category via descendant IDs [1, 2, 3]."
  );

  // And formatProductFromDb directly produces the canonical category hierarchy
  const rawDbProductRow = queryRows(db, "SELECT * FROM products WHERE id = 101")[0];
  const formatted = formatProductFromDb(db, rawDbProductRow);
  assert.equal(formatted.category_id, 2);
  assert.equal(formatted.category_slug, "laptops");
  assert.equal(formatted.subcategory_slug, "gaming-laptops");
  assert.deepEqual(formatted.category_path, ["laptops", "gaming-laptops"]);
  assert.equal(formatted.category?.name, "لپ‌تاپ گیمینگ");

  console.log("  ✓ Test F PASSED: Server-side formatting guarantees consistent category hierarchy.");

  // -------------------------------------------------------------
  // Test G — Regression (Variants, Cart, Detail)
  // -------------------------------------------------------------
  console.log("Running Test G: Variants, cart, and product detail regression...");

  assert.ok(formatted.variants.length > 0, "Product variants must remain attached.");
  assert.ok(formatted.images.length > 0, "Product images must remain attached.");
  assert.equal(formatted.in_stock, true, "In-stock flag must be true.");

  // Product detail query by slug
  const prodsBySlug = queryProductsFromDatabase(db, "asus-tuf-a15-demo");
  assert.equal(prodsBySlug.length, 1, "Product must be queryable by slug.");
  assert.equal(prodsBySlug[0].id, 101);

  // Mapped product has sellable variants
  const mapped = mapProduct(formatted);
  assert.ok(mapped.variants.length > 0);
  assert.ok(mapped.variants[0].stock_quantity > 0);
  assert.equal(mapped.effective_price, 649000000);

  console.log("  ✓ Test G PASSED: Product variants, inventory, and detail integrity confirmed.");

  console.log("\nALL TESTS PASSED SUCCESSFULLY! (7/7)");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
