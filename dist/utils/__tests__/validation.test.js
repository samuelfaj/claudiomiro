"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const validation_1 = require("../validation");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
describe('Validation', () => {
    describe('isFullyImplemented', () => {
        it('should return true when file contains "Fully implemented: YES" in first 10 lines', () => {
            const testFile = path_1.default.join(__dirname, 'test-todo.md');
            const content = `Fully implemented: YES

## Implementation Plan
- [ ] Task 1
- [ ] Task 2`;
            fs_1.default.writeFileSync(testFile, content);
            try {
                expect(validation_1.Validation.isFullyImplemented(testFile)).toBe(true);
            }
            finally {
                fs_1.default.unlinkSync(testFile);
            }
        });
        it('should return false when file does not contain "Fully implemented: YES"', () => {
            const testFile = path_1.default.join(__dirname, 'test-todo.md');
            const content = `Fully implemented: NO

## Implementation Plan
- [ ] Task 1
- [ ] Task 2`;
            fs_1.default.writeFileSync(testFile, content);
            try {
                expect(validation_1.Validation.isFullyImplemented(testFile)).toBe(false);
            }
            finally {
                fs_1.default.unlinkSync(testFile);
            }
        });
        it('should return false when "Fully implemented: YES" is inside a task', () => {
            const testFile = path_1.default.join(__dirname, 'test-todo.md');
            const content = `Fully implemented: NO

## Implementation Plan
- [ ] Fully implemented: YES
- [ ] Task 2`;
            fs_1.default.writeFileSync(testFile, content);
            try {
                expect(validation_1.Validation.isFullyImplemented(testFile)).toBe(false);
            }
            finally {
                fs_1.default.unlinkSync(testFile);
            }
        });
        it('should handle file not found gracefully', () => {
            expect(() => {
                validation_1.Validation.isFullyImplemented('/nonexistent/file.md');
            }).toThrow();
        });
    });
    describe('hasApprovedCodeReview', () => {
        it('should return true when file contains "approved" in status section', () => {
            const testFile = path_1.default.join(__dirname, 'test-review.md');
            const content = `# Code Review

## Status
Approved by team lead

## Comments
Looks good!`;
            fs_1.default.writeFileSync(testFile, content);
            try {
                expect(validation_1.Validation.hasApprovedCodeReview(testFile)).toBe(true);
            }
            finally {
                fs_1.default.unlinkSync(testFile);
            }
        });
        it('should return false when file does not contain status section', () => {
            const testFile = path_1.default.join(__dirname, 'test-review.md');
            const content = `# Code Review

## Comments
Looks good!`;
            fs_1.default.writeFileSync(testFile, content);
            try {
                expect(validation_1.Validation.hasApprovedCodeReview(testFile)).toBe(false);
            }
            finally {
                fs_1.default.unlinkSync(testFile);
            }
        });
        it('should return false when file does not exist', () => {
            expect(validation_1.Validation.hasApprovedCodeReview('/nonexistent/file.md')).toBe(false);
        });
        it('should return false when status section does not contain "approved"', () => {
            const testFile = path_1.default.join(__dirname, 'test-review.md');
            const content = `# Code Review

## Status
Needs changes

## Comments
Please fix these issues.`;
            fs_1.default.writeFileSync(testFile, content);
            try {
                expect(validation_1.Validation.hasApprovedCodeReview(testFile)).toBe(false);
            }
            finally {
                fs_1.default.unlinkSync(testFile);
            }
        });
    });
    // Type safety tests
    describe('Type safety', () => {
        it('should have proper parameter types', () => {
            // This test verifies TypeScript type checking at compile time
            // Create a temporary test file
            const testFile = '/tmp/test-type-safety.md';
            const fs = require('fs');
            fs.writeFileSync(testFile, 'Test content');
            try {
                // These should compile without type errors
                const result1 = validation_1.Validation.isFullyImplemented(testFile);
                const result2 = validation_1.Validation.hasApprovedCodeReview(testFile);
                expect(typeof result1).toBe('boolean');
                expect(typeof result2).toBe('boolean');
            }
            finally {
                // Clean up
                if (fs.existsSync(testFile)) {
                    fs.unlinkSync(testFile);
                }
            }
        });
    });
});
//# sourceMappingURL=validation.test.js.map