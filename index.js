#!/usr/bin/env node

const logger = require('./logger');
const { init } = require('./src/cli');

init().catch((error) => {
    logger.newline();
    logger.failSpinner('An error occurred');
    logger.error(error.message);
    logger.newline();
    process.exit(1);
});