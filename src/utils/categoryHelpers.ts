import { Category } from '../types';

/**
 * Normalizes common slug aliases (e.g. sim-card <-> simcard)
 */
export const normalizeCategorySlug = (slug: string): string => {
  if (!slug) return '';
  let decodedSlug = slug;
  try {
    // window.location.pathname retains percent-encoded non-Latin slugs. Decode
    // them before lookup so URLs such as /store/موبایل map to API categories.
    decodedSlug = decodeURIComponent(slug);
  } catch {
    // Keep a malformed URL routable to the normal "not found" state instead of
    // crashing client-side navigation.
  }
  const clean = decodedSlug.trim().toLowerCase();
  if (clean === 'sim-card' || clean === 'sim_card' || clean === 'simcards') return 'simcard';
  if (clean === 'laptop' || clean === 'laptops-equipment') return 'laptops';
  if (clean === 'modem' || clean === 'modem-internet' || clean === 'modems' || clean === 'internet') return 'modems';
  if (clean === 'network' || clean === 'networking') return 'networking-equipment';
  if (clean === 'accessory') return 'accessories';
  return clean;
};

/**
 * Flattens hierarchical category tree into a single array of Category objects
 */
export const flattenCategories = (categoryTree: Category[]): Category[] => {
  const result: Category[] = [];
  const traverse = (cats: Category[]) => {
    for (const cat of cats) {
      result.push(cat);
      if (cat.children && cat.children.length > 0) {
        traverse(cat.children);
      }
    }
  };
  traverse(categoryTree);
  return result;
};

/**
 * Finds a category in tree or flat list by slug or normalized alias
 */
export const findCategoryBySlug = (
  slug: string | null | undefined, 
  categories: Category[]
): Category | undefined => {
  if (!slug || !categories || categories.length === 0) return undefined;
  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {}
  const clean = decodedSlug.trim().toLowerCase();
  const normalized = normalizeCategorySlug(clean);
  const flat = flattenCategories(categories);
  
  // 1. Direct ID match if numeric
  if (/^\d+$/.test(clean)) {
    const numId = Number(clean);
    const byId = flat.find(c => c.id === numId);
    if (byId) return byId;
  }

  // 2. Exact slug match or normalized slug match
  let found = flat.find(c => c.slug.toLowerCase() === clean || c.slug.toLowerCase() === normalized);
  if (found) return found;

  // 3. Name match (supports Persian names like 'موبایل' or 'مودم و اینترنت')
  found = flat.find(c => c.name.toLowerCase() === clean || c.name.toLowerCase() === decodedSlug.toLowerCase());
  if (found) return found;

  // 4. Aliases
  if (normalized === 'simcard') {
    found = flat.find(c => c.slug === 'simcard' || c.slug === 'sim-card');
    if (found) return found;
  }
  if (normalized === 'modems') {
    found = flat.find(c => c.slug === 'modems' || c.slug === 'modem-internet' || c.name.includes('مودم'));
    if (found) return found;
  }
  if (normalized === 'laptops') {
    found = flat.find(c => c.slug === 'laptops' || c.name.includes('لپ‌تاپ') || c.name.includes('لپتاپ'));
    if (found) return found;
  }
  if (normalized === 'networking-equipment') {
    found = flat.find(c => c.slug === 'networking-equipment' || c.slug === 'network' || c.name.includes('شبکه'));
    if (found) return found;
  }

  return undefined;
};

/**
 * Resolves a Quick Access item reference against canonical loaded categories from SQLite.
 * Matches by category ID, exact slug, normalized alias, or category name/keyword.
 * Returns the matched Category or undefined if no matching category exists in the database.
 */
export const resolveCategoryForQuickAccess = (
  reference: string | undefined | null,
  categories: Category[],
  fallbackTitleOrId?: string
): Category | undefined => {
  if (!categories || categories.length === 0) return undefined;

  // 1. Try finding by reference (slug, ID, or alias)
  if (reference) {
    const found = findCategoryBySlug(reference, categories);
    if (found) return found;
  }

  // 2. Try finding by title/id if provided
  if (fallbackTitleOrId) {
    const found = findCategoryBySlug(fallbackTitleOrId, categories);
    if (found) return found;
  }

  // 3. Semantic keyword resolution against loaded database categories
  const targetTerms: string[] = [];
  if (reference) targetTerms.push(reference.toLowerCase());
  if (fallbackTitleOrId) targetTerms.push(fallbackTitleOrId.toLowerCase());

  const flat = flattenCategories(categories);
  for (const term of targetTerms) {
    if (term.includes('modem') || term.includes('مودم') || term.includes('اینترنت')) {
      const modemCat = flat.find((c) => c.slug === 'modems' || c.slug.includes('modem') || c.name.includes('مودم'));
      if (modemCat) return modemCat;
    }
    if (term.includes('laptop') || term.includes('لپ‌تاپ') || term.includes('لپتاپ') || term.includes('کامپیوتر')) {
      const laptopCat = flat.find((c) => c.slug === 'laptops' || c.slug.includes('laptop') || c.name.includes('لپ‌تاپ') || c.name.includes('لپتاپ'));
      if (laptopCat) return laptopCat;
    }
    if (term.includes('mobile') || term.includes('موبایل') || term.includes('گوشی')) {
      const mobileCat = flat.find((c) => c.slug === 'mobile' || c.slug.includes('mobile') || c.name.includes('موبایل'));
      if (mobileCat) return mobileCat;
    }
    if (term.includes('appliance') || term.includes('خانگی')) {
      const homeCat = flat.find((c) => c.slug === 'home-appliances' || c.name.includes('خانگی'));
      if (homeCat) return homeCat;
    }
    if (term.includes('sim') || term.includes('سیم‌کارت') || term.includes('سیمکارت')) {
      const simCat = flat.find((c) => c.slug === 'simcard' || c.slug === 'sim-card' || c.name.includes('سیم'));
      if (simCat) return simCat;
    }
    if (term.includes('network') || term.includes('شبکه')) {
      const netCat = flat.find((c) => c.slug === 'networking-equipment' || c.slug === 'network' || c.name.includes('شبکه'));
      if (netCat) return netCat;
    }
  }

  return undefined;
};

/**
 * Checks if a category slug is valid
 */
export const isValidCategorySlug = (
  slug: string | null | undefined, 
  categories: Category[]
): boolean => {
  if (!slug) return false;
  return !!findCategoryBySlug(slug, categories);
};

/**
 * Returns ancestor chain from Level 1 root down to the target category
 */
export const getCategoryAncestors = (
  slug: string | null | undefined, 
  categories: Category[]
): Category[] => {
  if (!slug) return [];
  const target = findCategoryBySlug(slug, categories);
  if (!target) return [];

  const flat = flattenCategories(categories);
  const trail: Category[] = [target];
  let current = target;

  while (current.parent_slug) {
    const parent = flat.find(c => c.slug === current.parent_slug || c.id === current.parent_id);
    if (parent && !trail.some(t => t.slug === parent.slug)) {
      trail.unshift(parent);
      current = parent;
    } else {
      break;
    }
  }

  return trail;
};

/**
 * Returns all descendant slugs (including the category itself)
 */
export const getCategoryDescendantSlugs = (
  slug: string | null | undefined, 
  categories: Category[]
): string[] => {
  if (!slug) return [];
  const target = findCategoryBySlug(slug, categories);
  if (!target) return [slug];

  const flat = flattenCategories(categories);
  const results: string[] = [target.slug];

  const findChildren = (parentSlug: string, parentId?: number) => {
    for (const cat of flat) {
      if ((cat.parent_slug === parentSlug || (parentId !== undefined && cat.parent_id === parentId)) && !results.includes(cat.slug)) {
        results.push(cat.slug);
        findChildren(cat.slug, cat.id);
      }
    }
  };

  findChildren(target.slug, target.id);
  return results;
};

/**
 * Builds the canonical relative URL for a category based on hierarchy
 * e.g. /store/laptops/lenovo or /store/simcard/irancell
 */
export const buildCategoryUrl = (
  category: Category | string, 
  categories: Category[]
): string => {
  const catSlug = typeof category === 'string' ? category : category.slug;
  const ancestors = getCategoryAncestors(catSlug, categories);
  
  if (ancestors.length === 0) {
    return `/store/${catSlug}`;
  }

  const slugs = ancestors.map(a => a.slug);
  return `/store/${slugs.join('/')}`;
};
