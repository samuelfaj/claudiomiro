/**
 * Dart AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common Dart code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
    CLASS: 'class',
    ABSTRACT_CLASS: 'abstract_class',
    MIXIN: 'mixin',
    EXTENSION: 'extension',
    ENUM: 'enum',
    FUNCTION: 'function',
    METHOD: 'method',
    GETTER: 'getter',
    SETTER: 'setter',
    CONSTRUCTOR: 'constructor',
    FACTORY: 'factory',
    VARIABLE: 'variable',
    CONSTANT: 'constant',
    TYPEDEF: 'typedef',
    PART: 'part',
    LIBRARY: 'library',
};

/**
 * Patterns for extracting symbols from Dart code
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

    // Class with extends
    classWithExtends: {
        pattern: 'class $NAME extends $PARENT { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            extends: match.getMatch('PARENT')?.text() || '',
        }),
    },

    // Class with implements
    classWithImplements: {
        pattern: 'class $NAME implements $$$INTERFACES { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            implements: match.getMatch('INTERFACES')?.text() || '',
        }),
    },

    // Class with mixin
    classWithMixin: {
        pattern: 'class $NAME with $$$MIXINS { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            mixins: match.getMatch('MIXINS')?.text() || '',
        }),
    },

    // Abstract class
    abstractClass: {
        pattern: 'abstract class $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.ABSTRACT_CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Mixin declaration
    mixinDeclaration: {
        pattern: 'mixin $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.MIXIN,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Mixin on
    mixinOn: {
        pattern: 'mixin $NAME on $TYPE { $$$BODY }',
        kind: SYMBOL_KINDS.MIXIN,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            on: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Extension declaration
    extensionDeclaration: {
        pattern: 'extension $NAME on $TYPE { $$$BODY }',
        kind: SYMBOL_KINDS.EXTENSION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            on: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Enum declaration
    enumDeclaration: {
        pattern: 'enum $NAME { $$$VALUES }',
        kind: SYMBOL_KINDS.ENUM,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Enhanced enum (Dart 2.17+)
    enhancedEnum: {
        pattern: 'enum $NAME { $$$VALUES; $$$MEMBERS }',
        kind: SYMBOL_KINDS.ENUM,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            enhanced: true,
        }),
    },

    // Function declaration
    functionDeclaration: {
        pattern: '$RETURN $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Async function
    asyncFunction: {
        pattern: '$RETURN $NAME($$$PARAMS) async { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            async: true,
        }),
    },

    // Arrow function
    arrowFunction: {
        pattern: '$RETURN $NAME($$$PARAMS) => $BODY;',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            arrow: true,
        }),
    },

    // Getter
    getterDeclaration: {
        pattern: '$TYPE get $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.GETTER,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Arrow getter
    arrowGetter: {
        pattern: '$TYPE get $NAME => $BODY;',
        kind: SYMBOL_KINDS.GETTER,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            arrow: true,
        }),
    },

    // Setter
    setterDeclaration: {
        pattern: 'set $NAME($PARAM) { $$$BODY }',
        kind: SYMBOL_KINDS.SETTER,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            param: match.getMatch('PARAM')?.text() || '',
        }),
    },

    // Constructor
    constructorDeclaration: {
        pattern: '$CLASS($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.CONSTRUCTOR,
        context: 'class_body',
        extract: (match) => ({
            name: match.getMatch('CLASS')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Named constructor
    namedConstructor: {
        pattern: '$CLASS.$NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.CONSTRUCTOR,
        extract: (match) => ({
            class: match.getMatch('CLASS')?.text() || '',
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Factory constructor
    factoryConstructor: {
        pattern: 'factory $CLASS($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.FACTORY,
        extract: (match) => ({
            name: match.getMatch('CLASS')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Named factory constructor
    namedFactoryConstructor: {
        pattern: 'factory $CLASS.$NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.FACTORY,
        extract: (match) => ({
            class: match.getMatch('CLASS')?.text() || '',
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Variable declaration
    varDeclaration: {
        pattern: 'var $NAME = $VALUE;',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Final variable
    finalVariable: {
        pattern: 'final $NAME = $VALUE;',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            final: true,
        }),
    },

    // Const variable
    constVariable: {
        pattern: 'const $NAME = $VALUE;',
        kind: SYMBOL_KINDS.CONSTANT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Late variable
    lateVariable: {
        pattern: 'late $TYPE $NAME;',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            late: true,
        }),
    },

    // Static variable
    staticVariable: {
        pattern: 'static $TYPE $NAME = $VALUE;',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            static: true,
        }),
    },

    // Typedef
    typedefDeclaration: {
        pattern: 'typedef $NAME = $TYPE;',
        kind: SYMBOL_KINDS.TYPEDEF,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Function typedef
    functionTypedef: {
        pattern: 'typedef $RETURN $NAME($$$PARAMS);',
        kind: SYMBOL_KINDS.TYPEDEF,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Library declaration
    libraryDeclaration: {
        pattern: 'library $NAME;',
        kind: SYMBOL_KINDS.LIBRARY,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Part directive
    partDirective: {
        pattern: "part '$PATH';",
        kind: SYMBOL_KINDS.PART,
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
        }),
    },

    // Part of directive
    partOfDirective: {
        pattern: "part of '$LIBRARY';",
        kind: SYMBOL_KINDS.PART,
        extract: (match) => ({
            library: match.getMatch('LIBRARY')?.text() || '',
        }),
    },
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
    // Import statement
    importStatement: {
        pattern: "import '$PATH';",
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            type: 'import',
        }),
    },

    // Import with as
    importAs: {
        pattern: "import '$PATH' as $ALIAS;",
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            alias: match.getMatch('ALIAS')?.text() || '',
            type: 'import',
        }),
    },

    // Import show
    importShow: {
        pattern: "import '$PATH' show $$$NAMES;",
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            show: match.getMatch('NAMES')?.text() || '',
            type: 'import',
        }),
    },

    // Import hide
    importHide: {
        pattern: "import '$PATH' hide $$$NAMES;",
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            hide: match.getMatch('NAMES')?.text() || '',
            type: 'import',
        }),
    },

    // Export statement
    exportStatement: {
        pattern: "export '$PATH';",
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            type: 'export',
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

    // Cascade call
    cascadeCall: {
        pattern: '..$METHOD($$$ARGS)',
        extract: (match) => ({
            method: match.getMatch('METHOD')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
            cascade: true,
        }),
    },

    // Constructor call
    constructorCall: {
        pattern: '$CLASS($$$ARGS)',
        extract: (match) => ({
            class: match.getMatch('CLASS')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
            type: 'constructor',
        }),
    },

    // Named constructor call
    namedConstructorCall: {
        pattern: '$CLASS.$NAME($$$ARGS)',
        extract: (match) => ({
            class: match.getMatch('CLASS')?.text() || '',
            name: match.getMatch('NAME')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
            type: 'named-constructor',
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

    // Spread operator
    spreadOperator: {
        pattern: '...$EXPR',
        extract: (match) => ({
            expression: match.getMatch('EXPR')?.text() || '',
            type: 'spread',
        }),
    },
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.dart'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'dart';

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
            // Dart params: [required] [this.] Type name [= default]
            // Remove type and get name
            const parts = p.split(/\s+/);
            let name = parts[parts.length - 1] || p;
            // Handle this.name
            if (name.startsWith('this.')) {
                name = name.substring(5);
            }
            // Remove default value
            const eqIdx = name.indexOf('=');
            if (eqIdx > 0) {
                name = name.substring(0, eqIdx).trim();
            }
            return name;
        });
}

/**
 * Check if a name is private (starts with _)
 */
function isPrivateName(name) {
    return name.startsWith('_');
}

/**
 * Check if a name is a constant (camelCase with leading lowercase is preferred in Dart)
 */
function isConstantName(name) {
    // Dart prefers lowerCamelCase for const, but UPPER_CASE is also used
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
    isPrivateName,
    isConstantName,
    inferKind,
};
