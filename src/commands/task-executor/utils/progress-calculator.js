/**
 * Calculate the total progress percentage across all parallel tasks based on
 * the number of workflow steps that have already been completed.
 *
 * @param {Object} taskStates - Object mapping task names to state objects {status, step, message}
 * @returns {number} Integer percentage (0-100) representing completed steps
 */
const STEP_SEQUENCE = ['step 2', 'step 3', 'step 4'];

function normalize(value) {
    return value ? value.toString().toLowerCase() : '';
}

function countCompletedSteps(state) {
    if (!state) {
        return 0;
    }

    const normalizedStatus = normalize(state.status);
    if (normalizedStatus === 'completed') {
        return STEP_SEQUENCE.length;
    }

    const normalizedStep = normalize(state.step);
    if (!normalizedStep) {
        return normalizedStatus === 'failed' ? STEP_SEQUENCE.length : 0;
    }

    if (normalizedStep.startsWith('done')) {
        return STEP_SEQUENCE.length;
    }

    for (let i = STEP_SEQUENCE.length - 1; i >= 0; i--) {
        const prefix = STEP_SEQUENCE[i];
        if (normalizedStep.startsWith(prefix)) {
            return i;
        }
    }

    return 0;
}

function calculateProgress(taskStates) {
    if (!taskStates || typeof taskStates !== 'object') {
        return 0;
    }

    const taskNames = Object.keys(taskStates);
    const totalTasks = taskNames.length;

    if (totalTasks === 0) {
        return 0;
    }

    const totalSteps = totalTasks * STEP_SEQUENCE.length;
    if (totalSteps === 0) {
        return 0;
    }

    const completedSteps = taskNames.reduce((sum, taskName) => {
        const state = taskStates[taskName];
        return sum + countCompletedSteps(state);
    }, 0);

    return Math.round((completedSteps / totalSteps) * 100);
}

module.exports = { calculateProgress };
