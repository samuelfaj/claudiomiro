/**
 * Rust AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common Rust code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
    FUNCTION: 'function',
    METHOD: 'method',
    STRUCT: 'struct',
    ENUM: 'enum',
    TRAIT: 'trait',
    IMPL: 'impl',
    TYPE: 'type',
    CONST: 'constant',
    STATIC: 'static',
    MOD: 'module',
    MACRO: 'macro',
    ASYNC_FUNCTION: 'async_function',
};

/**
 * Patterns for extracting symbols from Rust code
 */
const PATTERNS = {
    // Function declaration
    functionDeclaration: {
        pattern: 'fn $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Function with return type
    functionWithReturn: {
        pattern: 'fn $NAME($$$PARAMS) -> $RETURN { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            returnType: match.getMatch('RETURN')?.text() || '',
        }),
    },

    // Public function
    pubFunction: {
        pattern: 'pub fn $NAME($$$PARAMS) $$$REST { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            public: true,
        }),
    },

    // Async function
    asyncFunction: {
        pattern: 'async fn $NAME($$$PARAMS) $$$REST { $$$BODY }',
        kind: SYMBOL_KINDS.ASYNC_FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            async: true,
        }),
    },

    // Struct declaration
    structDeclaration: {
        pattern: 'struct $NAME { $$$FIELDS }',
        kind: SYMBOL_KINDS.STRUCT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Tuple struct
    tupleStruct: {
        pattern: 'struct $NAME($$$FIELDS);',
        kind: SYMBOL_KINDS.STRUCT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            tuple: true,
        }),
    },

    // Public struct
    pubStruct: {
        pattern: 'pub struct $NAME $$$REST',
        kind: SYMBOL_KINDS.STRUCT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            public: true,
        }),
    },

    // Enum declaration
    enumDeclaration: {
        pattern: 'enum $NAME { $$$VARIANTS }',
        kind: SYMBOL_KINDS.ENUM,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Public enum
    pubEnum: {
        pattern: 'pub enum $NAME { $$$VARIANTS }',
        kind: SYMBOL_KINDS.ENUM,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            public: true,
        }),
    },

    // Trait declaration
    traitDeclaration: {
        pattern: 'trait $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.TRAIT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Public trait
    pubTrait: {
        pattern: 'pub trait $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.TRAIT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            public: true,
        }),
    },

    // Impl block
    implBlock: {
        pattern: 'impl $TYPE { $$$BODY }',
        kind: SYMBOL_KINDS.IMPL,
        extract: (match) => ({
            name: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Impl trait for type
    implTrait: {
        pattern: 'impl $TRAIT for $TYPE { $$$BODY }',
        kind: SYMBOL_KINDS.IMPL,
        extract: (match) => ({
            name: match.getMatch('TYPE')?.text() || '',
            trait: match.getMatch('TRAIT')?.text() || '',
        }),
    },

    // Type alias
    typeAlias: {
        pattern: 'type $NAME = $TYPE;',
        kind: SYMBOL_KINDS.TYPE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            aliasOf: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Const declaration
    constDeclaration: {
        pattern: 'const $NAME: $TYPE = $VALUE;',
        kind: SYMBOL_KINDS.CONST,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Static declaration
    staticDeclaration: {
        pattern: 'static $NAME: $TYPE = $VALUE;',
        kind: SYMBOL_KINDS.STATIC,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Module declaration
    modDeclaration: {
        pattern: 'mod $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.MOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Module file reference
    modReference: {
        pattern: 'mod $NAME;',
        kind: SYMBOL_KINDS.MOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            external: true,
        }),
    },

    // Macro definition
    macroDefinition: {
        pattern: 'macro_rules! $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.MACRO,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
    // Use statement
    useStatement: {
        pattern: 'use $PATH;',
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            type: 'use',
        }),
    },

    // Use with alias
    useAlias: {
        pattern: 'use $PATH as $ALIAS;',
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            alias: match.getMatch('ALIAS')?.text() || '',
            type: 'use-alias',
        }),
    },

    // Extern crate
    externCrate: {
        pattern: 'extern crate $NAME;',
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: 'extern-crate',
        }),
    },

    // Function call
    functionCall: {
        pattern: '$FUNC($$$ARGS)',
        extract: (match) => ({
            func: match.getMatch('FUNC')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
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

    // Macro invocation
    macroInvocation: {
        pattern: '$MACRO!($$$ARGS)',
        extract: (match) => ({
            macro: match.getMatch('MACRO')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
            type: 'macro',
        }),
    },
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.rs'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'rust';

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
            // Rust params are: name: type or &name: type or mut name: type
            const colonIndex = p.indexOf(':');
            if (colonIndex > 0) {
                let name = p.substring(0, colonIndex).trim();
                // Remove mut, &, etc.
                name = name.replace(/^(mut\s+|&\s*mut\s*|&\s*)/, '');
                return name;
            }
            return p;
        });
}

/**
 * Determine if a name follows Rust public convention
 */
function isPublicDeclaration(text) {
    return text.startsWith('pub ');
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
    isPublicDeclaration,
    inferKind,
};
