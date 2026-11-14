# Plano de Resposta a Incidentes de Segurança com Dados Pessoais — IPCA-Casa

Referências normativas: **Art. 48 da Lei nº 13.709/2018 (LGPD)** e **Resolução CD/ANPD nº 15/2024** (Regulamento de Comunicação de Incidentes de Segurança — CIS).

## 1. Critérios de Acionamento
Este plano aplica-se a qualquer evento confirmado ou suspeito que comprometa confidencialidade, integridade ou disponibilidade de dados pessoais tratados pelo IPCA-Casa e possa acarretar risco ou dano relevante aos titulares (ex.: acesso indevido a coleções Firestore, vazamento de credenciais/tokens, alteração não autorizada ou indisponibilidade prolongada).

## 2. Fluxo Operacional de Resposta
1. **Detecção e Triagem Inicial (0–4h):** registrar horário, escopo afetado, componentes (`server.ts`, `firestore.rules`, Firebase Auth, variáveis de ambiente) e preservar evidências sem expor segredos em canais abertos.
2. **Contenção Imediata (4–12h):**
   - Revogar chaves/tokens comprometidos e rotacionar variáveis de ambiente (`GEMINI_API_KEY`, chaves de API ou credenciais administrativas, se houver).
   - Endurecer `firestore.rules` e publicar via deploy imediato caso haja brecha de autorização.
   - Bloquear origens abusivas no `ALLOWED_ORIGINS` / rate limiter / WAF.
3. **Avaliação de Risco aos Titulares:** verificar se houve acesso a dados financeiros, credenciais, e-mails (`users/{uid}/private/account`) ou impacto em larga escala.
4. **Comunicação à ANPD e aos Titulares (Art. 48 LGPD + Resolução CD/ANPD nº 15/2024):**
   - **Prazo padrão:** até **3 (três) dias úteis** contados do conhecimento do incidente pelo controlador, quando houver risco ou dano relevante.
   - **Agentes de tratamento de pequeno porte (Resolução CD/ANPD nº 2/2022 + nº 15/2024):** caso o controlador se enquadre formalmente como agente de pequeno porte, aplica-se o prazo em dobro (**6 dias úteis**), devendo essa condição ser documentada previamente.
   - **Comunicação complementar:** caso nem todas as informações estejam completas dentro do prazo inicial, enviar comunicação preliminar e complementar em até **20 (vinte) dias úteis** conforme regulamento da ANPD.
5. **Guarda de Registro Interno:** mesmo quando não houver necessidade de notificação externa (ausência de risco ou dano relevante), manter o registro documentado do incidente por no mínimo **5 (cinco) anos** contados da data do registro (Art. 10 da Resolução CD/ANPD nº 15/2024).

## 3. Modelo de Registro Interno de Incidente

```text
ID DO INCIDENTE:
DATA/HORA DA DETECÇÃO:
DATA/HORA PROVÁVEL DA OCORRÊNCIA:
RESPONSÁVEL PELA TRIAGEM:
SISTEMAS / COLEÇÕES AFETADOS:
NATUREZA DO INCIDENTE (Confidencialidade / Integridade / Disponibilidade):
TITULARES AFETADOS (Quantidade estimada e categorias de dados):
RISCO OU DANO RELEVANTE IDENTIFICADO? (Sim / Não + justificativa):
ENQUADRAMENTO PRAZO ANPD (3 dias úteis ou 6 dias úteis se pequeno porte):
AÇÕES DE CONTENÇÃO ADOTADAS:
DATA DE COMUNICAÇÃO À ANPD (se aplicável):
DATA DE COMUNICAÇÃO AOS TITULARES (se aplicável):
LIÇÕES APRENDIDAS E AÇÕES PREVENTIVAS (prazo de retenção do registro: 5 anos):
```
