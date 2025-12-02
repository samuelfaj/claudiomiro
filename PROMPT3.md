# PROMPT3: Sistema de Arquivos Assertivo para Execução de Tasks

## Por Que Esta Refatoração?

### Problemas do Sistema Atual (5 arquivos)

O sistema atual gera **TASK.md, PROMPT.md, TODO.md, RESEARCH.md, CONTEXT.md** por task. Isso causa:

| Problema | Causa | Impacto |
|----------|-------|---------|
| **Context Losing** | Contexto fragmentado em 5 arquivos | Claude perde informação ao navegar entre arquivos |
| **Hallucination** | Múltiplos pontos de referência sem prioridade clara | Claude inventa quando não encontra a informação |
| **Tasks Incompletas** | Sem verificação obrigatória de completude | Tasks marcadas "done" com código faltando |
| **Redundância** | Contexto reconstruído 3x (Steps 4, 5, 6) | ~6000 tokens desperdiçados por task |
| **Prompt Leakage** | Estrutura similar entre arquivos | Confusão sobre qual é a fonte de verdade |
| **Oversmoothing** | Templates genéricos | Respostas vagas como "seguir best practices" |
| **Confiança Servil** | Sem mecanismo para sinalizar incerteza | Claude afirma coisas que não tem certeza |

### Evidências do Código Atual

```javascript
// step4/generate-todo.js:54-58 - Só usa 500 chars do TASK.md
const taskDescription = fs.readFileSync(taskMdPath, 'utf8').substring(0, 500);

// step5/index.js:117-122 - Reconstrói contexto (já feito no Step 4)
const consolidatedContext = await buildConsolidatedContextAsync(...);

// step6/review-code.js:47-70 - Reconstrói contexto NOVAMENTE
const context = await buildOptimizedContextAsync(...);
```

**Resultado**: 90% do TASK.md nunca é lido, PROMPT.md raramente consumido, contexto construído 3x.

---

## Solução: Sistema 2-Arquivos

### Arquitetura Nova

```
TASK{N}/
├── BLUEPRINT.md   ← Single Source of Truth (read-only após criação)
├── execution.json ← Machine State (atualizado durante execução)
├── info.json      ← Metadata (mantido)
└── CODE_REVIEW.md ← Review (mantido)
```

### Por Que 2 Arquivos?

| Arquivo | Propósito | Quando Modificado |
|---------|-----------|-------------------|
| **BLUEPRINT.md** | O QUE fazer, POR QUE, COM BASE EM QUÊ | Nunca (criado no Step 2, read-only depois) |
| **execution.json** | STATUS estruturado, EVIDÊNCIAS, INCERTEZAS | Durante toda execução |

### Por Que JSON para Execution?

| Aspecto | Markdown | JSON |
|---------|----------|------|
| **Estrutura forçada** | ❌ Claude pode "enrolar" | ✅ Campos obrigatórios |
| **Status explícito** | "Acho que terminei..." | `"status": "completed"` |
| **Evidência** | Pode esquecer | Campo obrigatório |
| **Validação** | Difícil | Schema validation |
| **Anti-hallucination** | Texto livre = mais fluff | Estrutura = menos invenção |

**Analogia**: BLUEPRINT é a planta da casa (não muda). execution.json é o checklist de obra (campos obrigatórios, status claro).

---

## BLUEPRINT.md - Estrutura Detalhada

### Seção 1: IDENTITY (Anti-Hallucination)

**Por que existe**: Claude precisa saber exatamente o que FAZER e o que NÃO FAZER. Sem isso, ele "ajuda demais" ou inventa escopo.

```markdown
## 1. IDENTITY

### This Task IS:
- Criar endpoint POST /api/users para cadastro
- Implementar validação de email único
- Retornar 201 com user criado ou 400 com erros

### This Task IS NOT:
- Criar frontend de cadastro (TASK3 fará isso)
- Implementar autenticação/login (TASK4 fará isso)
- Modificar schema do banco (já existe)

### Anti-Hallucination Anchors:
- Se model User não existir: BLOCKER (não criar, reportar)
- Se endpoint /api/users já existir: Verificar se é GET, não sobrescrever
- Padrão de resposta: Seguir EXATAMENTE src/api/health.js:20-35
```

**Regra**: Se algo não está em "This Task IS", Claude NÃO DEVE fazer.

### Seção 2: CONTEXT CHAIN (Hierarquia Clara)

**Por que existe**: Claude lê arquivos em ordem aleatória e perde prioridade. Esta seção força ordem de leitura.

```markdown
## 2. CONTEXT CHAIN

### Priority 0 - LEGACY REFERENCE (Se Disponível):
⚠️ **READ-ONLY:** Estes sistemas são apenas para referência. NÃO modifique código legado.

- `${legacySystemPath}` → Sistema legado completo (business logic, padrões)
- `${legacyBackendPath}` → Backend legado (APIs, services, models)
- `${legacyFrontendPath}` → Frontend legado (componentes, patterns UI)

**Como usar:**
1. Use código legado como referência para business logic e patterns
2. NÃO copie código legado diretamente - adapte e modernize
3. NÃO modifique arquivos nos paths de sistemas legados
4. Documente regras de negócio descobertas no código legado

### Priority 1 - LER PRIMEIRO (Obrigatório):
- `AI_PROMPT.md:1-50` → Tech stack: Node.js, Express, Prisma
- `prisma/schema.prisma:45-60` → Model User já existe

### Priority 2 - LER ANTES DE CODAR:
- `src/api/health.js:20-35` → Padrão de response
- `src/validators/email.js` → Validador reutilizável

### Priority 3 - REFERÊNCIA SE NECESSÁRIO:
- `src/middleware/error-handler.js` → Como erros são tratados
- `tests/api/health.test.js` → Padrão de testes

### Inherited From Dependencies:
- TASK0: Criou estrutura base em src/api/
- TASK1: Configurou Prisma com model User
```

**Regra**: Ler na ordem. Se Priority 1 não fizer sentido, PARAR e reportar.

### Seção 3: EXECUTION CONTRACT (Verificações)

**Por que existe**: Claude começa a codar sem verificar se tem tudo que precisa. Isso causa hallucination.

```markdown
## 3. EXECUTION CONTRACT

### 3.1 Pre-Conditions (VERIFICAR ANTES DE QUALQUER CÓDIGO):

| Check | Comando | Esperado |
|-------|---------|----------|
| Model User existe | `grep -n "model User" prisma/schema.prisma` | Match na linha ~45 |
| Validator existe | `ls src/validators/email.js` | Arquivo existe |
| Express configurado | `grep -n "app.use.*json" src/app.js` | Match existe |

**HARD STOP**: Se QUALQUER check falhar:
1. NÃO escrever código
2. Marcar task como BLOCKED
3. Atualizar execution.json: `"status": "blocked"` + reason

### 3.2 Success Criteria (VERIFICAR APÓS COMPLETAR):

| Critério | Verificação | Comando |
|----------|-------------|---------|
| Endpoint responde | curl test | `curl -X POST localhost:3000/api/users -d '{"email":"test@test.com"}' -H "Content-Type: application/json"` |
| Testes passam | npm test | `npm test src/api/users.test.js --silent` |
| Lint passa | npm lint | `npm run lint src/api/users.js --quiet` |

### 3.3 Output Artifacts:

| Artifact | Tipo | Path | Verificação |
|----------|------|------|-------------|
| Endpoint | CREATE | `src/api/users.js` | `ls src/api/users.js` |
| Testes | CREATE | `src/api/users.test.js` | `ls src/api/users.test.js` |
| Route registration | MODIFY | `src/app.js` | `grep "users" src/app.js` |
```

**Regra**: Não marcar "Fully implemented: YES" até TODOS os Success Criteria passarem.

### Seção 4: IMPLEMENTATION STRATEGY (Fases)

**Por que existe**: Claude pula etapas quando a task parece simples. Fases forçam execução completa.

```markdown
## 4. IMPLEMENTATION STRATEGY

### Phase 1: Preparation
1. Executar TODOS os Pre-Condition checks
2. Ler arquivos de Priority 1 e 2
3. Adicionar incertezas em execution.json `uncertainties[]`

**Gate**: Só prosseguir se todos checks passarem.

### Phase 2: Core Implementation
1. Criar `src/api/users.js`
   - Seguir padrão de `src/api/health.js:20-35`
   - Importar validator de `src/validators/email.js`
   - Usar Prisma client de `src/lib/prisma.js`

2. Estrutura obrigatória:
   ```javascript
   // src/api/users.js
   const { Router } = require('express');
   const { validateEmail } = require('../validators/email');
   const prisma = require('../lib/prisma');

   const router = Router();

   router.post('/', async (req, res) => {
     // Implementação
   });

   module.exports = router;
   ```

**Gate**: Código compila (`node --check src/api/users.js`)

### Phase 3: Testing
1. Criar `src/api/users.test.js`
   - Seguir padrão de `tests/api/health.test.js`
   - Testar: happy path, email inválido, email duplicado

2. Executar: `npm test src/api/users.test.js --silent`

**Gate**: Todos testes passam.

### Phase 4: Integration
1. Registrar route em `src/app.js`:
   ```javascript
   const usersRouter = require('./api/users');
   app.use('/api/users', usersRouter);
   ```

2. Verificar: `npm test --silent` (todos os testes)

**Gate**: Nenhum teste quebrou.

### Phase 5: Validation
1. Executar TODOS os Success Criteria (seção 3.2)
2. Executar "Beyond the Basics" checklist
3. Atualizar execution.json `completion.status` com resultados
```

### Seção 5: UNCERTAINTY LOG

**Por que existe**: Claude não admite quando não sabe algo. Isso leva a hallucination.

```markdown
## 5. UNCERTAINTY LOG

### Incertezas Identificadas Durante Planejamento:

| ID | Tópico | Suposição | Confiança | Evidência |
|----|--------|-----------|-----------|-----------|
| U1 | Hash de senha | Assumo que bcrypt já está instalado | MEDIUM | Não vi no package.json, mas é padrão |
| U2 | Formato de erro | Assumo `{ error: string }` | HIGH | Visto em src/api/health.js:30 |

### Regra de Parada:
Se confiança for LOW em decisão crítica (segurança, dados, breaking change):
→ PARAR
→ Marcar BLOCKED
→ Documentar o que precisa ser esclarecido
```

### Seção 6: INTEGRATION IMPACT

**Por que existe**: Claude modifica arquivos sem verificar quem mais os usa.

```markdown
## 6. INTEGRATION IMPACT

### Arquivos que Serão Modificados:

| Arquivo | Modificação | Quem Importa | Impacto |
|---------|-------------|--------------|---------|
| `src/app.js` | Adicionar route | - | Nenhum (adição) |

### Arquivos que Serão Criados:

| Arquivo | Importa De | Exporta |
|---------|------------|---------|
| `src/api/users.js` | validators/email, lib/prisma | router |
| `src/api/users.test.js` | api/users, supertest | - |

### Breaking Changes:
NENHUM - Esta task só adiciona, não modifica comportamento existente.
```

---

## execution.json - Schema Detalhado

### Por Que JSON?

JSON força o agente de IA a ser **assertivo e estruturado**:
- ❌ Markdown: "Acho que terminei a fase 2..."
- ✅ JSON: `{ "phase": 2, "status": "completed", "evidence": "..." }`

### Schema Completo

```json
{
  "$schema": "execution-schema-v1",
  "version": "1.0",
  "task": "TASK2",
  "title": "Create User Endpoint",
  "status": "in_progress",
  "started": "2025-12-02T10:00:00Z",
  "attempts": 1,

  "currentPhase": {
    "id": 2,
    "name": "Core Implementation",
    "lastAction": "Creating src/api/users.js"
  },

  "phases": [
    {
      "id": 1,
      "name": "Preparation",
      "status": "completed",
      "started": "2025-12-02T10:00:00Z",
      "completed": "2025-12-02T10:05:00Z",
      "preConditions": [
        {
          "check": "Model User exists",
          "command": "grep -n 'model User' prisma/schema.prisma",
          "expected": "Match na linha ~45",
          "passed": true,
          "evidence": "prisma/schema.prisma:47"
        },
        {
          "check": "Validator exists",
          "command": "ls src/validators/email.js",
          "expected": "File exists",
          "passed": true,
          "evidence": "exit code 0"
        },
        {
          "check": "Express configured",
          "command": "grep -n 'app.use.*json' src/app.js",
          "expected": "Match exists",
          "passed": true,
          "evidence": "src/app.js:12"
        }
      ]
    },
    {
      "id": 2,
      "name": "Core Implementation",
      "status": "in_progress",
      "started": "2025-12-02T10:05:00Z",
      "completed": null,
      "actions": [
        {
          "description": "Create src/api/users.js",
          "done": true,
          "pattern": "src/api/health.js:20-35",
          "deviation": "Added rate limiting (security)"
        },
        {
          "description": "Register route in app.js",
          "done": false
        }
      ],
      "compilationCheck": {
        "command": "node --check src/api/users.js",
        "passed": true
      }
    },
    {
      "id": 3,
      "name": "Testing",
      "status": "pending",
      "started": null,
      "completed": null
    },
    {
      "id": 4,
      "name": "Integration",
      "status": "pending",
      "started": null,
      "completed": null
    },
    {
      "id": 5,
      "name": "Validation",
      "status": "pending",
      "started": null,
      "completed": null
    }
  ],

  "uncertainties": [
    {
      "id": "U1",
      "topic": "bcrypt installed?",
      "assumption": "Assumed installed (common package)",
      "confidence": "MEDIUM",
      "resolution": "VERIFIED: package.json:15",
      "resolvedConfidence": "HIGH",
      "timestamp": "2025-12-02T10:03:00Z"
    },
    {
      "id": "U3",
      "topic": "Rate limit needed?",
      "assumption": "Not in requirements",
      "confidence": "LOW",
      "resolution": "ADDED: Security best practice for public endpoint",
      "resolvedConfidence": "MEDIUM",
      "timestamp": "2025-12-02T10:08:00Z"
    }
  ],

  "errors": [
    {
      "timestamp": "2025-12-02T10:07:00Z",
      "phase": 2,
      "error": "Import path wrong",
      "resolution": "Fixed to '../lib/prisma'",
      "resolved": true
    }
  ],

  "artifacts": [
    {
      "type": "created",
      "path": "src/api/users.js",
      "verified": true,
      "verification": "ls exit code 0"
    },
    {
      "type": "created",
      "path": "src/api/users.test.js",
      "verified": false,
      "verification": null
    },
    {
      "type": "modified",
      "path": "src/app.js",
      "verified": false,
      "verification": null
    }
  ],

  "beyondTheBasics": {
    "extras": [
      { "item": "Rate limiting", "reason": "security", "done": true },
      { "item": "Input sanitization", "reason": "security", "done": true },
      { "item": "Structured logging", "reason": "observability", "done": false }
    ],
    "edgeCases": [
      { "case": "Input null/undefined", "handling": "Returns 400", "tested": true },
      { "case": "Invalid email", "handling": "Returns 400 with message", "tested": true },
      { "case": "Duplicate email", "handling": "Returns 409", "tested": true }
    ],
    "downstreamImpact": {
      "command": "grep -r 'import.*users' src/",
      "result": "No importers yet",
      "testsPass": true,
      "testCommand": "npm test --silent"
    },
    "cleanup": {
      "debugLogsRemoved": true,
      "formattingConsistent": true,
      "deadCodeRemoved": false
    }
  },

  "completion": {
    "status": "pending_validation",
    "summary": [
      "POST /api/users endpoint created",
      "Email validation implemented",
      "Tests created (3 scenarios)",
      "Rate limiting added (extra)"
    ],
    "deviations": [
      {
        "what": "Added rate limiting",
        "why": "Basic security for public endpoint"
      }
    ],
    "forFutureTasks": [
      "Rate limiter can be extracted to reusable middleware",
      "Validation pattern can become helper"
    ]
  }
}
```

### Campos Obrigatórios (Schema Validation)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `status` | enum | ✅ | `pending`, `in_progress`, `completed`, `blocked` |
| `phases[].status` | enum | ✅ | Status de cada fase |
| `phases[].preConditions[].passed` | boolean | ✅ | Resultado do check |
| `phases[].preConditions[].evidence` | string | ✅ | Prova do resultado |
| `artifacts[].verified` | boolean | ✅ | Se foi verificado |
| `completion.status` | enum | ✅ | Status final |

### Regras de Transição de Status

```
pending → in_progress → completed
                     ↘ blocked (se pre-condition falhar)
```

**REGRA**: Só pode marcar `"status": "completed"` se:
- Todos `preConditions[].passed === true`
- Todos `artifacts[].verified === true`
- `beyondTheBasics.cleanup` tudo `true`

---

## Mecanismos de Enforcement

### 1. Pre-Condition Gate (Anti-Hallucination)

**Implementação no código**:

```javascript
// step5/pre-condition-verifier.js
const verifyPreConditions = async (blueprintPath) => {
  const blueprint = fs.readFileSync(blueprintPath, 'utf8');
  const preConditions = extractPreConditions(blueprint);

  const results = [];
  for (const condition of preConditions) {
    const { check, command, expected } = condition;
    const result = await executeCommand(command);
    const passed = result.includes(expected);

    results.push({ check, passed, evidence: result });

    if (!passed) {
      return {
        blocked: true,
        reason: `Pre-condition failed: ${check}`,
        evidence: result
      };
    }
  }

  return { blocked: false, results };
};
```

### 2. Phase Gate (Completude)

**Implementação no prompt**:

```markdown
## PHASE EXECUTION PROTOCOL

ANTES de cada fase, Claude DEVE output:
→ "🔵 [PHASE {N}] Starting: {nome da fase}"

APÓS cada fase, Claude DEVE output:
→ "✅ [PHASE {N}] Complete" + verificação
OU
→ "❌ [PHASE {N}] Failed: {motivo}" + ação corretiva

REGRA: Se Phase N não completar com sucesso, NÃO iniciar Phase N+1.
```

### 3. Beyond the Basics (Ir Além)

**Checklist obrigatório no final**:

```markdown
## FINAL VERIFICATION (Obrigatório antes de "Fully implemented: YES")

### Basics:
- [ ] Todos os items do BLUEPRINT.md implementados
- [ ] Todos os Success Criteria passam
- [ ] Testes passam

### Beyond:
- [ ] Error handling em todos os pontos de falha
- [ ] Edge cases cobertos (null, empty, invalid)
- [ ] Não introduzi vulnerabilidades (injection, XSS)

### Impact:
- [ ] Verifiquei todos os importadores do arquivo modificado
- [ ] Nenhum teste existente quebrou
- [ ] Build passa

### Cleanup:
- [ ] Console.logs removidos
- [ ] Código morto removido
- [ ] Formatação consistente

**REGRA**: Se QUALQUER item acima for NO → Task NÃO está completa.
```

---

## Fluxo de Execução Completo

```
┌─────────────────────────────────────────────────────────────┐
│                        STEP 1                               │
│  Gera AI_PROMPT.md                                          │
│  - Transforma request do usuário em prompt estruturado      │
│  - Injeta Legacy System Context (se --legacy-* flags)       │
│  - Injeta Multi-Repo Context (se --backend/--frontend)      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        STEP 2                               │
│  Gera BLUEPRINT.md (substitui TASK.md + PROMPT.md)          │
│  - Analisa codebase                                         │
│  - Define IDENTITY (IS/IS NOT)                              │
│  - Mapeia CONTEXT CHAIN (inclui Legacy Systems se houver)   │
│  - Cria Pre-Conditions                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        STEP 4                               │
│  Gera execution.json inicial (substitui TODO.md)            │
│  - Cria estrutura de phases com status "pending"            │
│  - Inicializa arrays vazios (uncertainties, errors, etc)    │
│  - Schema validation antes de salvar                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        STEP 5                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Phase 1: PREPARATION                                 │   │
│  │ - Executa Pre-Condition checks                       │   │
│  │ - Se falhar → BLOCKED                                │   │
│  │ - Se passar → Prossegue                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Phase 2: CORE IMPLEMENTATION                         │   │
│  │ - Segue BLUEPRINT.md phases                          │
│  │ - Atualiza execution.json (status, actions)                │
│  │ - Documenta uncertainties                            │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Phase 3: TESTING                                     │   │
│  │ - Cria testes                                        │   │
│  │ - Executa testes                                     │   │
│  │ - Se falhar → Fix antes de prosseguir                │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Phase 4: INTEGRATION                                 │   │
│  │ - Integra com código existente                       │   │
│  │ - Verifica downstream impact                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Phase 5: VALIDATION                                  │   │
│  │ - Executa Success Criteria                           │   │
│  │ - Executa Beyond the Basics checklist                │   │
│  │ - Só marca completion.status: "completed" se TUDO passar   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        STEP 6                               │
│  Code Review                                                │
│  - Lê BLUEPRINT.md (o que deveria ser feito)                │
│  - Lê execution.json (status, artifacts, deviations)        │
│  - Valida: todos phases[].status === "completed"            │
│  - Verifica: beyondTheBasics.cleanup all true               │
└─────────────────────────────────────────────────────────────┘
```

---

## Economia de Tokens

### Antes (Sistema 5-Arquivos)

| Step | Ação | Tokens |
|------|------|--------|
| Step 2 | Criar TASK.md + PROMPT.md | ~3,000 |
| Step 4 | Criar TODO.md + buildOptimizedContextAsync | ~6,000 |
| Step 5 | Criar RESEARCH.md + buildConsolidatedContextAsync | ~8,000 |
| Step 5 | Criar CONTEXT.md | ~1,000 |
| Step 6 | Code review + buildOptimizedContextAsync | ~5,000 |
| **Total** | | **~23,000** |

### Depois (Sistema 2-Arquivos)

| Step | Ação | Tokens |
|------|------|--------|
| Step 2 | Criar BLUEPRINT.md (consolidado) | ~4,000 |
| Step 4 | Criar execution.json (estrutura) | ~1,500 |
| Step 5 | Executar (BLUEPRINT read-only, execution.json update) | ~3,500 |
| Step 6 | Code review (BLUEPRINT + execution.json) | ~1,500 |
| **Total** | | **~10,500** |

**Economia: ~54% (12,500 tokens/task)**

---

## Resumo: Por Que Cada Decisão

| Decisão | Por Quê |
|---------|---------|
| **2 arquivos** | Menos fragmentação = menos context losing |
| **BLUEPRINT read-only** | Source of truth não muda = sem confusão |
| **execution.json** | Estado estruturado, validável, sem ambiguidade |
| **Pre-conditions** | Claude verifica antes de inventar |
| **Phase gates** | Claude não pula etapas |
| **IS/IS NOT sections** | Claude sabe exatamente o escopo |
| **Evidence-based** | Toda ação cita file:line, não "best practice" |
| **Uncertainty log** | Claude pode admitir que não sabe |
| **Beyond the basics** | Claude vai além do óbvio |
| **Downstream impact** | Claude verifica se quebrou algo |

---

## Integração com Legacy Systems

### O Que São Legacy Systems?

Legacy Systems são projetos externos (sistemas antigos, backends existentes, frontends legados) que servem como **referência READ-ONLY** durante a execução de tasks. São úteis para:

- **Migrações**: Reescrever sistema antigo com nova stack
- **Integrações**: Entender APIs e contratos existentes
- **Business Logic**: Extrair regras de negócio do código legado
- **Patterns**: Identificar padrões UI/UX a manter

### Flags de Linha de Comando

```bash
# Sistema legado completo (projeto monolítico)
claudiomiro --legacy-system=/path/to/old-project "Migrar autenticação"

# Backend e frontend separados
claudiomiro --legacy-backend=/path/to/old-api \
            --legacy-frontend=/path/to/old-web \
            "Modernizar checkout"

# Combinação com multi-repo
claudiomiro --backend=./new-api \
            --frontend=./new-web \
            --legacy-system=/path/to/monolith \
            "Migrar sistema completo"
```

### Como o Legacy Context é Injetado

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Argument Parsing                      │
│  --legacy-system=/path → state.setLegacySystems()           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        STEP 1                               │
│  generateLegacySystemContext() → Markdown section           │
│  Injetado no final do prompt para AI_PROMPT.md              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   AI_PROMPT.md Gerado                        │
│  Contém seção "## Legacy Systems Reference"                 │
│  Com paths e instruções de uso                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 BLUEPRINT.md (Step 2)                        │
│  CONTEXT CHAIN inclui Priority 0 - Legacy Reference         │
│  Claude sabe quais arquivos legados consultar               │
└─────────────────────────────────────────────────────────────┘
```

### Funções Disponíveis

| Função | Descrição |
|--------|-----------|
| `generateLegacySystemContext()` | Gera markdown com info dos legacy systems para prompts |
| `getLegacyFileContent(type, filePath)` | Lê conteúdo de arquivo específico do legacy system |
| `getLegacyStructure(type)` | Retorna tree de arquivos filtrada do legacy system |

### Regras de Segurança

1. **READ-ONLY**: Código legado nunca é modificado
2. **Filtrado**: `.gitignore` e smart defaults aplicados
3. **Isolado**: Paths legados não interferem no projeto atual
4. **Documentado**: Regras de negócio descobertas devem ser documentadas

### Integração com o Sistema 2-Arquivos

No BLUEPRINT.md, a seção CONTEXT CHAIN deve incluir:

```markdown
### Priority 0 - LEGACY REFERENCE (Se Disponível):
⚠️ **READ-ONLY:** Não modifique código legado.

- Sistema Legado: `/path/to/legacy`
  - `src/auth/login.php:50-120` → Lógica de autenticação
  - `src/models/User.php` → Model de usuário

**Regras de Negócio Identificadas:**
- Senha deve ter 8+ chars com número
- Email é case-insensitive
- Login bloqueado após 5 tentativas
```

No execution.json, documentar descobertas em campo dedicado:

```json
{
  "legacyInsights": {
    "businessRulesDiscovered": [
      {
        "rule": "Password 8+ chars with number",
        "source": "legacy/auth.php:45",
        "modernizedAs": "Zod schema with regex"
      },
      {
        "rule": "Rate limit 5 attempts",
        "source": "legacy/login.php:80",
        "modernizedAs": "Redis rate limiter"
      }
    ],
    "patternsPreserved": [
      { "pattern": "Error message format", "preserved": true },
      { "pattern": "Session timeout 30min", "preserved": true }
    ]
  }
}
```

---

## Arquivos a Modificar na Implementação

1. `templates/blueprint.md` - Novo template
2. `templates/execution-schema.json` - JSON Schema para validação
3. `step2/index.js` - Gerar BLUEPRINT.md
4. `step4/generate-todo.js` → `step4/generate-execution.js` (gera JSON)
5. `step5/index.js` - Usar novo sistema (lê/escreve JSON)
6. `step5/generate-research.js` - ELIMINAR (merged no BLUEPRINT)
7. `step5/generate-context.js` - ELIMINAR (merged no execution.json)
8. `step6/review-code.js` - Atualizar para ler execution.json
9. `context-collector.js` - Atualizar paths

### Já Implementado (Legacy Systems)

10. `step1/index.js` - ✅ Já integrado com `generateLegacySystemContext()`
11. `src/shared/services/legacy-system/` - ✅ Serviço completo:
    - `index.js` - Exports principais funções
    - `context-generator.js` - Gera markdown context para prompts
    - `file-filter.js` - Filtra arquivos (smart defaults + .gitignore)
12. `src/shared/config/state.js` - ✅ Já suporta `getLegacySystem()` e `hasLegacySystems()`
13. `src/commands/task-executor/cli.js` - ✅ Já parseia `--legacy-system=` flag
