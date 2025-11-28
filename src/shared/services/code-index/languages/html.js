/**
 * HTML AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common HTML code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
    ELEMENT: 'element',
    ID: 'id',
    CLASS: 'class',
    COMPONENT: 'component',
    SLOT: 'slot',
    TEMPLATE: 'template',
    CUSTOM_ELEMENT: 'custom_element',
    FORM: 'form',
    SCRIPT: 'script',
    STYLE: 'style',
    LINK: 'link',
    META: 'meta',
};

/**
 * Patterns for extracting symbols from HTML code
 */
const PATTERNS = {
    // Element with ID
    elementWithId: {
        pattern: '<$TAG id="$ID" $$$ATTRS>$$$CONTENT</$TAG>',
        kind: SYMBOL_KINDS.ID,
        extract: (match) => ({
            name: match.getMatch('ID')?.text() || '',
            tag: match.getMatch('TAG')?.text() || '',
        }),
    },

    // Self-closing element with ID
    selfClosingWithId: {
        pattern: '<$TAG id="$ID" $$$ATTRS />',
        kind: SYMBOL_KINDS.ID,
        extract: (match) => ({
            name: match.getMatch('ID')?.text() || '',
            tag: match.getMatch('TAG')?.text() || '',
            selfClosing: true,
        }),
    },

    // Element with class
    elementWithClass: {
        pattern: '<$TAG class="$CLASS" $$$ATTRS>$$$CONTENT</$TAG>',
        kind: SYMBOL_KINDS.CLASS,
        extract: (match) => ({
            name: match.getMatch('CLASS')?.text() || '',
            tag: match.getMatch('TAG')?.text() || '',
        }),
    },

    // Form element
    formElement: {
        pattern: '<form $$$ATTRS>$$$CONTENT</form>',
        kind: SYMBOL_KINDS.FORM,
        extract: (match) => ({
            name: 'form',
            attributes: match.getMatch('ATTRS')?.text() || '',
        }),
    },

    // Form with name
    formWithName: {
        pattern: '<form name="$NAME" $$$ATTRS>$$$CONTENT</form>',
        kind: SYMBOL_KINDS.FORM,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Input element with name
    inputWithName: {
        pattern: '<input name="$NAME" $$$ATTRS />',
        kind: SYMBOL_KINDS.ELEMENT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            element: 'input',
        }),
    },

    // Script element
    scriptElement: {
        pattern: '<script $$$ATTRS>$$$CONTENT</script>',
        kind: SYMBOL_KINDS.SCRIPT,
        extract: (match) => ({
            name: 'script',
            attributes: match.getMatch('ATTRS')?.text() || '',
        }),
    },

    // Script with src
    scriptWithSrc: {
        pattern: '<script src="$SRC" $$$ATTRS></script>',
        kind: SYMBOL_KINDS.SCRIPT,
        extract: (match) => ({
            name: 'script',
            src: match.getMatch('SRC')?.text() || '',
            external: true,
        }),
    },

    // Style element
    styleElement: {
        pattern: '<style $$$ATTRS>$$$CONTENT</style>',
        kind: SYMBOL_KINDS.STYLE,
        extract: (match) => ({
            name: 'style',
            attributes: match.getMatch('ATTRS')?.text() || '',
        }),
    },

    // Link element
    linkElement: {
        pattern: '<link $$$ATTRS />',
        kind: SYMBOL_KINDS.LINK,
        extract: (match) => ({
            name: 'link',
            attributes: match.getMatch('ATTRS')?.text() || '',
        }),
    },

    // Link stylesheet
    linkStylesheet: {
        pattern: '<link rel="stylesheet" href="$HREF" $$$ATTRS />',
        kind: SYMBOL_KINDS.LINK,
        extract: (match) => ({
            name: 'stylesheet',
            href: match.getMatch('HREF')?.text() || '',
        }),
    },

    // Meta element
    metaElement: {
        pattern: '<meta $$$ATTRS />',
        kind: SYMBOL_KINDS.META,
        extract: (match) => ({
            name: 'meta',
            attributes: match.getMatch('ATTRS')?.text() || '',
        }),
    },

    // Meta with name
    metaWithName: {
        pattern: '<meta name="$NAME" content="$CONTENT" $$$ATTRS />',
        kind: SYMBOL_KINDS.META,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
            content: match.getMatch('CONTENT')?.text() || '',
        }),
    },

    // Template element
    templateElement: {
        pattern: '<template $$$ATTRS>$$$CONTENT</template>',
        kind: SYMBOL_KINDS.TEMPLATE,
        extract: (match) => ({
            name: 'template',
            attributes: match.getMatch('ATTRS')?.text() || '',
        }),
    },

    // Template with id
    templateWithId: {
        pattern: '<template id="$ID" $$$ATTRS>$$$CONTENT</template>',
        kind: SYMBOL_KINDS.TEMPLATE,
        extract: (match) => ({
            name: match.getMatch('ID')?.text() || '',
        }),
    },

    // Slot element
    slotElement: {
        pattern: '<slot $$$ATTRS>$$$CONTENT</slot>',
        kind: SYMBOL_KINDS.SLOT,
        extract: (_match) => ({
            name: 'default',
        }),
    },

    // Named slot
    namedSlot: {
        pattern: '<slot name="$NAME" $$$ATTRS>$$$CONTENT</slot>',
        kind: SYMBOL_KINDS.SLOT,
        extract: (match) => ({
            name: match.getMatch('NAME')?.text() || '',
        }),
    },

    // Custom element (web component)
    customElement: {
        pattern: '<$NAME $$$ATTRS>$$$CONTENT</$NAME>',
        kind: SYMBOL_KINDS.CUSTOM_ELEMENT,
        extract: (match) => {
            const name = match.getMatch('NAME')?.text() || '';
            return {
                name,
                isCustom: name.includes('-'),
            };
        },
    },

    // Vue component
    vueComponent: {
        pattern: '<$COMPONENT $$$ATTRS>$$$CONTENT</$COMPONENT>',
        kind: SYMBOL_KINDS.COMPONENT,
        extract: (match) => {
            const name = match.getMatch('COMPONENT')?.text() || '';
            return {
                name,
                isComponent: /^[A-Z]/.test(name),
            };
        },
    },

    // Angular component
    angularComponent: {
        pattern: '<app-$NAME $$$ATTRS>$$$CONTENT</app-$NAME>',
        kind: SYMBOL_KINDS.COMPONENT,
        extract: (match) => ({
            name: 'app-' + (match.getMatch('NAME')?.text() || ''),
            angular: true,
        }),
    },

    // Data attribute
    dataAttribute: {
        pattern: '<$TAG data-$NAME="$VALUE" $$$ATTRS>$$$CONTENT</$TAG>',
        kind: SYMBOL_KINDS.ELEMENT,
        extract: (match) => ({
            tag: match.getMatch('TAG')?.text() || '',
            dataName: match.getMatch('NAME')?.text() || '',
            dataValue: match.getMatch('VALUE')?.text() || '',
        }),
    },
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
    // Script import
    scriptImport: {
        pattern: '<script src="$SRC"></script>',
        extract: (match) => ({
            src: match.getMatch('SRC')?.text() || '',
            type: 'script',
        }),
    },

    // Module script
    moduleScript: {
        pattern: '<script type="module" src="$SRC"></script>',
        extract: (match) => ({
            src: match.getMatch('SRC')?.text() || '',
            type: 'module',
        }),
    },

    // Stylesheet link
    stylesheetLink: {
        pattern: '<link rel="stylesheet" href="$HREF">',
        extract: (match) => ({
            href: match.getMatch('HREF')?.text() || '',
            type: 'stylesheet',
        }),
    },

    // Image source
    imageSrc: {
        pattern: '<img src="$SRC" $$$ATTRS>',
        extract: (match) => ({
            src: match.getMatch('SRC')?.text() || '',
            type: 'image',
        }),
    },

    // Anchor href
    anchorHref: {
        pattern: '<a href="$HREF" $$$ATTRS>$$$CONTENT</a>',
        extract: (match) => ({
            href: match.getMatch('HREF')?.text() || '',
            type: 'link',
        }),
    },

    // Iframe src
    iframeSrc: {
        pattern: '<iframe src="$SRC" $$$ATTRS></iframe>',
        extract: (match) => ({
            src: match.getMatch('SRC')?.text() || '',
            type: 'iframe',
        }),
    },

    // Video source
    videoSrc: {
        pattern: '<source src="$SRC" $$$ATTRS>',
        extract: (match) => ({
            src: match.getMatch('SRC')?.text() || '',
            type: 'media-source',
        }),
    },

    // Form action
    formAction: {
        pattern: '<form action="$ACTION" $$$ATTRS>$$$CONTENT</form>',
        extract: (match) => ({
            action: match.getMatch('ACTION')?.text() || '',
            type: 'form-action',
        }),
    },

    // Import map
    importMap: {
        pattern: '<script type="importmap">$$$CONTENT</script>',
        extract: (match) => ({
            content: match.getMatch('CONTENT')?.text() || '',
            type: 'importmap',
        }),
    },

    // Preload
    preload: {
        pattern: '<link rel="preload" href="$HREF" $$$ATTRS>',
        extract: (match) => ({
            href: match.getMatch('HREF')?.text() || '',
            type: 'preload',
        }),
    },

    // Prefetch
    prefetch: {
        pattern: '<link rel="prefetch" href="$HREF" $$$ATTRS>',
        extract: (match) => ({
            href: match.getMatch('HREF')?.text() || '',
            type: 'prefetch',
        }),
    },
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.html', '.htm', '.xhtml', '.vue', '.svelte'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'html';

/**
 * Helper function to extract attributes
 */
function extractParams(paramsNode) {
    if (!paramsNode) return [];
    const text = paramsNode.text();
    if (!text) return [];

    // Parse attributes (simplified)
    const attrs = [];
    const regex = /(\w+)(?:="([^"]*)")?/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        attrs.push(match[1]);
    }
    return attrs;
}

/**
 * Check if an element name is a custom element (contains hyphen)
 */
function isCustomElement(name) {
    return name.includes('-');
}

/**
 * Check if a name is a Vue/React component (starts with uppercase)
 */
function isComponent(name) {
    return /^[A-Z]/.test(name);
}

/**
 * Get the kind of symbol based on element type
 */
function inferKind(name, defaultKind) {
    if (isCustomElement(name)) {
        return SYMBOL_KINDS.CUSTOM_ELEMENT;
    }
    if (isComponent(name)) {
        return SYMBOL_KINDS.COMPONENT;
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
    isCustomElement,
    isComponent,
    inferKind,
};
