/**
 * C++ AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common C++ code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
  FUNCTION: 'function',
  METHOD: 'method',
  CLASS: 'class',
  STRUCT: 'struct',
  NAMESPACE: 'namespace',
  ENUM: 'enum',
  ENUM_CLASS: 'enum_class',
  TYPEDEF: 'typedef',
  USING: 'using',
  TEMPLATE: 'template',
  VARIABLE: 'variable',
  CONSTANT: 'constant',
  MACRO: 'macro',
  CONSTRUCTOR: 'constructor',
  DESTRUCTOR: 'destructor',
  OPERATOR: 'operator'
};

/**
 * Patterns for extracting symbols from C++ code
 */
const PATTERNS = {
  // Function definition
  functionDefinition: {
    pattern: '$RETURN $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      returnType: match.getMatch('RETURN')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Const function
  constFunction: {
    pattern: '$RETURN $NAME($$$PARAMS) const { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      returnType: match.getMatch('RETURN')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      const: true
    })
  },

  // Virtual function
  virtualFunction: {
    pattern: 'virtual $RETURN $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      returnType: match.getMatch('RETURN')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      virtual: true
    })
  },

  // Pure virtual function
  pureVirtualFunction: {
    pattern: 'virtual $RETURN $NAME($$$PARAMS) = 0;',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      returnType: match.getMatch('RETURN')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      virtual: true,
      pure: true
    })
  },

  // Override function
  overrideFunction: {
    pattern: '$RETURN $NAME($$$PARAMS) override { $$$BODY }',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      returnType: match.getMatch('RETURN')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      override: true
    })
  },

  // Static function
  staticFunction: {
    pattern: 'static $RETURN $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      returnType: match.getMatch('RETURN')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      static: true
    })
  },

  // Class definition
  classDefinition: {
    pattern: 'class $NAME { $$$BODY };',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Class with inheritance
  classWithInheritance: {
    pattern: 'class $NAME : $$$BASES { $$$BODY };',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      bases: match.getMatch('BASES')?.text() || '',
    })
  },

  // Struct definition
  structDefinition: {
    pattern: 'struct $NAME { $$$BODY };',
    kind: SYMBOL_KINDS.STRUCT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Namespace definition
  namespaceDefinition: {
    pattern: 'namespace $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.NAMESPACE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Enum definition
  enumDefinition: {
    pattern: 'enum $NAME { $$$VALUES };',
    kind: SYMBOL_KINDS.ENUM,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Enum class (scoped enum)
  enumClass: {
    pattern: 'enum class $NAME { $$$VALUES };',
    kind: SYMBOL_KINDS.ENUM_CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      scoped: true
    })
  },

  // Template class
  templateClass: {
    pattern: 'template<$$$TPARAMS> class $NAME { $$$BODY };',
    kind: SYMBOL_KINDS.TEMPLATE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      templateParams: match.getMatch('TPARAMS')?.text() || '',
      isClass: true
    })
  },

  // Template function
  templateFunction: {
    pattern: 'template<$$$TPARAMS> $RETURN $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.TEMPLATE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      returnType: match.getMatch('RETURN')?.text() || '',
      templateParams: match.getMatch('TPARAMS')?.text() || '',
      isFunction: true
    })
  },

  // Constructor
  constructorDefinition: {
    pattern: '$NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.CONSTRUCTOR,
    context: 'class_body',
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Destructor
  destructorDefinition: {
    pattern: '~$NAME() { $$$BODY }',
    kind: SYMBOL_KINDS.DESTRUCTOR,
    extract: (match) => ({
      name: '~' + (match.getMatch('NAME')?.text() || ''),
    })
  },

  // Virtual destructor
  virtualDestructor: {
    pattern: 'virtual ~$NAME() { $$$BODY }',
    kind: SYMBOL_KINDS.DESTRUCTOR,
    extract: (match) => ({
      name: '~' + (match.getMatch('NAME')?.text() || ''),
      virtual: true
    })
  },

  // Using declaration
  usingDeclaration: {
    pattern: 'using $NAME = $TYPE;',
    kind: SYMBOL_KINDS.USING,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Typedef
  typedefDeclaration: {
    pattern: 'typedef $TYPE $NAME;',
    kind: SYMBOL_KINDS.TYPEDEF,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Constexpr variable
  constexprVariable: {
    pattern: 'constexpr $TYPE $NAME = $VALUE;',
    kind: SYMBOL_KINDS.CONSTANT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      constexpr: true
    })
  },

  // Const variable
  constVariable: {
    pattern: 'const $TYPE $NAME = $VALUE;',
    kind: SYMBOL_KINDS.CONSTANT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Static const member
  staticConstMember: {
    pattern: 'static const $TYPE $NAME = $VALUE;',
    kind: SYMBOL_KINDS.CONSTANT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      static: true
    })
  },

  // Macro definition
  macroDefinition: {
    pattern: '#define $NAME $$$VALUE',
    kind: SYMBOL_KINDS.MACRO,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Operator overload
  operatorOverload: {
    pattern: '$RETURN operator$OP($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.OPERATOR,
    extract: (match) => ({
      name: 'operator' + (match.getMatch('OP')?.text() || ''),
      returnType: match.getMatch('RETURN')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  }
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
  // Include quote
  includeQuote: {
    pattern: '#include "$FILE"',
    extract: (match) => ({
      file: match.getMatch('FILE')?.text() || '',
      type: 'include-local'
    })
  },

  // Include angle
  includeAngle: {
    pattern: '#include <$FILE>',
    extract: (match) => ({
      file: match.getMatch('FILE')?.text() || '',
      type: 'include-system'
    })
  },

  // Using namespace
  usingNamespace: {
    pattern: 'using namespace $NAMESPACE;',
    extract: (match) => ({
      namespace: match.getMatch('NAMESPACE')?.text() || '',
      type: 'using-namespace'
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
    pattern: '$OBJ.$METHOD($$$ARGS)',
    extract: (match) => ({
      object: match.getMatch('OBJ')?.text() || '',
      method: match.getMatch('METHOD')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
    })
  },

  // Arrow method call
  arrowMethodCall: {
    pattern: '$OBJ->$METHOD($$$ARGS)',
    extract: (match) => ({
      object: match.getMatch('OBJ')?.text() || '',
      method: match.getMatch('METHOD')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
      arrow: true
    })
  },

  // Scope resolution call
  scopeResolutionCall: {
    pattern: '$SCOPE::$NAME($$$ARGS)',
    extract: (match) => ({
      scope: match.getMatch('SCOPE')?.text() || '',
      name: match.getMatch('NAME')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
    })
  },

  // New expression
  newExpression: {
    pattern: 'new $TYPE($$$ARGS)',
    extract: (match) => ({
      type: match.getMatch('TYPE')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
      type: 'new'
    })
  },

  // Make unique
  makeUnique: {
    pattern: 'std::make_unique<$TYPE>($$$ARGS)',
    extract: (match) => ({
      type: match.getMatch('TYPE')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
      type: 'make_unique'
    })
  },

  // Make shared
  makeShared: {
    pattern: 'std::make_shared<$TYPE>($$$ARGS)',
    extract: (match) => ({
      type: match.getMatch('TYPE')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
      type: 'make_shared'
    })
  }
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx', '.h'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'cpp';

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
      // C++ params can be: type name, type& name, type* name, const type& name, etc.
      const parts = p.split(/\s+/);
      let name = parts[parts.length - 1] || p;
      // Remove reference and pointer symbols from name
      name = name.replace(/^[&*]+/, '');
      // Remove default value
      const eqIdx = name.indexOf('=');
      if (eqIdx > 0) {
        name = name.substring(0, eqIdx).trim();
      }
      return name;
    });
}

/**
 * Check if a name is a macro constant (UPPER_CASE)
 */
function isMacroName(name) {
  return /^[A-Z_][A-Z0-9_]*$/.test(name);
}

/**
 * Get the kind of symbol based on conventions
 */
function inferKind(name, defaultKind) {
  if (isMacroName(name) && defaultKind === SYMBOL_KINDS.VARIABLE) {
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
  isMacroName,
  inferKind
};
