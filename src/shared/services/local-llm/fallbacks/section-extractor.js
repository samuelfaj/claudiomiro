/**
 * Fallback Section Extractor
 * Regex-based markdown section extraction when LLM is not available
 */

/**
 * Extract a section from markdown by header name
 * @param {string} markdown - Full markdown content
 * @param {string} sectionName - Name of section to extract
 * @returns {string}
 */
function extractSection(markdown, sectionName) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  if (!sectionName || typeof sectionName !== 'string') {
    return '';
  }

  // Normalize section name for matching
  const normalizedName = sectionName.toLowerCase().trim();
  const escapedName = escapeRegex(sectionName);

  // Build regex patterns for different header formats
  const patterns = [
    // ## Exact Header Name (with newline or start of string before)
    new RegExp(
      `(?:^|\\n)##\\s+${escapedName}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
      'i'
    ),
    // ## Header Name (with optional prefix like "Code " or "Execution ")
    new RegExp(
      `(?:^|\\n)##\\s+(?:\\w+\\s+)?${escapedName}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
      'i'
    ),
    // ### Subsection (h3)
    new RegExp(
      `(?:^|\\n)###\\s+${escapedName}\\s*\\n([\\s\\S]*?)(?=\\n###\\s|\\n##\\s|$)`,
      'i'
    ),
    // **Bold Header** style (with colon optional)
    new RegExp(
      `\\*\\*${escapedName}:?\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*|\\n##|$)`,
      'i'
    ),
    // **Bold Header:** style (colon after bold)
    new RegExp(
      `\\*\\*${escapedName}\\*\\*:\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*|\\n##|$)`,
      'i'
    )
  ];

  // Try each pattern
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Try fuzzy matching with common variations
  const variations = generateVariations(normalizedName);

  for (const variation of variations) {
    const fuzzyPattern = new RegExp(
      `(?:^|\\n)##\\s+${escapeRegex(variation)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
      'i'
    );
    const match = markdown.match(fuzzyPattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}

/**
 * Extract all sections from markdown
 * @param {string} markdown - Full markdown content
 * @returns {Object<string, string>}
 */
function extractAllSections(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return {};
  }

  const sections = {};

  // Split by h2 headers
  const lines = markdown.split('\n');
  let currentHeader = null;
  let currentContent = [];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)$/);
    if (headerMatch) {
      // Save previous section if exists
      if (currentHeader !== null) {
        sections[currentHeader] = currentContent.join('\n').trim();
      }
      // Start new section
      currentHeader = headerMatch[1].trim();
      currentContent = [];
    } else if (currentHeader !== null) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentHeader !== null) {
    sections[currentHeader] = currentContent.join('\n').trim();
  }

  return sections;
}

/**
 * Check if a section exists in markdown
 * @param {string} markdown - Full markdown content
 * @param {string} sectionName - Name of section to check
 * @returns {boolean}
 */
function hasSection(markdown, sectionName) {
  const content = extractSection(markdown, sectionName);
  return content.length > 0;
}

/**
 * Extract code blocks from a section
 * @param {string} sectionContent - Section content
 * @returns {Array<{language: string, code: string}>}
 */
function extractCodeBlocks(sectionContent) {
  if (!sectionContent) {
    return [];
  }

  const codeBlocks = [];
  const pattern = /```(\w*)\n([\s\S]*?)```/g;
  let match;

  while ((match = pattern.exec(sectionContent)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2].trim()
    });
  }

  return codeBlocks;
}

/**
 * Extract list items from a section
 * @param {string} sectionContent - Section content
 * @returns {string[]}
 */
function extractListItems(sectionContent) {
  if (!sectionContent) {
    return [];
  }

  const items = [];

  // Match bullet points (- or *)
  const bulletPattern = /^[\s]*[-*]\s+(.+)$/gm;
  let match;

  while ((match = bulletPattern.exec(sectionContent)) !== null) {
    items.push(match[1].trim());
  }

  // Match numbered items
  const numberedPattern = /^[\s]*\d+\.\s+(.+)$/gm;

  while ((match = numberedPattern.exec(sectionContent)) !== null) {
    items.push(match[1].trim());
  }

  return items;
}

/**
 * Generate common variations of a section name
 * @param {string} name - Section name
 * @returns {string[]}
 */
function generateVariations(name) {
  const variations = [name];

  // Add singular/plural variations
  if (name.endsWith('s')) {
    variations.push(name.slice(0, -1));
  } else {
    variations.push(name + 's');
  }

  // Add common prefixes
  const prefixes = ['', 'code ', 'execution ', 'implementation '];
  for (const prefix of prefixes) {
    variations.push(prefix + name);
  }

  // Add common suffixes
  const suffixes = ['', ' plan', ' details', ' summary'];
  for (const suffix of suffixes) {
    variations.push(name + suffix);
  }

  return [...new Set(variations)];
}

/**
 * Escape special regex characters
 * @param {string} string - String to escape
 * @returns {string}
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  extractSection,
  extractAllSections,
  hasSection,
  extractCodeBlocks,
  extractListItems
};
