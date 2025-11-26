const { init } = require('./cli');

const run = async (args) => {
    await init(args);
};

module.exports = { run };
