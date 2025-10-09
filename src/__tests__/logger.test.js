const logger = require('../../logger');

describe('Logger', () => {
  // Mock console.log to prevent output during tests
  let consoleLogSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    logger.resetIndent();
    logger.stopSpinner();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('Basic logging methods', () => {
    test('info() should log info messages', () => {
      logger.info('Test info message');
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Test info message');
    });

    test('success() should log success messages', () => {
      logger.success('Test success message');
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Test success message');
    });

    test('warning() should log warning messages', () => {
      logger.warning('Test warning message');
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Test warning message');
    });

    test('error() should log error messages', () => {
      logger.error('Test error message');
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Test error message');
    });
  });

  describe('Indentation', () => {
    test('getIndent() should return empty string initially', () => {
      expect(logger.getIndent()).toBe('');
    });

    test('indent() should increase indentation level', () => {
      logger.indent();
      expect(logger.getIndent()).toBe('  ');
      logger.indent();
      expect(logger.getIndent()).toBe('    ');
    });

    test('outdent() should decrease indentation level', () => {
      logger.indent();
      logger.indent();
      logger.outdent();
      expect(logger.getIndent()).toBe('  ');
    });

    test('outdent() should not go below zero indentation', () => {
      logger.outdent();
      logger.outdent();
      expect(logger.getIndent()).toBe('');
    });

    test('resetIndent() should reset indentation to zero', () => {
      logger.indent();
      logger.indent();
      logger.indent();
      logger.resetIndent();
      expect(logger.getIndent()).toBe('');
    });

    test('logging methods should respect indentation', () => {
      logger.indent();
      logger.info('Indented info');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toMatch(/^\s\s/); // Starts with 2 spaces
      expect(output).toContain('Indented info');
    });

    test('indented output should have correct format at multiple levels', () => {
      logger.indent();
      logger.indent();
      logger.success('Double indented');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toMatch(/^\s\s\s\s/); // Starts with 4 spaces
      expect(output).toContain('Double indented');
    });

    test('path method should respect indentation', () => {
      logger.indent();
      logger.path('/test/path');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toMatch(/^\s\s/); // Starts with 2 spaces
    });

    test('command method should respect indentation', () => {
      logger.indent();
      logger.command('npm test');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toMatch(/^\s\s/); // Starts with 2 spaces
    });

    test('task method should respect indentation', () => {
      logger.indent();
      logger.task('Test task');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toMatch(/^\s\s/); // Starts with 2 spaces
    });

    test('subtask method should respect indentation', () => {
      logger.indent();
      logger.subtask('Test subtask');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toMatch(/^\s\s/); // Starts with 2 spaces
    });

    test('progress method should respect indentation', () => {
      logger.indent();
      logger.progress(5, 10, 'Progress');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toMatch(/^\s\s/); // Starts with 2 spaces
    });
  });

  describe('Step logging', () => {
    test('step() should log task and step information', () => {
      logger.step(1, 5, 2, 'Test step message');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('TASK 1/5');
      expect(output).toContain('STEP 2');
      expect(output).toContain('Test step message');
    });
  });

  describe('Special logging methods', () => {
    test('task() should log task messages', () => {
      logger.task('Test task');
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Test task');
    });

    test('subtask() should log subtask messages', () => {
      logger.subtask('Test subtask');
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Test subtask');
    });

    test('path() should log path messages', () => {
      logger.path('/test/path');
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('/test/path');
    });

    test('command() should log command messages', () => {
      logger.command('npm test');
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('npm test');
    });
  });

  describe('Progress bar', () => {
    test('createProgressBar() should create progress bar with correct percentage', () => {
      const bar0 = logger.createProgressBar(0);
      expect(bar0).toBeTruthy();

      const bar50 = logger.createProgressBar(50);
      expect(bar50).toBeTruthy();

      const bar100 = logger.createProgressBar(100);
      expect(bar100).toBeTruthy();
    });

    test('progress() should log progress with percentage', () => {
      logger.progress(5, 10, 'Loading');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('50%');
      expect(output).toContain('Loading');
    });

    test('progress() should handle 0 total gracefully', () => {
      logger.progress(0, 0, 'Edge case');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      // NaN percentage, but should not throw
      expect(output).toBeTruthy();
    });

    test('progress() should show 0% for 0 current', () => {
      logger.progress(0, 10, 'Starting');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('0%');
    });

    test('progress() should show 100% for completed', () => {
      logger.progress(10, 10, 'Complete');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('100%');
    });

    test('progress() should calculate percentage accurately', () => {
      logger.progress(3, 7, 'Testing');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      // 3/7 = 42.857... rounds to 43%
      expect(output).toContain('43%');
    });
  });

  describe('Utility methods', () => {
    test('separator() should log separator', () => {
      logger.separator();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    test('newline() should log empty line', () => {
      logger.newline();
      expect(consoleLogSpy).toHaveBeenCalledWith();
    });

    test('banner() should display version text', () => {
      logger.banner();
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('CLAUDIOMIRO v1.3');
      expect(output).toContain('AI-Powered Development Agent');
    });

    test('box() should create boxed output with default options', () => {
      logger.box('Test message');
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('Test message');
    });

    test('box() should create boxed output with custom options', () => {
      logger.box('Custom box', { borderColor: 'red', padding: 2 });
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('Custom box');
    });

    test('clear() should call console.clear', () => {
      const consoleClearSpy = jest.spyOn(console, 'clear').mockImplementation();
      logger.clear();
      expect(consoleClearSpy).toHaveBeenCalled();
      consoleClearSpy.mockRestore();
    });
  });

  describe('Spinner methods', () => {
    test('startSpinner() should create a spinner', () => {
      logger.startSpinner('Loading...');
      expect(logger.spinner).toBeTruthy();
      logger.stopSpinner();
    });

    test('updateSpinner() should update spinner text', () => {
      logger.startSpinner('Loading...');
      logger.updateSpinner('Still loading...');
      expect(logger.spinner.text).toContain('Still loading...');
      logger.stopSpinner();
    });

    test('succeedSpinner() should stop spinner with success', () => {
      logger.startSpinner('Loading...');
      logger.succeedSpinner('Done!');
      expect(logger.spinner).toBeNull();
    });

    test('failSpinner() should stop spinner with failure', () => {
      logger.startSpinner('Loading...');
      logger.failSpinner('Failed!');
      expect(logger.spinner).toBeNull();
    });

    test('stopSpinner() should stop spinner', () => {
      logger.startSpinner('Loading...');
      logger.stopSpinner();
      expect(logger.spinner).toBeNull();
    });

    test('updateSpinner() should do nothing when spinner is null', () => {
      logger.stopSpinner(); // Ensure spinner is null
      expect(() => logger.updateSpinner('Test')).not.toThrow();
      expect(logger.spinner).toBeNull();
    });

    test('succeedSpinner() should do nothing when spinner is null', () => {
      logger.stopSpinner(); // Ensure spinner is null
      expect(() => logger.succeedSpinner('Test')).not.toThrow();
      expect(logger.spinner).toBeNull();
    });

    test('failSpinner() should do nothing when spinner is null', () => {
      logger.stopSpinner(); // Ensure spinner is null
      expect(() => logger.failSpinner('Test')).not.toThrow();
      expect(logger.spinner).toBeNull();
    });

    test('startSpinner() should stop existing spinner before creating new one', () => {
      logger.startSpinner('First spinner');
      const firstSpinner = logger.spinner;
      const stopSpy = jest.spyOn(firstSpinner, 'stop');

      logger.startSpinner('Second spinner');
      expect(stopSpy).toHaveBeenCalled();
      expect(logger.spinner).toBeTruthy();
      expect(logger.spinner).not.toBe(firstSpinner);

      logger.stopSpinner();
    });
  });
});
