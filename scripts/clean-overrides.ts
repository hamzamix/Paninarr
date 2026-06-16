import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const filePath = join(import.meta.dirname, '..', 'data', 'manual-image-overrides.json');
const raw = readFileSync(filePath, 'utf8');
const overrides = JSON.parse(raw);
let removed = 0, restored = 0;

for (const [id, entry] of Object.entries(overrides) as [string, any][]) {
  if (!entry.url || entry.url === '') {
    delete overrides[id];
    removed++;
  } else if (entry.url?.startsWith('/fifa-cache/') || entry.url?.startsWith('/player-uploads/')) {
    if (entry.cdnUrl) {
      entry.url = entry.cdnUrl;
      delete entry.cdnUrl;
      restored++;
    } else {
      delete overrides[id];
      removed++;
    }
  }
}

writeFileSync(filePath, JSON.stringify(overrides, null, 2));
console.log(`Restored ${restored} cache entries to CDN URLs, removed ${removed} entries with no fallback`);
