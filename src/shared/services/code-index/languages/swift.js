/**
 * Swift AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common Swift code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
  CLASS: 'class',
  STRUCT: 'struct',
  ENUM: 'enum',
  PROTOCOL: 'protocol',
  EXTENSION: 'extension',
  FUNCTION: 'function',
  METHOD: 'method',
  PROPERTY: 'property',
  VARIABLE: 'variable',
  CONSTANT: 'constant',
  TYPEALIAS: 'typealias',
  INITIALIZER: 'initializer',
  SUBSCRIPT: 'subscript',
  OPERATOR: 'operator',
  ACTOR: 'actor'
};

/**
 * Patterns for extracting symbols from Swift code
 */
const PATTERNS = {
  // Class declaration
  classDeclaration: {
    pattern: 'class $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Class with inheritance
  classWithInheritance: {
    pattern: 'class $NAME: $$$TYPES { $$$BODY }',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      inherits: match.getMatch('TYPES')?.text() || '',
    })
  },

  // Final class
  finalClass: {
    pattern: 'final class $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      final: true
    })
  },

  // Struct declaration
  structDeclaration: {
    pattern: 'struct $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.STRUCT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Struct with protocols
  structWithProtocols: {
    pattern: 'struct $NAME: $$$PROTOCOLS { $$$BODY }',
    kind: SYMBOL_KINDS.STRUCT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      protocols: match.getMatch('PROTOCOLS')?.text() || '',
    })
  },

  // Enum declaration
  enumDeclaration: {
    pattern: 'enum $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.ENUM,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Enum with raw type
  enumWithRawType: {
    pattern: 'enum $NAME: $TYPE { $$$BODY }',
    kind: SYMBOL_KINDS.ENUM,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      rawType: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Protocol declaration
  protocolDeclaration: {
    pattern: 'protocol $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.PROTOCOL,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Extension
  extensionDeclaration: {
    pattern: 'extension $TYPE { $$$BODY }',
    kind: SYMBOL_KINDS.EXTENSION,
    extract: (match) => ({
      name: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Extension with protocol conformance
  extensionWithProtocol: {
    pattern: 'extension $TYPE: $$$PROTOCOLS { $$$BODY }',
    kind: SYMBOL_KINDS.EXTENSION,
    extract: (match) => ({
      name: match.getMatch('TYPE')?.text() || '',
      protocols: match.getMatch('PROTOCOLS')?.text() || '',
    })
  },

  // Actor (Swift 5.5+)
  actorDeclaration: {
    pattern: 'actor $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.ACTOR,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Function declaration
  functionDeclaration: {
    pattern: 'func $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Function with return type
  functionWithReturn: {
    pattern: 'func $NAME($$$PARAMS) -> $RETURN { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      returnType: match.getMatch('RETURN')?.text() || '',
    })
  },

  // Async function
  asyncFunction: {
    pattern: 'func $NAME($$$PARAMS) async $$$REST { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      async: true
    })
  },

  // Throwing function
  throwingFunction: {
    pattern: 'func $NAME($$$PARAMS) throws $$$REST { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      throws: true
    })
  },

  // Static function
  staticFunction: {
    pattern: 'static func $NAME($$$PARAMS) $$$REST { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      static: true
    })
  },

  // Class function
  classFunction: {
    pattern: 'class func $NAME($$$PARAMS) $$$REST { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      class: true
    })
  },

  // Private function
  privateFunction: {
    pattern: 'private func $NAME($$$PARAMS) $$$REST { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      private: true
    })
  },

  // Initializer
  initDeclaration: {
    pattern: 'init($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.INITIALIZER,
    extract: (match) => ({
      name: 'init',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Failable initializer
  failableInit: {
    pattern: 'init?($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.INITIALIZER,
    extract: (match) => ({
      name: 'init?',
      params: extractParams(match.getMatch('PARAMS')),
      failable: true
    })
  },

  // Required initializer
  requiredInit: {
    pattern: 'required init($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.INITIALIZER,
    extract: (match) => ({
      name: 'init',
      params: extractParams(match.getMatch('PARAMS')),
      required: true
    })
  },

  // Property declaration
  varDeclaration: {
    pattern: 'var $NAME: $TYPE',
    kind: SYMBOL_KINDS.PROPERTY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Computed property
  computedProperty: {
    pattern: 'var $NAME: $TYPE { $$$BODY }',
    kind: SYMBOL_KINDS.PROPERTY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      computed: true
    })
  },

  // Let constant
  letDeclaration: {
    pattern: 'let $NAME: $TYPE = $VALUE',
    kind: SYMBOL_KINDS.CONSTANT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Static property
  staticProperty: {
    pattern: 'static var $NAME: $TYPE',
    kind: SYMBOL_KINDS.PROPERTY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      static: true
    })
  },

  // Static let
  staticLet: {
    pattern: 'static let $NAME: $TYPE = $VALUE',
    kind: SYMBOL_KINDS.CONSTANT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      static: true
    })
  },

  // Lazy property
  lazyProperty: {
    pattern: 'lazy var $NAME: $TYPE = $VALUE',
    kind: SYMBOL_KINDS.PROPERTY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      lazy: true
    })
  },

  // Typealias
  typealiasDeclaration: {
    pattern: 'typealias $NAME = $TYPE',
    kind: SYMBOL_KINDS.TYPEALIAS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Subscript
  subscriptDeclaration: {
    pattern: 'subscript($$$PARAMS) -> $RETURN { $$$BODY }',
    kind: SYMBOL_KINDS.SUBSCRIPT,
    extract: (match) => ({
      name: 'subscript',
      params: extractParams(match.getMatch('PARAMS')),
      returnType: match.getMatch('RETURN')?.text() || '',
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

  // Import specific type
  importType: {
    pattern: 'import $KIND $MODULE.$NAME',
    extract: (match) => ({
      kind: match.getMatch('KIND')?.text() || '',
      module: match.getMatch('MODULE')?.text() || '',
      name: match.getMatch('NAME')?.text() || '',
      type: 'import-specific'
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

  // Static method call
  staticMethodCall: {
    pattern: '$TYPE.$METHOD($$$ARGS)',
    extract: (match) => ({
      type: match.getMatch('TYPE')?.text() || '',
      method: match.getMatch('METHOD')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
      static: true
    })
  },

  // Initialization
  initCall: {
    pattern: '$TYPE($$$ARGS)',
    extract: (match) => ({
      type: match.getMatch('TYPE')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
      type: 'init'
    })
  },

  // Closure
  closure: {
    pattern: '{ ($$$PARAMS) -> $RETURN in $$$BODY }',
    extract: (match) => ({
      params: match.getMatch('PARAMS')?.text() || '',
      returnType: match.getMatch('RETURN')?.text() || '',
      type: 'closure'
    })
  },

  // Await expression
  awaitExpression: {
    pattern: 'await $EXPR',
    extract: (match) => ({
      expression: match.getMatch('EXPR')?.text() || '',
      type: 'await'
    })
  },

  // Try expression
  tryExpression: {
    pattern: 'try $EXPR',
    extract: (match) => ({
      expression: match.getMatch('EXPR')?.text() || '',
      type: 'try'
    })
  }
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.swift'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'swift';

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
      // Swift params: [external] internal: Type [= default]
      // or just: name: Type
      const colonIndex = p.indexOf(':');
      if (colonIndex > 0) {
        const namePart = p.substring(0, colonIndex).trim();
        const parts = namePart.split(/\s+/);
        // Last part is internal name
        return parts[parts.length - 1] || namePart;
      }
      return p;
    });
}

/**
 * Check if a type is a protocol (Swift convention)
 */
function isProtocolName(name) {
  return name.endsWith('Protocol') || name.endsWith('Delegate') || name.endsWith('DataSource');
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
  isProtocolName,
  inferKind
};
