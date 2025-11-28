const { run, showHelp, showVersion, COMMANDS, GLOBAL_OPTIONS } = require('./index');

describe('help command', () => {
    let consoleLogSpy;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    describe('run', () => {
        test('should show help when called without version flags', async () => {
            await run([]);

            expect(consoleLogSpy).toHaveBeenCalled();

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('Claudiomiro');
            expect(output).toContain('USAGE');
            expect(output).toContain('COMMANDS');
        });

        test('should show version when -v flag is passed', async () => {
            await run(['-v']);

            expect(consoleLogSpy).toHaveBeenCalled();

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toMatch(/claudiomiro v\d+\.\d+\.\d+/);
        });

        test('should show version when --version flag is passed', async () => {
            await run(['--version']);

            expect(consoleLogSpy).toHaveBeenCalled();

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toMatch(/claudiomiro v\d+\.\d+\.\d+/);
        });

        test('should show help when --help flag is passed', async () => {
            await run(['--help']);

            expect(consoleLogSpy).toHaveBeenCalled();

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('USAGE');
            expect(output).toContain('COMMANDS');
        });
    });

    describe('showHelp', () => {
        test('should display header with version', () => {
            showHelp();

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('Claudiomiro');
            expect(output).toMatch(/v\d+\.\d+\.\d+/);
        });

        test('should display usage section', () => {
            showHelp();

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('USAGE');
            expect(output).toContain('claudiomiro [command] [options]');
        });

        test('should display commands section', () => {
            showHelp();

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('COMMANDS');
            expect(output).toContain('--fix-command');
            expect(output).toContain('--loop-fixes');
            expect(output).toContain('--fix-branch');
        });

        test('should display global options section', () => {
            showHelp();

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('GLOBAL OPTIONS');
            expect(output).toContain('--help');
            expect(output).toContain('--version');
        });

        test('should display examples section', () => {
            showHelp();

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('EXAMPLES');
            expect(output).toContain('npm test');
        });

        test('should display fix-branch level examples', () => {
            showHelp();

            const output = consoleLogSpy.mock.calls.map(call => call[0] || '').join('\n');
            expect(output).toContain('--fix-branch');
            expect(output).toContain('--level=2');
            expect(output).toContain('--level=3');
        });
    });

    describe('showVersion', () => {
        test('should display version in correct format', () => {
            showVersion();

            expect(consoleLogSpy).toHaveBeenCalledTimes(1);

            const output = consoleLogSpy.mock.calls[0][0];
            expect(output).toMatch(/^claudiomiro v\d+\.\d+\.\d+$/);
        });
    });

    describe('COMMANDS constant', () => {
        test('should have at least 3 commands defined', () => {
            expect(COMMANDS.length).toBeGreaterThanOrEqual(3);
        });

        test('should have name and description for each command', () => {
            for (const cmd of COMMANDS) {
                expect(cmd.name).toBeDefined();
                expect(typeof cmd.name).toBe('string');
                expect(cmd.description).toBeDefined();
                expect(typeof cmd.description).toBe('string');
            }
        });

        test('should have task-executor command', () => {
            const taskExecutor = COMMANDS.find(cmd => cmd.name.includes('claudiomiro [folder]'));
            expect(taskExecutor).toBeDefined();
        });

        test('should have fix-command command', () => {
            const fixCommand = COMMANDS.find(cmd => cmd.name.includes('--fix-command'));
            expect(fixCommand).toBeDefined();
        });

        test('should have loop-fixes command', () => {
            const loopFixes = COMMANDS.find(cmd => cmd.name.includes('--loop-fixes'));
            expect(loopFixes).toBeDefined();
        });

        test('should have fix-branch command', () => {
            const fixBranch = COMMANDS.find(cmd => cmd.name.includes('--fix-branch'));
            expect(fixBranch).toBeDefined();
            expect(fixBranch.description).toContain('code review');
        });

        test('should have fix-branch --level option', () => {
            const fixBranch = COMMANDS.find(cmd => cmd.name.includes('--fix-branch'));
            const levelOption = fixBranch.options.find(opt => opt.flag.includes('--level'));
            expect(levelOption).toBeDefined();
            expect(levelOption.description).toContain('blockers');
            expect(levelOption.description).toContain('warnings');
            expect(levelOption.description).toContain('suggestions');
        });

        test('should have fix-branch --blockers-only option', () => {
            const fixBranch = COMMANDS.find(cmd => cmd.name.includes('--fix-branch'));
            const blockersOnlyOption = fixBranch.options.find(opt => opt.flag.includes('--blockers-only'));
            expect(blockersOnlyOption).toBeDefined();
            expect(blockersOnlyOption.description).toContain('level=1');
        });

        test('should have fix-branch --no-suggestions option', () => {
            const fixBranch = COMMANDS.find(cmd => cmd.name.includes('--fix-branch'));
            const noSuggestionsOption = fixBranch.options.find(opt => opt.flag.includes('--no-suggestions'));
            expect(noSuggestionsOption).toBeDefined();
            expect(noSuggestionsOption.description).toContain('level=2');
        });

        test('should have test-local-llm command', () => {
            const testLocalLlm = COMMANDS.find(cmd => cmd.name.includes('--test-local-llm'));
            expect(testLocalLlm).toBeDefined();
            expect(testLocalLlm.description).toContain('Local LLM');
            expect(testLocalLlm.description).toContain('Ollama');
        });

        test('should have test-local-llm --prompt option', () => {
            const testLocalLlm = COMMANDS.find(cmd => cmd.name.includes('--test-local-llm'));
            const promptOption = testLocalLlm.options.find(opt => opt.flag.includes('--prompt'));
            expect(promptOption).toBeDefined();
        });

        test('should have config command', () => {
            const configCmd = COMMANDS.find(cmd => cmd.name.includes('--config'));
            expect(configCmd).toBeDefined();
            expect(configCmd.description).toContain('configuration');
        });

        test('should have config KEY=VALUE option', () => {
            const configCmd = COMMANDS.find(cmd => cmd.name.includes('--config'));
            const keyValueOption = configCmd.options.find(opt => opt.flag.includes('KEY=VALUE'));
            expect(keyValueOption).toBeDefined();
        });
    });

    describe('GLOBAL_OPTIONS constant', () => {
        test('should have help option', () => {
            const helpOption = GLOBAL_OPTIONS.find(opt => opt.flag.includes('--help'));
            expect(helpOption).toBeDefined();
            expect(helpOption.description).toBeDefined();
        });

        test('should have version option', () => {
            const versionOption = GLOBAL_OPTIONS.find(opt => opt.flag.includes('--version'));
            expect(versionOption).toBeDefined();
            expect(versionOption.description).toBeDefined();
        });
    });
});
