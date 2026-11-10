import 'dotenv/config';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  PUBLIC_ROUTES,
  getRouteSeoMetadata,
  isCustomDomainConfigured,
  isLocalHostname,
  isPrivateOrAuthPath,
  normalizeRoutePath,
  resolveConfiguredSiteUrl,
} from './src/config/seo';
import {
  generateLlmsTxt,
  generateRobotsTxt,
  generateSitemapXml,
  injectRouteSeoHtml,
} from './src/config/seoFiles';
import { fetchOfficialIPCA } from './src/services/ibge';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractHostname(rawHostHeader: string | undefined): string {
  if (!rawHostHeader) return '';
  const trimmed = rawHostHeader.trim().toLowerCase();
  if (trimmed.startsWith('[')) {
    const endBracket = trimmed.indexOf(']');
    return endBracket !== -1 ? trimmed.slice(0, endBracket + 1) : trimmed;
  }
  return trimmed.split(':')[0];
}

function resolveRequestOrigin(req: express.Request): string {
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  const proto = forwardedProto || req.protocol || 'http';
  const host = forwardedHost || req.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);
  app.use(express.json());

  // Padronização HTTPS e www/non-www exclusivamente quando VITE_SITE_URL estiver configurado
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    if (req.path.startsWith('/api/') || !isCustomDomainConfigured()) {
      return next();
    }

    const rawHost =
      (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() ||
      req.get('host');
    const reqHostname = extractHostname(rawHost);
    if (!reqHostname || isLocalHostname(reqHostname)) {
      return next();
    }

    const reqProto =
      (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ||
      req.protocol;

    try {
      const targetUrl = new URL(resolveConfiguredSiteUrl());
      const reqApex = reqHostname.replace(/^www\./, '');
      const targetApex = targetUrl.hostname.replace(/^www\./, '');

      // Só redireciona quando o host pertence ao mesmo domínio configurado (preserva hosts de preview .run.app)
      if (reqApex === targetApex && (reqProto !== 'https' || reqHostname !== targetUrl.hostname)) {
        return res.redirect(301, `${targetUrl.origin}${req.originalUrl}`);
      }
    } catch {
      // ignora em caso de URL inválida
    }

    return next();
  });

  // ============================================
  // API ENDPOINTS DO IPCA-CASA (não indexáveis)
  // ============================================
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  // 1. Verificação de integridade da API
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      database: 'firebase-firestore',
    });
  });

  // 2. Consulta Oficial do IBGE via SIDRA com Cache Resiliente
  app.get('/api/ibge', async (req, res) => {
    try {
      const region = (req.query.region as string) || 'N1[all]';
      const force = req.query.force === 'true';
      const metadata = await fetchOfficialIPCA(region, force);
      res.json(metadata);
    } catch {
      res.status(500).json({ error: 'Erro ao consultar serviço oficial do IBGE' });
    }
  });

  // ============================================
  // ARQUIVOS TÉCNICOS DE INDEXAÇÃO E LLMs
  // ============================================
  app.get('/robots.txt', (req, res) => {
    const siteUrl = resolveConfiguredSiteUrl(resolveRequestOrigin(req));
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(generateRobotsTxt(siteUrl));
  });

  app.get('/sitemap.xml', (req, res) => {
    const siteUrl = resolveConfiguredSiteUrl(resolveRequestOrigin(req));
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(generateSitemapXml(siteUrl));
  });

  app.get('/llms.txt', (req, res) => {
    const siteUrl = resolveConfiguredSiteUrl(resolveRequestOrigin(req));
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(generateLlmsTxt(siteUrl));
  });

  // Cabeçalhos de cache para ativos visuais estáticos
  app.use('/images', (_req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    next();
  });
  app.get('/favicon.svg', (_req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    next();
  });

  // ============================================
  // SERVIDOR DE FRONTEND + METADADOS POR ROTA
  // ============================================
  const applyHtmlHeaders = (reqPath: string, res: express.Response): number => {
    const cleanPath = normalizeRoutePath(reqPath);
    const routeMeta = getRouteSeoMetadata(cleanPath);
    const isKnownValidRoute =
      Boolean(PUBLIC_ROUTES[cleanPath]) || isPrivateOrAuthPath(cleanPath);
    const statusCode = isKnownValidRoute ? 200 : 404;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Vary', 'Host, X-Forwarded-Proto');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (!routeMeta.isPublic) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('Cache-Control', 'private, no-store');
    } else {
      res.setHeader('X-Robots-Tag', 'index, follow');
      res.setHeader(
        'Cache-Control',
        isProd ? 'public, max-age=300, stale-while-revalidate=600' : 'no-cache'
      );
    }

    return statusCode;
  };

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      try {
        if (path.extname(req.path) && !req.path.endsWith('.html')) {
          return res.status(404).end();
        }
        const rawTemplate = await fs.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawTemplate);
        const siteUrl = resolveConfiguredSiteUrl(resolveRequestOrigin(req));
        const html = injectRouteSeoHtml(transformed, req.path, siteUrl);
        const statusCode = applyHtmlHeaders(req.path, res);
        return res.status(statusCode).send(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        return next(err);
      }
    });
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '365d',
        immutable: true,
      })
    );
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (/\.(png|webp|avif|svg|ico|txt|xml)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        },
      })
    );

    const distHtml = await fs.readFile(path.join(distDir, 'index.html'), 'utf-8');
    app.get('*', (req, res) => {
      if (path.extname(req.path) && !req.path.endsWith('.html')) {
        return res.status(404).end();
      }
      const siteUrl = resolveConfiguredSiteUrl(resolveRequestOrigin(req));
      const html = injectRouteSeoHtml(distHtml, req.path, siteUrl);
      const statusCode = applyHtmlHeaders(req.path, res);
      return res.status(statusCode).send(html);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IPCA-Casa Server rodando em http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
});

