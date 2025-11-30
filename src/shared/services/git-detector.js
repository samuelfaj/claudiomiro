const { execSync } = require('child_process');
const path = require('path');

const findGitRoot = (dirPath) => {
    try {
        const result = execSync('git rev-parse --show-toplevel', {
            cwd: path.resolve(dirPath),
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return result.trim();
    } catch {
        return null;
    }
};

const detectGitConfiguration = (backendPath, frontendPath) => {
    const backendGitRoot = findGitRoot(backendPath);
    const frontendGitRoot = findGitRoot(frontendPath);

    if (!backendGitRoot || !frontendGitRoot) {
        throw new Error('Both paths must be inside git repositories');
    }

    return backendGitRoot === frontendGitRoot
        ? { mode: 'monorepo', gitRoots: [backendGitRoot] }
        : { mode: 'separate', gitRoots: [backendGitRoot, frontendGitRoot] };
};

module.exports = { findGitRoot, detectGitConfiguration };
