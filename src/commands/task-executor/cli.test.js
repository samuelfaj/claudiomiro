/**
 * cli.js test suite
 *
 * NOTE: This test file uses a lightweight mocking approach to avoid loading
 * the entire module dependency graph (steps, dag-executor, etc.) which causes
 * memory issues in Jest. The tests verify the CLI's argument parsing and
 * basic initialization logic.
 */

const path = require('path');

// Mock all dependencies BEFORE requiring cli.js
jest.mock('fs');
jest.mock('../../shared/utils/logger');
jest.mock('../../shared/config/state');
jest.mock('./services/file-manager');
jest.mock('./steps', () => ({
    step0: jest.fn().mockResolvedValue(),
    step1: jest.fn().mockResolvedValue(),
    step2: jest.fn().mockResolvedValue(),
    step3: jest.fn().mockResolvedValue(),
    step7: jest.fn().mockResolvedValue(),
    step8: jest.fn().mockResolvedValue(),
}));
jest.mock('./services/dag-executor');
jest.mock('./utils/validation');
jest.mock('../../shared/services/git-detector');
jest.mock('../../shared/services/prompt-reader');
jest.mock('../../shared/services/git-manager');

const fs = require('fs');
const logger = require('../../shared/utils/logger');
const state = require('../../shared/config/state');
const { startFresh } = require('./services/file-manager');
const { detectGitConfiguration } = require('../../shared/services/git-detector');
const { getMultilineInput, getSimpleInput } = require('../../shared/services/prompt-reader');
const { createBranches, getCurrentBranch } = require('../../shared/services/git-manager');

// Setup default mock implementations for prompt-reader and git-manager
getMultilineInput.mockResolvedValue('Test task description');
getSimpleInput.mockResolvedValue('');
getCurrentBranch.mockReturnValue('test-branch');
createBranches.mockImplementation(() => {});

// Setup default mock implementations
logger.banner = jest.fn();
logger.info = jest.fn();
logger.error = jest.fn();
logger.warning = jest.fn();
logger.success = jest.fn();
logger.path = jest.fn();
logger.newline = jest.fn();
logger.startSpinner = jest.fn();
logger.confirm = jest.fn().mockResolvedValue(true);
logger.step = jest.fn();

// Mock state with getters and setters
let mockFolder = null;
let mockClaudiomiroFolder = null;
let mockClaudiomiroRoot = null;
let mockWorkspaceRoot = null;
let mockWorkspaceClaudiomiroRoot = null;
let mockWorkspaceClaudiomiroFolder = null;
let mockExecutorType = 'claude';

state.setFolder = jest.fn((folderPath) => {
    const resolved = path.resolve(folderPath);
    mockFolder = resolved;

    if (!mockWorkspaceRoot) {
        mockWorkspaceRoot = resolved;
        mockWorkspaceClaudiomiroRoot = path.join(mockWorkspaceRoot, '.claudiomiro');
        mockWorkspaceClaudiomiroFolder = path.join(mockWorkspaceClaudiomiroRoot, 'task-executor');
    }

    mockClaudiomiroRoot = path.join(mockFolder, '.claudiomiro');
    mockClaudiomiroFolder = path.join(mockClaudiomiroRoot, 'task-executor');
});

state.initializeCache = jest.fn();

Object.defineProperty(state, 'folder', {
    get: () => mockFolder,
    configurable: true,
});

Object.defineProperty(state, 'claudiomiroFolder', {
    get: () => mockClaudiomiroFolder,
    configurable: true,
});

Object.defineProperty(state, 'claudiomiroRoot', {
    get: () => mockClaudiomiroRoot,
    configurable: true,
});

Object.defineProperty(state, 'workspaceClaudiomiroFolder', {
    get: () => mockWorkspaceClaudiomiroFolder,
    configurable: true,
});

Object.defineProperty(state, 'workspaceClaudiomiroRoot', {
    get: () => mockWorkspaceClaudiomiroRoot,
    configurable: true,
});

state.setExecutorType = jest.fn((type) => {
    mockExecutorType = type;
});

Object.defineProperty(state, 'executorType', {
    get: () => mockExecutorType,
    configurable: true,
});

// Mock state.setMultiRepo
state.setMultiRepo = jest.fn();
state.isMultiRepo = jest.fn().mockReturnValue(false);

// Mock state legacy systems methods
let mockLegacySystems = new Map();

state.setLegacySystems = jest.fn((paths) => {
    mockLegacySystems.clear();
    for (const [type, legacyPath] of Object.entries(paths)) {
        if (!legacyPath) continue;
        const resolved = path.resolve(legacyPath);
        // Simulate validation - throw if path doesn't exist
        if (!fs.existsSync(resolved)) {
            throw new Error(`Legacy ${type} path does not exist: ${resolved}`);
        }
        mockLegacySystems.set(type, resolved);
    }
});

state.getAllLegacySystems = jest.fn(() => new Map(mockLegacySystems));
state.hasLegacySystems = jest.fn(() => mockLegacySystems.size > 0);

// Now require the module under test
const cliModule = require('./cli');

// Store original process.exit
const originalExit = process.exit;

describe('src/commands/task-executor/cli.js', () => {
    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Reset state
        mockFolder = null;
        mockClaudiomiroFolder = null;
        mockClaudiomiroRoot = null;
        mockWorkspaceRoot = null;
        mockWorkspaceClaudiomiroRoot = null;
        mockWorkspaceClaudiomiroFolder = null;
        mockExecutorType = 'claude';
        mockLegacySystems = new Map();

        // Mock process.exit
        process.exit = jest.fn();

        // Default fs mock: folder exists, claudiomiro folder does not exist
        fs.existsSync = jest.fn((p) => {
            if (p && p.includes('.claudiomiro')) return false;
            return true;
        });
        fs.readdirSync = jest.fn().mockReturnValue([]);
        fs.statSync = jest.fn().mockReturnValue({ isDirectory: () => true });
        fs.readFileSync = jest.fn().mockReturnValue('');
        fs.writeFileSync = jest.fn();
        fs.mkdirSync = jest.fn();
        fs.copyFileSync = jest.fn();

        // Reset prompt-reader mocks
        getMultilineInput.mockResolvedValue('Test task description');
        getSimpleInput.mockResolvedValue('');
        getCurrentBranch.mockReturnValue('test-branch');
        createBranches.mockImplementation(() => {});
    });

    afterEach(() => {
        process.exit = originalExit;
    });

    describe('init()', () => {
        test('should set folder from args', async () => {
            await cliModule.init(['/test/folder']);

            expect(state.setFolder).toHaveBeenCalledWith('/test/folder');
        });

        test('should default folder to process.cwd() when not provided', async () => {
            await cliModule.init([]);

            expect(state.setFolder).toHaveBeenCalledWith(process.cwd());
        });

        test('should exit with error if folder does not exist', async () => {
            fs.existsSync = jest.fn().mockReturnValue(false);

            await cliModule.init(['/nonexistent/folder']);

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Folder does not exist'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        test('should parse --steps=0,1,2 flag correctly', async () => {
            await cliModule.init(['.', '--steps=0,1,2']);

            expect(logger.info).toHaveBeenCalledWith('Running only steps: 0, 1, 2');
        });
    });

    describe('executor type parsing', () => {
        test('should default to claude executor', async () => {
            await cliModule.init(['.']);

            expect(state.setExecutorType).toHaveBeenCalledWith('claude');
            expect(logger.info).toHaveBeenCalledWith('Executor selected: claude');
        });

        test('should set codex executor when --codex flag is passed', async () => {
            await cliModule.init(['.', '--codex']);

            expect(state.setExecutorType).toHaveBeenCalledWith('codex');
            expect(logger.info).toHaveBeenCalledWith('Executor selected: codex');
        });

        test('should set deep-seek executor when --deep-seek flag is passed', async () => {
            await cliModule.init(['.', '--deep-seek']);

            expect(state.setExecutorType).toHaveBeenCalledWith('deep-seek');
        });

        test('should set glm executor when --glm flag is passed', async () => {
            await cliModule.init(['.', '--glm']);

            expect(state.setExecutorType).toHaveBeenCalledWith('glm');
        });

        test('should set gemini executor when --gemini flag is passed', async () => {
            await cliModule.init(['.', '--gemini']);

            expect(state.setExecutorType).toHaveBeenCalledWith('gemini');
        });
    });

    describe('--fresh flag', () => {
        test('should call startFresh when --fresh flag is passed', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p && p.includes('done.txt')) return true;
                if (p && p.includes('.claudiomiro')) return true;
                return true;
            });
            fs.readdirSync = jest.fn().mockReturnValue([]);

            await cliModule.init(['.', '--fresh']);

            expect(startFresh).toHaveBeenCalled();
        });
    });

    describe('exports', () => {
        test('should export init function', () => {
            expect(cliModule.init).toBeDefined();
            expect(typeof cliModule.init).toBe('function');
        });
    });

    describe('multi-repo flag parsing', () => {
        beforeEach(() => {
            // Reset mocks
            detectGitConfiguration.mockReset();
            state.setMultiRepo.mockReset();
            fs.mkdirSync = jest.fn();
            fs.writeFileSync = jest.fn();
        });

        test('should parse --backend=/path correctly and extract path value', async () => {
            const backendPath = '/test/backend';
            const frontendPath = '/test/frontend';

            fs.existsSync = jest.fn((p) => {
                if (p === backendPath || p === frontendPath) return true;
                if (p && p.includes('.claudiomiro')) return false;
                return true;
            });

            detectGitConfiguration.mockReturnValue({
                mode: 'separate',
                gitRoots: [backendPath, frontendPath],
            });

            await cliModule.init(['.', `--backend=${backendPath}`, `--frontend=${frontendPath}`]);

            expect(detectGitConfiguration).toHaveBeenCalledWith(backendPath, frontendPath);
        });

        test('should parse --frontend=/path correctly and extract path value', async () => {
            const backendPath = '/test/backend';
            const frontendPath = '/test/frontend';

            fs.existsSync = jest.fn((p) => {
                if (p === backendPath || p === frontendPath) return true;
                if (p && p.includes('.claudiomiro')) return false;
                return true;
            });

            detectGitConfiguration.mockReturnValue({
                mode: 'separate',
                gitRoots: [backendPath, frontendPath],
            });

            await cliModule.init(['.', `--backend=${backendPath}`, `--frontend=${frontendPath}`]);

            expect(state.setMultiRepo).toHaveBeenCalledWith(
                backendPath,
                frontendPath,
                { mode: 'separate', gitRoots: [backendPath, frontendPath] },
            );
        });

        test('should trigger multi-repo mode when both flags provided', async () => {
            const backendPath = '/test/backend';
            const frontendPath = '/test/frontend';

            fs.existsSync = jest.fn((p) => {
                if (p === backendPath || p === frontendPath) return true;
                if (p && p.includes('.claudiomiro')) return false;
                return true;
            });

            detectGitConfiguration.mockReturnValue({
                mode: 'monorepo',
                gitRoots: ['/test'],
            });

            await cliModule.init(['.', `--backend=${backendPath}`, `--frontend=${frontendPath}`]);

            expect(state.setMultiRepo).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Multi-repo mode: monorepo');
        });

        test('should persist config to multi-repo.json', async () => {
            const backendPath = '/test/backend';
            const frontendPath = '/test/frontend';

            fs.existsSync = jest.fn((p) => {
                if (p === backendPath || p === frontendPath) return true;
                if (p && p.includes('.claudiomiro')) return false;
                return true;
            });

            detectGitConfiguration.mockReturnValue({
                mode: 'separate',
                gitRoots: [backendPath, frontendPath],
            });

            await cliModule.init(['.', `--backend=${backendPath}`, `--frontend=${frontendPath}`]);

            const configWrites = fs.writeFileSync.mock.calls.filter(
                call => call[0] && call[0].includes('multi-repo.json'),
            );
            expect(configWrites.length).toBeGreaterThanOrEqual(3);

            const expectedPaths = [
                path.join(path.resolve(process.cwd()), '.claudiomiro', 'task-executor', 'multi-repo.json'),
                path.join(path.resolve(backendPath), '.claudiomiro', 'task-executor', 'multi-repo.json'),
                path.join(path.resolve(frontendPath), '.claudiomiro', 'task-executor', 'multi-repo.json'),
            ];

            expectedPaths.forEach((expectedPath) => {
                expect(configWrites.some(([filePath]) => filePath === expectedPath)).toBe(true);
            });

            const config = JSON.parse(configWrites[0][1]);
            expect(config.enabled).toBe(true);
            expect(config.mode).toBe('separate');
        });

        test('should not enable multi-repo when only --backend is provided', async () => {
            const backendPath = '/test/backend';

            fs.existsSync = jest.fn((p) => {
                if (p === backendPath) return true;
                if (p && p.includes('.claudiomiro')) return false;
                return true;
            });

            await cliModule.init(['.', `--backend=${backendPath}`]);

            expect(state.setMultiRepo).not.toHaveBeenCalled();
        });

        test('should not enable multi-repo when only --frontend is provided', async () => {
            const frontendPath = '/test/frontend';

            fs.existsSync = jest.fn((p) => {
                if (p === frontendPath) return true;
                if (p && p.includes('.claudiomiro')) return false;
                return true;
            });

            await cliModule.init(['.', `--frontend=${frontendPath}`]);

            expect(state.setMultiRepo).not.toHaveBeenCalled();
        });

        test('should work as before when no multi-repo flags provided (backward compatible)', async () => {
            await cliModule.init(['.']);

            expect(state.setMultiRepo).not.toHaveBeenCalled();
            expect(state.setFolder).toHaveBeenCalled();
        });

        test('should extract path with equals sign correctly', async () => {
            const backendPath = '/test/path/with=equals/dir';
            const frontendPath = '/test/frontend';

            fs.existsSync = jest.fn((p) => {
                if (p === backendPath || p === frontendPath) return true;
                if (p && p.includes('.claudiomiro')) return false;
                return true;
            });

            detectGitConfiguration.mockReturnValue({
                mode: 'separate',
                gitRoots: [backendPath, frontendPath],
            });

            await cliModule.init(['.', `--backend=${backendPath}`, `--frontend=${frontendPath}`]);

            expect(detectGitConfiguration).toHaveBeenCalledWith(backendPath, frontendPath);
        });

        test('should exit with error when backend path does not exist', async () => {
            const backendPath = '/nonexistent/backend';
            const frontendPath = '/test/frontend';

            fs.existsSync = jest.fn((p) => {
                if (p === backendPath) return false;
                if (p === frontendPath) return true;
                if (p && p.includes('.claudiomiro')) return false;
                return true;
            });

            await cliModule.init(['.', `--backend=${backendPath}`, `--frontend=${frontendPath}`]);

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Backend path does not exist'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        test('should exit with error when frontend path does not exist', async () => {
            const backendPath = '/test/backend';
            const frontendPath = '/nonexistent/frontend';

            fs.existsSync = jest.fn((p) => {
                if (p === backendPath) return true;
                if (p === frontendPath) return false;
                if (p && p.includes('.claudiomiro')) return false;
                return true;
            });

            await cliModule.init(['.', `--backend=${backendPath}`, `--frontend=${frontendPath}`]);

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Frontend path does not exist'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        test('should exit with error when paths are not git repos', async () => {
            const backendPath = '/test/backend';
            const frontendPath = '/test/frontend';

            fs.existsSync = jest.fn((p) => {
                if (p === backendPath || p === frontendPath) return true;
                if (p && p.includes('.claudiomiro')) return false;
                return true;
            });

            detectGitConfiguration.mockImplementation(() => {
                throw new Error('Both paths must be inside git repositories');
            });

            await cliModule.init(['.', `--backend=${backendPath}`, `--frontend=${frontendPath}`]);

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid git configuration'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        test('should log info messages with mode and paths', async () => {
            const backendPath = '/test/backend';
            const frontendPath = '/test/frontend';

            fs.existsSync = jest.fn((p) => {
                if (p === backendPath || p === frontendPath) return true;
                if (p && p.includes('.claudiomiro')) return false;
                return true;
            });

            detectGitConfiguration.mockReturnValue({
                mode: 'monorepo',
                gitRoots: ['/test'],
            });

            await cliModule.init(['.', `--backend=${backendPath}`, `--frontend=${frontendPath}`]);

            expect(logger.info).toHaveBeenCalledWith('Multi-repo mode: monorepo');
            expect(logger.info).toHaveBeenCalledWith(`Backend: ${backendPath}`);
            expect(logger.info).toHaveBeenCalledWith(`Frontend: ${frontendPath}`);
        });
    });

    describe('--continue mode with multi-repo', () => {
        beforeEach(() => {
            state.setMultiRepo.mockReset();
        });

        test('should restore multi-repo mode from multi-repo.json on --continue', async () => {
            // Paths were unused

            fs.existsSync = jest.fn((p) => {
                if (p && p.includes('multi-repo.json')) return true;
                if (p && p.includes('PENDING_CLARIFICATION.flag')) return true;
                if (p && p.includes('CLARIFICATION_ANSWERS.json')) return true;
                if (p && p.includes('.claudiomiro')) return true;
                return true;
            });

            fs.readFileSync = jest.fn((p) => {
                if (p && p.includes('multi-repo.json')) {
                    return JSON.stringify({
                        enabled: true,
                        mode: 'separate',
                        repositories: {
                            backend: '/restored/backend',
                            frontend: '/restored/frontend',
                        },
                        gitRoots: ['/restored/backend', '/restored/frontend'],
                    });
                }
                return '';
            });

            await cliModule.init(['.', '--continue']);

            expect(state.setMultiRepo).toHaveBeenCalledWith(
                '/restored/backend',
                '/restored/frontend',
                { mode: 'separate', gitRoots: ['/restored/backend', '/restored/frontend'] },
            );
            expect(logger.info).toHaveBeenCalledWith('Restored multi-repo mode: separate');
        });

        test('should continue as single-repo when multi-repo.json does not exist on --continue', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p && p.includes('multi-repo.json')) return false;
                if (p && p.includes('PENDING_CLARIFICATION.flag')) return true;
                if (p && p.includes('CLARIFICATION_ANSWERS.json')) return true;
                if (p && p.includes('.claudiomiro')) return true;
                return true;
            });

            await cliModule.init(['.', '--continue']);

            expect(state.setMultiRepo).not.toHaveBeenCalled();
        });

        test('should restore multi-repo mode from legacy config path on --continue', async () => {
            const legacyConfigPath = path.join(process.cwd(), '.claudiomiro', 'multi-repo.json');
            const workspaceConfigPath = path.join(process.cwd(), '.claudiomiro', 'task-executor', 'multi-repo.json');
            const pendingPath = path.join(process.cwd(), '.claudiomiro', 'PENDING_CLARIFICATION.flag');
            const answersPath = path.join(process.cwd(), '.claudiomiro', 'CLARIFICATION_ANSWERS.json');

            fs.existsSync = jest.fn((p) => {
                if (!p) return false;
                if (p === workspaceConfigPath) return false;
                if (p === legacyConfigPath) return true;
                if (p === pendingPath || p === answersPath) return true;
                if (p === process.cwd()) return true;
                if (typeof p === 'string' && p.includes('.claudiomiro')) return true;
                return true;
            });

            fs.readFileSync = jest.fn((p) => {
                if (p === workspaceConfigPath || p === legacyConfigPath) {
                    return JSON.stringify({
                        enabled: true,
                        mode: 'separate',
                        repositories: {
                            backend: '/legacy/backend',
                            frontend: '/legacy/frontend',
                        },
                        gitRoots: ['/legacy/backend', '/legacy/frontend'],
                    });
                }
                return '';
            });

            await cliModule.init(['.', '--continue']);

            expect(state.setMultiRepo).toHaveBeenCalledWith(
                '/legacy/backend',
                '/legacy/frontend',
                { mode: 'separate', gitRoots: ['/legacy/backend', '/legacy/frontend'] },
            );
            expect(fs.copyFileSync).toHaveBeenCalledWith(
                legacyConfigPath,
                workspaceConfigPath,
            );
        });

        test('should restore multi-repo mode when config exists in repo-scoped folder on --continue', async () => {
            const backendPath = path.join(process.cwd(), 'backend-repo');
            const repoClaudiomiro = path.join(backendPath, '.claudiomiro', 'task-executor');
            const configPath = path.join(repoClaudiomiro, 'multi-repo.json');
            const pendingPath = path.join(repoClaudiomiro, 'PENDING_CLARIFICATION.flag');
            const answersPath = path.join(repoClaudiomiro, 'CLARIFICATION_ANSWERS.json');

            const configContent = {
                enabled: true,
                mode: 'separate',
                repositories: {
                    backend: '/shared/backend',
                    frontend: '/shared/frontend',
                },
                gitRoots: ['/shared/backend', '/shared/frontend'],
            };

            fs.existsSync = jest.fn((p) => {
                if (!p) return false;
                if (p === backendPath) return true;
                if (p === configPath) return true;
                if (p === pendingPath || p === answersPath) return true;
                if (typeof p === 'string' && p.startsWith(repoClaudiomiro)) return true;
                return true;
            });

            fs.readFileSync = jest.fn((p) => {
                if (p === configPath) {
                    return JSON.stringify(configContent);
                }
                return '';
            });

            await cliModule.init([backendPath, '--continue']);

            expect(state.setMultiRepo).toHaveBeenCalledWith(
                '/shared/backend',
                '/shared/frontend',
                { mode: 'separate', gitRoots: ['/shared/backend', '/shared/frontend'] },
            );
            expect(logger.info).toHaveBeenCalledWith('Restored multi-repo mode: separate');
        });

        test('should continue as single-repo when multi-repo.json has enabled: false', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p && p.includes('multi-repo.json')) return true;
                if (p && p.includes('PENDING_CLARIFICATION.flag')) return true;
                if (p && p.includes('CLARIFICATION_ANSWERS.json')) return true;
                if (p && p.includes('.claudiomiro')) return true;
                return true;
            });

            fs.readFileSync = jest.fn((p) => {
                if (p && p.includes('multi-repo.json')) {
                    return JSON.stringify({
                        enabled: false,
                        mode: 'separate',
                        repositories: { backend: '/b', frontend: '/f' },
                        gitRoots: [],
                    });
                }
                return '';
            });

            await cliModule.init(['.', '--continue']);

            expect(state.setMultiRepo).not.toHaveBeenCalled();
        });

        test('should handle invalid JSON in multi-repo.json gracefully', async () => {
            fs.existsSync = jest.fn((p) => {
                if (p && p.includes('multi-repo.json')) return true;
                if (p && p.includes('PENDING_CLARIFICATION.flag')) return true;
                if (p && p.includes('CLARIFICATION_ANSWERS.json')) return true;
                if (p && p.includes('.claudiomiro')) return true;
                return true;
            });

            fs.readFileSync = jest.fn((p) => {
                if (p && p.includes('multi-repo.json')) {
                    return 'invalid json{{{';
                }
                return '';
            });

            await cliModule.init(['.', '--continue']);

            expect(state.setMultiRepo).not.toHaveBeenCalled();
            expect(logger.warning).toHaveBeenCalledWith('Invalid multi-repo.json, continuing as single-repo mode');
        });
        describe('branch prompt handling', () => {
            test('uses current branch when user leaves input empty', async () => {
                getCurrentBranch.mockReturnValue('feature/old-branch');
                getSimpleInput.mockResolvedValue(''); // user presses Enter

                await cliModule.init(['.']);

                expect(getCurrentBranch).toHaveBeenCalled();
                expect(getSimpleInput).toHaveBeenCalled();
                expect(createBranches).not.toHaveBeenCalled();
                expect(logger.info).toHaveBeenCalledWith('Using current branch: feature/old-branch');
            });

            test('creates new branch when user provides a name', async () => {
                getCurrentBranch.mockReturnValue('feature/old-branch');
                getSimpleInput.mockResolvedValue('new-feature-branch');

                await cliModule.init(['.']);

                expect(createBranches).toHaveBeenCalledWith('new-feature-branch');
                expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Using current branch'));
            });
        });
    });

    describe('legacy system flag parsing', () => {
        beforeEach(() => {
            mockLegacySystems = new Map();
            state.setLegacySystems.mockClear();
            state.getAllLegacySystems.mockClear();
            state.hasLegacySystems.mockClear();

            // Make process.exit throw to stop the main loop
            process.exit = jest.fn((code) => {
                throw new Error(`process.exit(${code})`);
            });

            // Override mock to actually set the map and track calls
            state.setLegacySystems.mockImplementation((paths) => {
                mockLegacySystems.clear();
                for (const [type, lPath] of Object.entries(paths)) {
                    if (!lPath) continue;
                    const resolved = path.resolve(lPath);
                    if (!fs.existsSync(resolved)) {
                        throw new Error(`Legacy ${type} path does not exist: ${resolved}`);
                    }
                    mockLegacySystems.set(type, resolved);
                }
            });
            state.getAllLegacySystems.mockImplementation(() => new Map(mockLegacySystems));
        });

        test('should parse --legacy-system=<path> correctly', async () => {
            const legacyPath = '/test/legacy-system';

            fs.existsSync = jest.fn((p) => {
                if (p === legacyPath || p === path.resolve(legacyPath)) return true;
                // Simulate folder doesn't exist so test exits via process.exit
                if (p && p.includes(process.cwd())) return false;
                if (p && p.includes('.claudiomiro')) return false;
                return false;
            });

            // Expect process.exit to throw (which is how we mock it)
            await expect(cliModule.init(['.', `--legacy-system=${legacyPath}`]))
                .rejects.toThrow('process.exit(1)');

            expect(state.setLegacySystems).toHaveBeenCalledWith({ system: legacyPath });
        });

        test('should parse --legacy-backend=<path> correctly', async () => {
            const legacyPath = '/test/legacy-backend';

            fs.existsSync = jest.fn((p) => {
                if (p === legacyPath || p === path.resolve(legacyPath)) return true;
                if (p && p.includes(process.cwd())) return false;
                if (p && p.includes('.claudiomiro')) return false;
                return false;
            });

            await expect(cliModule.init(['.', `--legacy-backend=${legacyPath}`]))
                .rejects.toThrow('process.exit(1)');

            expect(state.setLegacySystems).toHaveBeenCalledWith({ backend: legacyPath });
        });

        test('should parse --legacy-frontend=<path> correctly', async () => {
            const legacyPath = '/test/legacy-frontend';

            fs.existsSync = jest.fn((p) => {
                if (p === legacyPath || p === path.resolve(legacyPath)) return true;
                if (p && p.includes(process.cwd())) return false;
                if (p && p.includes('.claudiomiro')) return false;
                return false;
            });

            await expect(cliModule.init(['.', `--legacy-frontend=${legacyPath}`]))
                .rejects.toThrow('process.exit(1)');

            expect(state.setLegacySystems).toHaveBeenCalledWith({ frontend: legacyPath });
        });

        test('should parse multiple legacy flags simultaneously', async () => {
            const systemPath = '/test/legacy-system';
            const backendPath = '/test/legacy-backend';
            const frontendPath = '/test/legacy-frontend';

            fs.existsSync = jest.fn((p) => {
                if (p === systemPath || p === path.resolve(systemPath)) return true;
                if (p === backendPath || p === path.resolve(backendPath)) return true;
                if (p === frontendPath || p === path.resolve(frontendPath)) return true;
                if (p && p.includes(process.cwd())) return false;
                if (p && p.includes('.claudiomiro')) return false;
                return false;
            });

            await expect(cliModule.init([
                '.',
                `--legacy-system=${systemPath}`,
                `--legacy-backend=${backendPath}`,
                `--legacy-frontend=${frontendPath}`,
            ])).rejects.toThrow('process.exit(1)');

            expect(state.setLegacySystems).toHaveBeenCalledWith({
                system: systemPath,
                backend: backendPath,
                frontend: frontendPath,
            });
        });

        test('should exit with error when legacy path does not exist', async () => {
            const legacyPath = '/nonexistent/legacy-system';

            fs.existsSync = jest.fn((p) => {
                if (p === legacyPath || p === path.resolve(legacyPath)) return false;
                if (p && p.includes('.claudiomiro')) return false;
                return true;
            });

            await expect(cliModule.init(['.', `--legacy-system=${legacyPath}`]))
                .rejects.toThrow('process.exit(1)');

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
        });

        test('should filter legacy flags from remaining args', async () => {
            const legacyPath = '/test/legacy-system';

            fs.existsSync = jest.fn((p) => {
                if (p === legacyPath || p === path.resolve(legacyPath)) return true;
                if (p && p.includes(process.cwd())) return false;
                if (p && p.includes('.claudiomiro')) return false;
                return false;
            });

            await expect(cliModule.init(['.', `--legacy-system=${legacyPath}`]))
                .rejects.toThrow('process.exit(1)');

            // The folder should be set to '.' not the legacy path
            expect(state.setFolder).toHaveBeenCalledWith('.');
        });

        test('should be independent from multi-repo mode', async () => {
            const legacyPath = '/test/legacy-system';
            const backendPath = '/test/backend';
            const frontendPath = '/test/frontend';

            fs.existsSync = jest.fn((p) => {
                if (p === legacyPath || p === path.resolve(legacyPath)) return true;
                if (p === backendPath || p === frontendPath) return true;
                if (p && p.includes(process.cwd())) return false;
                if (p && p.includes('.claudiomiro')) return false;
                return false;
            });

            detectGitConfiguration.mockReturnValue({
                mode: 'separate',
                gitRoots: [backendPath, frontendPath],
            });

            await expect(cliModule.init([
                '.',
                `--legacy-system=${legacyPath}`,
                `--backend=${backendPath}`,
                `--frontend=${frontendPath}`,
            ])).rejects.toThrow('process.exit(1)');

            // Both multi-repo and legacy systems should be configured
            expect(state.setMultiRepo).toHaveBeenCalled();
            expect(state.setLegacySystems).toHaveBeenCalledWith({ system: legacyPath });
        });

        test('should log configured legacy systems on success', async () => {
            const legacyPath = '/test/legacy-system';

            fs.existsSync = jest.fn((p) => {
                if (p === legacyPath || p === path.resolve(legacyPath)) return true;
                if (p && p.includes(process.cwd())) return false;
                if (p && p.includes('.claudiomiro')) return false;
                return false;
            });

            await expect(cliModule.init(['.', `--legacy-system=${legacyPath}`]))
                .rejects.toThrow('process.exit(1)');

            expect(logger.info).toHaveBeenCalledWith('Legacy systems configured for reference:');
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('system:'));
        });

        test('should extract path with equals sign correctly', async () => {
            const legacyPath = '/test/path/with=equals/dir';

            fs.existsSync = jest.fn((p) => {
                if (p === legacyPath || p === path.resolve(legacyPath)) return true;
                if (p && p.includes(process.cwd())) return false;
                if (p && p.includes('.claudiomiro')) return false;
                return false;
            });

            await expect(cliModule.init(['.', `--legacy-system=${legacyPath}`]))
                .rejects.toThrow('process.exit(1)');

            expect(state.setLegacySystems).toHaveBeenCalledWith({ system: legacyPath });
        });
    });
});
