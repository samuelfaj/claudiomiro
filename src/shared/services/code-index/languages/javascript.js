/**
 * JavaScript/TypeScript AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
  FUNCTION: 'function',
  CLASS: 'class',
  METHOD: 'method',
  VARIABLE: 'variable',
  CONSTANT: 'constant',
  HOOK: 'hook',
  COMPONENT: 'component',
  TYPE: 'type',
  INTERFACE: 'interface',
  ENUM: 'enum',
  EXPORT: 'export'
};

/**
 * Patterns for extracting symbols from JavaScript/TypeScript code
 */
const PATTERNS = {
  // Function declarations
  functionDeclaration: {
    pattern: 'function $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Arrow function assignments
  arrowFunction: {
    pattern: 'const $NAME = ($$$PARAMS) => $BODY',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Async function declarations
  asyncFunctionDeclaration: {
    pattern: 'async function $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      async: true
    })
  },

  // Class declarations
  classDeclaration: {
    pattern: 'class $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Class with extends
  classWithExtends: {
    pattern: 'class $NAME extends $PARENT { $$$BODY }',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      extends: match.getMatch('PARENT')?.text() || '',
    })
  },

  // Method definitions
  methodDefinition: {
    pattern: '$NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.METHOD,
    context: 'class_body',
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Const variable declarations
  constDeclaration: {
    pattern: 'const $NAME = $VALUE',
    kind: SYMBOL_KINDS.CONSTANT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Let/var variable declarations
  variableDeclaration: {
    pattern: 'let $NAME = $VALUE',
    kind: SYMBOL_KINDS.VARIABLE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // React hooks (useState, useEffect, etc.)
  reactHook: {
    pattern: 'const [$STATE, $SETTER] = useState($$$INIT)',
    kind: SYMBOL_KINDS.HOOK,
    extract: (match) => ({
      name: match.getMatch('STATE')?.text() || '',
      setter: match.getMatch('SETTER')?.text() || '',
      type: 'useState'
    })
  },

  // React functional component
  reactComponent: {
    pattern: 'function $NAME($$$PROPS) { $$$BODY return $JSX }',
    kind: SYMBOL_KINDS.COMPONENT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      hasProps: !!match.getMatch('PROPS')?.text(),
    })
  },

  // TypeScript interface
  tsInterface: {
    pattern: 'interface $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.INTERFACE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // TypeScript type alias
  tsTypeAlias: {
    pattern: 'type $NAME = $TYPE',
    kind: SYMBOL_KINDS.TYPE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // TypeScript enum
  tsEnum: {
    pattern: 'enum $NAME { $$$MEMBERS }',
    kind: SYMBOL_KINDS.ENUM,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Module exports (CommonJS)
  moduleExports: {
    pattern: 'module.exports = $EXPORT',
    kind: SYMBOL_KINDS.EXPORT,
    extract: (match) => ({
      exported: match.getMatch('EXPORT')?.text() || '',
    })
  },

  // Named exports (ES modules)
  namedExport: {
    pattern: 'export { $$$NAMES }',
    kind: SYMBOL_KINDS.EXPORT,
    extract: (match) => ({
      names: match.getMatch('NAMES')?.text() || '',
    })
  },

  // Export default
  exportDefault: {
    pattern: 'export default $VALUE',
    kind: SYMBOL_KINDS.EXPORT,
    extract: (match) => ({
      default: true,
      value: match.getMatch('VALUE')?.text() || '',
    })
  }
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
  // CommonJS require
  require: {
    pattern: "require('$MODULE')",
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      type: 'require'
    })
  },

  // ES import
  importDeclaration: {
    pattern: "import $IMPORTS from '$MODULE'",
    extract: (match) => ({
      imports: match.getMatch('IMPORTS')?.text() || '',
      module: match.getMatch('MODULE')?.text() || '',
      type: 'import'
    })
  },

  // Dynamic import
  dynamicImport: {
    pattern: "import('$MODULE')",
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      type: 'dynamic-import'
    })
  },

  // Function calls
  functionCall: {
    pattern: '$FUNC($$$ARGS)',
    extract: (match) => ({
      func: match.getMatch('FUNC')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
    })
  }
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'javascript';

/**
 * Helper function to extract parameter names from AST node
 */
function extractParams(paramsNode) {
  if (!paramsNode) return [];
  const text = paramsNode.text();
  if (!text) return [];

  // Simple parsing - split by comma and clean up
  return text
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => {
      // Remove type annotations for TypeScript
      const colonIndex = p.indexOf(':');
      if (colonIndex > 0) {
        return p.substring(0, colonIndex).trim();
      }
      // Remove default values
      const equalsIndex = p.indexOf('=');
      if (equalsIndex > 0) {
        return p.substring(0, equalsIndex).trim();
      }
      return p;
    });
}

/**
 * Determine if a function name looks like a React component
 */
function isReactComponentName(name) {
  // React components start with uppercase letter
  return /^[A-Z]/.test(name);
}

/**
 * Determine if a function name looks like a React hook
 */
function isReactHookName(name) {
  // React hooks start with "use" followed by uppercase letter
  return /^use[A-Z]/.test(name);
}

/**
 * Get the kind of symbol based on name conventions
 */
function inferKind(name, defaultKind) {
  if (isReactComponentName(name) && defaultKind === SYMBOL_KINDS.FUNCTION) {
    return SYMBOL_KINDS.COMPONENT;
  }
  if (isReactHookName(name) && defaultKind === SYMBOL_KINDS.FUNCTION) {
    return SYMBOL_KINDS.HOOK;
  }
  return defaultKind;
}

module.exports = {
  SYMBOL_KINDS,
  PATTERNS,
  REFERENCE_PATTERNS,
  FILE_EXTENSIONS,
  LANGUAGE,
  extractParams,
  isReactComponentName,
  isReactHookName,
  inferKind
};
