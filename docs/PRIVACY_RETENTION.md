# Matriz de Retenção, Minimização e Descarte de Dados — IPCA-Casa

Base normativa: **Art. 15 e Art. 16 da Lei nº 13.709/2018 (LGPD)** e **Marco Civil da Internet (Lei nº 12.965/2014)**.

## 1. Tabela de Prazos de Retenção

| Categoria de Dado | Local | Finalidade | Prazo / Critério de Término | Mecanismo de Descarte |
| :--- | :--- | :--- | :--- | :--- |
| **Conta e Autenticação** | Firebase Auth + `users/{uid}` + `users/{uid}/private/account` | Acesso autenticado e isolamento de sessão | Enquanto a conta estiver ativa | Exclusão integral imediata via `POST /api/privacy/delete-account` |
| **Dados Financeiros Domésticos/Negócio** | Subcoleções `profiles`, `basketItems`, `priceHistory`, `incomeHistory`, `strategies`, `monthlyClosures`, `consumptionGroups` | Cálculo de inflação pessoal e comparativos | Enquanto a conta estiver ativa ou até limpeza solicitada pelo titular | Limpeza financeira parcial (mantendo conta) ou cascata total na exclusão da conta |
| **Evidências de Consentimento e Termos** | `users/{uid}/consentRecords` e `users/{uid}/termsAcceptances` | Prova de consentimento e aceite (Art. 8º, § 2º LGPD) | Enquanto a conta existir ou até solicitação de eliminação integral | Limpeza automática local > 365 dias (`consentHistory`); cascata na exclusão de conta (ou guarda legal específica definida pelo controlador) |
| **Solicitações Art. 18** | `users/{uid}/privacyRequests` | Rastreabilidade de pedidos do titular | Enquanto a conta estiver ativa | Cascata na exclusão da conta |
| **Cache Local IBGE (SIDRA)** | `localStorage` (`ipca_casa_ibge_cache*`) | Redução de chamadas à API oficial | **7 dias** | Varredura automática em `runLocalDataRetentionSweep()` |
| **Chaves Legadas de Versões Antigas** | `localStorage` (`ipca_casa_users_v1`, `ipca_casa_session_v1`, `ipca_casa_passwords_v1`) | Resíduos obsoletos pré-Firebase | **0 dias (descarte imediato)** | Remoção automática em `runLocalDataRetentionSweep()` |
| **Aceite Pendente de Cadastro** | `sessionStorage` (`ipca_casa_pending_terms_acceptance_v1`) | Transferência do aceite entre cadastro/verificação e 1º login | Até gravação no Firestore ou encerramento da aba | `clearPendingTermsAcceptance()` / fim da sessão do navegador |
| **Cookies Opcionais de Analytics** | Cookies `_ga`, `_gid`, `_gat`, `_gcl` | Medição anônima opt-in (quando `VITE_GA_MEASUREMENT_ID` ativo) | Enquanto houver consentimento ativo | `clearThirdPartyTrackingCookies()` + `window['ga-disable-*'] = true` na revogação |
| **Logs Técnicos do Servidor** | `stdout`/`stderr` do Node/Express (`server.ts`) e proxy hospedeiro | Diagnóstico de falhas e proteção anti-abuso (Rate Limit) | Logs da aplicação não registram payloads nem e-mails; retenção de logs HTTP segue política do provedor de infraestrutura | Sanitização em `server.ts` + configuração de retenção no painel da hospedagem |

## 2. Varredura Automatizada no Navegador
Executada automaticamente na inicialização da aplicação (`App.tsx` -> `src/services/retention.ts`):
- `runLocalDataRetentionSweep()` limpa artefatos expirados e chaves legadas sem apagar dados ativos do Modo Demonstração nem escolhas válidas do CMP.
- `purgeAllBrowserAccountCaches()` é acionada após a confirmação da exclusão definitiva da conta no backend.
