import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  LANDING_FAQS,
  PUBLIC_ROUTES,
  buildSchemaOrgJsonLd,
  getGoogleSearchConsoleCode,
  getRouteSeoMetadata,
  normalizeCanonicalUrl,
  resolveConfiguredSiteUrl,
} from '../src/config/seo';
import {
  generateLlmsTxt,
  generateRobotsTxt,
  generateSitemapXml,
  injectRouteSeoHtml,
} from '../src/config/seoFiles';
import {
  getConsentStatus,
  isValidGaMeasurementId,
  resetAnalyticsForTests,
  sanitizeAnalyticsParams,
  setConsentStatus,
  trackCalculateImpact,
  trackPageView,
  trackViewIpca,
} from '../src/services/analytics';

describe('SEO Técnico, Indexação, Canônicas e Analytics Seguro (IPCA-Casa)', () => {
  it('Mantém títulos (30-60 caracteres) e descrições (120-160 caracteres) únicos para todas as rotas públicas', () => {
    const publicList = Object.values(PUBLIC_ROUTES);
    expect(publicList.map((r) => r.path)).toEqual([
      '/',
      '/como-funciona',
      '/metodologia',
      '/ipca-oficial',
      '/privacidade',
    ]);

    const titles = new Set<string>();
    const descriptions = new Set<string>();

    for (const route of publicList) {
      expect(route.isPublic).toBe(true);
      expect(route.inSitemap).toBe(true);
      expect(route.includeSchema).toBe(true);
      expect(route.includeSearchConsoleTag).toBe(true);

      expect(route.title.length).toBeGreaterThanOrEqual(30);
      expect(route.title.length).toBeLessThanOrEqual(60);
      expect(route.description.length).toBeGreaterThanOrEqual(120);
      expect(route.description.length).toBeLessThanOrEqual(160);

      titles.add(route.title);
      descriptions.add(route.description);
    }

    expect(titles.size).toBe(publicList.length);
    expect(descriptions.size).toBe(publicList.length);
  });

  it('Protege rotas privadas, autenticação, demonstração e 404 com noindex e fora do sitemap', () => {
    const blockedPaths = [
      '/login',
      '/cadastro',
      '/recuperar-senha',
      '/demo',
      '/painel',
      '/painel/visao-geral',
      '/painel/configuracoes',
      '/pagina-que-nao-existe',
    ];

    for (const pathItem of blockedPaths) {
      const meta = getRouteSeoMetadata(pathItem);
      expect(meta.isPublic).toBe(false);
      expect(meta.robots).toContain('noindex');
      expect(meta.robots).toContain('nofollow');
      expect(meta.inSitemap).toBe(false);
      expect(meta.includeSchema).toBe(false);
      expect(meta.includeSearchConsoleTag).toBe(false);
    }
  });

  it('Normaliza URLs canônicas com HTTPS, regra www/non-www e sem query string ou barra extra', () => {
    expect(
      normalizeCanonicalUrl('/como-funciona/?utm_source=google#topo', 'http://www.ipcacasa.com.br', 'non-www')
    ).toBe('https://ipcacasa.com.br/como-funciona');

    expect(
      normalizeCanonicalUrl('/ipca-oficial', 'https://ipcacasa.com.br/', 'www')
    ).toBe('https://www.ipcacasa.com.br/ipca-oficial');

    expect(normalizeCanonicalUrl('/', 'http://localhost:3000', 'non-www')).toBe(
      'http://localhost:3000/'
    );

    const prevAppUrl = process.env.APP_URL;
    const prevViteSiteUrl = process.env.VITE_SITE_URL;
    try {
      delete process.env.VITE_SITE_URL;
      process.env.APP_URL = 'https://app-env-fallback.a.run.app';
      expect(resolveConfiguredSiteUrl('https://preview-123.a.run.app', '')).toBe(
        'https://app-env-fallback.a.run.app'
      );

      delete process.env.APP_URL;
      expect(resolveConfiguredSiteUrl('https://preview-123.a.run.app', '')).toBe(
        'https://preview-123.a.run.app'
      );
    } finally {
      if (prevAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prevAppUrl;
      if (prevViteSiteUrl === undefined) delete process.env.VITE_SITE_URL;
      else process.env.VITE_SITE_URL = prevViteSiteUrl;
    }
  });

  it('Valida código do Google Search Console e omite meta tag em rotas privadas ou sem configuração', () => {
    expect(getGoogleSearchConsoleCode('')).toBeNull();
    expect(getGoogleSearchConsoleCode('MY_VERIFICATION_CODE')).toBeNull();
    expect(getGoogleSearchConsoleCode('"><script>alert(1)</script>')).toBeNull();
    expect(getGoogleSearchConsoleCode('AbCdEf123456_xyz-789')).toBe('AbCdEf123456_xyz-789');

    const baseHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');

    const publicHtmlWithoutEnv = injectRouteSeoHtml(
      baseHtml,
      '/metodologia',
      'https://ipcacasa.com.br',
      ''
    );
    expect(publicHtmlWithoutEnv).not.toContain('google-site-verification');
    expect(publicHtmlWithoutEnv).toContain('<link rel="canonical" href="https://ipcacasa.com.br/metodologia"');

    const publicHtmlWithEnv = injectRouteSeoHtml(
      baseHtml,
      '/',
      'https://ipcacasa.com.br',
      'AbCdEf123456_xyz-789'
    );
    expect(publicHtmlWithEnv).toContain(
      '<meta name="google-site-verification" content="AbCdEf123456_xyz-789" />'
    );
    expect(publicHtmlWithEnv).toContain('application/ld+json');

    const privateHtml = injectRouteSeoHtml(
      baseHtml,
      '/painel/visao-geral',
      'https://ipcacasa.com.br',
      'AbCdEf123456_xyz-789'
    );
    expect(privateHtml).not.toContain('google-site-verification');
    expect(privateHtml).not.toContain('application/ld+json');
    expect(privateHtml).toContain('<meta name="robots" content="noindex, nofollow" />');
  });

  it('Gera dados estruturados Schema.org reais (sem LocalBusiness, avaliações ou preços inventados)', () => {
    const homeSchemas = buildSchemaOrgJsonLd(PUBLIC_ROUTES['/'], 'https://ipcacasa.com.br');
    expect(homeSchemas.length).toBe(2);

    const webApp = homeSchemas[0];
    expect(webApp['@type']).toBe('WebApplication');
    expect(webApp.name).toBe('IPCA-Casa');
    expect(webApp.applicationCategory).toBe('FinanceApplication');
    expect(webApp).not.toHaveProperty('aggregateRating');
    expect(webApp).not.toHaveProperty('offers');

    const faqSchema = homeSchemas[1];
    expect(faqSchema['@type']).toBe('FAQPage');
    expect(Array.isArray(faqSchema.mainEntity)).toBe(true);
    expect((faqSchema.mainEntity as unknown[]).length).toBe(LANDING_FAQS.length);

    const serialized = JSON.stringify(homeSchemas);
    expect(serialized).not.toContain('LocalBusiness');

    const subPageSchemas = buildSchemaOrgJsonLd(
      PUBLIC_ROUTES['/ipca-oficial'],
      'https://ipcacasa.com.br'
    );
    expect(subPageSchemas.map((s) => s['@type'])).toEqual(['WebPage', 'BreadcrumbList']);

    expect(
      buildSchemaOrgJsonLd(getRouteSeoMetadata('/login'), 'https://ipcacasa.com.br')
    ).toEqual([]);
  });

  it('Gera /sitemap.xml, /robots.txt e /llms.txt coerentes e sem rotas privadas', () => {
    const sitemap = generateSitemapXml('https://ipcacasa.com.br');
    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(sitemap).toContain('<loc>https://ipcacasa.com.br/</loc>');
    expect(sitemap).toContain('<loc>https://ipcacasa.com.br/como-funciona</loc>');
    expect(sitemap).toContain('<loc>https://ipcacasa.com.br/metodologia</loc>');
    expect(sitemap).toContain('<loc>https://ipcacasa.com.br/ipca-oficial</loc>');
    expect(sitemap).toContain('<loc>https://ipcacasa.com.br/privacidade</loc>');
    expect(sitemap).not.toContain('/login');
    expect(sitemap).not.toContain('/cadastro');
    expect(sitemap).not.toContain('/demo');
    expect(sitemap).not.toContain('/painel');
    expect(sitemap).not.toContain('/api');

    const robots = generateRobotsTxt('https://ipcacasa.com.br');
    expect(robots).toContain('Allow: /ipca-oficial');
    expect(robots).toContain('Allow: /llms.txt');
    expect(robots).toContain('Disallow: /login');
    expect(robots).toContain('Disallow: /painel');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain('Sitemap: https://ipcacasa.com.br/sitemap.xml');

    const llms = generateLlmsTxt('https://ipcacasa.com.br');
    expect(llms).toContain('# IPCA-Casa');
    expect(llms).toContain('Laspeyres');
    expect(llms).toContain('1737');
    expect(llms).toContain('7060');
    expect(llms).toContain('9256-ipca.html');
    expect(llms).toContain('https://ipcacasa.com.br/como-funciona');

    const staticLlms = fs.readFileSync(path.resolve(process.cwd(), 'public', 'llms.txt'), 'utf-8');
    expect(staticLlms).toContain('# IPCA-Casa');
    expect(staticLlms).toContain('1737');
    expect(staticLlms).toContain('7060');
  });

  describe('GA4 Privacy Firewall & Consent Mode', () => {
    let storageMap: Map<string, string>;
    let appendedScripts: Array<{ async: boolean; src: string; attrs: Record<string, string> }>;
    let dataLayer: unknown[];

    beforeEach(() => {
      resetAnalyticsForTests();
      storageMap = new Map();
      appendedScripts = [];
      dataLayer = [];

      vi.stubGlobal('window', {
        location: { origin: 'https://ipcacasa.com.br' },
        dataLayer,
        localStorage: {
          getItem: (key: string) => storageMap.get(key) ?? null,
          setItem: (key: string, value: string) => storageMap.set(key, value),
        },
      });

      vi.stubGlobal('document', {
        querySelector: (selector: string) =>
          appendedScripts.find((s) => selector.includes(s.attrs['data-ipca-ga4-script'] || '')) ??
          null,
        head: {
          querySelector: (selector: string) =>
            appendedScripts.find((s) => selector.includes(s.attrs['data-ipca-ga4-script'] || '')) ??
            null,
          appendChild: (node: { async: boolean; src: string; attrs: Record<string, string> }) => {
            appendedScripts.push(node);
            return node;
          },
        },
        createElement: () => {
          const attrs: Record<string, string> = {};
          return {
            async: false,
            src: '',
            attrs,
            setAttribute: (k: string, v: string) => {
              attrs[k] = v;
            },
          };
        },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      delete process.env.VITE_GA_MEASUREMENT_ID;
      resetAnalyticsForTests();
    });

    it('Valida Measurement IDs e rejeita placeholders fictícios', () => {
      expect(isValidGaMeasurementId('')).toBe(false);
      expect(isValidGaMeasurementId('G-XXXXXXXXXX')).toBe(false);
      expect(isValidGaMeasurementId('G-00000000')).toBe(false);
      expect(isValidGaMeasurementId('UA-123456-1')).toBe(false);
      expect(isValidGaMeasurementId('G-ABC1234DEF')).toBe(true);
    });

    it('Remove dados financeiros e PII antes do envio ao GA4', () => {
      const sanitized = sanitizeAnalyticsParams({
        email: 'usuario@teste.com',
        display_name: 'Maria Silva',
        income_total: 8500,
        monthly_spend: 3200,
        salary_needed: 9100,
        uid: 'firebase-uid-999',
        custom_note: 'Gastei R$ 450 no mercado',
        another_note: 'contato@familia.com.br',
        surface: 'hero-simulator',
        perspective: 'impacto-anual',
        section_tab: 'ipca-oficial',
      });

      expect(sanitized).toEqual({
        surface: 'hero-simulator',
        perspective: 'impacto-anual',
        section_tab: 'ipca-oficial',
      });
    });

    it('Exige consentimento, evita scripts duplicados e evita page_views repetidos na navegação SPA', () => {
      process.env.VITE_GA_MEASUREMENT_ID = 'G-TEST123456';

      expect(getConsentStatus()).toBeNull();
      // Sem consentimento não injeta script nem dispara eventos
      expect(trackViewIpca({ surface: 'public', timeframe: '12M' })).toBe(false);
      expect(appendedScripts.length).toBe(0);

      // Negar consentimento mantém bloqueado
      setConsentStatus('denied', 'G-TEST123456');
      expect(getConsentStatus()).toBe('denied');
      expect(trackCalculateImpact('anual', 'hero-simulator')).toBe(false);
      expect(appendedScripts.length).toBe(0);

      // Conceder consentimento injeta script apenas 1x e habilita eventos sanitizados
      setConsentStatus('granted', 'G-TEST123456');
      setConsentStatus('granted', 'G-TEST123456');
      expect(appendedScripts.length).toBe(1);
      expect(appendedScripts[0].async).toBe(true);
      expect(appendedScripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST123456');

      expect(trackPageView('/ipca-oficial', 'IPCA Oficial')).toBe(true);
      // Mesmo page_view em sequência não duplica
      expect(trackPageView('/ipca-oficial', 'IPCA Oficial')).toBe(false);
      // Nova rota registra
      expect(trackPageView('/metodologia', 'Metodologia')).toBe(true);
      expect(trackViewIpca({ surface: 'public', timeframe: '12M', source_mode: 'live' })).toBe(true);

      const serializedEvents = JSON.stringify(dataLayer);
      expect(serializedEvents).toContain('view_ipca');
      expect(serializedEvents).toContain('page_view');
    });
  });
});
