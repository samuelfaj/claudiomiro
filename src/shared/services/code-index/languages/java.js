/**
 * Java AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common Java code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
  CLASS: 'class',
  INTERFACE: 'interface',
  ENUM: 'enum',
  METHOD: 'method',
  CONSTRUCTOR: 'constructor',
  FIELD: 'field',
  CONSTANT: 'constant',
  ANNOTATION: 'annotation',
  RECORD: 'record',
  PACKAGE: 'package'
};

/**
 * Patterns for extracting symbols from Java code
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

  // Public class
  publicClass: {
    pattern: 'public class $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.CLASS,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      public: true
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

  // Interface declaration
  interfaceDeclaration: {
    pattern: 'interface $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.INTERFACE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Public interface
  publicInterface: {
    pattern: 'public interface $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.INTERFACE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      public: true
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

  // Record declaration (Java 14+)
  recordDeclaration: {
    pattern: 'record $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.RECORD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Method declaration
  methodDeclaration: {
    pattern: '$RETURN $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      returnType: match.getMatch('RETURN')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Public method
  publicMethod: {
    pattern: 'public $RETURN $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      returnType: match.getMatch('RETURN')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      public: true
    })
  },

  // Static method
  staticMethod: {
    pattern: 'static $RETURN $NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      returnType: match.getMatch('RETURN')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      static: true
    })
  },

  // Abstract method
  abstractMethod: {
    pattern: 'abstract $RETURN $NAME($$$PARAMS);',
    kind: SYMBOL_KINDS.METHOD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      returnType: match.getMatch('RETURN')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      abstract: true
    })
  },

  // Constructor
  constructorDeclaration: {
    pattern: '$NAME($$$PARAMS) { $$$BODY }',
    kind: SYMBOL_KINDS.CONSTRUCTOR,
    context: 'class_body',
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Field declaration
  fieldDeclaration: {
    pattern: 'private $TYPE $NAME;',
    kind: SYMBOL_KINDS.FIELD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      private: true
    })
  },

  // Field with initialization
  fieldWithInit: {
    pattern: 'private $TYPE $NAME = $VALUE;',
    kind: SYMBOL_KINDS.FIELD,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      private: true
    })
  },

  // Constant (static final)
  constantDeclaration: {
    pattern: 'static final $TYPE $NAME = $VALUE;',
    kind: SYMBOL_KINDS.CONSTANT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Public constant
  publicConstant: {
    pattern: 'public static final $TYPE $NAME = $VALUE;',
    kind: SYMBOL_KINDS.CONSTANT,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
      public: true
    })
  },

  // Annotation definition
  annotationDefinition: {
    pattern: '@interface $NAME { $$$BODY }',
    kind: SYMBOL_KINDS.ANNOTATION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Package declaration
  packageDeclaration: {
    pattern: 'package $NAME;',
    kind: SYMBOL_KINDS.PACKAGE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  }
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
  // Import statement
  importStatement: {
    pattern: 'import $PATH;',
    extract: (match) => ({
      path: match.getMatch('PATH')?.text() || '',
      type: 'import'
    })
  },

  // Static import
  staticImport: {
    pattern: 'import static $PATH;',
    extract: (match) => ({
      path: match.getMatch('PATH')?.text() || '',
      type: 'static-import'
    })
  },

  // Wildcard import
  wildcardImport: {
    pattern: 'import $PATH.*;',
    extract: (match) => ({
      path: match.getMatch('PATH')?.text() + '.*' || '',
      type: 'wildcard-import'
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

  // Constructor call
  constructorCall: {
    pattern: 'new $CLASS($$$ARGS)',
    extract: (match) => ({
      class: match.getMatch('CLASS')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
      type: 'constructor'
    })
  },

  // Static method call
  staticMethodCall: {
    pattern: '$CLASS.$METHOD($$$ARGS)',
    extract: (match) => ({
      class: match.getMatch('CLASS')?.text() || '',
      method: match.getMatch('METHOD')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
      type: 'static-call'
    })
  },

  // Annotation usage
  annotationUsage: {
    pattern: '@$NAME',
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: 'annotation'
    })
  }
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.java'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'java';

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
      // Java params are: [annotations] [modifiers] type name
      const parts = p.split(/\s+/);
      // Name is always the last part
      return parts[parts.length - 1] || p;
    });
}

/**
 * Check if a name follows Java constant convention (UPPER_CASE)
 */
function isConstantName(name) {
  return /^[A-Z_][A-Z0-9_]*$/.test(name);
}

/**
 * Get the kind of symbol based on conventions
 */
function inferKind(name, defaultKind) {
  if (isConstantName(name) && defaultKind === SYMBOL_KINDS.FIELD) {
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
  inferKind
};
