import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import http from 'node:http';
import { createServerApp } from '../server';
import {
  clearPendingTermsAcceptance,
  getDefaultConsentCategories,
  getEffectiveConsentCategories,
  getLocalConsentHistory,
  hasUserMadeConsentChoice,
  readPendingTermsAcceptance,
  saveConsentPreferences,
  savePendingTermsAcceptance,
} from '../src/services/consent';
import {
  clearConsentForTests,
  isMarketingAllowed,
  resetAnalyticsForTests,
  setConsentStatus,
  syncAnalyticsWithConsent,
  trackViewIpca,
} from '../src/services/analytics';
import { runLocalDataRetentionSweep } from '../src/services/retention';
import { PRIVACY_CONFIG, POLICY_VERSION, TERMS_VERSION } from '../src/config/privacy';

function makeJwtWithAuthTime(authTimeSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ auth_time: authTimeSeconds, sub: 'usr_test_123' })).toString(
    'base64url'
  );
  return `${header}.${payload}.sig`;
}

describe('Governança LGPD, CMP, Retenção e Exclusão Verificada de Conta (IPCA-Casa)', () => {
  let localMap: Map<string, string>;
  let sessionMap: Map<string, string>;
  let cookieJar: string[];

  beforeEach(() => {
    resetAnalyticsForTests();
    localMap = new Map();
    sessionMap = new Map();
    cookieJar = ['_ga=GA1.1.123.456', '_gid=GA1.1.789', 'session_pref=ok'];

    vi.stubGlobal('window', {
      location: { origin: 'https://ipcacasa.com.br', hostname: 'ipcacasa.com.br' },
      dataLayer: [],
      localStorage: {
        get length() {
          return localMap.size;
        },
        key: (idx: number) => Array.from(localMap.keys())[idx] ?? null,
        getItem: (k: string) => localMap.get(k) ?? null,
        setItem: (k: string, v: string) => {
          localMap.set(k, v);
        },
        removeItem: (k: string) => {
          localMap.delete(k);
        },
      },
      sessionStorage: {
        getItem: (k: string) => sessionMap.get(k) ?? null,
        setItem: (k: string, v: string) => {
          sessionMap.set(k, v);
        },
        removeItem: (k: string) => {
          sessionMap.delete(k);
        },
        clear: () => {
          sessionMap.clear();
        },
      },
      dispatchEvent: () => true,
    });

    vi.stubGlobal('document', {
      get cookie() {
        return cookieJar.join('; ');
      },
      set cookie(val: string) {
        const name = val.split('=')[0]?.trim();
        if (val.includes('Max-Age=0') && name) {
          cookieJar = cookieJar.filter((entry) => !entry.startsWith(`${name}=`));
        } else if (name) {
          cookieJar.push(val.split(';')[0]);
        }
      },
      querySelector: () => null,
      head: { appendChild: () => ({}) },
      createElement: () => {
        const attrs: Record<string, string> = {};
        return {
          async: false,
          src: '',
          setAttribute: (k: string, v: string) => {
            attrs[k] = v;
          },
        };
      },
    });
  });

  afterEach(() => {
    clearConsentForTests();
    vi.unstubAllGlobals();
    delete process.env.VITE_GA_MEASUREMENT_ID;
    resetAnalyticsForTests();
  });

  it('Aplica Privacy by Default: analytics e marketing bloqueados por padrão antes da escolha', () => {
    expect(getDefaultConsentCategories()).toEqual({
      essenciais: true,
      analytics: false,
      marketing: false,
    });
    expect(hasUserMadeConsentChoice()).toBe(false);
    expect(getEffectiveConsentCategories()).toEqual({
      essenciais: true,
      analytics: false,
      marketing: false,
    });
    expect(isMarketingAllowed()).toBe(false);
    process.env.VITE_GA_MEASUREMENT_ID = 'G-ABC1234DEF';
    expect(trackViewIpca({ surface: 'public' })).toBe(false);
  });

  it('Permite opt-in granular e desativa imediatamente com limpeza de cookies na revogação', () => {
    process.env.VITE_GA_MEASUREMENT_ID = 'G-ABC1234DEF';
    const granted = saveConsentPreferences({ analytics: true, marketing: false }, 'modal');
    syncAnalyticsWithConsent(granted.categories, 'G-ABC1234DEF');

    expect(hasUserMadeConsentChoice()).toBe(true);
    expect(granted.categories).toEqual({ essenciais: true, analytics: true, marketing: false });
    expect((window as unknown as Record<string, unknown>)['ga-disable-G-ABC1234DEF']).toBe(false);
    expect(trackViewIpca({ surface: 'public', timeframe: '12M' })).toBe(true);

    // Revogação posterior
    setConsentStatus('denied', 'G-ABC1234DEF');
    expect((window as unknown as Record<string, unknown>)['ga-disable-G-ABC1234DEF']).toBe(true);
    expect(trackViewIpca({ surface: 'public', timeframe: '24M' })).toBe(false);
    expect(cookieJar.some((c) => c.startsWith('_ga='))).toBe(false);
    expect(cookieJar.some((c) => c.startsWith('_gid='))).toBe(false);
    expect(cookieJar.some((c) => c.startsWith('session_pref='))).toBe(true);
    expect(getLocalConsentHistory().length).toBeGreaterThanOrEqual(2);
  });

  it('Não fabrica dados fictícios de controlador/DPO quando variáveis não estão configuradas', () => {
    expect(PRIVACY_CONFIG.controllerName).toBe('Pendente de definição pelo controlador');
    expect(PRIVACY_CONFIG.controllerDocument).toBe('Pendente de definição pelo controlador');
    expect(PRIVACY_CONFIG.privacyEmail).toBe('Pendente de definição pelo controlador');
    expect(PRIVACY_CONFIG.dpoName).toBe('Pendente de definição pelo controlador');
    expect(PRIVACY_CONFIG.controllerNameConfigured).toBe(false);
    expect(PRIVACY_CONFIG.controllerDocumentConfigured).toBe(false);
    expect(PRIVACY_CONFIG.privacyEmailConfigured).toBe(false);
    expect(PRIVACY_CONFIG.dpoNameConfigured).toBe(false);
  });

  it('Captura e limpa aceite pendente de termos em sessionStorage sem falsos positivos', () => {
    expect(readPendingTermsAcceptance()).toBeNull();
    savePendingTermsAcceptance({
      acceptedTerms: true,
      acceptedPrivacy: true,
      termsVersion: TERMS_VERSION,
      policyVersion: POLICY_VERSION,
      acceptanceMethod: 'email_register',
      capturedAt: new Date().toISOString(),
    });
    const pending = readPendingTermsAcceptance();
    expect(pending?.acceptedTerms).toBe(true);
    expect(pending?.acceptanceMethod).toBe('email_register');
    clearPendingTermsAcceptance();
    expect(readPendingTermsAcceptance()).toBeNull();
  });

  it('Executa varredura de retenção e minimização removendo legados e caches > 7d sem apagar demo ativa', () => {
    const now = Date.parse('2026-11-15T12:00:00.000Z');
    localMap.set('ipca_casa_users_v1', 'legacy');
    localMap.set('ipca_casa_session_v1', 'legacy_sess');
    localMap.set(
      'ipca_casa_ibge_cache_old',
      JSON.stringify({ timestamp: now - 10 * 24 * 60 * 60 * 1000 })
    );
    localMap.set(
      'ipca_casa_ibge_cache_fresh',
      JSON.stringify({ timestamp: now - 2 * 24 * 60 * 60 * 1000 })
    );
    localMap.set('ipca_casa_demo_items_v3', JSON.stringify([{ id: 'demo_1' }]));
    localMap.set(
      'ipca_casa_consent_history_v1',
      JSON.stringify([
        { id: 'old', decidedAt: '2024-01-01T00:00:00.000Z' },
        { id: 'recent', decidedAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() },
      ])
    );

    const report = runLocalDataRetentionSweep(now);
    expect(report.removedKeys).toContain('ipca_casa_users_v1');
    expect(report.removedKeys).toContain('ipca_casa_session_v1');
    expect(report.removedKeys).toContain('ipca_casa_ibge_cache_old');
    expect(report.prunedConsentRecords).toBe(1);
    expect(localMap.has('ipca_casa_ibge_cache_fresh')).toBe(true);
    expect(localMap.has('ipca_casa_demo_items_v3')).toBe(true);
  });

  describe('Endpoint POST /api/privacy/delete-account (Exclusão Integral Verificada)', () => {
    let server: http.Server;
    let baseUrl: string;
    const calledUrls: Array<{ method: string; url: string }> = [];
    let mockMode: 'ok' | 'unverified' | 'auth_delete_fail' = 'ok';

    beforeEach(async () => {
      calledUrls.length = 0;
      mockMode = 'ok';
      vi.unstubAllGlobals();

      const mockFetch: typeof fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = (init?.method || 'GET').toUpperCase();
        calledUrls.push({ method, url });

        if (url.includes('identitytoolkit.googleapis.com/v1/accounts:lookup')) {
          return new Response(
            JSON.stringify({
              users: [
                {
                  localId: 'usr_test_123',
                  emailVerified: mockMode !== 'unverified',
                  lastLoginAt: String(Date.now()),
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (url.includes('identitytoolkit.googleapis.com/v1/accounts:delete')) {
          if (mockMode === 'auth_delete_fail') {
            return new Response(JSON.stringify({ error: { message: 'CREDENTIAL_TOO_OLD' } }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify({ kind: 'identitytoolkit#DeleteAccountResponse' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.includes('firestore.googleapis.com/v1/')) {
          if (method === 'GET' && url.includes('/basketItems')) {
            return new Response(
              JSON.stringify({
                documents: [
                  { name: 'projects/p/databases/d/documents/users/usr_test_123/basketItems/item_1' },
                ],
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          if (method === 'GET') {
            return new Response(JSON.stringify({ documents: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          if (method === 'DELETE') {
            return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
        }

        return new Response('{}', { status: 404 });
      };

      const app = await createServerApp({
        enableVite: false,
        enableStaticDist: false,
        fetchImpl: mockFetch,
        privacyRateLimitMax: 20,
      });

      await new Promise<void>((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const addr = server.address() as AddressInfo;
          baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    afterEach(async () => {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('Rejeita chamada sem token Bearer (401)', async () => {
      const res = await fetch(`${baseUrl}/api/privacy/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmDeletion: true }),
      });
      expect(res.status).toBe(401);
    });

    it('Rejeita chamada sem confirmação explícita (400)', async () => {
      const token = makeJwtWithAuthTime(Math.floor(Date.now() / 1000));
      const res = await fetch(`${baseUrl}/api/privacy/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmDeletion: false }),
      });
      expect(res.status).toBe(400);
    });

    it('Rejeita conta sem e-mail verificado (403)', async () => {
      mockMode = 'unverified';
      const token = makeJwtWithAuthTime(Math.floor(Date.now() / 1000));
      const res = await fetch(`${baseUrl}/api/privacy/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmDeletion: true }),
      });
      expect(res.status).toBe(403);
    });

    it('Exige reautenticação recente quando auth_time > 15 minutos (401)', async () => {
      const staleToken = makeJwtWithAuthTime(Math.floor(Date.now() / 1000) - 3600);
      const res = await fetch(`${baseUrl}/api/privacy/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staleToken}`,
        },
        body: JSON.stringify({ confirmDeletion: true }),
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('REQUIRES_RECENT_LOGIN');
    });

    it('Executa exclusão em cascata ordenada e encerra conta Auth somente após apagar subcoleções e raiz', async () => {
      const freshToken = makeJwtWithAuthTime(Math.floor(Date.now() / 1000) - 30);
      const res = await fetch(`${baseUrl}/api/privacy/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({ confirmDeletion: true }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        deletedDocuments: number;
        authDeleted: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.authDeleted).toBe(true);
      expect(body.deletedDocuments).toBe(3); // 1 basketItem + private/account + root users/uid

      const deleteCalls = calledUrls.filter((c) => c.method === 'DELETE').map((c) => c.url);
      expect(deleteCalls[0]).toContain('/basketItems/item_1');
      expect(deleteCalls[1]).toContain('/users/usr_test_123/private/account');
      expect(deleteCalls[2]).toMatch(/\/documents\/users\/usr_test_123$/);
      expect(calledUrls[calledUrls.length - 1].url).toContain('accounts:delete');
    });

    it('Não emite falso sucesso quando accounts:delete falha no Identity Toolkit (502)', async () => {
      mockMode = 'auth_delete_fail';
      const freshToken = makeJwtWithAuthTime(Math.floor(Date.now() / 1000) - 10);
      const res = await fetch(`${baseUrl}/api/privacy/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({ confirmDeletion: true }),
      });
      expect(res.status).toBe(502);
      const body = (await res.json()) as { code?: string; success?: boolean };
      expect(body.success).toBeUndefined();
      expect(body.code).toBe('AUTH_DELETE_FAILED');
    });
  });
});
