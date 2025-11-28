/**
 * C AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common C code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
    FUNCTION: 'function',
    STRUCT: 'struct',
    UNION: 'union',
    ENUM: 'enum',
    TYPEDEF: 'typedef',
    MACRO: 'macro',
    VARIABLE: 'variable',
    CONSTANT: 'constant',
    PROTOTYPE: 'prototype',
};

/**
 * Patterns for extracting symbols from C code
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
        }),
    },

    // Static function
    staticFunction: {
        pattern: 'static $RETURN $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            static: true,
        }),
    },

    // Function prototype
    functionPrototype: {
        pattern: '$RETURN $NAME($$$PARAMS);',
        kind: SYMBOL_KINDS.PROTOTYPE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Struct definition
    structDefinition: {
        pattern: 'struct $NAME { $$$FIELDS };',
        kind: SYMBOL_KINDS.STRUCT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Typedef struct
    typedefStruct: {
        pattern: 'typedef struct { $$$FIELDS } $NAME;',
        kind: SYMBOL_KINDS.STRUCT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            typedef: true,
        }),
    },

    // Named typedef struct
    namedTypedefStruct: {
        pattern: 'typedef struct $TAG { $$$FIELDS } $NAME;',
        kind: SYMBOL_KINDS.STRUCT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            tag: match.getMatch('TAG')?.text() || '',
            typedef: true,
        }),
    },

    // Union definition
    unionDefinition: {
        pattern: 'union $NAME { $$$FIELDS };',
        kind: SYMBOL_KINDS.UNION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Enum definition
    enumDefinition: {
        pattern: 'enum $NAME { $$$VALUES };',
        kind: SYMBOL_KINDS.ENUM,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Typedef
    typedefDeclaration: {
        pattern: 'typedef $TYPE $NAME;',
        kind: SYMBOL_KINDS.TYPEDEF,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Function pointer typedef
    typedefFunctionPointer: {
        pattern: 'typedef $RETURN (*$NAME)($$$PARAMS);',
        kind: SYMBOL_KINDS.TYPEDEF,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            returnType: match.getMatch('RETURN')?.text() || '',
            functionPointer: true,
        }),
    },

    // Macro definition
    macroDefinition: {
        pattern: '#define $NAME $$$VALUE',
        kind: SYMBOL_KINDS.MACRO,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Function-like macro
    functionMacro: {
        pattern: '#define $NAME($$$PARAMS) $$$BODY',
        kind: SYMBOL_KINDS.MACRO,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            functionLike: true,
        }),
    },

    // Global variable
    globalVariable: {
        pattern: '$TYPE $NAME;',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Global variable with init
    globalVariableInit: {
        pattern: '$TYPE $NAME = $VALUE;',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Const declaration
    constDeclaration: {
        pattern: 'const $TYPE $NAME = $VALUE;',
        kind: SYMBOL_KINDS.CONSTANT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Static const
    staticConst: {
        pattern: 'static const $TYPE $NAME = $VALUE;',
        kind: SYMBOL_KINDS.CONSTANT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            static: true,
        }),
    },

    // Extern declaration
    externDeclaration: {
        pattern: 'extern $TYPE $NAME;',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            extern: true,
        }),
    },
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
    // Include directive
    includeQuote: {
        pattern: '#include "$FILE"',
        extract: (match) => ({
            file: match.getMatch('FILE')?.text() || '',
            type: 'include-local',
        }),
    },

    // System include
    includeAngle: {
        pattern: '#include <$FILE>',
        extract: (match) => ({
            file: match.getMatch('FILE')?.text() || '',
            type: 'include-system',
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

    // Struct member access
    memberAccess: {
        pattern: '$VAR.$MEMBER',
        extract: (match) => ({
            var: match.getMatch('VAR')?.text() || '',
            member: match.getMatch('MEMBER')?.text() || '',
        }),
    },

    // Pointer member access
    pointerMemberAccess: {
        pattern: '$VAR->$MEMBER',
        extract: (match) => ({
            var: match.getMatch('VAR')?.text() || '',
            member: match.getMatch('MEMBER')?.text() || '',
            pointer: true,
        }),
    },
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.c', '.h'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'c';

/**
 * Helper function to extract parameter names from AST node
 */
function extractParams(paramsNode) {
    if (!paramsNode) return [];
    const text = paramsNode.text();
    if (!text || text === 'void') return [];

    return text
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => {
            // C params are: type name or type *name
            const parts = p.split(/\s+/);
            let name = parts[parts.length - 1] || p;
            // Remove pointer asterisks from name
            name = name.replace(/^\*+/, '');
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
    inferKind,
};
