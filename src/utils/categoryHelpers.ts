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
  if (clean === 'modem' || clean === 'modems' || clean === 'internet') return 'modem-internet';
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
  if (!slug) return undefined;
  const normalized = normalizeCategorySlug(slug);
  const flat = flattenCategories(categories);
  
  // Exact slug match
  let found = flat.find(c => c.slug.toLowerCase() === normalized || c.slug.toLowerCase() === slug.toLowerCase());
  if (found) return found;

  // Check aliases
  if (normalized === 'simcard') {
    found = flat.find(c => c.slug === 'simcard' || c.slug === 'sim-card');
    if (found) return found;
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
