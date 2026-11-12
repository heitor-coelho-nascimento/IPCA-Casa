import React, { useState } from 'react';
import { FamilyProfile, BasketItem, ProfileMode } from '../types';
import { DEMO_BASKET_ITEMS, StorageService } from '../services/storage';
import { getMonthsAgoIsoDate, getTodayIsoDate } from '../utils/dates';

export interface OnboardingBundle {
  initialIncome: number;
  currentIncome: number;
  items: BasketItem[];
}

interface OnboardingModalProps {
  isOpen: boolean;
  userDisplayName: string;
  targetProfileId?: string;
  skipLocalPersistence?: boolean;
  onFinish: (profile: FamilyProfile, bundle?: OnboardingBundle) => void | Promise<void>;
  onSkip: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  userDisplayName,
  targetProfileId,
  skipLocalPersistence = false,
  onFinish,
  onSkip,
}) => {
  const [step, setStep] = useState<number>(1);

  // Step 1: Perfil e Modo
  const [profileMode, setProfileMode] = useState<ProfileMode>('pessoal');
  const [profileName, setProfileName] = useState(`Orçamento de ${userDisplayName}`);
  const [membersCount, setMembersCount] = useState(3);

  // Step 2: Renda / Faturamento
  const [initialIncome, setInitialIncome] = useState<number>(6000);
  const [currentIncome, setCurrentIncome] = useState<number>(6500);

  // Step 3: Gastos / Custos principais rápidos
  const [groceriesSpend, setGroceriesSpend] = useState<number>(1800);
  const [housingSpend, setHousingSpend] = useState<number>(2000);
  const [transportSpend, setTransportSpend] = useState<number>(800);

  // Step 4: Região de referência para o IBGE
  const [region, setRegion] = useState('Brasil');

  // Step 5: Escolha da Cesta
  const [basketChoice, setBasketChoice] = useState<'empty' | 'copy-demo'>('copy-demo');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isBiz = profileMode === 'negocio';

  const handleComplete = async () => {
    if (saving) return;
    setErrorMsg(null);

    const safeInitial = Number.isFinite(initialIncome) && initialIncome > 0 ? initialIncome : 0;
    const safeCurrent = Number.isFinite(currentIncome) && currentIncome >= 0 ? currentIncome : 0;
    if (safeInitial <= 0) {
      setErrorMsg(
        isBiz
          ? 'Informe uma entrada mensal base maior que zero para acompanhar a margem.'
          : 'Informe uma renda inicial maior que zero para calcular o poder de compra.'
      );
      setStep(2);
      return;
    }

    setSaving(true);
    try {
      const profileId = targetProfileId || `prof_user_${Date.now()}`;
      const nowIso = new Date().toISOString();
      const baseDateIso = getMonthsAgoIsoDate(12);
      const currentDateIso = getTodayIsoDate();

      const newProfile: FamilyProfile = {
        id: profileId,
        name: profileName.trim() || `Orçamento de ${userDisplayName}`,
        membersCount: Math.max(1, Math.min(20, Math.round(membersCount) || 1)),
        referenceRegion: region,
        currency: 'BRL',
        profileMode,
        priceAlertThresholdPercent: 10,
        isDemo: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const stamp = Date.now();
      let onboardingItems: BasketItem[];
      if (basketChoice === 'copy-demo') {
        onboardingItems = DEMO_BASKET_ITEMS.map((item, idx) => ({
          ...item,
          id: `item-usr-${stamp}-${idx}`,
          profileId,
          oldPriceDate: baseDateIso,
          currentPriceDate: currentDateIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        }));
      } else {
        onboardingItems = [
          {
            id: `item-ob-1-${stamp}`,
            profileId,
            name: isBiz ? 'Insumos e Matéria-Prima Principal' : 'Supermercado & Alimentação Básica',
            group: 'Alimentação e bebidas',
            classification: 'Essencial',
            monthlySpend: Math.max(0, groceriesSpend || 0),
            oldPrice: 100,
            currentPrice: 108,
            oldPriceDate: baseDateIso,
            currentPriceDate: currentDateIso,
            unit: 'mensal',
            dataOrigin: 'estimado',
            active: true,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: `item-ob-2-${stamp}`,
            profileId,
            name: isBiz
              ? 'Estrutura Física (Aluguel / Energia / Água)'
              : 'Habitação (Aluguel / Condomínio / Luz / Água)',
            group: 'Habitação',
            classification: 'Essencial',
            monthlySpend: Math.max(0, housingSpend || 0),
            oldPrice: 100,
            currentPrice: 106,
            oldPriceDate: baseDateIso,
            currentPriceDate: currentDateIso,
            unit: 'mensal',
            dataOrigin: 'estimado',
            active: true,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: `item-ob-3-${stamp}`,
            profileId,
            name: isBiz
              ? 'Logística, Entregas e Combustível'
              : 'Transporte (Combustível / Transporte Público)',
            group: 'Transportes',
            classification: 'Essencial',
            monthlySpend: Math.max(0, transportSpend || 0),
            oldPrice: 100,
            currentPrice: 105,
            oldPriceDate: baseDateIso,
            currentPriceDate: currentDateIso,
            unit: 'mensal',
            dataOrigin: 'estimado',
            active: true,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ];
      }

      if (!skipLocalPersistence) {
        StorageService.saveProfile(newProfile);
        StorageService.setActiveProfileId(profileId);
        StorageService.saveIncome(safeInitial, safeCurrent, {
          profileId,
          initialDate: baseDateIso,
          finalDate: currentDateIso,
        });
        StorageService.importItems(onboardingItems, profileId);
      }

      await onFinish(newProfile, {
        initialIncome: safeInitial,
        currentIncome: safeCurrent,
        items: onboardingItems,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível concluir o salvamento inicial. Tente novamente.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#213145]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#ffffff] rounded-2xl max-w-lg w-full shadow-2xl p-6 flex flex-col gap-6 border border-[#eff4ff]">
        {/* Progress Bar & Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono text-[#76777d]">
            <span>Passo {step} de 5</span>
            <button
              onClick={onSkip}
              className="text-[#45464d] hover:text-[#0b1c30] underline cursor-pointer"
            >
              Pular e explorar agora
            </button>
          </div>
          <div className="w-full bg-[#eff4ff] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#000000] h-full transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-[#ffdad6]/50 border border-[#ba1a1a]/30 text-xs font-mono text-[#ba1a1a]">
              {errorMsg}
            </div>
          )}
        </div>

        {/* STEP 1: Perfil e Modo de Uso */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#0b1c30]">1. Como você vai usar o IPCA-Casa?</h2>
              <p className="text-xs text-[#45464d] mt-1">
                Escolha o estilo de acompanhamento que faz mais sentido para sua rotina. Você pode mudar depois.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setProfileMode('pessoal')}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  profileMode === 'pessoal'
                    ? 'border-[#000000] bg-[#eff4ff]/70'
                    : 'border-[#eff4ff] hover:border-[#c6c6cd]'
                }`}
              >
                <span className="text-xs font-bold text-[#0b1c30] block">Uso Pessoal / Casa</span>
                <span className="text-[11px] text-[#45464d] block mt-0.5 leading-snug">
                  Compras do mês, contas da casa e quanto o salário rende.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setProfileMode('negocio')}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  profileMode === 'negocio'
                    ? 'border-[#000000] bg-[#eff4ff]/70'
                    : 'border-[#eff4ff] hover:border-[#c6c6cd]'
                }`}
              >
                <span className="text-xs font-bold text-[#0b1c30] block">Pequeno Negócio</span>
                <span className="text-[11px] text-[#45464d] block mt-0.5 leading-snug">
                  Insumos, ingredientes, custos operacionais e impacto na margem.
                </span>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-[#45464d]">
                {isBiz ? 'Nome do Negócio ou Operação:' : 'Nome do Perfil Familiar:'}
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-semibold text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-[#45464d]">
                {isBiz ? 'Pessoas / Unidades envolvidas:' : 'Quantidade de Moradores / Integrantes:'}
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={membersCount}
                onChange={(e) => setMembersCount(parseInt(e.target.value, 10) || 1)}
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-mono text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Renda / Faturamento */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#0b1c30]">
                {isBiz ? '2. Faturamento Mensal de Referência' : '2. Renda Familiar e Salário'}
              </h2>
              <p className="text-xs text-[#45464d] mt-1">
                {isBiz
                  ? 'Usamos esses valores para mostrar quanto da sua entrada mensal está sendo consumida pela alta dos insumos.'
                  : 'Fundamental para calcular o impacto em Reais e a variação real do seu poder de compra.'}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-[#45464d]">
                {isBiz ? 'Faturamento Mensal no Início do Período (R$):' : 'Renda Mensal no Início do Período (R$):'}
              </label>
              <input
                type="number"
                step="100"
                value={initialIncome}
                onChange={(e) => setInitialIncome(parseFloat(e.target.value) || 0)}
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-mono text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
              <span className="text-[11px] text-[#76777d]">
                {isBiz ? 'Entrada mensal de referência (ex.: há 1 ano)' : 'Salário líquido ou bruto de referência (ex: há 1 ano)'}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-[#45464d]">
                {isBiz ? 'Faturamento Mensal Atual (R$):' : 'Renda Mensal Atual (R$):'}
              </label>
              <input
                type="number"
                step="100"
                value={currentIncome}
                onChange={(e) => setCurrentIncome(parseFloat(e.target.value) || 0)}
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-mono text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
              <span className="text-[11px] text-[#76777d]">
                {isBiz ? 'Entrada atual para acompanhar a sobra após custos' : 'Salário atual para comparar reajuste vs inflação'}
              </span>
            </div>
          </div>
        )}

        {/* STEP 3: Principais Gastos / Custos */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#0b1c30]">
                {isBiz ? '3. Principais Custos da Operação' : '3. Principais Gastos Domésticos'}
              </h2>
              <p className="text-xs text-[#45464d] mt-1">
                Estime os valores aproximados das 3 categorias mais pesadas no mês.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-[#45464d]">
                {isBiz ? 'Insumos, Ingredientes e Mercadorias (R$/mês):' : 'Alimentação & Supermercado (R$/mês):'}
              </label>
              <input
                type="number"
                step="50"
                value={groceriesSpend}
                onChange={(e) => setGroceriesSpend(parseFloat(e.target.value) || 0)}
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-mono text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-[#45464d]">
                {isBiz
                  ? 'Aluguel do Ponto, Luz, Água e Gás (R$/mês):'
                  : 'Habitação (Aluguel, Luz, Água, Condomínio) (R$/mês):'}
              </label>
              <input
                type="number"
                step="50"
                value={housingSpend}
                onChange={(e) => setHousingSpend(parseFloat(e.target.value) || 0)}
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-mono text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-[#45464d]">
                {isBiz ? 'Entregas, Frete e Combustível (R$/mês):' : 'Transporte (Combustível, Transporte Público) (R$/mês):'}
              </label>
              <input
                type="number"
                step="50"
                value={transportSpend}
                onChange={(e) => setTransportSpend(parseFloat(e.target.value) || 0)}
                className="h-10 px-3.5 rounded-lg border border-[#c6c6cd] text-xs font-mono text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              />
            </div>
          </div>
        )}

        {/* STEP 4: Região de Comparação */}
        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#0b1c30]">4. Localidade para Comparação</h2>
              <p className="text-xs text-[#45464d] mt-1">
                Permite contrastar a variação dos seus custos com os índices oficiais da sua região.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-[#45464d]">Sua Região / Capital:</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="h-10 px-3 rounded-lg border border-[#c6c6cd] text-xs font-semibold text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#000000]"
              >
                <option value="Brasil">Brasil (Média Nacional)</option>
                <option value="São Paulo - SP">São Paulo - SP</option>
                <option value="Rio de Janeiro - RJ">Rio de Janeiro - RJ</option>
                <option value="Belo Horizonte - MG">Belo Horizonte - MG</option>
                <option value="Porto Alegre - RS">Porto Alegre - RS</option>
                <option value="Curitiba - PR">Curitiba - PR</option>
                <option value="Salvador - BA">Salvador - BA</option>
                <option value="Recife - PE">Recife - PE</option>
                <option value="Fortaleza - CE">Fortaleza - CE</option>
                <option value="Brasília - DF">Brasília - DF</option>
                <option value="Goiânia - GO">Goiânia - GO</option>
                <option value="Belém - PA">Belém - PA</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 5: Escolha da Cesta */}
        {step === 5 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#0b1c30]">5. Como prefere iniciar?</h2>
              <p className="text-xs text-[#45464d] mt-1">
                Você pode começar com itens de exemplo para explorar os gráficos ou usar apenas os 3 valores informados agora.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div
                onClick={() => setBasketChoice('copy-demo')}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                  basketChoice === 'copy-demo'
                    ? 'border-[#000000] bg-[#eff4ff]/60'
                    : 'border-[#eff4ff] hover:border-[#c6c6cd]'
                }`}
              >
                <div>
                  <span className="text-xs font-bold text-[#0b1c30] block">
                    Copiar Lista de Exemplo (Recomendado)
                  </span>
                  <span className="text-[11px] text-[#76777d]">
                    Inclui {DEMO_BASKET_ITEMS.length} itens demonstrativos que você poderá editar, excluir e personalizar livremente.
                  </span>
                </div>
                {basketChoice === 'copy-demo' && (
                  <span className="material-symbols-outlined text-[#006a61] text-[20px]">check_circle</span>
                )}
              </div>

              <div
                onClick={() => setBasketChoice('empty')}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                  basketChoice === 'empty'
                    ? 'border-[#000000] bg-[#eff4ff]/60'
                    : 'border-[#eff4ff] hover:border-[#c6c6cd]'
                }`}
              >
                <div>
                  <span className="text-xs font-bold text-[#0b1c30] block">
                    Iniciar apenas com os 3 itens básicos
                  </span>
                  <span className="text-[11px] text-[#76777d]">
                    Comece limpo usando os valores aproximados que você acabou de informar.
                  </span>
                </div>
                {basketChoice === 'empty' && (
                  <span className="material-symbols-outlined text-[#006a61] text-[20px]">check_circle</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-[#eff4ff]">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="h-9 px-4 rounded-lg bg-[#eff4ff] text-[#0b1c30] text-xs font-semibold hover:bg-[#e5eeff] transition-colors cursor-pointer"
            >
              Voltar
            </button>
          ) : (
            <button
              type="button"
              onClick={onSkip}
              className="text-xs text-[#76777d] hover:text-[#0b1c30] cursor-pointer"
            >
              Pular Tudo
            </button>
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="h-10 px-5 rounded-lg bg-[#000000] text-[#ffffff] text-xs font-mono font-semibold hover:bg-[#213145] transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span>Avançar</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleComplete}
              className="h-10 px-6 rounded-lg bg-[#006a61] text-[#ffffff] text-xs font-mono font-semibold hover:bg-[#004e47] transition-all cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>{saving ? 'Salvando na nuvem...' : 'Concluir e Ver Análise'}</span>
              <span className="material-symbols-outlined text-[16px]">{saving ? 'sync' : 'check'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

