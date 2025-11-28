/**
 * Fallback Topic Classifier
 * Keyword-based topic classification when LLM is not available
 */

const TOPIC_KEYWORDS = {
  authentication: [
    'authentication', 'auth', 'login', 'logout', 'session', 'jwt', 'token',
    'password', 'credential', 'oauth', 'sso', 'signin', 'signup', 'register',
    'user identity', 'access token', 'refresh token'
  ],
  api: [
    'api', 'endpoint', 'route', 'rest', 'graphql', 'request', 'response',
    'http', 'fetch', 'axios', 'webhook', 'cors', 'rate limit', 'swagger',
    'openapi', 'crud', 'get', 'post', 'put', 'delete', 'patch'
  ],
  database: [
    'database', 'db', 'sql', 'query', 'model', 'schema', 'migration', 'orm',
    'mongodb', 'postgres', 'mysql', 'redis', 'sqlite', 'nosql', 'table',
    'collection', 'index', 'transaction', 'join', 'foreign key', 'primary key'
  ],
  testing: [
    'test', 'testing', 'spec', 'unit test', 'integration', 'mock', 'jest',
    'mocha', 'chai', 'assert', 'expect', 'describe', 'it', 'beforeeach',
    'aftereach', 'coverage', 'e2e', 'cypress', 'playwright', 'fixture'
  ],
  config: [
    'config', 'configuration', 'env', 'environment', 'settings', 'options',
    'dotenv', '.env', 'yaml', 'json config', 'ini', 'toml', 'setup',
    'initialize', 'bootstrap', 'constants'
  ],
  middleware: [
    'middleware', 'interceptor', 'filter', 'guard', 'pipe', 'express middleware',
    'before', 'after', 'pre', 'post', 'hook', 'handler chain'
  ],
  service: [
    'service', 'provider', 'repository', 'dao', 'business logic', 'domain',
    'use case', 'interactor', 'facade', 'adapter', 'gateway'
  ],
  controller: [
    'controller', 'handler', 'action', 'resolver', 'route handler', 'request handler',
    'resource', 'endpoint handler'
  ],
  component: [
    'component', 'widget', 'element', 'ui', 'view', 'template', 'render',
    'react', 'vue', 'angular', 'svelte', 'jsx', 'tsx', 'html', 'dom'
  ],
  validation: [
    'validation', 'validate', 'validator', 'schema', 'joi', 'yup', 'zod',
    'sanitize', 'check', 'constraint', 'required', 'optional', 'pattern'
  ],
  error: [
    'error', 'exception', 'throw', 'catch', 'try', 'handling', 'recovery',
    'fallback', 'retry', 'circuit breaker', 'fault', 'failure'
  ],
  logging: [
    'log', 'logging', 'logger', 'winston', 'pino', 'bunyan', 'debug',
    'trace', 'info', 'warn', 'error level', 'audit', 'monitoring'
  ],
  cache: [
    'cache', 'caching', 'redis', 'memcache', 'memory', 'ttl', 'invalidate',
    'lru', 'store', 'memoize', 'buffer'
  ],
  queue: [
    'queue', 'job', 'worker', 'bull', 'rabbitmq', 'kafka', 'sqs', 'pubsub',
    'message', 'event', 'async', 'background', 'task queue', 'scheduler'
  ],
  file: [
    'file', 'upload', 'download', 'stream', 'fs', 'path', 'directory',
    'read', 'write', 'buffer', 'blob', 'multer', 's3', 'storage'
  ],
  security: [
    'security', 'secure', 'encrypt', 'decrypt', 'hash', 'bcrypt', 'crypto',
    'ssl', 'tls', 'https', 'xss', 'csrf', 'injection', 'sanitize', 'escape'
  ],
  ui: [
    'ui', 'ux', 'interface', 'design', 'style', 'css', 'sass', 'scss',
    'tailwind', 'bootstrap', 'layout', 'responsive', 'theme', 'dark mode'
  ],
  state: [
    'state', 'store', 'redux', 'vuex', 'mobx', 'zustand', 'recoil', 'context',
    'atom', 'selector', 'action', 'reducer', 'dispatch', 'subscribe'
  ]
};

/**
 * Classify content into topics based on keyword matching
 * @param {string} content - Content to classify
 * @param {number} maxTopics - Maximum number of topics to return
 * @returns {string[]}
 */
function classifyTopics(content, maxTopics = 5) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const normalizedContent = content.toLowerCase();
  const scores = {};

  // Score each topic based on keyword matches
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let score = 0;

    for (const keyword of keywords) {
      // Count occurrences of each keyword
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
      const matches = normalizedContent.match(regex);
      if (matches) {
        // Weight longer keywords higher (more specific)
        const weight = Math.log2(keyword.length + 1);
        score += matches.length * weight;
      }
    }

    if (score > 0) {
      scores[topic] = score;
    }
  }

  // Sort by score and return top topics
  const sortedTopics = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTopics)
    .map(([topic]) => topic);

  return sortedTopics;
}

/**
 * Get similarity score between two topic arrays
 * @param {string[]} topics1 - First topic array
 * @param {string[]} topics2 - Second topic array
 * @returns {number} - Similarity score 0-1
 */
function getTopicSimilarity(topics1, topics2) {
  if (!topics1.length || !topics2.length) {
    return 0;
  }

  const set1 = new Set(topics1);
  const set2 = new Set(topics2);

  const intersection = [...set1].filter(t => set2.has(t)).length;
  const union = new Set([...set1, ...set2]).size;

  return intersection / union;
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
  classifyTopics,
  getTopicSimilarity,
  TOPIC_KEYWORDS
};
