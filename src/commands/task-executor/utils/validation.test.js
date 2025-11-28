const fs = require('fs');
const { isFullyImplemented } = require('./validation');

jest.mock('fs');

describe('validation', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('isFullyImplemented', () => {
        describe('basic detection', () => {
            test('should return true for exact match "fully implemented: yes"', () => {
                fs.readFileSync.mockReturnValue('Fully implemented: YES\n\nSome other content');
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should return true for "fully implemented: yes" with extra spacing', () => {
                fs.readFileSync.mockReturnValue('  Fully implemented: YES  \n\nSome content');
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should return true for lowercase "fully implemented: yes"', () => {
                fs.readFileSync.mockReturnValue('fully implemented: yes\n\nContent here');
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should return true for mixed case "Fully Implemented: Yes"', () => {
                fs.readFileSync.mockReturnValue('Fully Implemented: Yes\n\nMore content');
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should return true for uppercase "FULLY IMPLEMENTED: YES"', () => {
                fs.readFileSync.mockReturnValue('FULLY IMPLEMENTED: YES\n\nContent');
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should return false for "fully implemented: no"', () => {
                fs.readFileSync.mockReturnValue('Fully implemented: NO\n\nSome content');
                expect(isFullyImplemented('test.md')).toBe(false);
            });

            test('should return false for "fully implemented: maybe"', () => {
                fs.readFileSync.mockReturnValue('Fully implemented: maybe\n\nSome content');
                expect(isFullyImplemented('test.md')).toBe(false);
            });
        });

        describe('task list filtering', () => {
            test('should ignore "fully implemented: yes" inside task items', () => {
                fs.readFileSync.mockReturnValue('- [ ] Task with fully implemented: yes\n\nContent');
                expect(isFullyImplemented('test.md')).toBe(false);
            });

            test('should ignore "fully implemented: yes" in checked task items', () => {
                fs.readFileSync.mockReturnValue('- [x] Task with fully implemented: yes\n\nContent');
                expect(isFullyImplemented('test.md')).toBe(false);
            });

            test('should detect "fully implemented: yes" that is not part of a task', () => {
                fs.readFileSync.mockReturnValue('Fully implemented: yes\n- [ ] Some task\n- [ ] Another task');
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should ignore task items but detect standalone declaration', () => {
                fs.readFileSync.mockReturnValue('- [ ] fully implemented: no\nFully implemented: yes\n- [ ] Task');
                expect(isFullyImplemented('test.md')).toBe(true);
            });
        });

        describe('first 10 lines limitation', () => {
            test('should detect "fully implemented: yes" within first 10 lines', () => {
                const lines = [
                    'Line 1',
                    'Line 2',
                    'Line 3',
                    'Fully implemented: yes',
                    'Line 5',
                    'Line 6',
                    'Line 7',
                    'Line 8',
                    'Line 9',
                    'Line 10',
                ];
                fs.readFileSync.mockReturnValue(lines.join('\n'));
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should not detect "fully implemented: yes" after line 10', () => {
                const lines = [
                    'Line 1',
                    'Line 2',
                    'Line 3',
                    'Line 4',
                    'Line 5',
                    'Line 6',
                    'Line 7',
                    'Line 8',
                    'Line 9',
                    'Line 10',
                    'Fully implemented: yes',
                    'Line 12',
                ];
                fs.readFileSync.mockReturnValue(lines.join('\n'));
                expect(isFullyImplemented('test.md')).toBe(false);
            });

            test('should check exactly first 10 lines only', () => {
                const lines = Array(20).fill('Line').map((l, i) => `${l} ${i + 1}`);
                lines[0] = 'Fully implemented: yes';
                fs.readFileSync.mockReturnValue(lines.join('\n'));
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should handle files with fewer than 10 lines', () => {
                fs.readFileSync.mockReturnValue('Line 1\nLine 2\nFully implemented: yes');
                expect(isFullyImplemented('test.md')).toBe(true);
            });
        });

        describe('edge cases and error handling', () => {
            test('should handle empty file', () => {
                fs.readFileSync.mockReturnValue('');
                expect(isFullyImplemented('test.md')).toBe(false);
            });

            test('should handle file with only whitespace', () => {
                fs.readFileSync.mockReturnValue('   \n  \n   \n');
                expect(isFullyImplemented('test.md')).toBe(false);
            });

            test('should handle file with only newlines', () => {
                fs.readFileSync.mockReturnValue('\n\n\n\n');
                expect(isFullyImplemented('test.md')).toBe(false);
            });

            test('should throw error for non-existent file', () => {
                fs.readFileSync.mockImplementation(() => {
                    throw new Error('ENOENT: no such file or directory');
                });
                expect(() => isFullyImplemented('nonexistent.md')).toThrow();
            });

            test('should throw error for file read permission errors', () => {
                fs.readFileSync.mockImplementation(() => {
                    throw new Error('EACCES: permission denied');
                });
                expect(() => isFullyImplemented('noperm.md')).toThrow();
            });

            test('should handle very long lines', () => {
                const longLine = 'x'.repeat(10000);
                fs.readFileSync.mockReturnValue(`${longLine}\nFully implemented: yes`);
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should handle special characters', () => {
                fs.readFileSync.mockReturnValue('Fully implemented: yes\n!@#$%^&*()_+-={}[]|\\:";\'<>?,./');
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should handle Unicode content', () => {
                fs.readFileSync.mockReturnValue('Fully implemented: yes\n你好世界\nПривет мир\n🎉🎊');
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should handle emoji in content', () => {
                fs.readFileSync.mockReturnValue('Fully implemented: yes 🚀\nMore content');
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should handle tabs and special whitespace', () => {
                fs.readFileSync.mockReturnValue('\t\tFully implemented: yes\t\t\nContent');
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should handle CRLF line endings', () => {
                fs.readFileSync.mockReturnValue('Fully implemented: yes\r\nLine 2\r\nLine 3');
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should handle mixed line endings', () => {
                fs.readFileSync.mockReturnValue('Fully implemented: yes\r\nLine 2\nLine 3');
                expect(isFullyImplemented('test.md')).toBe(true);
            });
        });

        describe('malformed content', () => {
            test('should return false for partial match "fully implemented:"', () => {
                fs.readFileSync.mockReturnValue('Fully implemented:\n\nContent');
                expect(isFullyImplemented('test.md')).toBe(false);
            });

            test('should return false for "fully: yes"', () => {
                fs.readFileSync.mockReturnValue('Fully: yes\n\nContent');
                expect(isFullyImplemented('test.md')).toBe(false);
            });

            test('should return false for "implemented: yes"', () => {
                fs.readFileSync.mockReturnValue('Implemented: yes\n\nContent');
                expect(isFullyImplemented('test.md')).toBe(false);
            });

            test('should handle content without the marker', () => {
                fs.readFileSync.mockReturnValue('Some random content\nNo markers here\nJust text');
                expect(isFullyImplemented('test.md')).toBe(false);
            });
        });

        describe('multi-line and formatting variations', () => {
            test('should handle "fully implemented: yes" on first line', () => {
                fs.readFileSync.mockReturnValue('Fully implemented: yes\nLine 2\nLine 3');
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should handle "fully implemented: yes" on last checked line (line 10)', () => {
                const lines = Array(9).fill('Line');
                lines.push('Fully implemented: yes');
                fs.readFileSync.mockReturnValue(lines.join('\n'));
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should handle multiple occurrences within first 10 lines', () => {
                fs.readFileSync.mockReturnValue('Fully implemented: yes\nContent\nFully implemented: yes');
                expect(isFullyImplemented('test.md')).toBe(true);
            });

            test('should not match text before "fully implemented: yes" on same line', () => {
                fs.readFileSync.mockReturnValue('Status: Fully implemented: yes\nContent');
                expect(isFullyImplemented('test.md')).toBe(false);
            });

            test('should detect with various spacing around colon', () => {
                fs.readFileSync.mockReturnValue('Fully implemented:yes\nContent');
                expect(isFullyImplemented('test.md')).toBe(false);
            });
        });
    });
});
