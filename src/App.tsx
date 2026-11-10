import React, { Suspense, lazy, useState, useEffect, useMemo, useCallback } from 'react';
import type { NavTab } from './components/Sidebar';
import { PublicLayout } from './components/PublicLayout';
import { SeoHeadManager } from './components/SeoHeadManager';
import { AnalyticsConsentBanner } from './components/AnalyticsConsentBanner';
import { LandingPageView } from './views/LandingPageView';
import type { OnboardingBundle } from './components/OnboardingModal';
import { isFirebaseConfigured, sanitizeFirestoreId } from './lib/firebaseConfig';
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
import { processBasketEconomics } from './services/economics';
import { IBGESeriesMetadata, IBGEService } from './services/ibge';
import { PUBLIC_ROUTES, normalizeRoutePath } from './config/seo';
import { trackLogin, trackSignUp, trackViewDashboard } from './services/analytics';

// Code-splitting por rota e modal (Lazy loading)
const HowItWorksPublicPage = lazy(() =>
  import('./views/public/HowItWorksPublicPage').then((m) => ({ default: m.HowItWorksPublicPage }))
);
const MethodologyPublicPage = lazy(() =>
  import('./views/public/MethodologyPublicPage').then((m) => ({ default: m.MethodologyPublicPage }))
);
const OfficialIpcaPublicPage = lazy(() =>
  import('./views/public/OfficialIpcaPublicPage').then((m) => ({
    default: m.OfficialIpcaPublicPage,
  }))
);
const PrivacyPublicPage = lazy(() =>
  import('./views/public/PrivacyPublicPage').then((m) => ({ default: m.PrivacyPublicPage }))
);

const Sidebar = lazy(() =>
  import('./components/Sidebar').then((m) => ({ default: m.Sidebar }))
);
const Header = lazy(() => import('./components/Header').then((m) => ({ default: m.Header })));

const OverviewView = lazy(() =>
  import('./views/OverviewView').then((m) => ({ default: m.OverviewView }))
);
const BasketView = lazy(() =>
  import('./views/BasketView').then((m) => ({ default: m.BasketView }))
);
const PriceHistoryView = lazy(() =>
  import('./views/PriceHistoryView').then((m) => ({ default: m.PriceHistoryView }))
);
const InflationAnalysisView = lazy(() =>
  import('./views/InflationAnalysisView').then((m) => ({ default: m.InflationAnalysisView }))
);
const PurchasingPowerView = lazy(() =>
  import('./views/PurchasingPowerView').then((m) => ({ default: m.PurchasingPowerView }))
);
const SavingStrategiesView = lazy(() =>
  import('./views/SavingStrategiesView').then((m) => ({ default: m.SavingStrategiesView }))
);
const ReportsView = lazy(() =>
  import('./views/ReportsView').then((m) => ({ default: m.ReportsView }))
);
const SettingsView = lazy(() =>
  import('./views/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const PocketImpactView = lazy(() =>
  import('./views/PocketImpactView').then((m) => ({ default: m.PocketImpactView }))
);
const OfficialIPCAView = lazy(() =>
  import('./views/OfficialIPCAView').then((m) => ({ default: m.OfficialIPCAView }))
);

const AuthModal = lazy(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const OnboardingModal = lazy(() =>
  import('./components/OnboardingModal').then((m) => ({ default: m.OnboardingModal }))
);
const NewItemDrawer = lazy(() =>
  import('./components/NewItemDrawer').then((m) => ({ default: m.NewItemDrawer }))
);
const QuickPriceModal = lazy(() =>
  import('./components/QuickPriceModal').then((m) => ({ default: m.QuickPriceModal }))
);
const ImportExportModal = lazy(() =>
  import('./components/ImportExportModal').then((m) => ({ default: m.ImportExportModal }))
);
const ConfirmModal = lazy(() =>
  import('./components/ConfirmModal').then((m) => ({ default: m.ConfirmModal }))
);

const VALID_TABS: NavTab[] = [
  'visao-geral',
  'impacto-no-bolso',
  'ipca-oficial',
  'minha-cesta-familiar',
  'precos-e-historico',
  'analise-da-inflacao',
  'renda-e-poder-de-compra',
  'estrategias-de-economia',
  'relatorios',
  'configuracoes',
];

const SHELL_FALLBACK_PROFILE: FamilyProfile = {
  id: 'profile-clean-slate',
  name: 'Meu Orçamento Familiar',
  membersCount: 2,
  referenceRegion: 'Brasil',
  currency: 'BRL',
  isDemo: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function parseTabFromPath(path: string): NavTab | null {
  const clean = normalizeRoutePath(path);
  if (clean === '/painel') return 'visao-geral';
  if (clean.startsWith('/painel/')) {
    const candidate = clean.replace('/painel/', '') as NavTab;
    return VALID_TABS.includes(candidate) ? candidate : 'visao-geral';
  }
  return null;
}

function loadInitialLocalUser(): UserAccount | null {
  const localUser = AuthService.getCurrentUser();
  if (!localUser) return null;
  if (localUser.authProvider === 'google') {
    return null;
  }
  return localUser;
}

const PageChunkFallback: React.FC<{ label?: string }> = ({
  label = 'Carregando conteúdo...',
}) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-6">
    <span className="material-symbols-outlined text-[30px] text-[#497cff] animate-spin">
      sync
    </span>
    <span className="font-mono text-xs text-[#45464d]">{label}</span>
  </div>
);

export default function App() {
  const initialPathname =
    typeof window !== 'undefined' ? normalizeRoutePath(window.location.pathname) : '/';
  const initialUser = useMemo(() => loadInitialLocalUser(), []);
  const initialTabFromUrl = parseTabFromPath(initialPathname);

  // Autenticação & Sessão (Firebase Auth + fallback local neste navegador)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(initialUser);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState<boolean>(() => !initialUser && initialPathname === '/demo');

  // Roteamento SPA amigável
  const [routePath, setRoutePath] = useState<string>(initialPathname);

  // Modais de Autenticação, Onboarding e Confirmação
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(
    !initialUser &&
      (initialPathname === '/login' ||
        initialPathname === '/cadastro' ||
        initialPathname === '/recuperar-senha' ||
        initialPathname === '/painel' ||
        initialPathname.startsWith('/painel/'))
  );
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'recover' | 'terms'>(
    initialPathname === '/cadastro'
      ? 'register'
      : initialPathname === '/recuperar-senha'
      ? 'recover'
      : 'login'
  );
  const [authModalError, setAuthModalError] = useState<string | null>(null);
  const [googleLandingLoading, setGoogleLandingLoading] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isConfirmEmptyOpen, setIsConfirmEmptyOpen] = useState(false);

  // Navegação do Painel
  const [activeTab, setActiveTab] = useState<NavTab>(initialTabFromUrl || 'visao-geral');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Metadados oficiais do IBGE carregados somente quando necessário
  const [ibgeMetadata, setIbgeMetadata] = useState<IBGESeriesMetadata | null>(null);

  // Estados Locais carregados sob demanda (evita leitura/gravação de cesta demo antes do login na landing)
  const [localStateHydrated, setLocalStateHydrated] = useState<boolean>(() =>
    Boolean(initialUser || initialPathname === '/demo')
  );
  const [localActiveProfile, setLocalActiveProfile] = useState<FamilyProfile>(() =>
    initialUser || initialPathname === '/demo' ? StorageService.getProfile() : SHELL_FALLBACK_PROFILE
  );
  const [localProfiles, setLocalProfiles] = useState<FamilyProfile[]>(() =>
    initialUser || initialPathname === '/demo' ? StorageService.getProfiles() : [SHELL_FALLBACK_PROFILE]
  );
  const [localItems, setLocalItems] = useState<BasketItem[]>(() =>
    initialUser || initialPathname === '/demo' ? StorageService.getItems() : []
  );

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

  const isAuthenticatedDashboard = Boolean(currentUser || isDemo);
  const isFirebaseMode = Boolean(
    firebaseUid && currentUser?.authProvider === 'google' && !isDemo && isFirebaseConfigured()
  );

  const navigateUrl = useCallback((nextPath: string, replace = false) => {
    const clean = normalizeRoutePath(nextPath);
    if (typeof window !== 'undefined' && window.location.pathname !== clean) {
      if (replace) {
        window.history.replaceState({}, '', clean);
      } else {
        window.history.pushState({}, '', clean);
      }
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    setRoutePath(clean);

    if (clean === '/login') {
      setAuthModalMode('login');
      setAuthModalError(null);
      setIsAuthModalOpen(true);
    } else if (clean === '/cadastro') {
      setAuthModalMode('register');
      setAuthModalError(null);
      setIsAuthModalOpen(true);
    } else if (clean === '/recuperar-senha') {
      setAuthModalMode('recover');
      setAuthModalError(null);
      setIsAuthModalOpen(true);
    } else {
      const tabFromPath = parseTabFromPath(clean);
      if (tabFromPath) {
        setActiveTab(tabFromPath);
      }
    }
  }, []);

  const hydrateLocalState = useCallback((targetProfileId?: string) => {
    if (targetProfileId) {
      StorageService.setActiveProfileId(targetProfileId);
    }
    setLocalActiveProfile(StorageService.getProfile());
    setLocalProfiles(StorageService.getProfiles());
    setLocalItems(StorageService.getItems(targetProfileId));
    setLocalStateHydrated(true);
  }, []);

  // Sincronização do botão voltar/avançar do navegador
  useEffect(() => {
    const onPopState = () => {
      const next = normalizeRoutePath(window.location.pathname);
      setRoutePath(next);
      if (next === '/demo') {
        setIsDemo(true);
        hydrateLocalState();
      } else if (next === '/login' || next === '/cadastro' || next === '/recuperar-senha') {
        setAuthModalMode(
          next === '/cadastro' ? 'register' : next === '/recuperar-senha' ? 'recover' : 'login'
        );
        setIsAuthModalOpen(true);
      } else {
        const parsedTab = parseTabFromPath(next);
        if (parsedTab) {
          setActiveTab(parsedTab);
          if (!currentUser && !isDemo) {
            setAuthModalMode('login');
            setIsAuthModalOpen(true);
          }
        }
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentUser, isDemo, hydrateLocalState]);

  // Assinatura de sessão do Firebase Auth sob demanda (não bloqueia primeira pintura nem baixa Firestore em visitantes públicos)
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let active = true;
    let unsubAuth: (() => void) | undefined;

    import('./lib/firebaseAuthOnly')
      .then(({ subscribeFirebaseAuthState }) => {
        if (!active) return;
        unsubAuth = subscribeFirebaseAuthState(async (firebaseUser) => {
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
            const [{ testFirestoreConnection }, { FirestoreService }] = await Promise.all([
              import('./lib/firebase'),
              import('./services/firestore'),
            ]);
            if (!active) return;
            testFirestoreConnection().catch(() => {});
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
      })
      .catch((err) => {
        console.warn('Falha ao carregar módulo de autenticação Firebase:', err);
      });

    return () => {
      active = false;
      unsubAuth?.();
    };
  }, []);

  // Sincronização em segundo plano do IBGE executada SOMENTE no painel autenticado/demo
  // (A página pública /ipca-oficial consulta diretamente via OfficialIPCAView quando acessada)
  useEffect(() => {
    if (!isAuthenticatedDashboard || ibgeMetadata) return;
    let active = true;

    IBGEService.getMetadata()
      .then((meta) => {
        if (active) setIbgeMetadata(meta);
      })
      .catch((err) => {
        console.warn('Sincronização em segundo plano do IBGE:', err);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticatedDashboard, ibgeMetadata]);

  // Analytics de visualização de abas do painel
  useEffect(() => {
    if (!isAuthenticatedDashboard) return;
    trackViewDashboard(activeTab, isDemo ? 'demo' : 'authenticated');
  }, [isAuthenticatedDashboard, activeTab, isDemo]);

  // Listeners em tempo real do Cloud Firestore para o titular autenticado
  useEffect(() => {
    if (!firebaseUid || !isFirebaseConfigured()) {
      return;
    }
    let active = true;
    let unsubscribe: (() => void) | undefined;

    import('./services/firestore')
      .then(({ FirestoreService }) => {
        if (!active) return;
        unsubscribe = FirestoreService.subscribeUserCollections(firebaseUid, {
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
      })
      .catch((err) => {
        console.error('Erro ao conectar listeners do Cloud Firestore:', err);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [firebaseUid]);

  // Perfis efetivos no modo atual
  const profiles = useMemo<FamilyProfile[]>(() => {
    if (!isAuthenticatedDashboard) return [SHELL_FALLBACK_PROFILE];
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
  }, [isAuthenticatedDashboard, isFirebaseMode, cloudProfiles, currentUser, localProfiles]);

  const activeProfile = useMemo<FamilyProfile>(() => {
    if (!isAuthenticatedDashboard) return SHELL_FALLBACK_PROFILE;
    if (!isFirebaseMode) return localActiveProfile;
    const targetId = activeCloudProfileId || currentUser?.profileId;
    return (
      profiles.find((p) => p.id === targetId) ||
      profiles.find((p) => p.id === currentUser?.profileId) ||
      profiles[0]
    );
  }, [isAuthenticatedDashboard, isFirebaseMode, localActiveProfile, activeCloudProfileId, currentUser?.profileId, profiles]);

  // Itens da cesta efetivos (excluindo arquivados e filtrados pelo perfil ativo)
  const items = useMemo<BasketItem[]>(() => {
    if (!isAuthenticatedDashboard) return [];
    if (!isFirebaseMode) return localItems;
    return cloudItems.filter((item) => !item.isArchived && item.profileId === activeProfile.id);
  }, [isAuthenticatedDashboard, isFirebaseMode, localItems, cloudItems, activeProfile.id]);

  // Histórico de renda efetivo do perfil ativo (só carrega quando logado/demo)
  const activeIncomeHistory = useMemo<IncomeRecord[]>(() => {
    if (!isAuthenticatedDashboard || !localStateHydrated) {
      if (isFirebaseMode) {
        return cloudIncomeHistory
          .filter((inc) => inc.profileId === activeProfile.id)
          .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
      }
      return [];
    }
    if (!isFirebaseMode) {
      return StorageService.getIncomeHistory(activeProfile.id);
    }
    return cloudIncomeHistory
      .filter((inc) => inc.profileId === activeProfile.id)
      .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
  }, [isAuthenticatedDashboard, localStateHydrated, isFirebaseMode, activeProfile.id, cloudIncomeHistory]);

  // Categorias efetivas
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

  // Cálculo econômico executado apenas no painel autenticado/demo
  const summary = useMemo(() => {
    if (!isAuthenticatedDashboard) return null;
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
  }, [isAuthenticatedDashboard, items, activeIncomeHistory, isDemo, ibgeMetadata?.accumulated12MRate]);

  // Navegação de abas dentro do painel
  const handleSelectDashboardTab = useCallback(
    (tab: NavTab) => {
      setActiveTab(tab);
      if (!isDemo) {
        navigateUrl(`/painel/${tab}`);
      }
    },
    [isDemo, navigateUrl]
  );

  // Handler de Sucesso de Autenticação
  const handleAuthSuccess = (user: UserAccount, isNewUser = false) => {
    setCurrentUser(user);
    setIsDemo(false);
    setAuthModalError(null);
    setIsAuthModalOpen(false);

    if (isNewUser) {
      trackSignUp(user.authProvider === 'google' ? 'google' : 'local_email');
    } else {
      trackLogin(user.authProvider === 'google' ? 'google' : 'local_email');
    }

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
      hydrateLocalState(userProfile.id);
    }

    if (isNewUser) {
      setIsOnboardingOpen(true);
    } else {
      const requestedTab = parseTabFromPath(routePath) || 'visao-geral';
      setActiveTab(requestedTab);
      navigateUrl(`/painel/${requestedTab}`, true);
    }
  };

  // Handler direto de Login com Google na Landing Page (importação sob demanda)
  const handleLandingGoogleLogin = async () => {
    setGoogleLandingLoading(true);
    setAuthModalError(null);
    try {
      const { startGoogleOAuthPopup } = await import('./services/googleOAuth');
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
    navigateUrl('/', true);
    if (isFirebaseConfigured()) {
      const { signOutFirebase } = await import('./lib/firebaseAuthOnly');
      await signOutFirebase();
    }
  };

  // Handler de Entrada no Modo Demonstração
  const handleEnterDemo = useCallback(() => {
    setIsDemo(true);
    const demoProfile =
      StorageService.getProfiles().find((p) => p.isDemo) || StorageService.getProfiles()[0];
    hydrateLocalState(demoProfile.id);
    setActiveTab('visao-geral');
    trackLogin('demo');
    navigateUrl('/demo');
  }, [hydrateLocalState, navigateUrl]);

  // Conclusão do Onboarding
  const handleFinishOnboarding = async (newProfile: FamilyProfile, bundle?: OnboardingBundle) => {
    setIsOnboardingOpen(false);
    setActiveTab('impacto-no-bolso');
    navigateUrl('/painel/impacto-no-bolso', true);

    if (isFirebaseMode && firebaseUid && bundle) {
      setActiveCloudProfileId(newProfile.id);
      try {
        const { FirestoreService } = await import('./services/firestore');
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
      hydrateLocalState(newProfile.id);
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
        const { FirestoreService } = await import('./services/firestore');
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
        const { FirestoreService } = await import('./services/firestore');
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
        const { FirestoreService } = await import('./services/firestore');
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
        const { FirestoreService } = await import('./services/firestore');
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
        const { FirestoreService } = await import('./services/firestore');
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
        const { FirestoreService } = await import('./services/firestore');
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

      const { FirestoreService } = await import('./services/firestore');
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
        const { FirestoreService } = await import('./services/firestore');
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
        const { FirestoreService } = await import('./services/firestore');
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
      handleSelectDashboardTab('minha-cesta-familiar');
      return;
    }
    setIsConfirmEmptyOpen(true);
  }, [firebaseUid, isDemo, handleSelectDashboardTab]);

  const handleConfirmEmptyBasket = useCallback(async () => {
    setIsConfirmEmptyOpen(false);
    if (isFirebaseMode && firebaseUid) {
      const { FirestoreService } = await import('./services/firestore');
      await Promise.all(items.map((item) => FirestoreService.archiveBasketItem(firebaseUid, item.id)));
      handleSelectDashboardTab('minha-cesta-familiar');
    } else {
      StorageService.clearToEmptyBasket();
      hydrateLocalState();
      handleSelectDashboardTab('minha-cesta-familiar');
    }
  }, [isFirebaseMode, firebaseUid, items, hydrateLocalState, handleSelectDashboardTab]);

  // Alternância para Cenário Demonstrativo
  const handleSwitchToDemoBasket = useCallback(() => {
    StorageService.loadDemoBasket();
    if (firebaseUid) {
      setIsDemo(true);
    }
    const demoProfile =
      StorageService.getProfiles().find((p) => p.isDemo) || StorageService.getProfiles()[0];
    hydrateLocalState(demoProfile.id);
    handleSelectDashboardTab('visao-geral');
  }, [firebaseUid, hydrateLocalState, handleSelectDashboardTab]);

  // Abertura do Histórico de Preços para Item Específico
  const handleViewPriceHistory = useCallback(
    (item: BasketItem) => {
      setSelectedItemForHistory(item);
      handleSelectDashboardTab('precos-e-historico');
    },
    [handleSelectDashboardTab]
  );

  // Importação de Itens
  const handleImportItems = useCallback(
    async (imported: BasketItem[]) => {
      if (isFirebaseMode && firebaseUid) {
        const { FirestoreService } = await import('./services/firestore');
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
        const { FirestoreService } = await import('./services/firestore');
        await FirestoreService.saveProfile(firebaseUid, updatedProfile);
      } else {
        setLocalActiveProfile(updatedProfile);
        setLocalProfiles(StorageService.getProfiles());
      }
    },
    [isFirebaseMode, firebaseUid]
  );

  // Rota efetiva para SeoHeadManager (garante que área logada e demo sejam sempre noindex)
  const effectiveSeoPath = useMemo(() => {
    if (isAuthenticatedDashboard) {
      return isDemo ? '/demo' : `/painel/${activeTab}`;
    }
    return routePath;
  }, [isAuthenticatedDashboard, isDemo, activeTab, routePath]);

  const openLoginModal = useCallback(() => {
    setAuthModalMode('login');
    setAuthModalError(null);
    setIsAuthModalOpen(true);
  }, []);

  const openRegisterModal = useCallback(() => {
    setAuthModalMode('register');
    setAuthModalError(null);
    setIsAuthModalOpen(true);
  }, []);

  // SE NÃO HÁ USUÁRIO E NÃO ESTÁ EM DEMO: EXIBE A CAMADA PÚBLICA INDEXÁVEL
  if (!currentUser && !isDemo) {
    const cleanPublicPath = normalizeRoutePath(routePath);
    const isAuthOrProtectedAlias =
      cleanPublicPath === '/login' ||
      cleanPublicPath === '/cadastro' ||
      cleanPublicPath === '/recuperar-senha' ||
      cleanPublicPath === '/painel' ||
      cleanPublicPath.startsWith('/painel/');

    const isKnownPublicPage = Boolean(PUBLIC_ROUTES[cleanPublicPath]) || isAuthOrProtectedAlias;

    return (
      <>
        <SeoHeadManager currentPath={effectiveSeoPath} />

        <PublicLayout
          currentPath={isAuthOrProtectedAlias ? '/' : cleanPublicPath}
          onNavigate={(path) => navigateUrl(path)}
          onOpenLogin={openLoginModal}
          onOpenRegister={openRegisterModal}
          onEnterDemo={handleEnterDemo}
          onOpenTerms={() => navigateUrl('/privacidade')}
        >
          {(!isKnownPublicPage && (
            <main className="max-w-[960px] mx-auto px-6 py-20 flex flex-col items-start gap-4">
              <span className="font-mono text-xs uppercase font-bold text-[#ba1a1a]">
                Erro 404 • Página não encontrada
              </span>
              <h1 className="text-3xl font-extrabold text-[#0b1c30]">
                Este endereço não existe no IPCA-Casa
              </h1>
              <p className="text-sm text-[#45464d]">
                Acesse a calculadora na página inicial ou consulte os indicadores oficiais do IBGE.
              </p>
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateUrl('/');
                }}
                className="px-5 py-2.5 rounded-xl bg-[#000000] text-[#ffffff] text-xs font-mono font-semibold"
              >
                Voltar para o Início
              </a>
            </main>
          )) ||
            (cleanPublicPath === '/como-funciona' && (
              <Suspense fallback={<PageChunkFallback />}>
                <HowItWorksPublicPage
                  onNavigate={(path) => navigateUrl(path)}
                  onOpenRegister={openRegisterModal}
                  onEnterDemo={handleEnterDemo}
                />
              </Suspense>
            )) ||
            (cleanPublicPath === '/metodologia' && (
              <Suspense fallback={<PageChunkFallback />}>
                <MethodologyPublicPage
                  onNavigate={(path) => navigateUrl(path)}
                  onOpenRegister={openRegisterModal}
                />
              </Suspense>
            )) ||
            (cleanPublicPath === '/ipca-oficial' && (
              <Suspense fallback={<PageChunkFallback />}>
                <OfficialIpcaPublicPage
                  onNavigate={(path) => navigateUrl(path)}
                  onOpenRegister={openRegisterModal}
                  onEnterDemo={handleEnterDemo}
                />
              </Suspense>
            )) ||
            (cleanPublicPath === '/privacidade' && (
              <Suspense fallback={<PageChunkFallback />}>
                <PrivacyPublicPage onNavigate={(path) => navigateUrl(path)} />
              </Suspense>
            )) || (
              <LandingPageView
                onOpenRegister={openRegisterModal}
                onGoogleLogin={handleLandingGoogleLogin}
                googleLoading={googleLandingLoading}
                onEnterDemo={handleEnterDemo}
                onNavigate={(path) => navigateUrl(path)}
              />
            )}
        </PublicLayout>

        <AnalyticsConsentBanner onOpenPrivacy={() => navigateUrl('/privacidade')} />

        {isAuthModalOpen && (
          <Suspense fallback={null}>
            <AuthModal
              isOpen={isAuthModalOpen}
              initialMode={authModalMode}
              initialError={authModalError}
              onClose={() => {
                setIsAuthModalOpen(false);
                setAuthModalError(null);
                if (isAuthOrProtectedAlias) {
                  navigateUrl('/', true);
                }
              }}
              onSuccess={handleAuthSuccess}
              onEnterDemo={handleEnterDemo}
            />
          </Suspense>
        )}
      </>
    );
  }

  // AMBIENTE DO DASHBOARD (LOGADO OU MODO DEMONSTRAÇÃO - SEMPRE NOINDEX)
  const effectiveSummary = summary!;

  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <SeoHeadManager currentPath={effectiveSeoPath} />

      <Suspense fallback={<div className="w-72 shrink-0 bg-[#ffffff] border-r border-[#eff4ff]" />}>
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleSelectDashboardTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isDemo={isDemo}
          userName={currentUser?.displayName || (isDemo ? 'Demonstração' : undefined)}
          userAvatar={currentUser?.avatarUrl}
          authProvider={currentUser?.authProvider}
          onLogout={handleLogout}
        />
      </Suspense>

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
                  onClick={() => {
                    setIsDemo(false);
                    navigateUrl('/painel/visao-geral', true);
                  }}
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

        <Suspense fallback={<div className="h-16 border-b border-[#eff4ff] bg-[#f8f9ff]" />}>
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
                hydrateLocalState(profileId);
              }
            }}
            selectedTimeframe={selectedTimeframe}
            onSelectTimeframe={setSelectedTimeframe}
            onNavigateToSettings={() => handleSelectDashboardTab('configuracoes')}
            onSwitchToEmptyBasket={handleRequestEmptyBasket}
            onSwitchToDemoBasket={handleSwitchToDemoBasket}
            isDemo={isDemo}
          />
        </Suspense>

        {/* Visão Ativa */}
        <main className="flex-1 pb-16">
          <Suspense fallback={<PageChunkFallback label="Carregando módulo analítico..." />}>
            {activeTab === 'visao-geral' && (
              <OverviewView
                summary={effectiveSummary}
                onNavigateTab={handleSelectDashboardTab}
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
                summary={effectiveSummary}
                onUpdateIncome={handleUpdateIncome}
                isDemo={isDemo}
              />
            )}

            {activeTab === 'ipca-oficial' && (
              <OfficialIPCAView onNavigateTab={handleSelectDashboardTab} analyticsSurface="dashboard" />
            )}

            {activeTab === 'minha-cesta-familiar' && (
              <BasketView
                summary={effectiveSummary}
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
                summary={effectiveSummary}
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
                summary={effectiveSummary}
                onNavigateTab={handleSelectDashboardTab}
                isDemo={isDemo}
              />
            )}

            {activeTab === 'renda-e-poder-de-compra' && (
              <PurchasingPowerView
                summary={effectiveSummary}
                onUpdateIncome={handleUpdateIncome}
                isDemo={isDemo}
              />
            )}

            {activeTab === 'estrategias-de-economia' && (
              <SavingStrategiesView
                summary={effectiveSummary}
                isDemo={isDemo}
                activeProfileId={activeProfile.id}
                plansA={activePlansA}
                plansB={activePlansB}
                planC={activePlanC}
                onSavePlanA={isFirebaseMode ? handleSavePlanA : undefined}
                onSavePlanB={isFirebaseMode ? handleSavePlanB : undefined}
                onNavigateTab={handleSelectDashboardTab}
              />
            )}

            {activeTab === 'relatorios' && <ReportsView summary={effectiveSummary} isDemo={isDemo} />}

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
          </Suspense>
        </main>
      </div>

      {/* Modais Globais sob demanda */}
      {isNewItemDrawerOpen && (
        <Suspense fallback={null}>
          <NewItemDrawer
            isOpen={isNewItemDrawerOpen}
            onClose={() => {
              setIsNewItemDrawerOpen(false);
              setEditingItem(null);
            }}
            onSave={handleSaveItem}
            editingItem={editingItem}
            totalMonthlySpend={effectiveSummary.totalMonthlySpend}
            groups={cloudEffectiveGroups}
          />
        </Suspense>
      )}

      {isQuickPriceOpen && (
        <Suspense fallback={null}>
          <QuickPriceModal
            isOpen={isQuickPriceOpen}
            onClose={() => setIsQuickPriceOpen(false)}
            items={items}
            onUpdatePrice={handleUpdatePrice}
          />
        </Suspense>
      )}

      {isImportExportOpen && (
        <Suspense fallback={null}>
          <ImportExportModal
            isOpen={isImportExportOpen}
            onClose={() => setIsImportExportOpen(false)}
            items={items}
            onImportItems={handleImportItems}
          />
        </Suspense>
      )}

      {isConfirmEmptyOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {isAuthModalOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {currentUser && isOnboardingOpen && (
        <Suspense fallback={null}>
          <OnboardingModal
            isOpen={isOnboardingOpen}
            userDisplayName={currentUser.displayName}
            targetProfileId={currentUser.profileId}
            skipLocalPersistence={currentUser.authProvider === 'google'}
            onFinish={handleFinishOnboarding}
            onSkip={() => {
              setIsOnboardingOpen(false);
              handleSelectDashboardTab('impacto-no-bolso');
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
