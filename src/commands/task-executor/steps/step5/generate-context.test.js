const fs = require('fs');

jest.mock('fs');
jest.mock('../../../../shared/config/state', () => ({
    claudiomiroFolder: '/test/.claudiomiro/task-executor',
}));

// Import after mocks
const { generateContextFile } = require('./generate-context');

describe('generate-context', () => {
    const mockTask = 'TASK1';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateContextFile', () => {
        test('should skip if TODO.md does not exist', async () => {
            fs.existsSync.mockReturnValue(false);

            await generateContextFile(mockTask);

            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should skip if task is not fully implemented', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('Fully implemented: NO\n\nSome content');

            await generateContextFile(mockTask);

            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should generate CONTEXT.md when task is fully implemented', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if(filePath.includes('TODO.md')) return true;
                if(filePath.includes('info.json')) return true;
                if(filePath.includes('context.md') && filePath.includes('templates')) return true;
                return false;
            });

            const todoContent = 'Fully implemented: YES\n\n## Implementation\n- Modified `src/test.js`';
            const infoContent = JSON.stringify({ attempts: 2 });
            const templateContent = '# Context for {{task}}\n\n## Quick Reference\n**Status:** ✅ Completed\n**Attempts:** {{attempts}}';

            fs.readFileSync.mockImplementation((filePath) => {
                if(filePath.includes('TODO.md')) return todoContent;
                if(filePath.includes('info.json')) return infoContent;
                if(filePath.includes('context.md') && filePath.includes('templates')) return templateContent;
                return '';
            });

            await generateContextFile(mockTask);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('CONTEXT.md'),
                expect.stringContaining('# Context for TASK1'),
                'utf8',
            );
        });

        test('should extract modified files from TODO.md', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if(filePath.includes('TODO.md')) return true;
                if(filePath.includes('info.json')) return false;
                if(filePath.includes('context.md') && filePath.includes('templates')) return true;
                return false;
            });

            const todoContent = 'Fully implemented: YES\n\n- Modified `src/services/test-service.js`\n- Created `src/utils/helper.js`';
            const templateContent = '# Context for {{task}}\n\n{{modifiedFilesList}}';

            fs.readFileSync.mockImplementation((filePath) => {
                if(filePath.includes('TODO.md')) return todoContent;
                if(filePath.includes('context.md') && filePath.includes('templates')) return templateContent;
                return '';
            });

            await generateContextFile(mockTask);

            const writeCall = fs.writeFileSync.mock.calls[0];
            const contextContent = writeCall[1];

            expect(contextContent).toContain('src/services/test-service.js');
            expect(contextContent).toContain('src/utils/helper.js');
        });

        test('should include RESEARCH.md strategy if available', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if(filePath.includes('TODO.md')) return true;
                if(filePath.includes('RESEARCH.md')) return true;
                if(filePath.includes('context.md') && filePath.includes('templates')) return true;
                return false;
            });

            const todoContent = 'Fully implemented: YES';
            const researchContent = '## Execution Strategy\n- Step 1: Do this\n- Step 2: Do that';
            const templateContent = '# Context for {{task}}';

            fs.readFileSync.mockImplementation((filePath) => {
                if(filePath.includes('TODO.md')) return todoContent;
                if(filePath.includes('RESEARCH.md')) return researchContent;
                if(filePath.includes('context.md') && filePath.includes('templates')) return templateContent;
                return '';
            });

            await generateContextFile(mockTask);

            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        test('should handle missing info.json gracefully', async () => {
            fs.existsSync.mockImplementation((filePath) => {
                if(filePath.includes('TODO.md')) return true;
                if(filePath.includes('info.json')) return false;
                if(filePath.includes('context.md') && filePath.includes('templates')) return true;
                return false;
            });

            const todoContent = 'Fully implemented: YES';
            const templateContent = '# Context for {{task}}\n\n**Attempts:** {{attempts}}';

            fs.readFileSync.mockImplementation((filePath) => {
                if(filePath.includes('TODO.md')) return todoContent;
                if(filePath.includes('context.md') && filePath.includes('templates')) return templateContent;
                return '';
            });

            await generateContextFile(mockTask);

            const writeCall = fs.writeFileSync.mock.calls[0];
            const contextContent = writeCall[1];

            expect(contextContent).toContain('**Attempts:** 1');
        });
    });
});
