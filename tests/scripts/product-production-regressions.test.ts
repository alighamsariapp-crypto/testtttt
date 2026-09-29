import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { findCategoryBySlug, normalizeCategorySlug } from '../../src/utils/categoryHelpers';
import type { Category } from '../../src/types';

const mobileCategory: Category = {
  id: 6,
  name: 'موبایل',
  slug: 'موبایل',
  is_active: true,
  sort_order: 0,
};

const rawBrowserPathSegment = '%D9%85%D9%88%D8%A8%D8%A7%DB%8C%D9%84';
assert.equal(normalizeCategorySlug(rawBrowserPathSegment), 'موبایل');
assert.equal(findCategoryBySlug(rawBrowserPathSegment, [mobileCategory])?.id, 6);

const liveDataSource = await readFile(new URL('../../src/components/admin/staging/adminLiveData.ts', import.meta.url), 'utf8');
assert.match(liveDataSource, /sold:\s*0,/, 'نبود API فروش نباید به مقدار منفی در پنل تبدیل شود.');
assert.doesNotMatch(liveDataSource, /sold:\s*-1,/, 'مقدار فروش ساختگی منفی نباید به پنل بازگردد.');

console.log('Product production regression contract passed.');
