/**
 * Response metadata utilities for Argentine Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'InfoLEG (servicios.infoleg.gob.ar) — Argentine Ministry of Justice and Human Rights',
    jurisdiction: 'AR',
    disclaimer:
      'This data is sourced from InfoLEG, the official Argentine legislation database. The authoritative versions are maintained by the Argentine Ministry of Justice and Human Rights. Always verify with the official InfoLEG portal (servicios.infoleg.gob.ar).',
    freshness,
  };
}
