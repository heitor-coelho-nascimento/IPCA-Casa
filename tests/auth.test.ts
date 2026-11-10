import { describe, it, expect, beforeEach } from 'vitest';
import { signSessionToken, verifySessionToken, parseCookies } from '../src/db/auth-tokens';
import { Repository } from '../src/db/repository';
import { isFirebaseAdminConfigured, verifyFirebaseGoogleIdToken } from '../src/lib/firebase-admin';
import { UserAccount } from '../src/types';

describe('Autenticação Google OAuth & Tokens de Sessão (IPCA-Casa)', () => {
  beforeEach(() => {
    delete process.env.MYSQL_HOST;
    delete process.env.MYSQL_USER;
    delete process.env.MYSQL_DATABASE;
  });

  it('Detecta configuração OAuth do Google provisionada em firebase-applet-config.json', () => {
    expect(isFirebaseAdminConfigured()).toBe(true);
  });

  it('Rejeita token ID do Google malformado na verificação server-side', async () => {
    await expect(verifyFirebaseGoogleIdToken('invalid.jwt.token')).rejects.toThrow();
  });

  it('Assina e verifica tokens de sessão HMAC-SHA256 para conta Google', () => {
    const user: UserAccount = {
      id: 'usr_google_1',
      email: 'usuario@gmail.com',
      displayName: 'Maria Silva',
      avatarUrl: 'https://lh3.googleusercontent.com/a/example',
      authProvider: 'google',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: '2026-01-01T00:00:00.000Z',
      profileId: 'prof_usr_google_1',
    };

    const token = signSessionToken(user);
    const verified = verifySessionToken(token);

    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe('usr_google_1');
    expect(verified?.email).toBe('usuario@gmail.com');
    expect(verified?.profileId).toBe('prof_usr_google_1');
    expect(verified?.authProvider).toBe('google');
  });

  it('Rejeita tokens adulterados ou inválidos', () => {
    const user: UserAccount = {
      id: 'usr_123',
      email: 'teste@gmail.com',
      displayName: 'Teste',
      authProvider: 'google',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: '2026-01-01T00:00:00.000Z',
      profileId: 'prof_usr_123',
    };

    const token = signSessionToken(user);
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.invalid_signature`;

    expect(verifySessionToken(tampered)).toBeNull();
    expect(verifySessionToken('')).toBeNull();
    expect(verifySessionToken('abc.def')).toBeNull();
  });

  it('Faz parsing seguro de cabeçalhos Cookie', () => {
    const cookies = parseCookies('foo=bar; ipca_session=tok123.abc.sig; theme=light');
    expect(cookies.foo).toBe('bar');
    expect(cookies.ipca_session).toBe('tok123.abc.sig');
    expect(cookies.theme).toBe('light');
  });

  it('Cria e reutiliza usuário Google no repositório sem duplicação', async () => {
    const first = await Repository.upsertGoogleUser({
      googleSub: 'google-sub-999',
      email: 'Familia.Teste@gmail.com',
      displayName: 'Família Teste',
      avatarUrl: 'https://example.com/avatar.png',
    });

    expect(first.isNewUser).toBe(true);
    expect(first.user.email).toBe('familia.teste@gmail.com');
    expect(first.user.authProvider).toBe('google');

    const second = await Repository.upsertGoogleUser({
      googleSub: 'google-sub-999',
      email: 'familia.teste@gmail.com',
      displayName: 'Família Teste Atualizada',
      avatarUrl: 'https://example.com/avatar2.png',
    });

    expect(second.isNewUser).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(second.user.profileId).toBe(first.user.profileId);
    expect(second.user.displayName).toBe('Família Teste Atualizada');
  });
});
