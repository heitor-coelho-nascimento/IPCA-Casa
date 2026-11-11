/**
 * Configuração centralizada de SEO Técnico, URLs Canônicas,
 * Google Search Console, Schema.org e Indexação de Rotas do IPCA-Casa.
 */

export type WwwCanonicalMode = 'non-www' | 'www';

export interface RouteFaqItem {
  question: string;
  answer: string;
}

export interface RouteSeoMetadata {
  path: string;
  title: string;
  description: string;
  isPublic: boolean;
  robots: string;
  includeSearchConsoleTag: boolean;
  includeSchema: boolean;
  inSitemap: boolean;
  changefreq?: 'daily' | 'weekly' | 'monthly';
  priority?: string;
  ogType: 'website' | 'article';
  imagePath: string;
  imageAlt: string;
  keywords: string[];
  faqs?: RouteFaqItem[];
}

export const SITE_NAME = 'IPCA-Casa';
export const SITE_TAGLINE = 'Calculadora da Inflação Familiar e Poder de Compra Real';
export const DEFAULT_OG_IMAGE_PATH = '/images/og-ipca-casa.png';
export const DEFAULT_OG_IMAGE_ALT =
  'IPCA-Casa — Calculadora de inflação pessoal e comparação com o IPCA oficial do IBGE';

export const LANDING_FAQS: RouteFaqItem[] = [
  {
    question: 'Qual é a diferença entre o IPCA oficial do IBGE e o IPCA-Casa?',
    answer:
      'O IPCA oficial mede a variação média de preços para famílias brasileiras com renda de 1 a 40 salários mínimos com pesos fixos nacionais. O IPCA-Casa aplica a mesma matemática do Índice de Laspeyres usando os pesos reais da sua cesta doméstica, mostrando sua inflação pessoal e o impacto em Reais (R$) no seu salário.',
  },
  {
    question: 'De onde vêm os dados oficiais do IPCA exibidos na plataforma?',
    answer:
      'Os indicadores oficiais são consultados diretamente da API pública SIDRA do IBGE, utilizando a Tabela 1737 (série histórica nacional mensal, acumulada no ano e em 12 meses) e a Tabela 7060 (variações por grupos de produtos e localidades regionais), com cache e indicação transparente da data de referência.',
  },
  {
    question: 'Preciso cadastrar CPF, conta bancária ou senhas financeiras?',
    answer:
      'Não. O IPCA-Casa nunca solicita CPF, dados bancários ou integração com open finance. Você pode testar livremente o modo demonstração isolado, ou criar uma conta gratuita com e-mail e senha verificados ou login Google para armazenar apenas os itens e rendimentos que escolher acompanhar na nuvem.',
  },
  {
    question: 'Como interpretar o impacto da inflação sobre o salário e poder de compra?',
    answer:
      'Mesmo quando o salário tem reajuste nominal positivo, pode haver perda de poder de compra se a inflação da sua cesta for maior. A ferramenta deflaciona o rendimento pela fórmula [(1 + reajuste) / (1 + inflação) - 1] e calcula o salário de equilíbrio necessário para manter o mesmo padrão de consumo.',
  },
];

export const PUBLIC_ROUTES: Record<string, RouteSeoMetadata> = {
  '/': {
    path: '/',
    title: 'IPCA-Casa | Inflação Pessoal e Poder de Compra Real',
    description:
      'Calcule sua inflação pessoal (Índice de Laspeyres), veja o impacto mensal em Reais e compare sua cesta com o IPCA oficial do IBGE.',
    isPublic: true,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1',
    includeSearchConsoleTag: true,
    includeSchema: true,
    inSitemap: true,
    changefreq: 'weekly',
    priority: '1.0',
    ogType: 'website',
    imagePath: DEFAULT_OG_IMAGE_PATH,
    imageAlt: DEFAULT_OG_IMAGE_ALT,
    keywords: [
      'IPCA-Casa',
      'calculadora de inflação pessoal',
      'inflação familiar',
      'poder de compra',
      'IPCA oficial IBGE',
      'índice de Laspeyres',
      'impacto da inflação no salário',
    ],
    faqs: LANDING_FAQS,
  },
  '/como-funciona': {
    path: '/como-funciona',
    title: 'Como Funciona o IPCA-Casa | Cesta e Impacto em Reais',
    description:
      'Veja como montar sua cesta familiar, registrar preços e calcular em Reais quanto a inflação real afeta seu salário e orçamento mensal.',
    isPublic: true,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1',
    includeSearchConsoleTag: true,
    includeSchema: true,
    inSitemap: true,
    changefreq: 'monthly',
    priority: '0.8',
    ogType: 'article',
    imagePath: DEFAULT_OG_IMAGE_PATH,
    imageAlt: DEFAULT_OG_IMAGE_ALT,
    keywords: [
      'como calcular inflação pessoal',
      'cesta de consumo familiar',
      'orçamento doméstico',
      'vilões da inflação',
      'substituição de itens',
    ],
  },
  '/metodologia': {
    path: '/metodologia',
    title: 'Metodologia IPCA-Casa | Índice de Laspeyres e IBGE',
    description:
      'Entenda as fórmulas do Índice de Laspeyres, pesos orçamentários da cesta familiar e cálculo do poder de compra usados no IPCA-Casa.',
    isPublic: true,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1',
    includeSearchConsoleTag: true,
    includeSchema: true,
    inSitemap: true,
    changefreq: 'monthly',
    priority: '0.8',
    ogType: 'article',
    imagePath: DEFAULT_OG_IMAGE_PATH,
    imageAlt: DEFAULT_OG_IMAGE_ALT,
    keywords: [
      'índice de Laspeyres',
      'fórmula IPCA pessoal',
      'poder de compra real',
      'renda deflacionada',
      'pesos orçamentários',
    ],
  },
  '/ipca-oficial': {
    path: '/ipca-oficial',
    title: 'IPCA Oficial IBGE Hoje | Série SIDRA, Grupos e Regiões',
    description:
      'Acompanhe a variação mensal, acumulado no ano e em 12 meses do IPCA oficial do IBGE via SIDRA, com abertura por grupos e regiões.',
    isPublic: true,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1',
    includeSearchConsoleTag: true,
    includeSchema: true,
    inSitemap: true,
    changefreq: 'daily',
    priority: '0.9',
    ogType: 'website',
    imagePath: DEFAULT_OG_IMAGE_PATH,
    imageAlt: DEFAULT_OG_IMAGE_ALT,
    keywords: [
      'IPCA oficial',
      'IPCA IBGE hoje',
      'SIDRA tabela 1737',
      'SIDRA tabela 7060',
      'inflação acumulada 12 meses',
    ],
  },
  '/privacidade': {
    path: '/privacidade',
    title: 'Privacidade, Segurança e Dados | IPCA-Casa',
    description:
      'Saiba como o IPCA-Casa protege seus dados financeiros com Firebase Auth, Cloud Firestore isolado e analytics respeitando consentimento.',
    isPublic: true,
    robots: 'index, follow',
    includeSearchConsoleTag: true,
    includeSchema: true,
    inSitemap: true,
    changefreq: 'monthly',
    priority: '0.5',
    ogType: 'article',
    imagePath: DEFAULT_OG_IMAGE_PATH,
    imageAlt: DEFAULT_OG_IMAGE_ALT,
    keywords: [
      'privacidade IPCA-Casa',
      'LGPD orçamento familiar',
      'segurança Firebase Firestore',
      'consentimento analytics',
    ],
  },
};

export const PRIVATE_ROUTE_PREFIXES = [
  '/painel',
  '/login',
  '/cadastro',
  '/recuperar-senha',
  '/demo',
  '/api',
];

function readEnvValue(key: string): string {
  const viteEnv =
    typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[key]
      : undefined;
  const nodeEnv = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return (viteEnv ?? nodeEnv ?? '').trim();
}

function isPlaceholderValue(value: string): boolean {
  if (!value) return true;
  const upper = value.toUpperCase();
  return (
    upper.startsWith('MY_') ||
    upper.startsWith('YOUR_') ||
    upper.startsWith('SEU_') ||
    upper === 'CHANGE_ME' ||
    upper === 'G-XXXXXXXXXX'
  );
}

/**
 * Código de verificação do Google Search Console a partir de variável de ambiente.
 * Retorna null se não configurado (nunca gera código fictício).
 */
export function getGoogleSearchConsoleCode(overrideCode?: string): string | null {
  const raw = (overrideCode ?? readEnvValue('VITE_GOOGLE_SITE_VERIFICATION')).trim();
  if (!raw || isPlaceholderValue(raw)) {
    return null;
  }
  // Aceita apenas token alfanumérico/URL-safe típico da meta tag do Search Console
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(raw)) {
    return null;
  }
  return raw;
}

export function getWwwCanonicalMode(overrideMode?: string): WwwCanonicalMode {
  const mode = (overrideMode ?? readEnvValue('VITE_SITE_WWW_MODE')).toLowerCase();
  return mode === 'www' ? 'www' : 'non-www';
}

export function isLocalHostname(hostname: string): boolean {
  const clean = hostname.toLowerCase();
  return (
    clean === 'localhost' ||
    clean === '127.0.0.1' ||
    clean === '[::1]' ||
    clean === '0.0.0.0' ||
    clean.endsWith('.local') ||
    clean.endsWith('.internal')
  );
}

const HOSTING_PLATFORM_SUFFIXES = [
  '.run.app',
  '.web.app',
  '.firebaseapp.com',
  '.vercel.app',
  '.netlify.app',
  '.pages.dev',
  '.github.io',
];

const SECOND_LEVEL_CC_SEGMENTS = new Set([
  'com',
  'org',
  'net',
  'gov',
  'edu',
  'dev',
  'app',
  'fin',
  'co',
]);

function isApexDomainEligibleForWww(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (HOSTING_PLATFORM_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return false;
  }
  const parts = lower.split('.').filter(Boolean);
  if (parts.length === 2) return true;
  if (parts.length === 3 && SECOND_LEVEL_CC_SEGMENTS.has(parts[1]) && parts[2].length === 2) {
    return true;
  }
  return false;
}

function applyWwwAndHttpsRule(parsed: URL, wwwMode: WwwCanonicalMode): URL {
  if (!isLocalHostname(parsed.hostname)) {
    parsed.protocol = 'https:';
    if (parsed.port === '80' || parsed.port === '443') {
      parsed.port = '';
    }
    if (wwwMode === 'non-www' && parsed.hostname.startsWith('www.')) {
      parsed.hostname = parsed.hostname.slice(4);
    } else if (
      wwwMode === 'www' &&
      !parsed.hostname.startsWith('www.') &&
      isApexDomainEligibleForWww(parsed.hostname)
    ) {
      parsed.hostname = `www.${parsed.hostname}`;
    }
  }
  return parsed;
}

/**
 * Resolve a URL base oficial respeitando VITE_SITE_URL -> APP_URL -> fallback informado -> origem ativa.
 * Nunca inventa um domínio personalizado falso.
 */
export function resolveConfiguredSiteUrl(requestOrigin?: string, overrideSiteUrl?: string): string {
  const candidates = [
    overrideSiteUrl,
    readEnvValue('VITE_SITE_URL'),
    readEnvValue('APP_URL'),
    requestOrigin,
    typeof window !== 'undefined' ? window.location.origin : '',
    'http://localhost:3000',
  ];

  const wwwMode = getWwwCanonicalMode();

  for (const candidate of candidates) {
    const trimmed = (candidate || '').trim();
    if (!trimmed || isPlaceholderValue(trimmed)) continue;
    try {
      const normalizedInput = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const parsed = applyWwwAndHttpsRule(new URL(normalizedInput), wwwMode);
      return parsed.origin;
    } catch {
      continue;
    }
  }

  return 'http://localhost:3000';
}

export function isCustomDomainConfigured(overrideSiteUrl?: string): boolean {
  const raw = (overrideSiteUrl ?? readEnvValue('VITE_SITE_URL')).trim();
  if (!raw || isPlaceholderValue(raw)) return false;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return !isLocalHostname(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Normaliza uma rota mantendo barra inicial limpa e sem trailing slash (exceto '/').
 */
export function normalizeRoutePath(rawPath: string): string {
  const withoutQuery = (rawPath || '/').split(/[?#]/)[0].trim();
  if (!withoutQuery || withoutQuery === '/') return '/';
  const ensuredLeading = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  const trimmedTrailing = ensuredLeading.replace(/\/+$/, '');
  return trimmedTrailing || '/';
}

/**
 * Gera URL canônica absoluta consistente (HTTPS em produção, sem parâmetros de rastreio e sem barra final duplicada).
 */
export function normalizeCanonicalUrl(
  routePath: string,
  baseUrlOverride?: string,
  wwwMode?: WwwCanonicalMode
): string {
  const cleanPath = normalizeRoutePath(routePath);
  const mode = wwwMode ?? getWwwCanonicalMode();
  const base = resolveConfiguredSiteUrl(undefined, baseUrlOverride);
  try {
    const parsed = applyWwwAndHttpsRule(new URL(base), mode);
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return `http://localhost:3000${cleanPath}`;
  }
}

export function isPrivateOrAuthPath(rawPath: string): boolean {
  const path = normalizeRoutePath(rawPath);
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function getRouteSeoMetadata(rawPath: string): RouteSeoMetadata {
  const path = normalizeRoutePath(rawPath);

  if (PUBLIC_ROUTES[path]) {
    return PUBLIC_ROUTES[path];
  }

  if (path === '/login') {
    return {
      path,
      title: 'Entrar na Conta | IPCA-Casa',
      description: 'Acesse sua conta pessoal no IPCA-Casa para acompanhar sua cesta e poder de compra.',
      isPublic: false,
      robots: 'noindex, nofollow',
      includeSearchConsoleTag: false,
      includeSchema: false,
      inSitemap: false,
      ogType: 'website',
      imagePath: DEFAULT_OG_IMAGE_PATH,
      imageAlt: DEFAULT_OG_IMAGE_ALT,
      keywords: [],
    };
  }

  if (path === '/cadastro') {
    return {
      path,
      title: 'Criar Conta | IPCA-Casa',
      description: 'Crie sua conta no IPCA-Casa para calcular sua inflação doméstica personalizada.',
      isPublic: false,
      robots: 'noindex, nofollow',
      includeSearchConsoleTag: false,
      includeSchema: false,
      inSitemap: false,
      ogType: 'website',
      imagePath: DEFAULT_OG_IMAGE_PATH,
      imageAlt: DEFAULT_OG_IMAGE_ALT,
      keywords: [],
    };
  }

  if (path === '/recuperar-senha') {
    return {
      path,
      title: 'Recuperar Acesso | IPCA-Casa',
      description: 'Recuperação oficial de senha via Firebase Authentication na plataforma IPCA-Casa.',
      isPublic: false,
      robots: 'noindex, nofollow',
      includeSearchConsoleTag: false,
      includeSchema: false,
      inSitemap: false,
      ogType: 'website',
      imagePath: DEFAULT_OG_IMAGE_PATH,
      imageAlt: DEFAULT_OG_IMAGE_ALT,
      keywords: [],
    };
  }

  if (path === '/demo') {
    return {
      path,
      title: 'Modo Demonstração | IPCA-Casa',
      description: 'Ambiente demonstrativo interativo do IPCA-Casa com dados didáticos de exemplo.',
      isPublic: false,
      robots: 'noindex, nofollow',
      includeSearchConsoleTag: false,
      includeSchema: false,
      inSitemap: false,
      ogType: 'website',
      imagePath: DEFAULT_OG_IMAGE_PATH,
      imageAlt: DEFAULT_OG_IMAGE_ALT,
      keywords: [],
    };
  }

  if (path === '/painel' || path.startsWith('/painel/')) {
    return {
      path,
      title: 'Painel Familiar | IPCA-Casa',
      description: 'Área autenticada para acompanhamento da cesta familiar e poder de compra.',
      isPublic: false,
      robots: 'noindex, nofollow',
      includeSearchConsoleTag: false,
      includeSchema: false,
      inSitemap: false,
      ogType: 'website',
      imagePath: DEFAULT_OG_IMAGE_PATH,
      imageAlt: DEFAULT_OG_IMAGE_ALT,
      keywords: [],
    };
  }

  // Fallback seguro: rotas desconhecidas não são indexadas
  return {
    path,
    title: 'Página Não Encontrada | IPCA-Casa',
    description: 'Consulte a calculadora de inflação pessoal IPCA-Casa e os indicadores oficiais do IBGE.',
    isPublic: false,
    robots: 'noindex, nofollow',
    includeSearchConsoleTag: false,
    includeSchema: false,
    inSitemap: false,
    ogType: 'website',
    imagePath: DEFAULT_OG_IMAGE_PATH,
    imageAlt: DEFAULT_OG_IMAGE_ALT,
    keywords: [],
  };
}

/**
 * Constrói dados estruturados Schema.org em JSON-LD alinhados exclusivamente ao conteúdo real.
 * Não utiliza LocalBusiness e não inventa preços, avaliações, usuários ou empresa fictícia.
 */
export function buildSchemaOrgJsonLd(
  routeMeta: RouteSeoMetadata,
  siteUrl: string
): Record<string, unknown>[] {
  if (!routeMeta.isPublic || !routeMeta.includeSchema) {
    return [];
  }

  const canonicalUrl = normalizeCanonicalUrl(routeMeta.path, siteUrl);
  const homeUrl = normalizeCanonicalUrl('/', siteUrl);
  const imageUrl = `${new URL(canonicalUrl).origin}${routeMeta.imagePath}`;

  const schemas: Record<string, unknown>[] = [];

  if (routeMeta.path === '/') {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': `${homeUrl}#webapp`,
      name: SITE_NAME,
      alternateName: 'IPCA-Casa - Calculadora da Inflação Familiar',
      description: routeMeta.description,
      url: homeUrl,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'All',
      browserRequirements: 'Requires JavaScript. Compatible with modern desktop and mobile browsers.',
      inLanguage: 'pt-BR',
      isAccessibleForFree: true,
      screenshot: imageUrl,
      featureList: [
        'Cálculo da inflação pessoal ponderada pelo Índice de Laspeyres',
        'Simulação do impacto mensal e anual da inflação no salário em Reais (R$)',
        'Consulta às séries oficiais do IPCA do IBGE via API pública SIDRA (Tabelas 1737 e 7060)',
        'Análise de perda ou ganho real do poder de compra salarial',
        'Gestão de cesta familiar, histórico de preços e estratégias de economia doméstica',
      ],
    });
  } else {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      name: routeMeta.title,
      description: routeMeta.description,
      url: canonicalUrl,
      inLanguage: 'pt-BR',
      isPartOf: {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: homeUrl,
      },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: imageUrl,
      },
    });

    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Início',
          item: homeUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: routeMeta.title.split('|')[0].trim(),
          item: canonicalUrl,
        },
      ],
    });
  }

  if (routeMeta.faqs && routeMeta.faqs.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: routeMeta.faqs.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  return schemas;
}
