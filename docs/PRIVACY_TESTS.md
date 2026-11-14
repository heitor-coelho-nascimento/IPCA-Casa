# Evidências de Testes e Validação LGPD — IPCA-Casa

Classificação adotada conforme política de integridade:
- **APROVADO:** verificado e aprovado por execução real no ambiente atual.
- **REPROVADO:** executado com falha.
- **NÃO EXECUTADO:** não verificado em execução ao vivo (ex.: interação visual manual com conta Firebase real em navegador ou emulador Java do Firestore).
- **BLOQUEADO POR CONFIGURAÇÃO:** depende de configuração externa de ambiente/produção (ex.: variáveis `VITE_PRIVACY_*` ou `VITE_GA_MEASUREMENT_ID`).

## 1. Resumo das Execuções Verificadas

| Verificação | Comando / Mecanismo | Resultado Observado | Status |
| :--- | :--- | :--- | :--- |
| **Lint das Security Rules** | `npx eslint firestore.rules` | Exit code `0`, sem erros ou avisos bloqueantes | **APROVADO** |
| **Deploy das Security Rules** | `DeployRules` RPC (`service_name: "fax"`) | Retorno `{}` sem erros para `firestore.rules` | **APROVADO** |
| **Checagem de Tipos TypeScript** | `npm run lint` (`tsc --noEmit`) | Exit code `0`, 0 erros de compilação | **APROVADO** |
| **Build de Produção** | `npm run build` / `compile_applet` | Compilação concluída com sucesso | **APROVADO** |
| **Bateria Completa Vitest** | `npm test` (`vitest run`) | **8 arquivos / 75 testes aprovados** (0 falhas) | **APROVADO** |

## 2. Cobertura Detalhada dos Testes Automatizados (`tests/`)

### 2.1. `tests/privacy.test.ts` (11/11 — **APROVADO**)
- **Privacy by Default (CMP):** `analytics: false`, `marketing: false`, `essenciais: true` antes de decisão; eventos de analytics bloqueados.
- **Opt-in e Revogação:** habilita coleta após consentimento explícito; na revogação define `window['ga-disable-*'] = true`, limpa cookies `_ga` e `_gid` preservando sessão local e grava histórico no CMP.
- **Ausência de Dados Fictícios:** confirma que `PRIVACY_CONFIG` retorna `"Pendente de definição pelo controlador"` e flags `*Configured === false` quando `VITE_PRIVACY_*` não estão configuradas.
- **Aceite de Termos Pendente:** captura e remoção segura em `sessionStorage` para transferência pós-verificação.
- **Varredura de Retenção Local:** `runLocalDataRetentionSweep()` remove chaves legadas (`ipca_casa_users_v1`, `ipca_casa_session_v1`), caches IBGE > 7 dias e registros locais de consentimento > 365 dias, preservando dados ativos do modo demonstração.
- **Exclusão Integral de Conta (`POST /api/privacy/delete-account` via mock de Identity Toolkit + Firestore REST):**
  - Rejeita requisição sem Bearer token (`401`).
  - Rejeita requisição sem `confirmDeletion: true` (`400`).
  - Rejeita conta com `emailVerified: false` (`403`).
  - Exige reautenticação recente quando `auth_time > 900s` (`401 REQUIRES_RECENT_LOGIN`).
  - Executa cascata ordenada (`leafCollections` -> `private/account` -> `users/{uid}` -> `accounts:delete`) retornando `200`.
  - Não emite falso sucesso quando `accounts:delete` falha (`502 AUTH_DELETE_FAILED`).

### 2.2. `tests/firestore.rules.test.ts` (11/11 — **APROVADO**)
- Valida sincronismo entre `firebase-blueprint.json`, `firestore.rules` e `security_spec.md`, incluindo `consentRecords`, `termsAcceptances` e `privacyRequests`.
- Verifica `12` regras `allow list` com isolamento por `userId` sem `get()`/`exists()` e autoexclusão permitida apenas ao próprio titular verificado em `users/{uid}` e `users/{uid}/private/account`.
- Verifica imutabilidade de `consentRecords` e `termsAcceptances` (`allow update: if false`) e transição estrita em `privacyRequests` (criação apenas como `registrada` sem `resolutionNote`, e atualização permitida apenas para cancelamento pelo titular).

### 2.3. `tests/seo.test.ts` (9/9 — **APROVADO**)
- Valida metadados únicos (título 30–60 chars, descrição 120–160 chars) e sitemap incluindo `/privacidade` e `/termos`, mantendo `/login`, `/painel*`, `/demo` e `/api*` em `noindex`.
- Valida firewall anti-PII e bloqueio de eventos GA4 sem consentimento.

## 3. Itens Pendentes de Validação Externa ou Manual

| Item | Status | Observação |
| :--- | :--- | :--- |
| **Testes em Emulador Oficial do Firestore** | **NÃO EXECUTADO** | A suíte `tests/firestore.rules.test.ts` valida estruturalmente as regras, payloads e constantes contra o Blueprint; o simulador local Java do Firebase Emulator não foi executado neste ambiente. |
| **Fluxo End-to-End ao Vivo (Reautenticação Google/Senha + Exclusão Real)** | **NÃO EXECUTADO** | O backend de exclusão foi testado com servidor HTTP real e mock de `fetch`; a execução contra conta Google/Firebase ativa depende de login interativo de usuário final. |
| **Dados Legais do Controlador e DPO em Produção (`VITE_PRIVACY_*`)** | **BLOQUEADO POR CONFIGURAÇÃO** | Aguarda definição pelo operador/responsável legal nas variáveis de ambiente de produção. |
| **Medição GA4 em Produção (`VITE_GA_MEASUREMENT_ID`)** | **BLOQUEADO POR CONFIGURAÇÃO** | Desabilitado por padrão até configuração de ID válido pelo operador. |
