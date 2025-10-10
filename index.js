#!/usr/bin/env node

const logger = require('./logger.js');
const { init } = require('./dist/cli.js');

init().catch(async (error) => {
    await logger.newline();
    await logger.failSpinner('An error occurred');
    await logger.error(error.message);
    await logger.newline();
    process.exit(1);
});