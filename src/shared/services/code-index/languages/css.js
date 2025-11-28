/**
 * CSS AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common CSS code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
    CLASS: 'class',
    ID: 'id',
    TAG: 'tag',
    VARIABLE: 'variable',
    MIXIN: 'mixin',
    FUNCTION: 'function',
    KEYFRAMES: 'keyframes',
    MEDIA_QUERY: 'media_query',
    FONT_FACE: 'font_face',
    IMPORT: 'import',
    PSEUDO_CLASS: 'pseudo_class',
    PSEUDO_ELEMENT: 'pseudo_element',
};

/**
 * Patterns for extracting symbols from CSS code
 */
const PATTERNS = {
    // Class selector
    classSelector: {
        pattern: '.$NAME { $$$RULES }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // ID selector
    idSelector: {
        pattern: '#$NAME { $$$RULES }',
        kind: SYMBOL_KINDS.ID,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Tag selector
    tagSelector: {
        pattern: '$TAG { $$$RULES }',
        kind: SYMBOL_KINDS.TAG,
        extract: (match) => ({
            name: match.getMatch('TAG')?.text() || '',
        }),
    },

    // CSS variable definition
    cssVariable: {
        pattern: '--$NAME: $VALUE;',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: '--' + (match.getMatch('NAME')?.text() || ''),
        }),
    },

    // Root variables
    rootVariables: {
        pattern: ':root { $$$VARS }',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (_match) => ({
            name: ':root',
            isRoot: true,
        }),
    },

    // Keyframes animation
    keyframes: {
        pattern: '@keyframes $NAME { $$$FRAMES }',
        kind: SYMBOL_KINDS.KEYFRAMES,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Webkit keyframes
    webkitKeyframes: {
        pattern: '@-webkit-keyframes $NAME { $$$FRAMES }',
        kind: SYMBOL_KINDS.KEYFRAMES,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            vendor: 'webkit',
        }),
    },

    // Media query
    mediaQuery: {
        pattern: '@media $QUERY { $$$RULES }',
        kind: SYMBOL_KINDS.MEDIA_QUERY,
        extract: (match) => ({
            query: match.getMatch('QUERY')?.text() || '',
        }),
    },

    // Font face
    fontFace: {
        pattern: '@font-face { $$$RULES }',
        kind: SYMBOL_KINDS.FONT_FACE,
        extract: (_match) => ({
            name: '@font-face',
        }),
    },

    // SCSS/SASS mixin definition
    mixinDefinition: {
        pattern: '@mixin $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.MIXIN,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // SCSS/SASS mixin with params
    mixinWithParams: {
        pattern: '@mixin $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.MIXIN,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // SCSS function
    scssFunction: {
        pattern: '@function $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.FUNCTION,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // SCSS variable
    scssVariable: {
        pattern: '$$NAME: $VALUE;',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: '$' + (match.getMatch('NAME')?.text() || ''),
            scss: true,
        }),
    },

    // SCSS default variable
    scssDefaultVariable: {
        pattern: '$$NAME: $VALUE !default;',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: '$' + (match.getMatch('NAME')?.text() || ''),
            scss: true,
            default: true,
        }),
    },

    // LESS variable
    lessVariable: {
        pattern: '@$NAME: $VALUE;',
        kind: SYMBOL_KINDS.VARIABLE,
        extract: (match) => ({
            name: '@' + (match.getMatch('NAME')?.text() || ''),
            less: true,
        }),
    },

    // LESS mixin
    lessMixin: {
        pattern: '.$NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.MIXIN,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            less: true,
        }),
    },

    // Supports query
    supportsQuery: {
        pattern: '@supports $CONDITION { $$$RULES }',
        kind: SYMBOL_KINDS.MEDIA_QUERY,
        extract: (match) => ({
            condition: match.getMatch('CONDITION')?.text() || '',
            type: 'supports',
        }),
    },

    // Container query
    containerQuery: {
        pattern: '@container $QUERY { $$$RULES }',
        kind: SYMBOL_KINDS.MEDIA_QUERY,
        extract: (match) => ({
            query: match.getMatch('QUERY')?.text() || '',
            type: 'container',
        }),
    },

    // Layer
    layer: {
        pattern: '@layer $NAME { $$$RULES }',
        kind: SYMBOL_KINDS.MEDIA_QUERY,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: 'layer',
        }),
    },
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
    // CSS import
    cssImport: {
        pattern: "@import '$URL';",
        extract: (match) => ({
            url: match.getMatch('URL')?.text() || '',
            type: 'import',
        }),
    },

    // CSS import url
    cssImportUrl: {
        pattern: "@import url('$URL');",
        extract: (match) => ({
            url: match.getMatch('URL')?.text() || '',
            type: 'import-url',
        }),
    },

    // SCSS import
    scssImport: {
        pattern: "@import '$PATH';",
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            type: 'scss-import',
        }),
    },

    // SCSS use
    scssUse: {
        pattern: "@use '$PATH';",
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            type: 'scss-use',
        }),
    },

    // SCSS use with namespace
    scssUseAs: {
        pattern: "@use '$PATH' as $ALIAS;",
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            alias: match.getMatch('ALIAS')?.text() || '',
            type: 'scss-use',
        }),
    },

    // SCSS forward
    scssForward: {
        pattern: "@forward '$PATH';",
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            type: 'scss-forward',
        }),
    },

    // Include mixin
    includeMixin: {
        pattern: '@include $NAME;',
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: 'include',
        }),
    },

    // Include mixin with args
    includeMixinArgs: {
        pattern: '@include $NAME($$$ARGS);',
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
            type: 'include',
        }),
    },

    // Extend
    extend: {
        pattern: '@extend $SELECTOR;',
        extract: (match) => ({
            selector: match.getMatch('SELECTOR')?.text() || '',
            type: 'extend',
        }),
    },

    // CSS var usage
    cssVarUsage: {
        pattern: 'var(--$NAME)',
        extract: (match) => ({
            name: '--' + (match.getMatch('NAME')?.text() || ''),
            type: 'css-var',
        }),
    },

    // URL reference
    urlReference: {
        pattern: "url('$PATH')",
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            type: 'url',
        }),
    },
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.css', '.scss', '.sass', '.less', '.styl'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'css';

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
            // Remove default values
            const colonIndex = p.indexOf(':');
            if (colonIndex > 0) {
                return p.substring(0, colonIndex).trim();
            }
            return p;
        });
}

/**
 * Check if a name is a CSS variable
 */
function isCssVariable(name) {
    return name.startsWith('--');
}

/**
 * Check if a name is a SCSS variable
 */
function isScssVariable(name) {
    return name.startsWith('$');
}

/**
 * Check if a name is a LESS variable
 */
function isLessVariable(name) {
    return name.startsWith('@') && !name.startsWith('@media') && !name.startsWith('@import');
}

/**
 * Get the kind of symbol based on conventions
 */
function inferKind(name, defaultKind) {
    if (isCssVariable(name) || isScssVariable(name) || isLessVariable(name)) {
        return SYMBOL_KINDS.VARIABLE;
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
    isCssVariable,
    isScssVariable,
    isLessVariable,
    inferKind,
};
