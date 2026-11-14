# Checklist de Configuração Externa de Privacidade e Produção — IPCA-Casa

O código-fonte implementa controles técnicos de conformidade LGPD no repositório, porém **a efetividade em produção depende das configurações externas abaixo** realizadas pelo operador/controlador:

## 1. Identificação do Controlador e Encarregado (DPO)
Configure as seguintes variáveis públicas de build/runtime (ou edite `VITE_PRIVACY_*` no ambiente de deploy):
- `VITE_PRIVACY_CONTROLLER_NAME`: Razão social ou nome completo do controlador responsável.
- `VITE_PRIVACY_CONTROLLER_DOC`: CNPJ ou CPF do controlador.
- `VITE_PRIVACY_CONTROLLER_ADDRESS`: Endereço físico/comercial para notificações.
- `VITE_PRIVACY_CONTACT_EMAIL`: E-mail oficial de atendimento aos titulares (ex.: canal de privacidade).
- `VITE_PRIVACY_DPO_NAME`: Nome do Encarregado pelo Tratamento de Dados Pessoais (ou anotação formal de dispensa conforme Resolução CD/ANPD nº 2/2022, mantendo canal de atendimento ao titular).

> Enquanto não definidas, a interface exibirá `"Pendente de definição pelo controlador"`.

## 2. Firebase Authentication e Cloud Firestore
- **Domínios Autorizados (Auth -> Settings -> Authorized domains):** manter apenas `localhost` (dev), domínio oficial e preview autorizada.
- **Verificação de E-mail:** manter verificação habilitada; as regras em `firestore.rules` bloqueiam leitura/escrita se `email_verified != true`.
- **Backup / Snapshots do Firestore:** definir política de retenção de backups e reconciliação caso um titular solicite exclusão após restauração de snapshot.
- **Deploy de Regras:** sempre validar com `npx eslint firestore.rules` e publicar `firestore.rules` após alterações.
- **Opcional (Firebase Admin SDK):** no ambiente atual, a exclusão em cascata via `POST /api/privacy/delete-account` opera com o token reautenticado do próprio titular via REST APIs oficiais do Firestore e Identity Toolkit (`accounts:lookup` + `accounts:delete`), dispensando Service Account privada. Caso opte futuramente por auditoria administrativa server-side, utilize credencial mínima via Secret Manager (nunca versionada no Git).

## 3. Google Analytics 4 (`VITE_GA_MEASUREMENT_ID`)
- Definir apenas se desejar medição agregada em produção.
- No console do GA4:
  - Desativar **Google Signals** e compartilhamento publicitário se não houver base específica.
  - Configurar retenção de dados de eventos para o menor período aplicável (ex.: 2 meses).
  - Manter o Consent Mode v2 ativo (já gerenciado por `src/services/analytics.ts`).

## 4. Domínio Customizado, HTTPS, Logs e CSP
- Definir `VITE_SITE_URL` e `ALLOWED_ORIGINS` com `https://` em produção para redirecionamento canônico (301) e restrição estrita de CORS.
- Configurar retenção máxima e anonimização de IPs nos logs HTTP do provedor de hospedagem (Cloud Run / proxy reverso / CDN).
- Verificar cabeçalhos Helmet/CSP em `server.ts` caso adicione novos domínios externos autorizados.
