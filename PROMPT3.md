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
├── EXECUTION.md   ← Living Document (atualizado durante execução)
├── info.json      ← Metadata (mantido)
└── CODE_REVIEW.md ← Review (mantido)
```

### Por Que 2 Arquivos?

| Arquivo | Propósito | Quando Modificado |
|---------|-----------|-------------------|
| **BLUEPRINT.md** | O QUE fazer, POR QUE, COM BASE EM QUÊ | Nunca (criado no Step 2, read-only depois) |
| **EXECUTION.md** | COMO está sendo feito, STATUS, INCERTEZAS | Durante toda execução |

**Analogia**: BLUEPRINT é a planta da casa (não muda). EXECUTION é o diário de obra (atualizado todo dia).

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
3. Documentar em EXECUTION.md o que falta

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
3. Documentar qualquer INCERTEZA em EXECUTION.md

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
3. Atualizar EXECUTION.md com resultados
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

## EXECUTION.md - Estrutura Detalhada

### Por Que Separar do BLUEPRINT?

BLUEPRINT é o **plano imutável**. EXECUTION é o **log de execução**. Misturá-los causa:
- Confusão sobre o que era planejado vs o que foi feito
- Perda de rastreabilidade quando algo dá errado
- Impossibilidade de comparar plano vs realidade

```markdown
@version 1.0
@task TASK2
@status in_progress
@attempts 1
@started 2025-12-02T10:00:00Z

# EXECUTION LOG: Create User Endpoint

## CURRENT STATUS
**Status**: IN_PROGRESS
**Phase**: 2 (Core Implementation)
**Last Action**: Criando src/api/users.js

---

## PHASE TRACKING

### [x] Phase 1: Preparation
**Started**: 2025-12-02T10:00:00Z
**Completed**: 2025-12-02T10:05:00Z

#### Pre-Condition Results:
| Check | Result | Evidence |
|-------|--------|----------|
| Model User existe | PASS | `prisma/schema.prisma:47` |
| Validator existe | PASS | `ls` returned 0 |
| Express configurado | PASS | `src/app.js:12` |

#### Uncertainties Captured:
- U1: bcrypt → Verificado: ESTÁ instalado (package.json:15)

---

### [ ] Phase 2: Core Implementation
**Started**: 2025-12-02T10:05:00Z

#### Actions Taken:
1. [x] Criado `src/api/users.js`
   - Seguiu padrão de health.js
   - DESVIO: Adicionei rate limiting (não planejado, mas necessário para segurança)

2. [ ] Registrar em app.js
   - Pendente

#### Compilation Check:
- `node --check src/api/users.js` → PASS

---

### [ ] Phase 3: Testing
**Not Started**

---

### [ ] Phase 4: Integration
**Not Started**

---

### [ ] Phase 5: Validation
**Not Started**

---

## UNCERTAINTY LOG (Runtime)

| ID | Tópico | Decisão | Confiança | Timestamp |
|----|--------|---------|-----------|-----------|
| U1 | bcrypt instalado? | SIM, package.json:15 | HIGH | 10:03:00 |
| U3 | Rate limit necessário? | Adicionei por segurança | MEDIUM | 10:08:00 |

---

## ERROR LOG

| Timestamp | Phase | Error | Resolution | Resolved |
|-----------|-------|-------|------------|----------|
| 10:07:00 | 2 | Import path errado | Corrigido para '../lib/prisma' | YES |

---

## ARTIFACTS PRODUCED

| Artifact | Status | Path | Verification |
|----------|--------|------|--------------|
| Endpoint | CREATED | `src/api/users.js` | `ls` PASS |
| Tests | PENDING | `src/api/users.test.js` | - |

---

## BEYOND THE BASICS (Checklist Final)

### O que o usuário NÃO pediu mas fiz:
- [x] Rate limiting (segurança)
- [x] Input sanitization
- [ ] Logging estruturado (a fazer)

### Verificações de Edge Cases:
- [x] Input null/undefined → Retorna 400
- [x] Email inválido → Retorna 400 com mensagem
- [x] Email duplicado → Retorna 409

### Downstream Impact Verified:
- [x] `grep -r "import.*users" src/` → Nenhum importador ainda
- [x] `npm test --silent` → Todos testes passam

### Cleanup:
- [x] Removidos console.logs de debug
- [x] Formatação consistente (prettier)
- [ ] Código morto removido

---

## COMPLETION SUMMARY

### Final Status: PENDING_VALIDATION

### What Was Done:
1. Endpoint POST /api/users criado
2. Validação de email implementada
3. Testes criados (3 cenários)
4. Rate limiting adicionado (extra)

### Deviations from Plan:
- Adicionado rate limiting (não planejado)
- Motivo: Segurança básica para endpoint público

### For Future Tasks:
- Rate limiter pode ser extraído para middleware reutilizável
- Pattern de validação pode virar helper

@end-execution
```

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
│                        STEP 2                               │
│  Gera BLUEPRINT.md (substitui TASK.md + PROMPT.md)          │
│  - Analisa codebase                                         │
│  - Define IDENTITY (IS/IS NOT)                              │
│  - Mapeia CONTEXT CHAIN                                     │
│  - Cria Pre-Conditions                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        STEP 4                               │
│  Gera EXECUTION.md inicial (substitui TODO.md)              │
│  - Cria estrutura de phases                                 │
│  - Inicializa status tracking                               │
│  - Prepara uncertainty log                                  │
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
│  │ - Atualiza EXECUTION.md em tempo real                │
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
│  │ - Só marca "Fully implemented: YES" se TUDO passar   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        STEP 6                               │
│  Code Review                                                │
│  - Lê BLUEPRINT.md (o que deveria ser feito)                │
│  - Lê EXECUTION.md (o que foi feito)                        │
│  - Compara: Plano vs Realidade                              │
│  - Verifica se Beyond the Basics foi executado              │
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
| Step 4 | Criar EXECUTION.md (estrutura) | ~2,000 |
| Step 5 | Executar (BLUEPRINT read-only, EXECUTION update) | ~4,000 |
| Step 6 | Code review (BLUEPRINT + EXECUTION) | ~2,000 |
| **Total** | | **~12,000** |

**Economia: ~48% (11,000 tokens/task)**

---

## Resumo: Por Que Cada Decisão

| Decisão | Por Quê |
|---------|---------|
| **2 arquivos** | Menos fragmentação = menos context losing |
| **BLUEPRINT read-only** | Source of truth não muda = sem confusão |
| **EXECUTION living doc** | Rastreabilidade de o que foi feito vs planejado |
| **Pre-conditions** | Claude verifica antes de inventar |
| **Phase gates** | Claude não pula etapas |
| **IS/IS NOT sections** | Claude sabe exatamente o escopo |
| **Evidence-based** | Toda ação cita file:line, não "best practice" |
| **Uncertainty log** | Claude pode admitir que não sabe |
| **Beyond the basics** | Claude vai além do óbvio |
| **Downstream impact** | Claude verifica se quebrou algo |

---

## Arquivos a Modificar na Implementação

1. `templates/blueprint.md` - Novo template
2. `templates/execution.md` - Novo template
3. `step2/index.js` - Gerar BLUEPRINT.md
4. `step4/generate-todo.js` → `step4/generate-execution.js`
5. `step5/index.js` - Usar novo sistema
6. `step5/generate-research.js` - ELIMINAR (merged no BLUEPRINT)
7. `step5/generate-context.js` - ELIMINAR (merged no EXECUTION)
8. `step6/review-code.js` - Atualizar para nova estrutura
9. `context-collector.js` - Atualizar paths
