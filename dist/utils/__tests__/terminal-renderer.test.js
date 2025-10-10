"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const terminal_renderer_1 = require("../terminal-renderer");
describe('TerminalRenderer', () => {
    let renderer;
    beforeEach(() => {
        renderer = new terminal_renderer_1.TerminalRenderer();
    });
    describe('constructor', () => {
        it('should initialize with lastLineCount set to 0', () => {
            expect(renderer.lastLineCount).toBe(0);
        });
    });
    describe('hideCursor', () => {
        it('should write ANSI escape code to hide cursor', () => {
            const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
            renderer.hideCursor();
            expect(writeSpy).toHaveBeenCalledWith('\x1b[?25l');
            writeSpy.mockRestore();
        });
        it('should handle missing stdout gracefully', () => {
            // Mock process.stdout to be null
            const originalStdout = process.stdout;
            Object.defineProperty(process, 'stdout', {
                value: null,
                writable: true
            });
            expect(() => renderer.hideCursor()).not.toThrow();
            // Restore original stdout
            Object.defineProperty(process, 'stdout', {
                value: originalStdout,
                writable: true
            });
        });
    });
    describe('showCursor', () => {
        it('should write ANSI escape code to show cursor', () => {
            const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
            renderer.showCursor();
            expect(writeSpy).toHaveBeenCalledWith('\x1b[?25h');
            writeSpy.mockRestore();
        });
    });
    describe('moveCursorUp', () => {
        it('should write ANSI escape code to move cursor up', () => {
            const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
            renderer.moveCursorUp(3);
            expect(writeSpy).toHaveBeenCalledWith('\x1b[3A');
            writeSpy.mockRestore();
        });
        it('should not move cursor for count <= 0', () => {
            const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
            renderer.moveCursorUp(0);
            renderer.moveCursorUp(-1);
            expect(writeSpy).not.toHaveBeenCalled();
            writeSpy.mockRestore();
        });
    });
    describe('getTerminalWidth', () => {
        it('should return stdout columns when available', () => {
            const originalColumns = process.stdout.columns;
            process.stdout.columns = 120;
            expect(renderer.getTerminalWidth()).toBe(120);
            process.stdout.columns = originalColumns;
        });
        it('should return default 80 when columns is not available', () => {
            const originalColumns = process.stdout.columns;
            process.stdout.columns = undefined;
            expect(renderer.getTerminalWidth()).toBe(80);
            process.stdout.columns = originalColumns;
        });
    });
    describe('clearLines', () => {
        it('should clear specified number of lines', () => {
            const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
            renderer.clearLines(2);
            expect(writeSpy).toHaveBeenCalledWith('\r\x1b[K');
            expect(writeSpy).toHaveBeenCalledWith('\x1b[1A');
            writeSpy.mockRestore();
        });
        it('should not clear lines for count <= 0', () => {
            const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
            renderer.clearLines(0);
            renderer.clearLines(-1);
            expect(writeSpy).not.toHaveBeenCalled();
            writeSpy.mockRestore();
        });
    });
    describe('clearScreen', () => {
        it('should write ANSI escape code to clear screen', () => {
            const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
            renderer.clearScreen();
            expect(writeSpy).toHaveBeenCalledWith('\x1b[2J\x1b[H');
            writeSpy.mockRestore();
        });
    });
    describe('renderBlock', () => {
        it('should render lines correctly', () => {
            const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
            const lines = ['Line 1', 'Line 2', 'Line 3'];
            renderer.renderBlock(lines);
            expect(writeSpy).toHaveBeenCalledWith('Line 1\nLine 2\nLine 3\n');
            expect(renderer.lastLineCount).toBe(3);
            writeSpy.mockRestore();
        });
        it('should handle empty lines array', () => {
            const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
            renderer.renderBlock([]);
            // When lines array is empty, no output should be written
            expect(writeSpy).not.toHaveBeenCalledWith('\n');
            expect(renderer.lastLineCount).toBe(0);
            writeSpy.mockRestore();
        });
        it('should handle null or undefined lines', () => {
            const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
            renderer.renderBlock(null);
            expect(renderer.lastLineCount).toBe(0);
            renderer.renderBlock(undefined);
            expect(renderer.lastLineCount).toBe(0);
            writeSpy.mockRestore();
        });
        it('should handle non-array input', () => {
            const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
            renderer.renderBlock('not an array');
            expect(renderer.lastLineCount).toBe(0);
            writeSpy.mockRestore();
        });
    });
    describe('reset', () => {
        it('should reset lastLineCount to 0', () => {
            renderer.lastLineCount = 5;
            renderer.reset();
            expect(renderer.lastLineCount).toBe(0);
        });
    });
    // Type safety tests
    describe('Type safety', () => {
        it('should enforce proper parameter types', () => {
            const renderer = new terminal_renderer_1.TerminalRenderer();
            // These should compile without type errors
            renderer.moveCursorUp(3);
            renderer.clearLines(2);
            renderer.renderBlock(['line1', 'line2']);
            const width = renderer.getTerminalWidth();
            expect(typeof width).toBe('number');
        });
        it('should handle edge cases with proper types', () => {
            const renderer = new terminal_renderer_1.TerminalRenderer();
            // Should handle empty arrays and edge cases
            renderer.renderBlock([]);
            renderer.renderBlock(['']);
            renderer.renderBlock(['line1', '', 'line3']);
            // Should handle boundary values
            renderer.moveCursorUp(0);
            renderer.clearLines(0);
        });
    });
});
//# sourceMappingURL=terminal-renderer.test.js.map