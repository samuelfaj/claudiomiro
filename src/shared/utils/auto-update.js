const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Gets the current package version
 */
function getCurrentVersion() {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
}

/**
 * Gets the latest version available on npm
 */
async function getLatestVersion(packageName) {
    try {
        const result = execSync(`npm view ${packageName} version`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return result.trim();
    } catch (error) {
        // If there's an error querying npm, return null
        return null;
    }
}

/**
 * Checks if updates are available and notifies the user
 */
async function checkForUpdates(packageName = 'claudiomiro', options = {}) {
    const { silent = false, autoUpdate = false } = options;

    try {
        const currentVersion = getCurrentVersion();
        const latestVersion = await getLatestVersion(packageName);

        if (!latestVersion) {
            // Could not check for updates
            return { updateAvailable: false, currentVersion, latestVersion: null };
        }

        // If versions are different, an update is available
        if (latestVersion !== currentVersion) {
            // A new version is available
            if (!silent) {
                logger.newline();
                logger.warning(`${'─'.repeat(60)}`);
                logger.warning(`Update available: ${currentVersion} → ${latestVersion}${' '.repeat(60 - 36 - currentVersion.length - latestVersion.length)}`);
                logger.warning(`Run: npm install -g ${packageName}@latest`);
                logger.warning(`${'─'.repeat(60)}`);
                logger.newline();
            }

            if (autoUpdate) {
                logger.info('Auto-updating...');
                try {
                    execSync(`npm install -g ${packageName}@latest`, {
                        stdio: 'inherit',
                    });
                    logger.success(`Successfully updated to version ${latestVersion}`);
                    logger.info('Please restart the command.');
                    process.exit(0);
                } catch (error) {
                    logger.error('Failed to auto-update. Please update manually.');
                }
            }

            return { updateAvailable: true, currentVersion, latestVersion };
        }

        return { updateAvailable: false, currentVersion, latestVersion };
    } catch (error) {
        // In case of error, don't interrupt execution
        return { updateAvailable: false, currentVersion: getCurrentVersion(), latestVersion: null, error: error.message };
    }
}

/**
 * Checks for updates in a non-blocking way
 * Shows notification if an update is available
 */
function checkForUpdatesAsync(packageName = 'claudiomiro', options = {}) {
    // Execute the check in the background without blocking execution
    // Using unhandled promise to avoid blocking the main execution
    checkForUpdates(packageName, options).catch(() => {
        // Ignore errors silently
    });
}

module.exports = {
    checkForUpdates,
    checkForUpdatesAsync,
    getCurrentVersion,
    getLatestVersion,
};
