import React from 'react';
import { ProfileMode } from '../../types';

interface ModalitySelectorStepProps {
  selectedMode: ProfileMode;
  onSelectMode: (mode: ProfileMode) => void;
  disabled?: boolean;
}

const MODALITY_OPTIONS: Array<{
  mode: ProfileMode;
  title: string;
  subtitle: string;
  highlights: string[];
  icon: string;
}> = [
  {
    mode: 'pessoal',
    title: 'Pessoal / Familiar',
    subtitle: 'Para organizar compras de casa, contas do mês e o poder de compra da renda da família.',
    highlights: [
      'Acompanha renda, sobra mensal e despesas domésticas',
      'Compara sua cesta real com o IPCA oficial do IBGE',
      'Mostra onde os preços subiram mais no orçamento da casa',
    ],
    icon: 'home',
  },
  {
    mode: 'negocio',
    title: 'Negócio / Pequena Empresa',
    subtitle: 'Para acompanhar custos operacionais, insumos, fornecedores e faturamento mensal.',
    highlights: [
      'Separa custos fixos, variáveis e compras de fornecedores',
      'Registra resultado estimado (sem confundir com lucro contábil)',
      'Identifica matérias-primas e insumos que mais pressionam os custos',
    ],
    icon: 'storefront',
  },
  {
    mode: 'estudante',
    title: 'Estudante',
    subtitle: 'Para estudantes organizarem mesada, bolsa, estágio e gastos próprios de estudo e rotina.',
    highlights: [
      'Funciona mesmo se você marcar "Não possuo renda própria"',
      'Diferencia gastos pagos por você de despesas da casa',
      'Acompanha transporte, alimentação, material e assinaturas',
    ],
    icon: 'school',
  },
];

export const ModalitySelectorStep: React.FC<ModalitySelectorStepProps> = ({
  selectedMode,
  onSelectMode,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold text-[#0b1c30]">
          Escolha como você deseja utilizar o IPCA-Casa neste perfil
        </h3>
        <p className="text-xs text-[#45464d] mt-1">
          Cada modalidade apresenta perguntas próprias e adapta termos, categorias e gráficos para sua realidade.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MODALITY_OPTIONS.map((option) => {
          const isSelected = selectedMode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              disabled={disabled}
              onClick={() => onSelectMode(option.mode)}
              className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                isSelected
                  ? 'border-[#006a61] bg-[#eff4ff]/80 shadow-sm'
                  : 'border-[#e5eeff] bg-[#ffffff] hover:border-[#c6c6cd]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`material-symbols-outlined text-[22px] ${
                      isSelected ? 'text-[#006a61]' : 'text-[#45464d]'
                    }`}
                  >
                    {option.icon}
                  </span>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[#006a61] text-[18px]">
                      check_circle
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-[#0b1c30] block">{option.title}</span>
                <p className="text-xs text-[#45464d] mt-1 leading-relaxed">{option.subtitle}</p>
              </div>

              <ul className="flex flex-col gap-1.5 pt-2 border-t border-[#eff4ff]">
                {option.highlights.map((h) => (
                  <li key={h} className="text-[11px] text-[#45464d] flex items-start gap-1.5">
                    <span className="text-[#006a61] font-bold">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
};
