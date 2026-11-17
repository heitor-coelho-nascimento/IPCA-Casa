import React, { useEffect, useState } from 'react';
import {
  BasketItem,
  ConsumptionGroup,
  EstudanteQuestionnaireAnswers,
  FamilyProfile,
  IncomeRecord,
  NegocioQuestionnaireAnswers,
  PessoalQuestionnaireAnswers,
  PriceRecord,
  ProfileMode,
  QuestionnaireDataPayload,
} from '../types';
import {
  QUESTIONNAIRE_VERSION,
  buildItemEntriesFromSelection,
  createDefaultEstudanteAnswers,
  createDefaultNegocioAnswers,
  createDefaultPessoalAnswers,
} from '../config/questionnaires';
import {
  PrefillBundleResult,
  buildPrefillBundleFromQuestionnaire,
  validateQuestionnaireStep,
} from '../services/questionnairePrefill';
import { StorageService, getDefaultGroupsForMode } from '../services/storage';
import { ModalitySelectorStep } from './onboarding/ModalitySelectorStep';
import { PessoalQuestionnaireForm } from './onboarding/PessoalQuestionnaireForm';
import { NegocioQuestionnaireForm } from './onboarding/NegocioQuestionnaireForm';
import { EstudanteQuestionnaireForm } from './onboarding/EstudanteQuestionnaireForm';

export interface OnboardingBundle {
  initialIncome: number;
  currentIncome: number;
  items: BasketItem[];
  prefillBundle?: PrefillBundleResult;
}

interface OnboardingModalProps {
  isOpen: boolean;
  userId?: string;
  userDisplayName: string;
  targetProfileId?: string;
  initialProfile?: FamilyProfile | null;
  initialMode?: ProfileMode;
  initialStep?: number;
  allowModalitySelection?: boolean;
  isEditingFromSettings?: boolean;
  existingGroups?: ConsumptionGroup[];
  existingItems?: BasketItem[];
  existingIncomeRecords?: IncomeRecord[];
  existingPriceRecords?: PriceRecord[];
  skipLocalPersistence?: boolean;
  onFinish: (profile: FamilyProfile, bundle?: OnboardingBundle) => void | Promise<void>;
  onSaveDraft?: (draftProfile: FamilyProfile) => void | Promise<void>;
  onSkip: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  userId = 'local',
  userDisplayName,
  targetProfileId,
  initialProfile,
  initialMode,
  initialStep,
  allowModalitySelection = true,
  isEditingFromSettings = false,
  existingGroups = [],
  existingItems = [],
  existingIncomeRecords = [],
  existingPriceRecords = [],
  skipLocalPersistence = false,
  onFinish,
  onSaveDraft,
  onSkip,
}) => {
  const draftOwnerId = userId || 'local';
  const resolvedInitialMode: ProfileMode =
    initialMode || initialProfile?.profileMode || 'pessoal';

  const [selectingModality, setSelectingModality] = useState<boolean>(
    allowModalitySelection && !initialProfile?.profileMode && !isEditingFromSettings
  );
  const [mode, setMode] = useState<ProfileMode>(resolvedInitialMode);
  const [step, setStep] = useState<number>(initialStep || initialProfile?.onboardingStep || 1);

  const [profileName, setProfileName] = useState<string>(
    initialProfile?.name || `Orçamento de ${userDisplayName}`
  );
  const [referenceRegion, setReferenceRegion] = useState<string>(
    initialProfile?.referenceRegion || 'Brasil'
  );

  const [pessoalAnswers, setPessoalAnswers] = useState<PessoalQuestionnaireAnswers>(() =>
    createDefaultPessoalAnswers(initialProfile?.membersCount || 3)
  );
  const [negocioAnswers, setNegocioAnswers] = useState<NegocioQuestionnaireAnswers>(() =>
    createDefaultNegocioAnswers(initialProfile?.name || '')
  );
  const [estudanteAnswers, setEstudanteAnswers] = useState<EstudanteQuestionnaireAnswers>(() =>
    createDefaultEstudanteAnswers()
  );

  const [saving, setSaving] = useState(false);
  const [errorList, setErrorList] = useState<string[]>([]);

  // Sincronizar quando modal abre com perfil existente / rascunho salvo
  useEffect(() => {
    if (!isOpen) return;

    const targetMode: ProfileMode =
      initialMode || initialProfile?.profileMode || 'pessoal';
    const resolvedProfileId = targetProfileId || initialProfile?.id || 'profile-clean-slate';
    const localDraft = StorageService.loadQuestionnaireDraftLocal(draftOwnerId, resolvedProfileId);
    const savedQd = initialProfile?.questionnaireData || localDraft;

    setMode(targetMode);
    setSelectingModality(
      allowModalitySelection && !initialProfile?.profileMode && !isEditingFromSettings && !savedQd
    );
    setStep(
      Math.max(
        1,
        Math.min(
          5,
          initialStep || initialProfile?.onboardingStep || savedQd?.currentStep || 1
        )
      )
    );
    setProfileName(
      initialProfile?.name ||
        (targetMode === 'negocio'
          ? 'Meu Negócio'
          : targetMode === 'estudante'
            ? 'Perfil Estudante'
            : `Orçamento de ${userDisplayName}`)
    );
    setReferenceRegion(initialProfile?.referenceRegion || 'Brasil');

    if (savedQd?.pessoal) {
      setPessoalAnswers(savedQd.pessoal);
    } else {
      const defP = createDefaultPessoalAnswers(initialProfile?.membersCount || 3);
      defP.itemEntries = buildItemEntriesFromSelection(
        defP.selectedRegularProducts,
        [],
        'pessoal'
      );
      setPessoalAnswers(defP);
    }

    if (savedQd?.negocio) {
      setNegocioAnswers(savedQd.negocio);
    } else {
      setNegocioAnswers(
        createDefaultNegocioAnswers(
          targetMode === 'negocio' ? initialProfile?.name || '' : ''
        )
      );
    }

    if (savedQd?.estudante) {
      setEstudanteAnswers(savedQd.estudante);
    } else {
      const defE = createDefaultEstudanteAnswers();
      defE.itemEntries = buildItemEntriesFromSelection(
        defE.selectedConsumptionCategories,
        [],
        'estudante'
      );
      setEstudanteAnswers(defE);
    }

    setErrorList([]);
  }, [
    isOpen,
    draftOwnerId,
    initialMode,
    initialProfile,
    initialStep,
    allowModalitySelection,
    isEditingFromSettings,
    targetProfileId,
    userDisplayName,
  ]);

  if (!isOpen) return null;

  const getCurrentAnswers = () => {
    if (mode === 'negocio') return negocioAnswers;
    if (mode === 'estudante') return estudanteAnswers;
    return pessoalAnswers;
  };

  const handleSelectMode = (nextMode: ProfileMode) => {
    setMode(nextMode);
    setErrorList([]);
    if (!initialProfile?.name || initialProfile.name === `Orçamento de ${userDisplayName}`) {
      if (nextMode === 'negocio') {
        setProfileName(negocioAnswers.businessName || 'Meu Negócio');
      } else if (nextMode === 'estudante') {
        setProfileName(`Perfil Estudante (${userDisplayName.split(' ')[0] || 'Estudos'})`);
      } else {
        setProfileName(`Orçamento de ${userDisplayName}`);
      }
    }
  };

  const handleProceedFromModality = () => {
    setSelectingModality(false);
    setStep(1);
    setErrorList([]);
  };

  const handleNextStep = () => {
    const validation = validateQuestionnaireStep(mode, step, getCurrentAnswers());
    if (!validation.valid) {
      setErrorList(validation.errors);
      return;
    }
    setErrorList([]);

    // Ao entrar na Etapa 4 pela primeira vez, garantir pré-preenchimento dos itens selecionados
    if (step === 3) {
      if (mode === 'pessoal' && pessoalAnswers.itemEntries.length === 0) {
        setPessoalAnswers({
          ...pessoalAnswers,
          itemEntries: buildItemEntriesFromSelection(
            pessoalAnswers.selectedRegularProducts,
            [],
            'pessoal'
          ),
        });
      } else if (mode === 'estudante' && estudanteAnswers.itemEntries.length === 0) {
        setEstudanteAnswers({
          ...estudanteAnswers,
          itemEntries: buildItemEntriesFromSelection(
            estudanteAnswers.selectedConsumptionCategories,
            [],
            'estudante'
          ),
        });
      }
    }

    setStep((s) => Math.min(5, s + 1));
  };

  const handleSaveDraft = async () => {
    if (saving) return;
    setSaving(true);
    setErrorList([]);
    try {
      const nowIso = new Date().toISOString();
      const profileId = targetProfileId || initialProfile?.id || `prof_user_${Date.now()}`;
      const qd: QuestionnaireDataPayload = {
        mode,
        version: QUESTIONNAIRE_VERSION,
        updatedAt: nowIso,
        currentStep: step,
        ...(mode === 'pessoal' ? { pessoal: pessoalAnswers } : {}),
        ...(mode === 'negocio' ? { negocio: negocioAnswers } : {}),
        ...(mode === 'estudante' ? { estudante: estudanteAnswers } : {}),
      };

      const draftProfile: FamilyProfile = {
        ...(initialProfile || {
          id: profileId,
          membersCount: 1,
          currency: 'BRL',
          isDemo: false,
          createdAt: nowIso,
        }),
        id: profileId,
        name:
          (mode === 'negocio' ? negocioAnswers.businessName.trim() : profileName.trim()) ||
          initialProfile?.name ||
          `Perfil ${mode}`,
        profileMode: mode,
        referenceRegion,
        onboardingStatus:
          initialProfile?.onboardingStatus === 'completed' ? 'completed' : 'in_progress',
        onboardingStep: step,
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        questionnaireData: qd,
        updatedAt: nowIso,
      };

      StorageService.saveQuestionnaireDraftLocal(draftOwnerId, profileId, qd);
      if (onSaveDraft) {
        await onSaveDraft(draftProfile);
      } else {
        onSkip();
      }
    } catch (err) {
      setErrorList([
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível salvar o rascunho agora.',
      ]);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (saving) return;
    const validation = validateQuestionnaireStep(mode, 5, getCurrentAnswers());
    if (!validation.valid) {
      setErrorList(validation.errors);
      return;
    }

    setSaving(true);
    setErrorList([]);
    try {
      const nowIso = new Date().toISOString();
      const profileId = targetProfileId || initialProfile?.id || `prof_user_${Date.now()}`;
      const baseProfile: FamilyProfile = {
        ...(initialProfile || {
          id: profileId,
          membersCount: mode === 'pessoal' ? pessoalAnswers.membersCount : 1,
          currency: 'BRL',
          isDemo: false,
          createdAt: nowIso,
        }),
        id: profileId,
        name:
          (mode === 'negocio' ? negocioAnswers.businessName.trim() : profileName.trim()) ||
          initialProfile?.name ||
          `Orçamento de ${userDisplayName}`,
        profileMode: mode,
        referenceRegion,
        currency: initialProfile?.currency || 'BRL',
        priceAlertThresholdPercent: initialProfile?.priceAlertThresholdPercent ?? 10,
        isDemo: false,
        updatedAt: nowIso,
      };

      const bundle = buildPrefillBundleFromQuestionnaire({
        mode,
        baseProfile,
        answers: getCurrentAnswers(),
        existingGroups,
        existingItems,
        existingIncomeRecords,
        existingPriceRecords,
        defaultGroupsForMode: getDefaultGroupsForMode(mode),
        isUpdateFromSettings: isEditingFromSettings,
      });

      StorageService.clearQuestionnaireDraftLocal(draftOwnerId, profileId);

      if (!skipLocalPersistence) {
        StorageService.saveProfile(bundle.profile);
        StorageService.setActiveProfileId(bundle.profile.id);
        for (const grp of bundle.consumptionGroups) {
          if (grp.isCustom) {
            StorageService.saveGroup(grp);
          }
        }
        const profileIncomes = bundle.incomeRecords.filter(
          (rec) => rec.profileId === bundle.profile.id
        );
        StorageService.replaceIncomeRecordsForProfile(bundle.profile.id, profileIncomes);
        if (bundle.useDemoBasket) {
          StorageService.loadDemoBasket(mode);
        } else {
          if (bundle.items.length > 0) {
            StorageService.importItems(bundle.items, bundle.profile.id);
          }
          if (bundle.priceRecords.length > 0) {
            StorageService.mergePriceRecordsLocal(bundle.priceRecords);
          }
        }
      }

      const currIncome = bundle.incomeRecords[bundle.incomeRecords.length - 1]?.nominalIncome || 0;
      const initIncome = bundle.incomeRecords[0]?.nominalIncome || currIncome;

      await onFinish(bundle.profile, {
        initialIncome: initIncome,
        currentIncome: currIncome,
        items: bundle.items,
        prefillBundle: bundle,
      });
    } catch (err) {
      setErrorList([
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível concluir o questionário inicial. Tente novamente.',
      ]);
    } finally {
      setSaving(false);
    }
  };

  const modalityTitle =
    mode === 'negocio'
      ? 'Negócio / Pequena Empresa'
      : mode === 'estudante'
        ? 'Estudante'
        : 'Pessoal / Familiar';

  return (
    <div className="fixed inset-0 bg-[#213145]/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#ffffff] rounded-2xl max-w-3xl w-full max-h-[92vh] shadow-2xl flex flex-col border border-[#eff4ff] overflow-hidden">
        {/* Top Header */}
        <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-[#eff4ff] flex flex-col gap-2.5 bg-[#ffffff]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-mono text-[#76777d]">
              {selectingModality ? (
                <span>Seleção de Modalidade</span>
              ) : (
                <span>
                  {modalityTitle} · Etapa {step} de 5
                </span>
              )}
              {isEditingFromSettings && (
                <span className="text-[#006a61] font-semibold">· Atualizando respostas</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {!selectingModality && allowModalitySelection && !isEditingFromSettings && (
                <button
                  type="button"
                  onClick={() => setSelectingModality(true)}
                  className="text-xs font-semibold text-[#497cff] hover:underline cursor-pointer"
                >
                  Trocar modalidade
                </button>
              )}
              {!selectingModality && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveDraft}
                  className="text-xs font-semibold text-[#0b1c30] hover:underline cursor-pointer disabled:opacity-50"
                >
                  Salvar e continuar depois
                </button>
              )}
              <button
                type="button"
                onClick={onSkip}
                className="text-xs text-[#76777d] hover:text-[#0b1c30] underline cursor-pointer"
              >
                {isEditingFromSettings ? 'Fechar' : 'Pular por agora'}
              </button>
            </div>
          </div>

          {!selectingModality && (
            <div className="w-full bg-[#eff4ff] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#006a61] h-full transition-all duration-300"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          )}

          {errorList.length > 0 && (
            <div className="p-2.5 rounded-lg bg-[#ffdad6]/60 border border-[#ba1a1a]/30 text-xs text-[#ba1a1a] flex flex-col gap-0.5">
              {errorList.map((err) => (
                <span key={err}>• {err}</span>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {selectingModality ? (
            <ModalitySelectorStep
              selectedMode={mode}
              onSelectMode={handleSelectMode}
            />
          ) : mode === 'pessoal' ? (
            <PessoalQuestionnaireForm
              step={step}
              answers={pessoalAnswers}
              onChange={setPessoalAnswers}
              profileName={profileName}
              onProfileNameChange={setProfileName}
              referenceRegion={referenceRegion}
              onReferenceRegionChange={setReferenceRegion}
            />
          ) : mode === 'negocio' ? (
            <NegocioQuestionnaireForm
              step={step}
              answers={negocioAnswers}
              onChange={setNegocioAnswers}
              referenceRegion={referenceRegion}
              onReferenceRegionChange={setReferenceRegion}
            />
          ) : (
            <EstudanteQuestionnaireForm
              step={step}
              answers={estudanteAnswers}
              onChange={setEstudanteAnswers}
              profileName={profileName}
              onProfileNameChange={setProfileName}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-4 border-t border-[#eff4ff] bg-[#f8f9ff] flex items-center justify-between gap-3">
          {selectingModality ? (
            <>
              <button
                type="button"
                onClick={onSkip}
                className="text-xs text-[#76777d] hover:text-[#0b1c30] cursor-pointer"
              >
                Pular por agora
              </button>
              <button
                type="button"
                onClick={handleProceedFromModality}
                className="h-10 px-5 rounded-lg bg-[#0b1c30] text-[#ffffff] text-xs font-mono font-semibold hover:bg-[#213145] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Começar Questionário</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </>
          ) : (
            <>
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setErrorList([]);
                    setStep((s) => Math.max(1, s - 1));
                  }}
                  className="h-9 px-4 rounded-lg bg-[#ffffff] border border-[#c6c6cd] text-[#0b1c30] text-xs font-semibold hover:bg-[#eff4ff] transition-colors cursor-pointer"
                >
                  Voltar
                </button>
              ) : allowModalitySelection && !isEditingFromSettings ? (
                <button
                  type="button"
                  onClick={() => {
                    setErrorList([]);
                    setSelectingModality(true);
                  }}
                  className="h-9 px-4 rounded-lg bg-[#ffffff] border border-[#c6c6cd] text-[#0b1c30] text-xs font-semibold hover:bg-[#eff4ff] transition-colors cursor-pointer"
                >
                  Mudar Modalidade
                </button>
              ) : (
                <span />
              )}

              {step < 5 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="h-10 px-5 rounded-lg bg-[#0b1c30] text-[#ffffff] text-xs font-mono font-semibold hover:bg-[#213145] transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
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
                  <span>
                    {saving
                      ? 'Salvando...'
                      : isEditingFromSettings
                        ? 'Salvar Atualizações'
                        : 'Concluir e Ver Análise'}
                  </span>
                  <span className="material-symbols-outlined text-[16px]">
                    {saving ? 'sync' : 'check'}
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
