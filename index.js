#!/usr/bin/env node

const logger = require('./src/utils/logger');
const { init } = require('./src/utils/cli');

init().catch((error) => {
    logger.newline();
    logger.failSpinner('An error occurred');
    logger.error(error.message);
    logger.newline();
    process.exit(1);
});