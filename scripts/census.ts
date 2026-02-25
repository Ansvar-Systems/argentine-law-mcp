#!/usr/bin/env tsx
/**
 * Argentine Law MCP — Census Script
 *
 * Enumerates ALL national laws (leyes nacionales) from InfoLEG
 * (Informacion Legislativa y Documental), the comprehensive legislative
 * information portal maintained by the Argentine Ministry of Justice.
 *
 * Strategy:
 * 1. POST search to InfoLEG with tipoNorma=1 (Ley) + texto="de" to get all leyes
 *    (returns ~23,000 results — "de" appears in nearly every law description)
 * 2. Paginate through all result pages (50 results/page) using session cookies
 * 3. Parse HTML results to extract InfoLEG IDs, law numbers, dates, descriptions
 * 4. Fill gaps: search for laws not found by checking numbers 1–27850 individually
 * 5. Write census.json with golden-standard schema
 *
 * Features:
 * - Session-cookie-based pagination (50 results/page, ~4 min for 23K results)
 * - Gap-filling phase for laws missed by text search
 * - Rate limiting at 500ms minimum between requests
 * - Proper ISO-8859-1 charset handling
 * - Resume support via checkpoint file
 *
 * Usage:
 *   npx tsx scripts/census.ts                    # Full census
 *   npx tsx scripts/census.ts --skip-gaps        # Skip gap-filling phase
 *   npx tsx scripts/census.ts --pages 10         # Only first 10 pages
 *
 * Data source: InfoLEG (servicios.infoleg.gob.ar)
 * Authority: Ministerio de Justicia y Derechos Humanos de la Nacion
 * License: Argentine federal legislation is public domain as government publication
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');
const CHECKPOINT_PATH = path.resolve(__dirname, '../data/.census-checkpoint.json');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

const INFOLEG_SEARCH_URL = 'https://servicios.infoleg.gob.ar/infolegInternet/buscarNormas.do';
const INFOLEG_BASE = 'https://servicios.infoleg.gob.ar/infolegInternet';
const USER_AGENT = 'Argentine-Law-MCP/1.0 (https://github.com/Ansvar-Systems/argentine-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 500;

/** Maximum known Argentine ley number */
const MAX_LEY_NUMBER = 27850;

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

interface CensusEntry {
  id: string;
  title: string;
  identifier: string;
  url: string;
  status: string;
  category: string;
  classification: 'ingestable' | 'not_ingestable' | 'skip';
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

interface Checkpoint {
  phase: 'pagination' | 'gaps' | 'done';
  last_page: number;
  last_gap_ley: number;
  entries: CensusEntry[];
  seen_ley_numbers: number[];
  session_id: string;
  timestamp: string;
}

function parseArgs(): { skipGaps: boolean; maxPages: number | null } {
  const args = process.argv.slice(2);
  let skipGaps = false;
  let maxPages: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--skip-gaps') {
      skipGaps = true;
    } else if (args[i] === '--pages' && args[i + 1]) {
      maxPages = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { skipGaps, maxPages };
}

/**
 * Build the InfoLEG URL for a norma.htm page given an InfoLEG ID.
 */
function buildInfolegUrl(infolegId: number): string {
  const rangeStart = Math.floor(infolegId / 5000) * 5000;
  const rangeEnd = rangeStart + 4999;
  return `${INFOLEG_BASE}/anexos/${rangeStart}-${rangeEnd}/${infolegId}/norma.htm`;
}

/**
 * Parse an InfoLEG date string (e.g., "02-nov-2000") into ISO date format.
 */
function parseInfolegDate(dateStr: string): string {
  if (!dateStr) return '';

  const months: Record<string, string> = {
    'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
  };

  const match = dateStr.match(/(\d{2})-(\w{3})-(\d{4})/);
  if (!match) return dateStr;

  const month = months[match[2].toLowerCase()];
  if (!month) return dateStr;

  return `${match[3]}-${month}-${match[1]}`;
}

/**
 * Check whether a seed file already exists for this law.
 */
function checkIngested(id: string): { ingested: boolean; provisionCount: number; ingestionDate: string | null } {
  const seedFile = path.join(SEED_DIR, `${id}.json`);
  if (fs.existsSync(seedFile)) {
    try {
      const seed = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
      return {
        ingested: true,
        provisionCount: seed.provisions?.length ?? 0,
        ingestionDate: seed.ingestion_date ?? null,
      };
    } catch {
      return { ingested: false, provisionCount: 0, ingestionDate: null };
    }
  }
  return { ingested: false, provisionCount: 0, ingestionDate: null };
}

/**
 * Extract session ID from Set-Cookie header.
 */
function extractSessionId(response: Response): string | null {
  const setCookie = response.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/JSESSIONID=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Parse a page of InfoLEG search results.
 * Returns entries and the total count from the page header.
 */
function parseSearchResults(html: string): { entries: Array<{ infolegId: number; leyNumber: number; publicationDate: string; title: string; description: string; entity: string }>; totalCount: number } {
  const entries: Array<{ infolegId: number; leyNumber: number; publicationDate: string; title: string; description: string; entity: string }> = [];

  // Extract total count
  let totalCount = 0;
  const countMatch = html.match(/Cantidad de Normas Encontradas:\s*(\d+)/);
  if (countMatch) {
    totalCount = parseInt(countMatch[1], 10);
  }

  // Match each result entry: verNorma link with ID, followed by law number
  // Pattern: verNorma.do...?id=INFOLEG_ID">Ley\s+NUMBER
  const entryRegex = /verNorma\.do[^"]*\?id=(\d+)"[^>]*>Ley\s+([\d]+)<\/a>\s*<br\/?>\s*([^<]*)<br/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(html)) !== null) {
    const infolegId = parseInt(match[1], 10);
    const leyNumber = parseInt(match[2], 10);
    const entity = match[3].trim();

    // Skip "Ver Norma" links (duplicate entries for highlighted text)
    if (isNaN(leyNumber) || leyNumber <= 0) continue;

    // Find the date associated with this entry (verBoletin link nearby)
    const afterMatch = html.substring(match.index, match.index + 1000);
    let publicationDate = '';
    const dateMatch = afterMatch.match(/>(\d{2}-(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-\d{4})</i);
    if (dateMatch) {
      publicationDate = parseInfolegDate(dateMatch[1]);
    }

    // Extract title (bold text)
    let title = '';
    const titleMatch = afterMatch.match(/<b>([^<]+)<\/b>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Extract description (italic text in span)
    let description = '';
    const descMatch = afterMatch.match(/<i>([^<]+)<\/i>/i);
    if (descMatch) {
      description = descMatch[1].trim();
    }

    entries.push({ infolegId, leyNumber, publicationDate, title, description, entity });
  }

  return { entries, totalCount };
}

/**
 * Perform the initial search and return session + first page results.
 */
async function initialSearch(searchText: string): Promise<{ sessionCookies: string; html: string }> {
  await rateLimit();

  const body = new URLSearchParams({
    tipoNorma: '1',
    numero: '',
    anioSancion: '',
    texto: searchText,
    dependencia: '',
    method: 'search',
  });

  const response = await fetch(INFOLEG_SEARCH_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html, application/xhtml+xml, */*',
      'Accept-Language': 'es-AR,es;q=0.9,en;q=0.5',
    },
    body: body.toString(),
    redirect: 'follow',
  });

  // Collect all cookies
  const cookies: string[] = [];
  const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
  for (const setCookie of setCookieHeaders) {
    const cookiePart = setCookie.split(';')[0];
    cookies.push(cookiePart);
  }

  // Fallback: extract from set-cookie header
  if (cookies.length === 0) {
    const setCookie = response.headers.get('set-cookie') ?? '';
    const sessionMatch = setCookie.match(/JSESSIONID=([^;]+)/);
    if (sessionMatch) {
      cookies.push(`JSESSIONID=${sessionMatch[1]}`);
    }
  }

  // Also extract session ID from the HTML form action (more reliable)
  const arrayBuffer = await response.arrayBuffer();
  const html = new TextDecoder('latin1', { fatal: false }).decode(new Uint8Array(arrayBuffer));

  const formSessionMatch = html.match(/jsessionid=([A-F0-9]+)/i);
  if (formSessionMatch && cookies.length === 0) {
    cookies.push(`JSESSIONID=${formSessionMatch[1]}`);
  }

  return { sessionCookies: cookies.join('; '), html };
}

/**
 * Fetch a specific page of search results using session cookies.
 */
async function fetchPage(pageNum: number, sessionCookies: string): Promise<string> {
  await rateLimit();

  const body = new URLSearchParams({
    desplazamiento: 'AP',
    irAPagina: pageNum.toString(),
  });

  const response = await fetch(INFOLEG_SEARCH_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html, application/xhtml+xml, */*',
      'Accept-Language': 'es-AR,es;q=0.9,en;q=0.5',
      'Cookie': sessionCookies,
    },
    body: body.toString(),
    redirect: 'follow',
  });

  const arrayBuffer = await response.arrayBuffer();
  return new TextDecoder('latin1', { fatal: false }).decode(new Uint8Array(arrayBuffer));
}

/**
 * Search for a single law by number (for gap-filling).
 */
async function searchSingleLey(leyNumber: number): Promise<{ infolegId: number; publicationDate: string; title: string; description: string; entity: string } | null> {
  await rateLimit();

  const body = new URLSearchParams({
    tipoNorma: '1',
    numero: leyNumber.toString(),
    anioSancion: '',
    texto: '',
    dependencia: '',
    method: 'search',
  });

  const response = await fetch(INFOLEG_SEARCH_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html, application/xhtml+xml, */*',
      'Accept-Language': 'es-AR,es;q=0.9,en;q=0.5',
    },
    body: body.toString(),
    redirect: 'follow',
  });

  const arrayBuffer = await response.arrayBuffer();
  const html = new TextDecoder('latin1', { fatal: false }).decode(new Uint8Array(arrayBuffer));

  if (html.includes('No se encontraron normas') || html.includes('Debe ingresar al menos')) {
    return null;
  }

  const idMatch = html.match(/verNorma\.do[^"]*\?id=(\d+)/);
  if (!idMatch) return null;
  const infolegId = parseInt(idMatch[1], 10);

  let publicationDate = '';
  const dateMatch = html.match(/>(\d{2}-(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-\d{4})</i);
  if (dateMatch) publicationDate = parseInfolegDate(dateMatch[1]);

  let title = '';
  const titleMatch = html.match(/<b>([^<]+)<\/b>\s*<br/i);
  if (titleMatch) title = titleMatch[1].trim();

  let description = '';
  const descMatch = html.match(/<i>([^<]+)<\/i>\s*<\/span>/i);
  if (descMatch) description = descMatch[1].trim();

  let entity = '';
  const entityMatch = html.match(/Ley\s+\d+\s*<\/a>\s*<br\/?\s*>\s*([^<]+)<br/i);
  if (entityMatch) entity = entityMatch[1].trim();

  return { infolegId, publicationDate, title, description, entity };
}

function loadCheckpoint(): Checkpoint | null {
  if (fs.existsSync(CHECKPOINT_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint));
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

async function main(): Promise<void> {
  const { skipGaps, maxPages } = parseArgs();

  console.log('Argentine Law MCP — Census');
  console.log('==========================\n');
  console.log(`  Source: InfoLEG (servicios.infoleg.gob.ar)`);
  console.log(`  Authority: Ministerio de Justicia y Derechos Humanos`);
  console.log(`  Focus: Leyes nacionales (national laws)`);
  if (maxPages) console.log(`  --pages: ${maxPages}`);
  if (skipGaps) console.log(`  --skip-gaps: gap-filling disabled`);
  console.log('');

  // Load checkpoint
  let checkpoint = loadCheckpoint();
  let entries: CensusEntry[] = checkpoint?.entries ?? [];
  let seenLeyNumbers = new Set<number>(checkpoint?.seen_ley_numbers ?? []);
  let startPage = checkpoint?.phase === 'pagination' ? (checkpoint.last_page + 1) : 1;
  let sessionCookies = checkpoint?.session_id ?? '';
  let totalCount = 0;

  const startTime = Date.now();

  // ========== Phase 1: Paginated text search ==========
  if (!checkpoint || checkpoint.phase === 'pagination') {
    console.log('Phase 1: Paginated text search (texto="de")...\n');

    // If no session or resuming from start, do initial search
    if (startPage <= 1) {
      console.log('  Establishing search session...');
      const initial = await initialSearch('de');
      sessionCookies = initial.sessionCookies;

      const parsed = parseSearchResults(initial.html);
      totalCount = parsed.totalCount;

      console.log(`  Total laws matching: ${totalCount}`);
      console.log(`  Session established\n`);

      // Process first page results
      for (const entry of parsed.entries) {
        if (!seenLeyNumbers.has(entry.leyNumber)) {
          seenLeyNumbers.add(entry.leyNumber);
          const docId = `ley-${entry.leyNumber}`;
          const { ingested, provisionCount, ingestionDate } = checkIngested(docId);

          entries.push({
            id: docId,
            title: entry.title ? `Ley ${entry.leyNumber} — ${entry.title}` : `Ley ${entry.leyNumber}`,
            identifier: `Ley ${entry.leyNumber}`,
            url: buildInfolegUrl(entry.infolegId),
            status: 'in_force',
            category: 'Ley',
            classification: 'ingestable',
            ingested,
            provision_count: provisionCount,
            ingestion_date: ingestionDate,
            ley_number: entry.leyNumber,
            infoleg_id: entry.infolegId,
            publication_date: entry.publicationDate,
            description: entry.description,
            entity: entry.entity,
          });
        }
      }

      startPage = 2;
    }

    const totalPages = maxPages ?? Math.ceil(totalCount / 50) + 1;
    let consecutiveEmpty = 0;

    for (let page = startPage; page <= totalPages; page++) {
      if (consecutiveEmpty >= 3) {
        console.log(`\n  Stopping: ${consecutiveEmpty} consecutive empty pages`);
        break;
      }

      const elapsed = (Date.now() - startTime) / 1000;
      const pagesPerSec = (page - 1) / (elapsed || 1);
      const remainingPages = totalPages - page;
      const eta = remainingPages / (pagesPerSec || 1);
      process.stdout.write(
        `\r  Page ${page}/${totalPages} | Laws: ${seenLeyNumbers.size} | ${pagesPerSec.toFixed(1)} pg/s | ETA: ${formatDuration(eta)}  `
      );

      try {
        const html = await fetchPage(page, sessionCookies);
        const parsed = parseSearchResults(html);

        if (parsed.entries.length === 0) {
          consecutiveEmpty++;
          continue;
        }
        consecutiveEmpty = 0;

        if (totalCount === 0 && parsed.totalCount > 0) {
          totalCount = parsed.totalCount;
        }

        for (const entry of parsed.entries) {
          if (!seenLeyNumbers.has(entry.leyNumber)) {
            seenLeyNumbers.add(entry.leyNumber);
            const docId = `ley-${entry.leyNumber}`;
            const { ingested, provisionCount, ingestionDate } = checkIngested(docId);

            entries.push({
              id: docId,
              title: entry.title ? `Ley ${entry.leyNumber} — ${entry.title}` : `Ley ${entry.leyNumber}`,
              identifier: `Ley ${entry.leyNumber}`,
              url: buildInfolegUrl(entry.infolegId),
              status: 'in_force',
              category: 'Ley',
              classification: 'ingestable',
              ingested,
              provision_count: provisionCount,
              ingestion_date: ingestionDate,
              ley_number: entry.leyNumber,
              infoleg_id: entry.infolegId,
              publication_date: entry.publicationDate,
              description: entry.description,
              entity: entry.entity,
            });
          }
        }

        // Save checkpoint every 20 pages
        if (page % 20 === 0) {
          saveCheckpoint({
            phase: 'pagination',
            last_page: page,
            last_gap_ley: 0,
            entries,
            seen_ley_numbers: Array.from(seenLeyNumbers),
            session_id: sessionCookies,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`\n  ERROR page ${page}: ${msg}`);

        // If session expired, try to re-establish
        if (msg.includes('fetch') || msg.includes('network')) {
          console.log('  Attempting to re-establish session...');
          try {
            const initial = await initialSearch('de');
            sessionCookies = initial.sessionCookies;
            console.log('  Session re-established, retrying...');
            page--; // Retry this page
          } catch {
            console.log('  Failed to re-establish session, skipping page');
          }
        }
      }
    }

    console.log(`\n\n  Phase 1 complete: ${seenLeyNumbers.size} unique laws found\n`);

    // Save checkpoint for gap phase
    saveCheckpoint({
      phase: 'gaps',
      last_page: 0,
      last_gap_ley: 0,
      entries,
      seen_ley_numbers: Array.from(seenLeyNumbers),
      session_id: '',
      timestamp: new Date().toISOString(),
    });
  }

  // ========== Phase 2: Gap filling ==========
  if (!skipGaps && (!checkpoint || checkpoint.phase !== 'done')) {
    console.log('Phase 2: Gap filling (scanning missing ley numbers)...\n');

    // Find the max ley number we found
    const maxFound = Math.max(...seenLeyNumbers, 0);
    const targetMax = Math.min(maxFound + 50, MAX_LEY_NUMBER);

    let gapStart = checkpoint?.phase === 'gaps' ? (checkpoint.last_gap_ley + 1) : 1;
    let gapsChecked = 0;
    let gapsFound = 0;

    for (let leyNum = gapStart; leyNum <= targetMax; leyNum++) {
      if (seenLeyNumbers.has(leyNum)) continue;

      gapsChecked++;

      if (gapsChecked % 10 === 0 || gapsChecked === 1) {
        const elapsed = (Date.now() - startTime) / 1000;
        process.stdout.write(
          `\r  Gap check: ${leyNum}/${targetMax} | Gaps checked: ${gapsChecked} | Found: ${gapsFound} | Total: ${seenLeyNumbers.size}  `
        );
      }

      try {
        const result = await searchSingleLey(leyNum);
        if (result) {
          gapsFound++;
          seenLeyNumbers.add(leyNum);
          const docId = `ley-${leyNum}`;
          const { ingested, provisionCount, ingestionDate } = checkIngested(docId);

          entries.push({
            id: docId,
            title: result.title ? `Ley ${leyNum} — ${result.title}` : `Ley ${leyNum}`,
            identifier: `Ley ${leyNum}`,
            url: buildInfolegUrl(result.infolegId),
            status: 'in_force',
            category: 'Ley',
            classification: 'ingestable',
            ingested,
            provision_count: provisionCount,
            ingestion_date: ingestionDate,
            ley_number: leyNum,
            infoleg_id: result.infolegId,
            publication_date: result.publicationDate,
            description: result.description,
            entity: result.entity,
          });
        }
      } catch {
        // Skip errors during gap filling
      }

      // Save checkpoint every 100 gaps
      if (gapsChecked % 100 === 0) {
        saveCheckpoint({
          phase: 'gaps',
          last_page: 0,
          last_gap_ley: leyNum,
          entries,
          seen_ley_numbers: Array.from(seenLeyNumbers),
          session_id: '',
          timestamp: new Date().toISOString(),
        });
      }
    }

    console.log(`\n\n  Phase 2 complete: ${gapsChecked} gaps checked, ${gapsFound} found\n`);
  }

  // ========== Write census.json ==========
  // Sort entries by ley number
  entries.sort((a, b) => a.ley_number - b.ley_number);

  // Deduplicate by ley number (keep first occurrence)
  const seenIds = new Set<number>();
  const deduped: CensusEntry[] = [];
  for (const entry of entries) {
    if (!seenIds.has(entry.ley_number)) {
      seenIds.add(entry.ley_number);
      deduped.push(entry);
    }
  }

  const ingestable = deduped.filter(e => e.classification === 'ingestable').length;
  const notIngestable = deduped.filter(e => e.classification === 'not_ingestable').length;
  const ingested = deduped.filter(e => e.ingested).length;
  const totalProvisions = deduped.reduce((sum, e) => sum + e.provision_count, 0);

  const census: Census = {
    schema_version: '1.0',
    jurisdiction: 'AR',
    jurisdiction_name: 'Argentina',
    portal: 'infoleg',
    portal_url: 'https://servicios.infoleg.gob.ar',
    generated: new Date().toISOString().slice(0, 10),
    summary: {
      total_laws: deduped.length,
      total_ingestable: ingestable,
      total_not_ingestable: notIngestable,
      total_ingested: ingested,
      total_provisions: totalProvisions,
      ley_number_range: deduped.length > 0
        ? `${deduped[0].ley_number}–${deduped[deduped.length - 1].ley_number}`
        : '0–0',
      norm_types_included: ['Ley'],
    },
    laws: deduped,
  };

  const dataDir = path.dirname(CENSUS_PATH);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));

  // Clean up checkpoint
  if (fs.existsSync(CHECKPOINT_PATH)) {
    fs.unlinkSync(CHECKPOINT_PATH);
  }

  const elapsed = (Date.now() - startTime) / 1000;

  console.log(`${'='.repeat(60)}`);
  console.log('Census Report');
  console.log('='.repeat(60));
  console.log(`\n  Total laws:          ${deduped.length}`);
  console.log(`  Ingestable:          ${ingestable}`);
  console.log(`  Not ingestable:      ${notIngestable}`);
  console.log(`  Already ingested:    ${ingested}`);
  console.log(`  Total provisions:    ${totalProvisions}`);
  console.log(`  Ley number range:    ${census.summary.ley_number_range}`);
  console.log(`  ---`);
  console.log(`  Time:                ${formatDuration(elapsed)}`);
  console.log(`\n  Output: ${CENSUS_PATH}`);
  console.log(`  Size: ${(fs.statSync(CENSUS_PATH).size / 1024).toFixed(0)} KB\n`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
