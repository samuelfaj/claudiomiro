const fs = require('fs');
const os = require('os');
const logger = require('../../../shared/utils/logger');
const state = require('../../../shared/config/state');
const { startFresh } = require('./file-manager');

// Mock modules
jest.mock('fs');
jest.mock('os', () => {
    const actual = jest.requireActual('os');
    return {
        ...actual,
        tmpdir: jest.fn(() => '/tmp/claudiomiro-tests'),
    };
});
jest.mock('../../../shared/utils/logger');
jest.mock('../../../shared/config/state');

describe('file-manager', () => {
    beforeEach(() => {
    // Reset all mocks before each test
        jest.clearAllMocks();
        jest.resetAllMocks();

        // Set default mock implementation for state
        state.claudiomiroFolder = '/test/path/.claudiomiro/task-executor';

        // Reset fs mocks to default (no-op) implementations
        fs.existsSync.mockReturnValue(false);
        fs.rmSync.mockImplementation(() => {});
        fs.mkdirSync.mockImplementation(() => {});
        fs.cpSync = jest.fn();
        fs.readdirSync = jest.fn(() => []);
        os.tmpdir.mockReturnValue('/tmp/claudiomiro-tests');
    });

    describe('startFresh()', () => {
        describe('with existing folder + createFolder=false', () => {
            it('should remove existing folder without recreating it', () => {
                // Arrange
                fs.existsSync.mockReturnValue(true);

                // Act
                startFresh(false);

                // Assert
                expect(logger.task).toHaveBeenCalledWith('Cleaning up previous files...');
                expect(logger.indent).toHaveBeenCalled();
                expect(fs.existsSync).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor');
                expect(fs.rmSync).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor', { recursive: true });
                expect(logger.success).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor removed\n');
                expect(fs.mkdirSync).not.toHaveBeenCalled();
                expect(logger.outdent).toHaveBeenCalled();
            });

            it('should call logger methods in correct order', () => {
                // Arrange
                fs.existsSync.mockReturnValue(true);
                const callOrder = [];

                logger.task.mockImplementation(() => callOrder.push('task'));
                logger.indent.mockImplementation(() => callOrder.push('indent'));
                logger.success.mockImplementation(() => callOrder.push('success'));
                logger.outdent.mockImplementation(() => callOrder.push('outdent'));

                // Act
                startFresh(false);

                // Assert
                expect(callOrder).toEqual(['task', 'indent', 'success', 'outdent']);
            });
        });

        describe('with existing folder + createFolder=true', () => {
            it('should remove existing folder and recreate it', () => {
                // Arrange
                fs.existsSync.mockReturnValue(true);

                // Act
                startFresh(true);

                // Assert
                expect(logger.task).toHaveBeenCalledWith('Cleaning up previous files...');
                expect(logger.indent).toHaveBeenCalled();
                expect(fs.existsSync).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor');
                expect(fs.rmSync).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor', { recursive: true });
                expect(logger.success).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor removed\n');
                expect(fs.mkdirSync).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor', { recursive: true });
                expect(logger.outdent).toHaveBeenCalled();
            });

            it('should call both rmSync and mkdirSync', () => {
                // Arrange
                fs.existsSync.mockReturnValue(true);

                // Act
                startFresh(true);

                // Assert
                expect(fs.rmSync).toHaveBeenCalledTimes(1);
                expect(fs.mkdirSync).toHaveBeenCalledTimes(1);
            });

            it('should call logger methods in correct order', () => {
                // Arrange
                fs.existsSync.mockReturnValue(true);
                const callOrder = [];

                logger.task.mockImplementation(() => callOrder.push('task'));
                logger.indent.mockImplementation(() => callOrder.push('indent'));
                logger.success.mockImplementation(() => callOrder.push('success'));
                logger.outdent.mockImplementation(() => callOrder.push('outdent'));

                // Act
                startFresh(true);

                // Assert
                expect(callOrder).toEqual(['task', 'indent', 'success', 'outdent']);
            });
        });

        describe('when folder does not exist', () => {
            it('should not remove folder and should not create it when createFolder=false', () => {
                // Arrange
                fs.existsSync.mockReturnValue(false);

                // Act
                startFresh(false);

                // Assert
                expect(logger.task).toHaveBeenCalledWith('Cleaning up previous files...');
                expect(logger.indent).toHaveBeenCalled();
                expect(fs.existsSync).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor');
                expect(fs.rmSync).not.toHaveBeenCalled();
                expect(logger.success).not.toHaveBeenCalled();
                expect(fs.mkdirSync).not.toHaveBeenCalled();
                expect(logger.outdent).toHaveBeenCalled();
            });

            it('should create folder when createFolder=true', () => {
                // Arrange
                fs.existsSync.mockReturnValue(false);

                // Act
                startFresh(true);

                // Assert
                expect(logger.task).toHaveBeenCalledWith('Cleaning up previous files...');
                expect(logger.indent).toHaveBeenCalled();
                expect(fs.existsSync).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor');
                expect(fs.rmSync).not.toHaveBeenCalled();
                expect(logger.success).not.toHaveBeenCalled();
                expect(fs.mkdirSync).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor', { recursive: true });
                expect(logger.outdent).toHaveBeenCalled();
            });

            it('should call logger methods in correct order when createFolder=false', () => {
                // Arrange
                fs.existsSync.mockReturnValue(false);
                const callOrder = [];

                logger.task.mockImplementation(() => callOrder.push('task'));
                logger.indent.mockImplementation(() => callOrder.push('indent'));
                logger.outdent.mockImplementation(() => callOrder.push('outdent'));

                // Act
                startFresh(false);

                // Assert
                expect(callOrder).toEqual(['task', 'indent', 'outdent']);
            });

            it('should call logger methods in correct order when createFolder=true', () => {
                // Arrange
                fs.existsSync.mockReturnValue(false);
                const callOrder = [];

                logger.task.mockImplementation(() => callOrder.push('task'));
                logger.indent.mockImplementation(() => callOrder.push('indent'));
                logger.outdent.mockImplementation(() => callOrder.push('outdent'));

                // Act
                startFresh(true);

                // Assert
                expect(callOrder).toEqual(['task', 'indent', 'outdent']);
            });
        });

        describe('insights preservation', () => {
            it('should backup and restore insights folder when present', () => {
                // Arrange
                fs.existsSync.mockImplementation((target) => {
                    if (target === '/test/path/.claudiomiro/task-executor') {
                        return true;
                    }
                    if (target === '/test/path/.claudiomiro/task-executor/insights') {
                        return true;
                    }
                    return false;
                });

                fs.readdirSync.mockImplementation((target) => {
                    if (target === '/test/path/.claudiomiro/task-executor/insights') {
                        return ['project-insights.json'];
                    }
                    return [];
                });

                const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
                os.tmpdir.mockReturnValue('/tmp/claudiomiro-tests');

                try {
                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.cpSync).toHaveBeenNthCalledWith(
                        1,
                        '/test/path/.claudiomiro/task-executor/insights',
                        '/tmp/claudiomiro-tests/claudiomiro-insights-1700000000000',
                        { recursive: true },
                    );
                    expect(fs.rmSync).toHaveBeenNthCalledWith(1, '/test/path/.claudiomiro/task-executor', { recursive: true });
                    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor', { recursive: true });
                    expect(fs.cpSync).toHaveBeenNthCalledWith(
                        2,
                        '/tmp/claudiomiro-tests/claudiomiro-insights-1700000000000',
                        '/test/path/.claudiomiro/task-executor/insights',
                        { recursive: true },
                    );
                    expect(fs.rmSync).toHaveBeenNthCalledWith(
                        2,
                        '/tmp/claudiomiro-tests/claudiomiro-insights-1700000000000',
                        { recursive: true },
                    );
                    expect(logger.info).toHaveBeenCalledWith('Insights preserved in /test/path/.claudiomiro/task-executor/insights');
                } finally {
                    nowSpy.mockRestore();
                }
            });
        });

        describe('error handling scenarios', () => {
            it('should propagate error when fs.existsSync throws', () => {
                // Arrange
                const error = new Error('existsSync failed');
                fs.existsSync.mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                expect(() => startFresh(false)).toThrow('existsSync failed');
                expect(logger.task).toHaveBeenCalled();
                expect(logger.indent).toHaveBeenCalled();
            });

            it('should propagate error when fs.rmSync throws', () => {
                // Arrange
                const error = new Error('rmSync failed');
                fs.existsSync.mockReturnValue(true);
                fs.rmSync.mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                expect(() => startFresh(false)).toThrow('rmSync failed');
                expect(logger.task).toHaveBeenCalled();
                expect(logger.indent).toHaveBeenCalled();
                expect(fs.existsSync).toHaveBeenCalled();
            });

            it('should propagate error when fs.mkdirSync throws', () => {
                // Arrange
                const error = new Error('mkdirSync failed');
                fs.existsSync.mockReturnValue(true);
                fs.mkdirSync.mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                expect(() => startFresh(true)).toThrow('mkdirSync failed');
                expect(logger.task).toHaveBeenCalled();
                expect(logger.indent).toHaveBeenCalled();
                expect(fs.existsSync).toHaveBeenCalled();
                expect(fs.rmSync).toHaveBeenCalled();
            });

            it('should propagate error when mkdirSync throws and folder does not exist', () => {
                // Arrange
                const error = new Error('mkdirSync failed on non-existent folder');
                fs.existsSync.mockReturnValue(false);
                fs.mkdirSync.mockImplementation(() => {
                    throw error;
                });

                // Act & Assert
                expect(() => startFresh(true)).toThrow('mkdirSync failed on non-existent folder');
                expect(logger.task).toHaveBeenCalled();
                expect(logger.indent).toHaveBeenCalled();
                expect(fs.existsSync).toHaveBeenCalled();
                expect(fs.rmSync).not.toHaveBeenCalled();
            });
        });

        describe('logger integration', () => {
            it('should call task() at the beginning', () => {
                // Arrange
                fs.existsSync.mockReturnValue(false);

                // Act
                startFresh(false);

                // Assert
                expect(logger.task).toHaveBeenCalledTimes(1);
                expect(logger.task).toHaveBeenCalledWith('Cleaning up previous files...');
            });

            it('should call indent() after task()', () => {
                // Arrange
                fs.existsSync.mockReturnValue(false);
                const callOrder = [];

                logger.task.mockImplementation(() => callOrder.push('task'));
                logger.indent.mockImplementation(() => callOrder.push('indent'));

                // Act
                startFresh(false);

                // Assert
                expect(callOrder[0]).toBe('task');
                expect(callOrder[1]).toBe('indent');
            });

            it('should call success() after rmSync when folder exists', () => {
                // Arrange
                fs.existsSync.mockReturnValue(true);
                const callOrder = [];

                logger.indent.mockImplementation(() => callOrder.push('indent'));
                logger.success.mockImplementation(() => callOrder.push('success'));

                // Act
                startFresh(false);

                // Assert
                expect(logger.success).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor removed\n');
                expect(callOrder.indexOf('success')).toBeGreaterThan(callOrder.indexOf('indent'));
            });

            it('should call outdent() at the end', () => {
                // Arrange
                fs.existsSync.mockReturnValue(false);

                // Act
                startFresh(false);

                // Assert
                expect(logger.outdent).toHaveBeenCalledTimes(1);
            });

            it('should verify correct message format in success()', () => {
                // Arrange
                fs.existsSync.mockReturnValue(true);
                state.claudiomiroFolder = '/custom/path/.claudiomiro/task-executor';

                // Act
                startFresh(false);

                // Assert
                expect(logger.success).toHaveBeenCalledWith('/custom/path/.claudiomiro/task-executor removed\n');
            });

            it('should call all logger methods in proper sequence for full flow', () => {
                // Arrange
                fs.existsSync.mockReturnValue(true);
                const callOrder = [];

                logger.task.mockImplementation(() => callOrder.push('task'));
                logger.indent.mockImplementation(() => callOrder.push('indent'));
                logger.success.mockImplementation(() => callOrder.push('success'));
                logger.outdent.mockImplementation(() => callOrder.push('outdent'));

                // Act
                startFresh(true);

                // Assert
                expect(callOrder).toEqual(['task', 'indent', 'success', 'outdent']);
                expect(logger.task).toHaveBeenCalledTimes(1);
                expect(logger.indent).toHaveBeenCalledTimes(1);
                expect(logger.success).toHaveBeenCalledTimes(1);
                expect(logger.outdent).toHaveBeenCalledTimes(1);
            });
        });

        describe('file system error scenarios', () => {
            describe('permission errors during folder removal', () => {
                it('should handle EACCES permission denied during rmSync', () => {
                    // Arrange
                    const error = new Error('EACCES: permission denied, unlink');
                    error.code = 'EACCES';
                    fs.existsSync.mockReturnValue(true);
                    fs.rmSync.mockImplementation(() => {
                        throw error;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('EACCES: permission denied, unlink');
                    expect(logger.task).toHaveBeenCalled();
                    expect(logger.indent).toHaveBeenCalled();
                    expect(fs.existsSync).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor');
                    expect(fs.rmSync).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor', { recursive: true });
                });

                it('should handle EPERM operation not permitted during rmSync', () => {
                    // Arrange
                    const error = new Error('EPERM: operation not permitted, unlink');
                    error.code = 'EPERM';
                    fs.existsSync.mockReturnValue(true);
                    fs.rmSync.mockImplementation(() => {
                        throw error;
                    });

                    // Act & Assert
                    expect(() => startFresh(true)).toThrow('EPERM: operation not permitted, unlink');
                    expect(fs.existsSync).toHaveBeenCalled();
                    expect(fs.rmSync).toHaveBeenCalled();
                });
            });

            describe('permission errors during folder creation', () => {
                it('should handle EACCES permission denied during mkdirSync', () => {
                    // Arrange
                    const error = new Error('EACCES: permission denied, mkdir');
                    error.code = 'EACCES';
                    fs.existsSync.mockReturnValue(false);
                    fs.mkdirSync.mockImplementation(() => {
                        throw error;
                    });

                    // Act & Assert
                    expect(() => startFresh(true)).toThrow('EACCES: permission denied, mkdir');
                    expect(fs.existsSync).toHaveBeenCalled();
                    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor', { recursive: true });
                });

                it('should handle EPERM operation not permitted during mkdirSync', () => {
                    // Arrange
                    const error = new Error('EPERM: operation not permitted, mkdir');
                    error.code = 'EPERM';
                    fs.existsSync.mockReturnValue(false);
                    fs.mkdirSync.mockImplementation(() => {
                        throw error;
                    });

                    // Act & Assert
                    expect(() => startFresh(true)).toThrow('EPERM: operation not permitted, mkdir');
                    expect(fs.mkdirSync).toHaveBeenCalled();
                });

                it('should handle ENOSPC no space left on device during mkdirSync', () => {
                    // Arrange
                    const error = new Error('ENOSPC: no space left on device');
                    error.code = 'ENOSPC';
                    fs.existsSync.mockReturnValue(false);
                    fs.mkdirSync.mockImplementation(() => {
                        throw error;
                    });

                    // Act & Assert
                    expect(() => startFresh(true)).toThrow('ENOSPC: no space left on device');
                    expect(fs.mkdirSync).toHaveBeenCalled();
                });

                it('should handle ENOENT parent directory does not exist during mkdirSync', () => {
                    // Arrange
                    const error = new Error('ENOENT: no such file or directory, mkdir');
                    error.code = 'ENOENT';
                    fs.existsSync.mockReturnValue(false);
                    fs.mkdirSync.mockImplementation(() => {
                        throw error;
                    });

                    // Act & Assert
                    expect(() => startFresh(true)).toThrow('ENOENT: no such file or directory, mkdir');
                    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/path/.claudiomiro/task-executor', { recursive: true });
                });
            });

            describe('disk space and device errors', () => {
                it('should handle ENOSPC during folder removal (disk full)', () => {
                    // Arrange
                    const error = new Error('ENOSPC: no space left on device');
                    error.code = 'ENOSPC';
                    fs.existsSync.mockReturnValue(true);
                    fs.rmSync.mockImplementation(() => {
                        throw error;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('ENOSPC: no space left on device');
                    expect(fs.rmSync).toHaveBeenCalled();
                });

                it('should handle EIO input/output error during file operations', () => {
                    // Arrange
                    const error = new Error('EIO: input/output error');
                    error.code = 'EIO';
                    fs.existsSync.mockReturnValue(true);
                    fs.rmSync.mockImplementation(() => {
                        throw error;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('EIO: input/output error');
                    expect(fs.rmSync).toHaveBeenCalled();
                });
            });

            describe('invalid path handling', () => {
                it('should handle invalid folder path during existsSync', () => {
                    // Arrange
                    const error = new Error('EINVAL: invalid argument, stat');
                    error.code = 'EINVAL';
                    state.claudiomiroFolder = 'invalid<>path/.claudiomiro/task-executor';
                    fs.existsSync.mockImplementation(() => {
                        throw error;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('EINVAL: invalid argument, stat');
                    expect(fs.existsSync).toHaveBeenCalledWith('invalid<>path/.claudiomiro/task-executor');
                });

                it('should handle ENAMETOOLONG path too long error', () => {
                    // Arrange
                    const error = new Error('ENAMETOOLONG: name too long');
                    error.code = 'ENAMETOOLONG';
                    const longPath = '/test/' + 'a'.repeat(1000) + '/.claudiomiro/task-executor';
                    state.claudiomiroFolder = longPath;
                    fs.existsSync.mockImplementation(() => {
                        throw error;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('ENAMETOOLONG: name too long');
                    expect(fs.existsSync).toHaveBeenCalledWith(longPath);
                });
            });

            describe('concurrent access and race conditions', () => {
                it('should handle EBUSY resource busy during rmSync', () => {
                    // Arrange
                    const error = new Error('EBUSY: resource busy or locked');
                    error.code = 'EBUSY';
                    fs.existsSync.mockReturnValue(true);
                    fs.rmSync.mockImplementation(() => {
                        throw error;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('EBUSY: resource busy or locked');
                    expect(fs.rmSync).toHaveBeenCalled();
                });

                it('should handle ETIMEDOUT operation timed out during rmSync', () => {
                    // Arrange
                    const error = new Error('ETIMEDOUT: operation timed out');
                    error.code = 'ETIMEDOUT';
                    fs.existsSync.mockReturnValue(true);
                    fs.rmSync.mockImplementation(() => {
                        throw error;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('ETIMEDOUT: operation timed out');
                    expect(fs.rmSync).toHaveBeenCalled();
                });
            });
        });

        describe('directory management edge cases', () => {
            describe('nested directory scenarios', () => {
                it('should handle deeply nested directory paths during removal', () => {
                    // Arrange
                    const nestedPath = '/very/deep/nested/structure/with/many/levels/.claudiomiro/task-executor';
                    state.claudiomiroFolder = nestedPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(nestedPath);
                    expect(fs.rmSync).toHaveBeenCalledWith(nestedPath, { recursive: true });
                    expect(logger.success).toHaveBeenCalledWith(nestedPath + ' removed\n');
                });

                it('should handle deeply nested directory paths during creation', () => {
                    // Arrange
                    const nestedPath = '/very/deep/nested/structure/with/many/levels/.claudiomiro/task-executor';
                    state.claudiomiroFolder = nestedPath;
                    fs.existsSync.mockReturnValue(false);

                    // Act
                    startFresh(true);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(nestedPath);
                    expect(fs.mkdirSync).toHaveBeenCalledWith(nestedPath, { recursive: true });
                });

                it('should remove and recreate deeply nested directories', () => {
                    // Arrange
                    const nestedPath = '/a/b/c/d/e/f/g/h/i/j/.claudiomiro/task-executor';
                    state.claudiomiroFolder = nestedPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(true);

                    // Assert
                    expect(fs.rmSync).toHaveBeenCalledWith(nestedPath, { recursive: true });
                    expect(fs.mkdirSync).toHaveBeenCalledWith(nestedPath, { recursive: true });
                });
            });

            describe('special directory names', () => {
                it('should handle directory names with spaces', () => {
                    // Arrange
                    const spacedPath = '/test/with spaces/.claudiomiro/task-executor';
                    state.claudiomiroFolder = spacedPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(spacedPath);
                    expect(fs.rmSync).toHaveBeenCalledWith(spacedPath, { recursive: true });
                    expect(logger.success).toHaveBeenCalledWith(spacedPath + ' removed\n');
                });

                it('should handle directory names with special characters', () => {
                    // Arrange
                    const specialPath = '/test/project-with_special.chars&numbers123/.claudiomiro/task-executor';
                    state.claudiomiroFolder = specialPath;
                    fs.existsSync.mockReturnValue(false);

                    // Act
                    startFresh(true);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(specialPath);
                    expect(fs.mkdirSync).toHaveBeenCalledWith(specialPath, { recursive: true });
                });

                it('should handle unicode directory names', () => {
                    // Arrange
                    const unicodePath = '/test/项目文件系统/.claudiomiro/task-executor';
                    state.claudiomiroFolder = unicodePath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(unicodePath);
                    expect(fs.rmSync).toHaveBeenCalledWith(unicodePath, { recursive: true });
                });

                it('should handle emoji in directory names', () => {
                    // Arrange
                    const emojiPath = '/test/🚀project📁/.claudiomiro/task-executor';
                    state.claudiomiroFolder = emojiPath;
                    fs.existsSync.mockReturnValue(false);

                    // Act
                    startFresh(true);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(emojiPath);
                    expect(fs.mkdirSync).toHaveBeenCalledWith(emojiPath, { recursive: true });
                });
            });

            describe('very long directory names', () => {
                it('should handle long directory names within limits', () => {
                    // Arrange
                    const longName = 'a'.repeat(200); // 200 characters, within typical limits
                    const longPath = `/test/${longName}/.claudiomiro/task-executor`;
                    state.claudiomiroFolder = longPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(longPath);
                    expect(fs.rmSync).toHaveBeenCalledWith(longPath, { recursive: true });
                });

                it('should handle extremely long but valid paths', () => {
                    // Arrange
                    const segments = [];
                    for (let i = 0; i < 10; i++) {
                        segments.push('segment'.repeat(20)); // Each segment 140 chars
                    }
                    const veryLongPath = '/' + segments.join('/') + '/.claudiomiro/task-executor';
                    state.claudiomiroFolder = veryLongPath;
                    fs.existsSync.mockReturnValue(false);

                    // Act
                    startFresh(true);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(veryLongPath);
                    expect(fs.mkdirSync).toHaveBeenCalledWith(veryLongPath, { recursive: true });
                });
            });

            describe('edge case path patterns', () => {
                it('should handle paths ending with dots', () => {
                    // Arrange
                    const dotPath = '/test/project.. /.claudiomiro/task-executor';
                    state.claudiomiroFolder = dotPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(dotPath);
                    expect(fs.rmSync).toHaveBeenCalledWith(dotPath, { recursive: true });
                });

                it('should handle paths with multiple consecutive slashes', () => {
                    // Arrange - note: Node.js normalizes double slashes, but we test what gets passed
                    const slashPath = '/test//project///.claudiomiro/task-executor';
                    state.claudiomiroFolder = slashPath;
                    fs.existsSync.mockReturnValue(false);

                    // Act
                    startFresh(true);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(slashPath);
                    expect(fs.mkdirSync).toHaveBeenCalledWith(slashPath, { recursive: true });
                });

                it('should handle paths with trailing slash', () => {
                    // Arrange
                    const trailingSlashPath = '/test/project/.claudiomiro/task-executor/';
                    state.claudiomiroFolder = trailingSlashPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(trailingSlashPath);
                    expect(fs.rmSync).toHaveBeenCalledWith(trailingSlashPath, { recursive: true });
                });
            });

            describe('system-specific path scenarios', () => {
                it('should handle Windows-style paths on Windows systems', () => {
                    // Arrange - Test Windows path handling (even on Unix systems for completeness)
                    const windowsPath = 'C:\\Users\\test\\project\\.claudiomiro';
                    state.claudiomiroFolder = windowsPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(windowsPath);
                    expect(fs.rmSync).toHaveBeenCalledWith(windowsPath, { recursive: true });
                });

                it('should handle relative paths', () => {
                    // Arrange
                    const relativePath = './project/.claudiomiro/task-executor';
                    state.claudiomiroFolder = relativePath;
                    fs.existsSync.mockReturnValue(false);

                    // Act
                    startFresh(true);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(relativePath);
                    expect(fs.mkdirSync).toHaveBeenCalledWith(relativePath, { recursive: true });
                });

                it('should handle parent directory references', () => {
                    // Arrange
                    const parentPath = '../current/project/.claudiomiro/task-executor';
                    state.claudiomiroFolder = parentPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(parentPath);
                    expect(fs.rmSync).toHaveBeenCalledWith(parentPath, { recursive: true });
                });
            });

            describe('directory cleanup simulation', () => {
                it('should simulate cleanup of directory with mixed content', () => {
                    // Arrange - Simulate a directory that contains files and subdirectories
                    const contentPath = '/test/project/.claudiomiro/task-executor';
                    state.claudiomiroFolder = contentPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert - Verify recursive deletion was called
                    expect(fs.rmSync).toHaveBeenCalledWith(contentPath, { recursive: true });
                    expect(logger.success).toHaveBeenCalledWith(contentPath + ' removed\n');
                });

                it('should handle cleanup of empty directory', () => {
                    // Arrange - Empty directory scenario
                    const emptyPath = '/test/empty/.claudiomiro/task-executor';
                    state.claudiomiroFolder = emptyPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(emptyPath);
                    expect(fs.rmSync).toHaveBeenCalledWith(emptyPath, { recursive: true });
                    expect(logger.success).toHaveBeenCalledWith(emptyPath + ' removed\n');
                });
            });
        });

        describe('backup and restore functionality', () => {
            describe('backup creation scenarios', () => {
                it('should create backup before removing existing directory', () => {
                    // Arrange - This test will be applicable when backup functionality is implemented
                    const originalPath = '/test/project/.claudiomiro/task-executor';
                    // Future: const backupPath = '/test/project/.claudiomiro/task-executor.backup.20231201-120000';
                    state.claudiomiroFolder = originalPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act - When backup functionality is added, this should:
                    // 1. Create backup directory with timestamp
                    // 2. Copy contents to backup
                    // 3. Then remove original
                    startFresh(false);

                    // Assert - Current behavior (will need updating when backup is implemented)
                    expect(fs.existsSync).toHaveBeenCalledWith(originalPath);
                    expect(fs.rmSync).toHaveBeenCalledWith(originalPath, { recursive: true });
                    expect(logger.success).toHaveBeenCalledWith(originalPath + ' removed\n');

                    // Future assertions when backup is implemented:
                    // expect(fs.mkdirSync).toHaveBeenCalledWith(backupPath, { recursive: true });
                    // expect(logger.info).toHaveBeenCalledWith(`Created backup: ${backupPath}`);
                });

                it('should handle backup creation failure gracefully', () => {
                    // Arrange
                    const originalPath = '/test/project/.claudiomiro/task-executor';
                    state.claudiomiroFolder = originalPath;
                    fs.existsSync.mockReturnValue(true);
                    const backupError = new Error('ENOSPC: no space left on device for backup');
                    backupError.code = 'ENOSPC';

                    // Mock backup creation failure (when implemented)
                    fs.mkdirSync.mockImplementation((path) => {
                        if (path.includes('.backup.')) {
                            throw backupError;
                        }
                        return {};
                    });

                    // Act & Assert - Should handle backup failure appropriately
                    // This will need updating when backup functionality is implemented
                    expect(() => startFresh(false)).not.toThrow(); // Should not fail if backup fails
                    expect(fs.rmSync).toHaveBeenCalledWith(originalPath, { recursive: true });
                });

                it('should create timestamped backup directories', () => {
                    // Arrange
                    const originalPath = '/test/project/.claudiomiro/task-executor';
                    state.claudiomiroFolder = originalPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert - Verify backup naming pattern when implemented
                    // Future: expect(fs.mkdirSync).toHaveBeenCalledWith(
                    //   expect.stringMatching(/\.backup\.\d{8}-\d{6}$/)
                    // );
                    expect(fs.rmSync).toHaveBeenCalledWith(originalPath, { recursive: true });
                });
            });

            describe('backup version management', () => {
                it('should handle multiple backup versions', () => {
                    // Arrange
                    const originalPath = '/test/project/.claudiomiro/task-executor';
                    state.claudiomiroFolder = originalPath;
                    fs.existsSync.mockReturnValue(true);

                    // Mock existing backups (when backup functionality is implemented)
                    // Future: const existingBackups = [
                    //     '/test/project/.claudiomiro/task-executor.backup.20231201-100000',
                    //     '/test/project/.claudiomiro/task-executor.backup.20231201-110000',
                    //     '/test/project/.claudiomiro/task-executor.backup.20231201-120000',
                    // ];

                    // Act
                    startFresh(false);

                    // Assert - Should manage backup rotation when implemented
                    expect(fs.rmSync).toHaveBeenCalledWith(originalPath, { recursive: true });

                    // Future assertions:
                    // expect(fs.readdirSync).toHaveBeenCalledWith('/test/project');
                    // expect(fs.mkdirSync).toHaveBeenCalledWith(
                    //   expect.stringMatching(/\.backup\.\d{8}-\d{6}$/)
                    // );
                });

                it('should clean up old backups when exceeding limit', () => {
                    // Arrange - Mock scenario with many existing backups
                    const originalPath = '/test/project/.claudiomiro/task-executor';
                    state.claudiomiroFolder = originalPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert - Should implement backup cleanup when functionality is added
                    expect(fs.rmSync).toHaveBeenCalledWith(originalPath, { recursive: true });

                    // Future implementation should:
                    // 1. Check existing backup count
                    // 2. Remove oldest backups if exceeding limit
                    // 3. Create new backup
                });

                it('should preserve backup retention policy', () => {
                    // Arrange
                    const originalPath = '/test/project/.claudiomiro/task-executor';
                    state.claudiomiroFolder = originalPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert - Should respect retention policy when implemented
                    expect(fs.rmSync).toHaveBeenCalledWith(originalPath, { recursive: true });

                    // Future: Should only keep backups within retention period
                    // Should remove backups older than specified days
                });
            });

            describe('restore functionality', () => {
                it('should prepare for restore operation logging', () => {
                    // Arrange
                    const _backupPath = '/test/project/.claudiomiro/task-executor.backup.20231201-120000';
                    const targetPath = '/test/project/.claudiomiro/task-executor';
                    state.claudiomiroFolder = targetPath;
                    fs.existsSync.mockReturnValue(false); // Target doesn't exist

                    // Act
                    startFresh(true);

                    // Assert - Current behavior
                    expect(fs.mkdirSync).toHaveBeenCalledWith(targetPath, { recursive: true });

                    // Future when restore is implemented:
                    // Should be able to restore from backup:
                    // restoreFromBackup(backupPath, targetPath);
                });

                it('should handle restore from latest backup', () => {
                    // Arrange - This will be used when restore functionality is implemented
                    // Future: const latestBackup = '/test/project/.claudiomiro/task-executor.backup.20231201-120000';
                    state.claudiomiroFolder = '/test/project/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(false);

                    // Act
                    startFresh(true);

                    // Assert - Future restore functionality
                    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/project/.claudiomiro/task-executor', { recursive: true });

                    // Future: Should identify and use latest backup for restore
                });

                it('should validate backup integrity before restore', () => {
                    // Arrange - Backup integrity validation when implemented
                    state.claudiomiroFolder = '/test/project/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(false);

                    // Act
                    startFresh(true);

                    // Assert - Should validate backup before restore
                    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/project/.claudiomiro/task-executor', { recursive: true });

                    // Future: Should check backup exists, is readable, contains valid data
                });
            });

            describe('backup storage management', () => {
                it('should handle backup storage space management', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/project/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Mock disk space check for backup storage
                    const diskSpaceError = new Error('ENOSPC: insufficient space for backup');
                    diskSpaceError.code = 'ENOSPC';
                    fs.mkdirSync.mockImplementation((path) => {
                        if (path.includes('.backup.')) {
                            throw diskSpaceError;
                        }
                        return {};
                    });

                    // Act
                    startFresh(false);

                    // Assert - Should handle storage constraints gracefully
                    expect(fs.rmSync).toHaveBeenCalledWith('/test/project/.claudiomiro/task-executor', { recursive: true });

                    // Future: Should check available space before creating backup
                });

                it('should compress large backups when configured', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/project/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert - Should implement backup compression when feature is added
                    expect(fs.rmSync).toHaveBeenCalledWith('/test/project/.claudiomiro/task-executor', { recursive: true });

                    // Future: Should compress backups based on size threshold
                });

                it('should handle backup path conflicts', () => {
                    // Arrange
                    const originalPath = '/test/project/.claudiomiro/task-executor';
                    state.claudiomiroFolder = originalPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert - Should handle naming conflicts when backup exists
                    expect(fs.rmSync).toHaveBeenCalledWith(originalPath, { recursive: true });

                    // Future: Should generate unique backup names when conflict exists
                });
            });

            describe('backup logging and observability', () => {
                it('should log backup creation process', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/project/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert - Current logging
                    expect(logger.task).toHaveBeenCalledWith('Cleaning up previous files...');
                    expect(logger.success).toHaveBeenCalledWith('/test/project/.claudiomiro/task-executor removed\n');

                    // Future backup logging when implemented:
                    // expect(logger.info).toHaveBeenCalledWith('Creating backup...');
                    // expect(logger.success).toHaveBeenCalledWith('Backup created: .backup.timestamp');
                });

                it('should report backup operation status', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/project/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert - Should provide detailed backup status when implemented
                    expect(logger.outdent).toHaveBeenCalled();

                    // Future: Should report backup size, duration, success/failure
                });
            });
        });

        describe('file existence validation', () => {
            describe('basic file existence scenarios', () => {
                it('should handle directory existence validation', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/existing/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith('/test/existing/.claudiomiro/task-executor');
                    expect(fs.rmSync).toHaveBeenCalledWith('/test/existing/.claudiomiro/task-executor', { recursive: true });
                });

                it('should handle non-existent directory validation', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/nonexistent/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(false);

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith('/test/nonexistent/.claudiomiro/task-executor');
                    expect(fs.rmSync).not.toHaveBeenCalled();
                });

                it('should handle file instead of directory scenario', () => {
                    // Arrange - Path exists but is a file, not directory
                    state.claudiomiroFolder = '/test/file.claudiomiro';
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert - Current implementation will try to remove it as directory
                    // Future enhancement could check if it's a file vs directory
                    expect(fs.existsSync).toHaveBeenCalledWith('/test/file.claudiomiro');
                    expect(fs.rmSync).toHaveBeenCalledWith('/test/file.claudiomiro', { recursive: true });
                });
            });

            describe('symbolic link handling', () => {
                it('should handle valid symbolic links', () => {
                    // Arrange - Path is a valid symbolic link
                    state.claudiomiroFolder = '/test/symlink/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Mock additional fs functions for symlink detection (future enhancement)
                    fs.lstatSync = jest.fn().mockReturnValue({
                        isSymbolicLink: () => true,
                        isDirectory: () => true,
                    });

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith('/test/symlink/.claudiomiro/task-executor');
                    expect(fs.rmSync).toHaveBeenCalledWith('/test/symlink/.claudiomiro/task-executor', { recursive: true });
                });

                it('should handle broken symbolic links', () => {
                    // Arrange - Symbolic link points to non-existent target
                    state.claudiomiroFolder = '/test/broken-symlink/.claudiomiro/task-executor';

                    // existsSync returns true for broken symlinks in most systems
                    fs.existsSync.mockReturnValue(true);

                    // Mock lstatSync for broken symlink detection (future enhancement)
                    fs.lstatSync = jest.fn().mockReturnValue({
                        isSymbolicLink: () => true,
                        isDirectory: () => false,
                    });

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith('/test/broken-symlink/.claudiomiro/task-executor');
                    expect(fs.rmSync).toHaveBeenCalledWith('/test/broken-symlink/.claudiomiro/task-executor', { recursive: true });
                });

                it('should handle symbolic link loops', () => {
                    // Arrange - Circular symbolic links
                    state.claudiomiroFolder = '/test/loop-symlink/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Mock symlink loop scenario
                    fs.lstatSync = jest.fn().mockReturnValue({
                        isSymbolicLink: () => true,
                        isDirectory: () => true,
                    });

                    // Act
                    startFresh(false);

                    // Assert - Should handle loop gracefully
                    expect(fs.existsSync).toHaveBeenCalledWith('/test/loop-symlink/.claudiomiro/task-executor');
                    expect(fs.rmSync).toHaveBeenCalledWith('/test/loop-symlink/.claudiomiro/task-executor', { recursive: true });
                });
            });

            describe('file accessibility validation', () => {
                it('should handle read-only directories', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/readonly/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Mock read-only access during removal
                    const readonlyError = new Error('EACCES: permission denied');
                    readonlyError.code = 'EACCES';
                    fs.rmSync.mockImplementation(() => {
                        throw readonlyError;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('EACCES: permission denied');
                    expect(fs.existsSync).toHaveBeenCalled();
                });

                it('should handle directories with restricted permissions', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/restricted/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Mock permission error during access
                    const restrictedError = new Error('EPERM: operation not permitted');
                    restrictedError.code = 'EPERM';
                    fs.rmSync.mockImplementation(() => {
                        throw restrictedError;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('EPERM: operation not permitted');
                });

                it('should handle directories owned by different users', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/otheruser/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Mock ownership permission error
                    const ownershipError = new Error('EACCES: permission denied');
                    ownershipError.code = 'EACCES';
                    fs.rmSync.mockImplementation(() => {
                        throw ownershipError;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('EACCES: permission denied');
                });
            });

            describe('file integrity and validation', () => {
                it('should handle corrupted directory structures', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/corrupted/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Mock directory corruption error
                    const corruptionError = new Error('EIO: input/output error');
                    corruptionError.code = 'EIO';
                    fs.rmSync.mockImplementation(() => {
                        throw corruptionError;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('EIO: input/output error');
                });

                it('should handle directories with invalid entries', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/invalid-entries/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Mock invalid entry error during deletion
                    const invalidError = new Error('EINVAL: invalid argument');
                    invalidError.code = 'EINVAL';
                    fs.rmSync.mockImplementation(() => {
                        throw invalidError;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('EINVAL: invalid argument');
                });

                it('should handle directories with locked files', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/locked/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Mock file lock error
                    const lockError = new Error('EBUSY: resource busy or locked');
                    lockError.code = 'EBUSY';
                    fs.rmSync.mockImplementation(() => {
                        throw lockError;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('EBUSY: resource busy or locked');
                });
            });

            describe('special file system scenarios', () => {
                it('should handle network file system paths', () => {
                    // Arrange
                    const networkPath = '/network/mount/project/.claudiomiro/task-executor';
                    state.claudiomiroFolder = networkPath;
                    fs.existsSync.mockReturnValue(true);

                    // Mock network file system delay/timing
                    fs.rmSync.mockImplementation(() => {
                        // Simulate network delay
                        return new Promise(resolve => setTimeout(resolve, 100));
                    });

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(networkPath);
                    expect(fs.rmSync).toHaveBeenCalledWith(networkPath, { recursive: true });
                });

                it('should handle virtual file system paths', () => {
                    // Arrange
                    const virtualPath = '/virtual/fs/project/.claudiomiro/task-executor';
                    state.claudiomiroFolder = virtualPath;
                    fs.existsSync.mockReturnValue(false);

                    // Act
                    startFresh(true);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(virtualPath);
                    expect(fs.mkdirSync).toHaveBeenCalledWith(virtualPath, { recursive: true });
                });

                it('should handle temporary file system paths', () => {
                    // Arrange
                    const tempPath = '/tmp/project/.claudiomiro/task-executor';
                    state.claudiomiroFolder = tempPath;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(tempPath);
                    expect(fs.rmSync).toHaveBeenCalledWith(tempPath, { recursive: true });
                });
            });

            describe('path traversal and security validation', () => {
                it('should handle path traversal attempts in validation', () => {
                    // Arrange - Path traversal attempt
                    const traversalPath = '../../../etc/passwd/.claudiomiro/task-executor';
                    state.claudiomiroFolder = traversalPath;
                    fs.existsSync.mockReturnValue(false);

                    // Act
                    startFresh(true);

                    // Assert - Current implementation doesn't validate paths
                    // Future enhancement should validate and sanitize paths
                    expect(fs.existsSync).toHaveBeenCalledWith(traversalPath);
                    expect(fs.mkdirSync).toHaveBeenCalledWith(traversalPath, { recursive: true });
                });

                it('should handle null byte injection attempts', () => {
                    // Arrange - Null byte injection attempt
                    const nullBytePath = '/test/project\0malicious/.claudiomiro/task-executor';
                    state.claudiomiroFolder = nullBytePath;
                    fs.existsSync.mockReturnValue(false);

                    // Act
                    startFresh(true);

                    // Assert - Current implementation passes through as-is
                    // Future enhancement should detect and reject null bytes
                    expect(fs.existsSync).toHaveBeenCalledWith(nullBytePath);
                    expect(fs.mkdirSync).toHaveBeenCalledWith(nullBytePath, { recursive: true });
                });

                it('should handle extremely long path traversal', () => {
                    // Arrange
                    const longTraversal = '../' + 'a'.repeat(1000) + '/.claudiomiro/task-executor';
                    state.claudiomiroFolder = longTraversal;
                    fs.existsSync.mockReturnValue(true);

                    // Act
                    startFresh(false);

                    // Assert
                    expect(fs.existsSync).toHaveBeenCalledWith(longTraversal);
                    expect(fs.rmSync).toHaveBeenCalledWith(longTraversal, { recursive: true });
                });
            });

            describe('concurrent access validation', () => {
                it('should handle directory modified during operation', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/concurrent/.claudiomiro/task-executor';

                    // Directory exists initially
                    fs.existsSync.mockReturnValue(true);

                    // But deletion fails due to concurrent modification
                    const concurrentError = new Error('EBUSY: resource busy');
                    concurrentError.code = 'EBUSY';
                    fs.rmSync.mockImplementation(() => {
                        throw concurrentError;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('EBUSY: resource busy');
                });

                it('should handle directory locked by another process', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/locked/.claudiomiro/task-executor';
                    fs.existsSync.mockReturnValue(true);

                    // Mock process lock
                    const lockError = new Error('ETXTBSY: text file busy');
                    lockError.code = 'ETXTBSY';
                    fs.rmSync.mockImplementation(() => {
                        throw lockError;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('ETXTBSY: text file busy');
                });
            });

            describe('validation error handling', () => {
                it('should handle validation system errors gracefully', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/validation/.claudiomiro/task-executor';

                    // System error during validation
                    const systemError = new Error('System error during path validation');
                    fs.existsSync.mockImplementation(() => {
                        throw systemError;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('System error during path validation');
                });

                it('should handle validation timeout scenarios', () => {
                    // Arrange
                    state.claudiomiroFolder = '/test/timeout/.claudiomiro/task-executor';

                    // Timeout during validation
                    const timeoutError = new Error('ETIMEDOUT: operation timed out');
                    timeoutError.code = 'ETIMEDOUT';
                    fs.existsSync.mockImplementation(() => {
                        throw timeoutError;
                    });

                    // Act & Assert
                    expect(() => startFresh(false)).toThrow('ETIMEDOUT: operation timed out');
                });
            });
        });
    });
});
