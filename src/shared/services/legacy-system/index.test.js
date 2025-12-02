const path = require('path');

describe('legacy-system/index', () => {
    let mockFs;
    let mockState;
    let mockFileFilter;
    let mockContextGenerator;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        // Create mocks
        mockFs = {
            existsSync: jest.fn(),
            readFileSync: jest.fn(),
        };

        mockState = {
            getLegacySystem: jest.fn(),
        };

        mockFileFilter = {
            getFilteredFiles: jest.fn(),
        };

        mockContextGenerator = {
            generateLegacySystemContext: jest.fn(),
        };

        // Apply mocks before requiring the module
        jest.doMock('fs', () => mockFs);
        jest.doMock('../../config/state', () => mockState);
        jest.doMock('./file-filter', () => mockFileFilter);
        jest.doMock('./context-generator', () => mockContextGenerator);
    });

    afterEach(() => {
        jest.resetModules();
    });

    describe('getLegacyFileContent', () => {
        test('should return file content for existing file', () => {
            mockState.getLegacySystem.mockReturnValue('/path/to/legacy');
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue('file content here');

            const { getLegacyFileContent } = require('./index');
            const result = getLegacyFileContent('system', 'src/main.js');

            expect(result).toBe('file content here');
            expect(mockState.getLegacySystem).toHaveBeenCalledWith('system');
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join('/path/to/legacy', 'src/main.js'));
            expect(mockFs.readFileSync).toHaveBeenCalledWith(
                path.join('/path/to/legacy', 'src/main.js'),
                'utf-8',
            );
        });

        test('should return null for unconfigured type', () => {
            mockState.getLegacySystem.mockReturnValue(null);

            const { getLegacyFileContent } = require('./index');
            const result = getLegacyFileContent('backend', 'src/app.js');

            expect(result).toBeNull();
            expect(mockFs.existsSync).not.toHaveBeenCalled();
        });

        test('should return null for non-existent file', () => {
            mockState.getLegacySystem.mockReturnValue('/path/to/legacy');
            mockFs.existsSync.mockReturnValue(false);

            const { getLegacyFileContent } = require('./index');
            const result = getLegacyFileContent('system', 'nonexistent.js');

            expect(result).toBeNull();
            expect(mockFs.readFileSync).not.toHaveBeenCalled();
        });

        test('should return null on read error', () => {
            mockState.getLegacySystem.mockReturnValue('/path/to/legacy');
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const { getLegacyFileContent } = require('./index');
            const result = getLegacyFileContent('system', 'protected.js');

            expect(result).toBeNull();
        });

        test('should correctly join file paths using path.join', () => {
            mockState.getLegacySystem.mockReturnValue('/base/path');
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue('content');

            const { getLegacyFileContent } = require('./index');
            getLegacyFileContent('frontend', 'deep/nested/file.js');

            const expectedPath = path.join('/base/path', 'deep/nested/file.js');
            expect(mockFs.existsSync).toHaveBeenCalledWith(expectedPath);
        });
    });

    describe('getLegacyStructure', () => {
        test('should return filtered file list', () => {
            mockState.getLegacySystem.mockReturnValue('/path/to/legacy');
            mockFileFilter.getFilteredFiles.mockReturnValue(['src/main.js', 'src/utils.js', 'README.md']);

            const { getLegacyStructure } = require('./index');
            const result = getLegacyStructure('backend');

            expect(result).toEqual(['src/main.js', 'src/utils.js', 'README.md']);
            expect(mockState.getLegacySystem).toHaveBeenCalledWith('backend');
            expect(mockFileFilter.getFilteredFiles).toHaveBeenCalledWith('/path/to/legacy');
        });

        test('should return empty array for unconfigured type', () => {
            mockState.getLegacySystem.mockReturnValue(null);

            const { getLegacyStructure } = require('./index');
            const result = getLegacyStructure('system');

            expect(result).toEqual([]);
            expect(mockFileFilter.getFilteredFiles).not.toHaveBeenCalled();
        });
    });

    describe('re-exports', () => {
        test('should properly re-export generateLegacySystemContext', () => {
            mockContextGenerator.generateLegacySystemContext.mockReturnValue('mock context');

            const { generateLegacySystemContext } = require('./index');

            expect(generateLegacySystemContext).toBe(mockContextGenerator.generateLegacySystemContext);
        });
    });
});
