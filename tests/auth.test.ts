import { describe, it, expect, beforeEach } from 'vitest';
import {
  isFirebaseConfigured,
  mapFirebaseAuthError,
  OperationType,
} from '../src/lib/firebase';
import { AuthService } from '../src/services/auth';
import { safeStorage } from '../src/services/storage';
import type { UserAccount } from '../src/types';

describe('Autenticação Firebase (Google Sign-In) & Fallback Local (IPCA-Casa)', () => {
  beforeEach(() => {
    safeStorage.clear();
  });

  it('Detecta configuração válida do Firebase Auth e Firestore em firebase-applet-config.json', () => {
    expect(isFirebaseConfigured()).toBe(true);
  });

  it('Mapeia códigos de erro do Firebase Auth para mensagens claras em português', () => {
    expect(mapFirebaseAuthError({ code: 'auth/popup-closed-by-user' })).toContain('fechada');
    expect(mapFirebaseAuthError({ code: 'auth/cancelled-popup-request' })).toContain('cancelada');
    expect(mapFirebaseAuthError({ code: 'auth/popup-blocked' })).toContain('bloqueou');
    expect(mapFirebaseAuthError({ code: 'auth/unauthorized-domain' })).toContain('não está autorizado');
    expect(mapFirebaseAuthError({ code: 'auth/network-request-failed' })).toContain('Erro de rede');
    expect(mapFirebaseAuthError({ code: 'auth/account-exists-with-different-credential' })).toContain(
      'outro método de login'
    );
    expect(mapFirebaseAuthError(new Error('Falha customizada'))).toBe('Falha customizada');
    expect(mapFirebaseAuthError({})).toBe('Falha ao autenticar com o Google.');
  });

  it('Mantém os tipos de operação do Firestore alinhados para auditoria de erros', () => {
    expect(OperationType.CREATE).toBe('create');
    expect(OperationType.UPDATE).toBe('update');
    expect(OperationType.DELETE).toBe('delete');
    expect(OperationType.LIST).toBe('list');
    expect(OperationType.GET).toBe('get');
    expect(OperationType.WRITE).toBe('write');
  });

  it('Permite cadastro, login e logout local em navegador quando sem nuvem', async () => {
    const reg = await AuthService.register({
      email: 'Familia.Teste@Exemplo.com',
      displayName: 'Família Teste',
      password: 'segredo_valido_123',
    });

    expect(reg.success).toBe(true);
    expect(reg.session?.user.email).toBe('familia.teste@exemplo.com');
    expect(reg.session?.user.authProvider).toBe('local');
    expect(AuthService.getCurrentUser()?.displayName).toBe('Família Teste');

    AuthService.logout();
    expect(AuthService.getCurrentUser()).toBeNull();

    const wrongLogin = await AuthService.login({
      email: 'familia.teste@exemplo.com',
      password: 'senha_errada',
    });
    expect(wrongLogin.success).toBe(false);

    const validLogin = await AuthService.login({
      email: 'familia.teste@exemplo.com',
      password: 'segredo_valido_123',
    });
    expect(validLogin.success).toBe(true);
    expect(AuthService.getCurrentUser()?.email).toBe('familia.teste@exemplo.com');
  });

  it('Impede cadastro duplicado e valida e-mail e tamanho mínimo da senha', async () => {
    const invalidEmail = await AuthService.register({
      email: 'invalido',
      displayName: 'Maria',
      password: '123456',
    });
    expect(invalidEmail.success).toBe(false);

    const shortPwd = await AuthService.register({
      email: 'maria@exemplo.com',
      displayName: 'Maria',
      password: '123',
    });
    expect(shortPwd.success).toBe(false);

    const ok = await AuthService.register({
      email: 'maria@exemplo.com',
      displayName: 'Maria Silva',
      password: 'senha_segura',
    });
    expect(ok.success).toBe(true);

    const duplicate = await AuthService.register({
      email: 'MARIA@exemplo.com',
      displayName: 'Outra Maria',
      password: 'outra_senha',
    });
    expect(duplicate.success).toBe(false);
  });

  it('Bloqueia login por senha local quando a conta está vinculada ao Google', async () => {
    const googleUser: UserAccount = {
      id: 'google_uid_1',
      email: 'google.user@gmail.com',
      displayName: 'Usuário Google',
      authProvider: 'google',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: '2026-01-01T00:00:00.000Z',
      profileId: 'prof_google_uid_1',
    };

    AuthService.setSession({
      user: googleUser,
      token: 'firebase_google_google_uid_1',
    });
    AuthService.logout();

    const attempt = await AuthService.login({
      email: 'google.user@gmail.com',
      password: 'qualquer_senha',
    });
    expect(attempt.success).toBe(false);
    expect(attempt.error).toContain('Google');
  });

  it('Executa recuperação de acesso local apenas para e-mails cadastrados', async () => {
    await AuthService.register({
      email: 'recupera@exemplo.com',
      displayName: 'Carlos',
      password: 'senha_forte',
    });

    const missing = AuthService.recoverPassword('desconhecido@exemplo.com');
    expect(missing.success).toBe(false);

    const found = AuthService.recoverPassword('RECUPERA@exemplo.com');
    expect(found.success).toBe(true);
    expect(found.message).toContain('recupera@exemplo.com');
  });
});
