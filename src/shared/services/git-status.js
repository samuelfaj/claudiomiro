const { spawn } = require('child_process');

const gitStatus = async () => {
    return new Promise((resolve, reject) => {
        const git = spawn('git', ['status']);
        let stdout = '';
        let stderr = '';

        git.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        git.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        git.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr));
            } else {
                resolve(stdout);
            }
        });
    });
};

module.exports = { gitStatus };
