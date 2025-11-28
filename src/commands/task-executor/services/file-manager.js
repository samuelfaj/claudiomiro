const fs = require('fs');
const logger = require('../../../shared/utils/logger');
const state = require('../../../shared/config/state');

const startFresh = (createFolder = false) => {
    logger.task('Cleaning up previous files...');
    logger.indent();

    if(fs.existsSync(state.claudiomiroFolder)){
        fs.rmSync(state.claudiomiroFolder, { recursive: true });
        logger.success(`${state.claudiomiroFolder} removed\n`);
    }

    if(createFolder){
        fs.mkdirSync(state.claudiomiroFolder);
    }

    logger.outdent();
};

module.exports = { startFresh };
