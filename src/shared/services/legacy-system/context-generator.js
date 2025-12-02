const state = require('../../config/state');

/**
 * Generates markdown context for legacy systems to inject into AI prompts
 * @returns {string} Markdown string with legacy system info, or empty string if none configured
 */
const generateLegacySystemContext = () => {
    if (!state.hasLegacySystems()) {
        return '';
    }

    const sections = [];

    sections.push('## Legacy Systems Reference');
    sections.push('');
    sections.push('⚠️ **READ-ONLY:** These legacy systems are for reference only. Do NOT modify legacy code.');
    sections.push('');
    sections.push('The following legacy systems are available for reference during this task:');
    sections.push('');

    // Add section for each configured legacy type
    const systemPath = state.getLegacySystem('system');
    if (systemPath) {
        sections.push('### Legacy System');
        sections.push(`Path: \`${systemPath}\``);
        sections.push('');
    }

    const backendPath = state.getLegacySystem('backend');
    if (backendPath) {
        sections.push('### Legacy Backend');
        sections.push(`Path: \`${backendPath}\``);
        sections.push('');
    }

    const frontendPath = state.getLegacySystem('frontend');
    if (frontendPath) {
        sections.push('### Legacy Frontend');
        sections.push(`Path: \`${frontendPath}\``);
        sections.push('');
    }

    sections.push('### How to Use Legacy Systems');
    sections.push('');
    sections.push('1. Use legacy code as reference for business logic and patterns');
    sections.push('2. Do NOT copy legacy code directly - adapt and modernize');
    sections.push('3. Do NOT modify any files in legacy system paths');
    sections.push('4. Document any business rules discovered in legacy code');

    return sections.join('\n');
};

module.exports = { generateLegacySystemContext };
