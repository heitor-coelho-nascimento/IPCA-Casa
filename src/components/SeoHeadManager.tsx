import React, { useEffect } from 'react';
import {
  SITE_NAME,
  buildSchemaOrgJsonLd,
  getGoogleSearchConsoleCode,
  getRouteSeoMetadata,
  normalizeCanonicalUrl,
  resolveConfiguredSiteUrl,
} from '../config/seo';
import { initAnalytics, trackPageView } from '../services/analytics';

interface SeoHeadManagerProps {
  currentPath: string;
}

function upsertMetaTag(
  selectorAttr: 'name' | 'property',
  attrValue: string,
  content: string
): void {
  let tag = document.head.querySelector(`meta[${selectorAttr}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(selectorAttr, attrValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function removeMetaTag(selectorAttr: 'name' | 'property', attrValue: string): void {
  const existing = document.head.querySelector(`meta[${selectorAttr}="${attrValue}"]`);
  if (existing) {
    existing.remove();
  }
}

function upsertCanonicalLink(href: string): void {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function syncSchemaScripts(schemas: Record<string, unknown>[]): void {
  const oldNodes = document.head.querySelectorAll('script[data-ipca-schema="true"]');
  oldNodes.forEach((node) => node.remove());

  for (const schema of schemas) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-ipca-schema', 'true');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }
}

export const SeoHeadManager: React.FC<SeoHeadManagerProps> = ({ currentPath }) => {
  useEffect(() => {
    const routeMeta = getRouteSeoMetadata(currentPath);
    const siteUrl = resolveConfiguredSiteUrl();
    const canonicalUrl = normalizeCanonicalUrl(routeMeta.path, siteUrl);
    const ogImageUrl = `${new URL(canonicalUrl).origin}${routeMeta.imagePath}`;
    const gscCode = getGoogleSearchConsoleCode();

    document.title = routeMeta.title;

    upsertMetaTag('name', 'description', routeMeta.description);
    upsertMetaTag('name', 'robots', routeMeta.robots);
    upsertCanonicalLink(canonicalUrl);

    // OpenGraph & Twitter
    upsertMetaTag('property', 'og:type', routeMeta.ogType);
    upsertMetaTag('property', 'og:site_name', SITE_NAME);
    upsertMetaTag('property', 'og:locale', 'pt_BR');
    upsertMetaTag('property', 'og:title', routeMeta.title);
    upsertMetaTag('property', 'og:description', routeMeta.description);
    upsertMetaTag('property', 'og:url', canonicalUrl);
    upsertMetaTag('property', 'og:image', ogImageUrl);
    upsertMetaTag('property', 'og:image:alt', routeMeta.imageAlt);

    upsertMetaTag('name', 'twitter:card', 'summary_large_image');
    upsertMetaTag('name', 'twitter:title', routeMeta.title);
    upsertMetaTag('name', 'twitter:description', routeMeta.description);
    upsertMetaTag('name', 'twitter:image', ogImageUrl);

    // Google Search Console verification tag: apenas páginas públicas e somente com código configurado
    if (routeMeta.isPublic && routeMeta.includeSearchConsoleTag && gscCode) {
      upsertMetaTag('name', 'google-site-verification', gscCode);
    } else {
      removeMetaTag('name', 'google-site-verification');
    }

    // Schema.org JSON-LD apenas em páginas públicas
    if (routeMeta.isPublic && routeMeta.includeSchema) {
      syncSchemaScripts(buildSchemaOrgJsonLd(routeMeta, siteUrl));
    } else {
      syncSchemaScripts([]);
    }

    initAnalytics();
    trackPageView(routeMeta.path, routeMeta.title);
  }, [currentPath]);

  return null;
};
