/**
 * Research Manager Service
 *
 * Provides research reuse capabilities by:
 * - Indexing research files by topics/patterns
 * - Finding similar research for new tasks
 * - Returning reusable research to avoid regeneration
 *
 * Usage:
 *   const { findSimilarResearch, indexResearch } = require('./research-manager');
 *
 *   // Check for similar research before generating
 *   const similar = findSimilarResearch(claudiomiroFolder, taskContent);
 *   if (similar && similar.similarity > 0.7) {
 *     // Reuse existing research
 *   }
 *
 *   // Index research after generation
 *   indexResearch(claudiomiroFolder, taskId, taskContent, researchContent);
 */

const {
  loadResearchIndex,
  saveResearchIndex,
  extractTopics,
  calculateSimilarity,
  indexResearch,
  findSimilarResearch,
  getReusableResearch,
  clearResearchIndex
} = require('./research-indexer');

module.exports = {
  loadResearchIndex,
  saveResearchIndex,
  extractTopics,
  calculateSimilarity,
  indexResearch,
  findSimilarResearch,
  getReusableResearch,
  clearResearchIndex
};
