/**
 * Elixir AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common Elixir code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
  MODULE: 'module',
  FUNCTION: 'function',
  PRIVATE_FUNCTION: 'private_function',
  MACRO: 'macro',
  CALLBACK: 'callback',
  TYPE: 'type',
  SPEC: 'spec',
  STRUCT: 'struct',
  PROTOCOL: 'protocol',
  BEHAVIOUR: 'behaviour',
  GUARD: 'guard',
  ATTRIBUTE: 'attribute'
};

/**
 * Patterns for extracting symbols from Elixir code
 */
const PATTERNS = {
  // Module definition
  moduleDefinition: {
    pattern: 'defmodule $NAME do $$$BODY end',
    kind: SYMBOL_KINDS.MODULE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Public function
  defFunction: {
    pattern: 'def $NAME($$$PARAMS) do $$$BODY end',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Public function with guards
  defFunctionWithGuard: {
    pattern: 'def $NAME($$$PARAMS) when $GUARD do $$$BODY end',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      guard: match.getMatch('GUARD')?.text() || '',
    })
  },

  // Single-line def
  defFunctionShort: {
    pattern: 'def $NAME($$$PARAMS), do: $BODY',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Private function
  defpFunction: {
    pattern: 'defp $NAME($$$PARAMS) do $$$BODY end',
    kind: SYMBOL_KINDS.PRIVATE_FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      private: true
    })
  },

  // Private function short
  defpFunctionShort: {
    pattern: 'defp $NAME($$$PARAMS), do: $BODY',
    kind: SYMBOL_KINDS.PRIVATE_FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      private: true
    })
  },

  // Macro definition
  defmacro: {
    pattern: 'defmacro $NAME($$$PARAMS) do $$$BODY end',
    kind: SYMBOL_KINDS.MACRO,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Private macro
  defmacrop: {
    pattern: 'defmacrop $NAME($$$PARAMS) do $$$BODY end',
    kind: SYMBOL_KINDS.MACRO,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      private: true
    })
  },

  // Guard definition
  defguard: {
    pattern: 'defguard $NAME($$$PARAMS) when $EXPR',
    kind: SYMBOL_KINDS.GUARD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Struct definition
  defstruct: {
    pattern: 'defstruct $$$FIELDS',
    kind: SYMBOL_KINDS.STRUCT,
    extract: (match) => ({
      fields: match.getMatch('FIELDS')?.text() || '',
    })
  },

  // Protocol definition
  defprotocol: {
    pattern: 'defprotocol $NAME do $$$BODY end',
    kind: SYMBOL_KINDS.PROTOCOL,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Protocol implementation
  defimpl: {
    pattern: 'defimpl $PROTOCOL, for: $TYPE do $$$BODY end',
    kind: SYMBOL_KINDS.PROTOCOL,
    extract: (match) => ({
      protocol: match.getMatch('PROTOCOL')?.text() || '',
      for: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Callback definition
  callback: {
    pattern: '@callback $NAME($$$PARAMS) :: $RETURN',
    kind: SYMBOL_KINDS.CALLBACK,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      returnType: match.getMatch('RETURN')?.text() || '',
    })
  },

  // Type definition
  typeDefinition: {
    pattern: '@type $NAME :: $TYPE',
    kind: SYMBOL_KINDS.TYPE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Typep (private type)
  typepDefinition: {
    pattern: '@typep $NAME :: $TYPE',
    kind: SYMBOL_KINDS.TYPE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      private: true
    })
  },

  // Opaque type
  opaqueType: {
    pattern: '@opaque $NAME :: $TYPE',
    kind: SYMBOL_KINDS.TYPE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      opaque: true
    })
  },

  // Spec
  specDefinition: {
    pattern: '@spec $NAME($$$PARAMS) :: $RETURN',
    kind: SYMBOL_KINDS.SPEC,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      returnType: match.getMatch('RETURN')?.text() || '',
    })
  },

  // Module attribute
  moduleAttribute: {
    pattern: '@$NAME $VALUE',
    kind: SYMBOL_KINDS.ATTRIBUTE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      value: match.getMatch('VALUE')?.text() || '',
    })
  },

  // Behaviour declaration
  behaviourDeclaration: {
    pattern: '@behaviour $NAME',
    kind: SYMBOL_KINDS.BEHAVIOUR,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  }
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
  // Alias
  aliasStatement: {
    pattern: 'alias $MODULE',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      type: 'alias'
    })
  },

  // Alias with as
  aliasWithAs: {
    pattern: 'alias $MODULE, as: $ALIAS',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      alias: match.getMatch('ALIAS')?.text() || '',
      type: 'alias'
    })
  },

  // Import
  importStatement: {
    pattern: 'import $MODULE',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      type: 'import'
    })
  },

  // Import with only
  importOnly: {
    pattern: 'import $MODULE, only: $$$FUNCS',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      only: match.getMatch('FUNCS')?.text() || '',
      type: 'import'
    })
  },

  // Import with except
  importExcept: {
    pattern: 'import $MODULE, except: $$$FUNCS',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      except: match.getMatch('FUNCS')?.text() || '',
      type: 'import'
    })
  },

  // Require
  requireStatement: {
    pattern: 'require $MODULE',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      type: 'require'
    })
  },

  // Use
  useStatement: {
    pattern: 'use $MODULE',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      type: 'use'
    })
  },

  // Use with options
  useWithOptions: {
    pattern: 'use $MODULE, $$$OPTIONS',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      options: match.getMatch('OPTIONS')?.text() || '',
      type: 'use'
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

  // Remote function call
  remoteFunctionCall: {
    pattern: '$MODULE.$FUNC($$$ARGS)',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      func: match.getMatch('FUNC')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
    })
  },

  // Pipe operator
  pipeOperator: {
    pattern: '$EXPR |> $FUNC',
    extract: (match) => ({
      expression: match.getMatch('EXPR')?.text() || '',
      func: match.getMatch('FUNC')?.text() || '',
      type: 'pipe'
    })
  }
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.ex', '.exs'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'elixir';

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
    .filter(p => p.length > 0)
    .map(p => {
      // Remove pattern matching, defaults
      const match = p.match(/^(\w+)/);
      return match ? match[1] : p;
    });
}

/**
 * Check if a name is an atom (starts with :)
 */
function isAtom(name) {
  return name.startsWith(':');
}

/**
 * Check if a name is a module (starts with uppercase)
 */
function isModuleName(name) {
  return /^[A-Z]/.test(name);
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
  isAtom,
  isModuleName,
  inferKind
};
