/**
 * HTML parser for Argentine legislation from InfoLEG (infoleg.gob.ar).
 *
 * InfoLEG serves consolidated legislation as structured HTML pages.
 * NOTE: InfoLEG serves pages as ISO-8859-1 but Node's fetch decodes as UTF-8,
 * causing accented characters (Í, °) to become U+FFFD replacement characters.
 * The parser handles both clean UTF-8 and garbled variants.
 *
 * Argentine legislation uses the following article numbering patterns:
 *
 *   "ARTICULO 1°" / "ARTÍCULO 1°" — formal numbered articles
 *   "Artículo 1°" / "Artículo 1" — standard numbered articles
 *   "Art. 1°" / "Art. 1" — abbreviated form
 *   "ARTICULO 1º" — using ordinal indicator
 *
 * The HTML typically contains:
 * - Article text in paragraphs or divs
 * - Chapter/Title headings (CAPITULO, TITULO, SECCION)
 * - Occasional bold/italic formatting for terms and headings
 *
 * provision_ref format: "art1", "art2", etc.
 */

export interface ActIndexEntry {
  id: string;
  title: string;
  titleEn: string;
  shortName: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
  description?: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/**
 * Decode HTML entities and strip tags to get plain text.
 */
function stripHtml(html: string): string {
  return html
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove script and style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Replace <br> and <p> with spaces
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8212;/g, '\u2014')  // em dash
    .replace(/&#8211;/g, '\u2013')  // en dash
    .replace(/&#8220;/g, '\u201c')  // left double quote
    .replace(/&#8221;/g, '\u201d')  // right double quote
    .replace(/&#8216;/g, '\u2018')  // left single quote
    .replace(/&#8217;/g, '\u2019')  // right single quote
    .replace(/&#8230;/g, '\u2026')  // ellipsis
    .replace(/&aacute;/gi, '\u00e1')
    .replace(/&eacute;/gi, '\u00e9')
    .replace(/&iacute;/gi, '\u00ed')
    .replace(/&oacute;/gi, '\u00f3')
    .replace(/&uacute;/gi, '\u00fa')
    .replace(/&ntilde;/gi, '\u00f1')
    .replace(/&Aacute;/g, '\u00c1')
    .replace(/&Eacute;/g, '\u00c9')
    .replace(/&Iacute;/g, '\u00cd')
    .replace(/&Oacute;/g, '\u00d3')
    .replace(/&Uacute;/g, '\u00da')
    .replace(/&Ntilde;/g, '\u00d1')
    .replace(/&uuml;/gi, '\u00fc')
    .replace(/&Uuml;/g, '\u00dc')
    .replace(/&laquo;/g, '\u00ab')
    .replace(/&raquo;/g, '\u00bb')
    .replace(/&ordm;/g, '\u00ba')
    .replace(/&ordf;/g, '\u00aa')
    .replace(/&iquest;/g, '\u00bf')
    .replace(/&iexcl;/g, '\u00a1')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '\u201c')
    .replace(/&rdquo;/g, '\u201d')
    .replace(/&#\d+;/g, '')
    // Remove replacement characters (from encoding mismatches)
    .replace(/\uFFFD/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize an article number string.
 * Handles: "1°", "1º", "1", "1 bis", "1bis", etc.
 * Returns the clean number for use in provision_ref.
 */
function normalizeArticleNumber(raw: string): string {
  return raw
    .replace(/[°º\uFFFD]/g, '')    // Remove degree/ordinal/replacement symbols
    .replace(/\s+/g, '')            // Remove spaces (e.g., "1 bis" -> "1bis")
    .replace(/\./g, '')             // Remove dots
    .trim()
    .toLowerCase();
}

/**
 * Find the chapter/title heading context for a given position in the HTML.
 * Looks backward for TITULO, CAPITULO, SECCION headings.
 * Handles both clean UTF-8 and garbled (replacement char) text.
 */
function findChapterContext(html: string, position: number): string {
  const before = html.substring(Math.max(0, position - 10000), position);

  // Look for chapter/title headings — Argentine legislation uses:
  // TITULO I, CAPITULO I, SECCION 1, etc.
  // Also handle garbled text where Í becomes \uFFFD: T\uFFFDTULO, CAP\uFFFDTULO, SECCI\uFFFDN
  const headingPattern = /(?:T[IÍ\uFFFD]TULO|CAP[IÍ\uFFFD]TULO|SECCI[OÓ\uFFFD]N|PARTE)\s+[IVXLCDM\d]+[^<\n]*/gi;
  const matches = [...before.matchAll(headingPattern)];

  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    return stripHtml(lastMatch[0]).trim();
  }

  return '';
}

/**
 * Extract definitions from article content.
 * Argentine laws define terms using patterns like:
 * "a los efectos de la presente ley, se entiende por..."
 * or definition lists with lettered items.
 */
function extractDefinitions(content: string, provisionRef: string): ParsedDefinition[] {
  const definitions: ParsedDefinition[] = [];

  // Pattern: lettered items like "a) Term: definition" or "a) Term. definition"
  const itemRegex = /[a-z]\)\s*([^:.\n]+?)[:\.]\s*([^;]+?)(?=[a-z]\)|$)/gi;
  let match: RegExpExecArray | null;

  // Only extract from articles that look like definition sections
  const lowerContent = content.toLowerCase();
  if (!lowerContent.includes('entiende por') &&
      !lowerContent.includes('definicion') &&
      !lowerContent.includes('significado') &&
      !lowerContent.includes('a los fines') &&
      !lowerContent.includes('a los efectos')) {
    return definitions;
  }

  while ((match = itemRegex.exec(content)) !== null) {
    const term = match[1].trim();
    const definition = match[2].trim();

    if (term.length > 2 && term.length < 100 && definition.length > 10) {
      definitions.push({
        term,
        definition: definition.substring(0, 4000),
        source_provision: provisionRef,
      });
    }
  }

  return definitions;
}

/**
 * Parse InfoLEG HTML to extract provisions from an Argentine statute page.
 *
 * Argentine legislation HTML on InfoLEG is relatively flat — articles appear
 * as text blocks with "ARTICULO N°" or "Art. N°" prefixes. We split on article
 * boundaries and extract content between them.
 *
 * Handles encoding issues: InfoLEG serves ISO-8859-1 but Node fetch decodes
 * as UTF-8, causing Í -> \uFFFD and ° -> \uFFFD. The regex accounts for both.
 */
export function parseArgentineHtml(html: string, act: ActIndexEntry): ParsedAct {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];
  const seenRefs = new Set<string>();

  // Match article boundaries in the HTML.
  // Argentine patterns (handling both clean and garbled encoding):
  //   ARTICULO 1° — ...          (clean UTF-8)
  //   ART\uFFFDCULO 1\uFFFD — ...  (garbled ISO-8859-1)
  //   ARTÍCULO 1° — ...          (clean with accent)
  //   Art. 1° — ...              (abbreviated)
  //   Artículo 1° — ...          (mixed case)
  //   ARTICULO 1°.- ...          (with dot-dash)
  //   Art. 1 bis — ...           (with bis/ter/quater)
  //
  // The \uFFFD character appears where accented chars should be (Í -> \uFFFD, ° -> \uFFFD)
  const articleRegex = /(?:ART[IÍ\uFFFD]CULO|Art[iíi\uFFFD]culo|Art\.?)\s*(\d+(?:\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies))?)\s*[°º\uFFFD]?\s*(?:\.?\s*[-—–.\uFFFD]?\s*)/gi;

  const articleMatches: Array<{ num: string; pos: number; matchLen: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = articleRegex.exec(html)) !== null) {
    articleMatches.push({
      num: match[1],
      pos: match.index,
      matchLen: match[0].length,
    });
  }

  for (let i = 0; i < articleMatches.length; i++) {
    const artMatch = articleMatches[i];
    const contentStart = artMatch.pos + artMatch.matchLen;

    // Content extends to the next article or end of body
    const contentEnd = i + 1 < articleMatches.length
      ? articleMatches[i + 1].pos
      : html.length;

    const rawContent = html.substring(contentStart, contentEnd);
    const content = stripHtml(rawContent);

    // Skip articles with very little content
    if (content.length < 5) continue;

    // Normalize article number
    const artNum = normalizeArticleNumber(artMatch.num);
    const provisionRef = `art${artNum}`;

    // Skip duplicates
    if (seenRefs.has(provisionRef)) continue;
    seenRefs.add(provisionRef);

    // Extract title: first sentence or clause before a period/colon
    let title = '';
    const titleMatch = content.match(/^([^.]{5,120})[.:]/);
    if (titleMatch) {
      title = titleMatch[1].trim();
      // Only use as title if it looks like a heading (not too long, not starting with lower-case verbose text)
      if (title.length > 100) {
        title = '';
      }
    }

    // Find chapter context
    const chapter = findChapterContext(html, artMatch.pos);

    // Cap content at 8K characters
    const cappedContent = content.length > 8000 ? content.substring(0, 8000) : content;

    provisions.push({
      provision_ref: provisionRef,
      chapter: chapter || undefined,
      section: artNum,
      title,
      content: cappedContent,
    });

    // Check for definitions
    const defs = extractDefinitions(content, provisionRef);
    definitions.push(...defs);
  }

  return {
    id: act.id,
    type: 'statute',
    title: act.title,
    title_en: act.titleEn,
    short_name: act.shortName,
    status: act.status,
    issued_date: act.issuedDate,
    in_force_date: act.inForceDate,
    url: act.url,
    description: act.description,
    provisions,
    definitions,
  };
}

/**
 * Pre-configured list of key Argentine federal acts to ingest.
 *
 * These are the most important federal acts for cybersecurity, data protection,
 * and compliance use cases. URLs point to InfoLEG consolidated texts.
 *
 * InfoLEG URL pattern:
 *   https://servicios.infoleg.gob.ar/infolegInternet/anexos/{range}/{id}/norma.htm
 * where {range} is e.g. "60000-64999" and {id} is the InfoLEG document ID.
 */
export const KEY_ARGENTINE_ACTS: ActIndexEntry[] = [
  {
    id: 'ley-25326',
    title: 'Ley 25.326 \u2014 Ley de Protecci\u00f3n de los Datos Personales',
    titleEn: 'Personal Data Protection Law (Law 25,326)',
    shortName: 'Ley 25.326',
    status: 'in_force',
    issuedDate: '2000-11-02',
    inForceDate: '2000-11-02',
    url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/norma.htm',
    description: 'Argentina\'s comprehensive personal data protection law. Establishes rights of data subjects, obligations of data controllers, the national data protection authority (AAIP), and cross-border transfer rules. Argentina holds an EU adequacy decision (2003/490/EC).',
  },
  {
    id: 'ley-26388',
    title: 'Ley 26.388 \u2014 Delitos Inform\u00e1ticos',
    titleEn: 'Cybercrime Law (Law 26,388)',
    shortName: 'Ley 26.388',
    status: 'in_force',
    issuedDate: '2008-06-24',
    inForceDate: '2008-06-24',
    url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/140000-144999/141790/norma.htm',
    description: 'Amendments to the Argentine Penal Code incorporating computer crimes: unauthorized access to computer systems, data damage/destruction, interception of communications, distribution of child exploitation material via electronic means, and fraud using electronic data.',
  },
  {
    id: 'ley-25506',
    title: 'Ley 25.506 \u2014 Ley de Firma Digital',
    titleEn: 'Digital Signature Law (Law 25,506)',
    shortName: 'Ley 25.506',
    status: 'in_force',
    issuedDate: '2001-12-11',
    inForceDate: '2001-12-11',
    url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/70000-74999/70749/norma.htm',
    description: 'Establishes the legal framework for digital and electronic signatures in Argentina. Recognizes the legal validity and enforceability of digital signatures, defines requirements for certification authorities, and sets up the digital signature infrastructure.',
  },
  {
    id: 'ley-19550',
    title: 'Ley 19.550 \u2014 Ley General de Sociedades',
    titleEn: 'General Companies Law (Law 19,550)',
    shortName: 'Ley 19.550',
    status: 'in_force',
    issuedDate: '1984-03-23',
    inForceDate: '1984-03-23',
    url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/25000-29999/25553/texact.htm',
    description: 'Argentina\'s comprehensive company law governing the formation, operation, and dissolution of commercial companies (sociedades comerciales). Covers all entity types including SA (corporations), SRL (limited liability companies), and partnerships.',
  },
  {
    id: 'ley-24240',
    title: 'Ley 24.240 \u2014 Ley de Defensa del Consumidor',
    titleEn: 'Consumer Protection Law (Law 24,240)',
    shortName: 'Ley 24.240',
    status: 'in_force',
    issuedDate: '1993-10-13',
    inForceDate: '1993-10-13',
    url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/638/norma.htm',
    description: 'Consumer protection law establishing rights of consumers, obligations of suppliers, warranty requirements, unfair contract terms, and remedies. Applies to all consumer transactions including digital services and e-commerce.',
  },
  {
    id: 'ley-27078',
    title: 'Ley 27.078 \u2014 Argentina Digital',
    titleEn: 'Argentina Digital Law (Law 27,078)',
    shortName: 'Ley 27.078',
    status: 'in_force',
    issuedDate: '2014-12-16',
    inForceDate: '2015-01-02',
    url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/239771/norma.htm',
    description: 'Telecommunications and ICT law establishing the regulatory framework for telecommunications services, internet access, audiovisual services, and digital infrastructure in Argentina. Created ENACOM as the regulatory authority.',
  },
  {
    id: 'constitucion-nacional',
    title: 'Constituci\u00f3n Nacional Argentina',
    titleEn: 'National Constitution of Argentina',
    shortName: 'Constituci\u00f3n Nacional',
    status: 'in_force',
    issuedDate: '1994-08-22',
    inForceDate: '1994-08-24',
    url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/804/norma.htm',
    description: 'The Constitution of Argentina (1994 reform). Article 43 establishes habeas data \u2014 the constitutional right to access, rectify, and suppress personal data held in public and private registries. Foundation for all data protection legislation.',
  },
  {
    id: 'codigo-penal',
    title: 'C\u00f3digo Penal de la Naci\u00f3n Argentina',
    titleEn: 'Argentine Penal Code',
    shortName: 'C\u00f3digo Penal',
    status: 'in_force',
    issuedDate: '1984-01-01',
    inForceDate: '1984-01-01',
    url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/16546/norma.htm',
    description: 'The Argentine Penal Code. Contains cybercrime provisions (as amended by Ley 26.388) including unauthorized access to computer systems (art. 153 bis), data damage (art. 183), interception of communications (art. 153), and computer fraud (art. 173 inc. 16).',
  },
  {
    id: 'ley-25065',
    title: 'Ley 25.065 \u2014 Ley de Tarjetas de Cr\u00e9dito',
    titleEn: 'Credit Card Law (Law 25,065)',
    shortName: 'Ley 25.065',
    status: 'in_force',
    issuedDate: '1999-01-07',
    inForceDate: '1999-01-14',
    url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/55000-59999/55556/norma.htm',
    description: 'Regulates credit card systems, including issuer obligations, consumer rights, interest rates, data handling requirements for financial transactions, and liability for unauthorized use.',
  },
  {
    id: 'ley-27275',
    title: 'Ley 27.275 \u2014 Derecho de Acceso a la Informaci\u00f3n P\u00fablica',
    titleEn: 'Access to Public Information Law (Law 27,275)',
    shortName: 'Ley 27.275',
    status: 'in_force',
    issuedDate: '2016-09-14',
    inForceDate: '2017-09-29',
    url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/265000-269999/265949/norma.htm',
    description: 'Establishes the right of access to public information held by government entities. Created the AAIP (Agencia de Acceso a la Informaci\u00f3n P\u00fablica) as the enforcement authority, which also absorbed the data protection authority role.',
  },
];
