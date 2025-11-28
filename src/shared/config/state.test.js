const path = require('path');

describe('State', () => {
  let state;
  let mockFs;

  beforeEach(() => {
    // Reset all modules and mocks
    jest.resetModules();

    // Create mock fs
    mockFs = {
      existsSync: jest.fn(),
      mkdirSync: jest.fn()
    };

    // Mock fs module
    jest.doMock('fs', () => mockFs);

    // Now require state with mocked fs
    state = require('./state');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('setFolder', () => {
    test('should set folder and claudiomiro folder paths', () => {
      state.setFolder('/test/project');

      expect(state.folder).toBe(path.resolve('/test/project'));
      expect(state.claudiomiroFolder).toBe(path.join(path.resolve('/test/project'), '.claudiomiro'));
    });

    test('should resolve relative paths', () => {
      state.setFolder('./relative');

      expect(path.isAbsolute(state.folder)).toBe(true);
    });
  });

  describe('cacheFolder', () => {
    test('should return cache folder path', () => {
      state.setFolder('/test/project');

      expect(state.cacheFolder).toBe(path.join('/test/project', '.claudiomiro', 'cache'));
    });
  });

  describe('initializeCache', () => {
    test('should do nothing if claudiomiro folder not set', () => {
      // Don't call setFolder - _claudiomiroFolder is null
      state.initializeCache();

      expect(mockFs.existsSync).not.toHaveBeenCalled();
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    test('should create cache folder if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      state.setFolder('/test/project');
      state.initializeCache();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('cache'),
        { recursive: true }
      );
    });

    test('should not create cache folder if it already exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      state.setFolder('/test/project');
      state.initializeCache();

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('hasCacheFolder', () => {
    test('should return true if cache folder exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      state.setFolder('/test/project');

      expect(state.hasCacheFolder()).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('cache')
      );
    });

    test('should return false if cache folder does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      state.setFolder('/test/project');

      expect(state.hasCacheFolder()).toBe(false);
    });
  });

  describe('setExecutorType', () => {
    test('should set valid executor type', () => {
      state.setExecutorType('claude');
      expect(state.executorType).toBe('claude');

      state.setExecutorType('codex');
      expect(state.executorType).toBe('codex');

      state.setExecutorType('deep-seek');
      expect(state.executorType).toBe('deep-seek');

      state.setExecutorType('glm');
      expect(state.executorType).toBe('glm');

      state.setExecutorType('gemini');
      expect(state.executorType).toBe('gemini');
    });

    test('should throw error for invalid executor type', () => {
      expect(() => state.setExecutorType('invalid')).toThrow('Invalid executor type: invalid');
    });
  });

  describe('executorType', () => {
    test('should default to claude', () => {
      expect(state.executorType).toBe('claude');
    });
  });
});
