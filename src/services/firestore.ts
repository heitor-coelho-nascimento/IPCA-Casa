/**
 * IPCA-Casa: Serviço de Persistência e Sincronização em Tempo Real no Cloud Firestore
 * Aplica validação síncrona com firebase-blueprint.json e firestore.rules.
 */
import type { User } from 'firebase/auth';
import {
  Timestamp,
  Unsubscribe,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
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

export const BLUEPRINT_LIMITS = {
  ID_MAX: 128,
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  DISPLAY_NAME_MAX: 120,
  AVATAR_URL_MAX: 1000,
  EMAIL_MAX: 255,
  PROFILE_NAME_MAX: 120,
  REGION_MAX: 120,
  CURRENCY_MAX: 10,
  ITEM_NAME_MAX: 200,
  ITEM_DESC_MAX: 500,
  GROUP_NAME_MAX: 120,
  DATE_MAX: 32,
  UNIT_MAX: 40,
  NOTES_MAX: 1000,
  PRICE_SOURCE_MAX: 255,
  PRICE_NOTES_MAX: 500,
  GROUP_DESC_MAX: 300,
  COLOR_MAX: 32,
  ICON_MAX: 64,
  STRATEGY_TITLE_MAX: 200,
  STRATEGY_TEXT_MAX: 600,
} as const;

export function sanitizeFirestoreId(raw: string | undefined | null, prefix = 'rec'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, BLUEPRINT_LIMITS.ID_MAX);

  if (cleaned && BLUEPRINT_LIMITS.ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.slice(
    0,
    BLUEPRINT_LIMITS.ID_MAX
  );
}

export function clampString(value: unknown, maxLen: number, fallback = ''): string {
  const str = typeof value === 'string' ? value.trim() : String(value ?? fallback).trim();
  const resolved = str || fallback;
  return resolved.slice(0, maxLen);
}

export function nonNegativeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
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
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
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
        authProvider: 'google',
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
          authProvider: 'google',
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
      authProvider: 'google',
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
        authProvider: 'google',
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
              membersCount: Number(raw.membersCount) || 1,
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
              monthlySpend: Number(raw.monthlySpend) || 0,
              oldPrice: Number(raw.oldPrice) || 0,
              currentPrice: Number(raw.currentPrice) || 0,
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
                nominalIncome: Number(raw.nominalIncome) || 0,
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
                price: Number(raw.price) || 0,
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
          let planC: OpportunityPlanC | undefined;

          for (const d of snapshot.docs) {
            const raw = d.data();
            if (raw.planType === 'PLAN_A') {
              plansA.push({
                id: raw.id || d.id,
                profileId: String(raw.profileId || ''),
                originalItemId: String(raw.originalItemId || ''),
                originalItemName: String(raw.originalItemName || raw.title || ''),
                originalPrice: Number(raw.originalPrice) || 0,
                substituteName: String(raw.substituteName || ''),
                substitutePrice: Number(raw.substitutePrice) || 0,
                monthlySavings: Number(raw.monthlySavings) || 0,
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
                tariffPerUnit: Number(raw.tariffPerUnit) || 0,
                currentConsumption: Number(raw.currentConsumption) || 0,
                targetConsumption: Number(raw.targetConsumption) || 0,
                currentSpend: Number(raw.currentSpend) || 0,
                estimatedMonthlySavings: Number(raw.monthlySavings) || 0,
                progressPercent: Number(raw.progressPercent) || 0,
                applied: Boolean(raw.applied),
                notes: typeof raw.notes === 'string' ? raw.notes : undefined,
              });
            } else if (raw.planType === 'PLAN_C') {
              planC = {
                id: raw.id || d.id,
                profileId: String(raw.profileId || ''),
                monthlyInvestment: Number(raw.monthlyInvestment) || 0,
                nominalAnnualRate: Number(raw.nominalAnnualRate) || 10.5,
                expectedAnnualInflation: Number(raw.expectedAnnualInflation) || 4.0,
                realAnnualYield: Number(raw.realAnnualYield) || 6.25,
                projection12Months: Number(raw.projection12Months) || 0,
                projection24Months: Number(raw.projection24Months) || 0,
                projection36Months: Number(raw.projection36Months) || 0,
              };
            }
          }

          handlers.onStrategies({ plansA, plansB, planC });
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
        referenceDate: item.currentPriceDate || new Date().toISOString().slice(0, 10),
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
        record.referenceDate || new Date().toISOString().slice(0, 10),
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

  static async saveIncomeRange(
    userId: string,
    profileId: string,
    initialIncome: number,
    finalIncome: number
  ): Promise<void> {
    if (!db) return;
    const firestore = db;
    const uid = sanitizeFirestoreId(userId, 'usr');
    const profId = sanitizeFirestoreId(profileId, 'prof');
    const inc1Id = sanitizeFirestoreId(`inc_init_${profId}`, 'inc');
    const inc2Id = sanitizeFirestoreId(`inc_curr_${profId}`, 'inc');

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

    await saveOne(inc1Id, '2023-03-01', initialIncome, 'Salário base inicial');
    await saveOne(inc2Id, '2024-03-01', finalIncome, 'Salário após reajustes');
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
    if (typeof group.nationalWeightIBGE === 'number' && Number.isFinite(group.nationalWeightIBGE)) {
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
      qualitativeTradeoff: clampString(plan.qualitativeTradeoff || '', BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX),
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
      progressPercent: nonNegativeNumber(plan.progressPercent, 0),
      updatedAt: serverTimestamp(),
    };
    if (plan.notes) {
      mutable.notes = clampString(plan.notes, BLUEPRINT_LIMITS.STRATEGY_TEXT_MAX);
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
