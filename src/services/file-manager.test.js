const fs = require('fs');
const logger = require('../utils/logger');
const state = require('../config/state');
const { startFresh } = require('./file-manager');

// Mock modules
jest.mock('fs');
jest.mock('../utils/logger');
jest.mock('../config/state');

describe('file-manager', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Set default mock implementation for state
    state.claudiomiroFolder = '/test/path/.claudiomiro';

    // Reset fs mocks to default (no-op) implementations
    fs.existsSync.mockReturnValue(false);
    fs.rmSync.mockImplementation(() => {});
    fs.mkdirSync.mockImplementation(() => {});
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
        expect(fs.existsSync).toHaveBeenCalledWith('/test/path/.claudiomiro');
        expect(fs.rmSync).toHaveBeenCalledWith('/test/path/.claudiomiro', { recursive: true });
        expect(logger.success).toHaveBeenCalledWith('/test/path/.claudiomiro removed\n');
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
        expect(fs.existsSync).toHaveBeenCalledWith('/test/path/.claudiomiro');
        expect(fs.rmSync).toHaveBeenCalledWith('/test/path/.claudiomiro', { recursive: true });
        expect(logger.success).toHaveBeenCalledWith('/test/path/.claudiomiro removed\n');
        expect(fs.mkdirSync).toHaveBeenCalledWith('/test/path/.claudiomiro');
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
        expect(fs.existsSync).toHaveBeenCalledWith('/test/path/.claudiomiro');
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
        expect(fs.existsSync).toHaveBeenCalledWith('/test/path/.claudiomiro');
        expect(fs.rmSync).not.toHaveBeenCalled();
        expect(logger.success).not.toHaveBeenCalled();
        expect(fs.mkdirSync).toHaveBeenCalledWith('/test/path/.claudiomiro');
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
        expect(logger.success).toHaveBeenCalledWith('/test/path/.claudiomiro removed\n');
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
        state.claudiomiroFolder = '/custom/path/.claudiomiro';

        // Act
        startFresh(false);

        // Assert
        expect(logger.success).toHaveBeenCalledWith('/custom/path/.claudiomiro removed\n');
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
  });
});
