import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  BLUEPRINT_LIMITS,
  sanitizeFirestoreId,
  clampString,
  nonNegativeNumber,
  clampMembersCount,
  sanitizeClassification,
  buildProfileWritePayload,
  buildBasketItemWritePayload,
  buildPriceRecordWritePayload,
} from '../src/services/firestore';
import { handleFirestoreError, OperationType } from '../src/lib/firebase';
import type { BasketItem, FamilyProfile } from '../src/types';

const ROOT_DIR = path.resolve(process.cwd());
const RULES_TEXT = fs.readFileSync(path.join(ROOT_DIR, 'firestore.rules'), 'utf-8');
const BLUEPRINT_JSON = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'firebase-blueprint.json'), 'utf-8')
);
const SECURITY_SPEC = fs.readFileSync(path.join(ROOT_DIR, 'security_spec.md'), 'utf-8');

describe('Segurança Firestore, Blueprint e Guardrails Anti-Dirty-Dozen (IPCA-Casa)', () => {
  it('Mantém sincronismo completo entre todas as coleções do firebase-blueprint.json e firestore.rules', () => {
    const paths = Object.keys(BLUEPRINT_JSON.firestore || {});
    expect(paths.length).toBeGreaterThanOrEqual(8);

    expect(RULES_TEXT).toContain('match /users/{userId}');
    expect(RULES_TEXT).toContain('match /private/{docId}');
    expect(RULES_TEXT).toContain('match /profiles/{profileId}');
    expect(RULES_TEXT).toContain('match /basketItems/{itemId}');
    expect(RULES_TEXT).toContain('match /priceHistory/{priceId}');
    expect(RULES_TEXT).toContain('match /incomeHistory/{incomeId}');
    expect(RULES_TEXT).toContain('match /consumptionGroups/{groupId}');
    expect(RULES_TEXT).toContain('match /strategies/{strategyId}');
    expect(SECURITY_SPEC).toContain('Dirty Dozen');
  });

  it('Aplica Default Deny global, exigência de email_verified e isolamento de PII em /users/{userId}/private', () => {
    expect(RULES_TEXT).toContain('match /{document=**} {\n      allow read, write: if false;\n    }');
    expect(RULES_TEXT).toContain('request.auth != null && request.auth.token.email_verified == true');
    expect(RULES_TEXT).toContain('isSignedIn() && request.auth.uid == userId');

    // PII Leak Prevention (#12)
    const usersMatchIdx = RULES_TEXT.indexOf('match /users/{userId}');
    const privateMatchIdx = RULES_TEXT.indexOf('match /private/{docId}');
    const profilesMatchIdx = RULES_TEXT.indexOf('match /profiles/{profileId}');
    const rootUserSection = RULES_TEXT.slice(usersMatchIdx, privateMatchIdx);
    const privateSection = RULES_TEXT.slice(privateMatchIdx, profilesMatchIdx);

    expect(rootUserSection).toContain('allow list: if false;');
    expect(rootUserSection).toContain('allow delete: if false;');
    expect(privateSection).toContain("docId == 'account'");
    expect(privateSection).toContain('allow list: if false;');
    expect(privateSection).toContain('allow delete: if false;');
  });

  it('Impõe Query Enforcer (sem get/exists em allow list) e integridade referencial nas subcoleções', () => {
    const listRules = RULES_TEXT.match(/allow list:[^\n]+/g) || [];
    expect(listRules.length).toBe(8);
    for (const rule of listRules) {
      if (!rule.includes('if false;')) {
        expect(rule).toContain('isOwner(userId)');
        expect(rule).toContain('existing().userId == request.auth.uid');
        expect(rule).not.toContain('exists(');
        expect(rule).not.toContain('get(');
      }
    }

    // Referential Integrity (#5, #6)
    expect(RULES_TEXT).toContain('profileExists(userId, incoming().profileId)');
    expect(RULES_TEXT).toContain('itemExists(userId, incoming().itemId)');
    expect(RULES_TEXT).toContain('existsAfter(/databases/$(database)/documents/users/$(userId)/basketItems/$(incoming().itemId))');
    expect(RULES_TEXT).toContain('userExists(userId)');

    // Timestamp & Immutability checks (#10, #11)
    expect(RULES_TEXT).toContain('incoming().createdAt == request.time');
    expect(RULES_TEXT).toContain('incoming().updatedAt == request.time');
    expect(RULES_TEXT).toContain('incoming().createdAt == existing().createdAt');
    expect(RULES_TEXT).toContain('incoming().userId == existing().userId');
    expect(RULES_TEXT).toContain('incoming().profileId == existing().profileId');
  });

  it('Previne ID Poisoning (#7): sanitiza path traversal, caracteres inválidos e trunca IDs > 128 chars', () => {
    const traversal = sanitizeFirestoreId('../../admin/super');
    expect(BLUEPRINT_LIMITS.ID_REGEX.test(traversal)).toBe(true);
    expect(traversal.length).toBeLessThanOrEqual(BLUEPRINT_LIMITS.ID_MAX);
    expect(traversal).not.toContain('/');
    expect(traversal).not.toContain('.');

    const hugeId = 'x'.repeat(1500);
    const sanitizedHuge = sanitizeFirestoreId(hugeId);
    expect(sanitizedHuge.length).toBe(128);
    expect(BLUEPRINT_LIMITS.ID_REGEX.test(sanitizedHuge)).toBe(true);

    const emptyOnlySymbols = sanitizeFirestoreId('///...!!!', 'item');
    expect(emptyOnlySymbols.startsWith('item_')).toBe(true);
    expect(BLUEPRINT_LIMITS.ID_REGEX.test(emptyOnlySymbols)).toBe(true);
  });

  it('Previne Payload Exhaustion (#8) e Type Confusion (#9) alinhados ao Blueprint', () => {
    const propsBasket = BLUEPRINT_JSON.entities.BasketItem.properties;
    expect(BLUEPRINT_LIMITS.ITEM_NAME_MAX).toBe(propsBasket.name.maxLength);
    expect(BLUEPRINT_LIMITS.ITEM_DESC_MAX).toBe(propsBasket.description.maxLength);
    expect(BLUEPRINT_LIMITS.NOTES_MAX).toBe(propsBasket.notes.maxLength);
    expect(BLUEPRINT_LIMITS.UNIT_MAX).toBe(propsBasket.unit.maxLength);

    const oversized = 'A'.repeat(5000);
    expect(clampString(oversized, BLUEPRINT_LIMITS.NOTES_MAX).length).toBe(1000);

    expect(nonNegativeNumber(-50, 0)).toBe(0);
    expect(nonNegativeNumber('abc', 0)).toBe(0);
    expect(nonNegativeNumber(Number.POSITIVE_INFINITY, 0)).toBe(0);
    expect(nonNegativeNumber('42.5', 0)).toBe(42.5);

    expect(clampMembersCount(0)).toBe(1);
    expect(clampMembersCount(120)).toBe(50);
    expect(clampMembersCount(3.6)).toBe(4);

    expect(sanitizeClassification('VIP')).toBe('Não classificado');
    expect(sanitizeClassification('Essencial')).toBe('Essencial');
    expect(sanitizeClassification('Supérfluo')).toBe('Supérfluo');
  });

  it('Constrói payloads seguros de FamilyProfile com isolamento Anti-Update-Gap e sem Ghost Fields (#4, #11)', () => {
    const dirtyProfile = {
      id: '../../hacked-profile',
      name: '  Família Silva  ' + 'Z'.repeat(300),
      membersCount: 99,
      referenceRegion: 'Brasil',
      currency: 'BRL',
      isDemo: true, // Tenta falsificar flag demo em perfil de nuvem
      isAdmin: true, // Ghost field
      createdAt: '2020-01-01',
      updatedAt: '2020-01-01',
    } as unknown as FamilyProfile;

    const createPayload = buildProfileWritePayload(dirtyProfile, 'uid_abc', true);
    expect(Object.keys(createPayload).sort()).toEqual([
      'createdAt',
      'currency',
      'id',
      'isDemo',
      'membersCount',
      'name',
      'referenceRegion',
      'updatedAt',
      'userId',
    ]);
    expect(createPayload.userId).toBe('uid_abc');
    expect(createPayload.isDemo).toBe(false);
    expect(createPayload.membersCount).toBe(50);
    expect((createPayload.name as string).length).toBe(BLUEPRINT_LIMITS.PROFILE_NAME_MAX);
    expect('isAdmin' in createPayload).toBe(false);

    const updatePayload = buildProfileWritePayload(dirtyProfile, 'uid_abc', false);
    expect(Object.keys(updatePayload).sort()).toEqual([
      'currency',
      'membersCount',
      'name',
      'referenceRegion',
      'updatedAt',
    ]);
    // Campos imutáveis nunca devem entrar no updateDoc
    expect('id' in updatePayload).toBe(false);
    expect('userId' in updatePayload).toBe(false);
    expect('createdAt' in updatePayload).toBe(false);
    expect('isDemo' in updatePayload).toBe(false);
  });

  it('Constrói payloads seguros de BasketItem respeitando chaves permitidas em create/update', () => {
    const item: BasketItem = {
      id: 'item_01',
      profileId: 'prof_01',
      name: 'Café Torrado',
      group: 'Alimentação e bebidas',
      classification: 'Essencial',
      monthlySpend: -10, // valor inválido negativo deve virar 0
      oldPrice: 18.5,
      currentPrice: 24.9,
      oldPriceDate: '2024-01-01',
      currentPriceDate: '2025-01-01',
      unit: 'kg',
      notes: 'X'.repeat(2500),
      active: true,
      isArchived: false,
      createdAt: '2024-01-01',
      updatedAt: '2025-01-01',
    };

    const createPayload = buildBasketItemWritePayload(item, 'uid_1', true);
    expect(createPayload.userId).toBe('uid_1');
    expect(createPayload.profileId).toBe('prof_01');
    expect(createPayload.monthlySpend).toBe(0);
    expect((createPayload.notes as string).length).toBe(BLUEPRINT_LIMITS.NOTES_MAX);

    const updatePayload = buildBasketItemWritePayload(item, 'uid_1', false);
    expect('id' in updatePayload).toBe(false);
    expect('userId' in updatePayload).toBe(false);
    expect('profileId' in updatePayload).toBe(false);
    expect('createdAt' in updatePayload).toBe(false);
    expect('description' in updatePayload).toBe(false);
  });

  it('Constrói payloads seguros de PriceRecord estritamente alinhados ao Blueprint e às chaves permitidas em firestore.rules', () => {
    const priceSchema = BLUEPRINT_JSON.entities.PriceRecord;
    const allowedKeys = Object.keys(priceSchema.properties);
    const requiredKeys: string[] = priceSchema.required;

    const payload = buildPriceRecordWritePayload(
      {
        id: 'price_1794513530763_h2w0or',
        profileId: 'prof_8Zpz6IkKLKSqlnfoMmk7zR4I69f2',
        itemId: 'item-1794513530-abcd',
        price: 24.9,
        referenceDate: '2026-11-12',
        unit: 'unidade',
        dataOrigin: 'usuario',
        source: 'Atualização da Cesta',
      },
      '8Zpz6IkKLKSqlnfoMmk7zR4I69f2',
      true
    );

    for (const reqKey of requiredKeys) {
      expect(reqKey in payload).toBe(true);
    }
    for (const key of Object.keys(payload)) {
      expect(allowedKeys).toContain(key);
    }
    expect(BLUEPRINT_LIMITS.ID_REGEX.test(String(payload.id))).toBe(true);
    expect(BLUEPRINT_LIMITS.ID_REGEX.test(String(payload.itemId))).toBe(true);
    expect(payload.userId).toBe('8Zpz6IkKLKSqlnfoMmk7zR4I69f2');
    expect(payload.price).toBe(24.9);
    expect(payload.referenceDate).toBe('2026-11-12');
    expect(payload.dataOrigin).toBe('usuario');
  });

  it('Emite erro JSON estruturado no handleFirestoreError para auditoria de permissões', () => {
    let thrownMessage = '';
    try {
      handleFirestoreError(
        new Error('Missing or insufficient permissions.'),
        OperationType.WRITE,
        'users/u1/basketItems/i1'
      );
    } catch (err) {
      thrownMessage = err instanceof Error ? err.message : String(err);
    }

    const parsed = JSON.parse(thrownMessage);
    expect(parsed.error).toContain('insufficient permissions');
    expect(parsed.operationType).toBe('write');
    expect(parsed.path).toBe('users/u1/basketItems/i1');
    expect(parsed.authInfo).toBeDefined();
    expect(Array.isArray(parsed.authInfo.providerInfo)).toBe(true);
  });
});
