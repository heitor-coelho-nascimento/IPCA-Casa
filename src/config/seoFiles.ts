/**
 * Geradores determinísticos dos arquivos públicos de indexação:
 * - /sitemap.xml
 * - /robots.txt
 * - /llms.txt
 */

import {
  PUBLIC_ROUTES,
  SITE_NAME,
  buildSchemaOrgJsonLd,
  getGoogleSearchConsoleCode,
  getRouteSeoMetadata,
  normalizeCanonicalUrl,
  resolveConfiguredSiteUrl,
} from './seo';

export const DEFAULT_SITEMAP_LASTMOD = '2026-11-10';

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateSitemapXml(
  siteUrl?: string,
  lastmodDate = DEFAULT_SITEMAP_LASTMOD
): string {
  const baseUrl = resolveConfiguredSiteUrl(undefined, siteUrl);
  const indexableRoutes = Object.values(PUBLIC_ROUTES).filter((route) => route.inSitemap);

  const urlNodes = indexableRoutes
    .map((route) => {
      const loc = normalizeCanonicalUrl(route.path, baseUrl);
      const changefreq = route.changefreq || 'monthly';
      const priority = route.priority || '0.7';
      return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${escapeXml(lastmodDate)}</lastmod>`,
        `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
        `    <priority>${escapeXml(priority)}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlNodes,
    '</urlset>',
    '',
  ].join('\n');
}

export function generateRobotsTxt(siteUrl?: string): string {
  const baseUrl = resolveConfiguredSiteUrl(undefined, siteUrl);
  const sitemapUrl = normalizeCanonicalUrl('/sitemap.xml', baseUrl);

  return [
    'User-agent: *',
    'Allow: /',
    'Allow: /como-funciona',
    'Allow: /metodologia',
    'Allow: /ipca-oficial',
    'Allow: /privacidade',
    'Allow: /llms.txt',
    'Allow: /images/',
    'Allow: /favicon.svg',
    '',
    'Disallow: /login',
    'Disallow: /cadastro',
    'Disallow: /recuperar-senha',
    'Disallow: /demo',
    'Disallow: /painel',
    'Disallow: /painel/',
    'Disallow: /api/',
    '',
    `Sitemap: ${sitemapUrl}`,
    '',
  ].join('\n');
}

export function generateLlmsTxt(siteUrl?: string): string {
  const baseUrl = resolveConfiguredSiteUrl(undefined, siteUrl);
  const url = (path: string) => normalizeCanonicalUrl(path, baseUrl);

  return `# IPCA-Casa

> Calculadora brasileira de inflação pessoal e familiar (Índice de Laspeyres) com leitura em Reais (R$), análise de poder de compra salarial e integração em tempo real com os dados oficiais do IBGE (API SIDRA).

## O que é e qual o objetivo do IPCA-Casa
O IPCA-Casa é uma aplicação web voltada para famílias e cidadãos brasileiros compreenderem como a inflação afeta seu orçamento real. Enquanto notícias econômicas apresentam um percentual médio nacional abstrato, a plataforma traduz a alta dos preços para a realidade de cada domicílio com base em sua própria cesta de compras e rendimentos.

## Relação entre inflação, salário e poder de compra
Mesmo quando um trabalhador recebe aumento salarial nominal, seu padrão de vida cai se o custo da sua cesta familiar subir acima desse reajuste. O IPCA-Casa calcula:
- A variação nominal da renda no período analisado.
- A variação real do poder de compra por deflação composta: \`r = ((1 + g) / (1 + π)) - 1\`.
- O salário de equilíbrio necessário para manter o mesmo padrão de compras sem perda real.
- O custo mensal e em 12 meses que a inflação retira do bolso em Reais (R$).

## Diferença entre o IPCA Oficial (IBGE) e o IPCA-Casa (Inflação Percebida)
- **IPCA Oficial (IBGE):** Mede a inflação média das famílias brasileiras com rendimento de 1 a 40 salários mínimos segundo os pesos fixos da Pesquisa de Orçamentos Familiares (POF/IBGE).
- **IPCA-Casa (Pessoal):** Calcula a inflação específica do domicílio aplicando a fórmula clássica de **Laspeyres** (\`IPCA_casa = Σ (w_i × ΔP_i)\`), onde \`w_i\` é o peso real de cada despesa no gasto mensal da família e \`ΔP_i\` é a variação observada de preço do item.

## Dados oficiais do IBGE e transparência metodológica
A plataforma consulta diretamente a API pública de dados abertos do **SIDRA / IBGE**:
- **Tabela 1737:** Série histórica nacional do IPCA — variação mensal (variável 63), acumulado no ano (variável 69) e acumulado em 12 meses (variável 2265).
- **Tabela 7060:** Abertura por 9 grupos de consumo e índices regionais de capitais e regiões metropolitanas, além dos pesos nacionais (variável 66).
- Quando há falha ou atraso externo na API, a aplicação exibe claramente o último período efetivamente publicado ou identifica os dados como cache com data de referência, sem inventar estatísticas oficiais.
- Os valores utilizados no modo demonstração têm finalidade exclusivamente educativa e não representam dados oficiais nem registros reais de usuários.

## Funcionalidades principais
- Simulador rápido em Reais (R$) na página inicial sem necessidade de cadastro.
- Consulta pública do IPCA Oficial do IBGE com gráfico histórico, filtro de períodos, grupos de produtos e recorte regional.
- Painel familiar autenticado para gestão da cesta pessoal, histórico de preços, análise econométrica de Laspeyres (Top vilões vs. maiores altas) e estratégias práticas de economia.
- Exportação de relatórios executivos e backups estruturados em CSV/JSON sob controle exclusivo do titular.

## Páginas públicas principais
- [Página Inicial e Simulador Rápido](${url('/')}): Apresentação da plataforma, simulador instantâneo em Reais e perguntas frequentes.
- [Como Funciona](${url('/como-funciona')}): Fluxo completo de uso para montar a cesta familiar e interpretar resultados em Reais.
- [Metodologia e Fórmulas](${url('/metodologia')}): Detalhamento matemático do Índice de Laspeyres, peso orçamentário, contribuição em pontos percentuais e deflação salarial.
- [IPCA Oficial do IBGE](${url('/ipca-oficial')}): Indicadores atualizados diretamente do SIDRA/IBGE com variação mensal, ano e 12 meses, grupos e regiões.
- [Privacidade e Proteção de Dados](${url('/privacidade')}): Política clara de isolamento de dados via Firebase Authentication e Cloud Firestore, além de controles de consentimento de analytics.

## Referências oficiais externas
- IBGE — Página oficial do IPCA: https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9256-ipca.html
- SIDRA / IBGE — Tabela 1737 (Série histórica nacional): https://sidra.ibge.gov.br/tabela/1737
- SIDRA / IBGE — Tabela 7060 (Grupos de consumo e localidades): https://sidra.ibge.gov.br/tabela/7060
`;
}

/**
 * Injeta no HTML servido pelo Express/Vite os metadados SEO específicos da rota,
 * canônica, meta de verificação do Google Search Console (somente rotas públicas e com env definida)
 * e JSON-LD Schema.org (somente rotas públicas).
 */
export function injectRouteSeoHtml(
  htmlTemplate: string,
  reqPath: string,
  siteUrl: string,
  gscOverrideCode?: string
): string {
  const routeMeta = getRouteSeoMetadata(reqPath);
  const canonicalUrl = normalizeCanonicalUrl(routeMeta.path, siteUrl);
  const origin = new URL(canonicalUrl).origin;
  const ogImageUrl = `${origin}${routeMeta.imagePath}`;
  const gscCode = getGoogleSearchConsoleCode(gscOverrideCode);
  const schemas =
    routeMeta.isPublic && routeMeta.includeSchema ? buildSchemaOrgJsonLd(routeMeta, siteUrl) : [];

  let html = htmlTemplate;

  // Limpa tags dinâmicas do template base para evitar duplicatas ao trocar de rota
  html = html.replace(/<title>[\s\S]*?<\/title>/gi, `<title>${escapeHtmlAttr(routeMeta.title)}</title>`);
  html = html.replace(
    /\s*<meta\b[^>]*\b(?:name|property)=["'](?:description|robots|google-site-verification|og:type|og:site_name|og:locale|og:title|og:description|og:url|og:image|og:image:alt|twitter:title|twitter:description|twitter:image)["'][^>]*>/gi,
    ''
  );
  html = html.replace(/\s*<link\b[^>]*\brel=["']canonical["'][^>]*>/gi, '');
  html = html.replace(
    /\s*<script\b[^>]*\bdata-ipca-schema=["']true["'][^>]*>[\s\S]*?<\/script>/gi,
    ''
  );

  const seoHeadLines: string[] = [
    `    <meta name="description" content="${escapeHtmlAttr(routeMeta.description)}" />`,
    `    <meta name="robots" content="${escapeHtmlAttr(routeMeta.robots)}" />`,
    `    <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`,
    `    <meta property="og:type" content="${escapeHtmlAttr(routeMeta.ogType)}" />`,
    `    <meta property="og:site_name" content="${escapeHtmlAttr(SITE_NAME)}" />`,
    `    <meta property="og:locale" content="pt_BR" />`,
    `    <meta property="og:title" content="${escapeHtmlAttr(routeMeta.title)}" />`,
    `    <meta property="og:description" content="${escapeHtmlAttr(routeMeta.description)}" />`,
    `    <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`,
    `    <meta property="og:image" content="${escapeHtmlAttr(ogImageUrl)}" />`,
    `    <meta property="og:image:alt" content="${escapeHtmlAttr(routeMeta.imageAlt)}" />`,
    `    <meta name="twitter:title" content="${escapeHtmlAttr(routeMeta.title)}" />`,
    `    <meta name="twitter:description" content="${escapeHtmlAttr(routeMeta.description)}" />`,
    `    <meta name="twitter:image" content="${escapeHtmlAttr(ogImageUrl)}" />`,
  ];

  if (routeMeta.isPublic && routeMeta.includeSearchConsoleTag && gscCode) {
    seoHeadLines.push(
      `    <meta name="google-site-verification" content="${escapeHtmlAttr(gscCode)}" />`
    );
  }

  for (const schema of schemas) {
    const safeJson = JSON.stringify(schema).replace(/</g, '\\u003c');
    seoHeadLines.push(
      `    <script type="application/ld+json" data-ipca-schema="true">${safeJson}</script>`
    );
  }

  const injection = `${seoHeadLines.join('\n')}\n`;

  if (html.includes('</title>')) {
    return html.replace('</title>', `</title>\n${injection.trimEnd()}`);
  }
  return html.replace('</head>', `${injection}  </head>`);
}

