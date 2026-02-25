#!/usr/bin/env tsx
/**
 * Argentine Law MCP — Census-Driven Ingestion Pipeline
 *
 * Fetches Argentine federal legislation from InfoLEG (infoleg.gob.ar),
 * driven by the census.json manifest produced by census.ts.
 *
 * Strategy:
 * 1. Load census.json to find all ingestable laws
 * 2. For each law not yet ingested, fetch the consolidated HTML from InfoLEG
 * 3. Parse articles from the structured HTML (Artículo N° / Art. N° format)
 * 4. Write seed JSON files for the database builder
 * 5. Update census.json with ingestion results
 *
 * Usage:
 *   npm run ingest                    # Ingest all from census
 *   npm run ingest -- --limit 50      # Ingest first 50 un-ingested laws
 *   npm run ingest -- --skip-fetch    # Reuse cached HTML (re-parse only)
 *   npm run ingest -- --force         # Re-ingest even if already done
 *   npm run ingest -- --legacy        # Use legacy KEY_ARGENTINE_ACTS list
 *
 * Data is sourced under Government Public Data principles.
 * Argentine federal legislation is public domain as government publication.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';
import { parseArgentineHtml, KEY_ARGENTINE_ACTS, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');

interface CensusEntry {
  id: string;
  title: string;
  identifier: string;
  url: string;
  status: string;
  category: string;
  classification: string;
  skip_reason?: string;
  ingested: boolean;
  provision_count: number;
  ingestion_date: string | null;
  ley_number: number;
  infoleg_id: number;
  publication_date: string;
  description: string;
  entity: string;
}

interface Census {
  schema_version: string;
  jurisdiction: string;
  jurisdiction_name: string;
  portal: string;
  portal_url: string;
  generated: string;
  summary: {
    total_laws: number;
    total_ingestable: number;
    total_not_ingestable: number;
    total_ingested: number;
    total_provisions: number;
    ley_number_range: string;
    norm_types_included: string[];
  };
  laws: CensusEntry[];
}

function parseArgs(): { limit: number | null; skipFetch: boolean; force: boolean; legacy: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;
  let force = false;
  let legacy = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    } else if (args[i] === '--force') {
      force = true;
    } else if (args[i] === '--legacy') {
      legacy = true;
    }
  }

  return { limit, skipFetch, force, legacy };
}

interface IngestionResult {
  id: string;
  shortName: string;
  provisions: number;
  definitions: number;
  status: 'success' | 'skipped' | 'failed';
  error?: string;
}

/**
 * Convert a census entry to an ActIndexEntry for the parser.
 */
function censusEntryToAct(entry: CensusEntry): ActIndexEntry {
  return {
    id: entry.id,
    title: entry.title,
    titleEn: `Law ${entry.ley_number}`,
    shortName: entry.identifier,
    status: (entry.status as 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force') || 'in_force',
    issuedDate: entry.publication_date || '',
    inForceDate: entry.publication_date || '',
    url: entry.url,
    description: entry.description || '',
  };
}

/**
 * Ingest a single law: fetch HTML, parse, write seed JSON.
 */
async function ingestOne(
  act: ActIndexEntry,
  skipFetch: boolean,
): Promise<IngestionResult> {
  const sourceFile = path.join(SOURCE_DIR, `${act.id}.html`);
  const seedFile = path.join(SEED_DIR, `${act.id}.json`);

  try {
    let html: string;

    if (fs.existsSync(sourceFile) && skipFetch) {
      html = fs.readFileSync(sourceFile, 'utf-8');
    } else {
      const result = await fetchWithRateLimit(act.url);

      if (result.status !== 200) {
        return {
          id: act.id,
          shortName: act.shortName,
          provisions: 0,
          definitions: 0,
          status: 'failed',
          error: `HTTP ${result.status}`,
        };
      }

      if (!result.body || result.body.length < 200) {
        return {
          id: act.id,
          shortName: act.shortName,
          provisions: 0,
          definitions: 0,
          status: 'failed',
          error: `Empty or too small response (${result.body?.length ?? 0} bytes)`,
        };
      }

      html = result.body;
      fs.writeFileSync(sourceFile, html);
    }

    const parsed = parseArgentineHtml(html, act);
    fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));

    return {
      id: act.id,
      shortName: act.shortName,
      provisions: parsed.provisions.length,
      definitions: parsed.definitions.length,
      status: 'success',
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      id: act.id,
      shortName: act.shortName,
      provisions: 0,
      definitions: 0,
      status: 'failed',
      error: msg,
    };
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/**
 * Census-driven ingestion: load census.json, ingest un-ingested laws.
 */
async function censusIngestion(limit: number | null, skipFetch: boolean, force: boolean): Promise<void> {
  if (!fs.existsSync(CENSUS_PATH)) {
    console.error('ERROR: census.json not found. Run "npx tsx scripts/census.ts" first.');
    process.exit(1);
  }

  const census: Census = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf-8'));
  console.log(`  Census: ${census.summary.total_laws} laws, ${census.summary.total_ingestable} ingestable`);
  console.log(`  Already ingested: ${census.summary.total_ingested}`);

  // Filter to ingestable, un-ingested laws
  let toIngest = census.laws.filter(law =>
    law.classification === 'ingestable' && (force || !law.ingested)
  );

  if (limit) {
    toIngest = toIngest.slice(0, limit);
  }

  console.log(`  To ingest: ${toIngest.length}`);
  if (skipFetch) console.log(`  --skip-fetch: reusing cached HTML`);
  if (force) console.log(`  --force: re-ingesting all`);
  console.log('');

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  const results: IngestionResult[] = [];
  const startTime = Date.now();
  let done = 0;

  // Build a map for census updates
  const censusMap = new Map<string, CensusEntry>();
  for (const law of census.laws) {
    censusMap.set(law.id, law);
  }

  for (const entry of toIngest) {
    done++;

    // Progress indicator
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = done / (elapsed || 1);
    const remaining = (toIngest.length - done) / rate;
    process.stdout.write(
      `\r  [${done}/${toIngest.length}] ${entry.identifier} | ${results.filter(r => r.status === 'success').length} ok, ${results.filter(r => r.status === 'failed').length} fail | ${rate.toFixed(1)}/s | ETA: ${formatDuration(remaining)}  `
    );

    const act = censusEntryToAct(entry);
    const result = await ingestOne(act, skipFetch);
    results.push(result);

    // Update census entry
    if (result.status === 'success') {
      const censusEntry = censusMap.get(entry.id);
      if (censusEntry) {
        censusEntry.ingested = true;
        censusEntry.provision_count = result.provisions;
        censusEntry.ingestion_date = new Date().toISOString().slice(0, 10);
      }
    }

    // Save census progress every 50 laws
    if (done % 50 === 0) {
      updateCensusSummary(census);
      fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));
    }
  }

  // Final census update
  updateCensusSummary(census);
  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));

  console.log('\n');
  printReport(results);
}

/**
 * Update census summary totals from the laws array.
 */
function updateCensusSummary(census: Census): void {
  census.summary.total_ingested = census.laws.filter(l => l.ingested).length;
  census.summary.total_provisions = census.laws.reduce((sum, l) => sum + l.provision_count, 0);
}

/**
 * Legacy ingestion: use hardcoded KEY_ARGENTINE_ACTS list.
 */
async function legacyIngestion(limit: number | null, skipFetch: boolean): Promise<void> {
  const acts = limit ? KEY_ARGENTINE_ACTS.slice(0, limit) : KEY_ARGENTINE_ACTS;
  console.log(`  Legacy mode: ${acts.length} acts from KEY_ARGENTINE_ACTS\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  const results: IngestionResult[] = [];

  for (const act of acts) {
    // Skip if seed already exists and we're in skip-fetch mode
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);
    if (skipFetch && fs.existsSync(seedFile)) {
      console.log(`  SKIP ${act.shortName} — cached`);
      try {
        const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
        results.push({
          id: act.id,
          shortName: act.shortName,
          provisions: existing.provisions?.length ?? 0,
          definitions: existing.definitions?.length ?? 0,
          status: 'skipped',
        });
      } catch {
        results.push({
          id: act.id,
          shortName: act.shortName,
          provisions: 0,
          definitions: 0,
          status: 'skipped',
        });
      }
      continue;
    }

    process.stdout.write(`  Fetching ${act.shortName}...`);
    const result = await ingestOne(act, skipFetch);
    results.push(result);

    if (result.status === 'success') {
      console.log(` OK -> ${result.provisions} provisions, ${result.definitions} definitions`);
    } else if (result.status === 'failed') {
      console.log(` FAILED: ${result.error}`);
    }
  }

  printReport(results);
}

function printReport(results: IngestionResult[]): void {
  console.log(`${'='.repeat(72)}`);
  console.log('INGESTION REPORT');
  console.log('='.repeat(72));

  const succeeded = results.filter(r => r.status === 'success');
  const skipped = results.filter(r => r.status === 'skipped');
  const failed = results.filter(r => r.status === 'failed');
  const totalProvisions = results.reduce((sum, r) => sum + r.provisions, 0);
  const totalDefinitions = results.reduce((sum, r) => sum + r.definitions, 0);

  console.log(`\nSuccessfully ingested: ${succeeded.length}`);
  if (succeeded.length <= 50) {
    for (const r of succeeded) {
      console.log(`  ${r.shortName.padEnd(25)} ${r.provisions.toString().padStart(4)} provisions, ${r.definitions.toString().padStart(3)} definitions`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped (cached): ${skipped.length}`);
  }

  if (failed.length > 0) {
    console.log(`\nFailed: ${failed.length}`);
    if (failed.length <= 50) {
      for (const r of failed) {
        console.log(`  ${r.shortName.padEnd(25)} — ${r.error}`);
      }
    }
  }

  console.log(`\nTotal provisions: ${totalProvisions}`);
  console.log(`Total definitions: ${totalDefinitions}`);
  console.log('='.repeat(72));
}

async function main(): Promise<void> {
  const { limit, skipFetch, force, legacy } = parseArgs();

  console.log('Argentine Law MCP — Ingestion Pipeline');
  console.log('=======================================\n');
  console.log(`  Source: InfoLEG (infoleg.gob.ar)`);
  console.log(`  Authority: Ministerio de Justicia y Derechos Humanos`);
  console.log(`  License: Government Public Data`);
  console.log(`  Strategy: Fetch consolidated HTML -> parse articles`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);
  if (force) console.log(`  --force`);
  if (legacy) console.log(`  --legacy`);
  console.log('');

  if (legacy) {
    await legacyIngestion(limit, skipFetch);
  } else {
    await censusIngestion(limit, skipFetch, force);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
