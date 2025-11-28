/**
 * Kotlin AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common Kotlin code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
    CLASS: 'class',
    INTERFACE: 'interface',
    OBJECT: 'object',
    DATA_CLASS: 'data_class',
    SEALED_CLASS: 'sealed_class',
    ENUM_CLASS: 'enum_class',
    ANNOTATION_CLASS: 'annotation_class',
    FUNCTION: 'function',
    PROPERTY: 'property',
    CONSTANT: 'constant',
    TYPEALIAS: 'typealias',
    CONSTRUCTOR: 'constructor',
    COMPANION_OBJECT: 'companion_object',
    EXTENSION: 'extension',
};

/**
 * Patterns for extracting symbols from Kotlin code
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

    // Class with primary constructor
    classWithConstructor: {
        pattern: 'class $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Class with inheritance
    classWithInheritance: {
        pattern: 'class $NAME : $$$TYPES { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            inherits: match.getMatch('TYPES')?.text() || '',
        }),
    },

    // Open class
    openClass: {
        pattern: 'open class $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            open: true,
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

    // Data class
    dataClass: {
        pattern: 'data class $NAME($$$PARAMS)',
        kind: SYMBOL_KINDS.DATA_CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Sealed class
    sealedClass: {
        pattern: 'sealed class $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.SEALED_CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Enum class
    enumClass: {
        pattern: 'enum class $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.ENUM_CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Annotation class
    annotationClass: {
        pattern: 'annotation class $NAME',
        kind: SYMBOL_KINDS.ANNOTATION_CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
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

    // Object declaration (singleton)
    objectDeclaration: {
        pattern: 'object $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.OBJECT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Companion object
    companionObject: {
        pattern: 'companion object { $$$BODY }',
        kind: SYMBOL_KINDS.COMPANION_OBJECT,
        extract: (_match) => ({
            name: 'Companion',
        }),
    },

    // Named companion object
    namedCompanionObject: {
        pattern: 'companion object $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.COMPANION_OBJECT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || 'Companion',
        }),
    },

    // Function declaration
    functionDeclaration: {
        pattern: 'fun $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Function with return type
    functionWithReturn: {
        pattern: 'fun $NAME($$$PARAMS): $RETURN { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            returnType: match.getMatch('RETURN')?.text() || '',
        }),
    },

    // Suspend function
    suspendFunction: {
        pattern: 'suspend fun $NAME($$$PARAMS) $$$REST { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            suspend: true,
        }),
    },

    // Inline function
    inlineFunction: {
        pattern: 'inline fun $NAME($$$PARAMS) $$$REST { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            inline: true,
        }),
    },

    // Private function
    privateFunction: {
        pattern: 'private fun $NAME($$$PARAMS) $$$REST { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            private: true,
        }),
    },

    // Internal function
    internalFunction: {
        pattern: 'internal fun $NAME($$$PARAMS) $$$REST { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            internal: true,
        }),
    },

    // Extension function
    extensionFunction: {
        pattern: 'fun $RECEIVER.$NAME($$$PARAMS) $$$REST { $$$BODY }',
        kind: SYMBOL_KINDS.EXTENSION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            receiver: match.getMatch('RECEIVER')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Override function
    overrideFunction: {
        pattern: 'override fun $NAME($$$PARAMS) $$$REST { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            override: true,
        }),
    },

    // Val property
    valProperty: {
        pattern: 'val $NAME: $TYPE = $VALUE',
        kind: SYMBOL_KINDS.PROPERTY,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            readonly: true,
        }),
    },

    // Var property
    varProperty: {
        pattern: 'var $NAME: $TYPE = $VALUE',
        kind: SYMBOL_KINDS.PROPERTY,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Lateinit var
    lateinitVar: {
        pattern: 'lateinit var $NAME: $TYPE',
        kind: SYMBOL_KINDS.PROPERTY,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            lateinit: true,
        }),
    },

    // Lazy property
    lazyProperty: {
        pattern: 'val $NAME by lazy { $$$BODY }',
        kind: SYMBOL_KINDS.PROPERTY,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            lazy: true,
        }),
    },

    // Const val
    constVal: {
        pattern: 'const val $NAME = $VALUE',
        kind: SYMBOL_KINDS.CONSTANT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Typealias
    typealiasDeclaration: {
        pattern: 'typealias $NAME = $TYPE',
        kind: SYMBOL_KINDS.TYPEALIAS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Primary constructor
    primaryConstructor: {
        pattern: 'constructor($$$PARAMS)',
        kind: SYMBOL_KINDS.CONSTRUCTOR,
        extract: (match) => ({
            name: 'constructor',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Secondary constructor
    secondaryConstructor: {
        pattern: 'constructor($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.CONSTRUCTOR,
        extract: (match) => ({
            name: 'constructor',
            params: extractParams(match.getMatch('PARAMS')),
            secondary: true,
        }),
    },
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
    // Import statement
    importStatement: {
        pattern: 'import $PATH',
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            type: 'import',
        }),
    },

    // Import with alias
    importAlias: {
        pattern: 'import $PATH as $ALIAS',
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            alias: match.getMatch('ALIAS')?.text() || '',
            type: 'import-alias',
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

    // Constructor call
    constructorCall: {
        pattern: '$CLASS($$$ARGS)',
        extract: (match) => ({
            class: match.getMatch('CLASS')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
            type: 'constructor',
        }),
    },

    // Safe call
    safeCall: {
        pattern: '$RECEIVER?.$METHOD($$$ARGS)',
        extract: (match) => ({
            receiver: match.getMatch('RECEIVER')?.text() || '',
            method: match.getMatch('METHOD')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
            safe: true,
        }),
    },

    // Elvis operator
    elvisOperator: {
        pattern: '$EXPR ?: $DEFAULT',
        extract: (match) => ({
            expression: match.getMatch('EXPR')?.text() || '',
            default: match.getMatch('DEFAULT')?.text() || '',
            type: 'elvis',
        }),
    },

    // Lambda
    lambdaExpression: {
        pattern: '{ $$$PARAMS -> $$$BODY }',
        extract: (match) => ({
            params: match.getMatch('PARAMS')?.text() || '',
            type: 'lambda',
        }),
    },

    // Coroutine launch
    coroutineLaunch: {
        pattern: 'launch { $$$BODY }',
        extract: (_match) => ({
            type: 'coroutine-launch',
        }),
    },

    // Coroutine async
    coroutineAsync: {
        pattern: 'async { $$$BODY }',
        extract: (_match) => ({
            type: 'coroutine-async',
        }),
    },
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.kt', '.kts'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'kotlin';

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
            // Kotlin params: [vararg] name: Type [= default]
            const colonIndex = p.indexOf(':');
            if (colonIndex > 0) {
                let namePart = p.substring(0, colonIndex).trim();
                // Remove vararg, val, var keywords
                namePart = namePart.replace(/^(vararg|val|var)\s+/, '');
                return namePart;
            }
            return p;
        });
}

/**
 * Check if follows Kotlin constant convention (UPPER_CASE)
 */
function isConstantName(name) {
    return /^[A-Z_][A-Z0-9_]*$/.test(name);
}

/**
 * Get the kind of symbol based on conventions
 */
function inferKind(name, defaultKind) {
    if (isConstantName(name) && defaultKind === SYMBOL_KINDS.PROPERTY) {
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
    inferKind,
};
