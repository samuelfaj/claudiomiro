/**
 * TerminalRenderer - Handles terminal rendering with cursor control and line management
 */
export declare class TerminalRenderer {
    private lastLineCount;
    constructor();
    /**
     * Hide the terminal cursor
     */
    hideCursor(): void;
    /**
     * Show the terminal cursor
     */
    showCursor(): void;
    /**
     * Move cursor up by specified number of lines
     * @param count - Number of lines to move up
     */
    moveCursorUp(count: number): void;
    /**
     * Get the current terminal width
     * @returns Terminal width in columns
     */
    getTerminalWidth(): number;
    /**
     * Clear specified number of lines
     * @param count - Number of lines to clear
     */
    clearLines(count: number): void;
    /**
     * Clear the entire screen
     */
    clearScreen(): void;
    /**
     * Render a block of lines, clearing previous content
     * @param lines - Array of lines to render
     */
    renderBlock(lines: string[]): void;
    /**
     * Reset the internal state
     */
    reset(): void;
}
//# sourceMappingURL=terminal-renderer.d.ts.map