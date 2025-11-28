/**
 * C# AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common C# code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
    CLASS: 'class',
    INTERFACE: 'interface',
    STRUCT: 'struct',
    ENUM: 'enum',
    RECORD: 'record',
    METHOD: 'method',
    PROPERTY: 'property',
    FIELD: 'field',
    CONSTANT: 'constant',
    EVENT: 'event',
    DELEGATE: 'delegate',
    NAMESPACE: 'namespace',
    CONSTRUCTOR: 'constructor',
    INDEXER: 'indexer',
    OPERATOR: 'operator',
};

/**
 * Patterns for extracting symbols from C# code
 */
const PATTERNS = {
    // Class declaration
    classDeclaration: {
        pattern: 'class $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Public class
    publicClass: {
        pattern: 'public class $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            public: true,
        }),
    },

    // Abstract class
    abstractClass: {
        pattern: 'abstract class $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            abstract: true,
        }),
    },

    // Sealed class
    sealedClass: {
        pattern: 'sealed class $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            sealed: true,
        }),
    },

    // Static class
    staticClass: {
        pattern: 'static class $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            static: true,
        }),
    },

    // Partial class
    partialClass: {
        pattern: 'partial class $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            partial: true,
        }),
    },

    // Class with inheritance
    classWithBase: {
        pattern: 'class $NAME : $$$BASES { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            bases: match.getMatch('BASES')?.text() || '',
        }),
    },

    // Interface declaration
    interfaceDeclaration: {
        pattern: 'interface $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.INTERFACE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Struct declaration
    structDeclaration: {
        pattern: 'struct $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.STRUCT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Record declaration
    recordDeclaration: {
        pattern: 'record $NAME($$$PARAMS);',
        kind: SYMBOL_KINDS.RECORD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Record class
    recordClass: {
        pattern: 'record class $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.RECORD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            isClass: true,
        }),
    },

    // Enum declaration
    enumDeclaration: {
        pattern: 'enum $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.ENUM,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Method declaration
    methodDeclaration: {
        pattern: '$RETURN $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Public method
    publicMethod: {
        pattern: 'public $RETURN $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            public: true,
        }),
    },

    // Async method
    asyncMethod: {
        pattern: 'async $RETURN $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            async: true,
        }),
    },

    // Static method
    staticMethod: {
        pattern: 'static $RETURN $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            static: true,
        }),
    },

    // Virtual method
    virtualMethod: {
        pattern: 'virtual $RETURN $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            virtual: true,
        }),
    },

    // Override method
    overrideMethod: {
        pattern: 'override $RETURN $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            override: true,
        }),
    },

    // Abstract method
    abstractMethod: {
        pattern: 'abstract $RETURN $NAME($$$PARAMS);',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            abstract: true,
        }),
    },

    // Property declaration
    propertyDeclaration: {
        pattern: '$TYPE $NAME { get; set; }',
        kind: SYMBOL_KINDS.PROPERTY,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Public property
    publicProperty: {
        pattern: 'public $TYPE $NAME { $$$ACCESSORS }',
        kind: SYMBOL_KINDS.PROPERTY,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            public: true,
        }),
    },

    // Readonly property
    readonlyProperty: {
        pattern: '$TYPE $NAME { get; }',
        kind: SYMBOL_KINDS.PROPERTY,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            readonly: true,
        }),
    },

    // Field declaration
    fieldDeclaration: {
        pattern: 'private $TYPE $NAME;',
        kind: SYMBOL_KINDS.FIELD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            private: true,
        }),
    },

    // Readonly field
    readonlyField: {
        pattern: 'readonly $TYPE $NAME;',
        kind: SYMBOL_KINDS.FIELD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            readonly: true,
        }),
    },

    // Const field
    constField: {
        pattern: 'const $TYPE $NAME = $VALUE;',
        kind: SYMBOL_KINDS.CONSTANT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Static readonly
    staticReadonly: {
        pattern: 'static readonly $TYPE $NAME = $VALUE;',
        kind: SYMBOL_KINDS.CONSTANT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            static: true,
        }),
    },

    // Event declaration
    eventDeclaration: {
        pattern: 'event $TYPE $NAME;',
        kind: SYMBOL_KINDS.EVENT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Delegate declaration
    delegateDeclaration: {
        pattern: 'delegate $RETURN $NAME($$$PARAMS);',
        kind: SYMBOL_KINDS.DELEGATE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Namespace declaration
    namespaceDeclaration: {
        pattern: 'namespace $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.NAMESPACE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // File scoped namespace
    fileScopedNamespace: {
        pattern: 'namespace $NAME;',
        kind: SYMBOL_KINDS.NAMESPACE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            fileScoped: true,
        }),
    },

    // Constructor
    constructorDeclaration: {
        pattern: '$NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.CONSTRUCTOR,
        context: 'class_declaration',
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
    // Using directive
    usingDirective: {
        pattern: 'using $NAMESPACE;',
        extract: (match) => ({
            namespace: match.getMatch('NAMESPACE')?.text() || '',
            type: 'using',
        }),
    },

    // Using static
    usingStatic: {
        pattern: 'using static $TYPE;',
        extract: (match) => ({
            type: match.getMatch('TYPE')?.text() || '',
            referenceType: 'using-static',
        }),
    },

    // Using alias
    usingAlias: {
        pattern: 'using $ALIAS = $TYPE;',
        extract: (match) => ({
            alias: match.getMatch('ALIAS')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            referenceType: 'using-alias',
        }),
    },

    // Global using
    globalUsing: {
        pattern: 'global using $NAMESPACE;',
        extract: (match) => ({
            namespace: match.getMatch('NAMESPACE')?.text() || '',
            type: 'global-using',
        }),
    },

    // Method call
    methodCall: {
        pattern: '$RECEIVER.$METHOD($$$ARGS)',
        extract: (match) => ({
            receiver: match.getMatch('RECEIVER')?.text() || '',
            method: match.getMatch('METHOD')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
        }),
    },

    // Static method call
    staticMethodCall: {
        pattern: '$TYPE.$METHOD($$$ARGS)',
        extract: (match) => ({
            type: match.getMatch('TYPE')?.text() || '',
            method: match.getMatch('METHOD')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
            static: true,
        }),
    },

    // Constructor call
    constructorCall: {
        pattern: 'new $TYPE($$$ARGS)',
        extract: (match) => ({
            type: match.getMatch('TYPE')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
            referenceType: 'constructor',
        }),
    },

    // Await expression
    awaitExpression: {
        pattern: 'await $EXPR',
        extract: (match) => ({
            expression: match.getMatch('EXPR')?.text() || '',
            type: 'await',
        }),
    },

    // LINQ query
    linqQuery: {
        pattern: 'from $VAR in $SOURCE $$$REST',
        extract: (match) => ({
            variable: match.getMatch('VAR')?.text() || '',
            source: match.getMatch('SOURCE')?.text() || '',
            type: 'linq',
        }),
    },
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.cs', '.csx'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'csharp';

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
            // C# params are: [modifiers] type name [= default]
            const parts = p.split(/\s+/);
            let name = parts[parts.length - 1] || p;
            // Remove default value
            const eqIdx = name.indexOf('=');
            if (eqIdx > 0) {
                name = name.substring(0, eqIdx).trim();
            }
            return name;
        });
}

/**
 * Check if follows PascalCase (C# convention for public members)
 */
function isPascalCase(name) {
    return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

/**
 * Check if follows _camelCase (C# convention for private fields)
 */
function isPrivateFieldName(name) {
    return /^_[a-z]/.test(name);
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
    isPascalCase,
    isPrivateFieldName,
    inferKind,
};
