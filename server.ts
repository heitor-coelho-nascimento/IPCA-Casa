import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
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
import { firebaseConfig, isFirebaseConfigured } from './src/lib/firebaseConfig';
import { fetchOfficialIPCA, isValidIBGERegionCode } from './src/services/ibge';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type FirestoreHealthStatus =
  | 'accessible'
  | 'permission_denied'
  | 'unavailable'
  | 'config_missing';

export interface HealthCheckPayload {
  status: 'ok' | 'restricted' | 'degraded';
  server: 'available';
  firebaseConfigured: boolean;
  firestoreStatus: FirestoreHealthStatus;
  checkedAt: string;
}

export interface ServerAppOptions {
  enableVite?: boolean;
  enableStaticDist?: boolean;
  checkFirestoreHealth?: () => Promise<FirestoreHealthStatus>;
  forceRefreshCooldownMs?: number;
  apiRateLimitMax?: number;
  allowedOrigins?: string[];
}

function extractHostname(rawHostHeader: string | undefined): string {
  if (!rawHostHeader) return '';
  const trimmed = rawHostHeader.trim().toLowerCase();
  if (trimmed.startsWith('[')) {
    const endBracket = trimmed.indexOf(']');
    return endBracket !== -1 ? trimmed.slice(0, endBracket + 1) : trimmed;
  }
  return trimmed.split(':')[0];
}

function resolveRequestOrigin(req: Request): string {
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

export async function defaultCheckFirestoreHealth(): Promise<FirestoreHealthStatus> {
  if (!isFirebaseConfigured()) {
    return 'config_missing';
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents/_health/ping`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-goog-api-key': firebaseConfig.apiKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(2500),
    });

    if (res.status === 200 || res.status === 404) {
      return 'accessible';
    }
    if (res.status === 401 || res.status === 403) {
      return 'permission_denied';
    }
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

function buildAllowedOriginSet(extraOrigins: string[] = []): Set<string> {
  const allowed = new Set<string>();
  const envRaw = process.env.ALLOWED_ORIGINS || '';
  const candidates = [
    ...extraOrigins,
    ...envRaw.split(',').map((s) => s.trim()),
    process.env.VITE_SITE_URL || '',
    process.env.APP_URL || '',
  ];

  for (const item of candidates) {
    if (!item || item.startsWith('MY_')) continue;
    try {
      const parsed = new URL(item);
      allowed.add(parsed.origin.toLowerCase());
    } catch {
      // ignora valores inválidos
    }
  }
  return allowed;
}

function isOriginPermitted(
  originHeader: string,
  req: Request,
  isProd: boolean,
  allowedOrigins: Set<string>
): boolean {
  try {
    const originUrl = new URL(originHeader);
    const normalizedOrigin = originUrl.origin.toLowerCase();

    if (allowedOrigins.has(normalizedOrigin)) {
      return true;
    }

    const requestHostOrigin = resolveRequestOrigin(req).toLowerCase();
    if (normalizedOrigin === requestHostOrigin) {
      return true;
    }

    const reqHostHeader = (req.get('host') || '').toLowerCase();
    if (reqHostHeader && originUrl.host.toLowerCase() === reqHostHeader) {
      return true;
    }

    if (!isProd && isLocalHostname(originUrl.hostname)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function createServerApp(options: ServerAppOptions = {}): Promise<express.Express> {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
  const forceCooldownMs = options.forceRefreshCooldownMs ?? 60_000;
  const checkFirestoreHealth = options.checkFirestoreHealth ?? defaultCheckFirestoreHealth;
  const configuredOrigins = buildAllowedOriginSet(options.allowedOrigins);
  const lastForcedIbgeByRegion = new Map<string, number>();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Cabeçalhos de segurança HTTP e Content Security Policy compatível com iFrame AI Studio + Firebase/GA4
  app.use(
    helmet({
      frameguard: false, // Substituído por CSP frame-ancestors para suportar iframe do AI Studio sem abrir clickjacking universal
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Necessário para Google signInWithPopup
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          scriptSrc: [
            "'self'",
            ...(isProd ? [] : ["'unsafe-inline'"]),
            'https://apis.google.com',
            'https://www.gstatic.com',
            'https://www.googletagmanager.com',
            'https://www.google-analytics.com',
            'https://*.firebaseapp.com',
          ],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          connectSrc: [
            "'self'",
            'https://servicodados.ibge.gov.br',
            'https://*.googleapis.com',
            'https://*.google-analytics.com',
            'https://*.analytics.google.com',
            'https://*.googletagmanager.com',
            'https://*.firebaseio.com',
            'wss://*.firebaseio.com',
            ...(isProd ? [] : ['ws:', 'wss:']),
          ],
          frameSrc: [
            "'self'",
            'https://accounts.google.com',
            'https://*.firebaseapp.com',
            'https://*.web.app',
          ],
          frameAncestors: [
            "'self'",
            'https://aistudio.google.com',
            'https://*.google.com',
            'https://*.googleusercontent.com',
          ],
          formAction: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
    })
  );

  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
    );
    next();
  });

  // Limite estrito de tamanho para payloads JSON / URL-encoded
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));

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

      if (reqApex === targetApex && (reqProto !== 'https' || reqHostname !== targetUrl.hostname)) {
        return res.redirect(301, `${targetUrl.origin}${req.originalUrl}`);
      }
    } catch {
      // ignora URL inválida
    }

    return next();
  });

  // ============================================
  // PROTEÇÃO CORS + RATE LIMIT DA API (/api/*)
  // ============================================
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: options.apiRateLimitMax ?? 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: 'Muitas requisições à API em um curto intervalo. Aguarde alguns segundos.',
      });
    },
  });

  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    const originHeader = req.get('origin');
    if (originHeader) {
      if (!isOriginPermitted(originHeader, req, isProd, configuredOrigins)) {
        return res.status(403).json({
          error: 'Origem não autorizada pela política de segurança da API.',
        });
      }
      res.setHeader('Access-Control-Allow-Origin', originHeader);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    return next();
  });

  app.use('/api', apiLimiter);

  // 1. Verificação real e honesta de integridade da API e Firestore
  app.get('/api/health', async (_req, res, next) => {
    try {
      const configured = isFirebaseConfigured();
      const firestoreStatus = await checkFirestoreHealth();
      const status: HealthCheckPayload['status'] =
        firestoreStatus === 'accessible'
          ? 'ok'
          : firestoreStatus === 'permission_denied'
            ? 'restricted'
            : 'degraded';

      const payload: HealthCheckPayload = {
        status,
        server: 'available',
        firebaseConfigured: configured,
        firestoreStatus,
        checkedAt: new Date().toISOString(),
      };

      return res.status(firestoreStatus === 'config_missing' ? 503 : 200).json(payload);
    } catch (err) {
      return next(err);
    }
  });

  // 2. Proxy oficial do IBGE via SIDRA com validação de região, cache e proteção anti-abuso de ?force=true
  app.get('/api/ibge', async (req, res, next) => {
    try {
      const rawRegion = req.query.region;
      if (rawRegion !== undefined && typeof rawRegion !== 'string') {
        return res.status(400).json({ error: 'Parâmetro region inválido.' });
      }
      const region = rawRegion ? rawRegion.trim() : 'N1[all]';
      if (!isValidIBGERegionCode(region)) {
        return res.status(400).json({
          error: 'Código de localidade não permitido para consulta ao SIDRA/IBGE.',
        });
      }

      const rawForce = req.query.force;
      if (rawForce !== undefined && rawForce !== 'true' && rawForce !== 'false') {
        return res.status(400).json({ error: 'Parâmetro force inválido.' });
      }
      const force = rawForce === 'true';

      if (force) {
        const now = Date.now();
        const lastForcedAt = lastForcedIbgeByRegion.get(region) || 0;
        const elapsed = now - lastForcedAt;
        if (elapsed < forceCooldownMs) {
          const retryAfterSeconds = Math.max(1, Math.ceil((forceCooldownMs - elapsed) / 1000));
          res.setHeader('Retry-After', String(retryAfterSeconds));
          return res.status(429).json({
            error: `Atualização forçada em cooldown. Aguarde ${retryAfterSeconds}s antes de consultar o IBGE novamente.`,
            retryAfterSeconds,
          });
        }
        lastForcedIbgeByRegion.set(region, now);
      }

      const metadata = await fetchOfficialIPCA(region, force, { bypassLocalApiProxy: true });
      return res.json(metadata);
    } catch (err) {
      return next(err);
    }
  });

  // Fallback explícito para rotas /api inexistentes
  app.use('/api', (_req, res) => {
    return res.status(404).json({ error: 'Endpoint da API não encontrado.' });
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
  const applyHtmlHeaders = (reqPath: string, res: Response): number => {
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

  const shouldUseVite = options.enableVite ?? (!isProd && !isTest);
  const shouldUseDist = options.enableStaticDist ?? (isProd && !isTest);

  if (shouldUseVite) {
    const { createServer: createViteServer } = await import('vite');
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
  } else if (shouldUseDist) {
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

  // ============================================
  // TRATAMENTO CENTRALIZADO DE ERROS (SEM STACK TRACE EM PROD)
  // ============================================
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const errObj = err as { type?: string; status?: number; message?: string };

    if (errObj?.type === 'entity.too.large') {
      return res.status(413).json({
        error: 'O tamanho da requisição excede o limite de 32 KB permitido.',
      });
    }

    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        error: 'Formato JSON inválido na requisição.',
      });
    }

    const safeMessage =
      err instanceof Error ? err.message.slice(0, 200) : 'Erro interno inesperado';
    console.error('[IPCA-Casa Server Error]', req.method, req.path, safeMessage);

    if (res.headersSent) {
      return;
    }

    if (req.path.startsWith('/api/')) {
      return res.status(errObj?.status && errObj.status >= 400 ? errObj.status : 500).json({
        error: isProd ? 'Erro interno ao processar a solicitação.' : safeMessage,
      });
    }

    return res
      .status(500)
      .type('text/plain; charset=utf-8')
      .send(isProd ? 'Erro interno no servidor.' : safeMessage);
  });

  return app;
}

export async function startServer() {
  const app = await createServerApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  return app.listen(PORT, '0.0.0.0', () => {
    console.log(`IPCA-Casa Server rodando em http://localhost:${PORT}`);
  });
}

const isTestProcess = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
if (!isTestProcess) {
  startServer().catch((err) => {
    console.error('Falha ao iniciar o servidor:', err);
  });
}
