# IPCA-Casa: Arquitetura e Implementação da Lógica Econômica e Persistência

Transformação da interface visual do **IPCA-Casa (Índice Familiar)** em uma plataforma full-stack real, auditável e de alta precisão econométrica para mensuração da inflação doméstica, acompanhamento do poder de compra real e execução de estratégias de otimização orçamentária.

---

## User Review & Decisões Confirmadas

> [!IMPORTANT]
> **Decisões Alinhadas na Fase de Clarificação:**
> 1. **Mecanismo de Persistência:** Relacional compatível com MySQL/SQL com migrações tipadas e repositórios desacoplados para garantia de integridade transacional e histórico imutável de preços.
> 2. **Consulta ao IPCA Oficial do IBGE:** Integração direta com a API oficial do SIDRA/IBGE (Tabela 1737 / Série Histórica Nacional e Regional), acompanhada de cache de contingência e identificação transparente de metadados (código de série, período e data de coleta).
> 3. **Carga e Inicialização:** Pré-carregamento do cenário modelo didático da *Família Silva Oliveira (São Paulo - SP)* com botão imediato de alternância para cesta limpa (zero-state) e múltiplos perfis familiares.

---

## 1. Visão Geral e Conceito Central

- **O que faz:** Calcula o índice de inflação pessoal e familiar (*IPCA-Casa*) utilizando a metodologia do **Índice de Laspeyres Ponderado**, onde os pesos orçamentários de cada item são derivados da proporção dos gastos mensais em relação ao orçamento consolidado. Compara o índice com o IPCA oficial do IBGE, calcula o ganho ou perda real do poder de compra pós-inflação e simula três planos práticos de economia.
- **Público-alvo:** Famílias, gestores de finanças domésticas e estudantes em atividades de educação financeira que buscam compreender por que a inflação sentida diverge da média estatística nacional.
- **Valor agregado:** Substitui dados fictícios por cálculos econômicos puros, auditáveis e persistentes, permitindo diagnosticar "vilões" do orçamento (alto peso × alta variação) versus "efeito manchete" (alta variação com baixo peso orçamentário).

---

## 2. Experiência do Usuário e Design Visual

A interface preservará integralmente a identidade visual e o design system já aprovados, com as 8 seções acessíveis pela barra lateral:

1. **Visão Geral:** Termômetro da inflação doméstica, KPIs consolidados, histórico comparativo de 12 meses (IPCA-Casa vs. IBGE), distribuição da cesta por grupos e vilões do orçamento.
2. **Minha Cesta Familiar:** Gestão completa (CRUD) de itens, drawer deslizante de cadastro e edição, seleção de grupos IBGE, classificação econômica (*Essencial*, *Supérfluo*, *Não classificado*), ordenação dinâmica e modal de importação/exportação.
3. **Preços e Histórico:** Visualização da linha do tempo de cotações, evolução de preços unitários e registro de novas leituras/comprovantes fiscais.
4. **Análise da Inflação:** Decomposição econométrica profunda, fórmula de Laspeyres interativa, gráfico de dispersão (Variação vs. Peso), Top 5 Maiores Aumentos (%) vs. Top 5 Vilões Ponderados (p.p.) e tabela analítica auditável.
5. **Renda e Poder de Compra:** Variação nominal do salário vs. deflacionada, curva do índice de poder de compra (base 100), simulador de reajuste necessário para recomposição patrimonial e pressão por categoria de custo.
6. **Estratégias de Economia:**
   - *Plano A (Bens Sucedâneos):* Trade-offs de substituição com cálculo de economia mensal e impacto qualitativo.
   - *Plano B (Eficiência de Recursos):* Metas de redução de consumo físico (kWh, m³, Litros) e cálculo tarifário financeiro.
   - *Plano C (Custo de Oportunidade):* Reinvestimento do excedente em Renda Fixa Soberana (Tesouro Selic / CDB 100% CDI) com juros compostos e rentabilidade real estimada.
7. **Relatórios:** Geração de dossiê consolidado e exportação de dados em CSV e PDF formatados segundo as normas brasileiras.
8. **Configurações:** Gestão de perfis familiares, região de referência (São Paulo, Rio de Janeiro, Brasil etc.), moeda e preferências de exibição.

### Padrões Visuais e Rigor de Estilo
- **Zero-Pill & Tipografia:** Metadados estruturados com separadores limpos (`·`, `/`), tipografia `Geist` para interface e `JetBrains Mono` com números tabulares (`tabular-nums`) para todos os valores monetários e percentuais.
- **Paleta Semântica:** Verde esmeralda (`#006a61`) para alívio/ganho real e deflação; carmim suave (`#ba1a1a`) para pressão inflacionária e perda de poder aquisitivo; azul cobalto (`#497cff`) para séries oficiais do IBGE; ardósia neutra para estrutura e superfícies.

---

## 3. Decisões de Produto e Fórmulas Econômicas

### Fórmulas Centrais (Módulo Puro e Testável)
1. **Gasto Total:**
   $$G_{\text{total}} = \sum_{i=1}^n G_i$$
2. **Peso Orçamentário ($w_i$):**
   $$w_i = \frac{G_i}{G_{\text{total}}}, \quad \sum_{i=1}^n w_i = 100\%$$
3. **Variação Nominal de Preço ($\Delta P_i$):**
   $$\Delta P_i = \left(\frac{P_{i,1} - P_{i,0}}{P_{i,0}}\right) \times 100$$
4. **Contribuição Ponderada ($C_i$ em p.p.):**
   $$C_i = w_i \times \Delta P_i$$
5. **IPCA-Casa:**
   $$IPCA_{\text{Casa}} = \sum_{i=1}^n C_i$$
6. **Variação Nominal da Renda ($g$):**
   $$g = \left(\frac{R_1 - R_0}{R_0}\right) \times 100$$
7. **Variação Real do Poder de Compra ($r$):**
   $$r = \left(\frac{1 + g/100}{1 + \pi/100} - 1\right) \times 100$$
   *(Onde $\pi$ é o IPCA-Casa ou IPCA Oficial acumulado no mesmo período)*.
8. **Salário Necessário para Manutenção do Poder de Compra:**
   $$R_{\text{necessária}} = R_0 \times (1 + \pi/100) \times (1 + \text{GanhoReal}/100)$$
9. **Acumulação Oficial Multimensal (Produtório do IBGE):**
   $$\pi_{\text{acum}} = \left[\prod_{t=1}^m \left(1 + \frac{\pi_t}{100}\right) - 1\right] \times 100$$

---

## 4. Arquitetura Técnica e Estratégia de Dados

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Camada de Apresentação                         │
│  React 19 + Tailwind CSS + Lucide Icons + Motion + Recharts            │
│  (Páginas: Visão Geral, Cesta, Histórico, Inflação, Renda, Planos)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Requisições HTTP tipadas
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Camada de Serviços / API                         │
│  Express Server + TypeScript + Zod Validation                         │
│  - /api/profiles        (Gestão de famílias e regiões)                │
│  - /api/basket          (CRUD itens, gastos e pesos dinâmicos)        │
│  - /api/prices          (Histórico de cotações temporais)             │
│  - /api/analysis        (Cálculo Laspeyres e auditoria)               │
│  - /api/ibge            (Proxy SIDRA/IBGE com cache resiliente)        │
│  - /api/strategies      (Planos A, B e C e projeções financeiras)     │
│  - /api/reports         (Exportação CSV / PDF)                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Validação e Regras Puras
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Motor de Domínio & Persistência                    │
│  - Modulo Econômico Puro (src/services/economics.ts)                 │
│  - Banco de Dados Relacional (MySQL / SQL com repositório estruturado)│
│  - Suite de Testes Automatizados (Vitest - Testes A a G obrigatórios)  │
└────────────────────────────────────────────────────────────────────────┘
```

### Entidades do Banco de Dados
- **FamilyProfile:** `id`, `name`, `referenceRegion`, `currency`, `createdAt`, `updatedAt`.
- **ConsumptionGroup:** `id`, `name`, `code`, `icon`, `color`.
- **BasketItem:** `id`, `profileId`, `groupId`, `name`, `description`, `classification` (*ESSENTIAL | SUPERFLUOUS | UNCLASSIFIED*), `monthlySpend`, `unit`, `active`.
- **PriceHistory:** `id`, `itemId`, `price`, `referenceDate`, `source`, `createdAt`.
- **IncomeHistory:** `id`, `profileId`, `nominalIncome`, `referenceDate`, `notes`.
- **SavingStrategy:** `id`, `profileId`, `planType` (*PLAN_A | PLAN_B | PLAN_C*), `title`, `description`, `originalValue`, `targetValue`, `savedMonthlyAmount`, `status`.

---

## 5. Plano de Implementação e Verificação

1. **Camada de Domínio Econômico & Testes:**
   - Implementação das funções puras de cálculo (`economics.ts`).
   - Cobertura de testes automatizados com Vitest para os cenários obrigatórios (Preço estável, aumento, redução, pesos orçamentários, inflação ponderada, poder de compra e entradas inválidas/divisão por zero).
2. **Camada de Dados & Persistência Relacional:**
   - Criação dos repositórios e serviços de dados com suporte ao modelo de dados MySQL/SQL e fallback transparente para persistência local transacional.
   - Inclusão do seed com o perfil didático e botão de reset/zeramento.
3. **Serviço de Integração com o IBGE (SIDRA):**
   - Criação do cliente de consulta à API do SIDRA (série 1737 do IPCA) com cálculo de acumulação geométrica mensal e cache local de contingência.
4. **Integração das Telas e Componentes React:**
   - Conexão de todas as telas existentes da navegação lateral aos serviços reais com estados de loading, feedback de salvamento e validação de formulários.
   - Ativação do Drawer de Cadastro, Filtros da Cesta, Simulações de Reajuste e Estratégias A, B e C.
5. **Módulo de Relatórios & Exportação:**
   - Geração de planilha CSV detalhada com colunas estruturadas e emissão de relatório PDF imprimível/para download com síntese metodológica.
6. **Compilação e Verificação Final:**
   - Execução de `compile_applet` e validação de ausência de erros de compilação ou tipos no TypeScript estrito.
