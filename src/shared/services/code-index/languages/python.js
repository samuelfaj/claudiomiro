/**
 * Python AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common Python code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
    FUNCTION: 'function',
    CLASS: 'class',
    METHOD: 'method',
    VARIABLE: 'variable',
    CONSTANT: 'constant',
    DECORATOR: 'decorator',
    PROPERTY: 'property',
    MODULE: 'module',
    ASYNC_FUNCTION: 'async_function',
    GENERATOR: 'generator',
};

/**
 * Patterns for extracting symbols from Python code
 */
const PATTERNS = {
    // Function definitions
    functionDefinition: {
        pattern: 'def $NAME($$$PARAMS): $$$BODY',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Async function definitions
    asyncFunctionDefinition: {
        pattern: 'async def $NAME($$$PARAMS): $$$BODY',
        kind: SYMBOL_KINDS.ASYNC_FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            async: true,
        }),
    },

    // Class definitions
    classDefinition: {
        pattern: 'class $NAME: $$$BODY',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Class with inheritance
    classWithInheritance: {
        pattern: 'class $NAME($$$BASES): $$$BODY',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            bases: match.getMatch('BASES')?.text() || '',
        }),
    },

    // Method definitions (inside class)
    methodDefinition: {
        pattern: 'def $NAME(self, $$$PARAMS): $$$BODY',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Class method
    classMethod: {
        pattern: '@classmethod\ndef $NAME(cls, $$$PARAMS): $$$BODY',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            classmethod: true,
        }),
    },

    // Static method
    staticMethod: {
        pattern: '@staticmethod\ndef $NAME($$$PARAMS): $$$BODY',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            staticmethod: true,
        }),
    },

    // Property decorator
    propertyDefinition: {
        pattern: '@property\ndef $NAME(self): $$$BODY',
        kind: SYMBOL_KINDS.PROPERTY,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Variable assignment (module level)
    variableAssignment: {
        pattern: '$NAME = $VALUE',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Constant (uppercase naming convention)
    constantAssignment: {
        pattern: '$NAME = $VALUE',
        kind: SYMBOL_KINDS.CONSTANT,
        extract: (match) => {
            const name = match.getMatch('NAME')?.text() || '';
            return {
                name,
                isConstant: /^[A-Z_][A-Z0-9_]*$/.test(name),
            };
        },
    },

    // Decorated function
    decoratedFunction: {
        pattern: '@$DECORATOR\ndef $NAME($$$PARAMS): $$$BODY',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            decorator: match.getMatch('DECORATOR')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Generator function
    generatorFunction: {
        pattern: 'def $NAME($$$PARAMS): $$$BODY yield $$$YIELD',
        kind: SYMBOL_KINDS.GENERATOR,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            generator: true,
        }),
    },
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
            type: 'import',
        }),
    },

    // From import
    fromImport: {
        pattern: 'from $MODULE import $NAMES',
        extract: (match) => ({
            module: match.getMatch('MODULE')?.text() || '',
            names: match.getMatch('NAMES')?.text() || '',
            type: 'from-import',
        }),
    },

    // From import with alias
    fromImportAlias: {
        pattern: 'from $MODULE import $NAME as $ALIAS',
        extract: (match) => ({
            module: match.getMatch('MODULE')?.text() || '',
            name: match.getMatch('NAME')?.text() || '',
            alias: match.getMatch('ALIAS')?.text() || '',
            type: 'from-import-alias',
        }),
    },

    // Import with alias
    importAlias: {
        pattern: 'import $MODULE as $ALIAS',
        extract: (match) => ({
            module: match.getMatch('MODULE')?.text() || '',
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
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.py', '.pyw', '.pyi'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'python';

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
            // Remove type annotations
            const colonIndex = p.indexOf(':');
            if (colonIndex > 0) {
                return p.substring(0, colonIndex).trim();
            }
            // Remove default values
            const equalsIndex = p.indexOf('=');
            if (equalsIndex > 0) {
                return p.substring(0, equalsIndex).trim();
            }
            return p;
        });
}

/**
 * Determine if a name follows Python constant convention (UPPER_CASE)
 */
function isConstantName(name) {
    return /^[A-Z_][A-Z0-9_]*$/.test(name);
}

/**
 * Determine if a name is a private member (starts with _)
 */
function isPrivateName(name) {
    return name.startsWith('_') && !name.startsWith('__');
}

/**
 * Determine if a name is a dunder method (__name__)
 */
function isDunderName(name) {
    return name.startsWith('__') && name.endsWith('__');
}

/**
 * Get the kind of symbol based on name conventions
 */
function inferKind(name, defaultKind) {
    if (isConstantName(name) && defaultKind === SYMBOL_KINDS.VARIABLE) {
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
    isPrivateName,
    isDunderName,
    inferKind,
};
