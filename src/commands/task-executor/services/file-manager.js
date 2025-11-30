const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../../../shared/utils/logger');
const state = require('../../../shared/config/state');

const startFresh = (createFolder = false) => {
    logger.task('Cleaning up previous files...');
    logger.indent();

    try {
        let folderEnsured = false;

        if(fs.existsSync(state.claudiomiroFolder)){
            const insightsFolder = path.join(state.claudiomiroFolder, 'insights');
            let hasInsights = false;

            if (fs.existsSync(insightsFolder)) {
                try {
                    const entries = fs.readdirSync(insightsFolder) || [];
                    hasInsights = Array.isArray(entries) ? entries.length > 0 : Object.keys(entries).length > 0;
                } catch (error) {
                    hasInsights = false;
                }
            }
            let insightsBackup = null;

            if (hasInsights) {
                insightsBackup = path.join(os.tmpdir(), `claudiomiro-insights-${Date.now()}`);
                fs.cpSync(insightsFolder, insightsBackup, { recursive: true });
            }

            fs.rmSync(state.claudiomiroFolder, { recursive: true });
            logger.success(`${state.claudiomiroFolder} removed\n`);

            if (insightsBackup) {
                fs.mkdirSync(state.claudiomiroFolder, { recursive: true });
                folderEnsured = true;
                fs.cpSync(insightsBackup, insightsFolder, { recursive: true });
                fs.rmSync(insightsBackup, { recursive: true });
                logger.info(`Insights preserved in ${insightsFolder}`);
            }
        }

        if(createFolder && !folderEnsured){
            fs.mkdirSync(state.claudiomiroFolder, { recursive: true });
            folderEnsured = true;
        }
    } finally {
        logger.outdent();
    }
};

module.exports = { startFresh };
