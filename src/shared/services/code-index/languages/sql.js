/**
 * SQL AST patterns for code indexing
 *
 * These patterns use ast-grep syntax to match common SQL code structures.
 * See: https://ast-grep.github.io/guide/pattern-syntax.html
 */

const SYMBOL_KINDS = {
  TABLE: 'table',
  VIEW: 'view',
  FUNCTION: 'function',
  PROCEDURE: 'procedure',
  TRIGGER: 'trigger',
  INDEX: 'index',
  CONSTRAINT: 'constraint',
  SEQUENCE: 'sequence',
  TYPE: 'type',
  SCHEMA: 'schema',
  DATABASE: 'database',
  COLUMN: 'column',
  VARIABLE: 'variable'
};

/**
 * Patterns for extracting symbols from SQL code
 */
const PATTERNS = {
  // Create table
  createTable: {
    pattern: 'CREATE TABLE $NAME ($$$COLUMNS)',
    kind: SYMBOL_KINDS.TABLE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Create table if not exists
  createTableIfNotExists: {
    pattern: 'CREATE TABLE IF NOT EXISTS $NAME ($$$COLUMNS)',
    kind: SYMBOL_KINDS.TABLE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      ifNotExists: true
    })
  },

  // Create temporary table
  createTempTable: {
    pattern: 'CREATE TEMPORARY TABLE $NAME ($$$COLUMNS)',
    kind: SYMBOL_KINDS.TABLE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      temporary: true
    })
  },

  // Create view
  createView: {
    pattern: 'CREATE VIEW $NAME AS $$$QUERY',
    kind: SYMBOL_KINDS.VIEW,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Create or replace view
  createOrReplaceView: {
    pattern: 'CREATE OR REPLACE VIEW $NAME AS $$$QUERY',
    kind: SYMBOL_KINDS.VIEW,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      replace: true
    })
  },

  // Create materialized view
  createMaterializedView: {
    pattern: 'CREATE MATERIALIZED VIEW $NAME AS $$$QUERY',
    kind: SYMBOL_KINDS.VIEW,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      materialized: true
    })
  },

  // Create function
  createFunction: {
    pattern: 'CREATE FUNCTION $NAME($$$PARAMS) RETURNS $RETURN $$$BODY',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      returnType: match.getMatch('RETURN')?.text() || '',
    })
  },

  // Create or replace function
  createOrReplaceFunction: {
    pattern: 'CREATE OR REPLACE FUNCTION $NAME($$$PARAMS) RETURNS $RETURN $$$BODY',
    kind: SYMBOL_KINDS.FUNCTION,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      returnType: match.getMatch('RETURN')?.text() || '',
      replace: true
    })
  },

  // Create procedure
  createProcedure: {
    pattern: 'CREATE PROCEDURE $NAME($$$PARAMS) $$$BODY',
    kind: SYMBOL_KINDS.PROCEDURE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
    })
  },

  // Create or replace procedure
  createOrReplaceProcedure: {
    pattern: 'CREATE OR REPLACE PROCEDURE $NAME($$$PARAMS) $$$BODY',
    kind: SYMBOL_KINDS.PROCEDURE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      params: extractParams(match.getMatch('PARAMS')),
      replace: true
    })
  },

  // Create trigger
  createTrigger: {
    pattern: 'CREATE TRIGGER $NAME $TIMING $EVENT ON $TABLE $$$BODY',
    kind: SYMBOL_KINDS.TRIGGER,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      timing: match.getMatch('TIMING')?.text() || '',
      event: match.getMatch('EVENT')?.text() || '',
      table: match.getMatch('TABLE')?.text() || '',
    })
  },

  // Create index
  createIndex: {
    pattern: 'CREATE INDEX $NAME ON $TABLE ($$$COLUMNS)',
    kind: SYMBOL_KINDS.INDEX,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      table: match.getMatch('TABLE')?.text() || '',
    })
  },

  // Create unique index
  createUniqueIndex: {
    pattern: 'CREATE UNIQUE INDEX $NAME ON $TABLE ($$$COLUMNS)',
    kind: SYMBOL_KINDS.INDEX,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      table: match.getMatch('TABLE')?.text() || '',
      unique: true
    })
  },

  // Create sequence
  createSequence: {
    pattern: 'CREATE SEQUENCE $NAME $$$OPTIONS',
    kind: SYMBOL_KINDS.SEQUENCE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Create type
  createType: {
    pattern: 'CREATE TYPE $NAME AS $$$DEFINITION',
    kind: SYMBOL_KINDS.TYPE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Create enum type
  createEnumType: {
    pattern: "CREATE TYPE $NAME AS ENUM ($$$VALUES)",
    kind: SYMBOL_KINDS.TYPE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      isEnum: true
    })
  },

  // Create schema
  createSchema: {
    pattern: 'CREATE SCHEMA $NAME',
    kind: SYMBOL_KINDS.SCHEMA,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Create database
  createDatabase: {
    pattern: 'CREATE DATABASE $NAME',
    kind: SYMBOL_KINDS.DATABASE,
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Alter table add column
  alterTableAddColumn: {
    pattern: 'ALTER TABLE $TABLE ADD COLUMN $COLUMN $TYPE',
    kind: SYMBOL_KINDS.COLUMN,
    extract: (match) => ({
      table: match.getMatch('TABLE')?.text() || '',
      name: match.getMatch('COLUMN')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // Add constraint
  addConstraint: {
    pattern: 'ALTER TABLE $TABLE ADD CONSTRAINT $NAME $$$DEF',
    kind: SYMBOL_KINDS.CONSTRAINT,
    extract: (match) => ({
      table: match.getMatch('TABLE')?.text() || '',
      name: match.getMatch('NAME')?.text() || '',
    })
  },

  // Declare variable (T-SQL/PL/SQL)
  declareVariable: {
    pattern: 'DECLARE @$NAME $TYPE',
    kind: SYMBOL_KINDS.VARIABLE,
    extract: (match) => ({
      name: '@' + (match.getMatch('NAME')?.text() || ''),
      type: match.getMatch('TYPE')?.text() || '',
    })
  },

  // PL/pgSQL variable
  plpgsqlVariable: {
    pattern: '$NAME $TYPE;',
    kind: SYMBOL_KINDS.VARIABLE,
    context: 'declare_section',
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: match.getMatch('TYPE')?.text() || '',
    })
  }
};

/**
 * Patterns for finding references/imports
 */
const REFERENCE_PATTERNS = {
  // Select from table
  selectFrom: {
    pattern: 'SELECT $$$COLUMNS FROM $TABLE',
    extract: (match) => ({
      table: match.getMatch('TABLE')?.text() || '',
      type: 'select'
    })
  },

  // Join table
  joinTable: {
    pattern: 'JOIN $TABLE ON $$$CONDITION',
    extract: (match) => ({
      table: match.getMatch('TABLE')?.text() || '',
      type: 'join'
    })
  },

  // Left join
  leftJoin: {
    pattern: 'LEFT JOIN $TABLE ON $$$CONDITION',
    extract: (match) => ({
      table: match.getMatch('TABLE')?.text() || '',
      type: 'left-join'
    })
  },

  // Insert into
  insertInto: {
    pattern: 'INSERT INTO $TABLE ($$$COLUMNS) VALUES ($$$VALUES)',
    extract: (match) => ({
      table: match.getMatch('TABLE')?.text() || '',
      type: 'insert'
    })
  },

  // Update table
  updateTable: {
    pattern: 'UPDATE $TABLE SET $$$ASSIGNMENTS',
    extract: (match) => ({
      table: match.getMatch('TABLE')?.text() || '',
      type: 'update'
    })
  },

  // Delete from
  deleteFrom: {
    pattern: 'DELETE FROM $TABLE',
    extract: (match) => ({
      table: match.getMatch('TABLE')?.text() || '',
      type: 'delete'
    })
  },

  // Function call
  functionCall: {
    pattern: '$FUNC($$$ARGS)',
    extract: (match) => ({
      func: match.getMatch('FUNC')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
    })
  },

  // Call procedure
  callProcedure: {
    pattern: 'CALL $PROC($$$ARGS)',
    extract: (match) => ({
      procedure: match.getMatch('PROC')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
      type: 'call'
    })
  },

  // Execute procedure (T-SQL)
  execProcedure: {
    pattern: 'EXEC $PROC $$$ARGS',
    extract: (match) => ({
      procedure: match.getMatch('PROC')?.text() || '',
      args: match.getMatch('ARGS')?.text() || '',
      type: 'exec'
    })
  },

  // CTE reference
  cteReference: {
    pattern: 'WITH $NAME AS ($$$QUERY)',
    extract: (match) => ({
      name: match.getMatch('NAME')?.text() || '',
      type: 'cte'
    })
  },

  // Subquery
  subquery: {
    pattern: '($$$QUERY) AS $ALIAS',
    extract: (match) => ({
      alias: match.getMatch('ALIAS')?.text() || '',
      type: 'subquery'
    })
  },

  // Grant on table
  grantOnTable: {
    pattern: 'GRANT $$$PRIVILEGES ON $TABLE TO $USER',
    extract: (match) => ({
      table: match.getMatch('TABLE')?.text() || '',
      user: match.getMatch('USER')?.text() || '',
      type: 'grant'
    })
  }
};

/**
 * File extensions this language config handles
 */
const FILE_EXTENSIONS = ['.sql', '.psql', '.pgsql', '.plsql', '.mysql'];

/**
 * ast-grep language identifier
 */
const LANGUAGE = 'sql';

/**
 * Helper function to extract parameter names from AST node
 */
function extractParams(paramsNode) {
  if (!paramsNode) return [];
  const text = paramsNode.text();
  if (!text) return [];

  return text
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => {
      // SQL params: name TYPE or IN/OUT/INOUT name TYPE
      const parts = p.split(/\s+/);
      // First word might be IN/OUT/INOUT, name is usually after that
      let name = parts[0];
      if (['IN', 'OUT', 'INOUT'].includes(name.toUpperCase())) {
        name = parts[1] || parts[0];
      }
      return name;
    });
}

/**
 * Check if a name is a system object
 */
function isSystemObject(name) {
  const systemPrefixes = ['pg_', 'sys.', 'information_schema.', 'mysql.'];
  return systemPrefixes.some(prefix => name.toLowerCase().startsWith(prefix));
}

/**
 * Check if a name is a temporary object
 */
function isTemporaryObject(name) {
  return name.startsWith('#') || name.startsWith('@') || name.toLowerCase().startsWith('temp_');
}

/**
 * Get the kind of symbol based on conventions
 */
function inferKind(name, defaultKind) {
  return defaultKind;
}

module.exports = {
  SYMBOL_KINDS,
  PATTERNS,
  REFERENCE_PATTERNS,
  FILE_EXTENSIONS,
  LANGUAGE,
  extractParams,
  isSystemObject,
  isTemporaryObject,
  inferKind
};
