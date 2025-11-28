/**
 * Ruby AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common Ruby code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
  CLASS: 'class',
  MODULE: 'module',
  METHOD: 'method',
  SINGLETON_METHOD: 'singleton_method',
  ATTR_ACCESSOR: 'attr_accessor',
  ATTR_READER: 'attr_reader',
  ATTR_WRITER: 'attr_writer',
  CONSTANT: 'constant',
  VARIABLE: 'variable',
  ALIAS: 'alias',
  BLOCK: 'block'
};

/**
 * Patterns for extracting symbols from Ruby code
 */
const PATTERNS = {
  // Class definition
  classDefinition: {
    pattern: 'class $NAME $$$BODY end',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Class with inheritance
  classWithInheritance: {
    pattern: 'class $NAME < $PARENT $$$BODY end',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      parent: match.getMatch('PARENT')?.text() || '',
    })
  },

  // Module definition
  moduleDefinition: {
    pattern: 'module $NAME $$$BODY end',
    kind: SYMBOL_KINDS.MODULE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Method definition
  methodDefinition: {
    pattern: 'def $NAME $$$BODY end',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Method with parameters
  methodWithParams: {
    pattern: 'def $NAME($$$PARAMS) $$$BODY end',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Singleton method (class method)
  singletonMethod: {
    pattern: 'def self.$NAME $$$BODY end',
    kind: SYMBOL_KINDS.SINGLETON_METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      singleton: true
    })
  },

  // Singleton method with params
  singletonMethodWithParams: {
    pattern: 'def self.$NAME($$$PARAMS) $$$BODY end',
    kind: SYMBOL_KINDS.SINGLETON_METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      singleton: true
    })
  },

  // Private method marker
  privateMethod: {
    pattern: 'private def $NAME $$$BODY end',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      private: true
    })
  },

  // Protected method marker
  protectedMethod: {
    pattern: 'protected def $NAME $$$BODY end',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      protected: true
    })
  },

  // Attr accessor
  attrAccessor: {
    pattern: 'attr_accessor $$$NAMES',
    kind: SYMBOL_KINDS.ATTR_ACCESSOR,
    extract: (match) => ({
      names: match.getMatch('NAMES')?.text() || '',
    })
  },

  // Attr reader
  attrReader: {
    pattern: 'attr_reader $$$NAMES',
    kind: SYMBOL_KINDS.ATTR_READER,
    extract: (match) => ({
      names: match.getMatch('NAMES')?.text() || '',
      readonly: true
    })
  },

  // Attr writer
  attrWriter: {
    pattern: 'attr_writer $$$NAMES',
    kind: SYMBOL_KINDS.ATTR_WRITER,
    extract: (match) => ({
      names: match.getMatch('NAMES')?.text() || '',
      writeonly: true
    })
  },

  // Constant assignment
  constantAssignment: {
    pattern: '$NAME = $VALUE',
    kind: SYMBOL_KINDS.CONSTANT,
    extract: (match) => {
      const name = match.getMatch('NAME')?.text() || '';
      return {
        name,
        isConstant: /^[A-Z]/.test(name)
      };
    }
  },

  // Method alias
  aliasMethod: {
    pattern: 'alias $NEW $OLD',
    kind: SYMBOL_KINDS.ALIAS,
    extract: (match) => ({
      name: match.getMatch('NEW')?.text() || '',
      original: match.getMatch('OLD')?.text() || '',
    })
  },

  // Alias method (newer syntax)
  aliasMethodCall: {
    pattern: 'alias_method $NEW, $OLD',
    kind: SYMBOL_KINDS.ALIAS,
    extract: (match) => ({
      name: match.getMatch('NEW')?.text() || '',
      original: match.getMatch('OLD')?.text() || '',
    })
  },

  // Define method dynamically
  defineMethod: {
    pattern: 'define_method($NAME) { $$$BODY }',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      dynamic: true
    })
  },

  // Lambda
  lambdaDefinition: {
    pattern: '$NAME = -> ($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.BLOCK,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      lambda: true
    })
  },

  // Proc
  procDefinition: {
    pattern: '$NAME = Proc.new { $$$BODY }',
    kind: SYMBOL_KINDS.BLOCK,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      proc: true
    })
  }
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
  // Require
  requireStatement: {
    pattern: "require '$FILE'",
    extract: (match) => ({
      file: match.getMatch('FILE')?.text() || '',
      type: 'require'
    })
  },

  // Require relative
  requireRelative: {
    pattern: "require_relative '$FILE'",
    extract: (match) => ({
      file: match.getMatch('FILE')?.text() || '',
      type: 'require_relative'
    })
  },

  // Load
  loadStatement: {
    pattern: "load '$FILE'",
    extract: (match) => ({
      file: match.getMatch('FILE')?.text() || '',
      type: 'load'
    })
  },

  // Include module
  includeModule: {
    pattern: 'include $MODULE',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      type: 'include'
    })
  },

  // Extend module
  extendModule: {
    pattern: 'extend $MODULE',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      type: 'extend'
    })
  },

  // Prepend module
  prependModule: {
    pattern: 'prepend $MODULE',
    extract: (match) => ({
      module: match.getMatch('MODULE')?.text() || '',
      type: 'prepend'
    })
  },

  // Method call
  methodCall: {
    pattern: '$RECEIVER.$METHOD($$$ARGS)',
    extract: (match) => ({
      receiver: match.getMatch('RECEIVER')?.text() || '',
      method: match.getMatch('METHOD')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
    })
  },

  // Method call without parens
  methodCallNoParens: {
    pattern: '$RECEIVER.$METHOD',
    extract: (match) => ({
      receiver: match.getMatch('RECEIVER')?.text() || '',
      method: match.getMatch('METHOD')?.text() || '',
    })
  },

  // Class instantiation
  classInstantiation: {
    pattern: '$CLASS.new($$$ARGS)',
    extract: (match) => ({
      class: match.getMatch('CLASS')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
      type: 'new'
    })
  },

  // Block call
  blockCall: {
    pattern: '$METHOD { $$$BODY }',
    extract: (match) => ({
      method: match.getMatch('METHOD')?.text() || '',
      type: 'block'
    })
  },

  // Do block
  doBlock: {
    pattern: '$METHOD do $$$BODY end',
    extract: (match) => ({
      method: match.getMatch('METHOD')?.text() || '',
      type: 'do-block'
    })
  }
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.rb', '.rake', '.gemspec', '.ru'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'ruby';

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
      // Ruby params can be: name, *args, **kwargs, &block, name:, name: default
      let name = p;
      // Remove splat operators
      name = name.replace(/^[*&]+/, '');
      // Remove default value
      const eqIdx = name.indexOf('=');
      if (eqIdx > 0) {
        name = name.substring(0, eqIdx).trim();
      }
      // Remove keyword argument colon
      name = name.replace(/:$/, '');
      return name;
    });
}

/**
 * Check if a name is a Ruby constant (starts with uppercase)
 */
function isConstantName(name) {
  return /^[A-Z]/.test(name);
}

/**
 * Check if a name is a private method (starts with _)
 */
function isPrivateName(name) {
  return name.startsWith('_');
}

/**
 * Get the kind of symbol based on conventions
 */
function inferKind(name, defaultKind) {
  if (isConstantName(name) && defaultKind === SYMBOL_KINDS.VARIABLE) {
    return SYMBOL_KINDS.CONSTANT;
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
  isPrivateName,
  inferKind
};
