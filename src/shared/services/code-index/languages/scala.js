/**
 * Scala AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common Scala code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
    CLASS: 'class',
    TRAIT: 'trait',
    OBJECT: 'object',
    CASE_CLASS: 'case_class',
    CASE_OBJECT: 'case_object',
    SEALED_TRAIT: 'sealed_trait',
    ABSTRACT_CLASS: 'abstract_class',
    METHOD: 'method',
    VAL: 'val',
    VAR: 'var',
    LAZY_VAL: 'lazy_val',
    TYPE: 'type',
    PACKAGE: 'package',
    PACKAGE_OBJECT: 'package_object',
    IMPLICIT: 'implicit',
    GIVEN: 'given',
    EXTENSION: 'extension',
};

/**
 * Patterns for extracting symbols from Scala code
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

    // Class with constructor
    classWithConstructor: {
        pattern: 'class $NAME($$$PARAMS) { $$$BODY }',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
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

    // Abstract class
    abstractClass: {
        pattern: 'abstract class $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.ABSTRACT_CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Case class
    caseClass: {
        pattern: 'case class $NAME($$$PARAMS)',
        kind: SYMBOL_KINDS.CASE_CLASS,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
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

    // Sealed trait
    sealedTrait: {
        pattern: 'sealed trait $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.SEALED_TRAIT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Object declaration
    objectDeclaration: {
        pattern: 'object $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.OBJECT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Case object
    caseObject: {
        pattern: 'case object $NAME',
        kind: SYMBOL_KINDS.CASE_OBJECT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Package object
    packageObject: {
        pattern: 'package object $NAME { $$$BODY }',
        kind: SYMBOL_KINDS.PACKAGE_OBJECT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Def method
    defDeclaration: {
        pattern: 'def $NAME($$$PARAMS) = $BODY',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
        }),
    },

    // Def with return type
    defWithReturn: {
        pattern: 'def $NAME($$$PARAMS): $RETURN = $BODY',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            returnType: match.getMatch('RETURN')?.text() || '',
        }),
    },

    // Def with block body
    defWithBlock: {
        pattern: 'def $NAME($$$PARAMS): $RETURN = { $$$BODY }',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            returnType: match.getMatch('RETURN')?.text() || '',
        }),
    },

    // Override def
    overrideDef: {
        pattern: 'override def $NAME($$$PARAMS) $$$REST = $BODY',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            override: true,
        }),
    },

    // Private def
    privateDef: {
        pattern: 'private def $NAME($$$PARAMS) $$$REST = $BODY',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            private: true,
        }),
    },

    // Protected def
    protectedDef: {
        pattern: 'protected def $NAME($$$PARAMS) $$$REST = $BODY',
        kind: SYMBOL_KINDS.METHOD,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            protected: true,
        }),
    },

    // Implicit def
    implicitDef: {
        pattern: 'implicit def $NAME($$$PARAMS): $RETURN = $BODY',
        kind: SYMBOL_KINDS.IMPLICIT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            params: extractParams(match.getMatch('PARAMS')),
            returnType: match.getMatch('RETURN')?.text() || '',
            implicit: true,
        }),
    },

    // Val declaration
    valDeclaration: {
        pattern: 'val $NAME: $TYPE = $VALUE',
        kind: SYMBOL_KINDS.VAL,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Val without type
    valSimple: {
        pattern: 'val $NAME = $VALUE',
        kind: SYMBOL_KINDS.VAL,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Var declaration
    varDeclaration: {
        pattern: 'var $NAME: $TYPE = $VALUE',
        kind: SYMBOL_KINDS.VAR,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Lazy val
    lazyVal: {
        pattern: 'lazy val $NAME = $VALUE',
        kind: SYMBOL_KINDS.LAZY_VAL,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            lazy: true,
        }),
    },

    // Implicit val
    implicitVal: {
        pattern: 'implicit val $NAME: $TYPE = $VALUE',
        kind: SYMBOL_KINDS.IMPLICIT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
            implicit: true,
        }),
    },

    // Type alias
    typeAlias: {
        pattern: 'type $NAME = $TYPE',
        kind: SYMBOL_KINDS.TYPE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Type with bounds
    typeWithBounds: {
        pattern: 'type $NAME <: $UPPER',
        kind: SYMBOL_KINDS.TYPE,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            upperBound: match.getMatch('UPPER')?.text() || '',
        }),
    },

    // Given (Scala 3)
    givenDeclaration: {
        pattern: 'given $NAME: $TYPE = $VALUE',
        kind: SYMBOL_KINDS.GIVEN,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
        }),
    },

    // Extension (Scala 3)
    extensionDeclaration: {
        pattern: 'extension ($PARAM: $TYPE) { $$$BODY }',
        kind: SYMBOL_KINDS.EXTENSION,
        extract: (match) => ({
            param: match.getMatch('PARAM')?.text() || '',
            type: match.getMatch('TYPE')?.text() || '',
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
    // Import statement
    importStatement: {
        pattern: 'import $PATH',
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            type: 'import',
        }),
    },

    // Import with rename
    importRename: {
        pattern: 'import $PATH => $ALIAS',
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            alias: match.getMatch('ALIAS')?.text() || '',
            type: 'import-rename',
        }),
    },

    // Import wildcard
    importWildcard: {
        pattern: 'import $PATH._',
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            type: 'import-wildcard',
        }),
    },

    // Import given (Scala 3)
    importGiven: {
        pattern: 'import $PATH.given',
        extract: (match) => ({
            path: match.getMatch('PATH')?.text() || '',
            type: 'import-given',
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

    // Apply call
    applyCall: {
        pattern: '$OBJ($$$ARGS)',
        extract: (match) => ({
            object: match.getMatch('OBJ')?.text() || '',
            args: match.getMatch('ARGS')?.text() || '',
            type: 'apply',
        }),
    },

    // Infix call
    infixCall: {
        pattern: '$LEFT $OP $RIGHT',
        extract: (match) => ({
            left: match.getMatch('LEFT')?.text() || '',
            operator: match.getMatch('OP')?.text() || '',
            right: match.getMatch('RIGHT')?.text() || '',
            type: 'infix',
        }),
    },

    // For comprehension
    forComprehension: {
        pattern: 'for { $$$GENERATORS } yield $BODY',
        extract: (match) => ({
            generators: match.getMatch('GENERATORS')?.text() || '',
            type: 'for-comprehension',
        }),
    },

    // Pattern match
    patternMatch: {
        pattern: '$EXPR match { $$$CASES }',
        extract: (match) => ({
            expression: match.getMatch('EXPR')?.text() || '',
            type: 'match',
        }),
    },
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.scala', '.sc'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'scala';

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
            // Scala params: [val/var] name: Type [= default]
            const colonIndex = p.indexOf(':');
            if (colonIndex > 0) {
                let namePart = p.substring(0, colonIndex).trim();
                // Remove val/var
                namePart = namePart.replace(/^(val|var)\s+/, '');
                return namePart;
            }
            return p;
        });
}

/**
 * Check if a name follows Scala constant convention
 */
function isConstantName(name) {
    // Scala constants are often PascalCase or UPPER_CASE
    return /^[A-Z]/.test(name);
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
    isConstantName,
    inferKind,
};
