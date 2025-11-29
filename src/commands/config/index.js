/**
 * Config Command
 * Interactive configuration management for Claudiomiro
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { select, input, confirm } = require('@inquirer/prompts');

// Config directory in user's home (persists across updates)
const CONFIG_DIR = path.join(require('os').homedir(), '.claudiomiro');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Legacy config location (for migration)
const LEGACY_PACKAGE_ROOT = path.resolve(__dirname, '..', '..', '..');
const LEGACY_CONFIG_FILE = path.join(LEGACY_PACKAGE_ROOT, 'claudiomiro.config.json');

const CONFIG_SCHEMA = {
    CLAUDIOMIRO_LOCAL_LLM: {
        name: 'Local LLM Model',
        description: 'Ollama model for local LLM co-pilot (e.g., qwen2.5-coder:7b)',
        type: 'string',
        default: '',
        examples: ['qwen2.5-coder:7b', 'codellama:7b', 'deepseek-coder:6.7b'],
    },
    OLLAMA_HOST: {
        name: 'Ollama Host',
        description: 'Ollama server hostname',
        type: 'string',
        default: 'localhost',
    },
    OLLAMA_PORT: {
        name: 'Ollama Port',
        description: 'Ollama server port',
        type: 'number',
        default: '11434',
    },
    OLLAMA_TIMEOUT: {
        name: 'Ollama Timeout',
        description: 'Request timeout in milliseconds',
        type: 'number',
        default: '30000',
    },
    CLAUDIOMIRO_LLM_CACHE: {
        name: 'LLM Response Cache',
        description: 'Enable caching of LLM responses',
        type: 'boolean',
        default: 'true',
    },
    CLAUDIOMIRO_EXECUTOR: {
        name: 'Default AI Executor',
        description: 'Default AI model to use',
        type: 'choice',
        choices: ['claude', 'codex', 'gemini', 'deepseek', 'glm'],
        default: 'claude',
    },
};

const MENU_OPTIONS = {
    VIEW: 'view',
    EDIT: 'edit',
    RESET: 'reset',
    EXPORT: 'export',
    EXIT: 'exit',
};

/**
 * Ensure config directory exists
 */
const ensureConfigDir = () => {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
};

/**
 * Migrate legacy config from package root to user home directory
 * This runs automatically when loading config
 */
const migrateLegacyConfig = () => {
    try {
        // Check if legacy config exists and new config doesn't
        if (fs.existsSync(LEGACY_CONFIG_FILE) && !fs.existsSync(CONFIG_FILE)) {
            ensureConfigDir();
            const legacyContent = fs.readFileSync(LEGACY_CONFIG_FILE, 'utf-8');
            fs.writeFileSync(CONFIG_FILE, legacyContent);
            // Remove legacy config after successful migration
            fs.unlinkSync(LEGACY_CONFIG_FILE);
            return true;
        }
    } catch (error) {
        // Migration failed, but we can continue with empty config
    }
    return false;
};

/**
 * Load configuration from file
 * @returns {Object}
 */
const loadConfig = () => {
    try {
        // Attempt migration from legacy location
        migrateLegacyConfig();

        if (fs.existsSync(CONFIG_FILE)) {
            const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(content);
        }
    } catch (error) {
        // Ignore errors, return empty config
    }
    return {};
};

/**
 * Save configuration to file
 * @param {Object} config
 */
const saveConfig = (config) => {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
};

/**
 * Apply config to environment variables
 * @param {Object} config
 */
const applyConfigToEnv = (config) => {
    for (const [key, value] of Object.entries(config)) {
        if (value !== undefined && value !== null && value !== '') {
            process.env[key] = String(value);
        }
    }
};

/**
 * Get config value with default fallback
 */
const _getConfigValue = (config, key) => {
    if (config[key] !== undefined && config[key] !== '') {
        return config[key];
    }
    return CONFIG_SCHEMA[key]?.default || '';
};

/**
 * Print header
 */
const printHeader = () => {
    console.log();
    console.log(chalk.bold.cyan('  Claudiomiro Configuration'));
    console.log(chalk.gray(`  Config file: ${CONFIG_FILE}`));
    console.log();
};

/**
 * Print current configuration
 */
const printConfig = (config) => {
    console.log(chalk.bold.yellow('  Current Configuration'));
    console.log();

    for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
        const value = config[key];
        const hasValue = value !== undefined && value !== '';
        const displayValue = hasValue ? value : chalk.gray(`(default: ${schema.default || 'not set'})`);
        const status = hasValue ? chalk.green('*') : chalk.gray('○');

        console.log(`    ${status} ${chalk.cyan(schema.name)}`);
        console.log(`      ${key}=${displayValue}`);
        console.log();
    }
};

/**
 * Edit a specific configuration value
 */
const editConfigValue = async (config, key) => {
    const schema = CONFIG_SCHEMA[key];
    const currentValue = config[key] || '';

    console.log();
    console.log(chalk.cyan(`  ${schema.name}`));
    console.log(chalk.gray(`  ${schema.description}`));

    if (schema.examples) {
        console.log(chalk.gray(`  Examples: ${schema.examples.join(', ')}`));
    }
    console.log();

    let newValue;

    if (schema.type === 'boolean') {
        newValue = await select({
            message: `Set ${key}:`,
            choices: [
                { name: 'Enabled (true)', value: 'true' },
                { name: 'Disabled (false)', value: 'false' },
                { name: 'Use default', value: '' },
            ],
            default: currentValue || '',
        });
    } else if (schema.type === 'choice') {
        const choices = schema.choices.map(c => ({ name: c, value: c }));
        choices.push({ name: 'Use default', value: '' });

        newValue = await select({
            message: `Select ${key}:`,
            choices,
            default: currentValue || '',
        });
    } else {
        newValue = await input({
            message: `Enter value for ${key}:`,
            default: currentValue,
            validate: (val) => {
                if (schema.type === 'number' && val && isNaN(Number(val))) {
                    return 'Please enter a valid number';
                }
                return true;
            },
        });
    }

    if (newValue === '' || newValue === undefined) {
        delete config[key];
    } else {
        config[key] = newValue;
    }

    return config;
};

/**
 * Show edit menu with all config options
 */
const showEditMenu = async (config) => {
    const choices = Object.entries(CONFIG_SCHEMA).map(([key, schema]) => {
        const value = config[key];
        const hasValue = value !== undefined && value !== '';
        const status = hasValue ? chalk.green('*') : chalk.gray('○');
        const displayValue = hasValue ? chalk.cyan(value) : chalk.gray('not set');

        return {
            name: `${status} ${schema.name} ${chalk.gray(`[${displayValue}]`)}`,
            value: key,
        };
    });

    choices.push({ name: chalk.yellow('← Back to main menu'), value: 'back' });

    const selected = await select({
        message: 'Select setting to edit:',
        choices,
        pageSize: 10,
    });

    return selected;
};

/**
 * Export config as shell commands
 */
const exportConfig = (config) => {
    console.log();
    console.log(chalk.bold.yellow('  Export Configuration'));
    console.log(chalk.gray('  Add these lines to your ~/.bashrc or ~/.zshrc:'));
    console.log();

    for (const [key, value] of Object.entries(config)) {
        if (value !== undefined && value !== '') {
            console.log(chalk.cyan(`    export ${key}="${value}"`));
        }
    }

    console.log();
    console.log(chalk.gray('  Or run claudiomiro commands with these variables:'));
    console.log();

    const envString = Object.entries(config)
        .filter(([_, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');

    if (envString) {
        console.log(chalk.cyan(`    ${envString} claudiomiro`));
    }
    console.log();
};

/**
 * Reset configuration
 */
const resetConfig = async () => {
    const confirmed = await confirm({
        message: 'Are you sure you want to reset all configuration to defaults?',
        default: false,
    });

    if (confirmed) {
        if (fs.existsSync(CONFIG_FILE)) {
            fs.unlinkSync(CONFIG_FILE);
        }
        console.log(chalk.green('\n  Configuration reset to defaults.\n'));
        return {};
    }

    return null; // No change
};

/**
 * Show main menu
 */
const showMainMenu = async () => {
    return await select({
        message: 'What would you like to do?',
        choices: [
            { name: `${chalk.green('*')} View current configuration`, value: MENU_OPTIONS.VIEW },
            { name: `${chalk.cyan('*')} Edit configuration`, value: MENU_OPTIONS.EDIT },
            { name: `${chalk.yellow('*')} Export as shell commands`, value: MENU_OPTIONS.EXPORT },
            { name: `${chalk.red('*')} Reset to defaults`, value: MENU_OPTIONS.RESET },
            { name: `${chalk.gray('←')} Exit`, value: MENU_OPTIONS.EXIT },
        ],
    });
};

/**
 * Main run function
 */
const run = async (args) => {
    printHeader();

    let config = loadConfig();
    let running = true;

    // Check for quick set via args: --config KEY=VALUE
    const setArg = args.find(arg => arg.includes('=') && !arg.startsWith('--config'));
    if (setArg) {
        const [key, ...valueParts] = setArg.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');

        if (CONFIG_SCHEMA[key]) {
            config[key] = value;
            saveConfig(config);
            console.log(chalk.green(`  Set ${key}=${value}`));
            console.log();
            return;
        }
    }

    while (running) {
        try {
            const action = await showMainMenu();

            switch (action) {
                case MENU_OPTIONS.VIEW:
                    printConfig(config);
                    break;

                case MENU_OPTIONS.EDIT: {
                    let editing = true;
                    while (editing) {
                        const selectedKey = await showEditMenu(config);
                        if (selectedKey === 'back') {
                            editing = false;
                        } else {
                            config = await editConfigValue(config, selectedKey);
                            saveConfig(config);
                            console.log(chalk.green('\n  Configuration saved.\n'));
                        }
                    }
                    break;
                }

                case MENU_OPTIONS.EXPORT:
                    exportConfig(config);
                    break;

                case MENU_OPTIONS.RESET: {
                    const newConfig = await resetConfig();
                    if (newConfig !== null) {
                        config = newConfig;
                    }
                    break;
                }

                case MENU_OPTIONS.EXIT:
                    running = false;
                    console.log(chalk.gray('\n  Configuration saved. Goodbye!\n'));
                    break;
            }
        } catch (error) {
            // User pressed Ctrl+C or other interrupt
            if (error.name === 'ExitPromptError' || error.message?.includes('User force closed')) {
                running = false;
                console.log(chalk.gray('\n  Goodbye!\n'));
            } else {
                throw error;
            }
        }
    }
};

module.exports = {
    run,
    loadConfig,
    saveConfig,
    applyConfigToEnv,
    ensureConfigDir,
    migrateLegacyConfig,
    CONFIG_FILE,
    CONFIG_DIR,
    LEGACY_CONFIG_FILE,
    CONFIG_SCHEMA,
};
