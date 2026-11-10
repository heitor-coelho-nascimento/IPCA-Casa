import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './views/OverviewView';
import { BasketView } from './views/BasketView';
import { PriceHistoryView } from './views/PriceHistoryView';
import { InflationAnalysisView } from './views/InflationAnalysisView';
import { PurchasingPowerView } from './views/PurchasingPowerView';
import { SavingStrategiesView } from './views/SavingStrategiesView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { PocketImpactView } from './views/PocketImpactView';
import { OfficialIPCAView } from './views/OfficialIPCAView';
import { LandingPageView } from './views/LandingPageView';
import { AuthModal } from './components/AuthModal';
import { OnboardingBundle, OnboardingModal } from './components/OnboardingModal';
import { NewItemDrawer } from './components/NewItemDrawer';
import { QuickPriceModal } from './components/QuickPriceModal';
import { ImportExportModal } from './components/ImportExportModal';
import { ConfirmModal } from './components/ConfirmModal';
import { startGoogleOAuthPopup } from './components/GoogleSignInButton';
import {
  isFirebaseConfigured,
  signOutFirebase,
  subscribeFirebaseAuthState,
  testFirestoreConnection,
} from './lib/firebase';
import {
  BasketItem,
  ConsumptionGroup,
  EfficiencyPlanB,
  FamilyProfile,
  IncomeRecord,
  OpportunityPlanC,
  PriceRecord,
  SubstitutePlanA,
  UserAccount,
} from './types';
import { DEFAULT_GROUPS, StorageService } from './services/storage';
import { AuthService } from './services/auth';
import { FirestoreService, sanitizeFirestoreId } from './services/firestore';
import { processBasketEconomics } from './services/economics';
import { IBGESeriesMetadata, IBGEService } from './services/ibge';

function loadInitialLocalUser(): UserAccount | null {
  const localUser = AuthService.getCurrentUser();
  if (!localUser) return null;
  if (localUser.authProvider === 'google') {
    return null;
  }
  return localUser;
}

export default function App() {
  // Autenticação & Sessão (Firebase Auth + fallback local neste navegador)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => loadInitialLocalUser());
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState<boolean>(false);

  // Modais de Autenticação, Onboarding e Confirmação
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'recover' | 'terms'>('login');
  const [authModalError, setAuthModalError] = useState<string | null>(null);
  const [googleLandingLoading, setGoogleLandingLoading] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isConfirmEmptyOpen, setIsConfirmEmptyOpen] = useState(false);

  // Navegação
  const [activeTab, setActiveTab] = useState<NavTab>('visao-geral');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Metadados oficiais do IBGE em segundo plano
  const [ibgeMetadata, setIbgeMetadata] = useState<IBGESeriesMetadata | null>(null);

  // Estados Locais (Modo Demonstração / Local neste navegador)
  const [localActiveProfile, setLocalActiveProfile] = useState<FamilyProfile>(() =>
    StorageService.getProfile()
  );
  const [localProfiles, setLocalProfiles] = useState<FamilyProfile[]>(() =>
    StorageService.getProfiles()
  );
  const [localItems, setLocalItems] = useState<BasketItem[]>(() => StorageService.getItems());

  // Estados Cloud Firestore (Sincronizados em Tempo Real para contas Google)
  const [activeCloudProfileId, setActiveCloudProfileId] = useState<string>('');
  const [cloudProfiles, setCloudProfiles] = useState<FamilyProfile[]>([]);
  const [cloudItems, setCloudItems] = useState<BasketItem[]>([]);
  const [cloudIncomeHistory, setCloudIncomeHistory] = useState<IncomeRecord[]>([]);
  const [cloudPriceHistory, setCloudPriceHistory] = useState<PriceRecord[]>([]);
  const [cloudConsumptionGroups, setCloudConsumptionGroups] = useState<ConsumptionGroup[]>([]);
  const [cloudPlansA, setCloudPlansA] = useState<SubstitutePlanA[]>([]);
  const [cloudPlansB, setCloudPlansB] = useState<EfficiencyPlanB[]>([]);
  const [cloudPlanC, setCloudPlanC] = useState<OpportunityPlanC | undefined>(undefined);

  // Período selecionado
  const [selectedTimeframe, setSelectedTimeframe] = useState<'12M' | 'YTD' | '1M'>('12M');

  // Modais e gavetas
  const [isNewItemDrawerOpen, setIsNewItemDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BasketItem | null>(null);
  const [isQuickPriceOpen, setIsQuickPriceOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<BasketItem | null>(null);

  const isFirebaseMode = Boolean(
    firebaseUid && currentUser?.authProvider === 'google' && !isDemo && isFirebaseConfigured()
  );

  // Inicialização: testar conexão Firestore, carregar IBGE e assinar Firebase Auth
  useEffect(() => {
    let active = true;

    testFirestoreConnection().catch(() => {});

    IBGEService.getMetadata()
      .then((meta) => {
        if (active) setIbgeMetadata(meta);
      })
      .catch((err) => {
        console.warn('Sincronização em segundo plano do IBGE:', err);
      });

    const unsubAuth = subscribeFirebaseAuthState(async (firebaseUser) => {
      if (!active) return;

      if (!firebaseUser || !firebaseUser.email || firebaseUser.emailVerified === false) {
        setFirebaseUid(null);
        setCloudProfiles([]);
        setCloudItems([]);
        setCloudIncomeHistory([]);
        setCloudPriceHistory([]);
        setCloudConsumptionGroups([]);
        setCloudPlansA([]);
        setCloudPlansB([]);
        setCloudPlanC(undefined);
        setCurrentUser((prev) => (prev?.authProvider === 'google' ? null : prev));
        return;
      }

      try {
        const { user } = await FirestoreService.ensureUserBootstrapped(firebaseUser);
        if (!active) return;
        setFirebaseUid(user.id);
        setIsDemo(false);
        setCurrentUser((prev) => {
          if (prev && prev.id === user.id && prev.authProvider === 'google') {
            return { ...prev, ...user };
          }
          return user;
        });
        setActiveCloudProfileId((prevId) => prevId || user.profileId);
      } catch (err) {
        console.error('Erro ao inicializar sessão no Cloud Firestore:', err);
      }
    });

    return () => {
      active = false;
      unsubAuth();
    };
  }, []);

  // Listeners em tempo real do Cloud Firestore para o titular autenticado
  useEffect(() => {
    if (!firebaseUid || !isFirebaseConfigured()) {
      return;
    }

    const unsubscribe = FirestoreService.subscribeUserCollections(firebaseUid, {
      onProfiles: (remoteProfiles) => {
        setCloudProfiles(remoteProfiles);
      },
      onBasketItems: (remoteItems) => {
        setCloudItems(remoteItems);
      },
      onIncomeHistory: (remoteIncome) => {
        setCloudIncomeHistory(remoteIncome);
      },
      onPriceHistory: (remotePrices) => {
        setCloudPriceHistory(remotePrices);
      },
      onConsumptionGroups: (remoteGroups) => {
        setCloudConsumptionGroups(remoteGroups);
      },
      onStrategies: ({ plansA, plansB, planC }) => {
        setCloudPlansA(plansA);
        setCloudPlansB(plansB);
        setCloudPlanC(planC);
      },
    });

    return () => unsubscribe();
  }, [firebaseUid]);

  // Perfis efetivos no modo atual
  const profiles = useMemo<FamilyProfile[]>(() => {
    if (!isFirebaseMode) return localProfiles;
    if (cloudProfiles.length > 0) return cloudProfiles;
    if (currentUser) {
      return [
        {
          id: currentUser.profileId,
          name: currentUser.displayName,
          membersCount: 2,
          referenceRegion: 'Brasil',
          currency: 'BRL',
          isDemo: false,
          createdAt: currentUser.createdAt,
          updatedAt: currentUser.lastLoginAt,
        },
      ];
    }
    return localProfiles;
  }, [isFirebaseMode, cloudProfiles, currentUser, localProfiles]);

  const activeProfile = useMemo<FamilyProfile>(() => {
    if (!isFirebaseMode) return localActiveProfile;
    const targetId = activeCloudProfileId || currentUser?.profileId;
    return (
      profiles.find((p) => p.id === targetId) ||
      profiles.find((p) => p.id === currentUser?.profileId) ||
      profiles[0]
    );
  }, [isFirebaseMode, localActiveProfile, activeCloudProfileId, currentUser?.profileId, profiles]);

  // Itens da cesta efetivos (excluindo arquivados e filtrados pelo perfil ativo)
  const items = useMemo<BasketItem[]>(() => {
    if (!isFirebaseMode) return localItems;
    return cloudItems.filter((item) => !item.isArchived && item.profileId === activeProfile.id);
  }, [isFirebaseMode, localItems, cloudItems, activeProfile.id]);

  // Histórico de renda efetivo do perfil ativo
  const activeIncomeHistory = useMemo<IncomeRecord[]>(() => {
    if (!isFirebaseMode) {
      return StorageService.getIncomeHistory(activeProfile.id);
    }
    return cloudIncomeHistory
      .filter((inc) => inc.profileId === activeProfile.id)
      .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
  }, [isFirebaseMode, activeProfile.id, cloudIncomeHistory]);

  // Categorias efetivas (mescla categorias IBGE padrão com personalizações do usuário no Firestore)
  const cloudEffectiveGroups = useMemo<ConsumptionGroup[] | undefined>(() => {
    if (!isFirebaseMode) return undefined;
    const mergedDefault = DEFAULT_GROUPS.map(
      (def) => cloudConsumptionGroups.find((c) => c.id === def.id) || def
    );
    const customExtras = cloudConsumptionGroups.filter(
      (c) => !DEFAULT_GROUPS.some((def) => def.id === c.id)
    );
    return [...mergedDefault, ...customExtras];
  }, [isFirebaseMode, cloudConsumptionGroups]);

  // Estratégias efetivas do perfil ativo
  const activePlansA = useMemo(
    () => (isFirebaseMode ? cloudPlansA.filter((p) => p.profileId === activeProfile.id) : undefined),
    [isFirebaseMode, cloudPlansA, activeProfile.id]
  );

  const activePlansB = useMemo(
    () => (isFirebaseMode ? cloudPlansB.filter((p) => p.profileId === activeProfile.id) : undefined),
    [isFirebaseMode, cloudPlansB, activeProfile.id]
  );

  const activePlanC = useMemo(
    () =>
      isFirebaseMode && cloudPlanC && cloudPlanC.profileId === activeProfile.id
        ? cloudPlanC
        : undefined,
    [isFirebaseMode, cloudPlanC, activeProfile.id]
  );

  // Cálculo econômico com base nos dados ativos + taxa IBGE oficial
  const summary = useMemo(() => {
    const initialIncome =
      activeIncomeHistory.length > 0 ? activeIncomeHistory[0].nominalIncome : isDemo ? 10000 : null;
    const finalIncome =
      activeIncomeHistory.length > 0
        ? activeIncomeHistory[activeIncomeHistory.length - 1].nominalIncome
        : isDemo
        ? 10500
        : null;
    const officialRate12M = ibgeMetadata?.accumulated12MRate ?? 4.68;
    return processBasketEconomics(items, officialRate12M, initialIncome, finalIncome);
  }, [items, activeIncomeHistory, isDemo, ibgeMetadata?.accumulated12MRate]);

  // Handler de Sucesso de Autenticação
  const handleAuthSuccess = (user: UserAccount, isNewUser = false) => {
    setCurrentUser(user);
    setIsDemo(false);
    setAuthModalError(null);

    if (user.authProvider === 'google') {
      setFirebaseUid(user.id);
      setActiveCloudProfileId(user.profileId);
    } else {
      const userProfile = StorageService.getProfiles().find((p) => p.id === user.profileId) || {
        id: user.profileId,
        name: user.displayName,
        membersCount: 2,
        referenceRegion: 'Brasil',
        currency: 'BRL',
        isDemo: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveProfile(userProfile);
      StorageService.setActiveProfileId(userProfile.id);
      setLocalActiveProfile(userProfile);
      setLocalProfiles(StorageService.getProfiles());
      setLocalItems(StorageService.getItems(userProfile.id));
    }

    if (isNewUser) {
      setIsOnboardingOpen(true);
    } else {
      setActiveTab('visao-geral');
    }
  };

  // Handler direto de Login com Google na Landing Page
  const handleLandingGoogleLogin = async () => {
    setGoogleLandingLoading(true);
    setAuthModalError(null);
    try {
      const result = await startGoogleOAuthPopup();
      if (result.success && result.session) {
        handleAuthSuccess(result.session.user, Boolean(result.isNewUser));
      } else {
        setAuthModalMode('login');
        setAuthModalError(result.error || 'Falha ao autenticar com o Google.');
        setIsAuthModalOpen(true);
      }
    } finally {
      setGoogleLandingLoading(false);
    }
  };

  // Handler de Logout
  const handleLogout = async () => {
    AuthService.logout();
    setFirebaseUid(null);
    setCurrentUser(null);
    setIsDemo(false);
    setCloudProfiles([]);
    setCloudItems([]);
    setCloudIncomeHistory([]);
    setCloudPriceHistory([]);
    setCloudConsumptionGroups([]);
    setCloudPlansA([]);
    setCloudPlansB([]);
    setCloudPlanC(undefined);
    setActiveTab('visao-geral');
    await signOutFirebase();
  };

  // Handler de Entrada no Modo Demonstração
  const handleEnterDemo = () => {
    setIsDemo(true);
    const demoProfile =
      StorageService.getProfiles().find((p) => p.isDemo) || StorageService.getProfiles()[0];
    StorageService.setActiveProfileId(demoProfile.id);
    setLocalActiveProfile(demoProfile);
    setLocalProfiles(StorageService.getProfiles());
    setLocalItems(StorageService.getItems(demoProfile.id));
    setActiveTab('visao-geral');
  };

  // Conclusão do Onboarding
  const handleFinishOnboarding = async (newProfile: FamilyProfile, bundle?: OnboardingBundle) => {
    setIsOnboardingOpen(false);
    setActiveTab('impacto-no-bolso');

    if (isFirebaseMode && firebaseUid && bundle) {
      setActiveCloudProfileId(newProfile.id);
      try {
        await FirestoreService.saveOnboardingBundle({
          userId: firebaseUid,
          profile: newProfile,
          initialIncome: bundle.initialIncome,
          currentIncome: bundle.currentIncome,
          items: bundle.items,
        });
      } catch (err) {
        console.error('Erro ao salvar onboarding no Firestore:', err);
      }
    } else {
      setLocalActiveProfile(newProfile);
      setLocalProfiles(StorageService.getProfiles());
      setLocalItems(StorageService.getItems(newProfile.id));
    }
  };

  // Salvar/Editar Item
  const handleSaveItem = useCallback(
    async (itemData: Partial<BasketItem>) => {
      let savedItem: BasketItem;
      const nowIso = new Date().toISOString();

      if (editingItem) {
        savedItem = {
          ...editingItem,
          ...itemData,
          profileId: editingItem.profileId || activeProfile.id,
          updatedAt: nowIso,
        };
        setEditingItem(null);
      } else {
        savedItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          profileId: activeProfile.id,
          name: itemData.name || 'Novo Item',
          description: itemData.description,
          group: itemData.group || 'Alimentação e bebidas',
          classification: itemData.classification || 'Essencial',
          monthlySpend: Number(itemData.monthlySpend) || 0,
          oldPrice: Number(itemData.oldPrice) || 0,
          currentPrice: Number(itemData.currentPrice) || 0,
          oldPriceDate: itemData.oldPriceDate || '2023-09-01',
          currentPriceDate: itemData.currentPriceDate || '2024-09-01',
          unit: itemData.unit || 'unidade',
          notes: itemData.notes || '',
          active: itemData.active !== false,
          isArchived: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      }

      if (isFirebaseMode && firebaseUid) {
        await FirestoreService.saveBasketItem(firebaseUid, savedItem, true);
      } else {
        StorageService.saveItem(savedItem);
        setLocalItems(StorageService.getItems(activeProfile.id));
      }
    },
    [editingItem, activeProfile.id, isFirebaseMode, firebaseUid]
  );

  // Excluir/Arquivar Item
  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (isFirebaseMode && firebaseUid) {
        await FirestoreService.archiveBasketItem(firebaseUid, itemId);
      } else {
        StorageService.deleteItem(itemId);
        setLocalItems(StorageService.getItems(activeProfile.id));
      }
    },
    [activeProfile.id, isFirebaseMode, firebaseUid]
  );

  // Atualização Rápida de Preço
  const handleUpdatePrice = useCallback(
    async (itemId: string, newPrice: number, referenceDate: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      const updatedItem: BasketItem = {
        ...item,
        currentPrice: newPrice,
        currentPriceDate: referenceDate,
        updatedAt: new Date().toISOString(),
      };

      if (isFirebaseMode && firebaseUid) {
        await FirestoreService.addPriceRecord(firebaseUid, {
          itemId,
          price: newPrice,
          referenceDate,
          unit: item.unit || 'un',
          source: 'Atualização Rápida no Painel',
        });
        await FirestoreService.saveBasketItem(firebaseUid, updatedItem, false);
      } else {
        StorageService.addPriceRecord({
          itemId,
          price: newPrice,
          referenceDate,
          unit: item.unit || 'un',
          origin: 'Atualização Rápida no Painel',
        });
        StorageService.saveItem(updatedItem);
        setLocalItems(StorageService.getItems(activeProfile.id));
      }
    },
    [items, activeProfile.id, isFirebaseMode, firebaseUid]
  );

  // Adicionar cotação histórica via PriceHistoryView
  const handleAddPriceRecordFromView = useCallback(
    async (record: {
      itemId: string;
      price: number;
      referenceDate: string;
      unit?: string;
      origin?: string;
    }) => {
      if (isFirebaseMode && firebaseUid) {
        await FirestoreService.addPriceRecord(firebaseUid, {
          itemId: record.itemId,
          price: record.price,
          referenceDate: record.referenceDate,
          unit: record.unit,
          source: record.origin,
        });
      } else {
        StorageService.addPriceRecord(record);
        setLocalItems(StorageService.getItems(activeProfile.id));
      }
    },
    [isFirebaseMode, firebaseUid, activeProfile.id]
  );

  // Atualização de Renda
  const handleUpdateIncome = useCallback(
    async (initial: number, final: number) => {
      if (isFirebaseMode && firebaseUid) {
        await FirestoreService.saveIncomeRange(firebaseUid, activeProfile.id, initial, final);
      } else {
        StorageService.saveIncome(initial, final);
        setLocalItems([...StorageService.getItems(activeProfile.id)]);
      }
    },
    [activeProfile.id, isFirebaseMode, firebaseUid]
  );

  // Gerenciamento de Grupos de Consumo no Cloud Firestore
  const handleSaveConsumptionGroup = useCallback(
    async (group: ConsumptionGroup) => {
      if (isFirebaseMode && firebaseUid) {
        await FirestoreService.saveConsumptionGroup(firebaseUid, group);
      } else {
        StorageService.saveGroup(group);
      }
    },
    [isFirebaseMode, firebaseUid]
  );

  const handleDeleteConsumptionGroup = useCallback(
    async (groupId: string): Promise<{ success: boolean; message: string }> => {
      if (!isFirebaseMode || !firebaseUid) {
        return StorageService.deleteGroup(groupId);
      }
      const target = (cloudEffectiveGroups || []).find((g) => g.id === groupId);
      if (!target) {
        return { success: false, message: 'Categoria não encontrada.' };
      }

      const affectedItems = cloudItems.filter((item) => !item.isArchived && item.group === target.name);
      if (affectedItems.length > 0) {
        await Promise.all(
          affectedItems.map((item) =>
            FirestoreService.saveBasketItem(
              firebaseUid,
              { ...item, group: 'Despesas pessoais', updatedAt: new Date().toISOString() },
              false
            )
          )
        );
      }

      await FirestoreService.deleteConsumptionGroup(firebaseUid, groupId);
      return {
        success: true,
        message:
          affectedItems.length > 0
            ? `Categoria excluída. ${affectedItems.length} itens foram transferidos para "Despesas pessoais".`
            : 'Categoria excluída com sucesso.',
      };
    },
    [isFirebaseMode, firebaseUid, cloudEffectiveGroups, cloudItems]
  );

  // Salvar Estratégias A e B no Cloud Firestore
  const handleSavePlanA = useCallback(
    async (plan: SubstitutePlanA) => {
      if (isFirebaseMode && firebaseUid) {
        await FirestoreService.saveStrategyPlanA(firebaseUid, {
          ...plan,
          profileId: activeProfile.id,
        });
      } else {
        StorageService.savePlanA(plan);
      }
    },
    [isFirebaseMode, firebaseUid, activeProfile.id]
  );

  const handleSavePlanB = useCallback(
    async (plan: EfficiencyPlanB) => {
      if (isFirebaseMode && firebaseUid) {
        await FirestoreService.saveStrategyPlanB(firebaseUid, {
          ...plan,
          profileId: activeProfile.id,
        });
      } else {
        StorageService.savePlanB(plan);
      }
    },
    [isFirebaseMode, firebaseUid, activeProfile.id]
  );

  // Alternância para Cesta Vazia (via ConfirmModal sem window.confirm)
  const handleRequestEmptyBasket = useCallback(() => {
    if (firebaseUid && isDemo) {
      setIsDemo(false);
      setActiveTab('minha-cesta-familiar');
      return;
    }
    setIsConfirmEmptyOpen(true);
  }, [firebaseUid, isDemo]);

  const handleConfirmEmptyBasket = useCallback(async () => {
    setIsConfirmEmptyOpen(false);
    if (isFirebaseMode && firebaseUid) {
      await Promise.all(items.map((item) => FirestoreService.archiveBasketItem(firebaseUid, item.id)));
      setActiveTab('minha-cesta-familiar');
    } else {
      StorageService.clearToEmptyBasket();
      setLocalActiveProfile(StorageService.getProfile());
      setLocalProfiles(StorageService.getProfiles());
      setLocalItems([]);
      setActiveTab('minha-cesta-familiar');
    }
  }, [isFirebaseMode, firebaseUid, items]);

  // Alternância para Cenário Demonstrativo
  const handleSwitchToDemoBasket = useCallback(() => {
    StorageService.loadDemoBasket();
    if (firebaseUid) {
      setIsDemo(true);
    }
    const demoProfile =
      StorageService.getProfiles().find((p) => p.isDemo) || StorageService.getProfiles()[0];
    StorageService.setActiveProfileId(demoProfile.id);
    setLocalActiveProfile(demoProfile);
    setLocalProfiles(StorageService.getProfiles());
    setLocalItems(StorageService.getItems(demoProfile.id));
    setActiveTab('visao-geral');
  }, [firebaseUid]);

  // Abertura do Histórico de Preços para Item Específico
  const handleViewPriceHistory = useCallback((item: BasketItem) => {
    setSelectedItemForHistory(item);
    setActiveTab('precos-e-historico');
  }, []);

  // Importação de Itens
  const handleImportItems = useCallback(
    async (imported: BasketItem[]) => {
      if (isFirebaseMode && firebaseUid) {
        const stamped = imported.map((it, idx) => ({
          ...it,
          id: sanitizeFirestoreId(it.id || `item_${Date.now()}_${idx}`, 'item'),
          profileId: activeProfile.id,
          isArchived: false,
          active: it.active !== false,
        }));
        await Promise.all(
          stamped.map((it) => FirestoreService.saveBasketItem(firebaseUid, it, false))
        );
      } else {
        StorageService.importItems(imported);
        setLocalItems(StorageService.getItems(activeProfile.id));
      }
    },
    [activeProfile.id, isFirebaseMode, firebaseUid]
  );

  // Atualização de Perfil
  const handleUpdateProfile = useCallback(
    async (updatedProfile: FamilyProfile) => {
      if (isFirebaseMode && firebaseUid) {
        await FirestoreService.saveProfile(firebaseUid, updatedProfile);
      } else {
        setLocalActiveProfile(updatedProfile);
        setLocalProfiles(StorageService.getProfiles());
      }
    },
    [isFirebaseMode, firebaseUid]
  );

  // SE NÃO HÁ USUÁRIO E NÃO ESTÁ EM DEMO: EXIBE A LANDING PAGE
  if (!currentUser && !isDemo) {
    return (
      <>
        <LandingPageView
          onOpenLogin={() => {
            setAuthModalMode('login');
            setAuthModalError(null);
            setIsAuthModalOpen(true);
          }}
          onOpenRegister={() => {
            setAuthModalMode('register');
            setAuthModalError(null);
            setIsAuthModalOpen(true);
          }}
          onGoogleLogin={handleLandingGoogleLogin}
          googleLoading={googleLandingLoading}
          onEnterDemo={handleEnterDemo}
          onOpenTerms={() => {
            setAuthModalMode('terms');
            setAuthModalError(null);
            setIsAuthModalOpen(true);
          }}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          initialMode={authModalMode}
          initialError={authModalError}
          onClose={() => {
            setIsAuthModalOpen(false);
            setAuthModalError(null);
          }}
          onSuccess={handleAuthSuccess}
          onEnterDemo={handleEnterDemo}
        />
      </>
    );
  }

  // AMBIENTE DO DASHBOARD (LOGADO OU MODO DEMONSTRAÇÃO)
  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      {/* Navegação Lateral */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isDemo={isDemo}
        userName={currentUser?.displayName || (isDemo ? 'Demonstração' : undefined)}
        userAvatar={currentUser?.avatarUrl}
        authProvider={currentUser?.authProvider}
        onLogout={handleLogout}
      />

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Banner de Demonstração em Destaque */}
        {isDemo && (
          <div className="bg-[#131b2e] text-[#ffffff] px-6 py-2 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[#86f2e4]">science</span>
              <span>
                Dados de demonstração — valores fictícios, não representam estatísticas oficiais.
              </span>
            </div>
            <div className="flex items-center gap-3">
              {firebaseUid ? (
                <button
                  onClick={() => setIsDemo(false)}
                  className="underline text-[#86f2e4] hover:text-[#ffffff] cursor-pointer"
                >
                  Voltar à Minha Conta
                </button>
              ) : (
                <button
                  onClick={() => {
                    setAuthModalMode('register');
                    setAuthModalError(null);
                    setIsAuthModalOpen(true);
                  }}
                  className="underline text-[#86f2e4] hover:text-[#ffffff] cursor-pointer"
                >
                  Criar Conta Real
                </button>
              )}
              <button
                onClick={handleLogout}
                className="px-2 py-0.5 rounded bg-[#213145] text-xs hover:bg-[#ffdad6] hover:text-[#ba1a1a] transition-colors cursor-pointer"
              >
                Sair da Demonstração
              </button>
            </div>
          </div>
        )}

        <Header
          isSidebarCollapsed={isSidebarCollapsed}
          activeProfile={activeProfile}
          profiles={profiles}
          ibgeData={ibgeMetadata}
          userAvatarUrl={currentUser?.avatarUrl}
          onSelectProfile={(profileId) => {
            const found = profiles.find((p) => p.id === profileId);
            if (!found) return;
            if (isFirebaseMode) {
              setActiveCloudProfileId(profileId);
            } else {
              StorageService.setActiveProfileId(profileId);
              setLocalActiveProfile(found);
              setLocalItems(StorageService.getItems(profileId));
            }
          }}
          selectedTimeframe={selectedTimeframe}
          onSelectTimeframe={setSelectedTimeframe}
          onNavigateToSettings={() => setActiveTab('configuracoes')}
          onSwitchToEmptyBasket={handleRequestEmptyBasket}
          onSwitchToDemoBasket={handleSwitchToDemoBasket}
          isDemo={isDemo}
        />

        {/* Visão Ativa */}
        <main className="flex-1 pb-16">
          {activeTab === 'visao-geral' && (
            <OverviewView
              summary={summary}
              onNavigateTab={setActiveTab}
              onOpenNewItem={() => {
                setEditingItem(null);
                setIsNewItemDrawerOpen(true);
              }}
              onOpenQuickPrice={() => setIsQuickPriceOpen(true)}
              isDemo={isDemo}
            />
          )}

          {activeTab === 'impacto-no-bolso' && (
            <PocketImpactView
              summary={summary}
              onUpdateIncome={handleUpdateIncome}
              isDemo={isDemo}
            />
          )}

          {activeTab === 'ipca-oficial' && <OfficialIPCAView onNavigateTab={setActiveTab} />}

          {activeTab === 'minha-cesta-familiar' && (
            <BasketView
              summary={summary}
              onOpenNewItem={() => {
                setEditingItem(null);
                setIsNewItemDrawerOpen(true);
              }}
              onEditItem={(item) => {
                setEditingItem(item);
                setIsNewItemDrawerOpen(true);
              }}
              onDeleteItem={handleDeleteItem}
              onOpenImportExport={() => setIsImportExportOpen(true)}
              onViewPriceHistory={handleViewPriceHistory}
              onRefreshData={() => {
                if (!isFirebaseMode) {
                  setLocalItems(StorageService.getItems(activeProfile.id));
                }
              }}
              isDemo={isDemo}
              groups={cloudEffectiveGroups}
              onSaveGroup={isFirebaseMode ? handleSaveConsumptionGroup : undefined}
              onDeleteGroup={isFirebaseMode ? handleDeleteConsumptionGroup : undefined}
            />
          )}

          {activeTab === 'precos-e-historico' && (
            <PriceHistoryView
              summary={summary}
              onRefreshData={() => {
                if (!isFirebaseMode) {
                  setLocalItems(StorageService.getItems(activeProfile.id));
                }
              }}
              isDemo={isDemo}
              selectedItemForHistory={selectedItemForHistory}
              priceRecords={isFirebaseMode ? cloudPriceHistory : undefined}
              onAddPriceRecord={isFirebaseMode ? handleAddPriceRecordFromView : undefined}
            />
          )}

          {activeTab === 'analise-da-inflacao' && (
            <InflationAnalysisView
              summary={summary}
              onNavigateTab={setActiveTab}
              isDemo={isDemo}
            />
          )}

          {activeTab === 'renda-e-poder-de-compra' && (
            <PurchasingPowerView
              summary={summary}
              onUpdateIncome={handleUpdateIncome}
              isDemo={isDemo}
            />
          )}

          {activeTab === 'estrategias-de-economia' && (
            <SavingStrategiesView
              summary={summary}
              isDemo={isDemo}
              activeProfileId={activeProfile.id}
              plansA={activePlansA}
              plansB={activePlansB}
              planC={activePlanC}
              onSavePlanA={isFirebaseMode ? handleSavePlanA : undefined}
              onSavePlanB={isFirebaseMode ? handleSavePlanB : undefined}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'relatorios' && <ReportsView summary={summary} isDemo={isDemo} />}

          {activeTab === 'configuracoes' && (
            <SettingsView
              activeProfile={activeProfile}
              currentUser={currentUser}
              onUpdateProfile={handleUpdateProfile}
              onSwitchToEmptyBasket={handleRequestEmptyBasket}
              onSwitchToDemoBasket={handleSwitchToDemoBasket}
              isDemo={isDemo}
              isFirebaseMode={isFirebaseMode}
              onExportBackupData={
                isFirebaseMode
                  ? () => ({
                      profile: activeProfile,
                      profiles,
                      groups: cloudEffectiveGroups,
                      items,
                      prices: cloudPriceHistory,
                      income: activeIncomeHistory,
                      plansA: activePlansA,
                      plansB: activePlansB,
                      planC: activePlanC,
                      exportedAt: new Date().toISOString(),
                      version: '3.1.0-firebase',
                    })
                  : undefined
              }
              onRefreshData={() => {
                IBGEService.getMetadata()
                  .then((meta) => setIbgeMetadata(meta))
                  .catch(() => {});
                if (!isFirebaseMode) {
                  setLocalItems(StorageService.getItems(activeProfile.id));
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Modais Globais */}
      <NewItemDrawer
        isOpen={isNewItemDrawerOpen}
        onClose={() => {
          setIsNewItemDrawerOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        editingItem={editingItem}
        totalMonthlySpend={summary.totalMonthlySpend}
        groups={cloudEffectiveGroups}
      />

      <QuickPriceModal
        isOpen={isQuickPriceOpen}
        onClose={() => setIsQuickPriceOpen(false)}
        items={items}
        onUpdatePrice={handleUpdatePrice}
      />

      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        items={items}
        onImportItems={handleImportItems}
      />

      <ConfirmModal
        isOpen={isConfirmEmptyOpen}
        title="Iniciar Cesta em Branco"
        message={
          isFirebaseMode
            ? 'Deseja arquivar os itens atuais desta cesta pessoal e recomeçar do zero?'
            : 'Deseja iniciar uma cesta em branco? Os itens atuais serão preservados no histórico.'
        }
        confirmLabel="Sim, Iniciar em Branco"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmEmptyBasket}
        onCancel={() => setIsConfirmEmptyOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        initialError={authModalError}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthModalError(null);
        }}
        onSuccess={handleAuthSuccess}
        onEnterDemo={handleEnterDemo}
      />

      {currentUser && (
        <OnboardingModal
          isOpen={isOnboardingOpen}
          userDisplayName={currentUser.displayName}
          targetProfileId={currentUser.profileId}
          skipLocalPersistence={currentUser.authProvider === 'google'}
          onFinish={handleFinishOnboarding}
          onSkip={() => {
            setIsOnboardingOpen(false);
            setActiveTab('impacto-no-bolso');
          }}
        />
      )}
    </div>
  );
}
