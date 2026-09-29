export interface SEOConfig {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  ogType?: 'website' | 'product' | 'article';
}

const DEFAULT_STORE_TITLE = 'آبتین تک | فروشگاه تخصصی لوازم دیجیتال و لپ‌تاپ';
const DEFAULT_STORE_DESCRIPTION = 'مرجع تخصصی خرید آنلاین لپ‌تاپ، تبلت، قطعات سخت‌افزار، تجهیزات شبکه و خدمات گارانتی و تعمیرات با بهترین قیمت و ضمانت اصالت.';

/**
 * Updates dynamic head metadata (Title, Meta Description, Canonical, and OpenGraph tags)
 * without memory leaks or stale tags.
 */
export function updateDocumentSEO(config: SEOConfig) {
  if (typeof document === 'undefined') return;

  // 1. Update Title
  const pageTitle = config.title ? `${config.title}` : DEFAULT_STORE_TITLE;
  document.title = pageTitle;

  // 2. Update Meta Description
  const metaDesc = config.description || DEFAULT_STORE_DESCRIPTION;
  setMetaTag('name', 'description', metaDesc);

  // 3. Update Canonical Link
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const canonicalUrl = config.canonical 
    ? (config.canonical.startsWith('http') ? config.canonical : `${currentOrigin}${config.canonical.startsWith('/') ? config.canonical : `/${config.canonical}`}`)
    : (typeof window !== 'undefined' ? window.location.href.split('?')[0] : '');

  if (canonicalUrl) {
    let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', canonicalUrl);
  }

  // 4. Update Open Graph Meta Tags
  setMetaTag('property', 'og:title', pageTitle);
  setMetaTag('property', 'og:description', metaDesc);
  setMetaTag('property', 'og:type', config.ogType || 'website');
  if (canonicalUrl) {
    setMetaTag('property', 'og:url', canonicalUrl);
  }
  if (config.image) {
    const imageUrl = config.image.startsWith('http') ? config.image : `${currentOrigin}${config.image}`;
    setMetaTag('property', 'og:image', imageUrl);
  } else {
    removeMetaTag('property', 'og:image');
  }
}

function setMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  let element = document.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function removeMetaTag(attrName: 'name' | 'property', attrValue: string) {
  const element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}
