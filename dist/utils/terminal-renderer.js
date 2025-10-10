"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalRenderer = void 0;
const readline = __importStar(require("readline"));
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
     * @param count - Number of lines to move up
     */
    moveCursorUp(count) {
        if (process.stdout && process.stdout.write && count > 0) {
            process.stdout.write(`\x1b[${count}A`);
        }
    }
    /**
     * Get the current terminal width
     * @returns Terminal width in columns
     */
    getTerminalWidth() {
        return process.stdout && process.stdout.columns
            ? process.stdout.columns
            : 80; // Default fallback
    }
    /**
     * Clear specified number of lines
     * @param count - Number of lines to clear
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
     * @param lines - Array of lines to render
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
            const canUseTTYControls = typeof process.stdout.isTTY === 'boolean' ? process.stdout.isTTY : true;
            if (canUseTTYControls) {
                try {
                    readline.cursorTo(process.stdout, 0);
                    this.moveCursorUp(this.lastLineCount);
                    readline.cursorTo(process.stdout, 0);
                    readline.clearScreenDown(process.stdout);
                }
                catch (error) {
                    process.stdout.write('\x1b[2J\x1b[H');
                }
            }
            else {
                process.stdout.write('\x1b[2J\x1b[H');
            }
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
exports.TerminalRenderer = TerminalRenderer;
//# sourceMappingURL=terminal-renderer.js.map