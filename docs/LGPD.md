# Relatório Técnico de Governança e Conformidade LGPD — IPCA-Casa

## 1. Visão Geral e Escopo Jurídico-Técnico
O **IPCA-Casa** adota princípios de **Privacy by Design** e **Privacy by Default** (art. 46, § 2º da Lei nº 13.709/2018 — LGPD), além das exigências aplicáveis do Marco Civil da Internet (Lei nº 12.965/2014).

> **Transparência sobre dados do Controlador / Encarregado (DPO):** Este repositório utiliza variáveis de ambiente (`VITE_PRIVACY_CONTROLLER_*` e `VITE_PRIVACY_CONTACT_EMAIL` em `src/config/privacy.ts`). Enquanto não configuradas em produção pelo operador responsável, a interface exibe explicitamente `"Pendente de definição pelo controlador"`, sem invenção de CNPJ, nome empresarial ou e-mail fictício.

---

## 2. Inventário de Dados Pessoais e Bases Legais

| Categoria | Dados / Campos Tratados | Local de Armazenamento | Base Legal (LGPD) |
| :--- | :--- | :--- | :--- |
| **Identificação da Conta** | UID Firebase, nome de exibição, provedor (`google` / `password`), foto opcional | Firebase Auth + `users/{uid}` | Execução de contrato / procedimentos preliminares (art. 7º, V) |
| **PII Isolada** | Endereço de e-mail verificado | `users/{uid}/private/account` | Execução de contrato (art. 7º, V) e cumprimento de obrigação legal (art. 7º, II) |
| **Perfis e Orçamento** | Perfis domésticos/negócio, região de referência, integrantes | `users/{uid}/profiles/{profileId}` | Execução de contrato a pedido do titular (art. 7º, V) |
| **Dados Financeiros do Orçamento** | Itens da cesta, histórico de preços, rendimentos nominais/líquidos, estratégias A/B/C, fechamentos mensais | Subcoleções isoladas sob `users/{uid}/*` | Execução de contrato a pedido do titular (art. 7º, V) |
| **Consentimento de Cookies (CMP)** | ID anônimo aleatório (`cmp_*`), escolhas (`essenciais`, `analytics`, `marketing`), versão do CMP e timestamp | `localStorage` + `users/{uid}/consentRecords/{recordId}` | Cumprimento de obrigação legal / prova de consentimento (art. 7º, I e II; art. 8º, § 2º) |
| **Aceite de Termos e Política** | Versão dos Termos (`TERMS_VERSION`), versão da Política (`POLICY_VERSION`), método e timestamp | `users/{uid}/termsAcceptances/{acceptanceId}` | Cumprimento de obrigação legal e exercício regular de direitos (art. 7º, II e VI) |
| **Solicitações do Art. 18** | Tipo do direito, descrição redigida pelo titular, status e histórico | `users/{uid}/privacyRequests/{requestId}` | Cumprimento de obrigação legal (art. 7º, II e art. 18) |
| **Demonstração Local** | Dados fictícios didáticos de cesta e renda no modo `/demo` | `localStorage` (`ipca_casa_demo_*`) | Consentimento / execução da simulação local sem envio ao servidor |

---

## 3. Operadores Externos e Fluxos de Dados (Art. 33 e 39 LGPD)

1. **Google Firebase (Authentication & Cloud Firestore):** autenticação com verificação obrigatória de e-mail (`email_verified == true` nas Security Rules), armazenamento criptografado em trânsito (TLS) e em repouso. Pode envolver transferência internacional para infraestrutura em nuvem do Google LLC com salvaguardas contratuais do Google Cloud.
2. **IBGE — APIs Públicas SIDRA (`apisidra.ibge.gov.br` / `servicodados.ibge.gov.br`):** consulta apenas séries macroeconômicas oficiais agregadas (Tabelas 1737 e 7060). **Nenhum dado pessoal ou financeiro do usuário é enviado ao IBGE.**
3. **Google Analytics 4 (`VITE_GA_MEASUREMENT_ID`, opcional):** bloqueado por padrão (`analytics_storage: denied`, `ad_storage: denied`, `ad_user_data: denied`, `ad_personalization: denied`). Carrega somente após opt-in expresso, com firewall em `src/services/analytics.ts` que remove chaves/valores contendo e-mail, UID, nome, renda, gasto ou `R$`.

---

## 4. Direitos dos Titulares Implementados (Art. 18 LGPD)

* **Transparência e Acesso (`/privacidade` e `/termos`):** detalhamento completo de finalidades, bases legais, operadores, retenção e canal de privacidade (`#contato-privacidade`).
* **Consentimento e Revogação (`AnalyticsConsentBanner.tsx`, `src/services/consent.ts`):** opções com peso visual equivalente (*"Recusar opcionais"* e *"Aceitar todos"*), gerenciamento granular em 3 categorias, reabertura via rodapé e central de privacidade, e limpeza de cookies `_ga`, `_gid`, `_gat`, `_gcl` na revogação.
* **Central *"Meus Dados e Privacidade (LGPD)"* (`src/components/PrivacyCenterSection.tsx`):**
  * Portabilidade e acesso completo em **JSON estruturado** e **CSV com proteção anti-fórmula** (`FirestoreService.exportAllUserDataBundle`).
  * Separação explícita entre **limpeza apenas dos dados financeiros** e **exclusão definitiva de conta**.
  * Registro e acompanhamento formal de solicitações do Art. 18 (`privacyRequests`) com validação estrita nas Security Rules.
  * **Exclusão integral de conta (`POST /api/privacy/delete-account`):** valida ID Token via Google Identity Toolkit (`accounts:lookup`), exige `emailVerified`, verifica janela de reautenticação recente (`<= 900s`), remove todas as subcoleções folha -> `profiles` -> `private/account` -> documento raiz `users/{uid}`, encerra a conta no Firebase Auth (`accounts:delete`) e limpa caches locais.

---

## 5. Limitações de Escopo e Responsabilidades do Controlador

* O repositório entrega a infraestrutura técnica; cabe ao controlador em produção definir `VITE_PRIVACY_*`, revisar prazos contratuais com operadores, gerenciar o fluxo operacional das solicitações recebidas pelo canal de privacidade e avaliar a necessidade ou dispensa de Encarregado conforme a Resolução CD/ANPD nº 2/2022 (agentes de pequeno porte).
