import React, { useState, useMemo, useEffect } from 'react';
import { 
  Filter, 
  SlidersHorizontal, 
  Search, 
  Heart, 
  ShoppingCart, 
  Star, 
  ArrowUpDown, 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Zap,
  Tag,
  Layers,
  Smartphone,
  Monitor,
  Tablet,
  CheckCircle2,
  PackageX,
  Plus,
  Minus,
  Laptop,
  Wifi,
  Server,
  Share2,
  Sliders,
  Cpu,
  HardDrive,
  Radio,
  Network,
  Eye,
  CheckSquare,
  Square
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CatalogFacet, Product, Category } from '../types';
import { api } from '../services/api';
import { getDefaultSellableVariant, isProductPurchasable } from '../utils/productAvailability';
import { formatMoney } from '../utils/money';
import { ModalPortal } from './common/ModalPortal';
import { ProductGridSkeleton, FilterSidebarSkeleton, CategoryHeaderSkeleton } from './common/Skeletons';
import { 
  findCategoryBySlug, 
  getCategoryAncestors, 
  getCategoryDescendantSlugs, 
  flattenCategories, 
  normalizeCategorySlug 
} from '../utils/categoryHelpers';
import { getStorefrontProducts } from '../utils/catalogQuality';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface MobileFilterOptionGroupProps {
  title: string;
  options: string[];
  selected: string[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleOption: (option: string) => void;
  variant?: 'checkboxes' | 'chips';
}

const MobileFilterOptionGroup: React.FC<MobileFilterOptionGroupProps> = ({
  title,
  options,
  selected,
  expanded,
  onToggleExpanded,
  onToggleOption,
  variant = 'checkboxes',
}) => {
  if (options.length === 0) return null;

  return (
    <section className="border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-1 text-right ui-text-label font-bold text-slate-800"
        aria-expanded={expanded}
      >
        <span>{title}</span>
        <span className="flex items-center gap-2 text-slate-400">
          {selected.length > 0 && <span className="rounded-full bg-blue-50 px-2 py-0.5 ui-text-badge ui-numeric font-bold text-blue-700">{selected.length}</span>}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {expanded && (
        variant === 'chips' ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {options.map((option) => {
              const isSelected = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onToggleOption(option)}
                  className={`min-h-9 rounded-xl border px-3 ui-text-button transition ${isSelected ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-500/20' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {options.map((option) => {
              const isSelected = selected.includes(option);
              return (
                <label key={option} className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 ui-text-body text-slate-700 transition hover:bg-blue-50">
                  <span>{option}</span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleOption(option)}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>
              );
            })}
          </div>
        )
      )}
    </section>
  );
};

const SchemaFacetGroup: React.FC<{ facet: CatalogFacet; selected: string[]; open: boolean; onOpen: () => void; onToggle: (value: string) => void }> = ({ facet, selected, open, onOpen, onToggle }) => (
  <section className="border-b border-slate-100 pb-4">
    <button type="button" onClick={onOpen} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-1 text-right ui-text-label font-bold text-slate-900">
      <span>{facet.label}{facet.unit ? <small className="mr-1 font-medium text-slate-400">({facet.unit})</small> : null}</span>
      <span className="flex items-center gap-2 text-slate-400">{selected.length > 0 ? <small className="rounded-full bg-blue-50 px-2 py-0.5 ui-text-badge ui-numeric font-bold text-blue-700">{selected.length}</small> : null}{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
    </button>
    {open && <div className="mt-1.5 space-y-1.5">
      {facet.options.map((option) => <label key={option.value} className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-xl px-2 ui-text-body text-slate-700 transition hover:bg-slate-50"><span className="min-w-0 truncate">{option.label}</span><span className="flex shrink-0 items-center gap-2"><small className="ui-text-meta ui-numeric text-slate-400">{option.count}</small><input type="checkbox" checked={selected.includes(option.value)} onChange={() => onToggle(option.value)} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" /></span></label>)}
    </div>}
  </section>
);

export const CatalogView: React.FC = () => {
  const { 
    products, 
    categories, 
    selectedCategorySlug, 
    categoryHierarchy,
    navigateToCategory,
    navigateToProduct,
    setActiveView, 
    addToCart, 
    updateCartQuantity,
    removeFromCart,
    cart,
    toggleFavorite, 
    isFavorite,
    isLoadingData,
    copyShareLink,
    showToast
  } = useApp();
  const storefrontProducts = useMemo(() => getStorefrontProducts(products), [products]);

  const maxCatalogPrice = useMemo(() => {
    if (!products || products.length === 0) return 1_000_000_000;
    const maxVal = Math.max(...products.map(p => Number(p.effective_price || p.base_price || 0)));
    return Math.max(1_000_000_000, Math.ceil(maxVal / 100_000_000) * 100_000_000);
  }, [products]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000000000]);
  const [sortBy, setSortBy] = useState<'bestseller' | 'newest' | 'price_asc' | 'price_desc' | 'rating'>('bestseller');
  
  // Smart dynamic filters state
  const initialBrand = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('brand')?.trim()
    : null;
  const [selectedBrands, setSelectedBrands] = useState<string[]>(() => initialBrand ? [initialBrand] : []);
  const [schemaFacets, setSchemaFacets] = useState<CatalogFacet[]>([]);
  const [selectedSchemaFacets, setSelectedSchemaFacets] = useState<Record<string, string[]>>(() => initialBrand ? { brand: [initialBrand] } : {});
  const [openSchemaFacetKey, setOpenSchemaFacetKey] = useState<string | null>(null);
  const [selectedSimOperators, setSelectedSimOperators] = useState<string[]>([]);
  const [selectedSimTypes, setSelectedSimTypes] = useState<string[]>([]);
  const [selectedSimNumberTypes, setSelectedSimNumberTypes] = useState<string[]>([]);
  const [selectedSimPrefixes, setSelectedSimPrefixes] = useState<string[]>([]);
  
  const [selectedCpus, setSelectedCpus] = useState<string[]>([]);
  const [selectedRams, setSelectedRams] = useState<string[]>([]);
  const [selectedStorages, setSelectedStorages] = useState<string[]>([]);
  const [selectedGpus, setSelectedGpus] = useState<string[]>([]);
  const [selectedScreenSizes, setSelectedScreenSizes] = useState<string[]>([]);
  
  const [selectedNetworkGens, setSelectedNetworkGens] = useState<string[]>([]);
  const [selectedModemTypes, setSelectedModemTypes] = useState<string[]>([]);
  const [selectedWifiStandards, setSelectedWifiStandards] = useState<string[]>([]);
  const [selectedPorts, setSelectedPorts] = useState<string[]>([]);
  const [poeOnly, setPoeOnly] = useState(false);

  // General filters
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  // UI States
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const [categoryBrowserOpen, setCategoryBrowserOpen] = useState(false);
  const [mobileFilterSections, setMobileFilterSections] = useState({
    brands: false,
    price: true,
    colors: false,
    simOperator: false,
    simType: false,
    simNumberType: false,
    simPrefix: false,
    cpu: false,
    ram: false,
    storage: false,
    gpu: false,
    screen: false,
    networkGen: false,
    modemType: false,
    wifi: false,
    poe: false,
  });
  const [categorySearch, setCategorySearch] = useState('');
  const [isGridLoading, setIsGridLoading] = useState(false);

  // Accordion toggle states in sidebar
  const [accordionState, setAccordionState] = useState({
    categories: true,
    brands: false,
    price: false,
    simOperator: false,
    simType: false,
    simNumberType: false,
    simPrefix: false,
    cpu: false,
    ram: false,
    storage: false,
    gpu: false,
    screen: false,
    networkGen: false,
    modemType: false,
    wifi: false,
    ports: false,
    colors: false,
    devices: false,
  });

  const toggleAccordion = (key: keyof typeof accordionState) => {
    setOpenSchemaFacetKey(null);
    setAccordionState(Object.fromEntries(Object.keys(accordionState).map((item) => [item, item === key])) as typeof accordionState);
  };

  const toggleMobileFilterSection = (key: keyof typeof mobileFilterSections) => {
    setMobileFilterSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectBrandFromCategory = (brand: string) => {
    setSelectedBrands([brand]);
    setSelectedSchemaFacets((current) => ({ ...current, brand: [brand] }));
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('brand', brand);
      window.history.pushState({ view: 'store' }, '', `${url.pathname}${url.search}`);
    }
  };

  const toggleSchemaFacet = (key: string, value: string) => {
    setSelectedSchemaFacets((current) => {
      const nextValues = current[key]?.includes(value) ? current[key].filter((item) => item !== value) : [...(current[key] || []), value];
      const next = { ...current, [key]: nextValues };
      if (!nextValues.length) delete next[key];
      if (key === 'brand') setSelectedBrands(nextValues);
      return next;
    });
  };

  // Find active category item and its family
  const activeCategory = useMemo(() => {
    if (!selectedCategorySlug) return null;
    return findCategoryBySlug(selectedCategorySlug, categories) || null;
  }, [categories, selectedCategorySlug]);

  // Dynamic SEO Document Title
  useEffect(() => {
    if (selectedCategorySlug && activeCategory) {
      document.title = `خرید و قیمت انواع ${activeCategory.name} | فروشگاه نوین‌نت`;
    } else if (selectedCategorySlug && !isLoadingData && !activeCategory) {
      document.title = 'دسته‌بندی پیدا نشد - ۴۰۴ | فروشگاه نوین‌نت';
    } else {
      document.title = 'فروشگاه و محصولات ارتباطی نوین‌نت';
    }
  }, [selectedCategorySlug, activeCategory, isLoadingData]);

  useEffect(() => {
    let active = true;
    void api.getCatalogFacets({ category_slug: selectedCategorySlug || undefined, in_stock: inStockOnly, facets: selectedSchemaFacets })
      .then((response) => { if (active) setSchemaFacets(response.facets); })
      .catch(() => { if (active) setSchemaFacets([]); });
    return () => { active = false; };
  }, [selectedCategorySlug, inStockOnly, selectedSchemaFacets]);

  useEffect(() => {
    setOpenSchemaFacetKey((current) => schemaFacets.some((facet) => facet.key === current) ? current : null);
  }, [schemaFacets]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    (Object.entries(selectedSchemaFacets) as Array<[string, string[]]>).forEach(([key, values]) => {
      if (key === 'brand') return;
      url.searchParams.delete(`filter_${key}`);
      if (values.length) url.searchParams.set(`filter_${key}`, values.join(','));
    });
    if (selectedBrands.length) url.searchParams.set('brand', selectedBrands[0]);
    else url.searchParams.delete('brand');
    window.history.replaceState({ view: 'store' }, '', `${url.pathname}${url.search}`);
  }, [selectedBrands, selectedSchemaFacets]);

  // Determine Category Archetype / Type
  const categoryArchetype = useMemo((): 'simcard' | 'laptop' | 'modem' | 'network' | 'general' => {
    if (!selectedCategorySlug) return 'general';
    const slug = normalizeCategorySlug(selectedCategorySlug).toLowerCase();
    
    // Check SIM
    if (
      slug.includes('sim') || 
      slug === 'irancell' || 
      slug === 'mci' || 
      slug === 'rightel' || 
      slug.includes('permanent') || 
      slug.includes('credit')
    ) {
      return 'simcard';
    }

    // Check Laptop
    if (
      slug.includes('laptop') || 
      slug.includes('notebook') || 
      slug === 'lenovo' || 
      slug === 'asus' || 
      slug === 'apple' || 
      slug === 'hp' || 
      slug === 'dell'
    ) {
      return 'laptop';
    }

    // Check Modem
    if (
      slug.includes('modem') || 
      slug.includes('internet') || 
      slug.includes('router') || 
      slug.includes('5g') || 
      slug.includes('4g') || 
      slug.includes('pocket')
    ) {
      return 'modem';
    }

    // Check Network Equipment
    if (
      slug.includes('network') || 
      slug.includes('switch') || 
      slug.includes('cable') || 
      slug.includes('patch') ||
      slug.includes('rack')
    ) {
      return 'network';
    }

    return 'general';
  }, [selectedCategorySlug]);

  // Compute all descendant slugs for the current active category
  const descendantSlugs = useMemo(() => {
    if (!selectedCategorySlug) return [];
    return getCategoryDescendantSlugs(selectedCategorySlug, categories);
  }, [categories, selectedCategorySlug]);

  // Compute all descendant category IDs for the current active category
  const descendantCategoryIds = useMemo(() => {
    if (!activeCategory) return [];
    const flat = flattenCategories(categories);
    const ids: number[] = [activeCategory.id];
    const findChildIds = (parentId: number) => {
      flat.filter(c => c.parent_id === parentId).forEach(child => {
        if (!ids.includes(child.id)) {
          ids.push(child.id);
          findChildIds(child.id);
        }
      });
    };
    findChildIds(activeCategory.id);
    return ids;
  }, [categories, activeCategory]);

  const isProductMatchingCategory = (p: Product): boolean => {
    if (!selectedCategorySlug) return true;
    const normActive = normalizeCategorySlug(selectedCategorySlug);

    // 1. Direct database category ID relationship
    if (p.category_id && descendantCategoryIds.includes(p.category_id)) {
      return true;
    }

    // 2. Canonical category slugs & hierarchy path
    if (p.category_slug && descendantSlugs.includes(normalizeCategorySlug(p.category_slug))) {
      return true;
    }
    if (p.subcategory_slug && descendantSlugs.includes(normalizeCategorySlug(p.subcategory_slug))) {
      return true;
    }
    if (p.sub_subcategory_slug && descendantSlugs.includes(normalizeCategorySlug(p.sub_subcategory_slug))) {
      return true;
    }
    if ((p as any).category?.slug && descendantSlugs.includes(normalizeCategorySlug((p as any).category.slug))) {
      return true;
    }
    if (p.category_path && p.category_path.some(s => descendantSlugs.includes(normalizeCategorySlug(s)))) {
      return true;
    }

    // 3. Normalized direct slug match
    if (p.category_slug && normalizeCategorySlug(p.category_slug) === normActive) {
      return true;
    }
    if ((p as any).category?.slug && normalizeCategorySlug((p as any).category.slug) === normActive) {
      return true;
    }

    return false;
  };

  // Immediate child subcategories for top selector bar
  const directChildCategories = useMemo(() => {
    if (!activeCategory) {
      return categories.filter(c => c.level === 1 || !c.parent_slug);
    }
    const flat = flattenCategories(categories);
    return flat.filter(c => c.parent_slug === activeCategory.slug || c.parent_id === activeCategory.id);
  }, [categories, activeCategory]);

  const browseableCategories = useMemo(() => {
    const query = categorySearch.trim().toLocaleLowerCase('fa-IR');
    return flattenCategories(categories).filter((category) => !query || category.name.toLocaleLowerCase('fa-IR').includes(query));
  }, [categories, categorySearch]);

  useBodyScrollLock(categoryBrowserOpen || mobileFilterOpen || mobileSortOpen);

  // Sibling categories if at leaf level
  const siblingCategories = useMemo(() => {
    if (!activeCategory || !activeCategory.parent_slug) return [];
    const flat = flattenCategories(categories);
    return flat.filter(c => c.parent_slug === activeCategory.parent_slug && c.slug !== activeCategory.slug);
  }, [categories, activeCategory]);

  // Build Breadcrumbs trail
  const breadcrumbsTrail = useMemo(() => {
    if (!selectedCategorySlug) return [];
    return getCategoryAncestors(selectedCategorySlug, categories);
  }, [selectedCategorySlug, categories]);

  // Subtle filter transition effect
  useEffect(() => {
    setIsGridLoading(true);
    const timer = setTimeout(() => setIsGridLoading(false), 120);
    return () => clearTimeout(timer);
  }, [
    selectedCategorySlug,
    selectedBrands,
    selectedSimOperators,
    selectedSimTypes,
    selectedSimNumberTypes,
    selectedSimPrefixes,
    selectedCpus,
    selectedRams,
    selectedStorages,
    selectedGpus,
    selectedScreenSizes,
    selectedNetworkGens,
    selectedModemTypes,
    selectedWifiStandards,
    selectedPorts,
    poeOnly,
    inStockOnly,
    priceRange,
    searchQuery,
    sortBy
  ]);

  // Dynamic available filter options derived from current product pool
  const dynamicFilterOptions = useMemo(() => {
    // Get products matching current category scope
    const pool = selectedCategorySlug 
      ? storefrontProducts.filter(isProductMatchingCategory)
      : storefrontProducts;

    const brands = new Set<string>();
    const simOperators = new Set<string>();
    const simTypes = new Set<string>();
    const simNumberTypes = new Set<string>();
    const simPrefixes = new Set<string>();

    const cpus = new Set<string>();
    const rams = new Set<string>();
    const storages = new Set<string>();
    const gpus = new Set<string>();
    const screenSizes = new Set<string>();

    const networkGens = new Set<string>();
    const modemTypes = new Set<string>();
    const wifiStandards = new Set<string>();
    const ports = new Set<string>();

    pool.forEach(p => {
      if (p.brand) brands.add(p.brand);
      if (p.sim_operator) simOperators.add(p.sim_operator);
      if (p.sim_type) simTypes.add(p.sim_type);
      if (p.sim_number_type) simNumberTypes.add(p.sim_number_type);
      if (p.sim_prefix) simPrefixes.add(p.sim_prefix);

      if (p.processor) cpus.add(p.processor);
      if (p.ram) rams.add(p.ram);
      if (p.storage) storages.add(p.storage);
      if (p.gpu) gpus.add(p.gpu);
      if (p.screen_size) screenSizes.add(p.screen_size);

      if (p.network_generation) networkGens.add(p.network_generation);
      if (p.modem_type) modemTypes.add(p.modem_type);
      if (p.wifi_standard) wifiStandards.add(p.wifi_standard);
      if (p.ports_count) ports.add(p.ports_count);
    });

    return {
      brands: Array.from(brands),
      simOperators: Array.from(simOperators),
      simTypes: Array.from(simTypes),
      simNumberTypes: Array.from(simNumberTypes),
      simPrefixes: Array.from(simPrefixes),
      cpus: Array.from(cpus),
      rams: Array.from(rams),
      storages: Array.from(storages),
      gpus: Array.from(gpus),
      screenSizes: Array.from(screenSizes),
      networkGens: Array.from(networkGens),
      modemTypes: Array.from(modemTypes),
      wifiStandards: Array.from(wifiStandards),
      ports: Array.from(ports),
    };
  }, [storefrontProducts, selectedCategorySlug, descendantSlugs, descendantCategoryIds, categories]);

  // Filtering Logic
  const filteredProducts = useMemo(() => {
    return storefrontProducts.filter(product => {
      // 1. Hierarchical Category Filter
      if (selectedCategorySlug && !isProductMatchingCategory(product)) {
        return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = product.name.toLowerCase().includes(q);
        const matchDesc = product.description?.toLowerCase().includes(q);
        const matchSku = product.sku?.toLowerCase().includes(q);
        const matchBrand = product.brand?.toLowerCase().includes(q);
        const matchCat = product.category_name?.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchSku && !matchBrand && !matchCat) return false;
      }

      // 3. Stock Filter
      if (inStockOnly && !product.in_stock) {
        return false;
      }

      // 4. Price Range Filter
      const price = product.effective_price || product.base_price;
      if (priceRange[0] > 0 && price < priceRange[0]) {
        return false;
      }
      if (priceRange[1] > 0 && priceRange[1] < maxCatalogPrice && price > priceRange[1]) {
        return false;
      }

      // 5. Brands Filter
      if (selectedBrands.length > 0) {
        if (!product.brand || !selectedBrands.includes(product.brand)) return false;
      }

      for (const [key, values] of Object.entries(selectedSchemaFacets) as Array<[string, string[]]>) {
        if (!values.length || key === 'brand') continue;
        const rawValue = product.specs?.[key];
        const productValues = Array.isArray(rawValue)
          ? rawValue.map((value) => value.trim())
          : rawValue ? String(rawValue).split('|').map((value) => value.trim()) : [];
        if (!values.some((value) => productValues.includes(value))) return false;
      }

      // 6. SIM Card Dynamic Filters
      if (categoryArchetype === 'simcard') {
        if (selectedSimOperators.length > 0) {
          if (!product.sim_operator || !selectedSimOperators.includes(product.sim_operator)) return false;
        }
        if (selectedSimTypes.length > 0) {
          if (!product.sim_type || !selectedSimTypes.includes(product.sim_type)) return false;
        }
        if (selectedSimNumberTypes.length > 0) {
          if (!product.sim_number_type || !selectedSimNumberTypes.includes(product.sim_number_type)) return false;
        }
        if (selectedSimPrefixes.length > 0) {
          if (!product.sim_prefix || !selectedSimPrefixes.includes(product.sim_prefix)) return false;
        }
      }

      // 7. Laptop Dynamic Filters
      if (categoryArchetype === 'laptop') {
        if (selectedCpus.length > 0) {
          if (!product.processor || !selectedCpus.includes(product.processor)) return false;
        }
        if (selectedRams.length > 0) {
          if (!product.ram || !selectedRams.includes(product.ram)) return false;
        }
        if (selectedStorages.length > 0) {
          if (!product.storage || !selectedStorages.includes(product.storage)) return false;
        }
        if (selectedGpus.length > 0) {
          if (!product.gpu || !selectedGpus.includes(product.gpu)) return false;
        }
        if (selectedScreenSizes.length > 0) {
          if (!product.screen_size || !selectedScreenSizes.includes(product.screen_size)) return false;
        }
      }

      // 8. Modem Dynamic Filters
      if (categoryArchetype === 'modem') {
        if (selectedNetworkGens.length > 0) {
          if (!product.network_generation || !selectedNetworkGens.includes(product.network_generation)) return false;
        }
        if (selectedModemTypes.length > 0) {
          if (!product.modem_type || !selectedModemTypes.includes(product.modem_type)) return false;
        }
        if (selectedWifiStandards.length > 0) {
          if (!product.wifi_standard || !selectedWifiStandards.includes(product.wifi_standard)) return false;
        }
        if (selectedPorts.length > 0) {
          if (!product.ports_count || !selectedPorts.includes(product.ports_count)) return false;
        }
      }

      // 9. Network Equipment Filters
      if (categoryArchetype === 'network') {
        if (selectedPorts.length > 0) {
          if (!product.ports_count || !selectedPorts.includes(product.ports_count)) return false;
        }
        if (poeOnly && !product.poe_support) {
          return false;
        }
      }

      // 10. Colors & Devices (General)
      if (selectedColors.length > 0) {
        const hasColor = product.colors?.some(c => selectedColors.includes(c.name));
        if (!hasColor) return false;
      }

      if (selectedDevices.length > 0) {
        const hasDevice = product.device_compatibility?.some(d => selectedDevices.includes(d));
        if (!hasDevice) return false;
      }

      return true;
    });
  }, [
    storefrontProducts,
    selectedCategorySlug, 
    descendantSlugs, 
    searchQuery, 
    inStockOnly, 
    priceRange, 
    selectedBrands, 
    selectedSchemaFacets,
    categoryArchetype,
    selectedSimOperators,
    selectedSimTypes,
    selectedSimNumberTypes,
    selectedSimPrefixes,
    selectedCpus,
    selectedRams,
    selectedStorages,
    selectedGpus,
    selectedScreenSizes,
    selectedNetworkGens,
    selectedModemTypes,
    selectedWifiStandards,
    selectedPorts,
    poeOnly,
    selectedColors,
    selectedDevices
  ]);

  // Sorting Logic
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    switch (sortBy) {
      case 'price_asc':
        return list.sort((a, b) => (a.effective_price || a.base_price) - (b.effective_price || b.base_price));
      case 'price_desc':
        return list.sort((a, b) => (b.effective_price || b.base_price) - (a.effective_price || a.base_price));
      case 'rating':
        return list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'newest':
        return list.sort((a, b) => b.id - a.id);
      case 'bestseller':
      default:
        return list.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
    }
  }, [filteredProducts, sortBy]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (inStockOnly) count++;
    if (selectedBrands.length) count += selectedBrands.length;
    if (selectedSimOperators.length) count += selectedSimOperators.length;
    if (selectedSimTypes.length) count += selectedSimTypes.length;
    if (selectedSimNumberTypes.length) count += selectedSimNumberTypes.length;
    if (selectedSimPrefixes.length) count += selectedSimPrefixes.length;
    if (selectedCpus.length) count += selectedCpus.length;
    if (selectedRams.length) count += selectedRams.length;
    if (selectedStorages.length) count += selectedStorages.length;
    if (selectedGpus.length) count += selectedGpus.length;
    if (selectedScreenSizes.length) count += selectedScreenSizes.length;
    if (selectedNetworkGens.length) count += selectedNetworkGens.length;
    if (selectedModemTypes.length) count += selectedModemTypes.length;
    if (selectedWifiStandards.length) count += selectedWifiStandards.length;
    if (selectedPorts.length) count += selectedPorts.length;
    if (poeOnly) count++;
    if (selectedColors.length) count += selectedColors.length;
    if (selectedDevices.length) count += selectedDevices.length;
    if (priceRange[0] > 0 || (priceRange[1] > 0 && priceRange[1] < maxCatalogPrice)) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [
    inStockOnly, selectedBrands, selectedSimOperators, selectedSimTypes, selectedSimNumberTypes,
    selectedSimPrefixes, selectedCpus, selectedRams, selectedStorages, selectedGpus, selectedScreenSizes,
    selectedNetworkGens, selectedModemTypes, selectedWifiStandards, selectedPorts, poeOnly,
    selectedColors, selectedDevices, priceRange, searchQuery, maxCatalogPrice
  ]);

  // Reset all filters except category
  const resetFilters = () => {
    setSearchQuery('');
    setInStockOnly(false);
    setSelectedBrands([]);
    setSelectedSimOperators([]);
    setSelectedSimTypes([]);
    setSelectedSimNumberTypes([]);
    setSelectedSimPrefixes([]);
    setSelectedCpus([]);
    setSelectedRams([]);
    setSelectedStorages([]);
    setSelectedGpus([]);
    setSelectedScreenSizes([]);
    setSelectedNetworkGens([]);
    setSelectedModemTypes([]);
    setSelectedWifiStandards([]);
    setSelectedPorts([]);
    setPoeOnly(false);
    setSelectedColors([]);
    setSelectedDevices([]);
    setPriceRange([0, maxCatalogPrice]);
    setSortBy('bestseller');
  };

  // Helper toggle functions
  const toggleItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setList(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const sortOptions = [
    { id: 'bestseller', label: 'پرفروش‌ترین' },
    { id: 'newest', label: 'جدیدترین' },
    { id: 'price_asc', label: 'ارزان‌ترین' },
    { id: 'price_desc', label: 'گران‌ترین' },
    { id: 'rating', label: 'محبوب‌ترین' },
  ];

  const colorPalette = [
    { name: 'سفید', hex: '#FFFFFF', border: true },
    { name: 'مشکی', hex: '#1E293B', border: false },
    { name: 'آبی', hex: '#2563EB', border: false },
    { name: 'نقره‌ای', hex: '#CBD5E1', border: false },
    { name: 'طوسی', hex: '#94A3B8', border: false },
  ];

  // Invalid Category 404 State
  if (selectedCategorySlug && !isLoadingData && !activeCategory) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb back */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-6 flex-wrap" aria-label="Breadcrumb">
          <button
            onClick={() => setActiveView('home')}
            className="hover:text-blue-600 font-medium transition"
          >
            خانه
          </button>
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
          <button
            onClick={() => navigateToCategory(null, [])}
            className="hover:text-blue-600 font-medium transition"
          >
            فروشگاه
          </button>
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
            دسته‌بندی نامعتبر
          </span>
        </nav>

        <div className="max-w-xl mx-auto text-center space-y-8 bg-white p-8 sm:p-12 rounded-3xl border border-slate-100 shadow-xl">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 ring-8 ring-rose-50/50">
              <PackageX className="w-12 h-12" />
            </div>
            <span className="absolute -bottom-2 px-3 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white shadow-md">
              ۴۰۴
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
              دسته‌بندی مورد نظر یافت نشد!
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
              آدرس دسته‌بندی وارد شده معتبر نیست یا ممکن است تغییر کرده یا حذف شده باشد.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigateToCategory(null, [])}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>مشاهده همه محصولات فروشگاه</span>
            </button>
            <button
              onClick={() => setActiveView('home')}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <span>بازگشت به صفحه اصلی</span>
            </button>
          </div>

          {/* Quick shortcuts to valid categories */}
          <div className="pt-6 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-400 mb-3">
              دسته‌بندی‌های معتبر پیشنهادی:
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {flattenCategories(categories).filter(c => !c.parent_id).slice(0, 6).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => navigateToCategory(cat.slug, [cat.slug])}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-xs font-semibold text-slate-600 border border-slate-100 transition cursor-pointer"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
      
      {/* 1. Breadcrumb Hierarchy Bar */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4 flex-wrap" aria-label="Breadcrumb">
        <button
          onClick={() => setActiveView('home')}
          className="hover:text-blue-600 font-medium transition"
        >
          خانه
        </button>
        <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
        <button
          onClick={() => navigateToCategory(null, [])}
          className={`hover:text-blue-600 font-medium transition ${!selectedCategorySlug ? 'text-blue-700 font-bold' : ''}`}
        >
          فروشگاه
        </button>

        {breadcrumbsTrail.map((cat, idx) => {
          const isLast = idx === breadcrumbsTrail.length - 1;
          const hierarchySlice = breadcrumbsTrail.slice(0, idx + 1).map(c => c.slug);
          return (
            <React.Fragment key={cat.slug}>
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
              {isLast ? (
                <span className="text-slate-900 font-extrabold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  {cat.name}
                </span>
              ) : (
                <button
                  onClick={() => navigateToCategory(cat.slug, hierarchySlice)}
                  className="hover:text-blue-600 font-medium transition text-slate-600"
                >
                  {cat.name}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* 2. Scalable category entry point; the full tree lives in the sidebar/browser instead of a crowded chip row. */}
      <section className="mb-5 rounded-3xl border border-slate-100 bg-white p-4 shadow-xs sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="ui-text-meta text-slate-500">دسته‌بندی محصولات</p>
            <h1 className="mt-0.5 truncate ui-text-section-title text-slate-900 sm:ui-text-page-title">
              {activeCategory?.name || 'همه محصولات فروشگاه'}
            </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCategoryBrowserOpen(true)}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 ui-text-button text-blue-700 transition hover:border-blue-200 hover:bg-blue-100 sm:mt-0 sm:w-auto"
        >
          <span>مرور همه دسته‌بندی‌ها</span>
          <span className="rounded-full bg-white px-2 py-0.5 ui-text-badge ui-numeric text-blue-700 shadow-xs">{flattenCategories(categories).length}</span>
          <ChevronLeft className="h-4 w-4" />
        </button>
      </section>

      {/* 3. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* ======================================================== */}
        {/* DESKTOP FILTER SIDEBAR (Left in LTR / Right in RTL)      */}
        {/* ======================================================== */}
        <div className="hidden lg:block lg:col-span-1 space-y-4 sticky top-24">
          
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-5">
            
            {/* Filter Header & Reset Button */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                <h2 className="ui-text-section-title text-slate-900">فیلترهای هوشمند</h2>
                {activeFiltersCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white ui-text-badge ui-numeric flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              {activeFiltersCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="ui-text-meta text-red-500 hover:text-red-600 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>پاکسازی</span>
                </button>
              )}
            </div>

            {/* In Stock Toggle Switch */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-xs font-bold text-slate-700">فقط کالاهای موجود</span>
              <button
                onClick={() => setInStockOnly(!inStockOnly)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                  inStockOnly ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                    inStockOnly ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* ======================================================== */}
            {/* CATEGORY TREE ACCORDION                                   */}
            {/* ======================================================== */}
            <div className="border-b border-slate-100 pb-4">
              <button
                onClick={() => toggleAccordion('categories')}
                className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2 cursor-pointer"
              >
                <span>دسته‌بندی‌ها</span>
                {accordionState.categories ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              
              {accordionState.categories && (
                <div className="mt-2 space-y-1 max-h-56 overflow-y-auto pr-1 text-xs">
                  <button
                    onClick={() => navigateToCategory(null, [])}
                    className={`w-full text-right py-1.5 px-2.5 rounded-xl transition flex items-center justify-between font-bold ${
                      !selectedCategorySlug ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>همه محصولات</span>
                    <span className="font-mono text-[10px] text-slate-400">{products.length}</span>
                  </button>

                  {categories.map(cat => {
                    const isSelected = selectedCategorySlug === cat.slug;
                    const indent = cat.level === 3 ? 'pr-6' : cat.level === 2 ? 'pr-3' : 'pr-0';
                    return (
                      <button
                        key={cat.slug}
                        onClick={() => {
                          const hierarchy = cat.parent_slug ? [cat.parent_slug, cat.slug] : [cat.slug];
                          navigateToCategory(cat.slug, hierarchy);
                        }}
                        className={`w-full text-right py-2 px-4 rounded-xl transition flex items-center justify-between text-xs ${indent} ${
                          isSelected ? 'bg-blue-600 text-white font-extrabold shadow-xs' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{cat.level === 3 ? `• ${cat.name}` : cat.level === 2 ? `▫ ${cat.name}` : cat.name}</span>
                        {cat.product_count !== undefined && (
                          <span className={`text-[10px] font-mono ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {cat.product_count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* DYNAMIC SMART FILTER: SIM CARD FILTERS                   */}
            {/* ======================================================== */}
            {schemaFacets.map((facet) => <SchemaFacetGroup key={facet.key} facet={facet} selected={selectedSchemaFacets[facet.key] || []} open={openSchemaFacetKey === facet.key} onOpen={() => { setOpenSchemaFacetKey(facet.key); setAccordionState(Object.fromEntries(Object.keys(accordionState).map((item) => [item, false])) as typeof accordionState); }} onToggle={(value) => toggleSchemaFacet(facet.key, value)} />)}
            {categoryArchetype === 'simcard' && (
              <>
                {/* 1. SIM Operator */}
                {dynamicFilterOptions.simOperators.length > 0 && (
                  <div className="border-b border-slate-100 pb-4">
                    <button
                      onClick={() => toggleAccordion('simOperator')}
                      className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2"
                    >
                      <span>اپراتور سیم‌کارت</span>
                      {accordionState.simOperator ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {accordionState.simOperator && (
                      <div className="mt-2 space-y-1.5">
                        {dynamicFilterOptions.simOperators.map(op => (
                          <label key={op} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                            <span className="text-slate-700 font-medium">{op}</span>
                            <input
                              type="checkbox"
                              checked={selectedSimOperators.includes(op)}
                              onChange={() => toggleItem(selectedSimOperators, setSelectedSimOperators, op)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. SIM Type (Permanent / Credit / Data) */}
                {dynamicFilterOptions.simTypes.length > 0 && (
                  <div className="border-b border-slate-100 pb-4">
                    <button
                      onClick={() => toggleAccordion('simType')}
                      className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2"
                    >
                      <span>نوع خط و سیم‌کارت</span>
                      {accordionState.simType ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {accordionState.simType && (
                      <div className="mt-2 space-y-1.5">
                        {dynamicFilterOptions.simTypes.map(st => (
                          <label key={st} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                            <span className="text-slate-700 font-medium">{st}</span>
                            <input
                              type="checkbox"
                              checked={selectedSimTypes.includes(st)}
                              onChange={() => toggleItem(selectedSimTypes, setSelectedSimTypes, st)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. SIM Number Status (Rond / Normal / Zero) */}
                {dynamicFilterOptions.simNumberTypes.length > 0 && (
                  <div className="border-b border-slate-100 pb-4">
                    <button
                      onClick={() => toggleAccordion('simNumberType')}
                      className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2"
                    >
                      <span>وضعیت شماره (رند / صفر)</span>
                      {accordionState.simNumberType ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {accordionState.simNumberType && (
                      <div className="mt-2 space-y-1.5">
                        {dynamicFilterOptions.simNumberTypes.map(nt => (
                          <label key={nt} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                            <span className="text-slate-700 font-medium">{nt}</span>
                            <input
                              type="checkbox"
                              checked={selectedSimNumberTypes.includes(nt)}
                              onChange={() => toggleItem(selectedSimNumberTypes, setSelectedSimNumberTypes, nt)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. SIM Prefix */}
                {dynamicFilterOptions.simPrefixes.length > 0 && (
                  <div className="border-b border-slate-100 pb-4">
                    <button
                      onClick={() => toggleAccordion('simPrefix')}
                      className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2"
                    >
                      <span>پیش‌شماره</span>
                      {accordionState.simPrefix ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {accordionState.simPrefix && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {dynamicFilterOptions.simPrefixes.map(prefix => (
                          <button
                            key={prefix}
                            onClick={() => toggleItem(selectedSimPrefixes, setSelectedSimPrefixes, prefix)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition border ${
                              selectedSimPrefixes.includes(prefix)
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            {prefix}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ======================================================== */}
            {/* DYNAMIC SMART FILTER: LAPTOP FILTERS                     */}
            {/* ======================================================== */}
            {categoryArchetype === 'laptop' && schemaFacets.length === 0 && (
              <>
                {/* 1. Laptop Processor CPU */}
                {dynamicFilterOptions.cpus.length > 0 && (
                  <div className="border-b border-slate-100 pb-4">
                    <button
                      onClick={() => toggleAccordion('cpu')}
                      className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2"
                    >
                      <span className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-blue-600" />
                        <span>پردازنده (CPU)</span>
                      </span>
                      {accordionState.cpu ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {accordionState.cpu && (
                      <div className="mt-2 space-y-1.5">
                        {dynamicFilterOptions.cpus.map(cpu => (
                          <label key={cpu} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                            <span className="text-slate-700 font-medium">{cpu}</span>
                            <input
                              type="checkbox"
                              checked={selectedCpus.includes(cpu)}
                              onChange={() => toggleItem(selectedCpus, setSelectedCpus, cpu)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Laptop RAM */}
                {dynamicFilterOptions.rams.length > 0 && (
                  <div className="border-b border-slate-100 pb-4">
                    <button
                      onClick={() => toggleAccordion('ram')}
                      className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2"
                    >
                      <span>حافظه رم (RAM)</span>
                      {accordionState.ram ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {accordionState.ram && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {dynamicFilterOptions.rams.map(ram => (
                          <button
                            key={ram}
                            onClick={() => toggleItem(selectedRams, setSelectedRams, ram)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                              selectedRams.includes(ram)
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            {ram}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Laptop Storage SSD */}
                {dynamicFilterOptions.storages.length > 0 && (
                  <div className="border-b border-slate-100 pb-4">
                    <button
                      onClick={() => toggleAccordion('storage')}
                      className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2"
                    >
                      <span className="flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                        <span>حافظه داخلی (SSD)</span>
                      </span>
                      {accordionState.storage ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {accordionState.storage && (
                      <div className="mt-2 space-y-1.5">
                        {dynamicFilterOptions.storages.map(storage => (
                          <label key={storage} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                            <span className="text-slate-700 font-medium">{storage}</span>
                            <input
                              type="checkbox"
                              checked={selectedStorages.includes(storage)}
                              onChange={() => toggleItem(selectedStorages, setSelectedStorages, storage)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Laptop GPU */}
                {dynamicFilterOptions.gpus.length > 0 && (
                  <div className="border-b border-slate-100 pb-4">
                    <button
                      onClick={() => toggleAccordion('gpu')}
                      className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2"
                    >
                      <span>کارت گرافیک (GPU)</span>
                      {accordionState.gpu ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {accordionState.gpu && (
                      <div className="mt-2 space-y-1.5">
                        {dynamicFilterOptions.gpus.map(gpu => (
                          <label key={gpu} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                            <span className="text-slate-700 font-medium">{gpu}</span>
                            <input
                              type="checkbox"
                              checked={selectedGpus.includes(gpu)}
                              onChange={() => toggleItem(selectedGpus, setSelectedGpus, gpu)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Screen Size */}
                {dynamicFilterOptions.screenSizes.length > 0 && (
                  <div className="border-b border-slate-100 pb-4">
                    <button
                      onClick={() => toggleAccordion('screen')}
                      className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2"
                    >
                      <span>اندازه صفحه نمایش</span>
                      {accordionState.screen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {accordionState.screen && (
                      <div className="mt-2 space-y-1.5">
                        {dynamicFilterOptions.screenSizes.map(size => (
                          <label key={size} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                            <span className="text-slate-700 font-medium">{size}</span>
                            <input
                              type="checkbox"
                              checked={selectedScreenSizes.includes(size)}
                              onChange={() => toggleItem(selectedScreenSizes, setSelectedScreenSizes, size)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ======================================================== */}
            {/* DYNAMIC SMART FILTER: MODEM & NETWORK                    */}
            {/* ======================================================== */}
            {categoryArchetype === 'modem' && schemaFacets.length === 0 && (
              <>
                {/* 1. Network Generation (5G / 4G / FTTH / TD-LTE) */}
                {dynamicFilterOptions.networkGens.length > 0 && (
                  <div className="border-b border-slate-100 pb-4">
                    <button
                      onClick={() => toggleAccordion('networkGen')}
                      className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2"
                    >
                      <span className="flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-blue-600" />
                        <span>نسل شبکه و تکنولوژی</span>
                      </span>
                      {accordionState.networkGen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {accordionState.networkGen && (
                      <div className="mt-2 space-y-1.5">
                        {dynamicFilterOptions.networkGens.map(gen => (
                          <label key={gen} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                            <span className="text-slate-700 font-medium">{gen}</span>
                            <input
                              type="checkbox"
                              checked={selectedNetworkGens.includes(gen)}
                              onChange={() => toggleItem(selectedNetworkGens, setSelectedNetworkGens, gen)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Modem Type (Desktop / Pocket) */}
                {dynamicFilterOptions.modemTypes.length > 0 && (
                  <div className="border-b border-slate-100 pb-4">
                    <button
                      onClick={() => toggleAccordion('modemType')}
                      className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2"
                    >
                      <span>نوع مودم</span>
                      {accordionState.modemType ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {accordionState.modemType && (
                      <div className="mt-2 space-y-1.5">
                        {dynamicFilterOptions.modemTypes.map(type => (
                          <label key={type} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                            <span className="text-slate-700 font-medium">{type}</span>
                            <input
                              type="checkbox"
                              checked={selectedModemTypes.includes(type)}
                              onChange={() => toggleItem(selectedModemTypes, setSelectedModemTypes, type)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Wi-Fi Standard */}
                {dynamicFilterOptions.wifiStandards.length > 0 && (
                  <div className="border-b border-slate-100 pb-4">
                    <button
                      onClick={() => toggleAccordion('wifi')}
                      className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2"
                    >
                      <span className="flex items-center gap-1.5">
                        <Wifi className="w-3.5 h-3.5 text-blue-600" />
                        <span>استاندارد Wi-Fi</span>
                      </span>
                      {accordionState.wifi ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {accordionState.wifi && (
                      <div className="mt-2 space-y-1.5">
                        {dynamicFilterOptions.wifiStandards.map(wifi => (
                          <label key={wifi} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                            <span className="text-slate-700 font-medium">{wifi}</span>
                            <input
                              type="checkbox"
                              checked={selectedWifiStandards.includes(wifi)}
                              onChange={() => toggleItem(selectedWifiStandards, setSelectedWifiStandards, wifi)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ======================================================== */}
            {/* DYNAMIC SMART FILTER: NETWORKING (SWITCHES / CABLING)     */}
            {/* ======================================================== */}
            {categoryArchetype === 'network' && (
              <div className="border-b border-slate-100 pb-4 space-y-3">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs">
                  <span className="font-bold text-slate-800">پشتیبانی از قابلیت PoE</span>
                  <input
                    type="checkbox"
                    checked={poeOnly}
                    onChange={(e) => setPoeOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>
            )}

            {/* ======================================================== */}
            {/* BRAND FILTER (Applicable for all categories)             */}
            {/* ======================================================== */}
            {schemaFacets.length === 0 && dynamicFilterOptions.brands.length > 0 && (
              <div className="border-b border-slate-100 pb-4">
                <button
                  onClick={() => toggleAccordion('brands')}
                  className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2 cursor-pointer"
                >
                  <span>برند سازنده</span>
                  {accordionState.brands ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {accordionState.brands && (
                  <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {dynamicFilterOptions.brands.map(brand => (
                      <label key={brand} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-xs">
                        <span className="text-slate-700 font-medium">{brand}</span>
                        <input
                          type="checkbox"
                          checked={selectedBrands.includes(brand)}
                          onChange={() => toggleItem(selectedBrands, setSelectedBrands, brand)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* PRICE RANGE FILTER                                       */}
            {/* ======================================================== */}
            <div className="border-b border-slate-100 pb-4">
              <button
                onClick={() => toggleAccordion('price')}
                className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2 cursor-pointer"
              >
                <span>محدوده قیمت</span>
                {accordionState.price ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {accordionState.price && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 font-mono">
                    <span>{formatMoney(priceRange[0], 'IRR')}</span>
                    <span>تا {formatMoney(priceRange[1], 'IRR')}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={maxCatalogPrice}
                    step="5000000"
                    value={Math.min(priceRange[1], maxCatalogPrice)}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPriceRange([0, 250000000])}
                      className="flex-1 py-1 text-[10px] font-bold bg-slate-50 hover:bg-blue-50 rounded-lg text-slate-600 cursor-pointer"
                    >
                      زیر ۲۵ م
                    </button>
                    <button
                      onClick={() => setPriceRange([250000000, 500000000])}
                      className="flex-1 py-1 text-[10px] font-bold bg-slate-50 hover:bg-blue-50 rounded-lg text-slate-600 cursor-pointer"
                    >
                      ۲۵ تا ۵۰ م
                    </button>
                    <button
                      onClick={() => setPriceRange([500000000, maxCatalogPrice])}
                      className="flex-1 py-1 text-[10px] font-bold bg-slate-50 hover:bg-blue-50 rounded-lg text-slate-600 cursor-pointer"
                    >
                      بالای ۵۰ م
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* GENERAL COLORS (If not Simcard or Laptop)                */}
            {/* ======================================================== */}
            {categoryArchetype === 'general' && (
              <div className="border-b border-slate-100 pb-4">
                <button
                  onClick={() => toggleAccordion('colors')}
                  className="w-full flex items-center justify-between text-xs font-extrabold text-slate-900 pb-2 cursor-pointer"
                >
                  <span>رنگ‌بندی</span>
                  {accordionState.colors ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {accordionState.colors && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {colorPalette.map(color => (
                      <button
                        key={color.name}
                        onClick={() => toggleItem(selectedColors, setSelectedColors, color.name)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition ${
                          selectedColors.includes(color.name)
                            ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-bold'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full ${color.border ? 'border border-slate-300' : ''}`}
                          style={{ backgroundColor: color.hex }}
                        />
                        <span>{color.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: SEARCH, ACTIVE TAGS, SORT, PRODUCT GRID    */}
        {/* ======================================================== */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Top Control Bar: Search Input, Mobile Buttons, Desktop Sort Bar */}
          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs space-y-3">
            
            <div className="flex items-center gap-3">
              {/* Search inside catalog */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو در نام محصول، برند، مشخصات..."
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-2.5 pr-10 pl-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Mobile Filter & Sort Buttons */}
              <div className="flex items-center gap-2 lg:hidden">
                <button
                  onClick={() => setMobileFilterOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-blue-50 text-blue-700 font-bold text-xs border border-blue-100 active:scale-95"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>فیلترها</span>
                  {activeFiltersCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-mono">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setMobileSortOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs active:scale-95"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>مرتب‌سازی</span>
                </button>
              </div>
            </div>

            {/* Desktop Sort Options Bar */}
            <div className="hidden lg:flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
                <span>مرتب‌سازی:</span>
                <div className="flex items-center gap-1">
                  {sortOptions.map(option => (
                    <button
                      key={option.id}
                      onClick={() => setSortBy(option.id as any)}
                      className={`px-3 py-1.5 rounded-xl transition text-xs font-bold ${
                        sortBy === option.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-slate-400 font-medium">
                نمایش <span className="font-bold text-slate-700 font-mono">{sortedProducts.length.toLocaleString('fa-IR')}</span> کالا
              </div>
            </div>

          </div>

          {/* Active Filter Tags Bar (Torob Style) */}
          {activeFiltersCount > 0 && (
            <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3 flex items-center gap-2 flex-wrap text-xs animate-in fade-in duration-150">
              <span className="font-bold text-blue-900 text-[11px] shrink-0">فیلترهای فعال:</span>

              {inStockOnly && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-blue-200 text-blue-800 font-semibold shadow-2xs">
                  فقط کالاهای موجود
                  <button onClick={() => setInStockOnly(false)} className="hover:text-red-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedBrands.map(b => (
                <span key={b} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-blue-200 text-blue-800 font-semibold shadow-2xs">
                  برند: {b}
                  <button onClick={() => toggleItem(selectedBrands, setSelectedBrands, b)} className="hover:text-red-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {selectedSimOperators.map(op => (
                <span key={op} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-blue-200 text-blue-800 font-semibold shadow-2xs">
                  اپراتور: {op}
                  <button onClick={() => toggleItem(selectedSimOperators, setSelectedSimOperators, op)} className="hover:text-red-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {selectedSimTypes.map(st => (
                <span key={st} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-blue-200 text-blue-800 font-semibold shadow-2xs">
                  نوع: {st}
                  <button onClick={() => toggleItem(selectedSimTypes, setSelectedSimTypes, st)} className="hover:text-red-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {selectedCpus.map(cpu => (
                <span key={cpu} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-blue-200 text-blue-800 font-semibold shadow-2xs">
                  CPU: {cpu}
                  <button onClick={() => toggleItem(selectedCpus, setSelectedCpus, cpu)} className="hover:text-red-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {selectedRams.map(ram => (
                <span key={ram} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-blue-200 text-blue-800 font-semibold shadow-2xs">
                  RAM: {ram}
                  <button onClick={() => toggleItem(selectedRams, setSelectedRams, ram)} className="hover:text-red-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {selectedNetworkGens.map(gen => (
                <span key={gen} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-blue-200 text-blue-800 font-semibold shadow-2xs">
                  نسل: {gen}
                  <button onClick={() => toggleItem(selectedNetworkGens, setSelectedNetworkGens, gen)} className="hover:text-red-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <button
                onClick={resetFilters}
                className="text-[11px] font-bold text-red-600 hover:underline mr-auto cursor-pointer"
              >
                حذف همه فیلترها
              </button>
            </div>
          )}

          {activeCategory && dynamicFilterOptions.brands.length > 0 && (
            <section aria-label={`برندهای ${activeCategory.name}`} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-2xs sm:px-4">
              <div className="hidden shrink-0 items-center gap-2 border-l border-slate-100 pl-3 sm:flex">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600"><Layers className="h-4 w-4" /></span>
                <div className="leading-tight">
                  <p className="text-[11px] font-extrabold text-slate-800">برندهای {activeCategory.name}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{dynamicFilterOptions.brands.length.toLocaleString('fa-IR')} برند</p>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 snap-x snap-mandatory items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {dynamicFilterOptions.brands.map((brand) => {
                  const selected = selectedBrands.includes(brand);
                  return (
                    <button key={brand} type="button" onClick={() => selectBrandFromCategory(brand)} aria-pressed={selected} className={`group flex h-10 shrink-0 snap-start items-center gap-2 rounded-xl border px-2.5 text-xs font-extrabold transition active:scale-[0.97] ${selected ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-500/25' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'}`}>
                      <span className={`grid h-6 w-6 place-items-center rounded-lg text-[10px] font-black ${selected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700'}`}>{brand.slice(0, 1)}</span>
                      <span>{brand}</span>
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
              <span className="shrink-0 text-[10px] font-bold text-slate-400 sm:hidden">برندها</span>
            </section>
          )}

          {/* ======================================================== */}
          {/* PRODUCT GRID                                             */}
          {/* ======================================================== */}
          {isLoadingData ? (
            <ProductGridSkeleton count={6} />
          ) : sortedProducts.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-xs text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <PackageX className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-800">
                  {storefrontProducts.length === 0 ? 'محصول قابل نمایش در فروشگاه ثبت نشده است' : 'کالایی با مشخصات انتخابی یافت نشد'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {storefrontProducts.length === 0
                    ? 'به‌محض تکمیل اطلاعات و موجودی کالاها، محصولات این بخش در دسترس خواهند بود.'
                    : 'لطفاً فیلترهای اعمال‌شده را تغییر دهید یا عبارت جستجو را پاک کنید.'}
                </p>
              </div>
              <button
                onClick={storefrontProducts.length === 0 ? () => setActiveView('home') : resetFilters}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer"
              >
                {storefrontProducts.length === 0 ? 'بازگشت به صفحه اصلی' : 'پاکسازی فیلترها و مشاهده همه کالاها'}
              </button>
            </div>
          ) : (
            <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 transition-opacity duration-150 ${isGridLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              {sortedProducts.map(product => {
                const effectivePrice = product.effective_price || product.base_price;
                const discount = product.discount_percent || (product.base_price > effectivePrice ? Math.round(((product.base_price - effectivePrice) / product.base_price) * 100) : 0);
                const isFav = isFavorite(product.id);
                const quickVariant = getDefaultSellableVariant(product);
                const requiresConfigurationSelection = Boolean(product.variant_options?.length);
                const productIsAvailable = isProductPurchasable(product);
                // A card can add the default sellable variant directly. This keeps the
                // selection flow only for products that have no sellable variant at all.
                const canQuickAdd = productIsAvailable && Boolean(quickVariant?.id);
                const cartItem = cart.find((item) => item.product_variant_id === quickVariant?.id);
                const isAtStockLimit = Boolean(
                  cartItem
                  && quickVariant?.stock_quantity !== undefined
                  && cartItem.quantity >= quickVariant.stock_quantity,
                );

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-3xl p-4 border border-slate-100 shadow-2xs hover:shadow-xl hover:border-blue-100 transition duration-200 flex flex-col justify-between group relative"
                  >
                    
                    {/* Top Badges & Favorite Button */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {discount > 0 && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-red-500 text-white ui-text-badge ui-numeric shadow-xs">
                            {discount}٪ تخفیف
                          </span>
                        )}
                        {productIsAvailable ? (
                          <span className={`px-2.5 py-0.5 rounded-lg ui-text-badge border ${
                            requiresConfigurationSelection
                               ? 'bg-blue-50 text-blue-700 border-blue-200/60'
                              : isAtStockLimit
                              ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                          }`}>
                            {requiresConfigurationSelection ? 'انتخاب پیکربندی' : isAtStockLimit ? 'موجودی محصول تمام شده است' : 'موجود در انبار'}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-500 ui-text-badge">
                            ناموجود
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => toggleFavorite(product.id)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-90 ${
                          isFav ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50'
                        }`}
                        aria-label="افزودن به علاقه‌مندی‌ها"
                      >
                        <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500' : ''}`} />
                      </button>
                    </div>

                    {/* Product Image */}
                    <div 
                      onClick={() => navigateToProduct(product.slug)}
                      className="relative h-44 w-full flex items-center justify-center overflow-hidden rounded-2xl bg-slate-50/70 p-2 cursor-pointer group-hover:bg-blue-50/20 transition"
                    >
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/product-placeholder.svg'; }}
                      />
                    </div>

                    {/* Product Details */}
                    <div className="mt-3 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Brand & Category Label */}
                        <div className="flex items-center justify-between ui-text-meta text-slate-400 font-medium">
                          <span>{product.brand || 'نوین‌نت'}</span>
                          <span>{product.category_name}</span>
                        </div>

                        {/* Title */}
                        <h3 
                          onClick={() => navigateToProduct(product.slug)}
                          className="ui-text-card-title text-slate-900 hover:text-blue-600 transition cursor-pointer line-clamp-2 mt-1"
                        >
                          {product.name}
                        </h3>

                        {/* Dynamic Category Badges (CPU/RAM for laptop, Operator for SIM, Gen for modem) */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          {product.processor && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 ui-text-badge font-medium">
                              {product.processor}
                            </span>
                          )}
                          {product.ram && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 ui-text-badge">
                              RAM: {product.ram}
                            </span>
                          )}
                          {product.sim_operator && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 ui-text-badge">
                              {product.sim_operator}
                            </span>
                          )}
                          {product.network_generation && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 ui-text-badge">
                              {product.network_generation}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Price & Action Row */}
                      <div className="pt-3 border-t border-slate-100 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 mt-2">
                        <div className="min-w-0">
                          {discount > 0 && (
                            <div className="ui-text-meta text-slate-400 line-through ui-numeric">
                              {(product.base_price || 0).toLocaleString('fa-IR')}
                            </div>
                          )}
                          <div className="ui-price leading-tight text-blue-700 whitespace-nowrap">
                            {formatMoney(effectivePrice, product.currency)}
                          </div>
                        </div>

                        {/* Quick Cart / Quantity Buttons */}
                        {canQuickAdd ? (
                          cartItem ? (
                            <div dir="ltr" className="flex shrink-0 items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-xl p-1 shadow-2xs" aria-label="تعداد کالا در سبد خرید">
                              <button
                                onClick={() => addToCart(product, 1, quickVariant?.id)}
                                disabled={isAtStockLimit}
                                title={isAtStockLimit ? 'موجودی محصول تمام شده است' : 'افزایش تعداد'}
                                className="w-6 h-6 rounded-lg bg-white text-blue-700 flex items-center justify-center font-bold hover:bg-blue-600 hover:text-white transition disabled:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-slate-100 disabled:hover:text-slate-300 disabled:cursor-not-allowed"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <span className="ui-text-button ui-numeric font-semibold text-blue-900 px-1">
                                {cartItem.quantity}
                              </span>
                              <button
                                onClick={() => updateCartQuantity(cartItem.id, cartItem.quantity - 1)}
                                aria-label="کاهش تعداد"
                                className="w-6 h-6 rounded-lg bg-white text-blue-700 flex items-center justify-center font-bold hover:bg-red-500 hover:text-white transition"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(product, 1, quickVariant?.id)}
                              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white ui-text-button flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition active:scale-95"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>سبد خرید</span>
                            </button>
                          )
                        ) : requiresConfigurationSelection ? (
                          <button
                            onClick={() => navigateToProduct(product.slug)}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 text-white ui-text-button shadow-md shadow-blue-500/20"
                          >
                            انتخاب
                          </button>
                        ) : (
                          <button
                            disabled
                            className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 ui-text-button cursor-not-allowed"
                          >
                            ناموجود
                          </button>
                        )}
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* Delivery & Trust Banner */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-yellow-300" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold">ارسال فوق‌سریع سفارش‌های سراسر کشور</h4>
                <p className="text-[11px] text-blue-100 mt-0.5">ضمانت اصالت ۱۰۰٪ کالا + پشتیبانی ۲۴ ساعته نوین‌نت</p>
              </div>
            </div>
            <button
              onClick={() => setActiveView('contact')}
              className="px-4 py-2 rounded-xl bg-white text-blue-700 font-bold text-xs hover:bg-blue-50 transition shrink-0 shadow-xs"
            >
              پشتیبانی و راهنما
            </button>
          </div>

        </div>

      </div>

      {/* ======================================================== */}
      {/* SCALABLE CATEGORY BROWSER                                 */}
      {/* ======================================================== */}
      {categoryBrowserOpen && (
        <ModalPortal>
          <div className="ui-modal-backdrop p-0 sm:p-4 animate-in fade-in duration-150">
          <button
            type="button"
            className="fixed inset-0"
            aria-label="بستن مرور دسته‌بندی‌ها"
            onClick={() => setCategoryBrowserOpen(false)}
          />
          <section className="ui-modal-panel relative z-10 flex h-full w-full flex-col rounded-none sm:h-auto sm:max-h-[min(720px,calc(100dvh-2rem))] sm:max-w-4xl sm:rounded-3xl" aria-label="مرور دسته‌بندی‌های فروشگاه">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Layers className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">مرور دسته‌بندی‌ها</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">دستهٔ موردنظر را جست‌وجو یا انتخاب کنید.</p>
                </div>
              </div>
              <button type="button" onClick={() => setCategoryBrowserOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200" aria-label="بستن"><X className="h-4 w-4" /></button>
            </div>

            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <label className="relative block">
                <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="جست‌وجو در همه دسته‌بندی‌ها"
                  className="ui-control w-full rounded-2xl border border-slate-200 bg-slate-50 pr-10 pl-4 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  autoFocus
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
              <button
                type="button"
                onClick={() => { navigateToCategory(null, []); setCategoryBrowserOpen(false); setCategorySearch(''); }}
                className={`mb-2 flex min-h-10 w-full items-center justify-between rounded-xl border px-3 text-right text-xs font-bold transition ${!selectedCategorySlug ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}
              >
                <span>همه محصولات</span>
                <span className="font-sans text-[11px]">{storefrontProducts.length}</span>
              </button>

              {browseableCategories.length > 0 ? (
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {browseableCategories.map((category) => {
                    const isSelected = selectedCategorySlug === category.slug;
                    return (
                      <button
                        key={category.slug}
                        type="button"
                        onClick={() => {
                          const hierarchy = getCategoryAncestors(category.slug, categories).map((ancestor) => ancestor.slug);
                          navigateToCategory(category.slug, hierarchy.length ? hierarchy : [category.slug]);
                          setCategoryBrowserOpen(false);
                          setCategorySearch('');
                        }}
                        className={`min-h-12 rounded-xl border px-3 py-2.5 text-right transition ${isSelected ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-500/20' : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50'}`}
                      >
                        <span className="block truncate text-xs font-bold">{category.name}</span>
                        {category.product_count !== undefined && <span className={`mt-0.5 block text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{category.product_count} کالا</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-500">دسته‌بندی مطابق جست‌وجوی شما پیدا نشد.</div>
              )}
            </div>
          </section>
          </div>
        </ModalPortal>
      )}

      {/* ======================================================== */}
      {/* MOBILE FILTERS MODAL                                      */}
      {/* ======================================================== */}
      {mobileFilterOpen && (
        <ModalPortal>
          <div className="ui-modal-backdrop flex-col justify-end p-0 lg:hidden">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileFilterOpen(false)}
          />
          
          <div className="fixed inset-x-0 bottom-0 z-10 flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-white shadow-2xl animate-in slide-in-from-bottom">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">فیلترهای کالا</h3>
              </div>
              <button 
                onClick={() => setMobileFilterOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Filters Content */}
            <div className="min-h-0 flex-1 overflow-y-auto space-y-4 overscroll-contain p-4 text-xs">
              
              {/* Category — opens the searchable browser instead of flooding the sheet with chips. */}
              <div>
                <h4 className="mb-2 font-bold text-slate-800">دسته‌بندی</h4>
                <button
                  type="button"
                  onClick={() => { setMobileFilterOpen(false); setCategoryBrowserOpen(true); }}
                  className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-right text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <span className="flex items-center gap-2"><Layers className="h-4 w-4 text-blue-600" />{activeCategory?.name || 'همه محصولات'}</span>
                  <ChevronLeft className="h-4 w-4 text-slate-400" />
                </button>
              </div>

              <section className="border-t border-slate-100 pt-3">
                <label className="flex min-h-12 cursor-pointer items-center justify-between rounded-2xl bg-slate-50 px-3 text-xs">
                  <span className="font-bold text-slate-800">فقط کالاهای موجود</span>
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(event) => setInStockOnly(event.target.checked)}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </section>

              {schemaFacets.map((facet) => <SchemaFacetGroup key={`mobile-${facet.key}`} facet={facet} selected={selectedSchemaFacets[facet.key] || []} open={openSchemaFacetKey === facet.key} onOpen={() => setOpenSchemaFacetKey(facet.key)} onToggle={(value) => toggleSchemaFacet(facet.key, value)} />)}

              {categoryArchetype === 'simcard' && (
                <>
                  <MobileFilterOptionGroup title="اپراتور سیم‌کارت" options={dynamicFilterOptions.simOperators} selected={selectedSimOperators} expanded={mobileFilterSections.simOperator} onToggleExpanded={() => toggleMobileFilterSection('simOperator')} onToggleOption={(option) => toggleItem(selectedSimOperators, setSelectedSimOperators, option)} />
                  <MobileFilterOptionGroup title="نوع خط و سیم‌کارت" options={dynamicFilterOptions.simTypes} selected={selectedSimTypes} expanded={mobileFilterSections.simType} onToggleExpanded={() => toggleMobileFilterSection('simType')} onToggleOption={(option) => toggleItem(selectedSimTypes, setSelectedSimTypes, option)} />
                  <MobileFilterOptionGroup title="وضعیت شماره (رند / صفر)" options={dynamicFilterOptions.simNumberTypes} selected={selectedSimNumberTypes} expanded={mobileFilterSections.simNumberType} onToggleExpanded={() => toggleMobileFilterSection('simNumberType')} onToggleOption={(option) => toggleItem(selectedSimNumberTypes, setSelectedSimNumberTypes, option)} />
                  <MobileFilterOptionGroup title="پیش‌شماره" options={dynamicFilterOptions.simPrefixes} selected={selectedSimPrefixes} expanded={mobileFilterSections.simPrefix} onToggleExpanded={() => toggleMobileFilterSection('simPrefix')} onToggleOption={(option) => toggleItem(selectedSimPrefixes, setSelectedSimPrefixes, option)} variant="chips" />
                </>
              )}

              {categoryArchetype === 'laptop' && schemaFacets.length === 0 && (
                <>
                  <MobileFilterOptionGroup title="پردازنده (CPU)" options={dynamicFilterOptions.cpus} selected={selectedCpus} expanded={mobileFilterSections.cpu} onToggleExpanded={() => toggleMobileFilterSection('cpu')} onToggleOption={(option) => toggleItem(selectedCpus, setSelectedCpus, option)} />
                  <MobileFilterOptionGroup title="حافظه رم (RAM)" options={dynamicFilterOptions.rams} selected={selectedRams} expanded={mobileFilterSections.ram} onToggleExpanded={() => toggleMobileFilterSection('ram')} onToggleOption={(option) => toggleItem(selectedRams, setSelectedRams, option)} variant="chips" />
                  <MobileFilterOptionGroup title="حافظه داخلی (SSD)" options={dynamicFilterOptions.storages} selected={selectedStorages} expanded={mobileFilterSections.storage} onToggleExpanded={() => toggleMobileFilterSection('storage')} onToggleOption={(option) => toggleItem(selectedStorages, setSelectedStorages, option)} />
                  <MobileFilterOptionGroup title="کارت گرافیک (GPU)" options={dynamicFilterOptions.gpus} selected={selectedGpus} expanded={mobileFilterSections.gpu} onToggleExpanded={() => toggleMobileFilterSection('gpu')} onToggleOption={(option) => toggleItem(selectedGpus, setSelectedGpus, option)} />
                  <MobileFilterOptionGroup title="اندازه صفحه نمایش" options={dynamicFilterOptions.screenSizes} selected={selectedScreenSizes} expanded={mobileFilterSections.screen} onToggleExpanded={() => toggleMobileFilterSection('screen')} onToggleOption={(option) => toggleItem(selectedScreenSizes, setSelectedScreenSizes, option)} />
                </>
              )}

              {categoryArchetype === 'modem' && schemaFacets.length === 0 && (
                <>
                  <MobileFilterOptionGroup title="نسل شبکه و تکنولوژی" options={dynamicFilterOptions.networkGens} selected={selectedNetworkGens} expanded={mobileFilterSections.networkGen} onToggleExpanded={() => toggleMobileFilterSection('networkGen')} onToggleOption={(option) => toggleItem(selectedNetworkGens, setSelectedNetworkGens, option)} />
                  <MobileFilterOptionGroup title="نوع مودم" options={dynamicFilterOptions.modemTypes} selected={selectedModemTypes} expanded={mobileFilterSections.modemType} onToggleExpanded={() => toggleMobileFilterSection('modemType')} onToggleOption={(option) => toggleItem(selectedModemTypes, setSelectedModemTypes, option)} />
                  <MobileFilterOptionGroup title="استاندارد Wi-Fi" options={dynamicFilterOptions.wifiStandards} selected={selectedWifiStandards} expanded={mobileFilterSections.wifi} onToggleExpanded={() => toggleMobileFilterSection('wifi')} onToggleOption={(option) => toggleItem(selectedWifiStandards, setSelectedWifiStandards, option)} />
                </>
              )}

              {categoryArchetype === 'network' && (
                <section className="border-t border-slate-100 pt-3">
                  <label className="flex min-h-12 cursor-pointer items-center justify-between rounded-2xl bg-slate-50 px-3 text-xs">
                    <span className="font-bold text-slate-800">پشتیبانی از قابلیت PoE</span>
                    <input type="checkbox" checked={poeOnly} onChange={(event) => setPoeOnly(event.target.checked)} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" />
                  </label>
                </section>
              )}

              {schemaFacets.length === 0 && <MobileFilterOptionGroup title="برند سازنده" options={dynamicFilterOptions.brands} selected={selectedBrands} expanded={mobileFilterSections.brands} onToggleExpanded={() => toggleMobileFilterSection('brands')} onToggleOption={(option) => toggleItem(selectedBrands, setSelectedBrands, option)} />}

              <section className="border-t border-slate-100 pt-3">
                <button type="button" onClick={() => toggleMobileFilterSection('price')} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-1 text-right text-xs font-extrabold text-slate-800" aria-expanded={mobileFilterSections.price}>
                  <span>محدوده قیمت</span>
                  {mobileFilterSections.price ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {mobileFilterSections.price && (
                  <div className="mt-2 space-y-3 rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 font-sans">
                      <span>{formatMoney(priceRange[0], 'IRR')}</span>
                      <span>تا {formatMoney(priceRange[1], 'IRR')}</span>
                    </div>
                    <input type="range" min="0" max={maxCatalogPrice} step="5000000" value={Math.min(priceRange[1], maxCatalogPrice)} onChange={(event) => setPriceRange([priceRange[0], Number(event.target.value)])} className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600" />
                    <div className="grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => setPriceRange([0, 250000000])} className="min-h-9 rounded-xl bg-white px-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">زیر ۲۵ م</button>
                      <button type="button" onClick={() => setPriceRange([250000000, 500000000])} className="min-h-9 rounded-xl bg-white px-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">۲۵ تا ۵۰ م</button>
                      <button type="button" onClick={() => setPriceRange([500000000, maxCatalogPrice])} className="min-h-9 rounded-xl bg-white px-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">بالای ۵۰ م</button>
                    </div>
                  </div>
                )}
              </section>

              {categoryArchetype === 'general' && (
                <section className="border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => toggleMobileFilterSection('colors')} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-1 text-right text-xs font-extrabold text-slate-800" aria-expanded={mobileFilterSections.colors}>
                    <span>رنگ‌بندی</span>
                    {mobileFilterSections.colors ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </button>
                  {mobileFilterSections.colors && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {colorPalette.map((color) => {
                        const isSelected = selectedColors.includes(color.name);
                        return (
                          <button key={color.name} type="button" onClick={() => toggleItem(selectedColors, setSelectedColors, color.name)} className={`min-h-9 rounded-xl border px-3 text-xs font-bold transition ${isSelected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                            <span className={`ml-1.5 inline-block h-3.5 w-3.5 rounded-full align-middle ${color.border ? 'border border-slate-300' : ''}`} style={{ backgroundColor: color.hex }} />
                            {color.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

            </div>

            {/* Sticky Action Footer */}
            <div className="flex shrink-0 items-center gap-3 border-t border-slate-100 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                onClick={resetFilters}
                className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-red-600 font-bold text-xs"
              >
                پاک کردن
              </button>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 text-center"
              >
                مشاهده {sortedProducts.length.toLocaleString('fa-IR')} محصول
              </button>
            </div>

          </div>
          </div>
        </ModalPortal>
      )}

      {/* ======================================================== */}
      {/* MOBILE SORT MODAL                                        */}
      {/* ======================================================== */}
      {mobileSortOpen && (
        <ModalPortal>
          <div className="ui-modal-backdrop flex-col justify-end p-0 lg:hidden">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMobileSortOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-10 w-full rounded-t-[28px] bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-sm font-extrabold text-slate-800">مرتب‌سازی کالاها</span>
              <button onClick={() => setMobileSortOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100" aria-label="بستن مرتب‌سازی">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {sortOptions.map(option => (
              <button
                key={option.id}
                onClick={() => {
                  setSortBy(option.id as any);
                  setMobileSortOpen(false);
                }}
                className={`mt-1.5 flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-right text-xs font-semibold ${
                  sortBy === option.id ? 'bg-blue-50 text-blue-700 font-extrabold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{option.label}</span>
                {sortBy === option.id && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            ))}
          </div>
          </div>
        </ModalPortal>
      )}

    </div>
  );
};
