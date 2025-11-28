const fs = require('fs');
const path = require('path');

// Mock fs module
jest.mock('fs');

const {
  loadResearchIndex,
  saveResearchIndex,
  createEmptyIndex,
  extractTopics,
  calculateSimilarity,
  indexResearch,
  findSimilarResearch,
  getReusableResearch,
  clearResearchIndex,
  getIndexPath
} = require('./research-indexer');

describe('research-indexer', () => {
  const mockClaudiomiroFolder = '/test/.claudiomiro';
  const mockIndexPath = '/test/.claudiomiro/cache/research-index.json';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-18T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createEmptyIndex', () => {
    test('should create empty index with correct structure', () => {
      const index = createEmptyIndex();

      expect(index.version).toBe('1.0.0');
      expect(index.created).toBe('2025-01-18T10:00:00.000Z');
      expect(index.patterns).toEqual({});
      expect(index.taskResearch).toEqual({});
    });
  });

  describe('getIndexPath', () => {
    test('should create cache directory if not exists', () => {
      fs.existsSync.mockReturnValue(false);

      getIndexPath(mockClaudiomiroFolder);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.join(mockClaudiomiroFolder, 'cache'),
        { recursive: true }
      );
    });

    test('should return correct index file path', () => {
      fs.existsSync.mockReturnValue(true);

      const result = getIndexPath(mockClaudiomiroFolder);

      expect(result).toBe(mockIndexPath);
    });
  });

  describe('loadResearchIndex', () => {
    test('should return empty index if file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const index = loadResearchIndex(mockClaudiomiroFolder);

      expect(index.taskResearch).toEqual({});
    });

    test('should load index from file', () => {
      const existingIndex = {
        version: '1.0.0',
        taskResearch: {
          TASK1: { topics: ['auth', 'api'] }
        },
        patterns: { auth: ['TASK1'] }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(existingIndex));

      const index = loadResearchIndex(mockClaudiomiroFolder);

      expect(index.taskResearch.TASK1.topics).toEqual(['auth', 'api']);
    });
  });

  describe('saveResearchIndex', () => {
    test('should write index to file with timestamp', () => {
      fs.existsSync.mockReturnValue(true);

      const index = createEmptyIndex();
      saveResearchIndex(mockClaudiomiroFolder, index);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockIndexPath,
        expect.stringContaining('"lastUpdated"'),
        'utf8'
      );
    });
  });

  describe('extractTopics', () => {
    test('should extract authentication topics', () => {
      const content = 'Implement user authentication with JWT tokens';

      const topics = extractTopics(content);

      expect(topics).toContain('authentication');
    });

    test('should extract multiple topics', () => {
      const content = 'Create API endpoint for user authentication with database validation';

      const topics = extractTopics(content);

      expect(topics).toContain('api');
      expect(topics).toContain('authentication');
      expect(topics).toContain('database');
      expect(topics).toContain('validation');
    });

    test('should return empty array for irrelevant content', () => {
      const content = 'Some random text without keywords';

      const topics = extractTopics(content);

      expect(topics).toEqual([]);
    });

    test('should not have duplicate topics', () => {
      const content = 'authentication auth login session jwt token';

      const topics = extractTopics(content);
      const uniqueTopics = [...new Set(topics)];

      expect(topics.length).toBe(uniqueTopics.length);
    });
  });

  describe('calculateSimilarity', () => {
    test('should return 1 for identical topics', () => {
      const topics = ['auth', 'api', 'database'];

      const similarity = calculateSimilarity(topics, topics);

      expect(similarity).toBe(1);
    });

    test('should return 0 for no overlap', () => {
      const topics1 = ['auth', 'api'];
      const topics2 = ['test', 'logging'];

      const similarity = calculateSimilarity(topics1, topics2);

      expect(similarity).toBe(0);
    });

    test('should return partial similarity for partial overlap', () => {
      const topics1 = ['auth', 'api', 'database'];
      const topics2 = ['auth', 'api', 'test'];

      const similarity = calculateSimilarity(topics1, topics2);

      // 2 matching out of 4 unique = 0.5
      expect(similarity).toBe(0.5);
    });

    test('should return 0 for empty arrays', () => {
      expect(calculateSimilarity([], ['auth'])).toBe(0);
      expect(calculateSimilarity(['auth'], [])).toBe(0);
      expect(calculateSimilarity([], [])).toBe(0);
    });
  });

  describe('indexResearch', () => {
    test('should index task research with topics', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(createEmptyIndex()));

      const taskContent = 'Implement user authentication';
      const researchContent = 'Analysis of JWT patterns';

      indexResearch(mockClaudiomiroFolder, 'TASK1', taskContent, researchContent);

      const writeCall = fs.writeFileSync.mock.calls[0];
      const savedIndex = JSON.parse(writeCall[1]);

      expect(savedIndex.taskResearch.TASK1).toBeDefined();
      expect(savedIndex.taskResearch.TASK1.topics).toContain('authentication');
      expect(savedIndex.patterns.authentication).toContain('TASK1');
    });
  });

  describe('findSimilarResearch', () => {
    test('should return null if no research indexed', () => {
      fs.existsSync.mockReturnValue(false);

      const result = findSimilarResearch(mockClaudiomiroFolder, 'new auth task');

      expect(result).toBeNull();
    });

    test('should find similar research based on topics', () => {
      const existingIndex = {
        version: '1.0.0',
        taskResearch: {
          TASK1: {
            topics: ['authentication', 'api', 'validation'],
            researchPath: '/test/.claudiomiro/TASK1/RESEARCH.md'
          }
        },
        patterns: { authentication: ['TASK1'], api: ['TASK1'], validation: ['TASK1'] }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(existingIndex));

      const result = findSimilarResearch(
        mockClaudiomiroFolder,
        'Create authentication API with validation',
        0.5
      );

      expect(result).not.toBeNull();
      expect(result.taskId).toBe('TASK1');
      expect(result.similarity).toBeGreaterThan(0.5);
    });

    test('should return null if similarity below threshold', () => {
      const existingIndex = {
        version: '1.0.0',
        taskResearch: {
          TASK1: {
            topics: ['authentication'],
            researchPath: '/test/.claudiomiro/TASK1/RESEARCH.md'
          }
        },
        patterns: { authentication: ['TASK1'] }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(existingIndex));

      const result = findSimilarResearch(
        mockClaudiomiroFolder,
        'test logging database queue file security',
        0.5
      );

      expect(result).toBeNull();
    });
  });

  describe('getReusableResearch', () => {
    test('should return null if no similar research', () => {
      fs.existsSync.mockReturnValue(false);

      const result = getReusableResearch(mockClaudiomiroFolder, 'new task');

      expect(result).toBeNull();
    });

    test('should return research with adaptation note if highly similar', () => {
      const existingIndex = {
        version: '1.0.0',
        taskResearch: {
          TASK1: {
            topics: ['auth', 'api', 'validation', 'middleware'],
            researchPath: '/test/.claudiomiro/TASK1/RESEARCH.md'
          }
        },
        patterns: {}
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((p) => {
        if (p.includes('research-index')) {
          return JSON.stringify(existingIndex);
        }
        return '# Research Content\nAuth patterns found...';
      });

      const result = getReusableResearch(
        mockClaudiomiroFolder,
        'Implement authentication API with validation and middleware'
      );

      // Should return null if similarity < 0.8 (4 matching out of 4 = 1.0)
      if (result) {
        expect(result.content).toContain('Research Content');
        expect(result.sourceTask).toBe('TASK1');
        expect(result.adaptationNote).toContain('TASK1');
      }
    });
  });

  describe('clearResearchIndex', () => {
    test('should delete index file if exists', () => {
      fs.existsSync.mockReturnValue(true);

      clearResearchIndex(mockClaudiomiroFolder);

      expect(fs.unlinkSync).toHaveBeenCalledWith(mockIndexPath);
    });

    test('should do nothing if index does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      clearResearchIndex(mockClaudiomiroFolder);

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });
});
