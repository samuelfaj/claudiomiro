const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const { extractInsights, deduplicateInsights } = require('./insight-extractor');
const { extractFromSentences } = require('./fallbacks/pattern-matcher');

const DEFAULT_PROMPT_PATH = path.join(__dirname, 'prompts', 'reflect-on-trajectory.md');

class Reflector {
    constructor(options = {}) {
        if (typeof options.executor !== 'function') {
            throw new Error('Reflection executor function is required');
        }

        this.executor = options.executor;
        this.promptTemplate = options.promptTemplate
            || Reflector._loadTemplate(options.promptTemplatePath || DEFAULT_PROMPT_PATH);
        this.extractFn = options.extractInsights || extractInsights;
        this.fallbackExtractFn = options.fallbackExtractor || extractFromSentences;
        this.logger = options.logger || logger;
        this.minConfidence = options.minConfidence || 0.65;
        this.minimumInsightCount = options.minimumInsightCount || 2;
    }

    static _loadTemplate(templatePath) {
        try {
            return fs.readFileSync(templatePath, 'utf8');
        } catch (error) {
            throw new Error(`Unable to load reflection template at ${templatePath}: ${error.message}`);
        }
    }

    _buildPrompt({ task, trajectory, iteration, insights, extra }) {
        const previousInsights = (insights && insights.length > 0)
            ? insights.map((item, index) => {
                const confidence = item.confidence !== undefined
                    ? item.confidence.toFixed(2)
                    : '0.60';
                return `${index + 1}. ${item.insight || item.description} (confidence: ${confidence})`;
            }).join('\n')
            : 'None recorded yet.';

        const replacements = {
            task: task || 'Unknown task',
            iteration: `${iteration}`,
            trajectory: (trajectory || '').slice(0, 6000),
            previousInsights,
            ...extra,
        };

        let prompt = this.promptTemplate;
        for (const [key, value] of Object.entries(replacements)) {
            const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            prompt = prompt.replace(pattern, value || '');
        }

        return prompt;
    }

    _mergeInsights(existing, incoming) {
        return deduplicateInsights([
            ...existing,
            ...(incoming || []),
        ]);
    }

    _checkConvergence(history, merged, incoming) {
        if (history.length === 0) {
            return false;
        }

        if (!incoming || incoming.length === 0) {
            return true;
        }

        const latestDescriptions = new Set(
            (incoming || []).map((item) => (item.insight || item.description || '').toLowerCase()),
        );
        const previousDescriptions = new Set(
            history
                .flatMap((iteration) => iteration.insights || [])
                .map((item) => (item.insight || item.description || '').toLowerCase()),
        );

        let hasNovel = false;
        for (const description of latestDescriptions) {
            if (description && !previousDescriptions.has(description)) {
                hasNovel = true;
                break;
            }
        }

        if (!hasNovel) {
            const mergedDescriptions = new Set(
                merged.map((item) => (item.insight || item.description || '').toLowerCase()),
            );
            return mergedDescriptions.size === previousDescriptions.size;
        }

        return false;
    }

    _qualityThresholdMet(insights) {
        if (!insights || insights.length < this.minimumInsightCount) {
            return false;
        }

        const averageConfidence = insights.reduce((acc, item) => acc + (item.confidence || 0), 0) / insights.length;
        const actionableRatio = insights.filter((item) => item.actionable).length / insights.length;

        return averageConfidence >= this.minConfidence && actionableRatio >= 0.5;
    }

    async reflect(task, options = {}) {
        const {
            trajectory,
            maxIterations = 3,
            existingInsights = [],
            extra = {},
        } = options;

        if (!trajectory) {
            throw new Error('Reflection requires a trajectory summary');
        }

        let aggregated = deduplicateInsights(existingInsights);
        const history = [];
        let iteration = 0;
        let converged = false;

        while (iteration < maxIterations && !converged) {
            iteration += 1;

            const prompt = this._buildPrompt({
                task,
                trajectory,
                iteration,
                insights: aggregated,
                extra,
            });

            let content = '';
            try {
                const result = await this.executor({
                    task,
                    iteration,
                    prompt,
                    trajectory,
                    previousInsights: aggregated,
                });

                if (result && typeof result === 'object') {
                    content = result.content || '';
                } else {
                    content = result || '';
                }
            } catch (error) {
                this.logger.warning(`[reflection] iteration ${iteration} failed: ${error.message}`);
                content = '';
            }

            let newInsights = [];
            if (content) {
                newInsights = this.extractFn(content);
                if (newInsights.length === 0 && this.fallbackExtractFn) {
                    newInsights = this.fallbackExtractFn(content);
                }
            }

            aggregated = this._mergeInsights(aggregated, newInsights);
            converged = this._checkConvergence(history, aggregated, newInsights);

            history.push({
                iteration,
                insights: newInsights,
                raw: content,
                timestamp: new Date().toISOString(),
            });

            if (this._qualityThresholdMet(aggregated)) {
                converged = true;
            }
        }

        return {
            insights: aggregated,
            iterations: iteration,
            converged,
            history,
        };
    }
}

module.exports = { Reflector };
