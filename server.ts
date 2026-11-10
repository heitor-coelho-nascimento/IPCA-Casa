import 'dotenv/config';
import crypto from 'node:crypto';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { StorageService } from './src/services/storage';
import { AuthService } from './src/services/auth';
import { processBasketEconomics } from './src/services/economics';
import { fetchOfficialIPCA } from './src/services/ibge';
import { Repository } from './src/db/repository';
import {
  SESSION_COOKIE_NAME,
  SessionTokenPayload,
  extractRequestToken,
  signSessionToken,
  verifySessionToken,
} from './src/db/auth-tokens';
import {
  isFirebaseAdminConfigured,
  verifyFirebaseGoogleIdToken,
} from './src/lib/firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface OAuthStateEntry {
  createdAt: number;
  redirectUri: string;
}

const oauthStateStore = new Map<string, OAuthStateEntry>();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

interface AuthenticatedRequest extends Request {
  authSession?: SessionTokenPayload;
}

function purgeExpiredOAuthStates() {
  const now = Date.now();
  for (const [key, entry] of oauthStateStore.entries()) {
    if (now - entry.createdAt > OAUTH_STATE_TTL_MS) {
      oauthStateStore.delete(key);
    }
  }
}

function getGoogleOAuthCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.OAUTH_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function resolveAppBaseUrl(port: number, clientOrigin?: string): string {
  const envAppUrl = process.env.APP_URL?.trim();
  if (envAppUrl && envAppUrl !== 'MY_APP_URL' && /^https?:\/\//i.test(envAppUrl)) {
    return envAppUrl.replace(/\/+$/, '');
  }
  if (
    clientOrigin &&
    /^https?:\/\/(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|[\w.-]+\.run\.app)$/i.test(clientOrigin.trim())
  ) {
    return clientOrigin.trim().replace(/\/+$/, '');
  }
  return `http://localhost:${port}`;
}

function serializeSafeJsonForScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });
}

function optionalAuthMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = extractRequestToken(req);
  if (token) {
    const verified = verifySessionToken(token);
    if (verified) {
      req.authSession = verified;
    }
  }
  next();
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(optionalAuthMiddleware);

  // ============================================
  // API ENDPOINTS DO IPCA-CASA
  // ============================================

  // 1. Autenticação Local & Sessão
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, displayName, password } = req.body;
      const result = await Repository.registerLocalUser({ email, displayName, password });
      if (!result.success || !result.user) {
        return res.status(400).json({ error: result.error });
      }
      const token = signSessionToken(result.user);
      setSessionCookie(res, token);
      res.status(201).json({ success: true, session: { user: result.user, token } });
    } catch {
      res.status(500).json({ error: 'Erro no servidor durante o registro.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await Repository.authenticateLocalUser({ email, password });
      if (!result.success || !result.user) {
        return res.status(401).json({ error: result.error });
      }
      const token = signSessionToken(result.user);
      setSessionCookie(res, token);
      res.json({ success: true, session: { user: result.user, token } });
    } catch {
      res.status(500).json({ error: 'Erro no servidor durante o login.' });
    }
  });

  app.get('/api/auth/me', async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.authSession) {
        return res.json({ user: null });
      }
      const user = await Repository.getUserById(req.authSession.sub);
      if (!user) {
        return res.json({ user: null });
      }
      res.json({ user });
    } catch {
      res.json({ user: null });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ success: true });
  });

  app.post('/api/auth/recover', (req, res) => {
    const { email } = req.body;
    const result = AuthService.recoverPassword(email);
    res.json(result);
  });

  // 1b. Autenticação Google (Firebase Auth OAuth integrado + fallback OAuth 2.0 manual)
  app.get('/api/auth/google/status', (_req, res) => {
    const oauthCreds = getGoogleOAuthCredentials();
    const firebaseConfigured = isFirebaseAdminConfigured();
    res.json({
      configured: Boolean(oauthCreds || firebaseConfigured),
      provider: firebaseConfigured ? 'firebase' : oauthCreds ? 'oauth2' : null,
    });
  });

  app.post('/api/auth/google/firebase', async (req, res) => {
    try {
      if (!isFirebaseAdminConfigured()) {
        return res.status(503).json({
          error: 'Autenticação Google não configurada no servidor.',
        });
      }

      const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
      if (!idToken) {
        return res.status(400).json({
          error: 'Token de autenticação do Google ausente.',
        });
      }

      let decoded;
      try {
        decoded = await verifyFirebaseGoogleIdToken(idToken);
      } catch (verifyErr) {
        console.error('Falha na verificação do token Google:', verifyErr);
        return res.status(401).json({
          error: 'Token de autenticação do Google inválido ou expirado. Tente novamente.',
        });
      }

      const email = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : '';
      if (!decoded.uid || !email || decoded.email_verified === false) {
        return res.status(403).json({
          error: 'Sua conta Google precisa possuir um e-mail verificado.',
        });
      }

      const googleIdentities = decoded.firebase?.identities?.['google.com'];
      const googleSub =
        (Array.isArray(googleIdentities) && typeof googleIdentities[0] === 'string'
          ? googleIdentities[0]
          : undefined) || decoded.uid;

      const { user, isNewUser } = await Repository.upsertGoogleUser({
        googleSub,
        email,
        displayName:
          (typeof decoded.name === 'string' && decoded.name.trim()) || email.split('@')[0],
        avatarUrl: typeof decoded.picture === 'string' ? decoded.picture : undefined,
      });

      const sessionToken = signSessionToken(user);
      setSessionCookie(res, sessionToken);

      return res.json({
        success: true,
        session: { user, token: sessionToken },
        isNewUser,
      });
    } catch (err) {
      console.error('Erro ao autenticar conta Google no repositório:', err);
      return res.status(500).json({
        error: 'Erro interno ao registrar ou carregar sua conta Google no banco de dados.',
      });
    }
  });

  app.get('/api/auth/google/url', (req, res) => {
    const creds = getGoogleOAuthCredentials();
    if (!creds) {
      return res.status(503).json({
        configured: false,
        error:
          'Login com Google não configurado no servidor. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nas variáveis de ambiente.',
      });
    }

    purgeExpiredOAuthStates();
    const clientOrigin = typeof req.query.origin === 'string' ? req.query.origin : undefined;
    const baseUrl = resolveAppBaseUrl(PORT, clientOrigin);
    const redirectUri = `${baseUrl}/auth/google/callback`;
    const state = crypto.randomBytes(24).toString('hex');

    oauthStateStore.set(state, {
      createdAt: Date.now(),
      redirectUri,
    });

    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ configured: true, url });
  });

  const handleGoogleCallback = async (req: Request, res: Response) => {
    const sendPopupResult = (message: {
      type: 'GOOGLE_OAUTH_SUCCESS' | 'GOOGLE_OAUTH_ERROR';
      payload?: unknown;
      error?: string;
    }) => {
      const serialized = serializeSafeJsonForScript(message);
      res.status(message.type === 'GOOGLE_OAUTH_SUCCESS' ? 200 : 400).send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Autenticação Google • IPCA-Casa</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #f8f9ff; color: #0b1c30; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
      .card { background: #ffffff; border: 1px solid #e5eeff; border-radius: 16px; padding: 24px 28px; max-width: 380px; text-align: center; box-shadow: 0 8px 24px rgba(11, 28, 48, 0.08); }
      h1 { font-size: 16px; margin: 0 0 8px; }
      p { font-size: 13px; color: #45464d; margin: 0; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${message.type === 'GOOGLE_OAUTH_SUCCESS' ? 'Login com Google concluído' : 'Não foi possível concluir o login'}</h1>
      <p>${message.type === 'GOOGLE_OAUTH_SUCCESS' ? 'Você já pode retornar ao IPCA-Casa. Esta janela fechará automaticamente.' : 'Feche esta janela e tente novamente.'}</p>
    </div>
    <script>
      (function () {
        var msg = ${serialized};
        if (window.opener) {
          window.opener.postMessage(msg, '*');
          setTimeout(function () { window.close(); }, 150);
        } else {
          window.location.href = '/';
        }
      })();
    </script>
  </body>
</html>`);
    };

    try {
      const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
      if (oauthError) {
        return sendPopupResult({
          type: 'GOOGLE_OAUTH_ERROR',
          error:
            oauthError === 'access_denied'
              ? 'Autenticação com Google cancelada pelo usuário.'
              : `Erro retornado pelo Google: ${oauthError}`,
        });
      }

      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const state = typeof req.query.state === 'string' ? req.query.state : '';

      if (!code || !state) {
        return sendPopupResult({
          type: 'GOOGLE_OAUTH_ERROR',
          error: 'Parâmetros de autorização inválidos ou ausentes.',
        });
      }

      purgeExpiredOAuthStates();
      const stateEntry = oauthStateStore.get(state);
      oauthStateStore.delete(state);

      if (!stateEntry) {
        return sendPopupResult({
          type: 'GOOGLE_OAUTH_ERROR',
          error: 'Sessão de autenticação expirada ou inválida. Tente novamente.',
        });
      }

      const creds = getGoogleOAuthCredentials();
      if (!creds) {
        return sendPopupResult({
          type: 'GOOGLE_OAUTH_ERROR',
          error: 'Credenciais OAuth do Google não configuradas no servidor.',
        });
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          redirect_uri: stateEntry.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text().catch(() => '');
        console.error('Google token exchange failed:', tokenRes.status, errBody);
        return sendPopupResult({
          type: 'GOOGLE_OAUTH_ERROR',
          error: 'Falha ao validar código de autorização com o Google.',
        });
      }

      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        return sendPopupResult({
          type: 'GOOGLE_OAUTH_ERROR',
          error: 'Token de acesso não retornado pelo Google.',
        });
      }

      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });

      if (!userInfoRes.ok) {
        return sendPopupResult({
          type: 'GOOGLE_OAUTH_ERROR',
          error: 'Não foi possível obter os dados da sua conta Google.',
        });
      }

      const userInfo = (await userInfoRes.json()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
      };

      if (!userInfo.sub || !userInfo.email || userInfo.email_verified === false) {
        return sendPopupResult({
          type: 'GOOGLE_OAUTH_ERROR',
          error: 'Sua conta Google precisa possuir um e-mail verificado.',
        });
      }

      const { user, isNewUser } = await Repository.upsertGoogleUser({
        googleSub: userInfo.sub,
        email: userInfo.email,
        displayName: userInfo.name || userInfo.email.split('@')[0],
        avatarUrl: userInfo.picture,
      });

      const sessionToken = signSessionToken(user);
      setSessionCookie(res, sessionToken);

      return sendPopupResult({
        type: 'GOOGLE_OAUTH_SUCCESS',
        payload: {
          user,
          token: sessionToken,
          isNewUser,
        },
      });
    } catch (err) {
      console.error('Erro no callback Google OAuth:', err);
      return sendPopupResult({
        type: 'GOOGLE_OAUTH_ERROR',
        error: 'Erro interno ao concluir login com Google.',
      });
    }
  };

  app.get(['/auth/google/callback', '/auth/google/callback/'], handleGoogleCallback);

  // 2. Perfis Familiares
  app.get('/api/profiles', async (req: AuthenticatedRequest, res) => {
    try {
      const profiles = await Repository.getProfiles(req.authSession?.sub, req.authSession?.profileId);
      res.json(profiles);
    } catch {
      res.status(500).json({ error: 'Falha ao carregar perfis familiares.' });
    }
  });

  app.post('/api/profiles', async (req: AuthenticatedRequest, res) => {
    try {
      const profile = req.body;
      if (!profile || !profile.id || !profile.name) {
        return res.status(400).json({ error: 'ID e nome do perfil são obrigatórios.' });
      }
      const saved = await Repository.saveProfile(profile, req.authSession?.sub);
      res.json(saved);
    } catch {
      res.status(500).json({ error: 'Falha ao salvar perfil familiar.' });
    }
  });

  // 3. Consulta Oficial do IBGE via SIDRA com Cache Resiliente
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

  // 4. Cesta de Consumo (Itens, Gastos e Preços)
  app.get('/api/basket', async (req: AuthenticatedRequest, res) => {
    try {
      const profileId =
        req.authSession?.profileId ||
        (req.query.profileId as string) ||
        StorageService.getActiveProfileId();
      const items = await Repository.getBasketItems(profileId);
      res.json(items);
    } catch {
      res.status(500).json({ error: 'Falha ao carregar itens da cesta.' });
    }
  });

  app.post('/api/basket', async (req: AuthenticatedRequest, res) => {
    try {
      const item = req.body;
      if (!item?.name || !item?.group) {
        return res.status(400).json({ error: 'Nome e Grupo de Consumo são obrigatórios' });
      }
      const targetProfileId = req.authSession?.profileId || item.profileId || StorageService.getActiveProfileId();
      const saved = await Repository.saveBasketItem(
        {
          ...item,
          profileId: targetProfileId,
        },
        req.authSession?.sub
      );
      res.status(201).json(saved);
    } catch {
      res.status(500).json({ error: 'Falha ao salvar item da cesta' });
    }
  });

  app.delete('/api/basket/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await Repository.deleteBasketItem(id, req.authSession?.profileId);
      res.json({ success: true, message: 'Item excluído com sucesso' });
    } catch {
      res.status(500).json({ error: 'Falha ao excluir item' });
    }
  });

  // 5. Histórico de Renda
  app.get('/api/income', async (req: AuthenticatedRequest, res) => {
    try {
      const profileId =
        req.authSession?.profileId ||
        (req.query.profileId as string) ||
        StorageService.getActiveProfileId();
      const history = await Repository.getIncomeHistory(profileId);
      res.json(history);
    } catch {
      res.status(500).json({ error: 'Falha ao consultar histórico de renda.' });
    }
  });

  app.post('/api/income', async (req: AuthenticatedRequest, res) => {
    try {
      const { initialIncome, finalIncome, profileId } = req.body;
      const targetProfileId = req.authSession?.profileId || profileId || StorageService.getActiveProfileId();
      await Repository.saveIncomeRange(
        targetProfileId,
        Number(initialIncome) || 0,
        Number(finalIncome) || 0,
        req.authSession?.sub
      );
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Falha ao salvar histórico de renda.' });
    }
  });

  // 6. Análise e Decomposição Econômica
  app.get('/api/analysis', async (req: AuthenticatedRequest, res) => {
    try {
      const profileId =
        req.authSession?.profileId ||
        (req.query.profileId as string) ||
        StorageService.getActiveProfileId();
      const items = await Repository.getBasketItems(profileId);
      const ibge = await fetchOfficialIPCA();
      const incomeRecords = await Repository.getIncomeHistory(profileId);

      const incomeInitial = incomeRecords[0]?.nominalIncome ?? null;
      const incomeFinal = incomeRecords[incomeRecords.length - 1]?.nominalIncome ?? null;

      const summary = processBasketEconomics(items, ibge.accumulated12MRate, incomeInitial, incomeFinal);
      res.json(summary);
    } catch {
      res.status(500).json({ error: 'Falha ao calcular análise da inflação' });
    }
  });

  // 7. Histórico de Preços
  app.get('/api/prices', async (req, res) => {
    try {
      const itemId = req.query.itemId as string | undefined;
      const prices = await Repository.getPriceHistory(itemId);
      res.json(prices);
    } catch {
      res.status(500).json({ error: 'Falha ao carregar histórico de preços.' });
    }
  });

  // 8. Estratégias de Economia (Planos A, B e C)
  app.get('/api/strategies', (_req, res) => {
    res.json({
      planA: StorageService.getPlansA(),
      planB: StorageService.getPlansB(),
      planC: StorageService.getPlanC(),
    });
  });

  // 9. Documentação técnica DDL MySQL (sem credenciais)
  app.get('/api/schema.sql', (_req, res) => {
    res.type('text/plain; charset=utf-8').send(StorageService.getMySQLSchemaDDL());
  });

  // ============================================
  // SERVIDOR DE FRONTEND (Vite Middleware em Dev)
  // ============================================
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IPCA-Casa API & Server rodando em http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
});
