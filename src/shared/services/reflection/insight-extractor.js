const tokenizeMetadata = (raw) => {
    if (!raw) {
        return {};
    }

    const metadata = {};
    const metaPattern = /\[(.+?)\]|\((.+?)\)/g;
    let match;

    while ((match = metaPattern.exec(raw))) {
        const token = (match[1] || match[2] || '').trim();
        const [keyPart, valuePart] = token.split(':').map((part) => part && part.trim());

        if (valuePart !== undefined && keyPart) {
            const key = keyPart.toLowerCase();
            const value = valuePart;
            metadata[key] = value;
        } else if (token) {
            metadata[token.toLowerCase()] = true;
        }
    }

    return metadata;
};

const parseConfidence = (metadata, text) => {
    if (metadata.confidence) {
        const parsed = parseFloat(metadata.confidence);
        if (!Number.isNaN(parsed)) {
            return Math.min(Math.max(parsed, 0), 1);
        }
    }

    const inline = text.match(/confidence\s*[:=]\s*(\d+(\.\d+)?)/i);
    if (inline) {
        const parsed = parseFloat(inline[1]);
        if (!Number.isNaN(parsed)) {
            return Math.min(Math.max(parsed, 0), 1);
        }
    }

    if (text.toLowerCase().includes('high confidence')) {
        return 0.85;
    }
    if (text.toLowerCase().includes('low confidence')) {
        return 0.3;
    }

    return 0.6;
};

const parseActionable = (metadata, text) => {
    if (metadata.actionable) {
        return ['yes', 'true', 'y'].includes(metadata.actionable.toLowerCase());
    }

    if (metadata.todo || metadata['next steps']) {
        return true;
    }

    const lowered = text.toLowerCase();
    return lowered.includes('should ') || lowered.includes('need to') || lowered.includes('must ');
};

const parseEvidence = (metadata, text) => {
    if (metadata.evidence) {
        return metadata.evidence;
    }
    if (metadata.example) {
        return metadata.example;
    }
    const match = text.match(/evidence\s*[:=]\s*(.+?)(?:$|\)|\]|\. )/i);
    if (match) {
        return match[1].trim();
    }
    return null;
};

const categoryKeywordMap = [
    { category: 'patterns', keywords: ['pattern', 'prefer', 'should', 'best practice', 'recommended'] },
    { category: 'antiPatterns', keywords: ['avoid', 'anti-pattern', 'bug', 'issue', 'pitfall'] },
    { category: 'testing', keywords: ['test', 'assert', 'coverage', 'mock', 'verification', 'qa'] },
    { category: 'performance', keywords: ['performance', 'optimize', 'latency', 'cache'] },
    { category: 'security', keywords: ['security', 'auth', 'token', 'csrf', 'xss', 'encryption'] },
    { category: 'projectSpecific', keywords: ['this project', 'this codebase', 'our implementation', 'in this repo'] },
];

const categorizeInsight = (insight) => {
    const text = (typeof insight === 'string' ? insight : insight.description || insight.insight || '').toLowerCase();

    for (const { category, keywords } of categoryKeywordMap) {
        if (keywords.some((keyword) => text.includes(keyword))) {
            return category;
        }
    }

    return 'projectSpecific';
};

const parseInsightLines = (content) => {
    const lines = content.split(/\r?\n/);
    const insights = [];
    let current = null;

    const flushCurrent = () => {
        if (!current) {
            return;
        }

        const rawText = current.lines.join(' ').trim();
        if (!rawText) {
            current = null;
            return;
        }

        const metadata = tokenizeMetadata(rawText);
        const cleaned = rawText
            .replace(/\[(.+?)\]/g, '')
            .replace(/\((.+?)\)/g, '')
            .trim();

        const description = cleaned;
        const confidence = parseConfidence(metadata, rawText);
        const actionable = parseActionable(metadata, rawText);
        const evidence = parseEvidence(metadata, rawText);
        const category = metadata.category
            ? metadata.category.trim()
            : categorizeInsight(description);

        const insight = {
            description,
            insight: description,
            confidence,
            actionable,
            evidence,
            category,
            type: metadata.type || metadata['insight type'] || null,
        };

        if (metadata.source) {
            insight.source = metadata.source;
        }
        if (metadata.tag) {
            insight.tags = metadata.tag.split(',').map((tag) => tag.trim()).filter(Boolean);
        }

        insights.push(insight);
        current = null;
    };

    for (const line of lines) {
        const trimmed = line.trim();
        const bulletMatch = trimmed.match(/^[-*+]\s+(.*)/);
        const numberedMatch = trimmed.match(/^\d+[\).\]]\s+(.*)/);

        if (bulletMatch || numberedMatch) {
            flushCurrent();
            current = {
                lines: [bulletMatch ? bulletMatch[1] : numberedMatch[1]],
            };
            continue;
        }

        if (current && trimmed.startsWith('>')) {
            current.lines.push(trimmed.slice(1).trim());
            continue;
        }

        if (current && trimmed.startsWith('Evidence:')) {
            current.lines.push(trimmed);
            continue;
        }

        if (current && trimmed) {
            current.lines.push(trimmed);
        } else if (!trimmed) {
            flushCurrent();
        }
    }

    flushCurrent();
    return insights;
};

const deduplicateInsights = (insights = []) => {
    const map = new Map();

    for (const entry of insights) {
        if (!entry) {
            continue;
        }
        const key = (entry.insight || entry.description || '')
            .trim()
            .toLowerCase();

        if (!key) {
            continue;
        }

        if (!map.has(key)) {
            map.set(key, { ...entry });
        } else {
            const existing = map.get(key);
            const merged = { ...existing };

            if ((entry.confidence || 0) > (existing.confidence || 0)) {
                merged.confidence = entry.confidence;
            }

            if (entry.actionable && !existing.actionable) {
                merged.actionable = true;
            }

            merged.category = existing.category || entry.category;
            merged.evidence = existing.evidence || entry.evidence || null;
            merged.tags = Array.from(new Set([
                ...(existing.tags || []),
                ...(entry.tags || []),
            ])).filter(Boolean);

            merged.type = existing.type || entry.type || null;
            merged.source = existing.source || entry.source || null;

            map.set(key, merged);
        }
    }

    return Array.from(map.values());
};

const extractInsights = (content) => {
    if (!content) {
        return [];
    }

    const fromBullets = parseInsightLines(content);
    return deduplicateInsights(fromBullets);
};

module.exports = {
    extractInsights,
    categorizeInsight,
    deduplicateInsights,
};
