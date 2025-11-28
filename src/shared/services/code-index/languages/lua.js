/**
 * Lua AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common Lua code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
  FUNCTION: 'function',
  LOCAL_FUNCTION: 'local_function',
  METHOD: 'method',
  TABLE: 'table',
  VARIABLE: 'variable',
  LOCAL_VARIABLE: 'local_variable',
  MODULE: 'module',
  CLASS: 'class'
};

/**
 * Patterns for extracting symbols from Lua code
 */
const PATTERNS = {
  // Global function
  functionDeclaration: {
    pattern: 'function $NAME($$$PARAMS) $$$BODY end',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Local function
  localFunction: {
    pattern: 'local function $NAME($$$PARAMS) $$$BODY end',
    kind: SYMBOL_KINDS.LOCAL_FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      local: true
    })
  },

  // Method definition (using colon)
  methodDefinition: {
    pattern: 'function $TABLE:$NAME($$$PARAMS) $$$BODY end',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      table: match.getMatch('TABLE')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Table function (using dot)
  tableFunction: {
    pattern: 'function $TABLE.$NAME($$$PARAMS) $$$BODY end',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      table: match.getMatch('TABLE')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Anonymous function assigned to variable
  anonFunction: {
    pattern: '$NAME = function($$$PARAMS) $$$BODY end',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      anonymous: true
    })
  },

  // Local anonymous function
  localAnonFunction: {
    pattern: 'local $NAME = function($$$PARAMS) $$$BODY end',
    kind: SYMBOL_KINDS.LOCAL_FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      local: true,
      anonymous: true
    })
  },

  // Table definition
  tableDefinition: {
    pattern: '$NAME = { $$$CONTENT }',
    kind: SYMBOL_KINDS.TABLE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Local table
  localTable: {
    pattern: 'local $NAME = { $$$CONTENT }',
    kind: SYMBOL_KINDS.TABLE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      local: true
    })
  },

  // Module table (common pattern)
  moduleTable: {
    pattern: 'local $NAME = {}',
    kind: SYMBOL_KINDS.MODULE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      module: true
    })
  },

  // Global variable
  globalVariable: {
    pattern: '$NAME = $VALUE',
    kind: SYMBOL_KINDS.VARIABLE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Local variable
  localVariable: {
    pattern: 'local $NAME = $VALUE',
    kind: SYMBOL_KINDS.LOCAL_VARIABLE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      local: true
    })
  },

  // Multiple local variables
  multipleLocalVars: {
    pattern: 'local $$$NAMES = $$$VALUES',
    kind: SYMBOL_KINDS.LOCAL_VARIABLE,
    extract: (match) => ({
      names: match.getMatch('NAMES')?.text() || '',
      local: true,
      multiple: true
    })
  },

  // Class-like pattern (using metatables)
  classPattern: {
    pattern: '$NAME = setmetatable({}, $META)',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      metatable: match.getMatch('META')?.text() || '',
    })
  },

  // Return statement (for modules)
  moduleReturn: {
    pattern: 'return $NAME',
    kind: SYMBOL_KINDS.MODULE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      exported: true
    })
  }
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
  // Require
  requireStatement: {
    pattern: "require('$MODULE')",
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      type: 'require'
    })
  },

  // Require with double quotes
  requireDoubleQuote: {
    pattern: 'require("$MODULE")',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      type: 'require'
    })
  },

  // Require assigned to variable
  requireAssign: {
    pattern: "local $NAME = require('$MODULE')",
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      module: match.getMatch('MODULE')?.text() || '',
      type: 'require'
    })
  },

  // Dofile
  dofileStatement: {
    pattern: "dofile('$FILE')",
    extract: (match) => ({
      file: match.getMatch('FILE')?.text() || '',
      type: 'dofile'
    })
  },

  // Loadfile
  loadfileStatement: {
    pattern: "loadfile('$FILE')",
    extract: (match) => ({
      file: match.getMatch('FILE')?.text() || '',
      type: 'loadfile'
    })
  },

  // Function call
  functionCall: {
    pattern: '$FUNC($$$ARGS)',
    extract: (match) => ({
      func: match.getMatch('FUNC')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
    })
  },

  // Method call
  methodCall: {
    pattern: '$OBJ:$METHOD($$$ARGS)',
    extract: (match) => ({
      object: match.getMatch('OBJ')?.text() || '',
      method: match.getMatch('METHOD')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
    })
  },

  // Table access call
  tableCall: {
    pattern: '$TABLE.$FUNC($$$ARGS)',
    extract: (match) => ({
      table: match.getMatch('TABLE')?.text() || '',
      func: match.getMatch('FUNC')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
    })
  }
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.lua'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'lua';

/**
 * Helper function to extract parameter names from AST node
 */
function extractParams(paramsNode) {
  if (!paramsNode) return [];
  const text = paramsNode.text();
  if (!text) return [];

  return text
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Check if a name is a constant (Lua convention: UPPER_CASE)
 */
function isConstantName(name) {
  return /^[A-Z_][A-Z0-9_]*$/.test(name);
}

/**
 * Check if a name is a private (Lua convention: starts with _)
 */
function isPrivateName(name) {
  return name.startsWith('_');
}

/**
 * Get the kind of symbol based on conventions
 */
function inferKind(name, defaultKind) {
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
  isPrivateName,
  inferKind
};
