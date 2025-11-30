/**
 * Config Command Tests
 * Self-contained tests following Claudiomiro conventions
 */

const path = require('path');

// Mock fs before requiring the module
jest.mock('fs');
jest.mock('@inquirer/prompts');

const fs = require('fs');
const { select, input, confirm } = require('@inquirer/prompts');

const {
    run,
    loadConfig,
    saveConfig,
    applyConfigToEnv,
    ensureConfigDir,
    migrateLegacyConfig,
    CONFIG_FILE,
    CONFIG_DIR,
    LEGACY_CONFIG_FILE,
    CONFIG_SCHEMA,
} = require('./index');

describe('config command', () => {
    let consoleLogSpy;
    let originalEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        originalEnv = { ...process.env };

        // Default fs mocks
        fs.existsSync.mockReturnValue(false);
        fs.readFileSync.mockReturnValue('{}');
        fs.writeFileSync.mockImplementation();
        fs.unlinkSync.mockImplementation();
        fs.mkdirSync.mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        process.env = originalEnv;
    });

    describe('CONFIG_FILE and CONFIG_DIR', () => {
        test('should use user home directory for config', () => {
            const os = require('os');
            expect(CONFIG_DIR).toBe(path.join(os.homedir(), '.claudiomiro'));
            expect(CONFIG_FILE).toBe(path.join(CONFIG_DIR, 'config.json'));
        });

        test('should define legacy config path for migration', () => {
            expect(LEGACY_CONFIG_FILE).toContain('claudiomiro.config.json');
        });
    });

    describe('ensureConfigDir', () => {
        test('should create config directory if it does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            ensureConfigDir();

            expect(fs.mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
        });

        test('should not create directory if it already exists', () => {
            fs.existsSync.mockReturnValue(true);

            ensureConfigDir();

            expect(fs.mkdirSync).not.toHaveBeenCalled();
        });
    });

    describe('migrateLegacyConfig', () => {
        test('should migrate legacy config when it exists and new config does not', () => {
            // Legacy exists, new does not
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath === LEGACY_CONFIG_FILE) return true;
                if (filePath === CONFIG_FILE) return false;
                if (filePath === CONFIG_DIR) return true;
                return false;
            });
            fs.readFileSync.mockReturnValue('{"CLAUDIOMIRO_LOCAL_LLM": "old-model"}');

            const result = migrateLegacyConfig();

            expect(result).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                CONFIG_FILE,
                '{"CLAUDIOMIRO_LOCAL_LLM": "old-model"}',
            );
            expect(fs.unlinkSync).toHaveBeenCalledWith(LEGACY_CONFIG_FILE);
        });

        test('should not migrate if new config already exists', () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath === LEGACY_CONFIG_FILE) return true;
                if (filePath === CONFIG_FILE) return true;
                return false;
            });

            const result = migrateLegacyConfig();

            expect(result).toBe(false);
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should not migrate if legacy config does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = migrateLegacyConfig();

            expect(result).toBe(false);
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should handle migration errors gracefully', () => {
            fs.existsSync.mockImplementation((filePath) => {
                if (filePath === LEGACY_CONFIG_FILE) return true;
                if (filePath === CONFIG_FILE) return false;
                return false;
            });
            fs.readFileSync.mockImplementation(() => {
                throw new Error('Read error');
            });

            const result = migrateLegacyConfig();

            expect(result).toBe(false);
        });
    });

    describe('CONFIG_SCHEMA', () => {
        test('should define CLAUDIOMIRO_LOCAL_LLM', () => {
            expect(CONFIG_SCHEMA.CLAUDIOMIRO_LOCAL_LLM).toBeDefined();
            expect(CONFIG_SCHEMA.CLAUDIOMIRO_LOCAL_LLM.name).toBe('Local LLM Model');
        });

        test('should define OLLAMA_HOST', () => {
            expect(CONFIG_SCHEMA.OLLAMA_HOST).toBeDefined();
            expect(CONFIG_SCHEMA.OLLAMA_HOST.default).toBe('localhost');
        });

        test('should define OLLAMA_PORT', () => {
            expect(CONFIG_SCHEMA.OLLAMA_PORT).toBeDefined();
            expect(CONFIG_SCHEMA.OLLAMA_PORT.default).toBe('11434');
        });

        test('should define CLAUDIOMIRO_EXECUTOR', () => {
            expect(CONFIG_SCHEMA.CLAUDIOMIRO_EXECUTOR).toBeDefined();
            expect(CONFIG_SCHEMA.CLAUDIOMIRO_EXECUTOR.choices).toContain('claude');
        });
    });

    describe('loadConfig', () => {
        test('should return empty object when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const config = loadConfig();

            expect(config).toEqual({});
        });

        test('should return parsed config when file exists', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('{"CLAUDIOMIRO_LOCAL_LLM": "qwen2.5-coder:7b"}');

            const config = loadConfig();

            expect(config).toEqual({ CLAUDIOMIRO_LOCAL_LLM: 'qwen2.5-coder:7b' });
        });

        test('should return empty object on parse error', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('invalid json');

            const config = loadConfig();

            expect(config).toEqual({});
        });
    });

    describe('saveConfig', () => {
        test('should create config directory and write config as JSON', () => {
            fs.existsSync.mockReturnValue(false);

            saveConfig({ CLAUDIOMIRO_LOCAL_LLM: 'test' });

            expect(fs.mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                CONFIG_FILE,
                JSON.stringify({ CLAUDIOMIRO_LOCAL_LLM: 'test' }, null, 2),
            );
        });

        test('should not recreate directory if it already exists', () => {
            fs.existsSync.mockReturnValue(true);

            saveConfig({ CLAUDIOMIRO_LOCAL_LLM: 'test' });

            expect(fs.mkdirSync).not.toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalled();
        });
    });

    describe('applyConfigToEnv', () => {
        test('should set environment variables from config', () => {
            applyConfigToEnv({
                CLAUDIOMIRO_LOCAL_LLM: 'qwen2.5-coder:7b',
                OLLAMA_HOST: 'remote-host',
            });

            expect(process.env.CLAUDIOMIRO_LOCAL_LLM).toBe('qwen2.5-coder:7b');
            expect(process.env.OLLAMA_HOST).toBe('remote-host');
        });

        test('should skip empty values', () => {
            delete process.env.CLAUDIOMIRO_LOCAL_LLM;

            applyConfigToEnv({
                CLAUDIOMIRO_LOCAL_LLM: '',
                OLLAMA_HOST: 'localhost',
            });

            expect(process.env.CLAUDIOMIRO_LOCAL_LLM).toBeUndefined();
            expect(process.env.OLLAMA_HOST).toBe('localhost');
        });

        test('should convert numbers to strings', () => {
            applyConfigToEnv({
                OLLAMA_PORT: 8080,
            });

            expect(process.env.OLLAMA_PORT).toBe('8080');
        });
    });

    describe('run', () => {
        test('should display header', async () => {
            select.mockResolvedValueOnce('exit');

            await run([]);

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('Claudiomiro Configuration');
            expect(output).toContain('config.json');
        });

        test('should handle quick set via args', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('{}');

            await run(['CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b']);

            expect(fs.writeFileSync).toHaveBeenCalled();
            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('Set CLAUDIOMIRO_LOCAL_LLM=qwen2.5-coder:7b');
        });

        test('should view configuration', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('{"CLAUDIOMIRO_LOCAL_LLM": "test-model"}');

            select.mockResolvedValueOnce('view');
            select.mockResolvedValueOnce('exit');

            await run([]);

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('Current Configuration');
            expect(output).toContain('test-model');
        });

        test('should export configuration', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('{"CLAUDIOMIRO_LOCAL_LLM": "qwen2.5-coder:7b"}');

            select.mockResolvedValueOnce('export');
            select.mockResolvedValueOnce('exit');

            await run([]);

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('Export Configuration');
            expect(output).toContain('export CLAUDIOMIRO_LOCAL_LLM=');
        });

        test('should reset configuration', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('{"CLAUDIOMIRO_LOCAL_LLM": "test"}');

            select.mockResolvedValueOnce('reset');
            confirm.mockResolvedValueOnce(true);
            select.mockResolvedValueOnce('exit');

            await run([]);

            expect(fs.unlinkSync).toHaveBeenCalledWith(CONFIG_FILE);
        });

        test('should not reset if not confirmed', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('{"CLAUDIOMIRO_LOCAL_LLM": "test"}');

            select.mockResolvedValueOnce('reset');
            confirm.mockResolvedValueOnce(false);
            select.mockResolvedValueOnce('exit');

            await run([]);

            expect(fs.unlinkSync).not.toHaveBeenCalled();
        });

        test('should edit configuration', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('{}');

            select.mockResolvedValueOnce('edit'); // Main menu -> edit
            select.mockResolvedValueOnce('CLAUDIOMIRO_LOCAL_LLM'); // Edit menu -> select key
            input.mockResolvedValueOnce('new-model'); // Enter value
            select.mockResolvedValueOnce('back'); // Edit menu -> back
            select.mockResolvedValueOnce('exit'); // Main menu -> exit

            await run([]);

            expect(fs.writeFileSync).toHaveBeenCalled();
            const savedConfig = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(savedConfig.CLAUDIOMIRO_LOCAL_LLM).toBe('new-model');
        });

        test('should handle Ctrl+C gracefully', async () => {
            const exitError = new Error('User force closed the prompt');
            exitError.name = 'ExitPromptError';

            select.mockRejectedValueOnce(exitError);

            await run([]);

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('Goodbye');
        });
    });
});
