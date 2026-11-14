/**
 * Configuração Centralizada de Privacidade, LGPD e Governança de Dados — IPCA-Casa
 *
 * REGRA DE INTEGRIDADE:
 * Nunca embute dados fictícios de pessoa física/jurídica, CNPJ, endereço físico ou e-mail inventado.
 * Valores administrativos que dependem do responsável legal pelo projeto são lidos de variáveis de ambiente
 * (VITE_PRIVACY_*) e, quando ausentes, exibidos explicitamente como pendentes de definição pelo controlador.
 */

export const POLICY_VERSION = '2026-11-14-v1';
export const TERMS_VERSION = '2026-11-14-v1';
export const CMP_VERSION = '2026-11-14-v1';
export const PENDING_CONFIG_LABEL = 'Pendente de definição pelo controlador';

function readEnvValue(key: string): string {
  const viteEnv =
    typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[key]
      : undefined;
  const nodeEnv = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return (viteEnv ?? nodeEnv ?? '').trim();
}

function resolveEnvOrPending(key: string): { value: string; configured: boolean } {
  const raw = readEnvValue(key);
  if (!raw || raw.startsWith('MY_') || raw.startsWith('SEU_')) {
    return { value: PENDING_CONFIG_LABEL, configured: false };
  }
  return { value: raw, configured: true };
}

export interface PrivacyControllerConfig {
  appName: string;
  policyVersion: string;
  termsVersion: string;
  cmpVersion: string;
  controllerName: string;
  controllerNameConfigured: boolean;
  controllerDocument: string;
  controllerDocumentConfigured: boolean;
  controllerAddress: string;
  controllerAddressConfigured: boolean;
  privacyEmail: string;
  privacyEmailConfigured: boolean;
  dpoName: string;
  dpoNameConfigured: boolean;
  dpoExemptionNote: string;
  authorityReference: string;
}

export function getPrivacyControllerConfig(): PrivacyControllerConfig {
  const controllerName = resolveEnvOrPending('VITE_PRIVACY_CONTROLLER_NAME');
  const controllerDocument = resolveEnvOrPending('VITE_PRIVACY_CONTROLLER_DOC');
  const controllerAddress = resolveEnvOrPending('VITE_PRIVACY_CONTROLLER_ADDRESS');
  const privacyEmail = resolveEnvOrPending('VITE_PRIVACY_CONTACT_EMAIL');
  const dpoName = resolveEnvOrPending('VITE_PRIVACY_DPO_NAME');

  return {
    appName: 'IPCA-Casa',
    policyVersion: POLICY_VERSION,
    termsVersion: TERMS_VERSION,
    cmpVersion: CMP_VERSION,
    controllerName: controllerName.value,
    controllerNameConfigured: controllerName.configured,
    controllerDocument: controllerDocument.value,
    controllerDocumentConfigured: controllerDocument.configured,
    controllerAddress: controllerAddress.value,
    controllerAddressConfigured: controllerAddress.configured,
    privacyEmail: privacyEmail.value,
    privacyEmailConfigured: privacyEmail.configured,
    dpoName: dpoName.value,
    dpoNameConfigured: dpoName.configured,
    dpoExemptionNote:
      'Caso o operador do projeto se enquadre como agente de tratamento de pequeno porte nos termos da Resolução CD/ANPD nº 2/2022, pode ser dispensada a indicação formal de Encarregado (DPO), mantendo-se obrigatoriamente canal de comunicação acessível aos titulares.',
    authorityReference: 'Autoridade Nacional de Proteção de Dados (ANPD) — www.gov.br/anpd',
  };
}

export const PRIVACY_CONFIG = getPrivacyControllerConfig();

export interface DataInventoryCategory {
  id: string;
  category: string;
  fields: string[];
  purpose: string;
  legalBasis: string;
  storageLocation: string;
  retentionSummary: string;
}

export const DATA_INVENTORY: DataInventoryCategory[] = [
  {
    id: 'conta_identificacao',
    category: 'Conta e Autenticação',
    fields: ['UID do Firebase', 'E-mail verificado (isolado em private/account)', 'Nome de exibição', 'Provedor (Google ou E-mail/Senha)', 'URL de avatar (quando fornecida pelo Google)'],
    purpose: 'Autenticar o titular, isolar seus dados por usuário e permitir recuperação de acesso e verificação de e-mail.',
    legalBasis: 'Execução de contrato ou de procedimentos preliminares (art. 7º, V, LGPD) e legítimo interesse de segurança (art. 7º, IX, LGPD).',
    storageLocation: 'Firebase Authentication + Cloud Firestore (users/{uid} e users/{uid}/private/account)',
    retentionSummary: 'Enquanto a conta permanecer ativa; excluído integralmente quando o titular solicita a exclusão da conta.',
  },
  {
    id: 'perfis_domesticos',
    category: 'Perfis Familiares / Negócio',
    fields: ['Nome do perfil', 'Modo (pessoal/negócio)', 'Número de integrantes', 'Região de referência IBGE', 'Limiar de alerta (%)'],
    purpose: 'Personalizar cálculos de inflação e recortes regionais sem exigir CPF ou endereço residencial exato.',
    legalBasis: 'Execução do serviço solicitado pelo titular (art. 7º, V, LGPD).',
    storageLocation: 'Cloud Firestore (users/{uid}/profiles) ou navegador local em modo demonstração',
    retentionSummary: 'Enquanto o perfil existir ou até exclusão pelo usuário/encerramento da conta.',
  },
  {
    id: 'cesta_e_precos',
    category: 'Cesta de Consumo e Histórico de Preços',
    fields: ['Nome do item', 'Categoria/grupo', 'Classificação', 'Gasto mensal', 'Preços antigos e atuais', 'Datas e unidade de medida', 'Observações opcionais'],
    purpose: 'Calcular o IPCA pessoal (Índice de Laspeyres), identificar itens de maior impacto e registrar evolução histórica de preços.',
    legalBasis: 'Execução do serviço solicitado pelo titular (art. 7º, V, LGPD).',
    storageLocation: 'Cloud Firestore (basketItems e priceHistory) ou navegador local em modo demonstração',
    retentionSummary: 'Enquanto mantidos pelo titular ou até exclusão de dados financeiros / exclusão da conta.',
  },
  {
    id: 'renda_e_estrategias',
    category: 'Rendimentos, Estratégias e Fechamentos Mensais',
    fields: ['Renda nominal/líquida informada', 'Obrigações e reserva informadas', 'Planos A, B e C', 'Snapshots de fechamentos mensais'],
    purpose: 'Calcular perda ou ganho real de poder de compra, simulações de economia e evolução mensal consolidada.',
    legalBasis: 'Execução do serviço solicitado pelo titular (art. 7º, V, LGPD).',
    storageLocation: 'Cloud Firestore (incomeHistory, strategies, monthlyClosures)',
    retentionSummary: 'Enquanto mantidos pelo titular ou até exclusão de dados financeiros / exclusão da conta.',
  },
  {
    id: 'consentimento_e_termos',
    category: 'Registros de Consentimento, Termos e Solicitações LGPD',
    fields: ['Preferências de cookies por categoria', 'Versão da política/termos aceitos', 'Data/hora (serverTimestamp)', 'Tipo e status de solicitação do art. 18'],
    purpose: 'Comprovar o cumprimento das obrigações legais de transparência, consentimento granular e atendimento aos direitos dos titulares.',
    legalBasis: 'Cumprimento de obrigação legal ou regulatória (art. 7º, II, LGPD).',
    storageLocation: 'Navegador local (cookies não autenticados) e Cloud Firestore (consentRecords, termsAcceptances, privacyRequests)',
    retentionSummary: 'Mantido durante a conta ativa e removido na exclusão completa via API pelo titular autenticado (ou retido se Backend Admin estiver habilitado e configurado).',
  },
  {
    id: 'telemetria_opcional',
    category: 'Métricas Agregadas de Uso (Opcional — Google Analytics 4)',
    fields: ['Visualizações de rota', 'Eventos categóricos de interação sem valores monetários ou PII'],
    purpose: 'Mensurar desempenho e usabilidade das páginas e funcionalidades, bloqueando e-mails, nomes, UIDs e valores financeiros.',
    legalBasis: 'Consentimento prévio, livre e granular do titular (art. 7º, I, LGPD), desativado por padrão.',
    storageLocation: 'Google Analytics 4 (somente quando VITE_GA_MEASUREMENT_ID configurado e categoria analytics = true)',
    retentionSummary: 'Conforme configuração de retenção da propriedade GA4 no painel do Google Analytics.',
  },
];

export interface ExternalOperatorInfo {
  name: string;
  role: string;
  purpose: string;
  dataShared: string;
  internationalTransfer: string;
  referenceUrl: string;
}

export const EXTERNAL_OPERATORS: ExternalOperatorInfo[] = [
  {
    name: 'Google Firebase Authentication & Cloud Firestore',
    role: 'Operador de autenticação e banco de dados em nuvem',
    purpose: 'Gerenciamento de identidade (login Google e E-mail/Senha) e armazenamento isolado dos dados do usuário.',
    dataShared: 'UID, e-mail verificado, nome de exibição e registros financeiros cadastrados pelo usuário.',
    internationalTransfer: 'Infraestrutura gerenciada pelo Google Cloud, podendo envolver processamento internacional conforme termos do Firebase/GCP.',
    referenceUrl: 'https://firebase.google.com/support/privacy',
  },
  {
    name: 'IBGE — API Pública SIDRA (Tabelas 1737 e 7060)',
    role: 'Fonte pública oficial de dados estatísticos',
    purpose: 'Obter índices oficiais do IPCA nacional, regional e por grupos de consumo.',
    dataShared: 'Nenhum dado pessoal é enviado ao IBGE; apenas código de localidade macro (ex.: N1[all]).',
    internationalTransfer: 'Não aplicável (serviço público brasileiro).',
    referenceUrl: 'https://servicodados.ibge.gov.br/api/docs',
  },
  {
    name: 'Google Analytics 4 (Opcional — somente mediante consentimento)',
    role: 'Operador de mensuração estatística agregada',
    purpose: 'Analisar navegação e uso funcional sem coleta de renda, salários, gastos ou e-mails.',
    dataShared: 'Identificadores técnicos do navegador/cookies e nomes de eventos categóricos apenas quando consentido e configurado.',
    internationalTransfer: 'Infraestrutura global do Google LLC, sujeita às salvaguardas contratuais do Google Analytics.',
    referenceUrl: 'https://policies.google.com/privacy',
  },
];

export interface RetentionScheduleItem {
  dataType: string;
  localRetention: string;
  cloudRetention: string;
  deletionTrigger: string;
}

export const RETENTION_SCHEDULE: RetentionScheduleItem[] = [
  {
    dataType: 'Caches locais de IBGE e estado temporário de UI',
    localRetention: 'Cache IBGE expira em 1 hora (descartado após 7 dias se obsoleto); avisos temporários após 30 dias.',
    cloudRetention: 'Não persistido na nuvem.',
    deletionTrigger: 'Limpeza automática na inicialização / encerramento de sessão.',
  },
  {
    dataType: 'Registro local de preferências de cookies',
    localRetention: 'Até 365 dias ou até revogação/limpeza pelo usuário.',
    cloudRetention: 'Sincronizado em consentRecords enquanto a conta existir.',
    deletionTrigger: 'Alteração no modal de cookies ou limpeza do navegador.',
  },
  {
    dataType: 'Dados de Demonstração (/demo)',
    localRetention: 'Apenas no navegador local; limpo ao restaurar padrão ou encerrar modo demo.',
    cloudRetention: 'Nunca gravado no Cloud Firestore (regra isDemo == false).',
    deletionTrigger: 'Botão "Restaurar Padrão Inicial" ou limpeza do navegador.',
  },
  {
    dataType: 'Dados financeiros na nuvem (perfis, cesta, preços, rendas, planos, fechamentos)',
    localRetention: 'Não armazenado localmente para usuários autenticados (apenas cache em memória da sessão).',
    cloudRetention: 'Enquanto a conta permanecer ativa.',
    deletionTrigger: 'Botão "Apagar Apenas Dados Financeiros" ou "Excluir Conta Permanentemente".',
  },
  {
    dataType: 'Conta de autenticação e metadados privados (private/account)',
    localRetention: 'Apenas sessão gerenciada pelo Firebase Auth SDK; encerrada no logout ou exclusão.',
    cloudRetention: 'Enquanto a conta permanecer ativa.',
    deletionTrigger: 'Fluxo de exclusão definitiva da conta em Meus Dados e Privacidade.',
  },
];

export interface Art18RightDefinition {
  code:
    | 'confirmacao_acesso'
    | 'correcao'
    | 'anonimizacao_eliminacao'
    | 'portabilidade'
    | 'revogacao_consentimento'
    | 'informacao_compartilhamento'
    | 'revisao_oposicao';
  title: string;
  legalRef: string;
  description: string;
  selfServiceActionLabel: string;
}

export const ART_18_RIGHTS: Art18RightDefinition[] = [
  {
    code: 'confirmacao_acesso',
    title: 'Confirmação e Acesso aos Dados',
    legalRef: 'Art. 18, I e II',
    description: 'Confirmar a existência de tratamento e visualizar os dados associados à sua conta.',
    selfServiceActionLabel: 'Visualizar inventário e contadores abaixo',
  },
  {
    code: 'correcao',
    title: 'Correção de Dados Incompletos ou Desatualizados',
    legalRef: 'Art. 18, III',
    description: 'Editar perfil, nome, região de referência, itens da cesta, rendimentos e preços diretamente no painel ou via solicitação formal.',
    selfServiceActionLabel: 'Editar no painel ou registrar solicitação',
  },
  {
    code: 'anonimizacao_eliminacao',
    title: 'Eliminação de Dados e Exclusão de Conta',
    legalRef: 'Art. 18, IV e VI',
    description: 'Remover dados financeiros mantendo o acesso ou excluir definitivamente toda a conta e coleções associadas.',
    selfServiceActionLabel: 'Gerenciar exclusão abaixo',
  },
  {
    code: 'portabilidade',
    title: 'Portabilidade e Exportação Estruturada',
    legalRef: 'Art. 18, V',
    description: 'Baixar cópia completa dos seus dados pessoais e financeiros em formato aberto JSON ou planilhas CSV.',
    selfServiceActionLabel: 'Exportar JSON / CSV abaixo',
  },
  {
    code: 'informacao_compartilhamento',
    title: 'Informação sobre Operadores e Compartilhamento',
    legalRef: 'Art. 18, VII',
    description: 'Consultar quais provedores de infraestrutura processam dados estritamente para operação do serviço.',
    selfServiceActionLabel: 'Consultar operadores na Política de Privacidade',
  },
  {
    code: 'revogacao_consentimento',
    title: 'Revogação de Consentimento de Cookies/Métricas',
    legalRef: 'Art. 18, VIII e IX',
    description: 'Desativar métricas opcionais a qualquer momento com efeito imediato e limpeza de cookies de terceiros.',
    selfServiceActionLabel: 'Abrir preferências de cookies',
  },
  {
    code: 'revisao_oposicao',
    title: 'Oposição ou Revisão de Tratamento',
    legalRef: 'Art. 18, §2º e art. 20',
    description: 'Registrar pedido formal de revisão ou oposição junto ao controlador sobre qualquer tratamento de dados.',
    selfServiceActionLabel: 'Registrar solicitação formal',
  },
];
