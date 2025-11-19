# Claudiomiro - Development Guide for Claude

## What is Claudiomiro?

**Claudiomiro** is a CLI development automation tool that uses AI (Claude, Codex, Gemini, DeepSeek, GLM) to execute complex tasks autonomously and in parallel.

Unlike traditional assistants that stop after one response, Claudiomiro **manages the entire development lifecycle**:

- 🧠 **Intelligent Decomposition** - Breaks complex problems into manageable, parallelizable tasks
- 🔄 **Autonomous Execution** - Continuous loop until 100% task completion (no "continue" prompts)
- ⚡ **Parallel Execution** - Runs independent tasks simultaneously
- 🧪 **Automatic Testing** - Executes and fixes failures automatically
- 👨‍💻 **Automated Code Review** - Senior-level review before testing
- 📊 **Production-ready Commits** - Tested, reviewed, and documented code

### Key Features

- **Language**: JavaScript/Node.js
- **Architecture**: Modular step system that executes sequentially
- **Parallel Execution**: DAG Executor to run independent tasks simultaneously
- **Multiple AI Executors**: Support for Claude, Codex, Gemini, DeepSeek, and GLM
- **Complete Automation**: From planning to final commit

## Development Conventions

### 1. Code Language

**CRITICAL RULE**: All code, comments, variable names, function names, and documentation MUST be written in English.

```javascript
// ✅ CORRECT - English code and comments
function calculateTotal(items) {
  // Filter active items only
  const activeItems = items.filter(item => item.isActive);
  return activeItems.reduce((sum, item) => sum + item.price, 0);
}

// ❌ WRONG - Portuguese or mixed languages
function calcularTotal(items) {
  // Filtra apenas itens ativos
  const itensAtivos = items.filter(item => item.isActive);
  return itensAtivos.reduce((soma, item) => soma + item.price, 0);
}
```

**Exception**: User-facing text (UI messages, error messages shown to end users) can be in Portuguese if the target audience is Brazilian, but code structure must remain in English.

### 2. File Naming Conventions

#### Markdown Files in Steps

**CRITICAL RULE**: All `.md` files inside `src/steps/` MUST use lowercase names.

```
✅ CORRECT:
src/steps/step5/todo.md
src/steps/step5/research.md
src/steps/step5/context.md
src/steps/templates/todo.md

❌ WRONG:
src/steps/step5/TODO.md
src/steps/step5/RESEARCH.md
src/steps/step5/CONTEXT.md
src/steps/templates/TODO.md
```

**Why lowercase?**
- ✅ Consistent with Unix/Linux conventions
- ✅ Avoids case-sensitivity issues across different operating systems
- ✅ Easier to type and reference in code
- ✅ Standard practice in modern Node.js projects

### 3. Test Structure

**FUNDAMENTAL RULE**: Every code file must have its corresponding test file created simultaneously.

#### Naming Pattern

```
file.js             → file.test.js
index.js            → index.test.js
step0.js            → step0.test.js
claude-executor.js  → claude-executor.test.js
```

#### Test Location

**CRITICAL RULE**: Test files MUST be in the same directory as the source file, NOT in a separate `__tests__/` folder.

- ✅ **Correct**: `file.js` → `file.test.js` (same directory)
- ❌ **Wrong**: `file.js` → `__tests__/file.test.js` (separate directory)

#### Practical Example

```
src/
├── services/
│   ├── claude-executor.js
│   └── claude-executor.test.js
├── steps/
│   ├── step0/
│   │   ├── index.js
│   │   ├── index.test.js
│   │   ├── generate-todo.js
│   │   └── generate-todo.test.js
│   └── step5/
│       ├── index.js
│       ├── index.test.js
│       ├── generate-research.js
│       ├── generate-research.test.js
│       ├── generate-context.js
│       └── generate-context.test.js
└── utils/
    ├── validation.js
    └── validation.test.js
```

**Why this structure?**
- ✅ Tests are immediately visible next to the code they test
- ✅ Easier to maintain test and source file together
- ✅ Refactoring moves both files together
- ✅ Clear 1:1 relationship between source and test

### 4. Creating New Files

When creating a new code file:

1. ✅ **Create the main file** (e.g., `new-feature.js`)
2. ✅ **Immediately create the test file** (e.g., `new-feature.test.js`)
3. ✅ **Implement unit tests** for main functionalities
4. ✅ **Run tests** with `npm test` before committing

When creating markdown files in `src/steps/`:

1. ✅ **Always use lowercase names** (e.g., `todo.md`, `research.md`, `context.md`)
2. ❌ **Never use uppercase names** (e.g., `TODO.md`, `RESEARCH.md`, `CONTEXT.md`)

### 5. Testing Framework

- **Framework**: Jest
- **Run tests command**: `npm test`
- **Coverage command**: `npm run test:coverage`

### 6. Recommended Test Structure

```javascript
// example.test.js
const { function1, function2 } = require('./example');

describe('Module Name', () => {
  describe('function1', () => {
    test('should do X when Y', () => {
      // Arrange
      const input = 'value';

      // Act
      const result = function1(input);

      // Assert
      expect(result).toBe('expected');
    });

    test('should throw error when input is invalid', () => {
      expect(() => function1(null)).toThrow();
    });
  });

  describe('function2', () => {
    test('should return true for condition X', () => {
      expect(function2('condition')).toBe(true);
    });
  });
});
```

### 7. Mocks and Test Utilities

**CRITICAL RULE**: Each test file MUST be completely self-contained. ALL mocks, utilities, and test helpers must be defined within the test file itself.

**❌ WRONG - External mocks/utilities:**
```javascript
// ❌ DON'T create separate mock files
src/__tests__/__mocks__/logger.js
src/__tests__/test-utils.js
src/test-mocks/child_process.js

// ❌ DON'T import mocks from other locations
const { MockLogger } = require('../test-mocks/logger');
const { setupTest } = require('../test-utils');
```

**✅ CORRECT - Self-contained test file:**
```javascript
// claude-executor.test.js
const { executeClaude } = require('./claude-executor');
const { EventEmitter } = require('events');

// Mock all dependencies
jest.mock('fs');
jest.mock('child_process');

// Define mocks INSIDE the test file
class MockChildProcess extends EventEmitter {
  constructor() {
    super();
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.stdin = {
      write: jest.fn(),
      end: jest.fn()
    };
  }

  kill(signal) {
    this.emit('close', 0);
  }
}

// Test helper functions INSIDE the test file
function setupTestEnvironment() {
  const consoleLog = jest.spyOn(console, 'log').mockImplementation();
  return { consoleLog };
}

describe('claude-executor', () => {
  let mocks;

  beforeEach(() => {
    mocks = setupTestEnvironment();
  });

  test('should execute successfully', () => {
    // Test implementation
  });
});
```

**Why self-contained tests?**
- ✅ Each test file is independent and portable
- ✅ No hidden dependencies or shared state between tests
- ✅ Easier to understand - everything you need is in one place
- ✅ No need to search for mock definitions in other files
- ✅ Refactoring one test doesn't break others
- ✅ Copy-paste a test file and it still works

**Exception for duplication:**
If you find yourself duplicating the EXACT same mock code across multiple test files, that's acceptable. Code duplication in tests is better than hidden dependencies. Each test file remains self-sufficient.

## Project Architecture

### Single Responsibility Principle (SRP)

**CRITICAL ARCHITECTURAL RULE**: Each file must have ONE and ONLY ONE primary responsibility.

#### Core Principles

1. **One File = One Responsibility**
   - Each `.js` file should do ONE thing
   - If a file has multiple distinct responsibilities, split it into separate files
   - Helper functions that support the main responsibility CAN stay in the same file
   - Functions with different responsibilities MUST be in separate files

2. **Helper vs. Different Responsibility**

   **✅ Helper Functions (can stay together):**
   ```javascript
   // user-service.js - ONE responsibility: user operations

   // Main responsibility
   const createUser = async (userData) => {
     const validated = validateUserData(userData); // ✅ Helper
     const hashed = hashPassword(validated.password); // ✅ Helper
     return await db.insert({ ...validated, password: hashed });
   };

   // Helper functions (support main responsibility)
   const validateUserData = (data) => { /* validation logic */ };
   const hashPassword = (password) => { /* hashing logic */ };

   module.exports = { createUser };
   ```

   **❌ Different Responsibilities (must split):**
   ```javascript
   // ❌ BAD: user-operations.js has MULTIPLE responsibilities

   const createUser = async (userData) => { /* ... */ };     // Responsibility 1: Create user
   const sendEmailNotification = async (email) => { /* ... */ }; // Responsibility 2: Send email
   const generatePDFReport = async (userId) => { /* ... */ }; // Responsibility 3: Generate PDF

   // These should be in separate files!
   ```

   **✅ GOOD: Split into separate files:**
   ```javascript
   // user-service.js
   const createUser = async (userData) => { /* ... */ };
   module.exports = { createUser };

   // email-service.js
   const sendEmailNotification = async (email) => { /* ... */ };
   module.exports = { sendEmailNotification };

   // report-generator.js
   const generatePDFReport = async (userId) => { /* ... */ };
   module.exports = { generatePDFReport };
   ```

#### When to Split a File

**Split when:**
- ✅ A function does something fundamentally different from the main purpose
- ✅ You can describe the function without mentioning the main responsibility
- ✅ The function could be reused in a completely different context
- ✅ The function has a different reason to change than the main code

**Keep together when:**
- ✅ The function only makes sense in context of the main responsibility
- ✅ The function is a detail/step of the main algorithm
- ✅ The function validates/transforms data for the main function
- ✅ The function would be meaningless outside this file

#### Real Examples from Claudiomiro

**Example 1: Step5 (Correctly Split)**

```
src/steps/step5/
├── index.js                    # Responsibility: Execute task
├── generate-research.js        # Responsibility: Generate RESEARCH.md
└── generate-context.js         # Responsibility: Generate CONTEXT.md
```

**Why split?**
- Each file has ONE clear purpose
- `generate-research.js` could fail/change without affecting `generate-context.js`
- Each can be tested independently
- Each has a different reason to change

**Example 2: Step4 (Correctly Split)**

```
src/steps/step4/
├── index.js              # Responsibility: Orchestrate step4
├── generate-todo.js      # Responsibility: Generate TODO.md
├── analyze-split.js      # Responsibility: Analyze if task should split
└── utils.js              # Responsibility: Shared utilities
```

**Example 3: Step5 Internal (Helpers Stay Together)**

```javascript
// generate-research.js - ONE responsibility: Generate RESEARCH.md

const generateResearchFile = async (task) => {
  const folder = (file) => path.join(state.claudiomiroFolder, task, file); // ✅ Helper

  if(shouldSkip(folder)) return; // ✅ Helper

  await executeClaude(buildPrompt(task, folder)); // ✅ Helper

  validateOutput(folder); // ✅ Helper
};

// These are helpers - they only exist to support generateResearchFile
const shouldSkip = (folder) => { /* ... */ };
const buildPrompt = (task, folder) => { /* ... */ };
const validateOutput = (folder) => { /* ... */ };
```

#### Decision Tree: Split or Keep?

```
Does the function have a different primary purpose?
│
├─ YES → Split into separate file
│   Example: generateResearchFile() and generateContextFile()
│   are different responsibilities
│
└─ NO → Is it a helper for the main function?
    │
    ├─ YES → Keep in same file
    │   Example: validateInput(), formatData(), buildQuery()
    │   are helpers for the main function
    │
    └─ NO → Could it be reused elsewhere independently?
        │
        ├─ YES → Move to utils/ or shared module
        │   Example: formatDate(), parseJSON(), retry()
        │
        └─ NO → Keep as private helper in same file
```

#### Anti-Patterns to Avoid

**❌ God Files (Multiple Responsibilities)**
```javascript
// ❌ BAD: task-manager.js doing everything
const createTask = () => { /* ... */ };
const sendEmail = () => { /* ... */ };
const generateReport = () => { /* ... */ };
const validateUser = () => { /* ... */ };
const logToDatabase = () => { /* ... */ };
```

**✅ GOOD: Split by Responsibility**
```javascript
// task-service.js
const createTask = () => { /* ... */ };

// email-service.js
const sendEmail = () => { /* ... */ };

// report-service.js
const generateReport = () => { /* ... */ };

// user-validator.js
const validateUser = () => { /* ... */ };

// logger.js
const logToDatabase = () => { /* ... */ };
```

**❌ Over-Splitting (Too Granular)**
```javascript
// ❌ BAD: Every tiny helper in separate file
// user-service.js
const createUser = () => { /* ... */ };

// user-validator.js (OVERKILL - just a helper)
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// user-hasher.js (OVERKILL - just a helper)
const hashPassword = (pwd) => bcrypt.hash(pwd, 10);
```

**✅ GOOD: Helpers Stay with Main Function**
```javascript
// user-service.js
const createUser = async (userData) => {
  if(!validateEmail(userData.email)) throw new Error('Invalid email');
  const hashed = await hashPassword(userData.password);
  return db.insert({ ...userData, password: hashed });
};

// Helpers (support createUser)
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const hashPassword = (pwd) => bcrypt.hash(pwd, 10);

module.exports = { createUser };
```

#### Benefits of SRP

1. ✅ **Easier to Test** - Each file tests one thing
2. ✅ **Easier to Understand** - Clear what each file does
3. ✅ **Easier to Maintain** - Changes are localized
4. ✅ **Easier to Reuse** - Extract what you need
5. ✅ **Easier to Debug** - Smaller surface area
6. ✅ **Better Git History** - Changes are focused

#### Quality Checklist

Before committing, ask:

- [ ] Can I describe this file's purpose in one sentence?
- [ ] Do all functions in this file relate to the same core responsibility?
- [ ] Are there functions that could live independently?
- [ ] Would splitting make testing easier?
- [ ] Would future developers understand the file's purpose immediately?

If any answer suggests splitting, do it!

---

### Step System

Claudiomiro works through a sequence of steps:

- **Step 0**: Task decomposition
- **Step 1**: Execution planning
- **Step 2**: Parallel implementation (DAG execution)
- **Step 3**: Code review
- **Step 4**: Automated testing
- **Step 5**: Commit and push

### AI Executors

Each executor has its own logger and implementation:

- `claude-executor.js` / `claude-logger.js`
- `codex-executor.js` / `codex-logger.js`
- `gemini-executor.js` / `gemini-logger.js`
- `deep-seek-executor.js` / `deep-seek-logger.js`
- `glm-executor.js` / `glm-logger.js`

## Best Practices

1. **Always write tests** - Code without tests doesn't enter the project
2. **Test-first (when possible)** - TDD is encouraged
3. **Mocks for external dependencies** - Never use real data or DB connections in tests
4. **Code coverage** - Maintain high coverage (>80%)
5. **Tests must be independent** - Each test should run in isolation
6. **Descriptive names** - Use clear descriptions of what is being tested
7. **Arrange-Act-Assert** - Organize tests in clear sections
8. **English only** - All code, comments, and variable names in English

## Useful Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test -- --watch

# Run tests for a specific file
npm test -- claude-executor.test.js
```

## Contributing

When contributing to Claudiomiro:

1. 📝 Create or update the main file (in English)
2. 🧪 Create or update the corresponding test file (in English)
3. ✅ Ensure all tests pass
4. 📊 Check coverage
5. 📤 Submit PR with code and tests

---

**Remember**: Claudiomiro automates development, but code quality starts with good tests and English code!
