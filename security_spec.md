# Especificação de Segurança Firestore — IPCA-Casa

## 1. Invariantes de Dados (Data Invariants)
1. **Isolamento Total por Titular (`request.auth.uid`):** Nenhum usuário autenticado ou anônimo pode ler, listar, criar, alterar ou excluir registros pertencentes a outro `userId`.
2. **E-mail Verificado Obrigatório:** Toda leitura e escrita autenticada exige `request.auth != null` e `request.auth.token.email_verified == true`.
3. **Isolamento de PII (Split Collection):** O e-mail do usuário (`email`) é armazenado isoladamente em `/users/{userId}/private/account`, separado dos metadados públicos de sessão em `/users/{userId}`.
4. **Integridade Referencial (Master Gate + Parent Existence):**
   - Subcoleções sob `/users/{userId}/*` exigem a existência prévia do documento pai `/users/{userId}` em operações de leitura unitária (`get`) e escrita (`create`, `update`, `delete`).
   - Um `BasketItem`, `IncomeRecord` ou `SavingStrategy` não pode ser criado sem um `FamilyProfile` existente em `/users/{userId}/profiles/{profileId}`.
   - Um `PriceRecord` não pode ser criado sem um `BasketItem` existente em `/users/{userId}/basketItems/{itemId}`.
5. **Imutabilidade & Integridade Temporal:** `id`, `userId`, `createdAt` (e chaves relacionais `profileId`/`itemId`/`planType`) são imutáveis após a criação. Todos os campos `createdAt` e `updatedAt` são validados estritamente contra `request.time`.
6. **Limites Volumétricos e Regex de IDs:** Todos os IDs de documentos e referências devem obedecer `^[a-zA-Z0-9_-]+$` com no máximo 128 caracteres; todas as strings possuem limite explícito de tamanho (`.size()`).
7. **Listagens Seguras (Query Enforcer):** Toda regra `allow list` valida `resource.data.userId == request.auth.uid` sem executar `get()`/`exists()` em consultas de lista. Listagem da coleção raiz `/users` é bloqueada (`allow list: if false`).

---

## 2. Os 12 Payloads Adversariais ("Dirty Dozen")

1. **Identity Spoofing na Criação:** Usuário A autenticado tenta criar `/users/{userA}/profiles/p1` com `userId: "{userB}"`. Esperado: `PERMISSION_DENIED`.
2. **Cross-Tenant Read/List:** Usuário A tenta ler `/users/{userB}/basketItems/item1` ou listar `/users/{userB}/basketItems`. Esperado: `PERMISSION_DENIED`.
3. **Unverified Email Bypass:** Usuário com token `email_verified: false` tenta gravar em `/users/{userA}/private/account`. Esperado: `PERMISSION_DENIED`.
4. **Shadow Field Injection ("Ghost Field"):** Usuário tenta criar/atualizar `FamilyProfile` enviando campo extra não declarado `isAdmin: true` ou `role: "superadmin"`. Esperado: `PERMISSION_DENIED` (bloqueado por `hasOnly`).
5. **Orphan BasketItem (Sem Perfil Pai):** Usuário tenta criar `/users/{userA}/basketItems/item99` apontando para `profileId: "prof_inexistente"`. Esperado: `PERMISSION_DENIED`.
6. **Orphan PriceRecord (Sem Item Pai):** Usuário tenta criar `/users/{userA}/priceHistory/pr99` apontando para `itemId: "item_inexistente"`. Esperado: `PERMISSION_DENIED`.
7. **ID Poisoning (1.5KB Document ID):** Usuário tenta criar `/users/{userA}/profiles/{1500_chars}` ou com caracteres inválidos (`../../admin`). Esperado: `PERMISSION_DENIED`.
8. **Payload Exhaustion ("Denial of Wallet"):** Usuário envia `BasketItem.notes` com 5.000 caracteres (> limite de 1.000). Esperado: `PERMISSION_DENIED`.
9. **Type Confusion ("Value Poisoning"):** Usuário envia atualização alterando `monthlySpend` para string `"1000"` ou `classification` para `"VIP"`. Esperado: `PERMISSION_DENIED`.
10. **Immutable Timestamp Tampering:** Usuário cria documento com `createdAt: "2020-01-01T00:00:00Z"` em vez de `request.time` ou tenta alterar `createdAt` em `update`. Esperado: `PERMISSION_DENIED`.
11. **Immutable Ownership Hijack on Update:** Usuário tenta atualizar `BasketItem` mudando `userId` ou `profileId`. Esperado: `PERMISSION_DENIED`.
12. **PII Leak Attempt:** Usuário autenticado tenta listar `/users` ou ler `/users/{otherUid}/private/account`. Esperado: `PERMISSION_DENIED`.
