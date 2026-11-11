/**
 * IPCA-Casa: Serviço de Persistência e Sincronização em Tempo Real no Cloud Firestore
 * Aplica validação síncrona com firebase-blueprint.json e firestore.rules.
 */
import type { User } from 'firebase/auth';
import {
  Timestamp,
  Unsubscribe,
  WriteBatch,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import { extractAuthProvider } from '../lib/firebaseAuthOnly';
import { BLUEPRINT_LIMITS, sanitizeFirestoreId } from '../lib/firebaseConfig';
import type {
  BasketItem,
  ConsumptionGroup,
  EfficiencyPlanB,
  FamilyProfile,
  IncomeRecord,
  ItemClassification,
  OpportunityPlanC,
  PriceRecord,
  SubstitutePlanA,
  UserAccount,
} from '../types';
import { extractIsoDatePrefix, getMonthsAgoIsoDate, getTodayIsoDate } from '../utils/dates';
import type { LegacyLocalBundle } from './auth';

export { BLUEPRINT_LIMITS, sanitizeFirestoreId };

const MAX_FIRESTORE_NUMBER = 10000000000;
const MAX_BATCH_OPERATIONS = 400;

export function clampString(value: unknown, maxLen: number, fallback = ''): string {
  const str = typeof value === 'string' ? value.trim() : String(value ?? fallback).trim();
  const resolved = str || fallback;
  return resolved.slice(0, maxLen);
}

export function nonNegativeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.min(MAX_FIRESTORE_NUMBER, num);
}

export function boundedNumber(
  value: unknown,
  minVal: number,
  maxVal: number,
  fallback: number
): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(maxVal, Math.max(minVal, num));
}

function finiteNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function clampMembersCount(value: unknown): number {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num) || num < 1) return 1;
  return Math.min(50, num);
}

export function sanitizeClassification(value: unknown): ItemClassification {
  if (value === 'Essencial' || value === 'Supérfluo' || value === 'Não classificado') {
    return value;
  }
  return 'Não classificado';
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return new Date().toISOString();
}

export function buildProfileWritePayload(
  profile: FamilyProfile,
  userId: string,
  isCreate: boolean
): Record<string, unknown> {
  const id = sanitizeFirestoreId(profile.id, 'prof');
  const base: Record<string, unknown> = {
    name: clampString(profile.name, BLUEPRINT_LIMITS.PROFILE_NAME_MAX, 'Meu Orçamento Familiar'),
    membersCount: clampMembersCount(profile.membersCount),
    referenceRegion: clampString(profile.referenceRegion, BLUEPRINT_LIMITS.REGION_MAX, 'Brasil'),
    currency: clampString(profile.currency, BLUEPRINT_LIMITS.CURRENCY_MAX, 'BRL'),
    updatedAt: serverTimestamp(),
  };

  if (isCreate) {
    return {
      id,
      userId,
      ...base,
      isDemo: false,
      createdAt: serverTimestamp(),
    };
  }
  return base;
}

export function buildBasketItemWritePayload(
  item: BasketItem,
  userId: string,
  isCreate: boolean
): Record<string, unknown> {
  const id = sanitizeFirestoreId(item.id, 'item');
  const profileId = sanitizeFirestoreId(item.profileId, 'prof');

  const mutable: Record<string, unknown> = {
    name: clampString(item.name, BLUEPRINT_LIMITS.ITEM_NAME_MAX, 'Item sem nome'),
    group: clampString(item.group, BLUEPRINT_LIMITS.GROUP_NAME_MAX, 'Alimentação e bebidas'),
    classification: sanitizeClassification(item.classification),
    monthlySpend: nonNegativeNumber(item.monthlySpend, 0),
    oldPrice: nonNegativeNumber(item.oldPrice, 0),
    currentPrice: nonNegativeNumber(item.currentPrice, 0),
    oldPriceDate: clampString(item.oldPriceDate || '', BLUEPRINT_LIMITS.DATE_MAX),
    currentPriceDate: clampString(item.currentPriceDate || '', BLUEPRINT_LIMITS.DATE_MAX),
    unit: clampString(item.unit, BLUEPRINT_LIMITS.UNIT_MAX, 'unidade'),
    active: item.active !== false,
    isArchived: Boolean(item.isArchived),
    updatedAt: serverTimestamp(),
  };

  if (typeof item.description === 'string') {
    mutable.description = item.description.trim().slice(0, BLUEPRINT_LIMITS.ITEM_DESC_MAX);
  }
  if (typeof item.notes === 'string') {
    mutable.notes = item.notes.trim().slice(0, BLUEPRINT_LIMITS.NOTES_MAX);
  }

  if (isCreate) {
    return {
      id,
      userId,
      profileId,
      ...mutable,
      createdAt: serverTimestamp(),
    };
  }
  return mutable;
}

export function buildPlanCWritePayload(
  plan: OpportunityPlanC,
  userId: string,
  isCreate: boolean
): Record<string, unknown> {
  const profileId = sanitizeFirestoreId(plan.profileId, 'prof');
  const strategyId = sanitizeFirestoreId(plan.id || `opp_${profileId}`, 'opp');

  const mutable: Record<string, unknown> = {
    title: 'Reserva de Oportunidade & Alocação',
    applied: true,
    monthlySavings: nonNegativeNumber(plan.monthlyInvestment, 0),
    monthlyInvestment: nonNegativeNumber(plan.monthlyInvestment, 0),
    nominalAnnualRate: boundedNumber(plan.nominalAnnualRate, 0, 10000, 0),
    expectedAnnualInflation: boundedNumber(plan.expectedAnnualInflation, 0, 10000, 0),
    realAnnualYield: boundedNumber(plan.realAnnualYield, -100, 10000, 0),
    projection12Months: nonNegativeNumber(plan.projection12Months, 0),
    projection24Months: nonNegativeNumber(plan.projection24Months, 0),
    projection36Months: nonNegativeNumber(plan.projection36Months, 0),
    useLinkedSavings: Boolean(plan.useLinkedSavings),
    updatedAt: serverTimestamp(),
  };

  if (typeof plan.notes === 'string') {
    mutable.notes = plan.notes.trim().slice(0, BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX);
  }

  if (isCreate) {
    return {
      id: strategyId,
      userId,
      profileId,
      planType: 'PLAN_C',
      ...mutable,
      createdAt: serverTimestamp(),
    };
  }
  return mutable;
}

async function commitInChunks(ops: Array<(batch: WriteBatch) => void>): Promise<void> {
  if (!db || ops.length === 0) return;
  for (let i = 0; i < ops.length; i += MAX_BATCH_OPERATIONS) {
    const batch = writeBatch(db);
    const slice = ops.slice(i, i + MAX_BATCH_OPERATIONS);
    for (const op of slice) {
      op(batch);
    }
    await batch.commit();
  }
}

const bootstrapInFlight = new Map<string, Promise<{ user: UserAccount; isNewUser: boolean }>>();

export class FirestoreService {
  static async ensureUserBootstrapped(
    firebaseUser: User
  ): Promise<{ user: UserAccount; isNewUser: boolean }> {
    const uid = sanitizeFirestoreId(firebaseUser.uid, 'usr');
    const existingPromise = bootstrapInFlight.get(uid);
    if (existingPromise) {
      return existingPromise;
    }

    const task = this.runBootstrap(firebaseUser, uid).finally(() => {
      bootstrapInFlight.delete(uid);
    });
    bootstrapInFlight.set(uid, task);
    return task;
  }

  private static async runBootstrap(
    firebaseUser: User,
    uid: string
  ): Promise<{ user: UserAccount; isNewUser: boolean }> {
    if (!db) {
      throw new Error('Cloud Firestore não está configurado neste ambiente.');
    }

    const authProvider = extractAuthProvider(firebaseUser);
    const emailVerified = Boolean(firebaseUser.emailVerified);

    const email = clampString(
      firebaseUser.email || '',
      BLUEPRINT_LIMITS.EMAIL_MAX,
      'usuario@ipca-casa.app'
    ).toLowerCase();
    const displayName = clampString(
      firebaseUser.displayName || email.split('@')[0],
      BLUEPRINT_LIMITS.DISPLAY_NAME_MAX,
      'Usuário'
    );
    const avatarUrl =
      typeof firebaseUser.photoURL === 'string' && firebaseUser.photoURL.trim().length > 0
        ? firebaseUser.photoURL.trim().slice(0, BLUEPRINT_LIMITS.AVATAR_URL_MAX)
        : undefined;

    const userDocRef = doc(db, 'users', uid);
    const privateDocRef = doc(db, 'users', uid, 'private', 'account');

    let userSnap;
    try {
      userSnap = await getDoc(userDocRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }

    if (!userSnap.exists()) {
      const defaultProfileId = sanitizeFirestoreId(`prof_${uid}`, 'prof');
      const profileDocRef = doc(db, 'users', uid, 'profiles', defaultProfileId);

      const batch = writeBatch(db);
      const userPublicPayload: Record<string, unknown> = {
        id: uid,
        userId: uid,
        displayName,
        authProvider,
        defaultProfileId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (avatarUrl) {
        userPublicPayload.avatarUrl = avatarUrl;
      }

      batch.set(userDocRef, userPublicPayload);
      batch.set(privateDocRef, {
        id: 'account',
        userId: uid,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(profileDocRef, {
        id: defaultProfileId,
        userId: uid,
        name: displayName,
        membersCount: 2,
        referenceRegion: 'Brasil',
        currency: 'BRL',
        isDemo: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
      }

      const nowIso = new Date().toISOString();
      return {
        isNewUser: true,
        user: {
          id: uid,
          email,
          displayName,
          avatarUrl,
          authProvider,
          emailVerified,
          createdAt: nowIso,
          lastLoginAt: nowIso,
          profileId: defaultProfileId,
        },
      };
    }

    const existingData = userSnap.data();
    const defaultProfileId = sanitizeFirestoreId(
      existingData.defaultProfileId || `prof_${uid}`,
      'prof'
    );

    const updatePayload: Record<string, unknown> = {
      displayName,
      authProvider,
      defaultProfileId,
      updatedAt: serverTimestamp(),
    };
    if (avatarUrl) {
      updatePayload.avatarUrl = avatarUrl;
    }

    try {
      await updateDoc(userDocRef, updatePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }

    try {
      const privSnap = await getDoc(privateDocRef);
      if (!privSnap.exists()) {
        await setDoc(privateDocRef, {
          id: 'account',
          userId: uid,
          email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (privSnap.data().email !== email) {
        await updateDoc(privateDocRef, {
          email,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/private/account`);
    }

    try {
      const defaultProfileRef = doc(db, 'users', uid, 'profiles', defaultProfileId);
      const profSnap = await getDoc(defaultProfileRef);
      if (!profSnap.exists()) {
        await setDoc(defaultProfileRef, {
          id: defaultProfileId,
          userId: uid,
          name: displayName,
          membersCount: 2,
          referenceRegion: 'Brasil',
          currency: 'BRL',
          isDemo: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/profiles/${defaultProfileId}`);
    }

    return {
      isNewUser: false,
      user: {
        id: uid,
        email,
        displayName,
        avatarUrl: avatarUrl || existingData.avatarUrl,
        authProvider,
        emailVerified,
        createdAt: timestampToIso(existingData.createdAt),
        lastLoginAt: new Date().toISOString(),
        profileId: defaultProfileId,
      },
    };
  }

  static subscribeUserCollections(
    userId: string,
    handlers: {
      onProfiles: (profiles: FamilyProfile[]) => void;
      onBasketItems: (items: BasketItem[]) => void;
      onIncomeHistory: (records: IncomeRecord[]) => void;
      onPriceHistory: (records: PriceRecord[]) => void;
      onConsumptionGroups: (groups: ConsumptionGroup[]) => void;
      onStrategies: (strategies: {
        plansA: SubstitutePlanA[];
        plansB: EfficiencyPlanB[];
        plansC: OpportunityPlanC[];
        planC?: OpportunityPlanC;
      }) => void;
    }
  ): () => void {
    if (!db) return () => {};
    const uid = sanitizeFirestoreId(userId, 'usr');
    const unsubs: Unsubscribe[] = [];

    const profilesPath = `users/${uid}/profiles`;
    unsubs.push(
      onSnapshot(
        query(collection(db, profilesPath), where('userId', '==', uid)),
        (snapshot) => {
          const profiles: FamilyProfile[] = snapshot.docs.map((d) => {
            const raw = d.data();
            return {
              id: raw.id || d.id,
              name: String(raw.name || 'Meu Orçamento Familiar'),
              membersCount: finiteNumber(raw.membersCount, 1),
              referenceRegion: String(raw.referenceRegion || 'Brasil'),
              currency: String(raw.currency || 'BRL'),
              isDemo: false,
              createdAt: timestampToIso(raw.createdAt),
              updatedAt: timestampToIso(raw.updatedAt),
            };
          });
          handlers.onProfiles(profiles);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, profilesPath)
      )
    );

    const basketPath = `users/${uid}/basketItems`;
    unsubs.push(
      onSnapshot(
        query(collection(db, basketPath), where('userId', '==', uid)),
        (snapshot) => {
          const items: BasketItem[] = snapshot.docs.map((d) => {
            const raw = d.data();
            return {
              id: raw.id || d.id,
              profileId: String(raw.profileId || ''),
              name: String(raw.name || ''),
              description: typeof raw.description === 'string' ? raw.description : undefined,
              group: String(raw.group || 'Alimentação e bebidas'),
              classification: sanitizeClassification(raw.classification),
              monthlySpend: finiteNumber(raw.monthlySpend, 0),
              oldPrice: finiteNumber(raw.oldPrice, 0),
              currentPrice: finiteNumber(raw.currentPrice, 0),
              oldPriceDate: String(raw.oldPriceDate || ''),
              currentPriceDate: String(raw.currentPriceDate || ''),
              unit: String(raw.unit || 'unidade'),
              notes: typeof raw.notes === 'string' ? raw.notes : undefined,
              active: raw.active !== false,
              isArchived: Boolean(raw.isArchived),
              createdAt: timestampToIso(raw.createdAt),
              updatedAt: timestampToIso(raw.updatedAt),
            };
          });
          handlers.onBasketItems(items);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, basketPath)
      )
    );

    const incomePath = `users/${uid}/incomeHistory`;
    unsubs.push(
      onSnapshot(
        query(collection(db, incomePath), where('userId', '==', uid)),
        (snapshot) => {
          const records: IncomeRecord[] = snapshot.docs
            .map((d) => {
              const raw = d.data();
              return {
                id: raw.id || d.id,
                profileId: String(raw.profileId || ''),
                referenceDate: String(raw.referenceDate || ''),
                nominalIncome: finiteNumber(raw.nominalIncome, 0),
                source: typeof raw.source === 'string' ? raw.source : undefined,
                notes: typeof raw.notes === 'string' ? raw.notes : undefined,
                createdAt: timestampToIso(raw.createdAt),
              };
            })
            .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
          handlers.onIncomeHistory(records);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, incomePath)
      )
    );

    const pricePath = `users/${uid}/priceHistory`;
    unsubs.push(
      onSnapshot(
        query(collection(db, pricePath), where('userId', '==', uid)),
        (snapshot) => {
          const records: PriceRecord[] = snapshot.docs
            .map((d) => {
              const raw = d.data();
              return {
                id: raw.id || d.id,
                itemId: String(raw.itemId || ''),
                price: finiteNumber(raw.price, 0),
                referenceDate: String(raw.referenceDate || ''),
                unit: typeof raw.unit === 'string' ? raw.unit : undefined,
                source: typeof raw.source === 'string' ? raw.source : undefined,
                notes: typeof raw.notes === 'string' ? raw.notes : undefined,
                createdAt: timestampToIso(raw.createdAt),
              };
            })
            .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
          handlers.onPriceHistory(records);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, pricePath)
      )
    );

    const groupsPath = `users/${uid}/consumptionGroups`;
    unsubs.push(
      onSnapshot(
        query(collection(db, groupsPath), where('userId', '==', uid)),
        (snapshot) => {
          const groups: ConsumptionGroup[] = snapshot.docs.map((d) => {
            const raw = d.data();
            return {
              id: raw.id || d.id,
              name: String(raw.name || ''),
              description: String(raw.description || ''),
              color: String(raw.color || '#000000'),
              icon: String(raw.icon || 'category'),
              nationalWeightIBGE:
                typeof raw.nationalWeightIBGE === 'number' ? raw.nationalWeightIBGE : undefined,
              isCustom: typeof raw.isCustom === 'boolean' ? raw.isCustom : true,
              active: typeof raw.active === 'boolean' ? raw.active : true,
            };
          });
          handlers.onConsumptionGroups(groups);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, groupsPath)
      )
    );

    const strategiesPath = `users/${uid}/strategies`;
    unsubs.push(
      onSnapshot(
        query(collection(db, strategiesPath), where('userId', '==', uid)),
        (snapshot) => {
          const plansA: SubstitutePlanA[] = [];
          const plansB: EfficiencyPlanB[] = [];
          const plansC: OpportunityPlanC[] = [];

          for (const d of snapshot.docs) {
            const raw = d.data();
            if (raw.planType === 'PLAN_A') {
              plansA.push({
                id: raw.id || d.id,
                profileId: String(raw.profileId || ''),
                originalItemId: String(raw.originalItemId || ''),
                originalItemName: String(raw.originalItemName || raw.title || ''),
                originalPrice: finiteNumber(raw.originalPrice, 0),
                substituteName: String(raw.substituteName || ''),
                substitutePrice: finiteNumber(raw.substitutePrice, 0),
                monthlySavings: finiteNumber(raw.monthlySavings, 0),
                qualitativeTradeoff: String(raw.qualitativeTradeoff || raw.description || ''),
                applied: Boolean(raw.applied),
                unit: typeof raw.unit === 'string' ? raw.unit : undefined,
                notes: typeof raw.notes === 'string' ? raw.notes : undefined,
              });
            } else if (raw.planType === 'PLAN_B') {
              plansB.push({
                id: raw.id || d.id,
                profileId: String(raw.profileId || ''),
                resourceName: String(raw.resourceName || raw.title || ''),
                unit: String(raw.unit || 'un'),
                tariffPerUnit: finiteNumber(raw.tariffPerUnit, 0),
                currentConsumption: finiteNumber(raw.currentConsumption, 0),
                targetConsumption: finiteNumber(raw.targetConsumption, 0),
                currentSpend: finiteNumber(raw.currentSpend, 0),
                estimatedMonthlySavings: finiteNumber(raw.monthlySavings, 0),
                progressPercent: boundedNumber(raw.progressPercent, 0, 100, 0),
                applied: Boolean(raw.applied),
                notes: typeof raw.notes === 'string' ? raw.notes : undefined,
              });
            } else if (raw.planType === 'PLAN_C') {
              plansC.push({
                id: raw.id || d.id,
                profileId: String(raw.profileId || ''),
                monthlyInvestment: finiteNumber(raw.monthlyInvestment, 0),
                nominalAnnualRate: finiteNumber(raw.nominalAnnualRate, 0),
                expectedAnnualInflation: finiteNumber(raw.expectedAnnualInflation, 0),
                realAnnualYield: finiteNumber(raw.realAnnualYield, 0),
                projection12Months: finiteNumber(raw.projection12Months, 0),
                projection24Months: finiteNumber(raw.projection24Months, 0),
                projection36Months: finiteNumber(raw.projection36Months, 0),
                useLinkedSavings:
                  typeof raw.useLinkedSavings === 'boolean' ? raw.useLinkedSavings : undefined,
                notes: typeof raw.notes === 'string' ? raw.notes : undefined,
                isSimulated: false,
                updatedAt: raw.updatedAt ? timestampToIso(raw.updatedAt) : undefined,
              });
            }
          }

          handlers.onStrategies({ plansA, plansB, plansC, planC: plansC[0] });
        },
        (error) => handleFirestoreError(error, OperationType.LIST, strategiesPath)
      )
    );

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }

  static async saveProfile(userId: string, profile: FamilyProfile): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const profileId = sanitizeFirestoreId(profile.id, 'prof');
    const path = `users/${uid}/profiles/${profileId}`;
    const ref = doc(db, path);

    try {
      const snap = await getDoc(ref);
      const payload = buildProfileWritePayload(profile, uid, !snap.exists());
      if (snap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  static async deleteProfile(userId: string, profileId: string): Promise<void> {
    if (!db) return;
    const firestore = db;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanProfileId = sanitizeFirestoreId(profileId, 'prof');

    try {
      const [itemsSnap, pricesSnap, incomeSnap, strategiesSnap] = await Promise.all([
        getDocs(query(collection(firestore, `users/${uid}/basketItems`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/priceHistory`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/incomeHistory`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/strategies`), where('userId', '==', uid))),
      ]);

      const matchingItemDocs = itemsSnap.docs.filter((d) => d.data().profileId === cleanProfileId);
      const deletedItemIds = new Set(matchingItemDocs.map((d) => d.id));
      const matchingPriceDocs = pricesSnap.docs.filter((d) =>
        deletedItemIds.has(String(d.data().itemId || ''))
      );
      const matchingIncomeDocs = incomeSnap.docs.filter(
        (d) => d.data().profileId === cleanProfileId
      );
      const matchingStrategyDocs = strategiesSnap.docs.filter(
        (d) => d.data().profileId === cleanProfileId
      );

      // Remove filhos primeiro em lotes seguros, preservando integridade referencial
      const childOps: Array<(batch: WriteBatch) => void> = [];
      for (const d of matchingPriceDocs) childOps.push((batch) => batch.delete(d.ref));
      for (const d of matchingItemDocs) childOps.push((batch) => batch.delete(d.ref));
      for (const d of matchingIncomeDocs) childOps.push((batch) => batch.delete(d.ref));
      for (const d of matchingStrategyDocs) childOps.push((batch) => batch.delete(d.ref));
      await commitInChunks(childOps);

      await deleteDoc(doc(firestore, `users/${uid}/profiles/${cleanProfileId}`));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}/profiles/${cleanProfileId}`);
    }
  }

  static async deleteAllUserFinancialData(userId: string, defaultProfileName?: string): Promise<void> {
    if (!db) return;
    const firestore = db;
    const uid = sanitizeFirestoreId(userId, 'usr');

    try {
      const [pricesSnap, itemsSnap, incomeSnap, strategiesSnap, groupsSnap, profilesSnap] =
        await Promise.all([
          getDocs(query(collection(firestore, `users/${uid}/priceHistory`), where('userId', '==', uid))),
          getDocs(query(collection(firestore, `users/${uid}/basketItems`), where('userId', '==', uid))),
          getDocs(query(collection(firestore, `users/${uid}/incomeHistory`), where('userId', '==', uid))),
          getDocs(query(collection(firestore, `users/${uid}/strategies`), where('userId', '==', uid))),
          getDocs(query(collection(firestore, `users/${uid}/consumptionGroups`), where('userId', '==', uid))),
          getDocs(query(collection(firestore, `users/${uid}/profiles`), where('userId', '==', uid))),
        ]);

      // Etapa 1: apagar todos os filhos (preços, itens, rendas, estratégias, grupos)
      const childDeleteOps: Array<(batch: WriteBatch) => void> = [];
      for (const d of pricesSnap.docs) childDeleteOps.push((batch) => batch.delete(d.ref));
      for (const d of itemsSnap.docs) childDeleteOps.push((batch) => batch.delete(d.ref));
      for (const d of incomeSnap.docs) childDeleteOps.push((batch) => batch.delete(d.ref));
      for (const d of strategiesSnap.docs) childDeleteOps.push((batch) => batch.delete(d.ref));
      for (const d of groupsSnap.docs) childDeleteOps.push((batch) => batch.delete(d.ref));
      await commitInChunks(childDeleteOps);

      // Etapa 2: apagar perfis familiares antigos
      const profileDeleteOps: Array<(batch: WriteBatch) => void> = profilesSnap.docs.map(
        (d) => (batch: WriteBatch) => batch.delete(d.ref)
      );
      await commitInChunks(profileDeleteOps);

      // Etapa 3: recriar um perfil padrão limpo sem registros para manter consistência da sessão
      const defaultProfileId = sanitizeFirestoreId(`prof_${uid}`, 'prof');
      const cleanName = clampString(
        defaultProfileName || 'Meu Orçamento Familiar',
        BLUEPRINT_LIMITS.PROFILE_NAME_MAX,
        'Meu Orçamento Familiar'
      );
      await setDoc(doc(firestore, `users/${uid}/profiles/${defaultProfileId}`), {
        id: defaultProfileId,
        userId: uid,
        name: cleanName,
        membersCount: 2,
        referenceRegion: 'Brasil',
        currency: 'BRL',
        isDemo: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  }

  static async saveBasketItem(
    userId: string,
    item: BasketItem,
    recordInitialPrice = true
  ): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const itemId = sanitizeFirestoreId(item.id, 'item');
    const path = `users/${uid}/basketItems/${itemId}`;
    const ref = doc(db, path);

    try {
      const snap = await getDoc(ref);
      const payload = buildBasketItemWritePayload({ ...item, id: itemId }, uid, !snap.exists());
      if (snap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }

    if (recordInitialPrice && nonNegativeNumber(item.currentPrice, 0) > 0) {
      await this.addPriceRecord(uid, {
        itemId,
        price: item.currentPrice,
        referenceDate: extractIsoDatePrefix(item.currentPriceDate) || getTodayIsoDate(),
        unit: item.unit,
        source: item.notes || 'Atualização da Cesta',
      });
    }
  }

  static async archiveBasketItem(userId: string, itemId: string): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanItemId = sanitizeFirestoreId(itemId, 'item');
    const path = `users/${uid}/basketItems/${cleanItemId}`;
    try {
      await updateDoc(doc(db, path), {
        isArchived: true,
        active: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  static async addPriceRecord(
    userId: string,
    record: {
      id?: string;
      itemId: string;
      price: number;
      referenceDate: string;
      unit?: string;
      source?: string;
      notes?: string;
    }
  ): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const priceId = sanitizeFirestoreId(record.id, 'price');
    const itemId = sanitizeFirestoreId(record.itemId, 'item');
    const path = `users/${uid}/priceHistory/${priceId}`;

    const payload: Record<string, unknown> = {
      id: priceId,
      userId: uid,
      itemId,
      price: nonNegativeNumber(record.price, 0),
      referenceDate: clampString(
        extractIsoDatePrefix(record.referenceDate) || getTodayIsoDate(),
        BLUEPRINT_LIMITS.DATE_MAX
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (record.unit) {
      payload.unit = clampString(record.unit, BLUEPRINT_LIMITS.UNIT_MAX);
    }
    if (record.source) {
      payload.source = clampString(record.source, BLUEPRINT_LIMITS.PRICE_SOURCE_MAX);
    }
    if (record.notes) {
      payload.notes = clampString(record.notes, BLUEPRINT_LIMITS.PRICE_NOTES_MAX);
    }

    try {
      await setDoc(doc(db, path), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  static async updatePriceRecord(
    userId: string,
    priceId: string,
    updated: Partial<PriceRecord>
  ): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanPriceId = sanitizeFirestoreId(priceId, 'price');
    const path = `users/${uid}/priceHistory/${cleanPriceId}`;

    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updated.price !== undefined) {
      payload.price = nonNegativeNumber(updated.price, 0);
    }
    if (updated.referenceDate !== undefined) {
      payload.referenceDate = clampString(
        extractIsoDatePrefix(updated.referenceDate) || getTodayIsoDate(),
        BLUEPRINT_LIMITS.DATE_MAX
      );
    }
    if (updated.unit !== undefined) {
      payload.unit = clampString(updated.unit, BLUEPRINT_LIMITS.UNIT_MAX);
    }
    if (updated.source !== undefined) {
      payload.source = clampString(updated.source, BLUEPRINT_LIMITS.PRICE_SOURCE_MAX);
    }
    if (updated.notes !== undefined) {
      payload.notes = clampString(updated.notes, BLUEPRINT_LIMITS.PRICE_NOTES_MAX);
    }

    try {
      await updateDoc(doc(db, path), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  static async deletePriceRecord(userId: string, priceId: string): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanPriceId = sanitizeFirestoreId(priceId, 'price');
    const path = `users/${uid}/priceHistory/${cleanPriceId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  static async saveIncomeRange(
    userId: string,
    profileId: string,
    initialIncome: number,
    finalIncome: number,
    dates?: { initialDate?: string; finalDate?: string }
  ): Promise<void> {
    if (!db) return;
    const firestore = db;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const profId = sanitizeFirestoreId(profileId, 'prof');
    const inc1Id = sanitizeFirestoreId(`inc_init_${profId}`, 'inc');
    const inc2Id = sanitizeFirestoreId(`inc_curr_${profId}`, 'inc');

    const initialDate = clampString(
      extractIsoDatePrefix(dates?.initialDate) || getMonthsAgoIsoDate(12),
      BLUEPRINT_LIMITS.DATE_MAX
    );
    const finalDate = clampString(
      extractIsoDatePrefix(dates?.finalDate) || getTodayIsoDate(),
      BLUEPRINT_LIMITS.DATE_MAX
    );

    const saveOne = async (
      incomeId: string,
      referenceDate: string,
      nominalIncome: number,
      notes: string
    ) => {
      const path = `users/${uid}/incomeHistory/${incomeId}`;
      const ref = doc(firestore, path);
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await updateDoc(ref, {
            referenceDate,
            nominalIncome: nonNegativeNumber(nominalIncome, 0),
            notes,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(ref, {
            id: incomeId,
            userId: uid,
            profileId: profId,
            referenceDate,
            nominalIncome: nonNegativeNumber(nominalIncome, 0),
            notes,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    };

    await saveOne(inc1Id, initialDate, nonNegativeNumber(initialIncome, 0), 'Salário base inicial');
    await saveOne(inc2Id, finalDate, nonNegativeNumber(finalIncome, 0), 'Salário após reajustes');
  }

  static async saveConsumptionGroup(userId: string, group: ConsumptionGroup): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const groupId = sanitizeFirestoreId(group.id, 'grp');
    const path = `users/${uid}/consumptionGroups/${groupId}`;
    const ref = doc(db, path);

    const mutable: Record<string, unknown> = {
      name: clampString(group.name, BLUEPRINT_LIMITS.GROUP_NAME_MAX, 'Nova Categoria'),
      description: clampString(group.description || '', BLUEPRINT_LIMITS.GROUP_DESC_MAX),
      color: clampString(group.color, BLUEPRINT_LIMITS.COLOR_MAX, '#000000'),
      icon: clampString(group.icon, BLUEPRINT_LIMITS.ICON_MAX, 'category'),
      isCustom: group.isCustom !== false,
      active: group.active !== false,
      updatedAt: serverTimestamp(),
    };
    if (
      typeof group.nationalWeightIBGE === 'number' &&
      Number.isFinite(group.nationalWeightIBGE)
    ) {
      mutable.nationalWeightIBGE = Math.min(100, Math.max(0, group.nationalWeightIBGE));
    }

    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, mutable);
      } else {
        await setDoc(ref, {
          id: groupId,
          userId: uid,
          ...mutable,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  static async deleteConsumptionGroup(userId: string, groupId: string): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanId = sanitizeFirestoreId(groupId, 'grp');
    const path = `users/${uid}/consumptionGroups/${cleanId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  static async saveStrategyPlanA(userId: string, plan: SubstitutePlanA): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const strategyId = sanitizeFirestoreId(plan.id, 'sub');
    const profileId = sanitizeFirestoreId(plan.profileId, 'prof');
    const path = `users/${uid}/strategies/${strategyId}`;
    const ref = doc(db, path);

    const mutable: Record<string, unknown> = {
      title: clampString(plan.originalItemName, BLUEPRINT_LIMITS.STRATEGY_TITLE_MAX, 'Substituição'),
      description: clampString(plan.qualitativeTradeoff || '', BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX),
      applied: Boolean(plan.applied),
      monthlySavings: nonNegativeNumber(plan.monthlySavings, 0),
      originalItemId: clampString(plan.originalItemId || '', BLUEPRINT_LIMITS.ID_MAX),
      originalItemName: clampString(plan.originalItemName, BLUEPRINT_LIMITS.ITEM_NAME_MAX),
      originalPrice: nonNegativeNumber(plan.originalPrice, 0),
      substituteName: clampString(plan.substituteName, BLUEPRINT_LIMITS.ITEM_NAME_MAX),
      substitutePrice: nonNegativeNumber(plan.substitutePrice, 0),
      qualitativeTradeoff: clampString(
        plan.qualitativeTradeoff || '',
        BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX
      ),
      updatedAt: serverTimestamp(),
    };
    if (plan.unit) mutable.unit = clampString(plan.unit, BLUEPRINT_LIMITS.UNIT_MAX);
    if (plan.notes) mutable.notes = clampString(plan.notes, BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX);

    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, mutable);
      } else {
        await setDoc(ref, {
          id: strategyId,
          userId: uid,
          profileId,
          planType: 'PLAN_A',
          ...mutable,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  static async saveStrategyPlanB(userId: string, plan: EfficiencyPlanB): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const strategyId = sanitizeFirestoreId(plan.id, 'eff');
    const profileId = sanitizeFirestoreId(plan.profileId, 'prof');
    const path = `users/${uid}/strategies/${strategyId}`;
    const ref = doc(db, path);

    const mutable: Record<string, unknown> = {
      title: clampString(plan.resourceName, BLUEPRINT_LIMITS.STRATEGY_TITLE_MAX, 'Eficiência'),
      applied: Boolean(plan.applied),
      monthlySavings: nonNegativeNumber(plan.estimatedMonthlySavings, 0),
      resourceName: clampString(plan.resourceName, BLUEPRINT_LIMITS.ITEM_NAME_MAX),
      unit: clampString(plan.unit, BLUEPRINT_LIMITS.UNIT_MAX, 'un'),
      tariffPerUnit: nonNegativeNumber(plan.tariffPerUnit, 0),
      currentConsumption: nonNegativeNumber(plan.currentConsumption, 0),
      targetConsumption: nonNegativeNumber(plan.targetConsumption, 0),
      currentSpend: nonNegativeNumber(plan.currentSpend, 0),
      progressPercent: boundedNumber(plan.progressPercent, 0, 100, 0),
      updatedAt: serverTimestamp(),
    };
    if (typeof plan.notes === 'string') {
      mutable.notes = plan.notes.trim().slice(0, BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX);
    }

    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, mutable);
      } else {
        await setDoc(ref, {
          id: strategyId,
          userId: uid,
          profileId,
          planType: 'PLAN_B',
          ...mutable,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  static async saveStrategyPlanC(userId: string, plan: OpportunityPlanC): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const profileId = sanitizeFirestoreId(plan.profileId, 'prof');
    const strategyId = sanitizeFirestoreId(plan.id || `opp_${profileId}`, 'opp');
    const path = `users/${uid}/strategies/${strategyId}`;
    const ref = doc(db, path);

    try {
      const snap = await getDoc(ref);
      const payload = buildPlanCWritePayload(
        { ...plan, id: strategyId, profileId },
        uid,
        !snap.exists()
      );
      if (snap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  static async deleteStrategy(userId: string, strategyId: string): Promise<void> {
    if (!db) return;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const cleanId = sanitizeFirestoreId(strategyId, 'str');
    const path = `users/${uid}/strategies/${cleanId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  static async migrateLegacyBundle(
    userId: string,
    bundle: LegacyLocalBundle,
    fallbackProfileId: string
  ): Promise<void> {
    if (!db) {
      throw new Error('Cloud Firestore não está configurado para migração.');
    }
    const firestore = db;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const defaultProfileId = sanitizeFirestoreId(fallbackProfileId || `prof_${uid}`, 'prof');

    try {
      const [
        existingProfilesSnap,
        existingGroupsSnap,
        existingItemsSnap,
        existingIncomeSnap,
        existingStrategiesSnap,
        existingPricesSnap,
      ] = await Promise.all([
        getDocs(query(collection(firestore, `users/${uid}/profiles`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/consumptionGroups`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/basketItems`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/incomeHistory`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/strategies`), where('userId', '==', uid))),
        getDocs(query(collection(firestore, `users/${uid}/priceHistory`), where('userId', '==', uid))),
      ]);

      const existingProfileIds = new Set(existingProfilesSnap.docs.map((d) => d.id));
      const existingGroupIds = new Set(existingGroupsSnap.docs.map((d) => d.id));
      const existingItemIds = new Set(existingItemsSnap.docs.map((d) => d.id));
      const existingIncomeIds = new Set(existingIncomeSnap.docs.map((d) => d.id));
      const existingStrategyIds = new Set(existingStrategiesSnap.docs.map((d) => d.id));
      const existingPriceIds = new Set(existingPricesSnap.docs.map((d) => d.id));

      // Mapeia IDs legados de perfis e garante que todo perfil referenciado exista como doc pai antes dos filhos
      const profileIdMap = new Map<string, string>();
      const parentOps: Array<(batch: WriteBatch) => void> = [];

      for (const prof of bundle.profiles) {
        const cleanId = sanitizeFirestoreId(prof.id, 'prof');
        profileIdMap.set(prof.id, cleanId);
        const ref = doc(firestore, `users/${uid}/profiles/${cleanId}`);
        const exists = existingProfileIds.has(cleanId);
        const payload = buildProfileWritePayload({ ...prof, id: cleanId }, uid, !exists);
        parentOps.push((batch) => {
          if (exists) batch.update(ref, payload);
          else batch.set(ref, payload);
        });
        existingProfileIds.add(cleanId);
      }

      const resolveTargetProfileId = (legacyPid: string): string => {
        if (profileIdMap.has(legacyPid)) return profileIdMap.get(legacyPid)!;
        const cleanFallback = sanitizeFirestoreId(legacyPid, 'prof');
        if (existingProfileIds.has(cleanFallback)) return cleanFallback;
        return defaultProfileId;
      };

      for (const grp of bundle.customGroups) {
        const cleanGroupId = sanitizeFirestoreId(grp.id, 'grp');
        const ref = doc(firestore, `users/${uid}/consumptionGroups/${cleanGroupId}`);
        const exists = existingGroupIds.has(cleanGroupId);
        const mutable: Record<string, unknown> = {
          name: clampString(grp.name, BLUEPRINT_LIMITS.GROUP_NAME_MAX, 'Categoria'),
          description: clampString(grp.description || '', BLUEPRINT_LIMITS.GROUP_DESC_MAX),
          color: clampString(grp.color, BLUEPRINT_LIMITS.COLOR_MAX, '#000000'),
          icon: clampString(grp.icon, BLUEPRINT_LIMITS.ICON_MAX, 'category'),
          isCustom: grp.isCustom !== false,
          active: grp.active !== false,
          updatedAt: serverTimestamp(),
        };
        if (typeof grp.nationalWeightIBGE === 'number' && Number.isFinite(grp.nationalWeightIBGE)) {
          mutable.nationalWeightIBGE = boundedNumber(grp.nationalWeightIBGE, 0, 100, 0);
        }
        parentOps.push((batch) => {
          if (exists) batch.update(ref, mutable);
          else {
            batch.set(ref, {
              id: cleanGroupId,
              userId: uid,
              ...mutable,
              createdAt: serverTimestamp(),
            });
          }
        });
      }

      // Lote 1 (Pais): perfis + grupos de consumo devem ser persistidos antes de qualquer filho
      await commitInChunks(parentOps);

      // Lote 2 (Filhos): itens da cesta + rendas + estratégias (Planos A, B e C)
      const itemIdMap = new Map<string, string>();
      const childOps: Array<(batch: WriteBatch) => void> = [];

      for (const item of bundle.basketItems) {
        const cleanItemId = sanitizeFirestoreId(item.id, 'item');
        const targetProfileId = resolveTargetProfileId(item.profileId);
        itemIdMap.set(item.id, cleanItemId);
        const ref = doc(firestore, `users/${uid}/basketItems/${cleanItemId}`);
        const exists = existingItemIds.has(cleanItemId);
        const payload = buildBasketItemWritePayload(
          { ...item, id: cleanItemId, profileId: targetProfileId },
          uid,
          !exists
        );
        childOps.push((batch) => {
          if (exists) batch.update(ref, payload);
          else batch.set(ref, payload);
        });
      }

      for (const inc of bundle.incomeHistory) {
        const cleanIncId = sanitizeFirestoreId(inc.id, 'inc');
        const targetProfileId = resolveTargetProfileId(inc.profileId);
        const ref = doc(firestore, `users/${uid}/incomeHistory/${cleanIncId}`);
        const exists = existingIncomeIds.has(cleanIncId);
        const mutable: Record<string, unknown> = {
          referenceDate: clampString(
            extractIsoDatePrefix(inc.referenceDate) || getTodayIsoDate(),
            BLUEPRINT_LIMITS.DATE_MAX
          ),
          nominalIncome: nonNegativeNumber(inc.nominalIncome, 0),
          updatedAt: serverTimestamp(),
        };
        if (inc.source) mutable.source = clampString(inc.source, 255);
        if (inc.notes) mutable.notes = clampString(inc.notes, BLUEPRINT_LIMITS.PRICE_NOTES_MAX);

        childOps.push((batch) => {
          if (exists) batch.update(ref, mutable);
          else {
            batch.set(ref, {
              id: cleanIncId,
              userId: uid,
              profileId: targetProfileId,
              ...mutable,
              createdAt: serverTimestamp(),
            });
          }
        });
      }

      for (const planA of bundle.plansA) {
        const cleanId = sanitizeFirestoreId(planA.id, 'sub');
        const targetProfileId = resolveTargetProfileId(planA.profileId);
        const ref = doc(firestore, `users/${uid}/strategies/${cleanId}`);
        const exists = existingStrategyIds.has(cleanId);
        const mutable: Record<string, unknown> = {
          title: clampString(planA.originalItemName, BLUEPRINT_LIMITS.STRATEGY_TITLE_MAX, 'Substituição'),
          description: clampString(planA.qualitativeTradeoff || '', BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX),
          applied: Boolean(planA.applied),
          monthlySavings: nonNegativeNumber(planA.monthlySavings, 0),
          originalItemId: clampString(planA.originalItemId || '', BLUEPRINT_LIMITS.ID_MAX),
          originalItemName: clampString(planA.originalItemName, BLUEPRINT_LIMITS.ITEM_NAME_MAX),
          originalPrice: nonNegativeNumber(planA.originalPrice, 0),
          substituteName: clampString(planA.substituteName, BLUEPRINT_LIMITS.ITEM_NAME_MAX),
          substitutePrice: nonNegativeNumber(planA.substitutePrice, 0),
          qualitativeTradeoff: clampString(
            planA.qualitativeTradeoff || '',
            BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX
          ),
          updatedAt: serverTimestamp(),
        };
        if (planA.unit) mutable.unit = clampString(planA.unit, BLUEPRINT_LIMITS.UNIT_MAX);
        if (planA.notes) mutable.notes = clampString(planA.notes, BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX);

        childOps.push((batch) => {
          if (exists) batch.update(ref, mutable);
          else {
            batch.set(ref, {
              id: cleanId,
              userId: uid,
              profileId: targetProfileId,
              planType: 'PLAN_A',
              ...mutable,
              createdAt: serverTimestamp(),
            });
          }
        });
      }

      for (const planB of bundle.plansB) {
        const cleanId = sanitizeFirestoreId(planB.id, 'eff');
        const targetProfileId = resolveTargetProfileId(planB.profileId);
        const ref = doc(firestore, `users/${uid}/strategies/${cleanId}`);
        const exists = existingStrategyIds.has(cleanId);
        const mutable: Record<string, unknown> = {
          title: clampString(planB.resourceName, BLUEPRINT_LIMITS.STRATEGY_TITLE_MAX, 'Eficiência'),
          applied: Boolean(planB.applied),
          monthlySavings: nonNegativeNumber(planB.estimatedMonthlySavings, 0),
          resourceName: clampString(planB.resourceName, BLUEPRINT_LIMITS.ITEM_NAME_MAX),
          unit: clampString(planB.unit, BLUEPRINT_LIMITS.UNIT_MAX, 'un'),
          tariffPerUnit: nonNegativeNumber(planB.tariffPerUnit, 0),
          currentConsumption: nonNegativeNumber(planB.currentConsumption, 0),
          targetConsumption: nonNegativeNumber(planB.targetConsumption, 0),
          currentSpend: nonNegativeNumber(planB.currentSpend, 0),
          progressPercent: boundedNumber(planB.progressPercent, 0, 100, 0),
          updatedAt: serverTimestamp(),
        };
        if (planB.notes) mutable.notes = clampString(planB.notes, BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX);

        childOps.push((batch) => {
          if (exists) batch.update(ref, mutable);
          else {
            batch.set(ref, {
              id: cleanId,
              userId: uid,
              profileId: targetProfileId,
              planType: 'PLAN_B',
              ...mutable,
              createdAt: serverTimestamp(),
            });
          }
        });
      }

      for (const planC of bundle.plansC) {
        const targetProfileId = resolveTargetProfileId(planC.profileId);
        const cleanId = sanitizeFirestoreId(planC.id || `opp_${targetProfileId}`, 'opp');
        const ref = doc(firestore, `users/${uid}/strategies/${cleanId}`);
        const exists = existingStrategyIds.has(cleanId);
        const payload = buildPlanCWritePayload(
          { ...planC, id: cleanId, profileId: targetProfileId },
          uid,
          !exists
        );
        childOps.push((batch) => {
          if (exists) batch.update(ref, payload);
          else batch.set(ref, payload);
        });
      }

      await commitInChunks(childOps);

      // Lote 3 (Netos): histórico de preços apenas para itens existentes
      const priceOps: Array<(batch: WriteBatch) => void> = [];
      for (const price of bundle.priceHistory) {
        const targetItemId = itemIdMap.get(price.itemId);
        if (!targetItemId) continue;
        const cleanPriceId = sanitizeFirestoreId(price.id, 'price');
        if (existingPriceIds.has(cleanPriceId)) continue;
        const ref = doc(firestore, `users/${uid}/priceHistory/${cleanPriceId}`);
        const payload: Record<string, unknown> = {
          id: cleanPriceId,
          userId: uid,
          itemId: targetItemId,
          price: nonNegativeNumber(price.price, 0),
          referenceDate: clampString(
            extractIsoDatePrefix(price.referenceDate) || getTodayIsoDate(),
            BLUEPRINT_LIMITS.DATE_MAX
          ),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (price.unit) payload.unit = clampString(price.unit, BLUEPRINT_LIMITS.UNIT_MAX);
        if (price.source) payload.source = clampString(price.source, BLUEPRINT_LIMITS.PRICE_SOURCE_MAX);
        if (price.notes) payload.notes = clampString(price.notes, BLUEPRINT_LIMITS.PRICE_NOTES_MAX);

        priceOps.push((batch) => batch.set(ref, payload));
      }

      await commitInChunks(priceOps);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/migrateLegacyBundle`);
    }
  }

  static async saveOnboardingBundle(params: {
    userId: string;
    profile: FamilyProfile;
    initialIncome: number;
    currentIncome: number;
    items: BasketItem[];
  }): Promise<void> {
    await this.saveProfile(params.userId, params.profile);
    await this.saveIncomeRange(
      params.userId,
      params.profile.id,
      params.initialIncome,
      params.currentIncome
    );
    await Promise.all(
      params.items.map((item) =>
        this.saveBasketItem(params.userId, { ...item, profileId: params.profile.id }, false)
      )
    );
  }
}
