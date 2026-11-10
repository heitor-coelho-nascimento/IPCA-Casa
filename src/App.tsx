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
import { OnboardingModal } from './components/OnboardingModal';
import { NewItemDrawer } from './components/NewItemDrawer';
import { QuickPriceModal } from './components/QuickPriceModal';
import { ImportExportModal } from './components/ImportExportModal';
import { startGoogleOAuthPopup } from './components/GoogleSignInButton';
import { signOutFirebase } from './lib/firebase';
import { BasketItem, FamilyProfile, UserAccount } from './types';
import { StorageService } from './services/storage';
import { AuthService } from './services/auth';
import { processBasketEconomics } from './services/economics';
import { IBGEService } from './services/ibge';

function getAuthHeaders(): HeadersInit {
  const token = AuthService.getActiveToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

export default function App() {
  // Autenticação & Sessão
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => AuthService.getCurrentUser());
  const [isDemo, setIsDemo] = useState<boolean>(false);

  // Modais de Autenticação e Onboarding
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'recover' | 'terms'>('login');
  const [authModalError, setAuthModalError] = useState<string | null>(null);
  const [googleLandingLoading, setGoogleLandingLoading] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Navegação
  const [activeTab, setActiveTab] = useState<NavTab>('visao-geral');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Perfil da família
  const [activeProfile, setActiveProfile] = useState<FamilyProfile>(() => StorageService.getProfile());
  const [profiles, setProfiles] = useState<FamilyProfile[]>(() => StorageService.getProfiles());

  // Cesta de itens
  const [items, setItems] = useState<BasketItem[]>(() => StorageService.getItems());

  // Período selecionado
  const [selectedTimeframe, setSelectedTimeframe] = useState<'12M' | 'YTD' | '1M'>('12M');

  // Modais e gavetas
  const [isNewItemDrawerOpen, setIsNewItemDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BasketItem | null>(null);
  const [isQuickPriceOpen, setIsQuickPriceOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<BasketItem | null>(null);

  // Sincronizar dados do usuário autenticado com o backend (MySQL quando configurado)
  const syncUserAccountData = useCallback(async (user: UserAccount) => {
    try {
      const headers = getAuthHeaders();
      const [profRes, basketRes, incomeRes] = await Promise.all([
        fetch(`/api/profiles`, { headers, credentials: 'include' }),
        fetch(`/api/basket?profileId=${encodeURIComponent(user.profileId)}`, { headers, credentials: 'include' }),
        fetch(`/api/income?profileId=${encodeURIComponent(user.profileId)}`, { headers, credentials: 'include' }),
      ]);

      if (profRes.ok) {
        const remoteProfiles = (await profRes.json()) as FamilyProfile[];
        if (Array.isArray(remoteProfiles)) {
          const ownProfile = remoteProfiles.find((p) => p.id === user.profileId);
          if (ownProfile) {
            StorageService.saveProfile(ownProfile);
            setActiveProfile(ownProfile);
          }
          setProfiles(StorageService.getProfiles());
        }
      }

      if (basketRes.ok) {
        const remoteItems = (await basketRes.json()) as BasketItem[];
        if (Array.isArray(remoteItems) && remoteItems.length > 0) {
          StorageService.setActiveProfileId(user.profileId);
          StorageService.importItems(remoteItems);
          setItems(StorageService.getItems(user.profileId));
        }
      }

      if (incomeRes.ok) {
        const remoteIncome = (await incomeRes.json()) as Array<{ nominalIncome: number }>;
        if (Array.isArray(remoteIncome) && remoteIncome.length > 0) {
          StorageService.setActiveProfileId(user.profileId);
          StorageService.saveIncome(
            remoteIncome[0].nominalIncome,
            remoteIncome[remoteIncome.length - 1].nominalIncome
          );
        }
      }
    } catch (err) {
      console.warn('Sincronização com repositório remoto indisponível no momento:', err);
    }
  }, []);

  // Inicializar IBGE em segundo plano e restaurar sessão no servidor caso cookie esteja ativo
  useEffect(() => {
    IBGEService.getOfficialSeries().catch((err) => {
      console.warn('Sincronização em segundo plano do IBGE:', err);
    });

    const restoreSession = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.user) {
          const user = data.user as UserAccount;
          const existingToken = AuthService.getActiveToken() || '';
          AuthService.setSession({ user, token: existingToken });
          setCurrentUser(user);

          const userProfile = StorageService.getProfiles().find((p) => p.id === user.profileId) || {
            id: user.profileId,
            name: user.displayName,
            membersCount: 2,
            referenceRegion: 'Brasil',
            currency: 'BRL',
            isDemo: false,
            createdAt: user.createdAt,
            updatedAt: new Date().toISOString(),
          };
          StorageService.saveProfile(userProfile);
          StorageService.setActiveProfileId(userProfile.id);
          setActiveProfile(userProfile);
          setProfiles(StorageService.getProfiles());
          setItems(StorageService.getItems(userProfile.id));
          await syncUserAccountData(user);
        }
      } catch {
        // Segue normalmente com sessão local caso servidor esteja indisponível
      }
    };

    restoreSession();
  }, [syncUserAccountData]);

  // Cálculo da economia com base nos dados atuais
  const summary = useMemo(() => {
    const incomes = StorageService.getIncomeHistory(activeProfile.id);
    const initialIncome = incomes.length > 0 ? incomes[0].nominalIncome : isDemo ? 10000 : null;
    const finalIncome = incomes.length > 0 ? incomes[incomes.length - 1].nominalIncome : isDemo ? 10500 : null;
    return processBasketEconomics(items, 4.68, initialIncome, finalIncome);
  }, [items, activeProfile.id, isDemo]);

  // Handler de Sucesso de Autenticação
  const handleAuthSuccess = (user: UserAccount, isNewUser = false) => {
    setCurrentUser(user);
    setIsDemo(false);
    setAuthModalError(null);

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
    setActiveProfile(userProfile);
    setProfiles(StorageService.getProfiles());
    setItems(StorageService.getItems(userProfile.id));

    syncUserAccountData(user);

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
        AuthService.setSession(result.session);
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
    setCurrentUser(null);
    setIsDemo(false);
    setActiveTab('visao-geral');
    await signOutFirebase();
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Ignora erro de rede no encerramento local
    }
  };

  // Handler de Entrada no Modo Demonstração
  const handleEnterDemo = () => {
    setIsDemo(true);
    setCurrentUser(null);
    const demoProfile = StorageService.getProfiles().find((p) => p.isDemo) || StorageService.getProfiles()[0];
    StorageService.setActiveProfileId(demoProfile.id);
    setActiveProfile(demoProfile);
    setItems(StorageService.getItems(demoProfile.id));
    setActiveTab('visao-geral');
  };

  // Conclusão do Onboarding
  const handleFinishOnboarding = (newProfile: FamilyProfile) => {
    setIsOnboardingOpen(false);
    setActiveProfile(newProfile);
    setProfiles(StorageService.getProfiles());
    const onboardingItems = StorageService.getItems(newProfile.id);
    setItems(onboardingItems);
    setActiveTab('impacto-no-bolso');

    if (currentUser && !isDemo) {
      const headers = getAuthHeaders();
      fetch('/api/profiles', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(newProfile),
      }).catch(() => {});

      const incomes = StorageService.getIncomeHistory(newProfile.id);
      if (incomes.length > 0) {
        fetch('/api/income', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            profileId: newProfile.id,
            initialIncome: incomes[0].nominalIncome,
            finalIncome: incomes[incomes.length - 1].nominalIncome,
          }),
        }).catch(() => {});
      }

      onboardingItems.forEach((it) => {
        fetch('/api/basket', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(it),
        }).catch(() => {});
      });
    }
  };

  // Salvar/Editar Item
  const handleSaveItem = useCallback((itemData: Partial<BasketItem>) => {
    let savedItem: BasketItem;
    if (editingItem) {
      const updated: BasketItem = {
        ...editingItem,
        ...itemData,
        updatedAt: new Date().toISOString(),
      };
      savedItem = StorageService.saveItem(updated);
      setItems(StorageService.getItems(activeProfile.id));
      setEditingItem(null);
    } else {
      const newItem: BasketItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      savedItem = StorageService.saveItem(newItem);
      setItems(StorageService.getItems(activeProfile.id));
    }

    if (currentUser && !isDemo) {
      fetch('/api/basket', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(savedItem),
      }).catch(() => {});
    }
  }, [editingItem, activeProfile.id, currentUser, isDemo]);

  // Excluir Item
  const handleDeleteItem = useCallback((itemId: string) => {
    StorageService.deleteItem(itemId);
    setItems(StorageService.getItems(activeProfile.id));

    if (currentUser && !isDemo) {
      fetch(`/api/basket/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      }).catch(() => {});
    }
  }, [activeProfile.id, currentUser, isDemo]);

  // Atualização Rápida de Preço
  const handleUpdatePrice = useCallback((itemId: string, newPrice: number, referenceDate: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    StorageService.addPriceRecord({
      itemId,
      price: newPrice,
      referenceDate,
      unit: item.unit || 'un',
      origin: 'Atualização Rápida no Painel',
    });

    const updatedItem: BasketItem = {
      ...item,
      currentPrice: newPrice,
      currentPriceDate: referenceDate,
      updatedAt: new Date().toISOString(),
    };
    StorageService.saveItem(updatedItem);
    setItems(StorageService.getItems(activeProfile.id));

    if (currentUser && !isDemo) {
      fetch('/api/basket', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(updatedItem),
      }).catch(() => {});
    }
  }, [items, activeProfile.id, currentUser, isDemo]);

  // Atualização de Renda
  const handleUpdateIncome = useCallback((initial: number, final: number) => {
    StorageService.saveIncome(initial, final);
    setItems([...StorageService.getItems(activeProfile.id)]);

    if (currentUser && !isDemo) {
      fetch('/api/income', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          profileId: activeProfile.id,
          initialIncome: initial,
          finalIncome: final,
        }),
      }).catch(() => {});
    }
  }, [activeProfile.id, currentUser, isDemo]);

  // Alternância para Cesta Vazia
  const handleSwitchToEmptyBasket = useCallback(() => {
    if (confirm('Deseja iniciar uma cesta em branco? Os itens atuais serão preservados no histórico.')) {
      StorageService.clearToEmptyBasket();
      setItems([]);
      setActiveTab('minha-cesta-familiar');
    }
  }, []);

  // Alternância para Cenário Demonstrativo
  const handleSwitchToDemoBasket = useCallback(() => {
    StorageService.loadDemoBasket();
    setItems(StorageService.getItems(activeProfile.id));
    setActiveTab('visao-geral');
  }, [activeProfile.id]);

  // Abertura do Histórico de Preços para Item Específico
  const handleViewPriceHistory = useCallback((item: BasketItem) => {
    setSelectedItemForHistory(item);
    setActiveTab('precos-e-historico');
  }, []);

  // Importação de Itens
  const handleImportItems = useCallback((imported: BasketItem[]) => {
    StorageService.importItems(imported);
    const updatedList = StorageService.getItems(activeProfile.id);
    setItems(updatedList);

    if (currentUser && !isDemo) {
      updatedList.forEach((it) => {
        fetch('/api/basket', {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify(it),
        }).catch(() => {});
      });
    }
  }, [activeProfile.id, currentUser, isDemo]);

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
          userAvatarUrl={currentUser?.avatarUrl}
          onSelectProfile={(profileId) => {
            const found = profiles.find((p) => p.id === profileId);
            if (found) {
              StorageService.setActiveProfileId(profileId);
              setActiveProfile(found);
              setItems(StorageService.getItems(profileId));
            }
          }}
          onCreateProfile={() => {
            const name = prompt('Nome do novo perfil orçamentário:');
            if (name) {
              const newProf: FamilyProfile = {
                id: `prof-${Date.now()}`,
                name,
                referenceRegion: 'Brasil',
                currency: 'BRL',
                membersCount: 2,
                isDemo: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              StorageService.saveProfile(newProf);
              setActiveProfile(newProf);
              setProfiles(StorageService.getProfiles());
              if (currentUser && !isDemo) {
                fetch('/api/profiles', {
                  method: 'POST',
                  headers: getAuthHeaders(),
                  credentials: 'include',
                  body: JSON.stringify(newProf),
                }).catch(() => {});
              }
            }
          }}
          selectedTimeframe={selectedTimeframe}
          onSelectTimeframe={setSelectedTimeframe}
          onNavigateToSettings={() => setActiveTab('configuracoes')}
          onSwitchToEmptyBasket={handleSwitchToEmptyBasket}
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

          {activeTab === 'ipca-oficial' && (
            <OfficialIPCAView onNavigateTab={setActiveTab} />
          )}

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
              isDemo={isDemo}
            />
          )}

          {activeTab === 'precos-e-historico' && (
            <PriceHistoryView
              summary={summary}
              onRefreshData={() => setItems(StorageService.getItems(activeProfile.id))}
              isDemo={isDemo}
              selectedItemForHistory={selectedItemForHistory}
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
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'relatorios' && (
            <ReportsView summary={summary} isDemo={isDemo} />
          )}

          {activeTab === 'configuracoes' && (
            <SettingsView
              activeProfile={activeProfile}
              currentUser={currentUser}
              onUpdateProfile={(updatedProfile) => {
                setActiveProfile(updatedProfile);
                if (currentUser && !isDemo) {
                  fetch('/api/profiles', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    credentials: 'include',
                    body: JSON.stringify(updatedProfile),
                  }).catch(() => {});
                }
              }}
              onSwitchToEmptyBasket={handleSwitchToEmptyBasket}
              onSwitchToDemoBasket={handleSwitchToDemoBasket}
              isDemo={isDemo}
              onRefreshData={() => setItems(StorageService.getItems(activeProfile.id))}
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
