const fs = require('fs');
const logger = require('../../logger');
const state = require('../config/state');

const startFresh = (createFolder = false) => {
    logger.task('Cleaning up previous files...');
    logger.indent();

    if(fs.existsSync(state.claudiomiroFolder)){
        fs.rmSync(state.claudiomiroFolder);
        logger.success(`${state.claudiomiroFolder} removed`);
    }

    if(createFolder){
        fs.mkdirSync(state.claudiomiroFolder);
    }

    logger.outdent();
}

module.exports = { startFresh };
