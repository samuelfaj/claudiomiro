/**
 * Bash/Shell AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common Bash code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
  FUNCTION: 'function',
  VARIABLE: 'variable',
  ALIAS: 'alias',
  EXPORT: 'export',
  READONLY: 'readonly',
  LOCAL: 'local',
  ARRAY: 'array'
};

/**
 * Patterns for extracting symbols from Bash code
 */
const PATTERNS = {
  // Function definition (modern syntax)
  functionDefinition: {
    pattern: '$NAME() { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Function definition (keyword syntax)
  functionKeyword: {
    pattern: 'function $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Function definition (keyword with parens)
  functionKeywordParens: {
    pattern: 'function $NAME() { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Variable assignment
  variableAssignment: {
    pattern: '$NAME=$VALUE',
    kind: SYMBOL_KINDS.VARIABLE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Variable with quotes
  variableQuoted: {
    pattern: '$NAME="$VALUE"',
    kind: SYMBOL_KINDS.VARIABLE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Variable with single quotes
  variableSingleQuoted: {
    pattern: "$NAME='$VALUE'",
    kind: SYMBOL_KINDS.VARIABLE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Export variable
  exportVariable: {
    pattern: 'export $NAME=$VALUE',
    kind: SYMBOL_KINDS.EXPORT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      exported: true
    })
  },

  // Export without value
  exportOnly: {
    pattern: 'export $NAME',
    kind: SYMBOL_KINDS.EXPORT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      exported: true
    })
  },

  // Readonly variable
  readonlyVariable: {
    pattern: 'readonly $NAME=$VALUE',
    kind: SYMBOL_KINDS.READONLY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      readonly: true
    })
  },

  // Local variable
  localVariable: {
    pattern: 'local $NAME=$VALUE',
    kind: SYMBOL_KINDS.LOCAL,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      local: true
    })
  },

  // Local without value
  localOnly: {
    pattern: 'local $NAME',
    kind: SYMBOL_KINDS.LOCAL,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      local: true
    })
  },

  // Array declaration
  arrayDeclaration: {
    pattern: '$NAME=($$$ELEMENTS)',
    kind: SYMBOL_KINDS.ARRAY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      array: true
    })
  },

  // Declare array
  declareArray: {
    pattern: 'declare -a $NAME',
    kind: SYMBOL_KINDS.ARRAY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      array: true
    })
  },

  // Declare associative array
  declareAssocArray: {
    pattern: 'declare -A $NAME',
    kind: SYMBOL_KINDS.ARRAY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      associative: true
    })
  },

  // Declare integer
  declareInteger: {
    pattern: 'declare -i $NAME',
    kind: SYMBOL_KINDS.VARIABLE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      integer: true
    })
  },

  // Alias definition
  aliasDefinition: {
    pattern: "alias $NAME='$VALUE'",
    kind: SYMBOL_KINDS.ALIAS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Alias with double quotes
  aliasDoubleQuote: {
    pattern: 'alias $NAME="$VALUE"',
    kind: SYMBOL_KINDS.ALIAS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  }
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
  // Source command
  sourceCommand: {
    pattern: 'source $FILE',
    extract: (match) => ({
      file: match.getMatch('FILE')?.text() || '',
      type: 'source'
    })
  },

  // Dot source
  dotSource: {
    pattern: '. $FILE',
    extract: (match) => ({
      file: match.getMatch('FILE')?.text() || '',
      type: 'source'
    })
  },

  // Function call
  functionCall: {
    pattern: '$FUNC $$$ARGS',
    extract: (match) => ({
      func: match.getMatch('FUNC')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
    })
  },

  // Command substitution
  commandSubstitution: {
    pattern: '$($COMMAND)',
    extract: (match) => ({
      command: match.getMatch('COMMAND')?.text() || '',
      type: 'command-substitution'
    })
  },

  // Backtick substitution
  backtickSubstitution: {
    pattern: '`$COMMAND`',
    extract: (match) => ({
      command: match.getMatch('COMMAND')?.text() || '',
      type: 'backtick'
    })
  },

  // Variable reference
  variableReference: {
    pattern: '$$NAME',
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: 'variable-ref'
    })
  },

  // Brace variable reference
  braceVariableRef: {
    pattern: '${$NAME}',
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: 'brace-variable-ref'
    })
  }
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.sh', '.bash', '.zsh', '.ksh'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'bash';

/**
 * Helper function to extract parameter names
 * (Bash doesn't have named params, but we handle positional)
 */
function extractParams(paramsNode) {
  return [];
}

/**
 * Check if a name follows shell constant convention (UPPER_CASE)
 */
function isConstantName(name) {
  return /^[A-Z_][A-Z0-9_]*$/.test(name);
}

/**
 * Check if a name is a special variable
 */
function isSpecialVariable(name) {
  const specials = ['$', '?', '!', '#', '@', '*', '-', '_', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return specials.includes(name);
}

/**
 * Get the kind of symbol based on conventions
 */
function inferKind(name, defaultKind) {
  if (isConstantName(name) && defaultKind === SYMBOL_KINDS.VARIABLE) {
    return SYMBOL_KINDS.READONLY;
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
  isConstantName,
  isSpecialVariable,
  inferKind
};
