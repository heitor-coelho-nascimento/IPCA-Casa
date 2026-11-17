import React, { Suspense, lazy, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { NavTab } from './components/Sidebar';
import { PublicLayout } from './components/PublicLayout';
import { SeoHeadManager } from './components/SeoHeadManager';
import { AnalyticsConsentBanner } from './components/AnalyticsConsentBanner';
import { ToastContainer } from './components/Toast';
import { LandingPageView } from './views/LandingPageView';
import type { OnboardingBundle } from './components/OnboardingModal';
import { isFirebaseConfigured, sanitizeFirestoreId } from './lib/firebaseConfig';
import {
  BasketItem,
  ConsumptionGroup,
  EfficiencyPlanB,
  FamilyProfile,
  IncomeRecord,
  MonthlyClosure,
  OpportunityPlanC,
  PriceRecord,
  ProfileMode,
  SubstitutePlanA,
  ToastNotification,
  UserAccount,
} from './types';
import { StorageService, getDefaultGroupsForMode } from './services/storage';
import { AuthService, LegacyLocalBundle, LegacyMigrationService } from './services/auth';
import { processBasketEconomics } from './services/economics';
import {
  getOfficialBenchmarkForTimeframe,
  IBGESeriesMetadata,
  IBGEService,
} from './services/ibge';
import { PUBLIC_ROUTES, normalizeRoutePath } from './config/seo';
import { POLICY_VERSION, TERMS_VERSION } from './config/privacy';
import { trackLogin, trackSignUp, trackViewDashboard } from './services/analytics';
import {
  clearPendingTermsAcceptance,
  openCookiePreferencesModal,
  readPendingTermsAcceptance,
} from './services/consent';
import { runLocalDataRetentionSweep } from './services/retention';
import { getMonthsAgoIsoDate, getTodayIsoDate } from './utils/dates';
import { buildDuplicateSignature } from './utils/csvImport';
import { resolveProfileMode } from './utils/profileMode';

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
const TermsPublicPage = lazy(() =>
  import('./views/public/TermsPublicPage').then((m) => ({ default: m.TermsPublicPage }))
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
const LegacyMigrationModal = lazy(() =>
  import('./components/LegacyMigrationModal').then((m) => ({ default: m.LegacyMigrationModal }))
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

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[IPCA-Casa ErrorBoundary] ${error.message || 'Erro de renderização'}`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 my-8 mx-auto max-w-xl bg-[#ffffff] border border-[#ffdad6] rounded-2xl shadow-sm text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[#ffdad6]/40 flex items-center justify-center text-[#ba1a1a]">
            <span className="material-symbols-outlined text-[24px]">warning</span>
          </div>
          <h2 className="text-base font-bold text-[#0b1c30] mb-1">
            {this.props.fallbackTitle || 'Não foi possível carregar este módulo'}
          </h2>
          <p className="text-xs text-[#45464d] mb-4">
            {this.state.error?.message || 'Ocorreu uma falha inesperada na visualização.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-[#000000] text-[#ffffff] text-xs font-semibold rounded-lg hover:bg-[#213145] transition-colors cursor-pointer"
          >
            Recarregar Módulo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const initialPathname =
    typeof window !== 'undefined' ? normalizeRoutePath(window.location.pathname) : '/';
  const initialTabFromUrl = parseTabFromPath(initialPathname);
  const firebaseAvailable = isFirebaseConfigured();

  // Autenticação & Sessão (exclusivamente Firebase Authentication para contas reais)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState<boolean>(firebaseAvailable);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState<boolean>(() => initialPathname === '/demo');

  // Migração Segura de Dados Locais Legados
  const [pendingLegacyBundle, setPendingLegacyBundle] = useState<LegacyLocalBundle | null>(null);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [isConfirmDiscardLegacyOpen, setIsConfirmDiscardLegacyOpen] = useState(false);
  const scannedLegacyUidRef = useRef<string | null>(null);

  // Notificações Toast Globais
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const addToast = useCallback((type: ToastNotification['type'], message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message, timestamp: Date.now() }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Roteamento SPA amigável
  const [routePath, setRoutePath] = useState<string>(initialPathname);

  // Modais de Autenticação, Onboarding e Confirmação
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(
    initialPathname === '/login' ||
      initialPathname === '/cadastro' ||
      initialPathname === '/recuperar-senha' ||
      (!firebaseAvailable && Boolean(initialTabFromUrl))
  );
  const [authModalMode, setAuthModalMode] = useState<
    'login' | 'register' | 'recover' | 'verify-email' | 'terms'
  >(
    initialPathname === '/cadastro'
      ? 'register'
      : initialPathname === '/recuperar-senha'
      ? 'recover'
      : 'login'
  );
  const [authModalError, setAuthModalError] = useState<string | null>(null);
  const [googleLandingLoading, setGoogleLandingLoading] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isOnboardingEditMode, setIsOnboardingEditMode] = useState(false);
  const autoPromptedOnboardingRef = useRef<Set<string>>(new Set());
  const [isConfirmEmptyOpen, setIsConfirmEmptyOpen] = useState(false);

  // Governança LGPD: gate pós-login de aceite de termos e visualizador modal autenticado
  const [needsTermsAcceptanceGate, setNeedsTermsAcceptanceGate] = useState(false);
  const [termsGateCheckbox, setTermsGateCheckbox] = useState(false);
  const [termsGateSaving, setTermsGateSaving] = useState(false);
  const [termsGateError, setTermsGateError] = useState<string | null>(null);
  const [dashboardLegalDoc, setDashboardLegalDoc] = useState<'privacy' | 'terms' | null>(null);

  // Navegação do Painel & Busca Global
  const [activeTab, setActiveTab] = useState<NavTab>(initialTabFromUrl || 'visao-geral');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');

  // Metadados oficiais do IBGE carregados somente quando necessário
  const [ibgeMetadata, setIbgeMetadata] = useState<IBGESeriesMetadata | null>(null);

  // Estados Locais carregados sob demanda (exclusivo do modo demonstração)
  const [localStateHydrated, setLocalStateHydrated] = useState<boolean>(() => initialPathname === '/demo');
  const [localRevision, setLocalRevision] = useState(0);
  const [localActiveProfile, setLocalActiveProfile] = useState<FamilyProfile>(() =>
    initialPathname === '/demo' ? StorageService.getProfile() : SHELL_FALLBACK_PROFILE
  );
  const [localProfiles, setLocalProfiles] = useState<FamilyProfile[]>(() =>
    initialPathname === '/demo' ? StorageService.getProfiles() : [SHELL_FALLBACK_PROFILE]
  );
  const [localItems, setLocalItems] = useState<BasketItem[]>(() =>
    initialPathname === '/demo' ? StorageService.getItems() : []
  );

  // Estados Cloud Firestore (Sincronizados em Tempo Real para Google e E-mail/Senha verificado)
  const [activeCloudProfileId, setActiveCloudProfileId] = useState<string>('');
  const [cloudProfiles, setCloudProfiles] = useState<FamilyProfile[]>([]);
  const [cloudItems, setCloudItems] = useState<BasketItem[]>([]);
  const [cloudIncomeHistory, setCloudIncomeHistory] = useState<IncomeRecord[]>([]);
  const [cloudPriceHistory, setCloudPriceHistory] = useState<PriceRecord[]>([]);
  const [cloudConsumptionGroups, setCloudConsumptionGroups] = useState<ConsumptionGroup[]>([]);
  const [cloudPlansA, setCloudPlansA] = useState<SubstitutePlanA[]>([]);
  const [cloudPlansB, setCloudPlansB] = useState<EfficiencyPlanB[]>([]);
  const [cloudPlansC, setCloudPlansC] = useState<OpportunityPlanC[]>([]);
  const [cloudMonthlyClosures, setCloudMonthlyClosures] = useState<MonthlyClosure[]>([]);
  const [cloudProfilesReady, setCloudProfilesReady] = useState(false);
  const [cloudItemsReady, setCloudItemsReady] = useState(false);
  const [cloudIncomeReady, setCloudIncomeReady] = useState(false);

  // Período selecionado
  const [selectedTimeframe, setSelectedTimeframe] = useState<'12M' | 'YTD' | '1M'>('12M');

  // Modais e gavetas
  const [isNewItemDrawerOpen, setIsNewItemDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BasketItem | null>(null);
  const [isQuickPriceOpen, setIsQuickPriceOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<BasketItem | null>(null);

  const isAuthenticatedDashboard = Boolean(currentUser || isDemo);
  const isFirebaseMode = Boolean(firebaseUid && currentUser && !isDemo && isFirebaseConfigured());

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

  const bumpLocalRevision = useCallback(() => {
    setLocalRevision((rev) => rev + 1);
  }, []);

  const hydrateLocalState = useCallback((targetProfileId?: string) => {
    if (targetProfileId) {
      StorageService.setActiveProfileId(targetProfileId);
    }
    const nextActive = StorageService.getProfile();
    setLocalActiveProfile(nextActive);
    setLocalProfiles(StorageService.getProfiles());
    setLocalItems(StorageService.getItems(nextActive.id));
    setLocalStateHydrated(true);
    setLocalRevision((rev) => rev + 1);
  }, []);

  const runLegacyScanForUser = useCallback((uid: string) => {
    if (scannedLegacyUidRef.current === uid) return;
    scannedLegacyUidRef.current = uid;

    if (LegacyMigrationService.isDismissedForUser(uid)) {
      if (LegacyMigrationService.hasLegacyCredentials()) {
        LegacyMigrationService.clearLegacyCredentialArtifactsOnly();
      }
      return;
    }

    const bundle = LegacyMigrationService.scanLegacyLocalData();
    if (bundle.hasFinancialData) {
      setPendingLegacyBundle(bundle);
      setIsMigrationModalOpen(true);
    } else if (bundle.hasLegacyCredentials) {
      LegacyMigrationService.clearLegacyCredentialArtifactsOnly();
    }
  }, []);

  // Política de retenção e minimização automática local no carregamento
  useEffect(() => {
    runLocalDataRetentionSweep();
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
          if (!currentUser && !isDemo && !isAuthInitializing) {
            setAuthModalMode(pendingVerificationEmail ? 'verify-email' : 'login');
            setIsAuthModalOpen(true);
          }
        }
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentUser, isDemo, isAuthInitializing, pendingVerificationEmail, hydrateLocalState]);

  // Assinatura oficial de sessão do Firebase Authentication (Google + E-mail/Senha verificado)
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setIsAuthInitializing(false);
      return;
    }
    let active = true;
    let unsubAuth: (() => void) | undefined;

    import('./lib/firebaseAuthOnly')
      .then(({ subscribeFirebaseAuthState }) => {
        if (!active) return;
        unsubAuth = subscribeFirebaseAuthState(async (firebaseUser) => {
          if (!active) return;

          if (!firebaseUser || !firebaseUser.email) {
            scannedLegacyUidRef.current = null;
            setFirebaseUid(null);
            setCloudProfiles([]);
            setCloudItems([]);
            setCloudIncomeHistory([]);
            setCloudPriceHistory([]);
            setCloudConsumptionGroups([]);
            setCloudPlansA([]);
            setCloudPlansB([]);
            setCloudPlansC([]);
            setCloudMonthlyClosures([]);
            setCloudProfilesReady(false);
            setCloudItemsReady(false);
            setCloudIncomeReady(false);
            setCurrentUser(null);
            setPendingVerificationEmail(null);
            setIsAuthInitializing(false);
            if (parseTabFromPath(window.location.pathname)) {
              setAuthModalMode('login');
              setIsAuthModalOpen(true);
            }
            return;
          }

          if (firebaseUser.emailVerified === false) {
            setFirebaseUid(null);
            setCloudProfiles([]);
            setCloudItems([]);
            setCloudIncomeHistory([]);
            setCloudPriceHistory([]);
            setCloudConsumptionGroups([]);
            setCloudPlansA([]);
            setCloudPlansB([]);
            setCloudPlansC([]);
            setCloudMonthlyClosures([]);
            setCurrentUser(null);
            setPendingVerificationEmail(firebaseUser.email);
            setIsAuthInitializing(false);
            if (parseTabFromPath(window.location.pathname)) {
              setAuthModalMode('verify-email');
              setAuthModalError(
                'Confirme seu endereço de e-mail através do link enviado pelo Firebase antes de acessar o painel.'
              );
              setIsAuthModalOpen(true);
            }
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

            const pendingTerms = readPendingTermsAcceptance();
            if (pendingTerms) {
              await FirestoreService.recordTermsAcceptance(user.id, pendingTerms).catch(() => {});
              clearPendingTermsAcceptance();
              if (active) setNeedsTermsAcceptanceGate(false);
            } else {
              try {
                const hasAccepted = await FirestoreService.hasAcceptedTermsVersion(
                  user.id,
                  TERMS_VERSION,
                  POLICY_VERSION
                );
                if (active) setNeedsTermsAcceptanceGate(!hasAccepted);
              } catch {
                // Em caso de falha transitória, não trava o carregamento e tentará na próxima sessão
              }
            }

            setFirebaseUid(user.id);
            setIsDemo(false);
            setPendingVerificationEmail(null);
            setCurrentUser(user);
            setActiveCloudProfileId((prevId) => prevId || user.profileId);
            setIsAuthInitializing(false);
            setIsAuthModalOpen(false);
            runLegacyScanForUser(user.id);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'erro desconhecido';
            console.error(`Erro ao inicializar sessão no Cloud Firestore (${msg})`);
            setIsAuthInitializing(false);
          }
        });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        console.warn(`Falha ao carregar módulo de autenticação Firebase (${msg})`);
        if (active) setIsAuthInitializing(false);
      });

    return () => {
      active = false;
      unsubAuth?.();
    };
  }, [runLegacyScanForUser]);

  // Sincronização em segundo plano do IBGE executada SOMENTE no painel autenticado/demo
  useEffect(() => {
    if (!isAuthenticatedDashboard || ibgeMetadata) return;
    let active = true;

    IBGEService.getMetadata()
      .then((meta) => {
        if (active) setIbgeMetadata(meta);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        console.warn(`Sincronização em segundo plano do IBGE indisponível (${msg})`);
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
            setCloudProfilesReady(true);
          },
          onBasketItems: (remoteItems) => {
            setCloudItems(remoteItems);
            setCloudItemsReady(true);
          },
          onIncomeHistory: (remoteIncome) => {
            setCloudIncomeHistory(remoteIncome);
            setCloudIncomeReady(true);
          },
          onPriceHistory: (remotePrices) => {
            setCloudPriceHistory(remotePrices);
          },
          onConsumptionGroups: (remoteGroups) => {
            setCloudConsumptionGroups(remoteGroups);
          },
          onStrategies: ({ plansA, plansB, plansC }) => {
            setCloudPlansA(plansA);
            setCloudPlansB(plansB);
            setCloudPlansC(plansC);
          },
          onMonthlyClosures: (remoteClosures) => {
            setCloudMonthlyClosures(remoteClosures);
          },
        });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        console.error(`Erro ao conectar listeners do Cloud Firestore (${msg})`);
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

  const activeProfileMode = resolveProfileMode(activeProfile.profileMode);
  const alertThresholdPercent = activeProfile.priceAlertThresholdPercent ?? 10;

  // Itens da cesta efetivos (excluindo arquivados e filtrados pelo perfil ativo)
  const items = useMemo<BasketItem[]>(() => {
    if (!isAuthenticatedDashboard) return [];
    if (!isFirebaseMode) return localItems;
    return cloudItems.filter((item) => !item.isArchived && item.profileId === activeProfile.id);
  }, [isAuthenticatedDashboard, isFirebaseMode, localItems, cloudItems, activeProfile.id]);

  // Histórico de preços efetivo do perfil ativo
  const activePriceHistory = useMemo<PriceRecord[]>(() => {
    if (!isAuthenticatedDashboard) return [];
    const activeItemIds = new Set(items.map((it) => it.id));
    if (isFirebaseMode) {
      return cloudPriceHistory.filter((p) =>
        p.profileId ? p.profileId === activeProfile.id : activeItemIds.has(p.itemId)
      );
    }
    if (!localStateHydrated) return [];
    return StorageService.getAllPrices().filter((p) => activeItemIds.has(p.itemId));
  }, [
    isAuthenticatedDashboard,
    isFirebaseMode,
    items,
    cloudPriceHistory,
    activeProfile.id,
    localStateHydrated,
    localRevision,
  ]);

  // Fechamentos mensais (snapshots) do perfil ativo
  const activeMonthlyClosures = useMemo<MonthlyClosure[]>(() => {
    if (!isAuthenticatedDashboard) return [];
    if (isFirebaseMode) {
      return cloudMonthlyClosures
        .filter((c) => c.profileId === activeProfile.id)
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    }
    if (!localStateHydrated) return [];
    return [...StorageService.getMonthlyClosures(activeProfile.id)].sort((a, b) =>
      b.monthKey.localeCompare(a.monthKey)
    );
  }, [
    isAuthenticatedDashboard,
    isFirebaseMode,
    cloudMonthlyClosures,
    activeProfile.id,
    localStateHydrated,
    localRevision,
  ]);

  // Histórico de renda efetivo do perfil ativo (só carrega quando logado/demo)
  const activeIncomeHistory = useMemo<IncomeRecord[]>(() => {
    if (!isAuthenticatedDashboard) return [];
    if (isFirebaseMode) {
      return cloudIncomeHistory
        .filter((inc) => inc.profileId === activeProfile.id)
        .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
    }
    if (!localStateHydrated) return [];
    return StorageService.getIncomeHistory(activeProfile.id);
  }, [
    isAuthenticatedDashboard,
    localStateHydrated,
    isFirebaseMode,
    activeProfile.id,
    cloudIncomeHistory,
    localRevision,
  ]);

  // Categorias efetivas conforme a modalidade ativa (preservando edições e categorias customizadas)
  const effectiveGroups = useMemo<ConsumptionGroup[]>(() => {
    const modeDefaults = getDefaultGroupsForMode(activeProfileMode);
    if (!isFirebaseMode) {
      if (!localStateHydrated) return modeDefaults;
      return StorageService.getGroups(activeProfileMode);
    }
    const modeCloudGroups = cloudConsumptionGroups.filter(
      (c) => !c.profileMode || c.profileMode === activeProfileMode
    );
    const mergedDefault = modeDefaults.map(
      (def) => modeCloudGroups.find((c) => c.id === def.id) || def
    );
    const customExtras = modeCloudGroups.filter(
      (c) => !modeDefaults.some((def) => def.id === c.id)
    );
    return [...mergedDefault, ...customExtras];
  }, [isFirebaseMode, activeProfileMode, localStateHydrated, localRevision, cloudConsumptionGroups]);

  // Estratégias efetivas do perfil ativo
  const activePlansA = useMemo<SubstitutePlanA[]>(() => {
    if (!isAuthenticatedDashboard) return [];
    if (isFirebaseMode) {
      return cloudPlansA.filter((p) => p.profileId === activeProfile.id);
    }
    if (!localStateHydrated) return [];
    return StorageService.getPlansA(activeProfile.id);
  }, [isAuthenticatedDashboard, isFirebaseMode, cloudPlansA, activeProfile.id, localStateHydrated, localRevision]);

  const activePlansB = useMemo<EfficiencyPlanB[]>(() => {
    if (!isAuthenticatedDashboard) return [];
    if (isFirebaseMode) {
      return cloudPlansB.filter((p) => p.profileId === activeProfile.id);
    }
    if (!localStateHydrated) return [];
    return StorageService.getPlansB(activeProfile.id);
  }, [isAuthenticatedDashboard, isFirebaseMode, cloudPlansB, activeProfile.id, localStateHydrated, localRevision]);

  const activePlanC = useMemo<OpportunityPlanC | undefined>(() => {
    if (!isAuthenticatedDashboard) return undefined;
    if (isFirebaseMode) {
      return cloudPlansC.find((p) => p.profileId === activeProfile.id);
    }
    if (!localStateHydrated) return undefined;
    return StorageService.getPlanC(activeProfile.id) ?? undefined;
  }, [isAuthenticatedDashboard, isFirebaseMode, cloudPlansC, activeProfile.id, localStateHydrated, localRevision]);

  // Cálculo econômico executado apenas no painel autenticado/demo (zero valores fabricados)
  const summary = useMemo(() => {
    if (!isAuthenticatedDashboard) return null;
    const initialIncome =
      activeIncomeHistory.length > 0 ? activeIncomeHistory[0].nominalIncome : null;
    const finalIncome =
      activeIncomeHistory.length > 0
        ? activeIncomeHistory[activeIncomeHistory.length - 1].nominalIncome
        : null;
    const dateInitial =
      activeIncomeHistory.length > 0
        ? activeIncomeHistory[0].referenceDate
        : getMonthsAgoIsoDate(12);
    const dateFinal =
      activeIncomeHistory.length > 0
        ? activeIncomeHistory[activeIncomeHistory.length - 1].referenceDate
        : getTodayIsoDate();
    const officialBenchmark = getOfficialBenchmarkForTimeframe(ibgeMetadata, selectedTimeframe);
    const officialRateForWindow =
      ibgeMetadata && Number.isFinite(officialBenchmark.rate)
        ? officialBenchmark.rate
        : 0;
    return processBasketEconomics(
      items,
      officialRateForWindow,
      initialIncome,
      finalIncome,
      dateInitial,
      dateFinal,
      selectedTimeframe,
      {
        priceHistory: activePriceHistory,
        incomeRecords: activeIncomeHistory,
        isDemo,
        profile: activeProfile,
        profileMode: activeProfileMode,
      }
    );
  }, [
    isAuthenticatedDashboard,
    items,
    activePriceHistory,
    activeIncomeHistory,
    ibgeMetadata,
    selectedTimeframe,
    isDemo,
    activeProfile,
    activeProfileMode,
  ]);

  // Abertura automática do questionário inicial apenas para perfis ainda não iniciados ou em andamento
  useEffect(() => {
    if (
      !isAuthenticatedDashboard ||
      isDemo ||
      !currentUser ||
      needsTermsAcceptanceGate ||
      isMigrationModalOpen ||
      isAuthModalOpen ||
      isOnboardingOpen
    ) {
      return;
    }
    if (isFirebaseMode && (!cloudProfilesReady || !cloudItemsReady || !cloudIncomeReady)) {
      return;
    }
    if (autoPromptedOnboardingRef.current.has(activeProfile.id)) {
      return;
    }

    const status = activeProfile.onboardingStatus;
    const needsOnboarding =
      status === 'not_started' ||
      status === 'in_progress' ||
      (!status &&
        items.length === 0 &&
        activeIncomeHistory.length === 0 &&
        !activeProfile.questionnaireData);

    if (needsOnboarding) {
      autoPromptedOnboardingRef.current.add(activeProfile.id);
      setIsOnboardingEditMode(false);
      setIsOnboardingOpen(true);
    }
  }, [
    isAuthenticatedDashboard,
    isDemo,
    currentUser,
    needsTermsAcceptanceGate,
    isMigrationModalOpen,
    isAuthModalOpen,
    isOnboardingOpen,
    isFirebaseMode,
    cloudProfilesReady,
    cloudItemsReady,
    cloudIncomeReady,
    activeProfile.id,
    activeProfile.onboardingStatus,
    activeProfile.questionnaireData,
    items.length,
    activeIncomeHistory.length,
  ]);

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

  // Handler de Sucesso de Autenticação (Google + E-mail/Senha verificado)
  const handleAuthSuccess = (user: UserAccount, isNewUser = false) => {
    setCurrentUser(user);
    setFirebaseUid(user.id);
    setActiveCloudProfileId(user.profileId);
    setPendingVerificationEmail(null);
    setIsDemo(false);
    setAuthModalError(null);
    setIsAuthModalOpen(false);
    setIsAuthInitializing(false);

    const method = user.authProvider === 'google' ? 'google' : 'email_password';
    if (isNewUser) {
      trackSignUp(method);
    } else {
      trackLogin(method);
    }

    runLegacyScanForUser(user.id);

    if (isNewUser) {
      setIsOnboardingEditMode(false);
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

  // Handler de Logout completo
  const handleLogout = async () => {
    try {
      await AuthService.logout();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      console.warn(`Erro ao encerrar sessão Firebase (${msg})`);
    }
    scannedLegacyUidRef.current = null;
    autoPromptedOnboardingRef.current.clear();
    setFirebaseUid(null);
    setCurrentUser(null);
    setPendingVerificationEmail(null);
    setIsDemo(false);
    setNeedsTermsAcceptanceGate(false);
    setTermsGateCheckbox(false);
    setDashboardLegalDoc(null);
    setIsOnboardingOpen(false);
    setIsOnboardingEditMode(false);
    setIsMigrationModalOpen(false);
    setPendingLegacyBundle(null);
    setCloudProfiles([]);
    setCloudItems([]);
    setCloudIncomeHistory([]);
    setCloudPriceHistory([]);
    setCloudConsumptionGroups([]);
    setCloudPlansA([]);
    setCloudPlansB([]);
    setCloudPlansC([]);
    setCloudMonthlyClosures([]);
    setCloudProfilesReady(false);
    setCloudItemsReady(false);
    setCloudIncomeReady(false);
    setLocalItems([]);
    setLocalProfiles([SHELL_FALLBACK_PROFILE]);
    setLocalActiveProfile(SHELL_FALLBACK_PROFILE);
    setLocalStateHydrated(false);
    setActiveCloudProfileId('');
    setGlobalSearchTerm('');
    setActiveTab('visao-geral');
    navigateUrl('/', true);
  };

  // Handler após exclusão definitiva da conta pelo titular (LGPD Art. 18, VI)
  const handleAccountDeleted = useCallback(() => {
    scannedLegacyUidRef.current = null;
    autoPromptedOnboardingRef.current.clear();
    setFirebaseUid(null);
    setCurrentUser(null);
    setPendingVerificationEmail(null);
    setIsDemo(false);
    setNeedsTermsAcceptanceGate(false);
    setTermsGateCheckbox(false);
    setDashboardLegalDoc(null);
    setIsOnboardingOpen(false);
    setIsOnboardingEditMode(false);
    setIsMigrationModalOpen(false);
    setPendingLegacyBundle(null);
    setCloudProfiles([]);
    setCloudItems([]);
    setCloudIncomeHistory([]);
    setCloudPriceHistory([]);
    setCloudConsumptionGroups([]);
    setCloudPlansA([]);
    setCloudPlansB([]);
    setCloudPlansC([]);
    setCloudMonthlyClosures([]);
    setCloudProfilesReady(false);
    setCloudItemsReady(false);
    setCloudIncomeReady(false);
    setLocalItems([]);
    setLocalProfiles([SHELL_FALLBACK_PROFILE]);
    setLocalActiveProfile(SHELL_FALLBACK_PROFILE);
    setLocalStateHydrated(false);
    setActiveCloudProfileId('');
    setGlobalSearchTerm('');
    setActiveTab('visao-geral');
    navigateUrl('/', true);
    addToast('success', 'Conta e dados excluídos permanentemente da nuvem.');
  }, [navigateUrl, addToast]);

  // Confirmação do gate pós-login de Termos e Privacidade
  const handleConfirmTermsGate = async () => {
    if (!firebaseUid || !termsGateCheckbox) {
      setTermsGateError(
        'Marque a caixa de concordância com os Termos de Uso e a Política de Privacidade para continuar.'
      );
      return;
    }
    setTermsGateError(null);
    setTermsGateSaving(true);
    try {
      const { FirestoreService } = await import('./services/firestore');
      await FirestoreService.recordTermsAcceptance(firebaseUid, {
        termsVersion: TERMS_VERSION,
        policyVersion: POLICY_VERSION,
        acceptanceMethod: 'post_login_gate',
      });
      setNeedsTermsAcceptanceGate(false);
      setTermsGateCheckbox(false);
      addToast('success', 'Aceite dos Termos de Uso e Política de Privacidade registrado.');
    } catch {
      setTermsGateError('Não foi possível registrar o aceite no momento. Tente novamente.');
    } finally {
      setTermsGateSaving(false);
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

  // Alternância para Cenário Demonstrativo por Modalidade (isolado por perfil demo)
  const handleSwitchToDemoBasket = useCallback(
    (mode: ProfileMode = 'pessoal') => {
      StorageService.loadDemoBasket(mode);
      if (firebaseUid) {
        setIsDemo(true);
      }
      const demoId =
        mode === 'negocio'
          ? 'profile-demo-negocio'
          : mode === 'estudante'
            ? 'profile-demo-estudante'
            : 'profile-demo';
      const demoProfile =
        StorageService.getProfiles().find((p) => p.id === demoId) ||
        StorageService.getProfiles().find((p) => p.isDemo) ||
        StorageService.getProfiles()[0];
      hydrateLocalState(demoProfile.id);
      handleSelectDashboardTab('visao-geral');
    },
    [firebaseUid, hydrateLocalState, handleSelectDashboardTab]
  );

  // Salvar Rascunho do Questionário Inicial (retomada sem perder respostas)
  const handleSaveOnboardingDraft = useCallback(
    async (draftProfile: FamilyProfile) => {
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.saveQuestionnaireDraft(firebaseUid, draftProfile);
          setActiveCloudProfileId(draftProfile.id);
        } else {
          StorageService.saveProfile(draftProfile);
          hydrateLocalState(draftProfile.id);
        }
        setIsOnboardingOpen(false);
        setIsOnboardingEditMode(false);
        addToast('info', 'Progresso do questionário salvo para você continuar quando quiser.');
      } catch (err) {
        addToast('error', 'Não foi possível salvar o rascunho do questionário.');
        throw err;
      }
    },
    [isFirebaseMode, firebaseUid, hydrateLocalState, addToast]
  );

  // Pular Questionário Inicial mantendo histórico intacto
  const handleSkipOnboarding = useCallback(async () => {
    const wasEditing = isOnboardingEditMode;
    setIsOnboardingOpen(false);
    setIsOnboardingEditMode(false);
    if (!wasEditing && activeProfile.onboardingStatus !== 'completed') {
      const skippedProfile: FamilyProfile = {
        ...activeProfile,
        onboardingStatus: 'skipped',
        updatedAt: new Date().toISOString(),
      };
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.saveProfile(firebaseUid, skippedProfile);
        } else {
          StorageService.saveProfile(skippedProfile);
          hydrateLocalState(skippedProfile.id);
        }
      } catch {
        // Silencioso para não impedir o usuário de avançar ao painel
      }
      handleSelectDashboardTab('visao-geral');
    }
  }, [
    isOnboardingEditMode,
    activeProfile,
    isFirebaseMode,
    firebaseUid,
    hydrateLocalState,
    handleSelectDashboardTab,
  ]);

  // Conclusão do Questionário Inicial / Atualização via Configurações
  const handleFinishOnboarding = async (newProfile: FamilyProfile, bundle?: OnboardingBundle) => {
    const prefill = bundle?.prefillBundle;
    const wasEditing = isOnboardingEditMode;
    if (isFirebaseMode && firebaseUid && bundle) {
      try {
        const { FirestoreService } = await import('./services/firestore');
        await FirestoreService.saveOnboardingBundle({
          userId: firebaseUid,
          profile: newProfile,
          initialIncome: bundle.initialIncome,
          currentIncome: bundle.currentIncome,
          incomeRecords: prefill?.incomeRecords,
          consumptionGroups: prefill?.consumptionGroups,
          items: bundle.items,
          priceRecords: prefill?.priceRecords,
        });
        setActiveCloudProfileId(newProfile.id);
        setIsOnboardingOpen(false);
        setIsOnboardingEditMode(false);
        if (prefill?.useDemoBasket && !wasEditing) {
          handleSwitchToDemoBasket(resolveProfileMode(newProfile.profileMode));
          addToast(
            'success',
            'Questionário salvo na sua conta e cesta de demonstração carregada para exploração!'
          );
        } else {
          setActiveTab('visao-geral');
          navigateUrl('/painel/visao-geral', true);
          addToast(
            'success',
            wasEditing
              ? 'Respostas atualizadas sem duplicar seus registros existentes!'
              : 'Questionário concluído e painel pré-preenchido com segurança no Cloud Firestore!'
          );
        }
      } catch (err) {
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Erro ao salvar configuração inicial no Firestore.';
        addToast('error', msg);
        throw err;
      }
    } else {
      setIsOnboardingOpen(false);
      setIsOnboardingEditMode(false);
      if (prefill?.useDemoBasket && !wasEditing) {
        handleSwitchToDemoBasket(resolveProfileMode(newProfile.profileMode));
        addToast('success', 'Cesta de demonstração carregada para exploração!');
      } else {
        hydrateLocalState(newProfile.id);
        setActiveTab('visao-geral');
        addToast(
          'success',
          wasEditing
            ? 'Questionário atualizado com sucesso!'
            : 'Questionário inicial configurado com sucesso!'
        );
      }
    }
  };

  // Salvar/Editar Item
  const handleSaveItem = useCallback(
    async (itemData: Partial<BasketItem>) => {
      let savedItem: BasketItem;
      const nowIso = new Date().toISOString();
      const fallbackGroup = getDefaultGroupsForMode(activeProfileMode)[0]?.name || 'Outros';

      if (editingItem) {
        savedItem = {
          ...editingItem,
          ...itemData,
          profileId: editingItem.profileId || activeProfile.id,
          profileMode: editingItem.profileMode || activeProfileMode,
          updatedAt: nowIso,
        };
      } else {
        savedItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          profileId: activeProfile.id,
          profileMode: activeProfileMode,
          name: itemData.name || 'Novo Item',
          description: itemData.description,
          group: itemData.group || fallbackGroup,
          classification: itemData.classification || 'Essencial',
          monthlySpend: Number(itemData.monthlySpend) || 0,
          oldPrice: Number(itemData.oldPrice) || 0,
          currentPrice: Number(itemData.currentPrice) || 0,
          oldPriceDate: itemData.oldPriceDate || getMonthsAgoIsoDate(12),
          currentPriceDate: itemData.currentPriceDate || getTodayIsoDate(),
          unit: itemData.unit || 'unidade',
          quantity: itemData.quantity,
          consumptionFrequency: itemData.consumptionFrequency,
          expenseNature: itemData.expenseNature,
          ...(itemData.supplierName ? { supplierName: itemData.supplierName } : {}),
          ...(typeof itemData.paidDirectly === 'boolean'
            ? { paidDirectly: itemData.paidDirectly }
            : {}),
          notes: itemData.notes || '',
          active: itemData.active !== false,
          isArchived: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      }

      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.saveBasketItem(firebaseUid, savedItem, true);
        } else {
          StorageService.saveItem(savedItem);
          setLocalItems(StorageService.getItems(activeProfile.id));
          bumpLocalRevision();
        }
        setEditingItem(null);
        addToast(
          'success',
          editingItem
            ? `Item "${savedItem.name}" atualizado com sucesso.`
            : `Item "${savedItem.name}" adicionado à cesta.`
        );
      } catch (err) {
        addToast('error', 'Não foi possível salvar o item da cesta.');
        throw err;
      }
    },
    [
      editingItem,
      activeProfile.id,
      activeProfileMode,
      isFirebaseMode,
      firebaseUid,
      bumpLocalRevision,
      addToast,
    ]
  );

  // Excluir/Arquivar Item
  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.archiveBasketItem(firebaseUid, itemId);
        } else {
          StorageService.deleteItem(itemId);
          setLocalItems(StorageService.getItems(activeProfile.id));
          bumpLocalRevision();
        }
        addToast('info', 'Item removido da cesta ativa.');
      } catch (err) {
        addToast('error', 'Não foi possível excluir o item.');
        throw err;
      }
    },
    [activeProfile.id, isFirebaseMode, firebaseUid, bumpLocalRevision, addToast]
  );

  // Atualização Rápida de Preço
  const handleUpdatePrice = useCallback(
    async (itemId: string, newPrice: number, referenceDate: string, note?: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      const updatedItem: BasketItem = {
        ...item,
        currentPrice: newPrice,
        currentPriceDate: referenceDate,
        updatedAt: new Date().toISOString(),
      };

      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.addPriceRecord(firebaseUid, {
            profileId: activeProfile.id,
            itemId,
            price: newPrice,
            referenceDate,
            unit: item.unit || 'un',
            supplierName: item.supplierName,
            source: note || 'Atualização Rápida no Painel',
          });
          await FirestoreService.saveBasketItem(firebaseUid, updatedItem, false);
        } else {
          StorageService.addPriceRecord({
            itemId,
            price: newPrice,
            referenceDate,
            unit: item.unit || 'un',
            supplierName: item.supplierName,
            origin: note || 'Atualização Rápida no Painel',
          });
          StorageService.saveItem(updatedItem);
          setLocalItems(StorageService.getItems(activeProfile.id));
          bumpLocalRevision();
        }
        addToast(
          'success',
          `Preço de "${item.name}" atualizado para R$ ${newPrice.toFixed(2).replace('.', ',')}.`
        );
      } catch (err) {
        addToast('error', 'Erro ao salvar atualização de preço.');
        throw err;
      }
    },
    [items, activeProfile.id, isFirebaseMode, firebaseUid, bumpLocalRevision, addToast]
  );

  // Adicionar cotação histórica via PriceHistoryView
  const handleAddPriceRecordFromView = useCallback(
    async (record: {
      itemId: string;
      price: number;
      referenceDate: string;
      unit?: string;
      packageSize?: number;
      packageUnit?: string;
      origin?: string;
      supplierName?: string;
    }) => {
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.addPriceRecord(firebaseUid, {
            profileId: activeProfile.id,
            itemId: record.itemId,
            price: record.price,
            referenceDate: record.referenceDate,
            unit: record.unit,
            packageSize: record.packageSize,
            packageUnit: record.packageUnit,
            supplierName: record.supplierName,
            source: record.origin,
            origin: record.origin,
          });
        } else {
          StorageService.addPriceRecord(record);
          setLocalItems(StorageService.getItems(activeProfile.id));
          bumpLocalRevision();
        }
        addToast('success', 'Cotação histórica registrada com sucesso.');
      } catch (err) {
        addToast('error', 'Falha ao registrar cotação no histórico.');
        throw err;
      }
    },
    [isFirebaseMode, firebaseUid, activeProfile.id, bumpLocalRevision, addToast]
  );

  // Editar cotação histórica via PriceHistoryView
  const handleUpdatePriceRecord = useCallback(
    async (priceId: string, updated: Partial<PriceRecord>) => {
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.updatePriceRecord(firebaseUid, priceId, updated);
          const targetRec = cloudPriceHistory.find((p) => p.id === priceId);
          if (targetRec && updated.price !== undefined) {
            const itemPrices = cloudPriceHistory
              .map((p) => (p.id === priceId ? { ...p, ...updated } : p))
              .filter((p) => p.itemId === targetRec.itemId)
              .sort((a, b) => b.referenceDate.localeCompare(a.referenceDate));
            if (itemPrices[0]?.id === priceId) {
              const targetItem = cloudItems.find((i) => i.id === targetRec.itemId);
              if (targetItem) {
                await FirestoreService.saveBasketItem(
                  firebaseUid,
                  {
                    ...targetItem,
                    currentPrice: updated.price,
                    currentPriceDate: updated.referenceDate || targetItem.currentPriceDate,
                    updatedAt: new Date().toISOString(),
                  },
                  false
                );
              }
            }
          }
        } else {
          StorageService.updatePriceRecord(priceId, updated);
          setLocalItems(StorageService.getItems(activeProfile.id));
          bumpLocalRevision();
        }
        addToast('success', 'Registro de preço atualizado.');
      } catch (err) {
        addToast('error', 'Falha ao atualizar cotação.');
        throw err;
      }
    },
    [
      isFirebaseMode,
      firebaseUid,
      cloudPriceHistory,
      cloudItems,
      activeProfile.id,
      bumpLocalRevision,
      addToast,
    ]
  );

  // Excluir cotação histórica via PriceHistoryView
  const handleDeletePriceRecord = useCallback(
    async (priceId: string) => {
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.deletePriceRecord(firebaseUid, priceId);
        } else {
          StorageService.deletePriceRecord(priceId);
          setLocalItems(StorageService.getItems(activeProfile.id));
          bumpLocalRevision();
        }
        addToast('info', 'Registro excluído do histórico de preços.');
      } catch (err) {
        addToast('error', 'Não foi possível excluir a cotação.');
        throw err;
      }
    },
    [isFirebaseMode, firebaseUid, activeProfile.id, bumpLocalRevision, addToast]
  );

  // Atualização de Renda
  const handleUpdateIncome = useCallback(
    async (
      initial: number,
      final: number,
      dates?: { initialDate?: string; finalDate?: string }
    ) => {
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.saveIncomeRange(firebaseUid, activeProfile.id, initial, final, dates);
        } else {
          StorageService.saveIncome(initial, final, {
            profileId: activeProfile.id,
            initialDate: dates?.initialDate,
            finalDate: dates?.finalDate,
          });
          setLocalItems([...StorageService.getItems(activeProfile.id)]);
          bumpLocalRevision();
        }
        addToast('success', 'Faixa de renda familiar atualizada.');
      } catch (err) {
        addToast('error', 'Não foi possível salvar os dados de renda.');
        throw err;
      }
    },
    [activeProfile.id, isFirebaseMode, firebaseUid, bumpLocalRevision, addToast]
  );

  // Gerenciamento de Grupos de Consumo por Modalidade
  const handleSaveConsumptionGroup = useCallback(
    async (group: ConsumptionGroup) => {
      const normalizedGroup: ConsumptionGroup = {
        ...group,
        profileMode: group.profileMode || activeProfileMode,
      };
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.saveConsumptionGroup(firebaseUid, normalizedGroup);
        } else {
          StorageService.saveGroup(normalizedGroup);
          bumpLocalRevision();
        }
      } catch (err) {
        addToast('error', 'Erro ao salvar categoria.');
        throw err;
      }
    },
    [activeProfileMode, isFirebaseMode, firebaseUid, bumpLocalRevision, addToast]
  );

  const handleRestoreDefaultGroups = useCallback(async () => {
    try {
      const modeDefaults = getDefaultGroupsForMode(activeProfileMode);
      if (isFirebaseMode && firebaseUid) {
        const { FirestoreService } = await import('./services/firestore');
        await Promise.all(
          modeDefaults.map((def) =>
            FirestoreService.saveConsumptionGroup(firebaseUid, {
              ...def,
              profileMode: activeProfileMode,
            })
          )
        );
      } else {
        StorageService.restoreDefaultGroupsForMode(activeProfileMode);
        bumpLocalRevision();
      }
      addToast('success', 'Categorias padrão da modalidade restauradas sem excluir seus itens.');
    } catch (err) {
      addToast('error', 'Não foi possível restaurar as categorias padrão.');
      throw err;
    }
  }, [activeProfileMode, isFirebaseMode, firebaseUid, bumpLocalRevision, addToast]);

  const handleDeleteConsumptionGroup = useCallback(
    async (groupId: string): Promise<{ success: boolean; message: string }> => {
      if (!isFirebaseMode || !firebaseUid) {
        const res = StorageService.deleteGroup(groupId);
        bumpLocalRevision();
        return res;
      }
      const target = effectiveGroups.find((g) => g.id === groupId);
      if (!target) {
        return { success: false, message: 'Categoria não encontrada.' };
      }

      const fallbackGroup = getDefaultGroupsForMode(activeProfileMode)[0]?.name || 'Outros';
      const { FirestoreService } = await import('./services/firestore');
      const affectedItems = cloudItems.filter(
        (item) =>
          !item.isArchived &&
          item.profileId === activeProfile.id &&
          item.group === target.name
      );
      if (affectedItems.length > 0) {
        await Promise.all(
          affectedItems.map((item) =>
            FirestoreService.saveBasketItem(
              firebaseUid,
              { ...item, group: fallbackGroup, updatedAt: new Date().toISOString() },
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
            ? `Categoria excluída. ${affectedItems.length} itens foram transferidos para "${fallbackGroup}".`
            : 'Categoria excluída com sucesso.',
      };
    },
    [
      isFirebaseMode,
      firebaseUid,
      effectiveGroups,
      activeProfileMode,
      activeProfile.id,
      cloudItems,
      bumpLocalRevision,
    ]
  );

  // CRUD completo das Estratégias A, B e C
  const handleSavePlanA = useCallback(
    async (plan: SubstitutePlanA) => {
      const normalized = { ...plan, profileId: activeProfile.id };
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.saveStrategyPlanA(firebaseUid, normalized);
        } else {
          StorageService.savePlanA(normalized);
          bumpLocalRevision();
        }
        addToast('success', 'Substituição (Plano A) salva.');
      } catch (err) {
        addToast('error', 'Falha ao salvar substituição.');
        throw err;
      }
    },
    [isFirebaseMode, firebaseUid, activeProfile.id, bumpLocalRevision, addToast]
  );

  const handleDeletePlanA = useCallback(
    async (planId: string) => {
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.deleteStrategy(firebaseUid, planId);
        } else {
          StorageService.deletePlanA(planId);
          bumpLocalRevision();
        }
        addToast('info', 'Estratégia do Plano A removida.');
      } catch (err) {
        addToast('error', 'Erro ao excluir estratégia do Plano A.');
        throw err;
      }
    },
    [isFirebaseMode, firebaseUid, bumpLocalRevision, addToast]
  );

  const handleSavePlanB = useCallback(
    async (plan: EfficiencyPlanB) => {
      const normalized = { ...plan, profileId: activeProfile.id };
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.saveStrategyPlanB(firebaseUid, normalized);
        } else {
          StorageService.savePlanB(normalized);
          bumpLocalRevision();
        }
        addToast('success', 'Meta de eficiência (Plano B) salva.');
      } catch (err) {
        addToast('error', 'Falha ao salvar meta do Plano B.');
        throw err;
      }
    },
    [isFirebaseMode, firebaseUid, activeProfile.id, bumpLocalRevision, addToast]
  );

  const handleDeletePlanB = useCallback(
    async (planId: string) => {
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.deleteStrategy(firebaseUid, planId);
        } else {
          StorageService.deletePlanB(planId);
          bumpLocalRevision();
        }
        addToast('info', 'Meta do Plano B removida.');
      } catch (err) {
        addToast('error', 'Erro ao excluir meta do Plano B.');
        throw err;
      }
    },
    [isFirebaseMode, firebaseUid, bumpLocalRevision, addToast]
  );

  const handleSavePlanC = useCallback(
    async (plan: OpportunityPlanC) => {
      const normalized: OpportunityPlanC = {
        ...plan,
        profileId: activeProfile.id,
        id: plan.id || sanitizeFirestoreId(`opp_${activeProfile.id}`, 'opp'),
        isSimulated: false,
      };
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.saveStrategyPlanC(firebaseUid, normalized);
        } else {
          StorageService.savePlanC(normalized);
          bumpLocalRevision();
        }
        addToast('success', 'Simulação de investimento (Plano C) salva.');
      } catch (err) {
        addToast('error', 'Falha ao salvar Plano C.');
        throw err;
      }
    },
    [isFirebaseMode, firebaseUid, activeProfile.id, bumpLocalRevision, addToast]
  );

  const handleDeletePlanC = useCallback(
    async (strategyId?: string) => {
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          const targetId =
            strategyId || activePlanC?.id || sanitizeFirestoreId(`opp_${activeProfile.id}`, 'opp');
          await FirestoreService.deleteStrategy(firebaseUid, targetId);
        } else {
          StorageService.deletePlanC(activeProfile.id);
          bumpLocalRevision();
        }
        addToast('info', 'Alocação do Plano C removida.');
      } catch (err) {
        addToast('error', 'Erro ao excluir Plano C.');
        throw err;
      }
    },
    [isFirebaseMode, firebaseUid, activePlanC?.id, activeProfile.id, bumpLocalRevision, addToast]
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
    try {
      if (isFirebaseMode && firebaseUid) {
        const { FirestoreService } = await import('./services/firestore');
        await Promise.all(
          items.map((item) => FirestoreService.archiveBasketItem(firebaseUid, item.id))
        );
        handleSelectDashboardTab('minha-cesta-familiar');
        addToast('info', 'Itens atuais arquivados. Você pode cadastrar sua cesta do zero.');
      } else {
        StorageService.clearToEmptyBasket();
        hydrateLocalState();
        handleSelectDashboardTab('minha-cesta-familiar');
        addToast('info', 'Cesta iniciada em branco.');
      }
    } catch {
      addToast('error', 'Não foi possível limpar os itens da cesta.');
    }
  }, [isFirebaseMode, firebaseUid, items, hydrateLocalState, handleSelectDashboardTab, addToast]);

  // Alternância não destrutiva de modalidade entre perfis isolados (Pessoal, Negócio, Estudante)
  const handleSwitchModality = useCallback(
    async (targetMode: ProfileMode) => {
      if (isDemo) {
        handleSwitchToDemoBasket(targetMode);
        addToast('info', `Demonstração alternada para a modalidade "${targetMode}".`);
        return;
      }

      const existingTarget = profiles.find(
        (p) => !p.isDemo && resolveProfileMode(p.profileMode) === targetMode
      );

      if (existingTarget) {
        if (isFirebaseMode) {
          setActiveCloudProfileId(existingTarget.id);
        } else {
          hydrateLocalState(existingTarget.id);
        }
        addToast(
          'info',
          `Modalidade alternada para "${existingTarget.name}". Os dados anteriores foram mantidos intactos.`
        );
        return;
      }

      const nowIso = new Date().toISOString();
      const defaultName =
        targetMode === 'negocio'
          ? 'Meu Negócio'
          : targetMode === 'estudante'
            ? 'Perfil Estudante'
            : 'Orçamento Pessoal';

      const newProfile: FamilyProfile = {
        id: sanitizeFirestoreId(`prof_${targetMode}_${Date.now()}`, 'prof'),
        name: defaultName,
        membersCount: targetMode === 'pessoal' ? 2 : 1,
        referenceRegion: activeProfile.referenceRegion || 'Brasil',
        currency: 'BRL',
        profileMode: targetMode,
        onboardingStatus: 'not_started',
        onboardingStep: 1,
        priceAlertThresholdPercent: activeProfile.priceAlertThresholdPercent ?? 10,
        isDemo: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      try {
        autoPromptedOnboardingRef.current.add(newProfile.id);
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.saveProfile(firebaseUid, newProfile);
          setActiveCloudProfileId(newProfile.id);
        } else {
          StorageService.saveProfile(newProfile);
          hydrateLocalState(newProfile.id);
        }
        setIsOnboardingEditMode(false);
        setIsOnboardingOpen(true);
        addToast(
          'success',
          `Novo perfil criado para "${defaultName}" sem apagar seus dados anteriores.`
        );
      } catch (err) {
        addToast('error', 'Não foi possível criar o perfil da nova modalidade.');
        throw err;
      }
    },
    [
      isDemo,
      handleSwitchToDemoBasket,
      profiles,
      isFirebaseMode,
      firebaseUid,
      activeProfile.referenceRegion,
      activeProfile.priceAlertThresholdPercent,
      hydrateLocalState,
      addToast,
    ]
  );

  // Abertura do Histórico de Preços para Item Específico
  const handleViewPriceHistory = useCallback(
    (item: BasketItem) => {
      setSelectedItemForHistory(item);
      handleSelectDashboardTab('precos-e-historico');
    },
    [handleSelectDashboardTab]
  );

  // Importação de Itens (com deduplicação tanto local quanto no Firestore)
  const handleImportItems = useCallback(
    async (imported: BasketItem[]) => {
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          const existingIds = new Set(items.map((it) => it.id));
          const existingSignatures = new Set(items.map((it) => buildDuplicateSignature(it)));
          const seenBatchSignatures = new Set<string>();
          const uniqueToImport: BasketItem[] = [];
          let skippedDuplicates = 0;

          imported.forEach((it, idx) => {
            const sig = buildDuplicateSignature(it);
            const hasDup =
              (it.id && existingIds.has(it.id)) ||
              existingSignatures.has(sig) ||
              seenBatchSignatures.has(sig);
            if (hasDup) {
              skippedDuplicates += 1;
              return;
            }
            seenBatchSignatures.add(sig);
            uniqueToImport.push({
              ...it,
              id: sanitizeFirestoreId(it.id || `item_${Date.now()}_${idx}`, 'item'),
              profileId: activeProfile.id,
              isArchived: false,
              active: it.active !== false,
            });
          });

          if (uniqueToImport.length > 0) {
            await Promise.all(
              uniqueToImport.map((it) => FirestoreService.saveBasketItem(firebaseUid, it, false))
            );
          }

          if (skippedDuplicates > 0) {
            addToast(
              'info',
              `${uniqueToImport.length} itens importados (${skippedDuplicates} duplicados ignorados).`
            );
          }
        } else {
          const result = StorageService.importItems(imported, activeProfile.id);
          setLocalItems(StorageService.getItems(activeProfile.id));
          bumpLocalRevision();
          if (result.skippedDuplicates > 0) {
            addToast(
              'info',
              `${result.importedCount} itens importados (${result.skippedDuplicates} duplicados ignorados).`
            );
          }
        }
      } catch (err) {
        addToast('error', 'Não foi possível concluir a importação dos itens.');
        throw err;
      }
    },
    [activeProfile.id, isFirebaseMode, firebaseUid, items, bumpLocalRevision, addToast]
  );

  // Fechamentos Mensais (Snapshots)
  const handleSaveMonthlyClosure = useCallback(
    async (closure: MonthlyClosure, allowOverwrite = false) => {
      const normalized: MonthlyClosure = {
        ...closure,
        profileId: activeProfile.id,
      };
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.saveMonthlyClosure(firebaseUid, normalized);
          addToast('success', `Fechamento de ${normalized.monthLabel} salvo no Cloud Firestore.`);
        } else {
          const res = StorageService.saveMonthlyClosure(normalized, allowOverwrite);
          if (!res.success && res.requiresOverwriteConfirmation) {
            addToast('info', 'Já existe fechamento para esta competência; confirme a substituição.');
            return;
          }
          bumpLocalRevision();
          addToast('success', `Fechamento de ${normalized.monthLabel} salvo com sucesso.`);
        }
      } catch (err) {
        addToast('error', 'Não foi possível salvar o fechamento mensal.');
        throw err;
      }
    },
    [activeProfile.id, isFirebaseMode, firebaseUid, bumpLocalRevision, addToast]
  );

  const handleDeleteMonthlyClosure = useCallback(
    async (closureId: string) => {
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.deleteMonthlyClosure(firebaseUid, closureId);
        } else {
          StorageService.deleteMonthlyClosure(closureId);
          bumpLocalRevision();
        }
        addToast('info', 'Fechamento mensal removido.');
      } catch (err) {
        addToast('error', 'Não foi possível excluir o fechamento mensal.');
        throw err;
      }
    },
    [isFirebaseMode, firebaseUid, bumpLocalRevision, addToast]
  );

  // Gerenciamento Multi-Perfil Familiar
  const handleUpdateProfile = useCallback(
    async (updatedProfile: FamilyProfile) => {
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.saveProfile(firebaseUid, updatedProfile);
        } else {
          StorageService.saveProfile(updatedProfile);
          setLocalActiveProfile(updatedProfile);
          setLocalProfiles(StorageService.getProfiles());
          bumpLocalRevision();
        }
        addToast('success', `Perfil "${updatedProfile.name}" atualizado.`);
      } catch (err) {
        addToast('error', 'Erro ao atualizar perfil.');
        throw err;
      }
    },
    [isFirebaseMode, firebaseUid, bumpLocalRevision, addToast]
  );

  const handleUpdateAlertThreshold = useCallback(
    async (threshold: number) => {
      const safeThreshold = Math.max(1, Math.min(100, Math.round(threshold * 10) / 10));
      await handleUpdateProfile({
        ...activeProfile,
        priceAlertThresholdPercent: safeThreshold,
        updatedAt: new Date().toISOString(),
      });
    },
    [activeProfile, handleUpdateProfile]
  );

  const handleCreateProfile = useCallback(
    async (params: {
      name: string;
      membersCount: number;
      referenceRegion: string;
      profileMode?: ProfileMode;
      priceAlertThresholdPercent?: number;
    }) => {
      const nowIso = new Date().toISOString();
      const newProfile: FamilyProfile = {
        id: sanitizeFirestoreId(`prof_${Date.now()}`, 'prof'),
        name: params.name.trim() || 'Novo Perfil',
        membersCount: Math.max(1, Math.min(50, Math.round(params.membersCount) || 2)),
        referenceRegion: params.referenceRegion || 'Brasil',
        currency: 'BRL',
        profileMode: resolveProfileMode(params.profileMode),
        priceAlertThresholdPercent: params.priceAlertThresholdPercent ?? 10,
        isDemo: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.saveProfile(firebaseUid, newProfile);
          setActiveCloudProfileId(newProfile.id);
        } else {
          StorageService.saveProfile(newProfile);
          hydrateLocalState(newProfile.id);
        }
        addToast('success', `Perfil "${newProfile.name}" criado e ativado.`);
      } catch (err) {
        addToast('error', 'Não foi possível criar o novo perfil.');
        throw err;
      }
    },
    [isFirebaseMode, firebaseUid, hydrateLocalState, addToast]
  );

  const handleDeleteProfile = useCallback(
    async (profileId: string) => {
      if (profiles.length <= 1) {
        addToast('error', 'Não é possível excluir o único perfil existente da conta.');
        return;
      }
      try {
        if (isFirebaseMode && firebaseUid) {
          const { FirestoreService } = await import('./services/firestore');
          await FirestoreService.deleteProfile(firebaseUid, profileId);
          if (activeProfile.id === profileId) {
            const nextProf = profiles.find((p) => p.id !== profileId);
            setActiveCloudProfileId(nextProf?.id || currentUser?.profileId || '');
          }
          addToast('info', 'Perfil familiar e registros vinculados removidos.');
        } else {
          const res = StorageService.deleteProfile(profileId);
          if (!res.success) {
            addToast('error', res.message);
            return;
          }
          hydrateLocalState();
          addToast('info', res.message);
        }
      } catch (err) {
        addToast('error', 'Erro ao excluir o perfil selecionado.');
        throw err;
      }
    },
    [
      profiles,
      isFirebaseMode,
      firebaseUid,
      activeProfile.id,
      currentUser?.profileId,
      hydrateLocalState,
      addToast,
    ]
  );

  // Limpeza completa LGPD
  const handleWipeAllUserData = useCallback(async () => {
    try {
      if (isFirebaseMode && firebaseUid) {
        const { FirestoreService } = await import('./services/firestore');
        await FirestoreService.deleteAllUserFinancialData(firebaseUid, currentUser?.displayName);
        setActiveCloudProfileId(
          currentUser?.profileId || sanitizeFirestoreId(`prof_${firebaseUid}`, 'prof')
        );
        addToast('success', 'Todos os seus dados financeiros foram apagados do Cloud Firestore.');
      } else {
        StorageService.resetToDemoData();
        hydrateLocalState('profile-demo');
        addToast('info', 'Cenário de demonstração restaurado para o estado inicial.');
      }
    } catch (err) {
      addToast('error', 'Não foi possível apagar os dados financeiros.');
      throw err;
    }
  }, [isFirebaseMode, firebaseUid, currentUser?.displayName, currentUser?.profileId, hydrateLocalState, addToast]);

  // Rota efetiva para SeoHeadManager (garante que área logada e demo sejam sempre noindex)
  const effectiveSeoPath = useMemo(() => {
    if (isAuthenticatedDashboard) {
      return isDemo ? '/demo' : `/painel/${activeTab}`;
    }
    return routePath;
  }, [isAuthenticatedDashboard, isDemo, activeTab, routePath]);

  const openLoginModal = useCallback(() => {
    setAuthModalMode(pendingVerificationEmail ? 'verify-email' : 'login');
    setAuthModalError(null);
    setIsAuthModalOpen(true);
  }, [pendingVerificationEmail]);

  const openRegisterModal = useCallback(() => {
    setAuthModalMode('register');
    setAuthModalError(null);
    setIsAuthModalOpen(true);
  }, []);

  const isProtectedDashboardRoute =
    normalizeRoutePath(routePath) === '/painel' ||
    normalizeRoutePath(routePath).startsWith('/painel/');

  // GATE DE INICIALIZAÇÃO DA SESSÃO EM ROTAS PRIVADAS (/painel*)
  if (!currentUser && !isDemo && isAuthInitializing && isProtectedDashboardRoute) {
    return (
      <>
        <SeoHeadManager currentPath="/painel/visao-geral" />
        <PageChunkFallback label="Verificando sessão autenticada..." />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

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
          onOpenTerms={() => navigateUrl('/termos')}
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
            )) ||
            (cleanPublicPath === '/termos' && (
              <Suspense fallback={<PageChunkFallback />}>
                <TermsPublicPage onNavigate={(path) => navigateUrl(path)} />
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

        <AnalyticsConsentBanner
          onOpenPrivacy={() => navigateUrl('/privacidade')}
          authenticatedUserId={isFirebaseMode ? firebaseUid : null}
        />

        {isAuthModalOpen && (
          <Suspense fallback={null}>
            <AuthModal
              isOpen={isAuthModalOpen}
              initialMode={authModalMode}
              initialError={authModalError}
              pendingVerificationEmail={pendingVerificationEmail}
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

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // AMBIENTE DO DASHBOARD (LOGADO OU MODO DEMONSTRAÇÃO - SEMPRE NOINDEX)
  const effectiveSummary = summary!;

  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <SeoHeadManager currentPath={effectiveSeoPath} />

      <Suspense fallback={<div className="hidden md:block w-72 shrink-0 bg-[#ffffff] border-r border-[#eff4ff]" />}>
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
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          profileMode={activeProfileMode}
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
                  type="button"
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
                  type="button"
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
                type="button"
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
            summary={effectiveSummary}
            searchTerm={globalSearchTerm}
            onSearchChange={(val) => {
              setGlobalSearchTerm(val);
              if (
                val.trim() &&
                activeTab !== 'minha-cesta-familiar' &&
                activeTab !== 'precos-e-historico'
              ) {
                handleSelectDashboardTab('minha-cesta-familiar');
              }
            }}
            onCreateProfile={() => handleSelectDashboardTab('configuracoes')}
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
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            profileMode={activeProfileMode}
          />
        </Suspense>

        {/* Visão Ativa */}
        <main className="flex-1 pb-16">
          <ErrorBoundary fallbackTitle="Falha ao carregar a visão do painel">
            <Suspense fallback={<PageChunkFallback label="Carregando módulo analítico..." />}>
            {activeTab === 'visao-geral' && (
              <OverviewView
                summary={effectiveSummary}
                ibgeData={ibgeMetadata}
                onNavigateTab={handleSelectDashboardTab}
                onOpenNewItem={() => {
                  setEditingItem(null);
                  setIsNewItemDrawerOpen(true);
                }}
                onOpenQuickPrice={() => setIsQuickPriceOpen(true)}
                isDemo={isDemo}
                profileMode={activeProfileMode}
                activeProfile={activeProfile}
                priceRecords={activePriceHistory}
                monthlyClosures={activeMonthlyClosures}
                alertThresholdPercent={alertThresholdPercent}
                onUpdateAlertThreshold={handleUpdateAlertThreshold}
              />
            )}

            {activeTab === 'impacto-no-bolso' && (
              <PocketImpactView
                summary={effectiveSummary}
                activeProfile={activeProfile}
                onUpdateIncome={handleUpdateIncome}
                isDemo={isDemo}
                profileMode={activeProfileMode}
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
                    bumpLocalRevision();
                  }
                }}
                isDemo={isDemo}
                groups={effectiveGroups}
                onSaveGroup={handleSaveConsumptionGroup}
                onDeleteGroup={handleDeleteConsumptionGroup}
                onRestoreDefaultGroups={handleRestoreDefaultGroups}
                externalSearchTerm={globalSearchTerm}
                onExternalSearchChange={setGlobalSearchTerm}
                profileMode={activeProfileMode}
              />
            )}

            {activeTab === 'precos-e-historico' && (
              <PriceHistoryView
                summary={effectiveSummary}
                onRefreshData={() => {
                  if (!isFirebaseMode) {
                    setLocalItems(StorageService.getItems(activeProfile.id));
                    bumpLocalRevision();
                  }
                }}
                isDemo={isDemo}
                profileMode={activeProfileMode}
                suppliers={activeProfile.suppliers || []}
                selectedItemForHistory={selectedItemForHistory}
                priceRecords={activePriceHistory}
                onAddPriceRecord={handleAddPriceRecordFromView}
                onUpdatePriceRecord={handleUpdatePriceRecord}
                onDeletePriceRecord={handleDeletePriceRecord}
              />
            )}

            {activeTab === 'analise-da-inflacao' && (
              <InflationAnalysisView
                summary={effectiveSummary}
                ibgeData={ibgeMetadata}
                activeTimeframe={selectedTimeframe}
                onSelectTimeframe={setSelectedTimeframe}
                onNavigateTab={handleSelectDashboardTab}
                isDemo={isDemo}
                profileMode={activeProfileMode}
              />
            )}

            {activeTab === 'renda-e-poder-de-compra' && (
              <PurchasingPowerView
                summary={effectiveSummary}
                activeProfile={activeProfile}
                onUpdateIncome={handleUpdateIncome}
                onOpenQuestionnaire={() => {
                  setIsOnboardingEditMode(true);
                  setIsOnboardingOpen(true);
                }}
                isDemo={isDemo}
                profileMode={activeProfileMode}
              />
            )}

            {activeTab === 'estrategias-de-economia' && (
              <SavingStrategiesView
                summary={effectiveSummary}
                isDemo={isDemo}
                activeProfileId={activeProfile.id}
                profileMode={activeProfileMode}
                plansA={activePlansA}
                plansB={activePlansB}
                planC={activePlanC}
                onSavePlanA={handleSavePlanA}
                onDeletePlanA={handleDeletePlanA}
                onSavePlanB={handleSavePlanB}
                onDeletePlanB={handleDeletePlanB}
                onSavePlanC={handleSavePlanC}
                onDeletePlanC={handleDeletePlanC}
                onNavigateTab={handleSelectDashboardTab}
              />
            )}

            {activeTab === 'relatorios' && (
              <ReportsView
                summary={effectiveSummary}
                activeProfile={activeProfile}
                ibgeData={ibgeMetadata}
                isDemo={isDemo}
                profileMode={activeProfileMode}
                monthlyClosures={activeMonthlyClosures}
                onSaveMonthlyClosure={handleSaveMonthlyClosure}
                onDeleteMonthlyClosure={handleDeleteMonthlyClosure}
              />
            )}

            {activeTab === 'configuracoes' && (
              <SettingsView
                activeProfile={activeProfile}
                profiles={profiles}
                currentUser={currentUser}
                ibgeData={ibgeMetadata}
                monthlyClosures={activeMonthlyClosures}
                onUpdateProfile={handleUpdateProfile}
                onSelectProfile={(profileId) => {
                  if (isFirebaseMode) {
                    setActiveCloudProfileId(profileId);
                  } else {
                    hydrateLocalState(profileId);
                  }
                }}
                onCreateProfile={handleCreateProfile}
                onDeleteProfile={handleDeleteProfile}
                onWipeAllUserData={handleWipeAllUserData}
                onSwitchToEmptyBasket={handleRequestEmptyBasket}
                onSwitchToDemoBasket={handleSwitchToDemoBasket}
                onSwitchModality={handleSwitchModality}
                onOpenQuestionnaire={() => {
                  setIsOnboardingEditMode(true);
                  setIsOnboardingOpen(true);
                }}
                onNotify={addToast}
                isDemo={isDemo}
                isFirebaseMode={isFirebaseMode}
                dataCounts={{
                  profiles: profiles.length,
                  items: isFirebaseMode ? cloudItems.length : items.length,
                  prices: isFirebaseMode ? cloudPriceHistory.length : activePriceHistory.length,
                  incomes: isFirebaseMode ? cloudIncomeHistory.length : activeIncomeHistory.length,
                  strategies:
                    (isFirebaseMode
                      ? cloudPlansA.length + cloudPlansB.length + cloudPlansC.length
                      : activePlansA.length + activePlansB.length + (activePlanC ? 1 : 0)),
                  closures: isFirebaseMode ? cloudMonthlyClosures.length : activeMonthlyClosures.length,
                }}
                onAccountDeleted={handleAccountDeleted}
                onOpenPrivacyPolicy={() => setDashboardLegalDoc('privacy')}
                onExportBackupData={
                  isFirebaseMode
                    ? () => ({
                        profile: activeProfile,
                        profiles,
                        groups: effectiveGroups,
                        items,
                        prices: cloudPriceHistory,
                        income: activeIncomeHistory,
                        monthlyClosures: activeMonthlyClosures,
                        plansA: activePlansA,
                        plansB: activePlansB,
                        planC: activePlanC,
                        exportedAt: new Date().toISOString(),
                        version: '3.4.0-firebase',
                      })
                    : undefined
                }
                onRefreshData={() => {
                  IBGEService.getMetadata('N1[all]', true)
                    .then((meta) => {
                      setIbgeMetadata(meta);
                      const isLive = meta.sourceMode === 'live' && !meta.isContingencyData;
                      const isCached = meta.sourceMode === 'cached_live' && !meta.isContingencyData;
                      addToast(
                        isLive ? 'success' : 'info',
                        isLive
                          ? 'Série oficial IBGE atualizada em tempo real.'
                          : isCached
                          ? 'SIDRA instável no momento; exibindo dados oficiais em cache.'
                          : 'SIDRA indisponível no momento; exibindo série de contingência offline.'
                      );
                    })
                    .catch(() => {
                      addToast('error', 'Falha ao consultar API SIDRA/IBGE.');
                    });
                  if (!isFirebaseMode) {
                    setLocalItems(StorageService.getItems(activeProfile.id));
                    bumpLocalRevision();
                  }
                }}
              />
            )}
          </Suspense>
        </ErrorBoundary>

          {/* Faixa discreta de privacidade e termos no rodapé do painel */}
          <footer className="max-w-[1440px] mx-auto px-6 lg:px-12 pt-4 pb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#76777d]">
            <span>IPCA-Casa • Privacidade e Governança de Dados (LGPD)</span>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={openCookiePreferencesModal}
                className="hover:text-[#0b1c30] underline cursor-pointer"
              >
                Preferências de Cookies
              </button>
              <button
                type="button"
                onClick={() => setDashboardLegalDoc('privacy')}
                className="hover:text-[#0b1c30] underline cursor-pointer"
              >
                Política de Privacidade
              </button>
              <button
                type="button"
                onClick={() => setDashboardLegalDoc('terms')}
                className="hover:text-[#0b1c30] underline cursor-pointer"
              >
                Termos de Uso
              </button>
            </div>
          </footer>
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
            groups={effectiveGroups}
            profileMode={activeProfileMode}
            suppliers={activeProfile.suppliers || []}
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
            activeProfileId={activeProfile.id}
            profileMode={activeProfileMode}
            onImportItems={handleImportItems}
            onNotify={addToast}
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
                ? 'Deseja arquivar os itens atuais desta cesta e recomeçar do zero?'
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
            pendingVerificationEmail={pendingVerificationEmail}
            onClose={() => {
              setIsAuthModalOpen(false);
              setAuthModalError(null);
            }}
            onSuccess={handleAuthSuccess}
            onEnterDemo={handleEnterDemo}
          />
        </Suspense>
      )}

      {(currentUser || (!isFirebaseMode && !isDemo)) && isOnboardingOpen && (
        <Suspense fallback={null}>
          <OnboardingModal
            isOpen={isOnboardingOpen && !isMigrationModalOpen}
            userId={firebaseUid || 'local'}
            userDisplayName={currentUser?.displayName || activeProfile.name || 'Usuário'}
            targetProfileId={activeProfile.id}
            initialProfile={activeProfile}
            initialMode={isOnboardingEditMode ? activeProfileMode : activeProfile.profileMode}
            allowModalitySelection={!isOnboardingEditMode}
            isEditingFromSettings={isOnboardingEditMode}
            existingGroups={effectiveGroups}
            existingItems={items}
            existingIncomeRecords={activeIncomeHistory}
            existingPriceRecords={activePriceHistory}
            skipLocalPersistence={isFirebaseMode}
            onSaveDraft={handleSaveOnboardingDraft}
            onFinish={handleFinishOnboarding}
            onSkip={handleSkipOnboarding}
          />
        </Suspense>
      )}

      {firebaseUid && isMigrationModalOpen && pendingLegacyBundle && (
        <Suspense fallback={null}>
          <LegacyMigrationModal
            isOpen={isMigrationModalOpen}
            bundle={pendingLegacyBundle}
            targetUser={currentUser}
            onConfirmMigrate={async (bundle) => {
              const { FirestoreService } = await import('./services/firestore');
              await FirestoreService.migrateLegacyBundle(
                firebaseUid,
                bundle,
                currentUser?.profileId || activeProfile.id
              );
              LegacyMigrationService.clearMigratedLocalData(firebaseUid);
              setPendingLegacyBundle(null);
              setIsMigrationModalOpen(false);
              setIsOnboardingOpen(false);
              addToast('success', 'Registros locais migrados com segurança para o Cloud Firestore.');
            }}
            onDiscardLegacy={() => setIsConfirmDiscardLegacyOpen(true)}
            onPostpone={() => {
              LegacyMigrationService.markDismissedForUser(firebaseUid);
              setIsMigrationModalOpen(false);
            }}
          />
        </Suspense>
      )}

      {isConfirmDiscardLegacyOpen && firebaseUid && (
        <Suspense fallback={null}>
          <ConfirmModal
            isOpen={isConfirmDiscardLegacyOpen}
            title="Descartar Dados Locais Legados"
            message="Essa ação removerá os dados financeiros locais antigos armazenados apenas neste navegador sem enviá-los à nuvem. Os dados já salvos na sua conta do Cloud Firestore permanecerão intactos."
            confirmLabel="Sim, Descartar Dados Locais"
            cancelLabel="Voltar"
            isDestructive={true}
            onConfirm={() => {
              LegacyMigrationService.clearMigratedLocalData(firebaseUid);
              setPendingLegacyBundle(null);
              setIsMigrationModalOpen(false);
              setIsConfirmDiscardLegacyOpen(false);
              addToast('info', 'Dados locais legados removidos deste navegador.');
            }}
            onCancel={() => setIsConfirmDiscardLegacyOpen(false)}
          />
        </Suspense>
      )}

      {needsTermsAcceptanceGate && currentUser && isFirebaseMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lgpd-terms-gate-title"
          className="fixed inset-0 bg-[#213145]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-[#ffffff] rounded-2xl max-w-lg w-full shadow-2xl border border-[#eff4ff] p-6 flex flex-col gap-4">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-[#006a61]">
                Atualização de Governança e Privacidade (LGPD)
              </span>
              <h2 id="lgpd-terms-gate-title" className="text-lg font-bold text-[#0b1c30] mt-1">
                Confirme os Termos de Uso e a Política de Privacidade
              </h2>
              <p className="text-xs text-[#45464d] mt-1 leading-relaxed">
                Para manter o registro formal do seu aceite nas versões atuais (Termos {TERMS_VERSION} • Política {POLICY_VERSION}), leia os documentos e confirme sua concordância abaixo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDashboardLegalDoc('privacy')}
                className="px-3 py-1.5 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-xs font-mono font-semibold text-[#0b1c30] cursor-pointer"
              >
                Ler Política de Privacidade
              </button>
              <button
                type="button"
                onClick={() => setDashboardLegalDoc('terms')}
                className="px-3 py-1.5 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-xs font-mono font-semibold text-[#0b1c30] cursor-pointer"
              >
                Ler Termos de Uso
              </button>
            </div>

            {termsGateError && (
              <div className="p-3 rounded-xl bg-[#ffdad6]/50 border border-[#ba1a1a]/30 text-xs font-mono text-[#ba1a1a]">
                {termsGateError}
              </div>
            )}

            <label className="flex items-start gap-2.5 text-xs text-[#45464d] cursor-pointer p-3 rounded-xl bg-[#f8f9ff] border border-[#dce9ff]">
              <input
                type="checkbox"
                checked={termsGateCheckbox}
                onChange={(e) => setTermsGateCheckbox(e.target.checked)}
                className="mt-0.5 rounded border-[#c6c6cd] text-[#006a61] focus:ring-[#006a61]"
              />
              <span>
                Li e concordo com os <strong>Termos de Uso ({TERMS_VERSION})</strong> e com a{' '}
                <strong>Política de Privacidade ({POLICY_VERSION})</strong> do IPCA-Casa.
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#eff4ff]">
              <button
                type="button"
                disabled={termsGateSaving}
                onClick={handleLogout}
                className="h-9 px-4 rounded-lg bg-[#eff4ff] text-[#45464d] hover:text-[#ba1a1a] text-xs font-semibold cursor-pointer"
              >
                Cancelar e Sair
              </button>
              <button
                type="button"
                disabled={termsGateSaving || !termsGateCheckbox}
                onClick={handleConfirmTermsGate}
                className="h-9 px-4 rounded-lg bg-[#000000] hover:bg-[#213145] text-[#ffffff] text-xs font-mono font-semibold cursor-pointer disabled:opacity-50"
              >
                {termsGateSaving ? 'Registrando aceite...' : 'Concordar e Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dashboardLegalDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-legal-doc-title"
          className="fixed inset-0 bg-[#213145]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-[#f8f9ff] rounded-2xl max-w-4xl w-full max-h-[88vh] shadow-2xl border border-[#eff4ff] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-[#ffffff] border-b border-[#eff4ff] flex items-center justify-between gap-3">
              <h2 id="dashboard-legal-doc-title" className="text-sm font-bold text-[#0b1c30]">
                {dashboardLegalDoc === 'privacy'
                  ? 'Política de Privacidade — IPCA-Casa'
                  : 'Termos de Uso — IPCA-Casa'}
              </h2>
              <button
                type="button"
                onClick={() => setDashboardLegalDoc(null)}
                className="h-8 px-3 rounded-lg bg-[#000000] text-[#ffffff] text-xs font-mono font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <Suspense fallback={<PageChunkFallback />}>
                {dashboardLegalDoc === 'privacy' ? (
                  <PrivacyPublicPage
                    onNavigate={(target) => {
                      if (target === '/termos') {
                        setDashboardLegalDoc('terms');
                      } else {
                        setDashboardLegalDoc(null);
                      }
                    }}
                  />
                ) : (
                  <TermsPublicPage
                    onNavigate={(target) => {
                      if (target === '/privacidade') {
                        setDashboardLegalDoc('privacy');
                      } else {
                        setDashboardLegalDoc(null);
                      }
                    }}
                  />
                )}
              </Suspense>
            </div>
          </div>
        </div>
      )}

      <AnalyticsConsentBanner
        onOpenPrivacy={() => setDashboardLegalDoc('privacy')}
        authenticatedUserId={isFirebaseMode ? firebaseUid : null}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
