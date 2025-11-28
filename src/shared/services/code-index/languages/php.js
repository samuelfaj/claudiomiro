/**
 * PHP AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common PHP code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
  CLASS: 'class',
  INTERFACE: 'interface',
  TRAIT: 'trait',
  ENUM: 'enum',
  FUNCTION: 'function',
  METHOD: 'method',
  PROPERTY: 'property',
  CONSTANT: 'constant',
  NAMESPACE: 'namespace',
  CONSTRUCTOR: 'constructor'
};

/**
 * Patterns for extracting symbols from PHP code
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

  // Class with extends
  classWithExtends: {
    pattern: 'class $NAME extends $PARENT { $$$BODY }',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      extends: match.getMatch('PARENT')?.text() || '',
    })
  },

  // Class with implements
  classWithImplements: {
    pattern: 'class $NAME implements $$$INTERFACES { $$$BODY }',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      implements: match.getMatch('INTERFACES')?.text() || '',
    })
  },

  // Abstract class
  abstractClass: {
    pattern: 'abstract class $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      abstract: true
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

  // Readonly class (PHP 8.2+)
  readonlyClass: {
    pattern: 'readonly class $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      readonly: true
    })
  },

  // Interface declaration
  interfaceDeclaration: {
    pattern: 'interface $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.INTERFACE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Trait declaration
  traitDeclaration: {
    pattern: 'trait $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.TRAIT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Enum declaration (PHP 8.1+)
  enumDeclaration: {
    pattern: 'enum $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.ENUM,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Backed enum
  backedEnum: {
    pattern: 'enum $NAME: $TYPE { $$$BODY }',
    kind: SYMBOL_KINDS.ENUM,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      backingType: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Function declaration
  functionDeclaration: {
    pattern: 'function $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Function with return type
  functionWithReturn: {
    pattern: 'function $NAME($$$PARAMS): $RETURN { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      returnType: match.getMatch('RETURN')?.text() || '',
    })
  },

  // Method declaration
  methodDeclaration: {
    pattern: 'function $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.METHOD,
    context: 'class_body',
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Public method
  publicMethod: {
    pattern: 'public function $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      public: true
    })
  },

  // Protected method
  protectedMethod: {
    pattern: 'protected function $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      protected: true
    })
  },

  // Private method
  privateMethod: {
    pattern: 'private function $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      private: true
    })
  },

  // Static method
  staticMethod: {
    pattern: 'static function $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      static: true
    })
  },

  // Abstract method
  abstractMethod: {
    pattern: 'abstract function $NAME($$$PARAMS);',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      abstract: true
    })
  },

  // Constructor
  constructorMethod: {
    pattern: 'function __construct($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.CONSTRUCTOR,
    extract: (match) => ({
      name: '__construct',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Property declaration
  propertyDeclaration: {
    pattern: 'public $TYPE $$NAME;',
    kind: SYMBOL_KINDS.PROPERTY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      public: true
    })
  },

  // Private property
  privateProperty: {
    pattern: 'private $TYPE $$NAME;',
    kind: SYMBOL_KINDS.PROPERTY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      private: true
    })
  },

  // Protected property
  protectedProperty: {
    pattern: 'protected $TYPE $$NAME;',
    kind: SYMBOL_KINDS.PROPERTY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      protected: true
    })
  },

  // Readonly property
  readonlyProperty: {
    pattern: 'readonly $TYPE $$NAME;',
    kind: SYMBOL_KINDS.PROPERTY,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      readonly: true
    })
  },

  // Class constant
  classConstant: {
    pattern: 'const $NAME = $VALUE;',
    kind: SYMBOL_KINDS.CONSTANT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Public constant
  publicConstant: {
    pattern: 'public const $NAME = $VALUE;',
    kind: SYMBOL_KINDS.CONSTANT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      public: true
    })
  },

  // Define constant
  defineConstant: {
    pattern: "define('$NAME', $VALUE)",
    kind: SYMBOL_KINDS.CONSTANT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      global: true
    })
  },

  // Namespace declaration
  namespaceDeclaration: {
    pattern: 'namespace $NAME;',
    kind: SYMBOL_KINDS.NAMESPACE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Namespace with block
  namespaceBlock: {
    pattern: 'namespace $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.NAMESPACE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  }
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
  // Use statement
  useStatement: {
    pattern: 'use $CLASS;',
    extract: (match) => ({
      class: match.getMatch('CLASS')?.text() || '',
      type: 'use'
    })
  },

  // Use with alias
  useAlias: {
    pattern: 'use $CLASS as $ALIAS;',
    extract: (match) => ({
      class: match.getMatch('CLASS')?.text() || '',
      alias: match.getMatch('ALIAS')?.text() || '',
      type: 'use-alias'
    })
  },

  // Use function
  useFunction: {
    pattern: 'use function $FUNCTION;',
    extract: (match) => ({
      function: match.getMatch('FUNCTION')?.text() || '',
      type: 'use-function'
    })
  },

  // Use const
  useConst: {
    pattern: 'use const $CONST;',
    extract: (match) => ({
      const: match.getMatch('CONST')?.text() || '',
      type: 'use-const'
    })
  },

  // Use trait
  useTrait: {
    pattern: 'use $TRAIT;',
    extract: (match) => ({
      trait: match.getMatch('TRAIT')?.text() || '',
      type: 'use-trait'
    })
  },

  // Require
  requireStatement: {
    pattern: "require '$FILE';",
    extract: (match) => ({
      file: match.getMatch('FILE')?.text() || '',
      type: 'require'
    })
  },

  // Require once
  requireOnce: {
    pattern: "require_once '$FILE';",
    extract: (match) => ({
      file: match.getMatch('FILE')?.text() || '',
      type: 'require_once'
    })
  },

  // Include
  includeStatement: {
    pattern: "include '$FILE';",
    extract: (match) => ({
      file: match.getMatch('FILE')?.text() || '',
      type: 'include'
    })
  },

  // Include once
  includeOnce: {
    pattern: "include_once '$FILE';",
    extract: (match) => ({
      file: match.getMatch('FILE')?.text() || '',
      type: 'include_once'
    })
  },

  // Method call
  methodCall: {
    pattern: '$OBJ->$METHOD($$$ARGS)',
    extract: (match) => ({
      object: match.getMatch('OBJ')?.text() || '',
      method: match.getMatch('METHOD')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
    })
  },

  // Static method call
  staticMethodCall: {
    pattern: '$CLASS::$METHOD($$$ARGS)',
    extract: (match) => ({
      class: match.getMatch('CLASS')?.text() || '',
      method: match.getMatch('METHOD')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
      static: true
    })
  },

  // New instance
  newInstance: {
    pattern: 'new $CLASS($$$ARGS)',
    extract: (match) => ({
      class: match.getMatch('CLASS')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
      type: 'new'
    })
  }
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.php', '.phtml', '.php3', '.php4', '.php5', '.phps'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'php';

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
      // PHP params: [?type] $name [= default]
      const match = p.match(/\$(\w+)/);
      return match ? match[1] : p;
    });
}

/**
 * Check if a name follows PHP constant convention (UPPER_CASE)
 */
function isConstantName(name) {
  return /^[A-Z_][A-Z0-9_]*$/.test(name);
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
  inferKind
};
