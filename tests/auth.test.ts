import { describe, it, expect, beforeEach } from 'vitest';
import {
  isFirebaseConfigured,
  mapFirebaseAuthError,
  OperationType,
} from '../src/lib/firebase';
import {
  AuthService,
  LegacyMigrationService,
  isValidEmailFormat,
} from '../src/services/auth';
import { safeStorage } from '../src/services/storage';

describe('Autenticação Firebase (Google Sign-In / E-mail) & Migração Segura (IPCA-Casa)', () => {
  beforeEach(() => {
    safeStorage.clear();
  });

  it('Detecta configuração válida do Firebase Auth e Firestore em firebase-applet-config.json', () => {
    expect(isFirebaseConfigured()).toBe(true);
  });

  it('Mapeia códigos de erro do Firebase Auth para mensagens claras em português sem vazar detalhes internos', () => {
    expect(mapFirebaseAuthError({ code: 'auth/popup-closed-by-user' })).toContain('fechada');
    expect(mapFirebaseAuthError({ code: 'auth/cancelled-popup-request' })).toContain('cancelada');
    expect(mapFirebaseAuthError({ code: 'auth/popup-blocked' })).toContain('bloqueou');
    expect(mapFirebaseAuthError({ code: 'auth/unauthorized-domain' })).toContain('não está autorizado');
    expect(mapFirebaseAuthError({ code: 'auth/network-request-failed' })).toContain('Erro de rede');
    expect(mapFirebaseAuthError({ code: 'auth/account-exists-with-different-credential' })).toContain(
      'outro método de login'
    );
    expect(mapFirebaseAuthError({ code: 'auth/invalid-credential' })).toContain('E-mail ou senha inválidos');
    expect(mapFirebaseAuthError(new Error('Falha customizada'))).toBe(
      'Não foi possível concluir a autenticação no momento. Tente novamente.'
    );
    expect(mapFirebaseAuthError({})).toBe(
      'Não foi possível concluir a autenticação no momento. Tente novamente.'
    );
  });

  it('Mantém os tipos de operação do Firestore alinhados para auditoria de erros', () => {
    expect(OperationType.CREATE).toBe('create');
    expect(OperationType.UPDATE).toBe('update');
    expect(OperationType.DELETE).toBe('delete');
    expect(OperationType.LIST).toBe('list');
    expect(OperationType.GET).toBe('get');
    expect(OperationType.WRITE).toBe('write');
  });

  it('Valida formato de e-mail, nome de exibição e tamanho mínimo da senha antes de chamar o Firebase Auth', async () => {
    expect(isValidEmailFormat('Familia.Teste@Exemplo.com')).toBe(true);
    expect(isValidEmailFormat('invalido')).toBe(false);

    const shortName = await AuthService.register({
      email: 'maria@exemplo.com',
      displayName: 'A',
      password: 'senha_segura',
    });
    expect(shortName.success).toBe(false);
    expect(shortName.error).toContain('2 e 120');

    const invalidEmail = await AuthService.register({
      email: 'invalido',
      displayName: 'Maria Silva',
      password: 'senha_segura',
    });
    expect(invalidEmail.success).toBe(false);
    expect(invalidEmail.error).toContain('e-mail válido');

    const shortPwd = await AuthService.register({
      email: 'maria@exemplo.com',
      displayName: 'Maria Silva',
      password: '123',
    });
    expect(shortPwd.success).toBe(false);
    expect(shortPwd.error).toContain('mínimo 6 caracteres');
  });

  it('Valida credenciais obrigatórias no login e formato de e-mail na recuperação de senha', async () => {
    const invalidLoginEmail = await AuthService.login({
      email: 'sem_arroba',
      password: '123456',
    });
    expect(invalidLoginEmail.success).toBe(false);
    expect(invalidLoginEmail.error).toContain('e-mail válido');

    const emptyPassword = await AuthService.login({
      email: 'usuario@exemplo.com',
      password: '',
    });
    expect(emptyPassword.success).toBe(false);
    expect(emptyPassword.error).toContain('senha');

    const invalidRecovery = await AuthService.recoverPassword('email-invalido');
    expect(invalidRecovery.success).toBe(false);
    expect(invalidRecovery.message).toContain('e-mail válido');

    // Nunca armazena credenciais ou sessões falsas em localStorage
    expect(AuthService.getCurrentFirebaseIdentity()).toBeNull();
  });

  it('Detecta e limpa apenas dados locais reais legados preservando dados do perfil demonstração', () => {
    safeStorage.setItem(
      'ipca_casa_user_accounts_v1',
      JSON.stringify([{ email: 'legado@exemplo.com' }])
    );
    safeStorage.setItem(
      'ipca_casa_profiles_v1',
      JSON.stringify([
        { id: 'profile-demo', name: 'Demo', membersCount: 3, referenceRegion: 'BR', currency: 'BRL', isDemo: true },
        { id: 'prof-real-1', name: 'Minha Casa', membersCount: 2, referenceRegion: 'SP', currency: 'BRL', isDemo: false },
      ])
    );
    safeStorage.setItem(
      'ipca_casa_basket_items_v1',
      JSON.stringify([
        { id: 'item-demo', profileId: 'profile-demo', name: 'Demo Item' },
        { id: 'item-real', profileId: 'prof-real-1', name: 'Arroz Real' },
      ])
    );

    const bundle = LegacyMigrationService.scanLegacyLocalData();
    expect(bundle.hasLegacyCredentials).toBe(true);
    expect(bundle.legacyAccountsCount).toBe(1);
    expect(bundle.hasFinancialData).toBe(true);
    expect(bundle.profiles.map((p) => p.id)).toEqual(['prof-real-1']);
    expect(bundle.basketItems.map((i) => i.id)).toEqual(['item-real']);

    LegacyMigrationService.clearMigratedLocalData('uid-verificado-1');
    expect(LegacyMigrationService.hasLegacyCredentials()).toBe(false);
    expect(LegacyMigrationService.isDismissedForUser('uid-verificado-1')).toBe(true);

    const remainingProfiles = JSON.parse(safeStorage.getItem('ipca_casa_profiles_v1') || '[]');
    const remainingItems = JSON.parse(safeStorage.getItem('ipca_casa_basket_items_v1') || '[]');
    expect(remainingProfiles).toHaveLength(1);
    expect(remainingProfiles[0].id).toBe('profile-demo');
    expect(remainingItems).toHaveLength(1);
    expect(remainingItems[0].id).toBe('item-demo');
  });
});

