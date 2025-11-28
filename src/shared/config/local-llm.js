/**
 * Local LLM Configuration
 * Centralized configuration for the local LLM co-pilot feature
 */

/**
 * Parse CLAUDIOMIRO_LOCAL_LLM environment variable
 * - Not set or empty: disabled
 * - Set to model name (e.g., "qwen2.5-coder:7b"): enabled with that model
 * - Set to "true" or "false": disabled (no default model - user must specify)
 */
const parseLocalLLMEnv = () => {
    const value = process.env.CLAUDIOMIRO_LOCAL_LLM;

    // Disabled if not set, empty, or boolean-like values
    if (!value || value === '' || value === 'false' || value === '0' || value === 'true' || value === '1') {
        return { enabled: false, model: null };
    }

    // Value is the model name - enable with specified model
    return { enabled: true, model: value };
};

const localLLMEnv = parseLocalLLMEnv();

/**
 * Get configuration from environment variables with defaults
 */
const config = {
    /**
   * Enable/disable local LLM features entirely
   * DISABLED by default - set CLAUDIOMIRO_LOCAL_LLM=<model> to enable
   * Example: CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b
   */
    enabled: localLLMEnv.enabled,

    /**
   * Ollama server settings
   */
    ollama: {
        host: process.env.OLLAMA_HOST || 'localhost',
        port: parseInt(process.env.OLLAMA_PORT) || 11434,
        model: localLLMEnv.model, // No default - user must specify via CLAUDIOMIRO_LOCAL_LLM
        timeout: parseInt(process.env.OLLAMA_TIMEOUT) || 30000,
    },

    /**
   * Response caching settings
   */
    cache: {
        enabled: process.env.CLAUDIOMIRO_LLM_CACHE !== 'false',
        maxSize: parseInt(process.env.CLAUDIOMIRO_LLM_CACHE_SIZE) || 1000,
        ttlMs: parseInt(process.env.CLAUDIOMIRO_LLM_CACHE_TTL) || 30 * 60 * 1000,
        persistPath: process.env.CLAUDIOMIRO_LLM_CACHE_PATH || null,
    },

    /**
   * Feature flags for gradual rollout
   * Each feature can be enabled/disabled independently
   */
    features: {
        topicClassification: process.env.CLAUDIOMIRO_LLM_TOPICS !== 'false',
        sectionExtraction: process.env.CLAUDIOMIRO_LLM_SECTIONS !== 'false',
        contextSummarization: process.env.CLAUDIOMIRO_LLM_SUMMARIZE !== 'false',
        dependencyAnalysis: process.env.CLAUDIOMIRO_LLM_DEPS !== 'false',
        completionDetection: process.env.CLAUDIOMIRO_LLM_COMPLETION !== 'false',
        codeReviewPrescreen: process.env.CLAUDIOMIRO_LLM_REVIEW === 'true', // Disabled by default
        todoGeneration: process.env.CLAUDIOMIRO_LLM_TODO === 'true', // Disabled by default
    },

    /**
   * Fallback behavior when LLM fails or is unavailable
   */
    fallback: {
    /**
     * What to do on LLM error:
     * - 'use-heuristic': Use fallback heuristic implementation
     * - 'skip': Skip the operation (return null/empty)
     * - 'fail': Throw an error
     */
        onError: process.env.CLAUDIOMIRO_LLM_FALLBACK || 'use-heuristic',
        retryAttempts: parseInt(process.env.CLAUDIOMIRO_LLM_RETRIES) || 2,
        retryDelayMs: parseInt(process.env.CLAUDIOMIRO_LLM_RETRY_DELAY) || 1000,
    },

    /**
   * Logging settings
   */
    logging: {
        enabled: process.env.CLAUDIOMIRO_LLM_LOG !== 'false',
        level: process.env.CLAUDIOMIRO_LLM_LOG_LEVEL || 'info',
        logPrompts: process.env.CLAUDIOMIRO_LLM_LOG_PROMPTS === 'true',
    },
};

/**
 * Get the full configuration object
 * @returns {Object}
 */
function getConfig() {
    return { ...config };
}

/**
 * Check if a specific feature is enabled
 * @param {string} featureName - Name of the feature
 * @returns {boolean}
 */
function isFeatureEnabled(featureName) {
    if (!config.enabled) return false;
    return config.features[featureName] === true;
}

/**
 * Get Ollama client options from config
 * @returns {Object}
 */
function getOllamaOptions() {
    return { ...config.ollama };
}

/**
 * Get cache options from config
 * @returns {Object}
 */
function getCacheOptions() {
    return { ...config.cache };
}

/**
 * Check if local LLM is globally enabled
 * @returns {boolean}
 */
function isEnabled() {
    return config.enabled;
}

/**
 * Override configuration (mainly for testing)
 * @param {Object} overrides - Configuration overrides
 */
function setConfig(overrides) {
    Object.assign(config, overrides);

    if (overrides.ollama) {
        Object.assign(config.ollama, overrides.ollama);
    }
    if (overrides.cache) {
        Object.assign(config.cache, overrides.cache);
    }
    if (overrides.features) {
        Object.assign(config.features, overrides.features);
    }
    if (overrides.fallback) {
        Object.assign(config.fallback, overrides.fallback);
    }
    if (overrides.logging) {
        Object.assign(config.logging, overrides.logging);
    }
}

/**
 * Reset configuration to defaults (mainly for testing)
 */
function resetConfig() {
    config.enabled = process.env.CLAUDIOMIRO_LOCAL_LLM !== 'false';
    config.ollama = {
        host: process.env.OLLAMA_HOST || 'localhost',
        port: parseInt(process.env.OLLAMA_PORT) || 11434,
        model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b',
        timeout: parseInt(process.env.OLLAMA_TIMEOUT) || 30000,
    };
}

/**
 * Parse local LLM config for command-line usage
 * Returns a flat config object suitable for initializing OllamaClient
 * @returns {Object}
 */
function parseLocalLLMConfig() {
    const env = parseLocalLLMEnv();
    return {
        enabled: env.enabled,
        model: env.model,
        host: config.ollama.host,
        port: config.ollama.port,
        timeout: config.ollama.timeout,
    };
}

module.exports = {
    config,
    getConfig,
    isFeatureEnabled,
    getOllamaOptions,
    getCacheOptions,
    isEnabled,
    setConfig,
    resetConfig,
    parseLocalLLMConfig,
};
