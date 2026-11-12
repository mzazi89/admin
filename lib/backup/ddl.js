// MZAZI ADMIN — schema capture.
//
// A backup of rows is only half a backup: restoring into a brand-new database
// fails immediately if the tables do not exist. The app's own schema lives as
// 200-odd CREATE statements bound to the primary connection, so the snapshot
// captures the real shape of the live database instead of a second copy of that
// file drifting out of step with it.
//
// The generated DDL is deliberately plain: types, NOT NULL, defaults, primary
// keys. That is what a restore target needs. Indexes and constraints beyond the
// primary key are not recreated — the receiving app rebuilds its own on boot.

/** Postgres type for a column described by information_schema. */
export function columnType(col) {
  const udt = col.udt_name;
  const len = col.character_maximum_length;
  switch (udt) {
    case 'int2': return 'smallint';
    case 'int4': return 'integer';
    case 'int8': return 'bigint';
    case 'float4': return 'real';
    case 'float8': return 'double precision';
    case 'numeric': {
      const p = col.numeric_precision;
      const s = col.numeric_scale;
      return p != null && s != null ? `numeric(${p},${s})` : 'numeric';
    }
    case 'varchar': return len ? `varchar(${len})` : 'varchar';
    case 'bpchar': return len ? `char(${len})` : 'char';
    case 'text': return 'text';
    case 'bool': return 'boolean';
    case 'timestamp': return 'timestamp';
    case 'timestamptz': return 'timestamptz';
    case 'date': return 'date';
    case 'time': return 'time';
    case 'timetz': return 'timetz';
    case 'json': return 'json';
    case 'jsonb': return 'jsonb';
    case 'uuid': return 'uuid';
    case 'bytea': return 'bytea';
    case 'inet': return 'inet';
    case 'money': return 'money';
    default:
      // Postgres array types are the udt with a leading underscore.
      if (udt && udt.startsWith('_')) return `${columnType({ ...col, udt_name: udt.slice(1) })}[]`;
      return udt || 'text';
  }
}

const isSerialDefault = (expr) => typeof expr === 'string' && /^nextval\(/i.test(expr);

/** One CREATE TABLE IF NOT EXISTS for a table, from captured columns. */
export function buildCreateTable(table, columns, pkColumns = []) {
  const defs = columns.map((col) => {
    const serial = isSerialDefault(col.column_default) && ['int4', 'int8'].includes(col.udt_name);
    const type = serial
      ? (col.udt_name === 'int8' ? 'bigserial' : 'serial')
      : columnType(col);

    let def = `"${col.column_name}" ${type}`;

    if (col.is_nullable === 'NO' && !serial) def += ' NOT NULL';
    // A nextval default is implied by serial/bigserial; copying it would point
    // the new table at a sequence that does not exist there.
    if (col.column_default && !isSerialDefault(col.column_default)) {
      def += ` DEFAULT ${col.column_default}`;
    }
    return def;
  });

  if (pkColumns.length) {
    defs.push(`PRIMARY KEY (${pkColumns.map((c) => `"${c}"`).join(', ')})`);
  }

  return `CREATE TABLE IF NOT EXISTS "${table}" (\n  ${defs.join(',\n  ')}\n)`;
}
