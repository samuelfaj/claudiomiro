const { checkForUpdates, checkForUpdatesAsync, getCurrentVersion, getLatestVersion } = require('./auto-update');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('./logger', () => ({
    newline: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
}));

const logger = require('./logger');

describe('auto-update', () => {
    const mockPackageName = 'claudiomiro';
    const mockCurrentVersion = '1.8.7';
    const mockLatestVersion = '2.0.0';

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock fs.readFileSync to return a mock package.json
        fs.readFileSync.mockReturnValue(JSON.stringify({
            version: mockCurrentVersion,
        }));
    });

    describe('getCurrentVersion', () => {
        test('should read and return current version from package.json', () => {
            // Arrange
            const expectedPath = path.join(__dirname, '..', '..', 'package.json');

            // Act
            const version = getCurrentVersion();

            // Assert
            expect(version).toBe(mockCurrentVersion);
            expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf-8');
        });

        test('should handle package.json with different version format', () => {
            // Arrange
            fs.readFileSync.mockReturnValue(JSON.stringify({
                version: '0.0.1-beta',
            }));

            // Act
            const version = getCurrentVersion();

            // Assert
            expect(version).toBe('0.0.1-beta');
        });
    });

    describe('getLatestVersion', () => {
        test('should return latest version from npm', async () => {
            // Arrange
            execSync.mockReturnValue('  2.0.0\n  ');

            // Act
            const version = await getLatestVersion(mockPackageName);

            // Assert
            expect(version).toBe('2.0.0');
            expect(execSync).toHaveBeenCalledWith(
                `npm view ${mockPackageName} version`,
                {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                },
            );
        });

        test('should return null when npm command fails', async () => {
            // Arrange
            execSync.mockImplementation(() => {
                throw new Error('npm command failed');
            });

            // Act
            const version = await getLatestVersion(mockPackageName);

            // Assert
            expect(version).toBeNull();
        });

        test('should trim whitespace from npm output', async () => {
            // Arrange
            execSync.mockReturnValue('\n\n  3.5.1  \n\n');

            // Act
            const version = await getLatestVersion('test-package');

            // Assert
            expect(version).toBe('3.5.1');
        });
    });

    describe('checkForUpdates', () => {
        test('should return update available when versions differ', async () => {
            // Arrange
            execSync.mockReturnValue(mockLatestVersion);

            // Act
            const result = await checkForUpdates(mockPackageName);

            // Assert
            expect(result).toEqual({
                updateAvailable: true,
                currentVersion: mockCurrentVersion,
                latestVersion: mockLatestVersion,
            });
        });

        test('should show warning message when update is available and not silent', async () => {
            // Arrange
            execSync.mockReturnValue(mockLatestVersion);

            // Act
            await checkForUpdates(mockPackageName, { silent: false });

            // Assert
            expect(logger.newline).toHaveBeenCalled();
            expect(logger.warning).toHaveBeenCalled();
            expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining('Update available'));
            expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining(`${mockCurrentVersion} → ${mockLatestVersion}`));
        });

        test('should not show warning message when silent option is true', async () => {
            // Arrange
            execSync.mockReturnValue(mockLatestVersion);

            // Act
            await checkForUpdates(mockPackageName, { silent: true });

            // Assert
            expect(logger.newline).not.toHaveBeenCalled();
            expect(logger.warning).not.toHaveBeenCalled();
        });

        test('should return no update when versions are the same', async () => {
            // Arrange
            execSync.mockReturnValue(mockCurrentVersion);

            // Act
            const result = await checkForUpdates(mockPackageName);

            // Assert
            expect(result).toEqual({
                updateAvailable: false,
                currentVersion: mockCurrentVersion,
                latestVersion: mockCurrentVersion,
            });
        });

        test('should return no update when latest version is null', async () => {
            // Arrange
            execSync.mockImplementation(() => {
                throw new Error('npm command failed');
            });

            // Act
            const result = await checkForUpdates(mockPackageName);

            // Assert
            expect(result).toEqual({
                updateAvailable: false,
                currentVersion: mockCurrentVersion,
                latestVersion: null,
            });
        });

        test('should auto-update when autoUpdate option is true', async () => {
            // Arrange
            execSync
                .mockReturnValueOnce(mockLatestVersion) // For getLatestVersion
                .mockReturnValueOnce(undefined); // For npm install

            const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

            // Act
            await checkForUpdates(mockPackageName, { autoUpdate: true });

            // Assert
            expect(execSync).toHaveBeenCalledWith(
                `npm install -g ${mockPackageName}@latest`,
                { stdio: 'inherit' },
            );
            expect(logger.success).toHaveBeenCalledWith(`Successfully updated to version ${mockLatestVersion}`);
            expect(logger.info).toHaveBeenCalledWith('Please restart the command.');
            expect(mockExit).toHaveBeenCalledWith(0);

            mockExit.mockRestore();
        });

        test('should handle auto-update failure gracefully', async () => {
            // Arrange
            execSync
                .mockReturnValueOnce(mockLatestVersion) // For getLatestVersion
                .mockImplementationOnce(() => {
                    throw new Error('npm install failed');
                });

            const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

            // Act
            await checkForUpdates(mockPackageName, { autoUpdate: true });

            // Assert
            expect(logger.error).toHaveBeenCalledWith('Failed to auto-update. Please update manually.');
            expect(mockExit).not.toHaveBeenCalled();

            mockExit.mockRestore();
        });

        test('should handle errors gracefully and return error info', async () => {
            // Arrange
            execSync.mockImplementation(() => {
                throw new Error('npm command failed');
            });

            // Act
            const result = await checkForUpdates(mockPackageName);

            // Assert
            expect(result.updateAvailable).toBe(false);
            expect(result.latestVersion).toBeNull();
        });

        test('should use default package name when not provided', async () => {
            // Arrange
            execSync.mockReturnValue(mockLatestVersion);

            // Act
            await checkForUpdates();

            // Assert
            expect(execSync).toHaveBeenCalledWith(
                'npm view claudiomiro version',
                expect.any(Object),
            );
        });
    });

    describe('checkForUpdatesAsync', () => {
        test('should execute checkForUpdates asynchronously without blocking', async () => {
            // Arrange
            execSync.mockReturnValue(mockLatestVersion);

            // Act
            checkForUpdatesAsync(mockPackageName);

            // Assert - Should not throw and should not block
            expect(() => checkForUpdatesAsync(mockPackageName)).not.toThrow();

            // Wait for promise to resolve in background
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify the update check was called
            expect(execSync).toHaveBeenCalled();
        });

        test('should not throw error when check fails', async () => {
            // Arrange
            execSync.mockImplementation(() => {
                throw new Error('Network error');
            });

            // Act & Assert - Should not throw even when npm command fails
            expect(() => checkForUpdatesAsync(mockPackageName)).not.toThrow();

            // Wait for promise to resolve in background
            await new Promise(resolve => setTimeout(resolve, 100));
        });

        test('should use default options when not provided', async () => {
            // Arrange
            execSync.mockReturnValue(mockCurrentVersion);

            // Act & Assert - Should not throw
            expect(() => checkForUpdatesAsync()).not.toThrow();

            // Wait for promise to resolve in background
            await new Promise(resolve => setTimeout(resolve, 100));
        });

        test('should silently catch errors and not crash', async () => {
            // Arrange
            fs.readFileSync.mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            // Act & Assert
            expect(() => checkForUpdatesAsync(mockPackageName)).not.toThrow();

            // Wait for promise to resolve in background
            await new Promise(resolve => setTimeout(resolve, 100));

            // The function should have silently caught the error
        });
    });
});
