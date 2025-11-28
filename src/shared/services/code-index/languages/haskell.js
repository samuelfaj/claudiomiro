/**
 * Haskell AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common Haskell code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
  FUNCTION: 'function',
  TYPE: 'type',
  DATA: 'data',
  NEWTYPE: 'newtype',
  CLASS: 'class',
  INSTANCE: 'instance',
  MODULE: 'module',
  TYPE_SIGNATURE: 'type_signature',
  PATTERN: 'pattern',
  FAMILY: 'family',
  CONSTRAINT: 'constraint'
};

/**
 * Patterns for extracting symbols from Haskell code
 */
const PATTERNS = {
  // Function definition
  functionDefinition: {
    pattern: '$NAME $$$PARAMS = $BODY',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Function with where clause
  functionWithWhere: {
    pattern: '$NAME $$$PARAMS = $BODY where $$$DEFS',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      hasWhere: true
    })
  },

  // Function with guards
  functionWithGuards: {
    pattern: '$NAME $$$PARAMS | $GUARD = $BODY',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      hasGuards: true
    })
  },

  // Type signature
  typeSignature: {
    pattern: '$NAME :: $TYPE',
    kind: SYMBOL_KINDS.TYPE_SIGNATURE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Data type declaration
  dataDeclaration: {
    pattern: 'data $NAME = $$$CONSTRUCTORS',
    kind: SYMBOL_KINDS.DATA,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      constructors: match.getMatch('CONSTRUCTORS')?.text() || '',
    })
  },

  // Data with type parameters
  dataWithParams: {
    pattern: 'data $NAME $$$PARAMS = $$$CONSTRUCTORS',
    kind: SYMBOL_KINDS.DATA,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      constructors: match.getMatch('CONSTRUCTORS')?.text() || '',
    })
  },

  // Data with deriving
  dataWithDeriving: {
    pattern: 'data $NAME = $$$CONSTRUCTORS deriving ($$$CLASSES)',
    kind: SYMBOL_KINDS.DATA,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      constructors: match.getMatch('CONSTRUCTORS')?.text() || '',
      deriving: match.getMatch('CLASSES')?.text() || '',
    })
  },

  // Newtype declaration
  newtypeDeclaration: {
    pattern: 'newtype $NAME = $CONSTRUCTOR $TYPE',
    kind: SYMBOL_KINDS.NEWTYPE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      constructor: match.getMatch('CONSTRUCTOR')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Type alias
  typeAlias: {
    pattern: 'type $NAME = $TYPE',
    kind: SYMBOL_KINDS.TYPE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Type with parameters
  typeWithParams: {
    pattern: 'type $NAME $$$PARAMS = $TYPE',
    kind: SYMBOL_KINDS.TYPE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Type family
  typeFamily: {
    pattern: 'type family $NAME $$$PARAMS',
    kind: SYMBOL_KINDS.FAMILY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      family: 'type'
    })
  },

  // Data family
  dataFamily: {
    pattern: 'data family $NAME $$$PARAMS',
    kind: SYMBOL_KINDS.FAMILY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      family: 'data'
    })
  },

  // Class declaration
  classDeclaration: {
    pattern: 'class $NAME $PARAM where $$$METHODS',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      param: match.getMatch('PARAM')?.text() || '',
    })
  },

  // Class with constraints
  classWithConstraints: {
    pattern: 'class $CONSTRAINTS => $NAME $PARAM where $$$METHODS',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      param: match.getMatch('PARAM')?.text() || '',
      constraints: match.getMatch('CONSTRAINTS')?.text() || '',
    })
  },

  // Instance declaration
  instanceDeclaration: {
    pattern: 'instance $CLASS $TYPE where $$$METHODS',
    kind: SYMBOL_KINDS.INSTANCE,
    extract: (match) => ({
      class: match.getMatch('CLASS')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Instance with constraints
  instanceWithConstraints: {
    pattern: 'instance $CONSTRAINTS => $CLASS $TYPE where $$$METHODS',
    kind: SYMBOL_KINDS.INSTANCE,
    extract: (match) => ({
      class: match.getMatch('CLASS')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      constraints: match.getMatch('CONSTRAINTS')?.text() || '',
    })
  },

  // Module declaration
  moduleDeclaration: {
    pattern: 'module $NAME where',
    kind: SYMBOL_KINDS.MODULE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Module with exports
  moduleWithExports: {
    pattern: 'module $NAME ($$$EXPORTS) where',
    kind: SYMBOL_KINDS.MODULE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      exports: match.getMatch('EXPORTS')?.text() || '',
    })
  },

  // Pattern synonym
  patternSynonym: {
    pattern: 'pattern $NAME = $PATTERN',
    kind: SYMBOL_KINDS.PATTERN,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      pattern: match.getMatch('PATTERN')?.text() || '',
    })
  },

  // Infix declaration
  infixDeclaration: {
    pattern: 'infix $FIXITY $OP',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('OP')?.text() || '',
      fixity: match.getMatch('FIXITY')?.text() || '',
      infix: true
    })
  },

  // Infixl declaration
  infixlDeclaration: {
    pattern: 'infixl $FIXITY $OP',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('OP')?.text() || '',
      fixity: match.getMatch('FIXITY')?.text() || '',
      infixl: true
    })
  },

  // Infixr declaration
  infixrDeclaration: {
    pattern: 'infixr $FIXITY $OP',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('OP')?.text() || '',
      fixity: match.getMatch('FIXITY')?.text() || '',
      infixr: true
    })
  }
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
  // Import statement
  importStatement: {
    pattern: 'import $MODULE',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      type: 'import'
    })
  },

  // Import qualified
  importQualified: {
    pattern: 'import qualified $MODULE',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      type: 'import-qualified'
    })
  },

  // Import qualified as
  importQualifiedAs: {
    pattern: 'import qualified $MODULE as $ALIAS',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      alias: match.getMatch('ALIAS')?.text() || '',
      type: 'import-qualified-as'
    })
  },

  // Import with hiding
  importHiding: {
    pattern: 'import $MODULE hiding ($$$NAMES)',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      hiding: match.getMatch('NAMES')?.text() || '',
      type: 'import-hiding'
    })
  },

  // Import specific
  importSpecific: {
    pattern: 'import $MODULE ($$$NAMES)',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      names: match.getMatch('NAMES')?.text() || '',
      type: 'import-specific'
    })
  },

  // Function application
  functionApplication: {
    pattern: '$FUNC $ARG',
    extract: (match) => ({
      func: match.getMatch('FUNC')?.text() || '',
      arg: match.getMatch('ARG')?.text() || '',
    })
  },

  // Infix application
  infixApplication: {
    pattern: '$LEFT `$FUNC` $RIGHT',
    extract: (match) => ({
      func: match.getMatch('FUNC')?.text() || '',
      left: match.getMatch('LEFT')?.text() || '',
      right: match.getMatch('RIGHT')?.text() || '',
      infix: true
    })
  },

  // Do notation
  doNotation: {
    pattern: 'do $$$STMTS',
    extract: (match) => ({
      type: 'do-notation'
    })
  },

  // Let expression
  letExpression: {
    pattern: 'let $$$BINDINGS in $BODY',
    extract: (match) => ({
      type: 'let'
    })
  },

  // Case expression
  caseExpression: {
    pattern: 'case $EXPR of $$$ALTS',
    extract: (match) => ({
      expression: match.getMatch('EXPR')?.text() || '',
      type: 'case'
    })
  }
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.hs', '.lhs'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'haskell';

/**
 * Helper function to extract parameter names from AST node
 */
function extractParams(paramsNode) {
  if (!paramsNode) return [];
  const text = paramsNode.text();
  if (!text) return [];

  return text
    .split(/\s+/)
    .map(p => p.trim())
    .filter(p => p.length > 0 && /^[a-z_]/.test(p));
}

/**
 * Check if a name is a type (starts with uppercase)
 */
function isTypeName(name) {
  return /^[A-Z]/.test(name);
}

/**
 * Check if a name is a value (starts with lowercase)
 */
function isValueName(name) {
  return /^[a-z_]/.test(name);
}

/**
 * Check if a name is an operator
 */
function isOperator(name) {
  return /^[!#$%&*+./<=>?@\\^|~-]+$/.test(name);
}

/**
 * Get the kind of symbol based on conventions
 */
function inferKind(name, defaultKind) {
  if (isTypeName(name) && defaultKind === SYMBOL_KINDS.FUNCTION) {
    return SYMBOL_KINDS.TYPE;
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
  isTypeName,
  isValueName,
  isOperator,
  inferKind
};
