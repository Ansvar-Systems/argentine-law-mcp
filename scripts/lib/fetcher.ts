/**
 * Rate-limited HTTP client for InfoLEG (infoleg.gob.ar)
 *
 * InfoLEG (Información Legislativa y Documental) is Argentina's comprehensive
 * legislative information portal maintained by the Ministry of Justice.
 * It provides consolidated HTML texts of all federal legislation.
 *
 * ENCODING NOTE: InfoLEG serves pages as ISO-8859-1 (Latin-1) but declares
 * charset in the HTML meta tag. Node's fetch() defaults to UTF-8, which garbles
 * accented characters. We use arrayBuffer() + TextDecoder('latin1') to properly
 * decode the response.
 *
 * URL pattern:
 *   https://servicios.infoleg.gob.ar/infolegInternet/anexos/{range}/{id}/norma.htm
 *
 * - 500ms minimum delay between requests (respectful to government servers)
 * - User-Agent header identifying the MCP
 * - Retry on 429/5xx with exponential backoff
 * - No auth needed (public government data)
 */

const USER_AGENT = 'Argentine-Law-MCP/1.0 (https://github.com/Ansvar-Systems/argentine-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 500;

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
  url: string;
}

/**
 * Detect the charset from Content-Type header or HTML meta tag.
 * InfoLEG typically uses ISO-8859-1.
 */
function detectCharset(contentType: string, bodyBytes: Uint8Array): string {
  // Check Content-Type header first
  const ctMatch = contentType.match(/charset=([^\s;]+)/i);
  if (ctMatch) {
    const charset = ctMatch[1].toLowerCase().replace(/['"]/g, '');
    if (charset === 'iso-8859-1' || charset === 'latin1' || charset === 'windows-1252') {
      return 'latin1';
    }
    return charset;
  }

  // Check HTML meta tag (look at first 2KB of bytes as ASCII)
  const head = new TextDecoder('ascii', { fatal: false }).decode(bodyBytes.slice(0, 2048));
  const metaMatch = head.match(/charset=([^\s"'>]+)/i);
  if (metaMatch) {
    const charset = metaMatch[1].toLowerCase().replace(/['"]/g, '');
    if (charset === 'iso-8859-1' || charset === 'latin1' || charset === 'windows-1252') {
      return 'latin1';
    }
    return charset;
  }

  // Default to latin1 for InfoLEG (most pages are ISO-8859-1)
  return 'latin1';
}

/**
 * Fetch a URL with rate limiting and proper headers.
 * Retries up to 3 times on 429/5xx errors with exponential backoff.
 * Properly handles ISO-8859-1 encoding from InfoLEG.
 */
export async function fetchWithRateLimit(url: string, maxRetries = 3): Promise<FetchResult> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html, application/xhtml+xml, */*',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.5',
      },
      redirect: 'follow',
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
    }

    const contentType = response.headers.get('content-type') ?? '';

    // Read as raw bytes first, then decode with correct charset
    const arrayBuffer = await response.arrayBuffer();
    const bodyBytes = new Uint8Array(arrayBuffer);
    const charset = detectCharset(contentType, bodyBytes);
    const body = new TextDecoder(charset, { fatal: false }).decode(bodyBytes);

    return {
      status: response.status,
      body,
      contentType,
      url: response.url,
    };
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}
