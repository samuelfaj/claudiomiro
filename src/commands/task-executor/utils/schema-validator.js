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
 * @returns {{ valid: boolean, errors: string[] }}
 */
const validateExecutionJson = (data) => {
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
    // Exported for testing purposes only
    getSchemaPath,
    getReviewChecklistSchemaPath,
    getValidator,
    getReviewChecklistValidator,
    formatErrors,
};
