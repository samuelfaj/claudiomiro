const readline = require('readline');

/**
 * TerminalRenderer - Handles terminal rendering with cursor control and line management
 */
class TerminalRenderer {
    constructor() {
        this.lastLineCount = 0;
    }

    /**
   * Hide the terminal cursor
   */
    hideCursor() {
        if (process.stdout && process.stdout.write) {
            process.stdout.write('\x1b[?25l');
        }
    }

    /**
   * Show the terminal cursor
   */
    showCursor() {
        if (process.stdout && process.stdout.write) {
            process.stdout.write('\x1b[?25h');
        }
    }

    /**
   * Move cursor up by specified number of lines
   * @param {number} count - Number of lines to move up
   */
    moveCursorUp(count) {
        if (process.stdout && process.stdout.write && count > 0) {
            process.stdout.write(`\x1b[${count}A`);
        }
    }

    /**
   * Get the current terminal width
   * @returns {number} Terminal width in columns
   */
    getTerminalWidth() {
        return process.stdout && process.stdout.columns
            ? process.stdout.columns
            : 80; // Default fallback
    }

    /**
   * Clear specified number of lines
   * @param {number} count - Number of lines to clear
   */
    clearLines(count) {
        if (!process.stdout || !process.stdout.write || count <= 0) {
            return;
        }

        for (let i = 0; i < count; i++) {
            // Move to beginning of line, clear line, move up
            process.stdout.write('\r\x1b[K');
            if (i < count - 1) {
                process.stdout.write('\x1b[1A');
            }
        }
    }

    /**
   * Clear the entire screen
   */
    clearScreen() {
        if (process.stdout && process.stdout.write) {
            process.stdout.write('\x1b[2J\x1b[H');
        }
    }

    /**
   * Render a block of lines, clearing previous content
   * @param {string[]} lines - Array of lines to render
   */
    renderBlock(lines) {
        if (!process.stdout || !process.stdout.write) {
            return;
        }

        // Handle edge cases
        if (!lines || !Array.isArray(lines)) {
            lines = [];
        }

        // Clear previous content if any
        if (this.lastLineCount > 0) {
            // Only use TTY controls if explicitly a TTY (default to false for safety)
            const isTTY = process.stdout.isTTY === true;
            if (isTTY) {
                // readline methods return false on failure, so check return values
                const cursorMoved = readline.cursorTo(process.stdout, 0);
                if (cursorMoved !== false) {
                    this.moveCursorUp(this.lastLineCount);
                    readline.cursorTo(process.stdout, 0);
                    readline.clearScreenDown(process.stdout);
                }
                // If cursorTo failed, skip clearing - don't fall back to clear screen
                // as that would cause flickering
            }
            // For non-TTY, simply don't clear - let output append
            // This is intentional to avoid breaking piped output
        }

        // Render new lines
        const output = lines.join('\n');
        if (output) {
            process.stdout.write(output + '\n');
        }

        // Update state
        this.lastLineCount = lines.length;
    }

    /**
   * Reset the internal state
   */
    reset() {
        this.lastLineCount = 0;
    }
}

module.exports = TerminalRenderer;
