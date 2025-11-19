const readline = require('readline');
const TerminalRenderer = require('./terminal-renderer');

describe('TerminalRenderer', () => {
  let renderer;
  let mockWrite;
  let originalColumns;
  let cursorToSpy;
  let clearScreenDownSpy;

  beforeEach(() => {
    // Spy on process.stdout.write instead of replacing it
    mockWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Store and set columns
    originalColumns = process.stdout.columns;
    process.stdout.columns = 120;

    cursorToSpy = jest.spyOn(readline, 'cursorTo').mockImplementation(() => { });
    clearScreenDownSpy = jest.spyOn(readline, 'clearScreenDown').mockImplementation(() => { });

    renderer = new TerminalRenderer();
  });

  afterEach(() => {
    // Restore
    if (mockWrite && mockWrite.mockRestore) {
      mockWrite.mockRestore();
    }
    if (process.stdout && originalColumns !== undefined) {
      process.stdout.columns = originalColumns;
    }
    if (cursorToSpy) {
      cursorToSpy.mockRestore();
    }
    if (clearScreenDownSpy) {
      clearScreenDownSpy.mockRestore();
    }
  });

  describe('constructor', () => {
    test('should initialize with lastLineCount of 0', () => {
      expect(renderer.lastLineCount).toBe(0);
    });
  });

  describe('hideCursor', () => {
    test('should write correct ANSI escape code to hide cursor', () => {
      renderer.hideCursor();
      expect(mockWrite).toHaveBeenCalledWith('\x1b[?25l');
    });

    test('should handle missing stdout gracefully', () => {
      const saved = process.stdout;
      process.stdout = null;
      expect(() => renderer.hideCursor()).not.toThrow();
      process.stdout = saved;
    });

    test('should handle missing write method gracefully', () => {
      const saved = process.stdout;
      process.stdout = { columns: 80 };
      expect(() => renderer.hideCursor()).not.toThrow();
      process.stdout = saved;
    });
  });

  describe('showCursor', () => {
    test('should write correct ANSI escape code to show cursor', () => {
      renderer.showCursor();
      expect(mockWrite).toHaveBeenCalledWith('\x1b[?25h');
    });

    test('should handle missing stdout gracefully', () => {
      const saved = process.stdout;
      process.stdout = null;
      expect(() => renderer.showCursor()).not.toThrow();
      process.stdout = saved;
    });

    test('should handle missing write method gracefully', () => {
      const saved = process.stdout;
      process.stdout = { columns: 80 };
      expect(() => renderer.showCursor()).not.toThrow();
      process.stdout = saved;
    });
  });

  describe('moveCursorUp', () => {
    test('should write correct ANSI code for moving cursor up 1 line', () => {
      renderer.moveCursorUp(1);
      expect(mockWrite).toHaveBeenCalledWith('\x1b[1A');
    });

    test('should write correct ANSI code for moving cursor up 5 lines', () => {
      renderer.moveCursorUp(5);
      expect(mockWrite).toHaveBeenCalledWith('\x1b[5A');
    });

    test('should not write anything for count of 0', () => {
      renderer.moveCursorUp(0);
      expect(mockWrite).not.toHaveBeenCalled();
    });

    test('should not write anything for negative count', () => {
      renderer.moveCursorUp(-1);
      expect(mockWrite).not.toHaveBeenCalled();
    });

    test('should handle missing stdout gracefully', () => {
      const saved = process.stdout;
      process.stdout = null;
      expect(() => renderer.moveCursorUp(3)).not.toThrow();
      process.stdout = saved;
    });
  });

  describe('getTerminalWidth', () => {
    test('should return process.stdout.columns when available', () => {
      expect(renderer.getTerminalWidth()).toBe(120);
    });

    test('should return default 80 when stdout is null', () => {
      // Temporarily replace process.stdout
      const originalStdout = process.stdout;
      try {
        Object.defineProperty(global.process, 'stdout', {
          value: null,
          writable: true,
          configurable: true
        });

        expect(renderer.getTerminalWidth()).toBe(80);
      } finally {
        // Restore - must happen even if test fails
        Object.defineProperty(global.process, 'stdout', {
          value: originalStdout,
          writable: true,
          configurable: true
        });
      }
    });

    test('should return default 80 when columns is undefined', () => {
      const savedColumns = process.stdout.columns;
      delete process.stdout.columns;
      expect(renderer.getTerminalWidth()).toBe(80);
      process.stdout.columns = savedColumns;
    });

    test('should return default 80 when columns is 0', () => {
      const savedColumns = process.stdout.columns;
      process.stdout.columns = 0;
      expect(renderer.getTerminalWidth()).toBe(80);
      process.stdout.columns = savedColumns;
    });

    test('should return correct width for narrow terminal', () => {
      process.stdout.columns = 40;
      expect(renderer.getTerminalWidth()).toBe(40);
    });

    test('should return correct width for wide terminal', () => {
      process.stdout.columns = 200;
      expect(renderer.getTerminalWidth()).toBe(200);
    });
  });

  describe('clearLines', () => {
    test('should clear 1 line correctly', () => {
      renderer.clearLines(1);
      expect(mockWrite).toHaveBeenCalledTimes(1);
      expect(mockWrite).toHaveBeenCalledWith('\r\x1b[K');
    });

    test('should clear 3 lines correctly', () => {
      renderer.clearLines(3);
      expect(mockWrite).toHaveBeenCalledTimes(5); // 3 clears + 2 moves up
      expect(mockWrite).toHaveBeenNthCalledWith(1, '\r\x1b[K');
      expect(mockWrite).toHaveBeenNthCalledWith(2, '\x1b[1A');
      expect(mockWrite).toHaveBeenNthCalledWith(3, '\r\x1b[K');
      expect(mockWrite).toHaveBeenNthCalledWith(4, '\x1b[1A');
      expect(mockWrite).toHaveBeenNthCalledWith(5, '\r\x1b[K');
    });

    test('should not write anything for count of 0', () => {
      renderer.clearLines(0);
      expect(mockWrite).not.toHaveBeenCalled();
    });

    test('should not write anything for negative count', () => {
      renderer.clearLines(-1);
      expect(mockWrite).not.toHaveBeenCalled();
    });

    test('should handle missing stdout gracefully', () => {
      const saved = process.stdout;
      process.stdout = null;
      expect(() => renderer.clearLines(3)).not.toThrow();
      process.stdout = saved;
    });

    test('should handle missing write method gracefully', () => {
      const saved = process.stdout;
      process.stdout = { columns: 80 };
      expect(() => renderer.clearLines(3)).not.toThrow();
      process.stdout = saved;
    });
  });

  describe('clearScreen', () => {
    test('should write correct ANSI codes to clear screen', () => {
      renderer.clearScreen();
      expect(mockWrite).toHaveBeenCalledWith('\x1b[2J\x1b[H');
    });

    test('should handle missing stdout gracefully', () => {
      const saved = process.stdout;
      process.stdout = null;
      expect(() => renderer.clearScreen()).not.toThrow();
      process.stdout = saved;
    });

    test('should handle missing write method gracefully', () => {
      const saved = process.stdout;
      process.stdout = { columns: 80 };
      expect(() => renderer.clearScreen()).not.toThrow();
      process.stdout = saved;
    });
  });

  describe('renderBlock', () => {
    test('should render single line', () => {
      renderer.renderBlock(['Line 1']);
      expect(mockWrite).toHaveBeenCalledWith('Line 1\n');
      expect(renderer.lastLineCount).toBe(1);
    });

    test('should render multiple lines', () => {
      renderer.renderBlock(['Line 1', 'Line 2', 'Line 3']);
      expect(mockWrite).toHaveBeenCalledWith('Line 1\nLine 2\nLine 3\n');
      expect(renderer.lastLineCount).toBe(3);
    });

    test('should clear previous content before rendering new content', () => {
      // First render
      renderer.renderBlock(['Line 1', 'Line 2']);
      mockWrite.mockClear();
      cursorToSpy.mockClear();
      clearScreenDownSpy.mockClear();

      // Second render should clear previous 2 lines
      renderer.renderBlock(['New line 1', 'New line 2', 'New line 3']);

      expect(cursorToSpy).toHaveBeenNthCalledWith(1, process.stdout, 0);
      expect(mockWrite).toHaveBeenCalledWith('\x1b[2A');
      expect(cursorToSpy).toHaveBeenNthCalledWith(2, process.stdout, 0);
      expect(clearScreenDownSpy).toHaveBeenCalledWith(process.stdout);
      expect(mockWrite).toHaveBeenCalledWith('New line 1\nNew line 2\nNew line 3\n');
      expect(renderer.lastLineCount).toBe(3);
    });

    test('should handle empty array', () => {
      renderer.renderBlock([]);
      expect(renderer.lastLineCount).toBe(0);
    });

    test('should handle null gracefully', () => {
      expect(() => renderer.renderBlock(null)).not.toThrow();
      expect(renderer.lastLineCount).toBe(0);
    });

    test('should handle undefined gracefully', () => {
      expect(() => renderer.renderBlock(undefined)).not.toThrow();
      expect(renderer.lastLineCount).toBe(0);
    });

    test('should handle non-array gracefully', () => {
      expect(() => renderer.renderBlock('not an array')).not.toThrow();
      expect(renderer.lastLineCount).toBe(0);
    });

    test('should handle missing stdout gracefully', () => {
      const saved = process.stdout;
      process.stdout = null;
      expect(() => renderer.renderBlock(['Line 1'])).not.toThrow();
      process.stdout = saved;
    });

    test('should handle missing write method gracefully', () => {
      const saved = process.stdout;
      process.stdout = { columns: 80 };
      expect(() => renderer.renderBlock(['Line 1'])).not.toThrow();
      process.stdout = saved;
    });

    test('should update state correctly across multiple renders', () => {
      renderer.renderBlock(['A', 'B']);
      expect(renderer.lastLineCount).toBe(2);

      renderer.renderBlock(['C', 'D', 'E']);
      expect(renderer.lastLineCount).toBe(3);

      renderer.renderBlock(['F']);
      expect(renderer.lastLineCount).toBe(1);
    });

    test('should handle render after clear', () => {
      renderer.renderBlock(['Line 1', 'Line 2', 'Line 3']);
      mockWrite.mockClear();
      cursorToSpy.mockClear();
      clearScreenDownSpy.mockClear();

      renderer.renderBlock([]);
      expect(cursorToSpy).toHaveBeenNthCalledWith(1, process.stdout, 0);
      expect(mockWrite).toHaveBeenCalledWith('\x1b[3A');
      expect(cursorToSpy).toHaveBeenNthCalledWith(2, process.stdout, 0);
      expect(clearScreenDownSpy).toHaveBeenCalledWith(process.stdout);
      expect(renderer.lastLineCount).toBe(0);
    });

    test('should not move cursor on first render', () => {
      renderer.renderBlock(['First', 'Second']);

      // Should only have the render call, no cursor movement
      expect(cursorToSpy).not.toHaveBeenCalled();
      expect(clearScreenDownSpy).not.toHaveBeenCalled();
      expect(mockWrite).toHaveBeenCalledTimes(1);
      expect(mockWrite).toHaveBeenCalledWith('First\nSecond\n');
    });

    test('should handle lines with special characters', () => {
      renderer.renderBlock(['Line with \t tab', 'Line with "quotes"', 'Line with \\backslash']);
      expect(mockWrite).toHaveBeenCalledWith('Line with \t tab\nLine with "quotes"\nLine with \\backslash\n');
    });
  });

  describe('reset', () => {
    test('should reset lastLineCount to 0', () => {
      renderer.renderBlock(['Line 1', 'Line 2', 'Line 3']);
      expect(renderer.lastLineCount).toBe(3);

      renderer.reset();
      expect(renderer.lastLineCount).toBe(0);
    });

    test('should allow fresh rendering after reset', () => {
      renderer.renderBlock(['Old 1', 'Old 2']);
      renderer.reset();
      mockWrite.mockClear();

      renderer.renderBlock(['New 1', 'New 2']);

      // Should not try to clear previous content
      expect(mockWrite).toHaveBeenCalledTimes(1);
      expect(mockWrite).toHaveBeenCalledWith('New 1\nNew 2\n');
    });
  });

  describe('integration scenarios', () => {
    test('should handle typical usage flow: hide cursor, render, show cursor', () => {
      renderer.hideCursor();
      renderer.renderBlock(['Task 1: Running...', 'Task 2: Pending']);
      renderer.renderBlock(['Task 1: Complete', 'Task 2: Running...']);
      renderer.showCursor();

      expect(mockWrite).toHaveBeenCalledWith('\x1b[?25l'); // hide
      expect(mockWrite).toHaveBeenCalledWith('\x1b[?25h'); // show
    });

    test('should handle clearing and re-rendering efficiently', () => {
      // Initial render
      renderer.renderBlock(['A', 'B', 'C']);

      // Update with same number of lines
      mockWrite.mockClear();
      cursorToSpy.mockClear();
      clearScreenDownSpy.mockClear();
      renderer.renderBlock(['D', 'E', 'F']);

      expect(cursorToSpy).toHaveBeenNthCalledWith(1, process.stdout, 0);
      expect(mockWrite).toHaveBeenCalledWith('\x1b[3A');
      expect(cursorToSpy).toHaveBeenNthCalledWith(2, process.stdout, 0);
      expect(clearScreenDownSpy).toHaveBeenCalledWith(process.stdout);
      expect(mockWrite).toHaveBeenCalledWith('D\nE\nF\n');
    });

    test('should handle rapid successive renders', () => {
      renderer.renderBlock(['1']);
      renderer.renderBlock(['1', '2']);
      renderer.renderBlock(['1', '2', '3']);
      renderer.renderBlock(['1', '2', '3', '4']);

      expect(renderer.lastLineCount).toBe(4);
    });
  });
});
