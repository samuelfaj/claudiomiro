const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Lazy-loaded schema and validator (cached after first load)
let cachedValidator = null;
let schemaLoadError = null;

// Lazy-loaded review checklist validator (cached after first load)
let cachedReviewChecklistValidator = null;
let reviewChecklistSchemaLoadError = null;

// Valid enum values for schema fields
const VALID_STATUS_VALUES = ['pending', 'in_progress', 'completed', 'blocked'];
const VALID_CONFIDENCE_VALUES = ['LOW', 'MEDIUM', 'HIGH'];
const VALID_ARTIFACT_TYPES = ['created', 'modified'];
const VALID_COMPLETION_STATUSES = ['pending_validation', 'completed', 'blocked', 'failed'];
const VALID_TEST_TYPES = ['AUTO', 'MANUAL', 'BOTH'];

/**
 * Repairs an execution.json object by filling in missing required fields
 * and normalizing values to valid formats.
 *
 * This function handles common issues:
 * - Missing required fields get default values
 * - Invalid enum values get normalized
 * - preConditions/items arrays get properly structured
 * - Nested objects get required fields filled in
 *
 * @param {object} data - The execution data to repair
 * @returns {object} Repaired data
 */
const repairExecutionJson = (data) => {
    if (!data || typeof data !== 'object') {
        return data;
    }

    const repaired = { ...data };

    // Ensure required top-level fields
    if (!repaired.$schema) {
        repaired.$schema = 'execution-schema-v1';
    }
    if (!repaired.version) {
        repaired.version = '1.0';
    }
    if (!repaired.task || typeof repaired.task !== 'string') {
        repaired.task = repaired.task || 'TASK0';
    }
    if (!repaired.title) {
        repaired.title = repaired.title || 'Untitled Task';
    }
    if (!repaired.status || !VALID_STATUS_VALUES.includes(repaired.status)) {
        repaired.status = 'pending';
    }
    if (!repaired.started) {
        repaired.started = new Date().toISOString();
    }
    if (typeof repaired.attempts !== 'number' || repaired.attempts < 0) {
        repaired.attempts = repaired.attempts >= 0 ? Math.floor(repaired.attempts) : 0;
    }

    // Repair phases array
    if (Array.isArray(repaired.phases)) {
        repaired.phases = repaired.phases.map((phase, idx) => repairPhase(phase, idx + 1));
    }

    // Repair currentPhase
    if (repaired.currentPhase && typeof repaired.currentPhase === 'object') {
        repaired.currentPhase = repairCurrentPhase(repaired.currentPhase);
    }

    // Repair errorHistory
    if (Array.isArray(repaired.errorHistory)) {
        repaired.errorHistory = repaired.errorHistory.map(repairErrorHistoryEntry);
    }

    // Repair uncertainties
    if (Array.isArray(repaired.uncertainties)) {
        repaired.uncertainties = repaired.uncertainties.map((u, idx) => repairUncertainty(u, idx));
    }

    // Repair artifacts
    if (Array.isArray(repaired.artifacts)) {
        repaired.artifacts = repaired.artifacts.map(repairArtifact);
    }

    // Repair successCriteria
    if (Array.isArray(repaired.successCriteria)) {
        repaired.successCriteria = repaired.successCriteria.map(repairSuccessCriterion);
    }

    // Repair beyondTheBasics
    if (repaired.beyondTheBasics && typeof repaired.beyondTheBasics === 'object') {
        repaired.beyondTheBasics = repairBeyondTheBasics(repaired.beyondTheBasics);
    }

    // Repair completion
    if (repaired.completion && typeof repaired.completion === 'object') {
        repaired.completion = repairCompletion(repaired.completion);
    }

    return repaired;
};

/**
 * Repairs a phase object
 */
const repairPhase = (phase, defaultId) => {
    if (!phase || typeof phase !== 'object') {
        return {
            id: defaultId,
            name: `Phase ${defaultId}`,
            status: 'pending',
        };
    }

    const repaired = { ...phase };

    if (typeof repaired.id !== 'number' || repaired.id < 1) {
        repaired.id = defaultId;
    }
    if (!repaired.name || typeof repaired.name !== 'string') {
        repaired.name = `Phase ${repaired.id}`;
    }
    if (!repaired.status || !VALID_STATUS_VALUES.includes(repaired.status)) {
        repaired.status = 'pending';
    }

    // Repair preConditions
    if (Array.isArray(repaired.preConditions)) {
        repaired.preConditions = repaired.preConditions.map(repairPreCondition);
    }

    // Repair items
    if (Array.isArray(repaired.items)) {
        repaired.items = repaired.items.map(repairPhaseItem);
    }

    return repaired;
};

/**
 * Repairs a preCondition object - the key fix for the reported error
 */
const repairPreCondition = (pc) => {
    if (!pc || typeof pc !== 'object') {
        return {
            check: 'Unknown check',
            command: 'echo "no command specified"',
            expected: '',
            passed: false,
            evidence: null,
        };
    }

    const repaired = { ...pc };

    // Ensure required fields exist
    if (!repaired.check || typeof repaired.check !== 'string') {
        repaired.check = repaired.description || repaired.name || 'Unknown check';
    }
    if (!repaired.command || typeof repaired.command !== 'string') {
        // Try to infer from other fields or set a no-op command
        repaired.command = repaired.cmd || 'echo "no command specified"';
    }
    if (repaired.expected === undefined || repaired.expected === null) {
        // Empty string is valid - means any output is acceptable
        repaired.expected = '';
    }
    if (typeof repaired.expected !== 'string') {
        repaired.expected = String(repaired.expected);
    }
    if (typeof repaired.passed !== 'boolean') {
        repaired.passed = false;
    }
    // evidence can be null
    if (repaired.evidence !== undefined && repaired.evidence !== null && typeof repaired.evidence !== 'string') {
        repaired.evidence = String(repaired.evidence);
    }

    return repaired;
};

/**
 * Repairs a phase item object
 */
const repairPhaseItem = (item) => {
    if (!item || typeof item !== 'object') {
        return {
            description: 'Unknown item',
            completed: false,
        };
    }

    const repaired = { ...item };

    if (!repaired.description || typeof repaired.description !== 'string') {
        repaired.description = repaired.name || repaired.task || 'Unknown item';
    }
    if (typeof repaired.completed !== 'boolean') {
        repaired.completed = false;
    }

    return repaired;
};

/**
 * Repairs currentPhase object
 */
const repairCurrentPhase = (cp) => {
    if (!cp || typeof cp !== 'object') {
        return { id: 1, name: 'Phase 1' };
    }

    const repaired = { ...cp };

    if (typeof repaired.id !== 'number' || repaired.id < 1) {
        repaired.id = 1;
    }
    if (!repaired.name || typeof repaired.name !== 'string') {
        repaired.name = `Phase ${repaired.id}`;
    }

    return repaired;
};

/**
 * Repairs errorHistory entry
 */
const repairErrorHistoryEntry = (entry) => {
    if (!entry || typeof entry !== 'object') {
        return {
            timestamp: new Date().toISOString(),
            message: 'Unknown error',
        };
    }

    const repaired = { ...entry };

    if (!repaired.timestamp) {
        repaired.timestamp = new Date().toISOString();
    }
    if (!repaired.message || typeof repaired.message !== 'string') {
        repaired.message = repaired.error || 'Unknown error';
    }

    return repaired;
};

/**
 * Repairs uncertainty object
 */
const repairUncertainty = (u, idx) => {
    if (!u || typeof u !== 'object') {
        return {
            id: `U${idx + 1}`,
            topic: 'Unknown',
            assumption: 'Unknown',
            confidence: 'MEDIUM',
            resolution: null,
            resolvedConfidence: null,
        };
    }

    const repaired = { ...u };

    if (!repaired.id || typeof repaired.id !== 'string') {
        repaired.id = `U${idx + 1}`;
    }
    if (!repaired.topic) {
        repaired.topic = 'Unknown';
    }
    if (!repaired.assumption) {
        repaired.assumption = 'Unknown';
    }
    if (!repaired.confidence || !VALID_CONFIDENCE_VALUES.includes(repaired.confidence)) {
        repaired.confidence = 'MEDIUM';
    }
    // Ensure resolution is explicitly null if not set
    if (repaired.resolution === undefined) {
        repaired.resolution = null;
    }
    // Ensure resolvedConfidence is null if invalid or undefined
    if (repaired.resolvedConfidence === undefined) {
        repaired.resolvedConfidence = null;
    } else if (repaired.resolvedConfidence !== null && !VALID_CONFIDENCE_VALUES.includes(repaired.resolvedConfidence)) {
        repaired.resolvedConfidence = null;
    }

    return repaired;
};

/**
 * Repairs artifact object
 */
const repairArtifact = (artifact) => {
    if (!artifact || typeof artifact !== 'object') {
        return {
            type: 'modified',
            path: 'unknown',
            verified: false,
        };
    }

    const repaired = { ...artifact };

    if (!repaired.type || !VALID_ARTIFACT_TYPES.includes(repaired.type)) {
        repaired.type = 'modified';
    }
    if (!repaired.path || typeof repaired.path !== 'string') {
        repaired.path = repaired.file || 'unknown';
    }
    if (typeof repaired.verified !== 'boolean') {
        repaired.verified = false;
    }

    return repaired;
};

/**
 * Repairs success criterion object
 */
const repairSuccessCriterion = (criterion) => {
    if (!criterion || typeof criterion !== 'object') {
        return {
            criterion: 'Unknown criterion',
            passed: false,
        };
    }

    const repaired = { ...criterion };

    if (!repaired.criterion || typeof repaired.criterion !== 'string') {
        repaired.criterion = repaired.check || repaired.description || 'Unknown criterion';
    }
    if (repaired.passed !== null && typeof repaired.passed !== 'boolean') {
        repaired.passed = false;
    }
    if (repaired.testType !== null && repaired.testType !== undefined && !VALID_TEST_TYPES.includes(repaired.testType)) {
        repaired.testType = null;
    }

    return repaired;
};

/**
 * Repairs beyondTheBasics object
 */
const repairBeyondTheBasics = (btb) => {
    if (!btb || typeof btb !== 'object') {
        return {};
    }

    const repaired = { ...btb };

    if (repaired.cleanup && typeof repaired.cleanup === 'object') {
        const cleanup = { ...repaired.cleanup };
        if (typeof cleanup.debugLogsRemoved !== 'boolean') {
            cleanup.debugLogsRemoved = false;
        }
        if (typeof cleanup.formattingConsistent !== 'boolean') {
            cleanup.formattingConsistent = false;
        }
        if (typeof cleanup.deadCodeRemoved !== 'boolean') {
            cleanup.deadCodeRemoved = false;
        }
        repaired.cleanup = cleanup;
    }

    if (repaired.extras && !Array.isArray(repaired.extras)) {
        repaired.extras = [];
    }
    if (repaired.edgeCases && !Array.isArray(repaired.edgeCases)) {
        repaired.edgeCases = [];
    }

    return repaired;
};

/**
 * Repairs completion object
 */
const repairCompletion = (completion) => {
    if (!completion || typeof completion !== 'object') {
        return { status: 'pending_validation' };
    }

    const repaired = { ...completion };

    if (!repaired.status || !VALID_COMPLETION_STATUSES.includes(repaired.status)) {
        repaired.status = 'pending_validation';
    }

    if (repaired.summary && !Array.isArray(repaired.summary)) {
        repaired.summary = [String(repaired.summary)];
    }
    if (repaired.deviations && !Array.isArray(repaired.deviations)) {
        repaired.deviations = [String(repaired.deviations)];
    }
    if (repaired.forFutureTasks && !Array.isArray(repaired.forFutureTasks)) {
        repaired.forFutureTasks = [String(repaired.forFutureTasks)];
    }
    if (repaired.blockedBy && !Array.isArray(repaired.blockedBy)) {
        repaired.blockedBy = [String(repaired.blockedBy)];
    }

    return repaired;
};

/**
 * Recursively sanitizes an object by:
 * - Converting undefined to null for consistency
 * - Ensuring arrays don't contain undefined elements
 * - Coercing invalid enum values where possible
 * @param {any} data - Data to sanitize
 * @param {string} path - Current path for logging (internal use)
 * @returns {any} Sanitized data
 */
const sanitizeData = (data, _currentPath = '') => {
    if (data === undefined) {
        return null;
    }

    if (data === null) {
        return null;
    }

    if (Array.isArray(data)) {
        return data
            .filter(item => item !== undefined)
            .map((item, idx) => sanitizeData(item, `${path}[${idx}]`));
    }

    if (typeof data === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            // Skip undefined values entirely (don't include them)
            if (value !== undefined) {
                sanitized[key] = sanitizeData(value, `${path}.${key}`);
            }
        }
        return sanitized;
    }

    return data;
};

/**
 * Gets the path to the execution schema file
 * @returns {string}
 */
const getSchemaPath = () => {
    return path.join(__dirname, '..', 'templates', 'execution-schema.json');
};

/**
 * Gets the path to the review checklist schema file
 * @returns {string}
 */
const getReviewChecklistSchemaPath = () => {
    return path.join(__dirname, '..', 'templates', 'review-checklist-schema.json');
};

/**
 * Loads and compiles the schema validator (cached)
 * @returns {{ validator: Function|null, error: string|null }}
 */
const getValidator = () => {
    // Return cached result if available
    if (cachedValidator !== null || schemaLoadError !== null) {
        return { validator: cachedValidator, error: schemaLoadError };
    }

    const schemaPath = getSchemaPath();

    // Check if schema file exists
    if (!fs.existsSync(schemaPath)) {
        schemaLoadError = 'Schema file not found';
        return { validator: null, error: schemaLoadError };
    }

    try {
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
        const schema = JSON.parse(schemaContent);

        const ajv = new Ajv({ allErrors: true, strict: false });
        addFormats(ajv);

        cachedValidator = ajv.compile(schema);
        return { validator: cachedValidator, error: null };
    } catch (error) {
        if (error instanceof SyntaxError) {
            schemaLoadError = 'Invalid JSON in schema file';
        } else {
            schemaLoadError = `Schema compilation error: ${error.message}`;
        }
        return { validator: null, error: schemaLoadError };
    }
};

/**
 * Loads and compiles the review checklist schema validator (cached)
 * @returns {{ validator: Function|null, error: string|null }}
 */
const getReviewChecklistValidator = () => {
    // Return cached result if available
    if (cachedReviewChecklistValidator !== null || reviewChecklistSchemaLoadError !== null) {
        return { validator: cachedReviewChecklistValidator, error: reviewChecklistSchemaLoadError };
    }

    const schemaPath = getReviewChecklistSchemaPath();

    // Check if schema file exists
    if (!fs.existsSync(schemaPath)) {
        reviewChecklistSchemaLoadError = 'Review checklist schema file not found';
        return { validator: null, error: reviewChecklistSchemaLoadError };
    }

    try {
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
        const schema = JSON.parse(schemaContent);

        const ajv = new Ajv({ allErrors: true, strict: false });
        addFormats(ajv);

        cachedReviewChecklistValidator = ajv.compile(schema);
        return { validator: cachedReviewChecklistValidator, error: null };
    } catch (error) {
        if (error instanceof SyntaxError) {
            reviewChecklistSchemaLoadError = 'Invalid JSON in review checklist schema file';
        } else {
            reviewChecklistSchemaLoadError = `Review checklist schema compilation error: ${error.message}`;
        }
        return { validator: null, error: reviewChecklistSchemaLoadError };
    }
};

/**
 * Formats Ajv errors into human-readable strings with field paths
 * @param {Array} errors - Ajv validation errors
 * @returns {string[]}
 */
const formatErrors = (errors) => {
    if (!errors || errors.length === 0) {
        return [];
    }

    return errors.map(error => {
        const path = error.instancePath || '/';
        const field = path === '/' ? 'root' : path.slice(1).replace(/\//g, '.');

        switch (error.keyword) {
            case 'required':
                return `${field}: Missing required field '${error.params.missingProperty}'`;
            case 'enum':
                return `${field}: Invalid value. Allowed values: ${error.params.allowedValues.join(', ')}`;
            case 'type':
                return `${field}: Expected ${error.params.type}`;
            case 'pattern':
                return `${field}: Value does not match pattern ${error.params.pattern}`;
            case 'format':
                return `${field}: Invalid ${error.params.format} format`;
            case 'minimum':
                return `${field}: Value must be >= ${error.params.limit}`;
            case 'const':
                return `${field}: Value must be '${error.params.allowedValue}'`;
            case 'additionalProperties':
                return `${field}: Unknown property '${error.params.additionalProperty}'`;
            default:
                return `${field}: ${error.message}`;
        }
    });
};

/**
 * Validates execution.json data against the schema
 * @param {object} data - The execution data to validate
 * @param {object} options - Validation options
 * @param {boolean} options.sanitize - Whether to sanitize data before validation (default: true)
 * @param {boolean} options.repair - Whether to repair data before validation (default: true)
 * @returns {{ valid: boolean, errors: string[], sanitizedData?: object, repairedData?: object }}
 */
const validateExecutionJson = (data, options = {}) => {
    const { sanitize = true, repair = true } = options;

    // Handle null/undefined input
    if (data === null || data === undefined) {
        return {
            valid: false,
            errors: ['Input data is null or undefined'],
        };
    }

    // Handle non-object input
    if (typeof data !== 'object' || Array.isArray(data)) {
        return {
            valid: false,
            errors: ['Input data must be an object'],
        };
    }

    const { validator, error } = getValidator();

    // Handle schema loading errors
    if (error) {
        return {
            valid: false,
            errors: [error],
        };
    }

    // Repair data first (fills in missing required fields)
    let dataToValidate = repair ? repairExecutionJson(data) : data;

    // Then sanitize (removes undefined, normalizes nulls)
    if (sanitize) {
        dataToValidate = sanitizeData(dataToValidate);
    }

    const valid = validator(dataToValidate);

    if (valid) {
        const result = { valid: true, errors: [] };
        if (sanitize || repair) {
            result.sanitizedData = dataToValidate;
        }
        if (repair) {
            result.repairedData = dataToValidate;
        }
        return result;
    }

    return {
        valid: false,
        errors: formatErrors(validator.errors),
    };
};

/**
 * Validates review-checklist.json data against the schema
 * @param {object} data - The review checklist data to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
const validateReviewChecklist = (data) => {
    // Handle null/undefined input
    if (data === null || data === undefined) {
        return {
            valid: false,
            errors: ['Input data is null or undefined'],
        };
    }

    // Handle non-object input
    if (typeof data !== 'object' || Array.isArray(data)) {
        return {
            valid: false,
            errors: ['Input data must be an object'],
        };
    }

    const { validator, error } = getReviewChecklistValidator();

    // Handle schema loading errors
    if (error) {
        return {
            valid: false,
            errors: [error],
        };
    }

    const valid = validator(data);

    if (valid) {
        return { valid: true, errors: [] };
    }

    return {
        valid: false,
        errors: formatErrors(validator.errors),
    };
};

/**
 * Resets the cached validator (useful for testing)
 */
const resetValidatorCache = () => {
    cachedValidator = null;
    schemaLoadError = null;
    cachedReviewChecklistValidator = null;
    reviewChecklistSchemaLoadError = null;
};

module.exports = {
    validateExecutionJson,
    validateReviewChecklist,
    resetValidatorCache,
    sanitizeData,
    repairExecutionJson,
    // Repair sub-functions exported for testing
    repairPhase,
    repairPreCondition,
    repairPhaseItem,
    repairArtifact,
    repairSuccessCriterion,
    repairUncertainty,
    repairCompletion,
    repairBeyondTheBasics,
    // Exported for testing purposes only
    getSchemaPath,
    getReviewChecklistSchemaPath,
    getValidator,
    getReviewChecklistValidator,
    formatErrors,
};
