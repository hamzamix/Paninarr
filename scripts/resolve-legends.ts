import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import fetch from 'node-fetch';

const UA = 'Paninarr-LegendResolver/1.0';

const entries: [string, string][] = [
  ['S1281', 'Pelé'],
  ['S1282', 'Diego Maradona'],
  ['S1283', 'Zinedine Zidane'],
  ['S1284', 'Ronaldo (Brazilian footballer)'],
  ['S1285', 'Johan Cruyff'],
  ['S1286', 'Ronaldinho'],
  ['S1287', 'Franz Beckenbauer'],
  ['S1288', 'Garrincha'],
  ['S1289', 'Bobby Charlton'],
  ['S1290', 'Eusébio'],
  ['S1291', 'Lev Yashin'],
  ['S1292', 'Gerd Müller'],
  ['S1293', 'Michel Platini'],
  ['S1294', 'Dino Zoff'],
  ['S1295', 'Paolo Rossi'],
  ['S1296', 'Geoff Hurst'],
  ['S1297', 'Just Fontaine'],
  ['S1298', 'Miroslav Klose'],
  ['S1299', 'Roberto Baggio'],
  ['S1300', 'Zico'],
  ['S1301', 'Lothar Matthäus'],
  ['S1302', 'Paolo Maldini'],
  ['S1303', 'Hristo Stoichkov'],
  ['S1304', 'Diego Forlán'],
  ['S1305', 'FIFA World Cup Trophy'],
  ['S1306', 'Golden Ball (association football)'],
  ['S1307', 'Golden Boot (association football)'],
  ['S1308', 'FIFA Golden Glove award'],
];

async function getPageImage(title: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&piprop=original&format=json`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const pages = data?.query?.pages || {};
    const page = Object.values(pages)[0] as any;
    return page?.original?.source || page?.thumbnail?.source || null;
  } catch { return null; }
}

const filePath = join(import.meta.dirname, '..', 'data', 'manual-image-overrides.json');
const raw = readFileSync(filePath, 'utf8');
const overrides = JSON.parse(raw);

async function main() {
  let found = 0, notFound = 0;
  for (const [id, title] of entries) {
    process.stdout.write(`${id} ${title}... `);
    const url = await getPageImage(title);
    if (url) {
      overrides[id] = { url, position: 'center center' };
      console.log('OK');
      found++;
    } else {
      console.log('NOT FOUND');
      notFound++;
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  writeFileSync(filePath, JSON.stringify(overrides, null, 2));
  console.log(`\nDone: ${found} resolved, ${notFound} not found. Total overrides: ${Object.keys(overrides).length}`);
}

main();