/**
 * IPCA-Casa: Repositório de Dados Unificado (MySQL quando configurado + Fallback local seguro)
 * Mantém isolamento por usuário e integridade referencial para usuários Google e locais.
 */
import type { RowDataPacket } from 'mysql2/promise';
import { ensureMySQLSchema, getMySQLPool, isMySQLConfigured } from './mysql';
import { AuthService, hashPassword } from '../services/auth';
import { StorageService } from '../services/storage';
import type { BasketItem, FamilyProfile, IncomeRecord, PriceRecord, UserAccount } from '../types';

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  display_name: string;
  auth_provider: 'local' | 'google';
  google_sub: string | null;
  avatar_url: string | null;
  password_hash: string | null;
  profile_id: string;
  created_at: Date | string;
  last_login_at: Date | string;
}

interface ProfileRow extends RowDataPacket {
  id: string;
  user_id: string | null;
  name: string;
  members_count: number;
  reference_region: string;
  currency: string;
  is_demo: number | boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface BasketItemRow extends RowDataPacket {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  group_name: string;
  classification: 'Essencial' | 'Supérfluo' | 'Não classificado';
  monthly_spend: string | number;
  old_price: string | number;
  current_price: string | number;
  old_price_date: string;
  current_price_date: string;
  unit: string;
  notes: string | null;
  active: number | boolean;
  is_archived: number | boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface IncomeRow extends RowDataPacket {
  id: string;
  profile_id: string;
  reference_date: string;
  nominal_income: string | number;
  source: string | null;
  notes: string | null;
  created_at: Date | string;
}

interface PriceRow extends RowDataPacket {
  id: string;
  item_id: string;
  price: string | number;
  reference_date: string;
  unit: string | null;
  source: string | null;
  created_at: Date | string;
}

function toIsoString(val: Date | string | null | undefined): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function mapUserRow(row: UserRow): UserAccount {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || undefined,
    authProvider: row.auth_provider || 'local',
    createdAt: toIsoString(row.created_at),
    lastLoginAt: toIsoString(row.last_login_at),
    profileId: row.profile_id,
  };
}

function mapProfileRow(row: ProfileRow): FamilyProfile {
  return {
    id: row.id,
    name: row.name,
    membersCount: Number(row.members_count) || 1,
    referenceRegion: row.reference_region || 'Brasil',
    currency: row.currency || 'BRL',
    isDemo: Boolean(row.is_demo),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapBasketRow(row: BasketItemRow): BasketItem {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    description: row.description || undefined,
    group: row.group_name,
    classification: row.classification || 'Não classificado',
    monthlySpend: Number(row.monthly_spend) || 0,
    oldPrice: Number(row.old_price) || 0,
    currentPrice: Number(row.current_price) || 0,
    oldPriceDate: row.old_price_date || '',
    currentPriceDate: row.current_price_date || '',
    unit: row.unit || 'unidade',
    notes: row.notes || undefined,
    active: Boolean(row.active),
    isArchived: Boolean(row.is_archived),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

// Armazenamento em memória no servidor para fallback quando MYSQL_* não está configurado
const memoryUsersById = new Map<string, UserAccount & { googleSub?: string }>();

export class Repository {
  static async upsertGoogleUser(params: {
    googleSub: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  }): Promise<{ user: UserAccount; isNewUser: boolean }> {
    const emailNormalized = params.email.trim().toLowerCase();
    const displayName = params.displayName.trim() || emailNormalized.split('@')[0];

    if (isMySQLConfigured()) {
      await ensureMySQLSchema();
      const pool = getMySQLPool();

      const [existingRows] = await pool.execute<UserRow[]>(
        'SELECT * FROM users WHERE google_sub = ? OR email = ? LIMIT 1',
        [params.googleSub, emailNormalized]
      );

      if (existingRows.length > 0) {
        const existing = existingRows[0];
        await pool.execute(
          `UPDATE users
             SET google_sub = ?,
                 auth_provider = 'google',
                 avatar_url = ?,
                 display_name = ?,
                 last_login_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [params.googleSub, params.avatarUrl || existing.avatar_url, displayName || existing.display_name, existing.id]
        );

        await this.ensureDefaultProfileInMySQL(existing.profile_id, existing.id, displayName);

        const [updatedRows] = await pool.execute<UserRow[]>(
          'SELECT * FROM users WHERE id = ? LIMIT 1',
          [existing.id]
        );
        return { user: mapUserRow(updatedRows[0]), isNewUser: false };
      }

      const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const profileId = `prof_${userId}`;

      await pool.execute(
        `INSERT INTO users (id, email, display_name, auth_provider, google_sub, avatar_url, profile_id)
         VALUES (?, ?, ?, 'google', ?, ?, ?)`,
        [userId, emailNormalized, displayName, params.googleSub, params.avatarUrl || null, profileId]
      );

      await this.ensureDefaultProfileInMySQL(profileId, userId, displayName);

      const [createdRows] = await pool.execute<UserRow[]>(
        'SELECT * FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
      return { user: mapUserRow(createdRows[0]), isNewUser: true };
    }

    // Fallback em memória (quando variáveis MYSQL_* ainda não foram configuradas no ambiente)
    const existingEntry = Array.from(memoryUsersById.values()).find(
      (u) => u.googleSub === params.googleSub || u.email === emailNormalized
    );
    const now = new Date().toISOString();

    if (existingEntry) {
      const updated: UserAccount & { googleSub?: string } = {
        ...existingEntry,
        displayName: displayName || existingEntry.displayName,
        avatarUrl: params.avatarUrl || existingEntry.avatarUrl,
        authProvider: 'google',
        googleSub: params.googleSub,
        lastLoginAt: now,
      };
      memoryUsersById.set(updated.id, updated);
      const { googleSub: _sub, ...cleanUser } = updated;
      return { user: cleanUser, isNewUser: false };
    }

    const userId = `usr_g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const profileId = `prof_${userId}`;
    const newUser: UserAccount = {
      id: userId,
      email: emailNormalized,
      displayName,
      avatarUrl: params.avatarUrl,
      authProvider: 'google',
      createdAt: now,
      lastLoginAt: now,
      profileId,
    };

    memoryUsersById.set(userId, { ...newUser, googleSub: params.googleSub });
    StorageService.saveProfile({
      id: profileId,
      name: displayName,
      membersCount: 2,
      referenceRegion: 'Brasil',
      currency: 'BRL',
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    });

    return { user: newUser, isNewUser: true };
  }

  private static async ensureDefaultProfileInMySQL(
    profileId: string,
    userId: string,
    displayName: string
  ): Promise<void> {
    const pool = getMySQLPool();
    await pool.execute(
      `INSERT IGNORE INTO family_profiles (id, user_id, name, members_count, reference_region, currency, is_demo)
       VALUES (?, ?, ?, 2, 'Brasil', 'BRL', FALSE)`,
      [profileId, userId, displayName || 'Meu Orçamento Familiar']
    );
  }

  static async registerLocalUser(params: {
    email: string;
    displayName: string;
    password: string;
  }): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const emailNormalized = params.email.trim().toLowerCase();
    const displayName = params.displayName.trim();

    if (!displayName || displayName.length < 2) {
      return { success: false, error: 'O nome de exibição deve ter pelo menos 2 caracteres.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
      return { success: false, error: 'Por favor, informe um endereço de e-mail válido.' };
    }
    if (!params.password || params.password.length < 6) {
      return { success: false, error: 'A senha de acesso deve possuir no mínimo 6 caracteres.' };
    }

    if (isMySQLConfigured()) {
      await ensureMySQLSchema();
      const pool = getMySQLPool();

      const [existing] = await pool.execute<UserRow[]>(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [emailNormalized]
      );
      if (existing.length > 0) {
        return { success: false, error: 'Já existe uma conta cadastrada com este endereço de e-mail.' };
      }

      const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const profileId = `prof_${userId}`;
      const passwordHash = await hashPassword(params.password);

      await pool.execute(
        `INSERT INTO users (id, email, display_name, auth_provider, password_hash, profile_id)
         VALUES (?, ?, ?, 'local', ?, ?)`,
        [userId, emailNormalized, displayName, passwordHash, profileId]
      );

      await this.ensureDefaultProfileInMySQL(profileId, userId, displayName);

      const [rows] = await pool.execute<UserRow[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
      return { success: true, user: mapUserRow(rows[0]) };
    }

    const res = await AuthService.register(params);
    if (!res.success || !res.session) {
      return { success: false, error: res.error };
    }
    memoryUsersById.set(res.session.user.id, res.session.user);
    return { success: true, user: res.session.user };
  }

  static async authenticateLocalUser(params: {
    email: string;
    password: string;
  }): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const emailNormalized = params.email.trim().toLowerCase();

    if (isMySQLConfigured()) {
      await ensureMySQLSchema();
      const pool = getMySQLPool();
      const [rows] = await pool.execute<UserRow[]>(
        'SELECT * FROM users WHERE email = ? LIMIT 1',
        [emailNormalized]
      );

      if (rows.length === 0) {
        return { success: false, error: 'Não encontramos nenhuma conta com o e-mail informado.' };
      }

      const userRow = rows[0];
      if (!userRow.password_hash) {
        return {
          success: false,
          error: 'Esta conta utiliza login com Google. Clique em "Continuar com Google" para entrar.',
        };
      }

      const inputHash = await hashPassword(params.password);
      if (userRow.password_hash !== inputHash) {
        return { success: false, error: 'Senha incorreta. Verifique os dados digitados.' };
      }

      await pool.execute('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [userRow.id]);
      return { success: true, user: mapUserRow(userRow) };
    }

    const res = await AuthService.login(params);
    if (!res.success || !res.session) {
      return { success: false, error: res.error };
    }
    memoryUsersById.set(res.session.user.id, res.session.user);
    return { success: true, user: res.session.user };
  }

  static async getUserById(userId: string): Promise<UserAccount | null> {
    if (isMySQLConfigured()) {
      await ensureMySQLSchema();
      const pool = getMySQLPool();
      const [rows] = await pool.execute<UserRow[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
      return rows.length > 0 ? mapUserRow(rows[0]) : null;
    }

    const cached = memoryUsersById.get(userId);
    if (cached) {
      const { googleSub: _sub, ...clean } = cached;
      return clean;
    }

    const localAcc = AuthService.getAccounts().find((a) => a.id === userId);
    return localAcc || null;
  }

  static async getProfiles(userId?: string, profileId?: string): Promise<FamilyProfile[]> {
    if (isMySQLConfigured() && (userId || profileId)) {
      await ensureMySQLSchema();
      const pool = getMySQLPool();
      const [rows] = await pool.execute<ProfileRow[]>(
        'SELECT * FROM family_profiles WHERE user_id = ? OR id = ? ORDER BY created_at ASC',
        [userId || '', profileId || '']
      );
      return rows.map(mapProfileRow);
    }

    const all = StorageService.getProfiles();
    if (profileId) {
      const filtered = all.filter((p) => p.id === profileId || p.isDemo);
      return filtered.length > 0 ? filtered : all;
    }
    return all;
  }

  static async saveProfile(profile: FamilyProfile, userId?: string): Promise<FamilyProfile> {
    if (isMySQLConfigured()) {
      await ensureMySQLSchema();
      const pool = getMySQLPool();
      await pool.execute(
        `INSERT INTO family_profiles (id, user_id, name, members_count, reference_region, currency, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           members_count = VALUES(members_count),
           reference_region = VALUES(reference_region),
           currency = VALUES(currency),
           updated_at = CURRENT_TIMESTAMP`,
        [
          profile.id,
          userId || null,
          profile.name,
          Number(profile.membersCount) || 1,
          profile.referenceRegion || 'Brasil',
          profile.currency || 'BRL',
          Boolean(profile.isDemo),
        ]
      );
      return profile;
    }

    StorageService.saveProfile(profile);
    return profile;
  }

  static async getBasketItems(profileId: string): Promise<BasketItem[]> {
    if (isMySQLConfigured()) {
      await ensureMySQLSchema();
      const pool = getMySQLPool();
      const [rows] = await pool.execute<BasketItemRow[]>(
        'SELECT * FROM basket_items WHERE profile_id = ? AND is_archived = FALSE ORDER BY created_at ASC',
        [profileId]
      );
      return rows.map(mapBasketRow);
    }

    return StorageService.getItems(profileId);
  }

  static async saveBasketItem(item: BasketItem, userId?: string): Promise<BasketItem> {
    if (isMySQLConfigured()) {
      await ensureMySQLSchema();
      const pool = getMySQLPool();
      await this.ensureDefaultProfileInMySQL(item.profileId, userId || '', 'Meu Orçamento Familiar');

      const nowIso = new Date().toISOString();
      const itemId = item.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const saved: BasketItem = {
        ...item,
        id: itemId,
        createdAt: item.createdAt || nowIso,
        updatedAt: nowIso,
      };

      await pool.execute(
        `INSERT INTO basket_items (
           id, profile_id, name, description, group_name, classification,
           monthly_spend, old_price, current_price, old_price_date, current_price_date,
           unit, notes, active, is_archived
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           description = VALUES(description),
           group_name = VALUES(group_name),
           classification = VALUES(classification),
           monthly_spend = VALUES(monthly_spend),
           old_price = VALUES(old_price),
           current_price = VALUES(current_price),
           old_price_date = VALUES(old_price_date),
           current_price_date = VALUES(current_price_date),
           unit = VALUES(unit),
           notes = VALUES(notes),
           active = VALUES(active),
           is_archived = VALUES(is_archived),
           updated_at = CURRENT_TIMESTAMP`,
        [
          saved.id,
          saved.profileId,
          saved.name,
          saved.description || null,
          saved.group,
          saved.classification || 'Não classificado',
          Number(saved.monthlySpend) || 0,
          Number(saved.oldPrice) || 0,
          Number(saved.currentPrice) || 0,
          saved.oldPriceDate || '',
          saved.currentPriceDate || '',
          saved.unit || 'unidade',
          saved.notes || null,
          saved.active !== false,
          Boolean(saved.isArchived),
        ]
      );

      if (saved.currentPrice > 0) {
        const priceId = `price-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await pool.execute(
          `INSERT INTO price_history (id, item_id, price, reference_date, unit, source)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            priceId,
            saved.id,
            saved.currentPrice,
            saved.currentPriceDate || nowIso.slice(0, 10),
            saved.unit || 'unidade',
            saved.notes || 'Atualização da Cesta',
          ]
        );
      }

      return saved;
    }

    return StorageService.saveItem(item);
  }

  static async deleteBasketItem(itemId: string, profileId?: string): Promise<void> {
    if (isMySQLConfigured()) {
      await ensureMySQLSchema();
      const pool = getMySQLPool();
      if (profileId) {
        await pool.execute(
          'UPDATE basket_items SET is_archived = TRUE, active = FALSE WHERE id = ? AND profile_id = ?',
          [itemId, profileId]
        );
      } else {
        await pool.execute(
          'UPDATE basket_items SET is_archived = TRUE, active = FALSE WHERE id = ?',
          [itemId]
        );
      }
      return;
    }

    StorageService.deleteItem(itemId);
  }

  static async getIncomeHistory(profileId: string): Promise<IncomeRecord[]> {
    if (isMySQLConfigured()) {
      await ensureMySQLSchema();
      const pool = getMySQLPool();
      const [rows] = await pool.execute<IncomeRow[]>(
        'SELECT * FROM income_history WHERE profile_id = ? ORDER BY reference_date ASC',
        [profileId]
      );
      return rows.map((r) => ({
        id: r.id,
        profileId: r.profile_id,
        referenceDate: r.reference_date,
        nominalIncome: Number(r.nominal_income) || 0,
        source: r.source || undefined,
        notes: r.notes || undefined,
        createdAt: toIsoString(r.created_at),
      }));
    }

    return StorageService.getIncomeHistory(profileId);
  }

  static async saveIncomeRange(
    profileId: string,
    initialIncome: number,
    finalIncome: number,
    userId?: string
  ): Promise<void> {
    if (isMySQLConfigured()) {
      await ensureMySQLSchema();
      const pool = getMySQLPool();
      await this.ensureDefaultProfileInMySQL(profileId, userId || '', 'Meu Orçamento Familiar');

      await pool.execute('DELETE FROM income_history WHERE profile_id = ?', [profileId]);
      const now = Date.now();
      await pool.execute(
        `INSERT INTO income_history (id, profile_id, reference_date, nominal_income, notes)
         VALUES (?, ?, '2023-03-01', ?, 'Salário base inicial'),
                (?, ?, '2024-03-01', ?, 'Salário após reajustes')`,
        [`inc-1-${now}`, profileId, initialIncome, `inc-2-${now}`, profileId, finalIncome]
      );
      return;
    }

    StorageService.setActiveProfileId(profileId);
    StorageService.saveIncome(initialIncome, finalIncome);
  }

  static async getPriceHistory(itemId?: string): Promise<PriceRecord[]> {
    if (isMySQLConfigured()) {
      await ensureMySQLSchema();
      const pool = getMySQLPool();
      const [rows] = itemId
        ? await pool.execute<PriceRow[]>(
            'SELECT * FROM price_history WHERE item_id = ? ORDER BY reference_date ASC',
            [itemId]
          )
        : await pool.execute<PriceRow[]>(
            'SELECT * FROM price_history ORDER BY reference_date ASC LIMIT 500'
          );

      return rows.map((r) => ({
        id: r.id,
        itemId: r.item_id,
        price: Number(r.price) || 0,
        referenceDate: r.reference_date,
        unit: r.unit || undefined,
        source: r.source || undefined,
        createdAt: toIsoString(r.created_at),
      }));
    }

    return StorageService.getPriceHistory(itemId);
  }
}
