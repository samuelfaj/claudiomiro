const fs = require('fs');
const path = require('path');

// Mock all external dependencies BEFORE requiring cli
jest.mock('fs');
jest.mock('path');
jest.mock('../../logger');
jest.mock('../config/state');
jest.mock('../services/file-manager');
jest.mock('../steps');
jest.mock('../steps/step0');
jest.mock('../services/dag-executor');

const { init } = require('../cli');
const logger = require('../../logger');
const state = require('../config/state');
const { startFresh } = require('../services/file-manager');
const { step1, step5 } = require('../steps');
const { step0 } = require('../steps/step0');
const { DAGExecutor } = require('../services/dag-executor');

describe('CLI - Command-line argument parsing', () => {
  let originalArgv;
  let originalCwd;
  let processExitSpy;

  beforeEach(() => {
    // Save original process.argv and process.cwd
    originalArgv = process.argv;
    originalCwd = process.cwd;

    // Reset all mocks
    jest.clearAllMocks();

    // Mock process.exit
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

    // Setup default mocks
    state.folder = '/test/folder';
    state.claudiomiroFolder = '/test/folder/.claudiomiro';
    state.setFolder = jest.fn((folder) => {
      state.folder = folder;
      state.claudiomiroFolder = path.join(folder, '.claudiomiro');
    });

    process.cwd = jest.fn(() => '/test/cwd');

    // Setup path.join to work correctly
    path.join = jest.fn((...args) => args.join('/'));

    // Mock logger
    logger.banner = jest.fn();
    logger.error = jest.fn();
    logger.info = jest.fn();
    logger.success = jest.fn();
    logger.step = jest.fn();
    logger.path = jest.fn();
    logger.newline = jest.fn();
    logger.box = jest.fn();

    // Mock steps to return resolved promises that signal completion
    step0.mockImplementation(() => {
      return Promise.resolve();
    });
    step1.mockImplementation(() => {
      return Promise.resolve();
    });
    step5.mockImplementation(() => {
      return Promise.resolve();
    });

    // Default file system mocks
    fs.existsSync = jest.fn(() => true);
    fs.readdirSync = jest.fn(() => []);
    fs.readFileSync = jest.fn(() => '');
    fs.statSync = jest.fn(() => ({ isDirectory: () => false }));
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.cwd = originalCwd;
    processExitSpy.mockRestore();
  });

  describe('--prompt flag', () => {
    test('should parse --prompt and trigger step0', async () => {
      process.argv = ['node', 'cli.js', '--prompt=test prompt'];

      // .claudiomiro doesn't exist, so step0 should run
      fs.existsSync.mockReturnValue(false);

      await init();

      expect(step0).toHaveBeenCalled();
      const call = step0.mock.calls[0];
      expect(call[1]).toBe('test prompt');
    });

    test('should auto-enable --fresh when --prompt is used', async () => {
      process.argv = ['node', 'cli.js', '--prompt=test'];
      fs.existsSync.mockReturnValue(false);

      await init();

      expect(startFresh).toHaveBeenCalled();
    });

    test('should handle --prompt with equals signs in value', async () => {
      process.argv = ['node', 'cli.js', '--prompt=key=value'];
      fs.existsSync.mockReturnValue(false);

      await init();

      expect(step0).toHaveBeenCalled();
      expect(step0.mock.calls[0][1]).toBe('key=value');
    });
  });

  describe('--maxCycles flag', () => {
    test('should use custom --maxCycles value', async () => {
      process.argv = ['node', 'cli.js', '--maxCycles=5'];
      fs.existsSync.mockReturnValue(false);

      // Make step0 return maxCycles override
      step0.mockReturnValue(Promise.resolve());

      await init();

      expect(step0).toHaveBeenCalled();
    });
  });

  describe('--fresh flag', () => {
    test('should call startFresh when --fresh is provided', async () => {
      process.argv = ['node', 'cli.js', '--fresh'];
      fs.existsSync.mockReturnValue(false);

      await init();

      expect(startFresh).toHaveBeenCalled();
    });
  });

  describe('--same-branch flag', () => {
    test('should pass sameBranch=true to step0', async () => {
      process.argv = ['node', 'cli.js', '--same-branch'];
      fs.existsSync.mockReturnValue(false);

      await init();

      expect(step0).toHaveBeenCalled();
      expect(step0.mock.calls[0][0]).toBe(true);
    });

    test('should pass sameBranch=false by default', async () => {
      process.argv = ['node', 'cli.js'];
      fs.existsSync.mockReturnValue(false);

      await init();

      expect(step0).toHaveBeenCalled();
      expect(step0.mock.calls[0][0]).toBe(false);
    });
  });

  describe('--mode flag', () => {
    test('should default to auto mode', async () => {
      process.argv = ['node', 'cli.js'];
      fs.existsSync.mockReturnValue(false);

      await init();

      expect(step0).toHaveBeenCalled();
      expect(step0.mock.calls[0][2]).toBe('auto');
    });

    test('should parse --mode=hard', async () => {
      process.argv = ['node', 'cli.js', '--mode=hard'];
      fs.existsSync.mockReturnValue(false);

      await init();

      expect(step0).toHaveBeenCalled();
      expect(step0.mock.calls[0][2]).toBe('hard');
    });
  });

  describe('--steps flag', () => {
    test('should log allowed steps when --steps is provided', async () => {
      process.argv = ['node', 'cli.js', '--steps=1,2,3'];
      fs.existsSync.mockReturnValue(false);

      await init();

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Running only steps: 1, 2, 3'));
    });

    test('should skip step 0 when not in --steps list', async () => {
      process.argv = ['node', 'cli.js', '--steps=1,2'];
      fs.existsSync.mockReturnValue(false);

      await init();

      expect(step0).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Step 0 skipped'));
    });
  });

  describe('Multiple flags', () => {
    test('should handle multiple flags together', async () => {
      process.argv = ['node', 'cli.js', '--fresh', '--mode=hard', '--same-branch'];
      fs.existsSync.mockReturnValue(false);

      await init();

      expect(startFresh).toHaveBeenCalled();
      expect(step0).toHaveBeenCalled();
      expect(step0.mock.calls[0][0]).toBe(true); // sameBranch
      expect(step0.mock.calls[0][2]).toBe('hard'); // mode
    });
  });
});

describe('CLI - Folder validation and initialization', () => {
  let originalArgv;
  let processExitSpy;

  beforeEach(() => {
    originalArgv = process.argv;
    process.argv = ['node', 'cli.js'];

    jest.clearAllMocks();

    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

    state.folder = '/test/folder';
    state.claudiomiroFolder = '/test/folder/.claudiomiro';
    state.setFolder = jest.fn((folder) => {
      state.folder = folder;
      state.claudiomiroFolder = path.join(folder, '.claudiomiro');
    });

    path.join = jest.fn((...args) => args.join('/'));

    logger.banner = jest.fn();
    logger.error = jest.fn();
    logger.path = jest.fn();
    logger.newline = jest.fn();

    fs.existsSync = jest.fn(() => true);
    fs.readdirSync = jest.fn(() => []);
  });

  afterEach(() => {
    process.argv = originalArgv;
    processExitSpy.mockRestore();
  });

  test('should validate folder exists', async () => {
    fs.existsSync.mockReturnValue(false);

    await init();

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Folder does not exist'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test('should call state.setFolder with provided folder', async () => {
    process.argv = ['node', 'cli.js', '/custom/path'];
    fs.existsSync.mockReturnValue(false);

    await init();

    expect(state.setFolder).toHaveBeenCalledWith('/custom/path');
  });

  test('should use current working directory when no folder provided', async () => {
    process.cwd = jest.fn(() => '/current/working/dir');
    process.argv = ['node', 'cli.js'];
    fs.existsSync.mockReturnValue(false);

    await init();

    expect(state.setFolder).toHaveBeenCalledWith('/current/working/dir');
  });

  test('should log working directory path', async () => {
    fs.existsSync.mockReturnValue(false);

    await init();

    expect(logger.path).toHaveBeenCalled();
  });
});

describe('CLI - Step execution flow control', () => {
  let originalArgv;
  let processExitSpy;

  beforeEach(() => {
    originalArgv = process.argv;

    jest.clearAllMocks();

    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

    state.folder = '/test/folder';
    state.claudiomiroFolder = '/test/folder/.claudiomiro';
    state.setFolder = jest.fn((folder) => {
      state.folder = folder;
      state.claudiomiroFolder = path.join(folder, '.claudiomiro');
    });

    path.join = jest.fn((...args) => args.join('/'));

    logger.banner = jest.fn();
    logger.info = jest.fn();
    logger.step = jest.fn();
    logger.path = jest.fn();
    logger.newline = jest.fn();
    logger.error = jest.fn();

    step0.mockReturnValue(Promise.resolve());
    step1.mockReturnValue(Promise.resolve());

    fs.existsSync = jest.fn(() => true);
    fs.readdirSync = jest.fn(() => []);
    fs.readFileSync = jest.fn(() => '');
    fs.statSync = jest.fn(() => ({ isDirectory: () => false }));
  });

  afterEach(() => {
    process.argv = originalArgv;
    processExitSpy.mockRestore();
  });

  test('should execute step 0 when .claudiomiro does not exist', async () => {
    process.argv = ['node', 'cli.js'];
    fs.existsSync.mockImplementation((p) => p !== state.claudiomiroFolder);

    await init();

    expect(step0).toHaveBeenCalled();
  });

  test('should skip step 0 when --steps does not include 0', async () => {
    process.argv = ['node', 'cli.js', '--steps=1,2'];
    fs.existsSync.mockImplementation((p) => p !== state.claudiomiroFolder);

    await init();

    expect(step0).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Step 0 skipped'));
  });

  test('should execute step 1 when conditions are met', async () => {
    process.argv = ['node', 'cli.js'];

    // Setup: .claudiomiro exists, has tasks with PROMPT.md but no @dependencies
    fs.existsSync.mockImplementation((p) => {
      if (p === state.claudiomiroFolder) return true;
      if (p.includes('PROMPT.md')) return true;
      if (p.includes('TASK.md')) return true;
      if (p.includes('GITHUB_PR.md')) return false;
      return true;
    });

    fs.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
    fs.statSync.mockReturnValue({ isDirectory: () => true });
    fs.readFileSync.mockReturnValue('# Task content without dependencies');

    await init();

    expect(step1).toHaveBeenCalled();
  });

  test('should skip step 1 when --steps does not include 1', async () => {
    process.argv = ['node', 'cli.js', '--steps=2,3'];

    fs.existsSync.mockImplementation((p) => {
      if (p === state.claudiomiroFolder) return true;
      if (p.includes('PROMPT.md')) return true;
      if (p.includes('TASK.md')) return true;
      return false;
    });

    fs.readdirSync.mockReturnValue(['TASK1']);
    fs.statSync.mockReturnValue({ isDirectory: () => true });
    fs.readFileSync.mockReturnValue('# Task content');

    await init();

    expect(step1).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Step 1 skipped'));
  });
});

describe('CLI - Task graph building and validation', () => {
  let processExitSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

    state.folder = '/test/folder';
    state.claudiomiroFolder = '/test/folder/.claudiomiro';
    state.setFolder = jest.fn();

    path.join = jest.fn((...args) => args.join('/'));

    logger.banner = jest.fn();
    logger.error = jest.fn();
    logger.info = jest.fn();
    logger.success = jest.fn();
    logger.step = jest.fn();
    logger.path = jest.fn();
    logger.newline = jest.fn();

    fs.existsSync = jest.fn(() => true);
    fs.readdirSync = jest.fn(() => []);
    fs.readFileSync = jest.fn(() => '');
    fs.statSync = jest.fn(() => ({ isDirectory: () => true }));

    DAGExecutor.mockImplementation(() => ({
      run: jest.fn().mockResolvedValue()
    }));
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  test('should build task graph with valid dependencies', async () => {
    process.argv = ['node', 'cli.js'];

    fs.readdirSync.mockReturnValue(['TASK1', 'TASK2', 'TASK3']);
    fs.existsSync.mockImplementation((p) => {
      if (p.includes('GITHUB_PR.md')) return false;
      return true;
    });

    fs.readFileSync.mockImplementation((p) => {
      if (p.includes('TASK1/TASK.md')) return '@dependencies []\nTask 1 content';
      if (p.includes('TASK2/TASK.md')) return '@dependencies [TASK1]\nTask 2 content';
      if (p.includes('TASK3/TASK.md')) return '@dependencies [TASK1, TASK2]\nTask 3 content';
      return '';
    });

    await init();

    expect(DAGExecutor).toHaveBeenCalled();
    const graph = DAGExecutor.mock.calls[0][0];
    expect(graph.TASK1).toBeDefined();
    expect(graph.TASK2).toBeDefined();
    expect(graph.TASK3).toBeDefined();
    expect(graph.TASK1.deps).toEqual([]);
    expect(graph.TASK2.deps).toEqual(['TASK1']);
    expect(graph.TASK3.deps).toEqual(['TASK1', 'TASK2']);
  });

  test('should handle tasks with empty @dependencies', async () => {
    process.argv = ['node', 'cli.js'];

    fs.readdirSync.mockReturnValue(['TASK1']);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('@dependencies []\nTask content');

    await init();

    expect(DAGExecutor).toHaveBeenCalled();
    const graph = DAGExecutor.mock.calls[0][0];
    expect(graph.TASK1.deps).toEqual([]);
  });

  test('should exit when no tasks found', async () => {
    process.argv = ['node', 'cli.js'];

    fs.readdirSync.mockReturnValue([]);

    await init();

    expect(logger.error).toHaveBeenCalledWith('No tasks found in claudiomiro folder');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test('should detect task status (pending vs completed)', async () => {
    process.argv = ['node', 'cli.js'];

    fs.readdirSync.mockReturnValue(['TASK1', 'TASK2']);
    fs.readFileSync.mockReturnValue('@dependencies []\nTask content');
    fs.existsSync.mockImplementation((p) => {
      if (p.includes('TASK1/TASK.md') || p.includes('TASK2/TASK.md')) return true;
      if (p.includes('TASK1/GITHUB_PR.md')) return true; // completed
      if (p.includes('TASK2/GITHUB_PR.md')) return false; // pending
      return true;
    });

    await init();

    expect(DAGExecutor).toHaveBeenCalled();
    const graph = DAGExecutor.mock.calls[0][0];
    expect(graph.TASK1.status).toBe('completed');
    expect(graph.TASK2.status).toBe('pending');
  });
});

describe('CLI - DAG executor integration', () => {
  let processExitSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

    state.folder = '/test/folder';
    state.claudiomiroFolder = '/test/folder/.claudiomiro';
    state.setFolder = jest.fn();

    path.join = jest.fn((...args) => args.join('/'));

    logger.banner = jest.fn();
    logger.info = jest.fn();
    logger.success = jest.fn();
    logger.step = jest.fn();
    logger.path = jest.fn();
    logger.newline = jest.fn();

    fs.existsSync = jest.fn(() => true);
    fs.readdirSync = jest.fn(() => ['TASK1', 'TASK2']);
    fs.readFileSync = jest.fn(() => '@dependencies []\nTask content');
    fs.statSync = jest.fn(() => ({ isDirectory: () => true }));

    step5.mockReturnValue(Promise.resolve());

    DAGExecutor.mockImplementation(() => ({
      run: jest.fn().mockResolvedValue()
    }));
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  test('should activate DAG executor when task graph exists', async () => {
    process.argv = ['node', 'cli.js'];

    await init();

    expect(DAGExecutor).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('parallel execution'));
  });

  test('should pass maxConcurrent parameter to DAG executor', async () => {
    process.argv = ['node', 'cli.js', '--maxConcurrent=5'];

    await init();

    expect(DAGExecutor).toHaveBeenCalled();
    const maxConcurrent = DAGExecutor.mock.calls[0][2];
    expect(maxConcurrent).toBe(5);
  });

  test('should pass allowedSteps to DAG executor', async () => {
    process.argv = ['node', 'cli.js', '--steps=2,3'];

    await init();

    expect(DAGExecutor).toHaveBeenCalled();
    const allowedSteps = DAGExecutor.mock.calls[0][1];
    expect(allowedSteps).toEqual([2, 3]);
  });

  test('should skip DAG when steps 2-4 not in allowed list', async () => {
    process.argv = ['node', 'cli.js', '--steps=5'];

    fs.existsSync.mockImplementation((p) => {
      if (p.includes('GITHUB_PR.md')) return false;
      return true;
    });

    await init();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Steps 2-4 skipped'));
  });

  test('should execute step 5 after DAG completion', async () => {
    process.argv = ['node', 'cli.js'];

    fs.existsSync.mockImplementation((p) => {
      if (p.includes('/test/folder/GITHUB_PR.md')) return false;
      return true;
    });

    await init();

    expect(step5).toHaveBeenCalled();
  });
});

describe('CLI - Init function and main loop', () => {
  let originalArgv;
  let processExitSpy;

  beforeEach(() => {
    originalArgv = process.argv;
    process.argv = ['node', 'cli.js'];

    jest.clearAllMocks();

    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

    state.folder = '/test/folder';
    state.claudiomiroFolder = '/test/folder/.claudiomiro';
    state.setFolder = jest.fn((folder) => {
      state.folder = folder;
      state.claudiomiroFolder = path.join(folder, '.claudiomiro');
    });

    path.join = jest.fn((...args) => args.join('/'));

    logger.banner = jest.fn();
    logger.error = jest.fn();
    logger.box = jest.fn();
    logger.path = jest.fn();
    logger.newline = jest.fn();

    fs.existsSync = jest.fn(() => true);
    fs.readdirSync = jest.fn(() => []);

    step0.mockReturnValue(Promise.resolve());
    startFresh.mockReturnValue(undefined);
  });

  afterEach(() => {
    process.argv = originalArgv;
    processExitSpy.mockRestore();
  });

  test('should call logger.banner on init', async () => {
    fs.existsSync.mockReturnValue(false);

    await init();

    expect(logger.banner).toHaveBeenCalled();
  });

  test('should detect GITHUB_PR.md and start fresh', async () => {
    // Need to ensure setFolder properly sets state.folder
    state.setFolder = jest.fn((folder) => {
      state.folder = folder;
      state.claudiomiroFolder = path.join(folder, '.claudiomiro');
    });

    // When init() calls process.cwd(), it should return /test/folder
    process.cwd = jest.fn(() => '/test/folder');

    fs.existsSync.mockImplementation((p) => {
      // The check in init() uses path.join(state.folder, 'GITHUB_PR.md')
      if (p === '/test/folder/GITHUB_PR.md') return true;
      if (p === '/test/folder') return true;
      // Return false for .claudiomiro to trigger immediate completion
      if (p === '/test/folder/.claudiomiro') return false;
      return false;
    });

    await init();

    expect(startFresh).toHaveBeenCalled();
  });

  test('should handle max iterations limit', async () => {
    process.argv = ['node', 'cli.js', '--maxCycles=1'];

    fs.existsSync.mockReturnValue(false);

    await init();

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Maximum iteration limit'));
    expect(logger.box).toHaveBeenCalled();
  });
});

describe('CLI - Error handling', () => {
  let processExitSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();

    state.folder = '/test/folder';
    state.claudiomiroFolder = '/test/folder/.claudiomiro';
    state.setFolder = jest.fn();

    path.join = jest.fn((...args) => args.join('/'));

    logger.banner = jest.fn();
    logger.error = jest.fn();
    logger.path = jest.fn();
    logger.newline = jest.fn();

    fs.existsSync = jest.fn(() => true);
    fs.readdirSync = jest.fn(() => []);
    fs.readFileSync = jest.fn(() => '');
    fs.statSync = jest.fn(() => ({ isDirectory: () => true }));
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  test('should exit when folder does not exist', async () => {
    process.argv = ['node', 'cli.js', '/nonexistent'];

    fs.existsSync.mockReturnValue(false);

    await init();

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test('should exit when no tasks found', async () => {
    process.argv = ['node', 'cli.js'];

    fs.readdirSync.mockReturnValue([]);

    await init();

    expect(logger.error).toHaveBeenCalledWith('No tasks found in claudiomiro folder');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test('should regenerate dependencies when dependency graph is incomplete', async () => {
    process.argv = ['node', 'cli.js', '--steps=2'];

    state.folder = '/test/folder';
    state.claudiomiroFolder = '/test/folder/.claudiomiro';

    fs.readdirSync.mockReturnValue(['TASK1']);
    fs.readFileSync.mockReturnValue('Task without dependencies tag');

    // Setup folder to exist, .claudiomiro to exist, task exists, no dependencies
    fs.existsSync.mockImplementation((p) => {
      if (p === '/test/folder') return true;
      if (p === '/test/folder/.claudiomiro') return true;
      if (p === '/test/folder/GITHUB_PR.md') return false;
      if (p.includes('TASK.md')) return true;
      if (p.includes('GITHUB_PR.md')) return false;
      return false;
    });

    await init();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Dependency graph incomplete or invalid. Regenerating dependencies'));
  });
});
