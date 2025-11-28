module.exports = {
    // Use Node.js environment for testing
    testEnvironment: 'node',

    // Automatically clear mock calls and instances between every test
    clearMocks: true,

    // Collect coverage information (can be enabled with --coverage flag)
    collectCoverage: false,

    // Coverage output directory
    coverageDirectory: 'coverage',

    // Coverage reporters
    coverageReporters: ['text', 'lcov', 'html'],

    // Patterns to collect coverage from
    collectCoverageFrom: [
        'src/**/*.js',
        'logger.js',
        'index.js',
        '!src/**/*.test.js',
        '!src/**/__tests__/**',
    ],

    // Coverage thresholds (can be enabled later when more tests are added)
    // coverageThreshold: {
    //   global: {
    //     branches: 70,
    //     functions: 70,
    //     lines: 70,
    //     statements: 70
    //   }
    // },

    // Test match patterns
    testMatch: [
        '**/__tests__/**/*.test.js',
        '**/*.test.js',
    ],

    // Ignore mock modules and utility files
    testPathIgnorePatterns: [
        '/node_modules/',
        '/__mocks__/',
        '/test-utils.js$',
    ],

    // Module file extensions
    moduleFileExtensions: ['js', 'json'],

    // Verbose output
    verbose: true,

    // Test timeout (30 seconds for all tests to prevent hanging)
    testTimeout: 30000,

    // Limit worker threads to prevent memory issues
    maxWorkers: 2,
};
