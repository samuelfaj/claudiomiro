/**
 * Go AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common Go code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
    FUNCTION: 'function',
    METHOD: 'method',
    STRUCT: 'struct',
    INTERFACE: 'interface',
    TYPE: 'type',
    VARIABLE: 'variable',
    CONSTANT: 'constant',
    PACKAGE: 'package',
    CHANNEL: 'channel',
};

/**
 * Patterns for extracting symbols from Go code
 */
const PATTERNS = {
    // Function declaration
    functionDeclaration: {
        pattern: 'func $NAME($$$PARAMS) $$$RETURN { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            returnType: match.getMatch('RETURN')?.text() || '',
        }),
    },

    // Function without return
    functionNoReturn: {
        pattern: 'func $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Method declaration (receiver)
    methodDeclaration: {
        pattern: 'func ($RECEIVER $TYPE) $NAME($$$PARAMS) $$$RETURN { $$$BODY }',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            receiver: match.getMatch('RECEIVER')?.text() || '',
            receiverType: match.getMatch('TYPE')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Pointer receiver method
    pointerMethodDeclaration: {
        pattern: 'func ($RECEIVER *$TYPE) $NAME($$$PARAMS) $$$RETURN { $$$BODY }',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            receiver: match.getMatch('RECEIVER')?.text() || '',
            receiverType: '*' + (match.getMatch('TYPE')?.text() || ''),
            params: extractParams(match.getMatch('PARAMS')),
            pointerReceiver: true,
        }),
    },

    // Struct type declaration
    structDeclaration: {
        pattern: 'type $NAME struct { $$$FIELDS }',
        kind: SYMBOL_KINDS.STRUCT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Interface declaration
    interfaceDeclaration: {
        pattern: 'type $NAME interface { $$$METHODS }',
        kind: SYMBOL_KINDS.INTERFACE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Type alias
    typeAlias: {
        pattern: 'type $NAME = $TYPE',
        kind: SYMBOL_KINDS.TYPE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            aliasOf: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Type definition
    typeDefinition: {
        pattern: 'type $NAME $TYPE',
        kind: SYMBOL_KINDS.TYPE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            baseType: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Const declaration
    constDeclaration: {
        pattern: 'const $NAME = $VALUE',
        kind: SYMBOL_KINDS.CONSTANT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Const with type
    constWithType: {
        pattern: 'const $NAME $TYPE = $VALUE',
        kind: SYMBOL_KINDS.CONSTANT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Var declaration
    varDeclaration: {
        pattern: 'var $NAME = $VALUE',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Var with type
    varWithType: {
        pattern: 'var $NAME $TYPE',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Short variable declaration
    shortVarDeclaration: {
        pattern: '$NAME := $VALUE',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Package declaration
    packageDeclaration: {
        pattern: 'package $NAME',
        kind: SYMBOL_KINDS.PACKAGE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
    // Single import
    singleImport: {
        pattern: 'import "$PATH"',
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            type: 'import',
        }),
    },

    // Import with alias
    importWithAlias: {
        pattern: 'import $ALIAS "$PATH"',
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            alias: match.getMatch('ALIAS')?.text() || '',
            type: 'import-alias',
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

    // Goroutine
    goroutine: {
        pattern: 'go $FUNC($$$ARGS)',
        extract: (match) => ({
            func: match.getMatch('FUNC')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
            type: 'goroutine',
        }),
    },

    // Defer
    deferCall: {
        pattern: 'defer $FUNC($$$ARGS)',
        extract: (match) => ({
            func: match.getMatch('FUNC')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
            type: 'defer',
        }),
    },
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.go'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'go';

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
            // Go params are: name type
            const parts = p.split(/\s+/);
            return parts[0] || p;
        });
}

/**
 * Determine if a name is exported (starts with uppercase)
 */
function isExportedName(name) {
    return /^[A-Z]/.test(name);
}

/**
 * Get the kind of symbol based on name conventions
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
    isExportedName,
    inferKind,
};
