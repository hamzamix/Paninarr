import fs from 'fs';
import path from 'path';

type Sticker = {
  id: string;
  name: string;
  category: string;
  country: string | null;
  image: string | null;
};

type Attribution = {
  stickerId: string;
  playerName: string;
  country: string | null;
  source: 'wikimedia-commons';
  wikidataId: string;
  commonsFile: string;
  imageUrl: string;
  pageUrl: string;
  artist?: string;
  licenseShortName?: string;
  licenseUrl?: string;
  resolvedAt: string;
};

type ImageMapEntry = { key: string; url: string; comment?: string };

const args = process.argv.slice(2);
const argSet = new Set(args);
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const delayArg = args.find((arg) => arg.startsWith('--delay='));
const teamArg = args.find((arg) => arg.startsWith('--team='));
const categoryArg = args.find((arg) => arg.startsWith('--category='));
const countryArg = args.find((arg) => arg.startsWith('--country='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;
const requestDelay = delayArg ? Number(delayArg.split('=')[1]) : 750;
const includeExisting = argSet.has('--all');
const dryRun = argSet.has('--dry-run');

const KNOWN_CATEGORIES = new Set(['National Teams', 'Stadiums', 'Host Cities', 'Legends', 'Trophies']);
const ALIASES: Record<string, string> = {
  'national-teams': 'National Teams',
  'nationalteams': 'National Teams',
  'stadiums': 'Stadiums',
  'stadium': 'Stadiums',
  'host-cities': 'Host Cities',
  'hostcities': 'Host Cities',
  'hostcity': 'Host Cities',
  'host-city': 'Host Cities',
  'cities': 'Host Cities',
  'city': 'Host Cities',
  'legends': 'Legends',
  'legend': 'Legends',
  'trophies': 'Trophies',
  'trophy': 'Trophies',
};

function resolveCategoryAlias(input: string): string {
  const key = input.toLowerCase().replace(/\s+/g, '-');
  if (ALIASES[key]) return ALIASES[key];
  if (KNOWN_CATEGORIES.has(input)) return input;
  const direct = [...KNOWN_CATEGORIES].find((c) => c.toLowerCase() === input.toLowerCase());
  if (direct) return direct;
  throw new Error(`Unknown category: "${input}". Use one of: ${[...KNOWN_CATEGORIES].join(', ')}`);
}

let teamFilter = teamArg ? teamArg.split('=')[1].replace(/_/g, ' ') : null;
let categoryFilter: string | null = null;
if (categoryArg) {
  categoryFilter = resolveCategoryAlias(categoryArg.split('=')[1]);
}
let countryFilter = countryArg ? countryArg.split('=')[1].replace(/_/g, ' ') : null;

if (!teamFilter && !categoryFilter) {
  const unknownFlag = args.find((a) => {
    if (!a.startsWith('--')) return false;
    if (a.startsWith('--limit=') || a.startsWith('--delay=') || a.startsWith('--team=') || a.startsWith('--category=') || a.startsWith('--country=')) return false;
    if (a === '--all' || a === '--dry-run') return false;
    return true;
  });
  if (unknownFlag) {
    const raw = unknownFlag.slice(2).replace(/_/g, ' ');
    try {
      categoryFilter = resolveCategoryAlias(raw);
    } catch {
      teamFilter = raw;
    }
  }
}

const root = process.cwd();
const dataDir = path.join(root, 'data');
const dbPath = path.join(dataDir, 'worldcup.db');
const attributionPath = path.join(dataDir, 'player-image-attribution.json');

if (!fs.existsSync(dbPath)) {
  console.error('Missing data/worldcup.db. Run `npm run dev` once first so the app can create and seed the database.');
  process.exit(1);
}

const { default: Database } = await import('better-sqlite3');
const db = new Database(dbPath);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stripHtml(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function commonsPageUrl(fileName: string) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName).replace(/%20/g, '_')}`;
}

async function getJson<T>(url: string, attempt = 1): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Paninarr/1.0 (local player image resolver; Wikimedia Commons/Wikidata)'
    }
  });

  if (res.status === 429 && attempt <= 4) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : attempt * 2000;
    await sleep(waitMs);
    return getJson<T>(url, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

async function searchWikidata(name: string, country: string | null): Promise<string[]> {
  const queries = [
    country ? `${name} ${country} footballer` : `${name} footballer`,
    name
  ];
  const ids: string[] = [];

  for (const query of queries) {
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action', 'wbsearchentities');
    url.searchParams.set('format', 'json');
    url.searchParams.set('language', 'en');
    url.searchParams.set('limit', '5');
    url.searchParams.set('search', query);

    const data = await getJson<{ search?: Array<{ id: string }> }>(url.toString());
    for (const result of data.search || []) {
      if (!ids.includes(result.id)) ids.push(result.id);
    }
  }

  return ids;
}

async function getCommonsImageFile(wikidataId: string): Promise<string | null> {
  const data = await getJson<{
    entities: Record<string, {
      claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: string } } }>>;
    }>;
  }>(`https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`);

  return data.entities[wikidataId]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value || null;
}

async function getCommonsImageInfo(fileName: string) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata');
  url.searchParams.set('titles', `File:${fileName}`);

  const data = await getJson<{
    query?: {
      pages?: Record<string, {
        imageinfo?: Array<{
          url?: string;
          extmetadata?: Record<string, { value?: string }>;
        }>;
      }>;
    };
  }>(url.toString());

  const page = Object.values(data.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  if (!info?.url) return null;

  return {
    imageUrl: info.url,
    artist: stripHtml(info.extmetadata?.Artist?.value),
    licenseShortName: stripHtml(info.extmetadata?.LicenseShortName?.value),
    licenseUrl: stripHtml(info.extmetadata?.LicenseUrl?.value)
  };
}

async function searchWikipediaPageImage(name: string, country: string | null): Promise<{ imageUrl: string; pageTitle: string; pageUrl: string } | null> {
  const queries = [
    country ? `${name} ${country} footballer` : `${name} footballer`,
    name,
  ];
  for (const query of queries) {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', query);
    url.searchParams.set('srlimit', '5');
    const data = await getJson<{ query?: { search?: Array<{ title: string }> } }>(url.toString());
    const pages = data.query?.search || [];
    for (const page of pages) {
      const imgUrl = new URL('https://en.wikipedia.org/w/api.php');
      imgUrl.searchParams.set('action', 'query');
      imgUrl.searchParams.set('format', 'json');
      imgUrl.searchParams.set('prop', 'pageimages');
      imgUrl.searchParams.set('piprop', 'original');
      imgUrl.searchParams.set('titles', page.title);
      const imgData = await getJson<{
        query?: { pages?: Record<string, { original?: { source?: string } }> };
      }>(imgUrl.toString());
      const pageObj = Object.values(imgData.query?.pages || {})[0];
      const source = pageObj?.original?.source;
      if (source) {
        return {
          imageUrl: source,
          pageTitle: page.title,
          pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
        };
      }
    }
  }
  return null;
}

function readExistingAttribution(): Attribution[] {
  if (!fs.existsSync(attributionPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(attributionPath, 'utf8')) as Attribution[];
  } catch {
    return [];
  }
}

const imagesTsPath = path.join(root, 'src', 'utils', 'stickerImages.ts');
function readExistingImageMapKeys(): Set<string> {
  const content = fs.readFileSync(imagesTsPath, 'utf8');
  const keys = new Set<string>();
  const re = /^\s+'([^']+)':/gm;
  let match;
  while ((match = re.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

function readExistingImageMapEntries(): Map<string, string> {
  const content = fs.readFileSync(imagesTsPath, 'utf8');
  const entries = new Map<string, string>();
  const re = /^\s+'([^']+)':\s*'([^']+)',?$/gm;
  let match;
  while ((match = re.exec(content)) !== null) {
    entries.set(match[1], match[2]);
  }
  return entries;
}

const whereClauses: string[] = [];
const params: string[] = [];
if (categoryFilter) {
  whereClauses.push('category = ?');
  params.push(categoryFilter);
} else if (teamFilter) {
  whereClauses.push("category = 'National Teams'");
} else {
  whereClauses.push("category IN ('National Teams', 'Stadiums', 'Host Cities', 'Legends', 'Trophies')");
}
if (teamFilter) {
  whereClauses.push('country = ?');
  params.push(teamFilter);
}
if (countryFilter) {
  whereClauses.push('country = ?');
  params.push(countryFilter);
}
const sql = `
  SELECT id, name, category, country, image
  FROM stickers
  WHERE ${whereClauses.join(' AND ')}
  ORDER BY id
  ${limit && Number.isFinite(limit) ? `LIMIT ${limit}` : ''}
`;

const stickers = db.prepare(sql).all(...params) as Sticker[];
const scopeLabel = [
  categoryFilter ? `category: ${categoryFilter}` : null,
  teamFilter ? `team: ${teamFilter}` : null,
  countryFilter ? `country: ${countryFilter}` : null,
].filter(Boolean).join(', ');
if (scopeLabel) console.log(`Resolving images for ${scopeLabel} (${stickers.length} stickers)`);
const existingAttribution = readExistingAttribution();
const byStickerId = new Map(existingAttribution.map((item) => [item.stickerId, item]));
const existingMapKeys = includeExisting ? new Set<string>() : readExistingImageMapKeys();

let resolved = 0;
let missed = 0;
let skipped = 0;
const newEntries: ImageMapEntry[] = [];

for (const sticker of stickers) {
  try {
    if (existingMapKeys.has(sticker.id)) {
      skipped++;
      console.log(`[skip] ${sticker.id} ${sticker.name} (already in imagesMap)`);
      continue;
    }

    const ids = await searchWikidata(sticker.name, sticker.country);
    let attribution: Attribution | null = null;

    for (const id of ids) {
      const fileName = await getCommonsImageFile(id);
      if (!fileName) continue;

      const imageInfo = await getCommonsImageInfo(fileName);
      if (!imageInfo) continue;

      attribution = {
        stickerId: sticker.id,
        playerName: sticker.name,
        country: sticker.country,
        source: 'wikimedia-commons',
        wikidataId: id,
        commonsFile: fileName,
        imageUrl: imageInfo.imageUrl,
        pageUrl: commonsPageUrl(fileName),
        artist: imageInfo.artist,
        licenseShortName: imageInfo.licenseShortName,
        licenseUrl: imageInfo.licenseUrl,
        resolvedAt: new Date().toISOString()
      };
      break;
    }

    if (attribution) {
      resolved++;
      byStickerId.set(sticker.id, attribution);
      newEntries.push({ key: sticker.id, url: attribution.imageUrl });
      console.log(`[ok] ${sticker.id} ${sticker.name} -> ${attribution.imageUrl}`);
    } else {
      // Fallback: try Wikipedia page image
      const wikiImage = await searchWikipediaPageImage(sticker.name, sticker.country);
      if (wikiImage) {
        resolved++;
        const fallbackAttribution: Attribution = {
          stickerId: sticker.id,
          playerName: sticker.name,
          country: sticker.country,
          source: 'wikimedia-commons',
          wikidataId: '',
          commonsFile: '',
          imageUrl: wikiImage.imageUrl,
          pageUrl: wikiImage.pageUrl,
          resolvedAt: new Date().toISOString()
        };
        byStickerId.set(sticker.id, fallbackAttribution);
        newEntries.push({ key: sticker.id, url: wikiImage.imageUrl });
        console.log(`[ok] ${sticker.id} ${sticker.name} (wiki fallback) -> ${wikiImage.imageUrl}`);
      } else {
        missed++;
        console.log(`[miss] ${sticker.id} ${sticker.name}`);
      }
    }
  } catch (err) {
    missed++;
    console.log(`[error] ${sticker.id} ${sticker.name}: ${(err as Error).message}`);
  }

  await sleep(requestDelay);
}

// Write resolved entries into stickerImages.ts
if (!dryRun && newEntries.length > 0) {
  // Group new entries by category, then by country for nice comments
  const byCategory: Map<string, Map<string, ImageMapEntry[]>> = new Map();
  for (const entry of newEntries) {
    const sticker = stickers.find((s) => s.id === entry.key);
    const category = sticker?.category || 'Unknown';
    const country = sticker?.country || 'International';
    if (!byCategory.has(category)) byCategory.set(category, new Map());
    const byCountry = byCategory.get(category)!;
    if (!byCountry.has(country)) byCountry.set(country, []);
    byCountry.get(country)!.push(entry);
  }

  // Build insertion block
  let insertBlock = '';
  for (const [category, byCountry] of byCategory) {
    for (const [country, entries] of byCountry) {
      insertBlock += `\n    // --- ${country} ${category} (auto-resolved)\n`;
      for (const entry of entries) {
        insertBlock += `    '${entry.key}': '${entry.url}',\n`;
      }
    }
  }

  // Insert before the closing `};` of imagesMap (first `};` after the opening `= {`)
  let tsContent = fs.readFileSync(imagesTsPath, 'utf8');
  const mapStartIdx = tsContent.indexOf('= {');
  const mapEndMarker = '\n};';
  const mapEndIdx = tsContent.indexOf(mapEndMarker, mapStartIdx);
  if (mapEndIdx !== -1) {
    tsContent = tsContent.slice(0, mapEndIdx) + insertBlock + '\n' + tsContent.slice(mapEndIdx + 1);
    fs.writeFileSync(imagesTsPath, tsContent);
    console.log(`Updated stickerImages.ts with ${newEntries.length} new image entries.`);
  } else {
    console.error('Could not find imagesMap closing }; in stickerImages.ts');
  }
}

if (!dryRun) {
  fs.writeFileSync(
    attributionPath,
    `${JSON.stringify(Array.from(byStickerId.values()).sort((a, b) => a.stickerId.localeCompare(b.stickerId)), null, 2)}\n`
  );
}

console.log(`Done. Resolved ${resolved}, missed ${missed}, skipped ${skipped}, checked ${stickers.length}.`);
