import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const filePath = join(import.meta.dirname, '..', 'data', 'manual-image-overrides.json');
const raw = readFileSync(filePath, 'utf8');
const overrides = JSON.parse(raw);

// Restored layout:
//   S1249-S1264 = Stadiums (16) ← keep existing overrides
//   S1265-S1280 = Host Cities (16) ← keep existing overrides
//   S1281-S1304 = Legends (24) ← remove wrong/old overrides
//   S1305-S1308 = Trophies (4) ← remove wrong/old overrides
//   S1309-S1356 = Managers (48) ← rekey from S1291-S1338

// Step 1: Rekey old manager overrides (S1291-S1338 → S1309-S1356, shift +18)
let rekeyed = 0;
for (let i = 47; i >= 0; i--) {
  const oldKey = 'S' + String(1291 + i).padStart(3, '0');
  const newKey = 'S' + String(1309 + i).padStart(3, '0');
  if (overrides[oldKey]) {
    overrides[newKey] = overrides[oldKey];
    delete overrides[oldKey];
    rekeyed++;
  }
}

// Step 2: Remove wrong overrides for legends/trophies (S1281-S1308)
const pad = (n: number) => 'S' + String(n).padStart(3, '0');
let removed = 0;
for (let i = 1281; i <= 1308; i++) {
  const k = pad(i);
  if (overrides[k]) {
    delete overrides[k];
    removed++;
  }
}

// Step 3: Remove old expanded legend overrides (S1339-S1356, now managers)
for (let i = 1339; i <= 1356; i++) {
  const k = pad(i);
  if (overrides[k]) {
    delete overrides[k];
    removed++;
  }
}

writeFileSync(filePath, JSON.stringify(overrides, null, 2));
console.log(`Rekeyed ${rekeyed} manager overrides, removed ${removed} wrong overrides. Total entries: ${Object.keys(overrides).length}`);