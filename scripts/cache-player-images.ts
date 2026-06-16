import fs from 'fs';
import path from 'path';

type Sticker = {
  id: string;
  name: string;
  image: string | null;
};

type Attribution = {
  stickerId: string;
  imageUrl?: string;
  cachedPath?: string;
  cachedAt?: string;
};

const args = process.argv.slice(2);
const argSet = new Set(args);
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const teamArg = args.find((arg) => arg.startsWith('--team='));
const categoryArg = args.find((arg) => arg.startsWith('--category='));
const countryArg = args.find((arg) => arg.startsWith('--country='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;
const force = argSet.has('--force');

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
    if (a.startsWith('--limit=') || a.startsWith('--team=') || a.startsWith('--category=') || a.startsWith('--country=')) return false;
    if (a === '--force') return false;
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
const publicImageDir = path.join(root, 'public', 'player-images');

if (!fs.existsSync(dbPath)) {
  console.error('Missing data/worldcup.db. Run `npm run dev` once first so the app can create and seed the database.');
  process.exit(1);
}

const { default: Database } = await import('better-sqlite3');
const db = new Database(dbPath);

function readAttribution(): Attribution[] {
  if (!fs.existsSync(attributionPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(attributionPath, 'utf8')) as Attribution[];
  } catch {
    return [];
  }
}

function contentTypeExtension(contentType: string | null): string {
  if (!contentType) return '.jpg';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('gif')) return '.gif';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  return '.jpg';
}

function isRemoteImage(value?: string | null): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

async function downloadImage(url: string) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'image/avif,image/webp,image/png,image/jpeg,image/*',
      'User-Agent': 'Paninarr/1.0 (local player image cache)'
    }
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type');
  if (!contentType?.startsWith('image/')) {
    throw new Error(`Expected an image response, got ${contentType || 'unknown content type'}`);
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  return {
    bytes,
    extension: contentTypeExtension(contentType)
  };
}

fs.mkdirSync(publicImageDir, { recursive: true });

const attribution = readAttribution();
const attributionByStickerId = new Map(attribution.map((item) => [item.stickerId, item]));
const updateImage = db.prepare('UPDATE stickers SET image = ? WHERE id = ?');

const whereClauses: string[] = ["image IS NOT NULL AND image != ''"];
const queryParams: string[] = [];
if (categoryFilter) {
  whereClauses.push('category = ?');
  queryParams.push(categoryFilter);
} else if (teamFilter) {
  whereClauses.push("category = 'National Teams'");
}
if (teamFilter) {
  whereClauses.push('country = ?');
  queryParams.push(teamFilter);
}
if (countryFilter) {
  whereClauses.push('country = ?');
  queryParams.push(countryFilter);
}

const stickers = db.prepare(`
  SELECT id, name, image
  FROM stickers
  WHERE ${whereClauses.join(' AND ')}
  ORDER BY id
  ${limit && Number.isFinite(limit) ? `LIMIT ${limit}` : ''}
`).all(...queryParams) as Sticker[];

const scopeLabel = [
  categoryFilter ? `category: ${categoryFilter}` : null,
  teamFilter ? `team: ${teamFilter}` : null,
  countryFilter ? `country: ${countryFilter}` : null,
].filter(Boolean).join(', ');
if (scopeLabel) console.log(`Caching images for ${scopeLabel} (${stickers.length} stickers)`);

let cached = 0;
let skipped = 0;
let failed = 0;

for (const sticker of stickers) {
  const existingAttribution = attributionByStickerId.get(sticker.id);
  const sourceUrl = isRemoteImage(sticker.image)
    ? sticker.image
    : force && isRemoteImage(existingAttribution?.imageUrl)
      ? existingAttribution.imageUrl
      : null;

  if (!sourceUrl) {
    skipped++;
    console.log(`[skip] ${sticker.id} ${sticker.name}`);
    continue;
  }

  try {
    const image = await downloadImage(sourceUrl);
    const fileName = `${sticker.id}${image.extension}`;
    const filePath = path.join(publicImageDir, fileName);
    const publicPath = `/player-images/${fileName}`;

    fs.writeFileSync(filePath, image.bytes);
    updateImage.run(publicPath, sticker.id);

    if (existingAttribution) {
      existingAttribution.cachedPath = publicPath;
      existingAttribution.cachedAt = new Date().toISOString();
    }

    cached++;
    console.log(`[ok] ${sticker.id} ${sticker.name} -> ${publicPath}`);
  } catch (err) {
    failed++;
    console.log(`[error] ${sticker.id} ${sticker.name}: ${(err as Error).message}`);
  }
}

if (attribution.length > 0) {
  fs.writeFileSync(attributionPath, `${JSON.stringify(attribution, null, 2)}\n`);
}

console.log(`Done. Cached ${cached}, skipped ${skipped}, failed ${failed}, checked ${stickers.length}.`);
