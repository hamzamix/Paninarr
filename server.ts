import express from "express";
import path from "path";
import 'dotenv/config';
import Database from "better-sqlite3";
import fs from "fs";

const app = express();
const PORT = 3001;
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

// Initialize SQLite database
const dbDir = process.env.VERCEL ? '/tmp/data' : path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'worldcup.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Setup DB Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    recovery_code TEXT UNIQUE NOT NULL,
    join_date TEXT NOT NULL,
    country TEXT NOT NULL,
    avatar TEXT,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 300,
    coins INTEGER DEFAULT 1000,
    total_points INTEGER DEFAULT 0,
    daily_streak INTEGER DEFAULT 0,
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS stickers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    country TEXT,
    rarity TEXT NOT NULL,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS user_stickers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sticker_id TEXT NOT NULL,
    is_duplicate INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (sticker_id) REFERENCES stickers(id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    xp_reward INTEGER NOT NULL,
    language TEXT NOT NULL DEFAULT 'en'
  );
  CREATE INDEX IF NOT EXISTS idx_questions_lang ON questions(language);

  CREATE TABLE IF NOT EXISTS user_completed_questions (
    user_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    PRIMARY KEY (user_id, question_id)
  );
`);

// Add columns for tournament + booster (safe migration)
try { db.exec("ALTER TABLE users ADD COLUMN favorite_team TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN predicted_winner TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN simulation_winner TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN booster_claimed INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN last_daily_pack TEXT"); } catch {}


// Migration: fix incorrect player names
try {
  db.prepare("UPDATE stickers SET name = 'Cho Wije' WHERE country = 'South Korea' AND name = 'Cho Yu-min'").run();
} catch {}

// Tournament + badge tables
db.exec(`
  CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS user_badges (
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    awarded_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    PRIMARY KEY (user_id, badge_id)
  );
`);

// Seed the ultimate champion badge if missing
const badgeCount = db.prepare('SELECT COUNT(*) as c FROM badges').get() as { c: number };
if (badgeCount.c === 0) {
  db.prepare("INSERT INTO badges (id, name, description) VALUES (?, ?, ?)").run(
    'ultimate_champion', 'Ultimate Champion',
    'Awarded to those who correctly predicted the 2026 FIFA World Cup winner. Unlocks every sticker in the collection!'
  );
  console.log('Seeded Ultimate Champion badge!');
}

// Persistent tournament state (saved to JSON file so data survives restarts)
function getTournamentPath(userId?: string): string {
  return userId ? path.join(dbDir, `tournament-state-${userId}.json`) : path.join(dbDir, 'tournament-state.json');
}

type TourMatch = {
  id: string; round: string; groupName?: string; matchNumber: number;
  teamA: string; teamB: string; scoreA: number | null; scoreB: number | null; played: number;
  goalsA?: { player: string; minute: number }[]; goalsB?: { player: string; minute: number }[];
};
type GroupStanding = { team: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; pts: number };
type TourGroup = { name: string; teams: GroupStanding[] };
type TournamentData = {
  initialized: boolean; currentRound: string; groups: TourGroup[]; matches: TourMatch[];
  advancingTeams: string[]; eliminatedTeams: string[]; winner: string | null; roundOf32Pairings: TourMatch[];
  regenerationsUsed: number;
};

function loadTournament(userId?: string): TournamentData | null {
  const p = getTournamentPath(userId);
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch {}
  return null;
}

function saveTournament(data: TournamentData, userId?: string) {
  fs.writeFileSync(getTournamentPath(userId), JSON.stringify(data, null, 2));
}

// Team strength ratings for realistic simulation
const teamStrength: Record<string, number> = {
  'Argentina': 95, 'Brazil': 94, 'France': 93, 'England': 92, 'Spain': 91,
  'Portugal': 90, 'Germany': 89, 'Netherlands': 88, 'Belgium': 87, 'Croatia': 86,
  'Uruguay': 85, 'Colombia': 84, 'Morocco': 83, 'Japan': 82, 'Switzerland': 81,
  'United States': 80, 'Mexico': 79, 'Senegal': 78, 'South Korea': 77, 'Iran': 76,
  'Sweden': 75, 'Norway': 74, 'Türkiye': 73, 'Ecuador': 72, 'Paraguay': 71,
  'Algeria': 70, 'Egypt': 69, 'Ivory Coast': 68, 'Ghana': 67, 'Saudi Arabia': 66,
  'Australia': 65, 'New Zealand': 64, 'Scotland': 63, 'Austria': 62,
  'Czechia': 61, 'Canada': 60, 'Tunisia': 59, 'Qatar': 58, 'Jordan': 57,
  'Iraq': 56, 'Uzbekistan': 55, 'South Africa': 54, 'Bosnia and Herzegovina': 53,
  'Cabo Verde': 52, 'Curaçao': 51, 'Haiti': 50, 'DR Congo': 49, 'Panama': 48
};

const allCountries = Object.keys(teamStrength).sort((a, b) => teamStrength[b] - teamStrength[a]);

function poissonRandom(lambda: number): number {
  let L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function getPlayersForTeam(country: string): string[] {
  try {
    const rows = db.prepare("SELECT name FROM stickers WHERE country = ? AND category = 'National Teams'").all(country) as { name: string }[];
    return rows.map(r => r.name);
  } catch { return []; }
}

function generateGoalScorers(team: string, goals: number, existingScorers?: { player: string; minute: number }[]): { player: string; minute: number }[] {
  if (goals <= 0) return [];
  const players = getPlayersForTeam(team);
  if (players.length === 0) return Array.from({ length: goals }, (_, i) => ({ player: `${team} Player ${i + 1}`, minute: 1 + Math.floor(Math.random() * 90) }));
  const scorers: { player: string; minute: number }[] = [];
  const usedMinutes = new Set((existingScorers || []).map(s => s.minute));
  for (let i = 0; i < goals; i++) {
    const player = players[Math.floor(Math.random() * players.length)];
    let minute: number;
    do { minute = 1 + Math.floor(Math.random() * 90); } while (usedMinutes.has(minute));
    usedMinutes.add(minute);
    // OGs in minute 0
    scorers.push({ player, minute });
  }
  scorers.sort((a, b) => a.minute - b.minute);
  return scorers;
}

function simulateMatch(strengthA: number, strengthB: number): [number, number] {
  const avgGoals = 1.3;
  const total = strengthA + strengthB;
  const expectedA = avgGoals * 2 * (strengthA / total);
  const expectedB = avgGoals * 2 * (strengthB / total);
  const gA = poissonRandom(expectedA);
  const gB = poissonRandom(expectedB);
  return [gA, gB];
}

function assignGroups(): TourGroup[] {
  const realGroups: { name: string; teams: string[] }[] = [
    { name: 'A', teams: ['Mexico', 'South Korea', 'South Africa', 'Czechia'] },
    { name: 'B', teams: ['Canada', 'Switzerland', 'Qatar', 'Bosnia and Herzegovina'] },
    { name: 'C', teams: ['Brazil', 'Morocco', 'Haiti', 'Scotland'] },
    { name: 'D', teams: ['United States', 'Paraguay', 'Australia', 'Türkiye'] },
    { name: 'E', teams: ['Germany', 'Ecuador', 'Ivory Coast', 'Curaçao'] },
    { name: 'F', teams: ['Netherlands', 'Japan', 'Tunisia', 'Sweden'] },
    { name: 'G', teams: ['Belgium', 'Iran', 'Egypt', 'New Zealand'] },
    { name: 'H', teams: ['Spain', 'Uruguay', 'Saudi Arabia', 'Cabo Verde'] },
    { name: 'I', teams: ['France', 'Senegal', 'Norway', 'Iraq'] },
    { name: 'J', teams: ['Argentina', 'Austria', 'Algeria', 'Jordan'] },
    { name: 'K', teams: ['Portugal', 'Colombia', 'Uzbekistan', 'DR Congo'] },
    { name: 'L', teams: ['England', 'Croatia', 'Ghana', 'Panama'] },
  ];
  return realGroups.map(g => ({
    name: g.name,
    teams: g.teams.map(t => ({ team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 }))
  }));
}

function generateGroupMatches(groups: TourGroup[]): TourMatch[] {
  const matches: TourMatch[] = [];
  let mn = 0;
  for (const g of groups) {
    const t = g.teams.map(gs => gs.team);
    // Round-robin: each team plays the other 3
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        matches.push({ id: `group-${g.name}-${i}-${j}`, round: 'group', groupName: g.name, matchNumber: mn++, teamA: t[i], teamB: t[j], scoreA: null, scoreB: null, played: 0 });
      }
    }
  }
  return matches;
}

function playGroupMatches(groups: TourGroup[], matches: TourMatch[]): { groups: TourGroup[]; matches: TourMatch[] } {
  for (const m of matches) {
    const sA = teamStrength[m.teamA] || 50;
    const sB = teamStrength[m.teamB] || 50;
    const [gA, gB] = simulateMatch(sA, sB);
    m.scoreA = gA; m.scoreB = gB; m.played = 1;
    m.goalsA = generateGoalScorers(m.teamA, gA);
    m.goalsB = generateGoalScorers(m.teamB, gB);
    // Update group standings
    for (const g of groups) {
      for (const t of g.teams) {
        if (t.team === m.teamA) {
          t.played++; t.gf += gA; t.ga += gB; t.gd = t.gf - t.ga;
          if (gA > gB) { t.won++; t.pts += 3; }
          else if (gA === gB) { t.drawn++; t.pts += 1; }
          else t.lost++;
        }
        if (t.team === m.teamB) {
          t.played++; t.gf += gB; t.ga += gA; t.gd = t.gf - t.ga;
          if (gB > gA) { t.won++; t.pts += 3; }
          else if (gB === gA) { t.drawn++; t.pts += 1; }
          else t.lost++;
        }
      }
    }
  }
  return { groups, matches };
}

function getAdvancingTeams(groups: TourGroup[]): { advancing: string[]; thirdPlaceAll: { team: string; pts: number; gd: number; gf: number }[] } {
  const advancing: string[] = [];
  const thirdPlaceAll: { team: string; pts: number; gd: number; gf: number }[] = [];
  for (const g of groups) {
    const sorted = [...g.teams].sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.localeCompare(b.team);
    });
    advancing.push(sorted[0].team, sorted[1].team);
    thirdPlaceAll.push({ team: sorted[2].team, pts: sorted[2].pts, gd: sorted[2].gd, gf: sorted[2].gf });
  }
  // Take best 8 third-placed teams
  thirdPlaceAll.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.localeCompare(b.team);
  });
  for (let i = 0; i < 8; i++) advancing.push(thirdPlaceAll[i].team);
  return { advancing, thirdPlaceAll };
}

function createKnockoutPairings(advancing: string[]): TourMatch[] {
  const playoffs: TourMatch[] = [];
  // Sort advancing teams by group performance for balanced bracket
  const sorted = [...advancing];
  const n = sorted.length;
  for (let i = 0; i < n / 2; i++) {
    playoffs.push({ id: `ko-r32-${i}`, round: 'r32', matchNumber: i, teamA: sorted[i], teamB: sorted[n - 1 - i], scoreA: null, scoreB: null, played: 0 });
  }
  return playoffs;
}

function playKnockoutRound(matches: TourMatch[], round: string): { matches: TourMatch[]; winners: string[] } {
  const winners: string[] = [];
  for (const m of matches) {
    const sA = teamStrength[m.teamA] || 50;
    const sB = teamStrength[m.teamB] || 50;
    let [gA, gB] = simulateMatch(sA, sB);
    // Extra time / penalties if draw in knockout
    if (gA === gB) {
      // Simulate extra time: one more half of football
      const [eA, eB] = simulateMatch(sA * 0.5, sB * 0.5);
      gA += eA; gB += eB;
      if (gA === gB) {
        // Penalties: weighted random
        const penRounds = 5;
        let aPen = 0, bPen = 0;
        for (let p = 0; p < penRounds; p++) {
          if (Math.random() < 0.75 + (sA - sB) / 500) aPen++;
          if (Math.random() < 0.75 + (sB - sA) / 500) bPen++;
        }
        // Sudden death if still tied
        while (aPen === bPen) {
          if (Math.random() < 0.7) aPen++;
          if (Math.random() < 0.7) bPen++;
        }
        gA = gA < eA ? gA : gA; // keep original + extra
        gB = gB < eB ? gB : gB;
        m.scoreA = gA; m.scoreB = gB;
        // Mark as penalty win with small notation
        winners.push(aPen > bPen ? m.teamA : m.teamB);
      } else {
        m.scoreA = gA; m.scoreB = gB;
        winners.push(gA > gB ? m.teamA : m.teamB);
      }
    } else {
      m.scoreA = gA; m.scoreB = gB;
      winners.push(gA > gB ? m.teamA : m.teamB);
    }
    m.played = 1;
    m.round = round;
    m.goalsA = generateGoalScorers(m.teamA, m.scoreA || 0);
    m.goalsB = generateGoalScorers(m.teamB, m.scoreB || 0);
  }
  return { matches, winners };
}

function initTournament(userId?: string): TournamentData {
  const groups = assignGroups();
  const matches = generateGroupMatches(groups);
  const data: TournamentData = {
    initialized: true, currentRound: 'group', groups, matches,
    advancingTeams: [], eliminatedTeams: [], winner: null, roundOf32Pairings: [],
    regenerationsUsed: 0
  };
  saveTournament(data, userId);
  return data;
}

function getOrInitTournament(userId?: string): TournamentData {
  return loadTournament(userId) || initTournament(userId);
}
const manualOverridesPath = path.join(dbDir, 'manual-image-overrides.json');
type ManualOverride = { url: string; position?: string };
function loadManualOverrides(): Record<string, ManualOverride> {
  try {
    if (fs.existsSync(manualOverridesPath)) {
      const raw = JSON.parse(fs.readFileSync(manualOverridesPath, 'utf8'));
      // Migrate old format (string url) to new format (object)
      const migrated: Record<string, ManualOverride> = {};
      for (const [k, v] of Object.entries(raw)) {
        migrated[k] = typeof v === 'string' ? { url: v } : v as ManualOverride;
      }
      return migrated;
    }
  } catch {}
  return {};
}
function saveManualOverrides(overrides: Record<string, ManualOverride>) {
  fs.writeFileSync(manualOverridesPath, JSON.stringify(overrides, null, 2));
}

// Insert initial seed data if empty
const stickersCount = db.prepare('SELECT COUNT(*) as count FROM stickers').get() as {count: number};
if (stickersCount.count === 0) {
  try {
    db.prepare('DELETE FROM user_stickers').run();
    db.prepare('DELETE FROM stickers').run();
    const insertSticker = db.prepare('INSERT INTO stickers (id, name, description, category, country, rarity) VALUES (?, ?, ?, ?, ?, ?)');
    const generateSeedStickers = () => {
      let stickerIndex = 1;
      const getPaddedId = (index: number) => {
        return 'S' + String(index).padStart(3, '0');
      };

      const teamsData = [
        { country: 'Mexico', manager: 'Javier Aguirre Onaindía', players: ['Guillermo Ochoa', 'Raúl Rangel', 'Carlos Acevedo', 'Jesús Gallardo', 'César Montes', 'Jorge Sánchez', 'Johan Vásquez', 'Israel Reyes', 'Mateo Chávez', 'Edson Álvarez', 'Orbelín Pineda', 'Roberto Alvarado', 'Luis Romo', 'Luis Chávez', 'Érik Lira', 'Gilberto Mora', 'Brian Gutiérrez', 'Obed Vargas', 'Álvaro Fidalgo', 'Raúl Jiménez', 'Alexis Vega', 'Santiago Giménez', 'César Huerta', 'Julián Quiñones', 'Guillermo Martínez', 'Armando González'] },
        { country: 'South Africa', manager: 'Hugo Henri Broos', players: ['Ronwen Williams', 'Ricardo Goss', 'Sipho Chaine', 'Aubrey Modiba', 'Khuliso Mudau', 'Nkosinathi Sibisi', 'Mbekezeli Mbokazi', 'Ime Okon', 'Samukele Kabini', 'Khulumani Ndamane', 'Thabang Matuludi', 'Kamogelo Sebelebele', 'Bradley Cross', 'Olwethu Makhanya', 'Teboho Mokoena', 'Sphephelo Sithole', 'Thalente Mbatha', 'Jayden Adams', 'Themba Zwane', 'Lyle Foster', 'Evidence Makgopa', 'Oswin Appollis', 'Iqraam Rayners', 'Relebohile Mofokeng', 'Thapelo Maseko', 'Tshepang Moremi'] },
        { country: 'South Korea', manager: 'Myung-Bo Hong', players: ['Kim Seung-gyu', 'Jo Hyeon-woo', 'Song Bum-keun', 'Kim Min-jae', 'Kim Moon-hwan', 'Seol Young-woo', 'Cho Wije', 'Lee Tae-seok', 'Park Jin-seob', 'Kim Tae-hyeon', 'Lee Han-beom', 'Jens Castrop', 'Lee Ki-hyuk', 'Lee Jae-sung', 'Hwang Hee-chan', 'Hwang In-beom', 'Lee Kang-in', 'Paik Seung-ho', 'Kim Jin-gyu', 'Lee Dong-gyeong', 'Bae Jun-ho', 'Eom Ji-sung', 'Yang Hyun-jun', 'Son Heung-min', 'Cho Gue-sung', 'Oh Hyeon-gyu'] },
        { country: 'Czechia', manager: 'Miroslav KOUBEK', players: ['Matěj Kovář', 'Jindřich Staněk', 'Lukáš Horníček', 'Vladimír Coufal', 'Tomáš Holeš', 'Ladislav Krejčí', 'David Zima', 'Jaroslav Zelený', 'David Jurásek', 'David Douděra', 'Robin Hranáč', 'Štěpán Chaloupek', 'Tomáš Souček', 'Vladimír Darida', 'Lukáš Provod', 'Michal Sadílek', 'Pavel Šulc', 'Lukáš Červ', 'Hugo Sochůrek', 'Alexandr Sojka', 'Denis Višinský', 'Patrik Schick', 'Adam Hložek', 'Jan Kuchta', 'Mojmír Chytil', 'Tomáš Chorý'] },
        { country: 'Canada', manager: 'Jesse Alan Marsch', players: ['Dayne St. Clair', 'Maxime Crépeau', 'Owen Goodman', 'Alistair Johnston', 'Luc de Fougerolles', 'Alfie Jones', 'Joel Waterman', 'Derek Cornelius', 'Moïse Bombito', 'Alphonso Davies', 'Richie Laryea', 'Niko Sigur', 'Mathieu Choinière', 'Stephen Eustáquio', 'Ismaël Koné', 'Liam Millar', 'Jacob Shaffelburg', 'Ali Ahmed', 'Jonathan Osorio', 'Nathan Saliba', 'Jayden Nelson', 'Tajon Buchanan', 'Jonathan David', 'Tani Oluwaseyi', 'Cyle Larin', 'Promise David'] },
        { country: 'Bosnia and Herzegovina', manager: 'Sergej BARBAREZ', players: ['Nikola Vasilj', 'Martin Zlomislić', 'Mladen Jurkas', 'Sead Kolašinac', 'Dennis Hadžikadunić', 'Amar Dedić', 'Nikola Katić', 'Tarik Muharemović', 'Nihad Mujakić', 'Stjepan Radeljić', 'Arjan Malic', 'Amir Hadžiahmetović', 'Benjamin Tahirović', 'Armin Gigović', 'Dženis Burnić', 'Ivan Bašić', 'Esmir Bajraktarević', 'Amar Memić', 'Ivan Šunjić', 'Kerim Alajbegović', 'Ermin Mahmić', 'Edin Džeko', 'Ermedin Demirović', 'Samed Baždar', 'Haris Tabaković', 'Jovo Lukić'] },
        { country: 'Qatar', manager: 'Julen Lopetegui Argote', players: ['Mahmoud Abunada', 'Salah Zakaria', 'Meshaal Barsham', 'Pedro Miguel', 'Lucas Mendes', 'Issa Laye', 'Jassem Gaber', 'Ayoub Al-Oui', 'Homam Ahmed', 'Boualem Khoukhi', 'Sultan Al-Brake', 'Al-Hashmi Al-Hussain', 'Abdulaziz Hatem', 'Karim Boudiaf', 'Ahmed Al-Ganehi', 'Ahmed Fathy', 'Assim Madibo', 'Ahmed Alaaeldin', 'Edmilson Junior', 'Mohammed Muntari', 'Hassan Al-Haydos', 'Akram Afif', 'Yusuf Abdurisag', 'Almoez Ali', 'Tahsin Jamshid', 'Mohamed Manai'] },
        { country: 'Switzerland', manager: 'Murat Yakin', players: ['Gregor Kobel', 'Yvon Mvogo', 'Marvin Keller', 'Ricardo Rodriguez', 'Manuel Akanji', 'Nico Elvedi', 'Silvan Widmer', 'Eray Cömert', 'Miro Muheim', 'Aurèle Amenda', 'Luca Jaquez', 'Granit Xhaka', 'Remo Freuler', 'Denis Zakaria', 'Djibril Sow', 'Michel Aebischer', 'Fabian Rieder', 'Christian Fassnacht', 'Johan Manzambi', 'Ardon Jashari', 'Breel Embolo', 'Rubén Vargas', 'Dan Ndoye', 'Zeki Amdouni', 'Noah Okafor', 'Cedric Itten'] },
        { country: 'Brazil', manager: 'Carlo Ancelotti', players: ['Alisson', 'Ederson', 'Weverton', 'Marquinhos', 'Danilo', 'Alex Sandro', 'Gabriel Magalhães', 'Bremer', 'Ederson Silva', 'Roger Ibañez', 'Douglas Santos', 'Léo Pereira', 'Casemiro', 'Lucas Paquetá', 'Bruno Guimarães', 'Fabinho', 'Danilo Santos', 'Neymar', 'Vinicius Junior', 'Raphinha', 'Gabriel Martinelli', 'Matheus Cunha', 'Endrick', 'Luiz Henrique', 'Igor Thiago', 'Rayan'] },
        { country: 'Morocco', manager: 'Mohamed OUAHBI', players: ['Yassine Bounou', 'Munir Mohamedi', 'Reda Tagnaouti', 'Noussair Mazraoui', 'Anass Salah-Eddine', 'Youssef Belammari', 'Achraf Hakimi', 'Zakaria El Ouahdi', 'Chadi Riad', 'Marwane Saadane', 'Redouane Halhal', 'Issa Diop', 'Sofyan Amrabat', 'Azzedine Ounahi', 'Bilal El Khannouss', 'Ismael Saibari', 'Neil El Aynaoui', 'Samir El Mourabet', 'Ayyoub Bouaddi', 'Ayoub El Kaabi', 'Amine Sbai', 'Soufiane Rahimi', 'Brahim Díaz', 'Chemsdine Talbi', 'Gessime Yassine', 'Ayoube Amaimouni'] },
        { country: 'Haiti', manager: 'Sebastien MIGNE', players: ['Johny Placide', 'Alexandre Pierre', 'Josué Duverger', 'Carlens Arcus', 'Wilguens Paugain', 'Duke Lacroix', 'Martin Expérience', 'Jean-Kévin Duverne', 'Ricardo Adé', 'Hannes Delcroix', 'Keeto Thermoncy', 'Carl Fred Sainté', 'Garven Metusala', 'Danley Jean Jacques', 'Jean-Ricner Bellegarde', 'Woodensky Pierre', 'Dominique Simon', 'Don Deedson Louicius', 'Josué Casimir', 'Derrick Etienne Jr.', 'Ruben Providence', 'Duckens Nazon', 'Frantzdy Pierrot', 'Wilson Isidor', 'Yassin Fortuné', 'Lenny Joseph'] },
        { country: 'Scotland', manager: 'Stephen Clark', players: ['Craig Gordon', 'Angus Gunn', 'Liam Kelly', 'Grant Hanley', 'Jack Hendry', 'Aaron Hickey', 'Dominic Hyam', 'Scott McKenna', 'Nathan Patterson', 'Anthony Ralston', 'Andy Robertson', 'John Souttar', 'Kieran Tierney', 'Ryan Christie', 'Findlay Curtis', 'Lewis Ferguson', 'Ben Gannon-Doak', 'Tyler Fletcher', 'John McGinn', 'Kenny McLean', 'Scott McTominay', 'Ché Adams', 'Lyndon Dykes', 'George Hirst', 'Lawrence Shankland', 'Ross Stewart'] },
        { country: 'United States', manager: 'Mauricio POCHETTINO', players: ['Matt Turner', 'Matt Freese', 'Chris Brady', 'Tim Ream', 'Antonee Robinson', 'Miles Robinson', 'Sergiño Dest', 'Chris Richards', 'Mark McKenzie', 'Joe Scally', 'Maximilian Arfsten', 'Alex Freeman', 'Auston Trusty', 'Weston McKennie', 'Tyler Adams', 'Cristian Roldan', 'Giovanni Reyna', 'Malik Tillman', 'Sebastian Berhalter', 'Brenden Aaronson', 'Christian Pulisic', 'Timothy Weah', 'Ricardo Pepi', 'Folarin Balogun', 'Haji Wright', 'Alex Zendejas'] },
        { country: 'Paraguay', manager: 'Gustavo ALFARO', players: ['Gatito Fernández', 'Orlando Gill', 'Gastón Olveira', 'Gustavo Gómez', 'Júnior Alonso', 'Fabián Balbuena', 'Omar Alderete', 'Juan José Cáceres', 'Gustavo Velázquez', 'José Canale', 'Alexandro Maidana', 'Miguel Almirón', 'Kaku', 'Andrés Cubas', 'Ramón Sosa', 'Diego Gómez', 'Damián Bobadilla', 'Braian Ojeda', 'Matías Galarza', 'Maurício', 'Antonio Sanabria', 'Julio Enciso', 'Gabriel Ávalos', 'Álex Arce', 'Isidro Pitta', 'Gustavo Caballero'] },
        { country: 'Australia', manager: 'Tony Popović', players: ['Mathew Ryan', 'Paul Izzo', 'Patrick Beach', 'Aziz Behich', 'Miloš Degenek', 'Harry Souttar', 'Jordan Bos', 'Cameron Burgess', 'Jason Geria', 'Alessandro Circati', 'Kai Trewin', 'Jacob Italiano', 'Lucas Herrington', 'Jackson Irvine', 'Ajdin Hrustic', 'Connor Metcalfe', 'Aiden O\'Neill', 'Paul Okon-Engstler', 'Cammy Devlin', 'Mathew Leckie', 'Awer Mabil', 'Nestory Irankunda', 'Mohamed Touré', 'Nishan Velupilla', 'Cristian Volpato', 'Tete Yengi'] },
        { country: 'Türkiye', manager: 'Vincenzo MONTELLA', players: ['Mert Günok', 'Altay Bayındır', 'Uğurcan Çakır', 'Zeki Çelik', 'Merih Demiral', 'Çağlar Söyüncü', 'Eren Elmalı', 'Abdülkerim Bardakcı', 'Ozan Kabak', 'Mert Müldür', 'Ferdi Kadıoğlu', 'Samet Akaydin', 'Salih Özcan', 'Orkun Kökçü', 'Hakan Çalhanoğlu', 'İsmail Yüksek', 'Kaan Ayhan', 'Kerem Aktürkoğlu', 'Arda Güler', 'Deniz Gül', 'Kenan Yıldız', 'İrfan Can Kahveci', 'Yunus Akgün', 'Barış Alper Yılmaz', 'Oğuz Aydın', 'Can Uzun'] },
        { country: 'Germany', manager: 'Julian NAGELSMANN', players: ['Manuel Neuer', 'Oliver Baumann', 'Alexander Nübel', 'Antonio Rüdiger', 'Jonathan Tah', 'David Raum', 'Nico Schlotterbeck', 'Waldemar Anton', 'Malick Thiaw', 'Nathaniel Brown', 'Joshua Kimmich', 'Leroy Sané', 'Leon Goretzka', 'Kai Havertz', 'Jamal Musiala', 'Florian Wirtz', 'Pascal Groß', 'Nadiem Amiri', 'Aleksandar Pavlović', 'Angelo Stiller', 'Felix Nmecha', 'Jamie Leweling', 'Assan Ouedraogo', 'Nick Woltemade', 'Deniz Undav', 'Maximilian Beier'] },
        { country: 'Curaçao', manager: 'Dick ADVOCAAT', players: ['Eloy Room', 'Trevor Doornbusch', 'Tyrick Bodak', 'Juriën Gaari', 'Roshon van Eijma', 'Sherel Floranus', 'Joshua Brenet', 'Shurandy Sambo', 'Armando Obispo', 'Riechedly Bazoer', 'Deveron Fonville', 'Leandro Bacuna', 'Juninho Bacuna', 'Godfried Roemeratoe', 'Kevin Felida', 'Livano Comenencia', 'Ar\'jany Martha', 'Tyrese Noslin', 'Kenji Gorré', 'Brandley Kuwas', 'Gervane Kastaneer', 'Jeremy Antonisse', 'Jearl Margaritha', 'Jürgen Locadia', 'Sontje Hansen', 'Tahith Chong'] },
        { country: 'Ivory Coast', manager: 'Emerse FAE', players: ['Yahia Fofana', 'Alban Lafont', 'Mohamed Koné', 'Ghislain Konan', 'Odilon Kossounou', 'Wilfried Singo', 'Evan Ndicka', 'Emmanuel Agbadou', 'Guéla Doué', 'Ousmane Diomande', 'Christopher Operi', 'Franck Kessié', 'Jean Michaël Seri', 'Ibrahim Sangaré', 'Seko Fofana', 'Christ Inao Oulaï', 'Parfait Guiagon', 'Nicolas Pépé', 'Oumar Diakité', 'Simon Adingra', 'Evann Guessand', 'Amad Diallo', 'Yan Diomande', 'Bazoumana Touré', 'Elye Wahi', 'Ange-Yoan Bonny'] },
        { country: 'Ecuador', manager: 'Sebastián Andrés Beccacece', players: ['Hernán Galíndez', 'Moisés Ramírez', 'Gonzalo Valle', 'Félix Torres', 'Piero Hincapié', 'Joel Ordóñez', 'Willian Pacho', 'Pervis Estupiñán', 'Ángelo Preciado', 'Jackson Porozo', 'Jordy Alcívar', 'Denil Castillo', 'John Yeboah', 'Kendry Páez', 'Alan Minda', 'Pedro Vite', 'Gonzalo Plata', 'Alan Franco', 'Moisés Caicedo', 'Yaimar Medina', 'Kevin Rodríguez', 'Enner Valencia', 'Anthony Valencia', 'Jordy Caicedo', 'Nilson Angulo', 'Jeremy Arévalo'] },
        { country: 'Netherlands', manager: 'Ronald KOEMAN', players: ['Bart Verbruggen', 'Mark Flekken', 'Robin Roefs', 'Virgil van Dijk', 'Denzel Dumfries', 'Nathan Aké', 'Lutsharel Geertruida', 'Micky van de Ven', 'Mats Wieffer', 'Jan Paul van Hecke', 'Jorrel Hato', 'Frenkie de Jong', 'Marten de Roon', 'Tijjani Reijnders', 'Teun Koopmeiners', 'Ryan Gravenberch', 'Justin Kluivert', 'Quinten Timber', 'Guus Til', 'Memphis Depay', 'Wout Weghorst', 'Donyell Malen', 'Cody Gakpo', 'Noa Lang', 'Brian Brobbey', 'Crysencio Summerville'] },
        { country: 'Japan', manager: 'Hajime Moriyasu', players: ['Zion Suzuki', 'Keisuke Ōsako', 'Tomoki Hayakawa', 'Yūto Nagatomo', 'Takehiro Tomiyasu', 'Ko Itakura', 'Shōgo Taniguchi', 'Hiroki Ito', 'Yukinari Sugawara', 'Ayumu Seko', 'Tsuyoshi Watanabe', 'Junnosuke Suzuki', 'Shuto Machino', 'Junya Itō', 'Ritsu Dōan', 'Daichi Kamada', 'Takefusa Kubo', 'Ao Tanaka', 'Keito Nakamura', 'Kaishu Sano', 'Yuito Suzuki', 'Ayase Ueda', 'Daizen Maeda', 'Kōki Ogawa', 'Keisuke Gotō', 'Kento Shiogai'] },
        { country: 'Sweden', manager: 'Graham POTTER', players: ['Kristoffer Nordfeldt', 'Viktor Johansson', 'Jacob Widell Zetterström', 'Victor Lindelöf', 'Isak Hien', 'Gabriel Gudmundsson', 'Carl Starfelt', 'Hjalmar Ekdal', 'Daniel Svensson', 'Gustaf Lagerbielke', 'Herman Johansson', 'Eric Smith', 'Elliot Stroud', 'Mattias Svanberg', 'Jesper Karlström', 'Yasin Ayari', 'Lucas Bergvall', 'Besfort Zeneli', 'Alexander Isak', 'Viktor Gyökeres', 'Ken Sema', 'Anthony Elanga', 'Benjamin Nygren', 'Alexander Bernhardsson', 'Gustaf Nilsson', 'Taha Ali'] },
        { country: 'Tunisia', manager: 'Sabri LAMOUCHI', players: ['Aymen Dahmen', 'Sabri Ben Hessen', 'Abdelmouhib Chamakh', 'Montassar Talbi', 'Dylan Bronn', 'Omar Rekik', 'Yan Valery', 'Ali Abdi', 'Moutaz Neffati', 'Raed Chikhaoui', 'Adem Arous', 'Mohamed Amine Ben Hamida', 'Ellyes Skhiri', 'Hannibal Mejbri', 'Anis Ben Slimane', 'Hadj Mahmoud', 'Rani Khedira', 'Mortadha Ben Ouanes', 'Ismaël Gharbi', 'Elias Saad', 'Elias Achouri', 'Firas Chaouat', 'Hazem Mastouri', 'Sebastian Tounekti', 'Khalil Ayari', 'Rayan Elloumi'] },
        { country: 'Belgium', manager: 'Rudi GARCIA', players: ['Thibaut Courtois', 'Senne Lammens', 'Mike Penders', 'Timothy Castagne', 'Zeno Debast', 'Maxim De Cuyper', 'Koni De Winter', 'Brandon Mechele', 'Thomas Meunier', 'Nathan Ngoy', 'Joaquin Seys', 'Arthur Theate', 'Kevin De Bruyne', 'Amadou Onana', 'Nicolas Raskin', 'Youri Tielemans', 'Hans Vanaken', 'Axel Witsel', 'Charles De Ketelaere', 'Jérémy Doku', 'Matias Fernandez-Pardo', 'Romelu Lukaku', 'Dodi Lukebakio', 'Diego Moreira', 'Alexis Saelemaekers', 'Leandro Trossard'] },
        { country: 'Egypt', manager: 'Hossam Hassan Hussein', players: ['Mohamed El Shenawy', 'Mostafa Shobeir', 'El Mahdy Soliman', 'Mohamed Hany', 'Tarek Alaa', 'Hamdy Fathy', 'Ramy Rabia', 'Yasser Ibrahim', 'Hossam Abdelmaguid', 'Mohamed Abdelmonem', 'Ahmed Fatouh', 'Karim Hafez', 'Marwan Attia', 'Mohanad Lasheen', 'Nabil Emad', 'Mahmoud Saber', 'Ahmed Zizo', 'Emam Ashour', 'Mostafa Ziko', 'Mahmoud Trezeguet', 'Ibrahim Adel', 'Haissem Hassan', 'Omar Marmoush', 'Mohamed Salah', 'Hamza Abdel Karim', 'Mohamed Alaa'] },
        { country: 'Iran', manager: 'Amir Ghalenoei', players: ['Alireza Beiranvand', 'Payam Niazmand', 'Hossein Hosseini', 'Ehsan Hajsafi', 'Milad Mohammadi', 'Ramin Rezaeian', 'Hossein Kanaanizadegan', 'Shojae Khalilzadeh', 'Saleh Hardani', 'Ali Nemati', 'Danial Eiri', 'Alireza Jahanbakhsh', 'Saeid Ezatolahi', 'Saman Ghoddos', 'Mehdi Torabi', 'Rouzbeh Cheshmi', 'Mohammad Mohebi', 'Mehdi Ghayedi', 'Mohammad Ghorbani', 'Aria Yousefi', 'Amirmohammad Razzaghinia', 'Mehdi Taremi', 'Shahriyar Moghanlou', 'Amirhossein Hosseinzadeh', 'Ali Alipour', 'Dennis Eckert'] },
        { country: 'New Zealand', manager: 'Darren BAZELEY', players: ['Max Crocombe', 'Alex Paulsen', 'Michael Woud', 'Tim Payne', 'Francis de Vries', 'Tyler Bindon', 'Michael Boxall', 'Liberato Cacace', 'Nando Pijnaker', 'Finn Surman', 'Callan Elliot', 'Tommy Smith', 'Joe Bell', 'Matthew Garbett', 'Marko Stamenić', 'Sarpreet Singh', 'Alex Rufer', 'Ryan Thomas', 'Elijah Just', 'Ben Old', 'Callum McCowatt', 'Chris Wood', 'Kosta Barbarouses', 'Ben Waine', 'Jesse Randall', 'Lachlan Bayliss'] },
        { country: 'Spain', manager: 'Luis de la Fuente Castillo', players: ['Unai Simón', 'David Raya', 'Joan Garcia', 'Aymeric Laporte', 'Marc Cucurella', 'Marcos Llorente', 'Eric García', 'Pedro Porro', 'Álex Grimaldo', 'Pau Cubarsí', 'Marc Pubill', 'Rodri', 'Dani Olmo', 'Mikel Merino', 'Fabián Ruiz', 'Pedri', 'Gavi', 'Martín Zubimendi', 'Ferran Torres', 'Mikel Oyarzabal', 'Nico Williams', 'Lamine Yamal', 'Yéremy Pino', 'Álex Baena', 'Borja Iglesias', 'Víctor Muñoz'] },
        { country: 'Cabo Verde', manager: 'Pedro Leitão Brito', players: ['Vozinha', 'Márcio Rosa', 'CJ dos Santos', 'Stopira', 'Roberto Pico Lopes', 'João Paulo', 'Diney', 'Logan Costa', 'Steven Moreira', 'Wagner Pina', 'Sidny Lopes Cabral', 'Kelvin Pires', 'Jamiro Monteiro', 'Kevin Pina', 'Deroy Duarte', 'Telmo Arcanjo', 'Laros Duarte', 'Yannick Semedo', 'Ryan Mendes', 'Garry Rodrigues', 'Willy Semedo', 'Jovane Cabral', 'Gilson Benchimol', 'Dailon Livramento', 'Hélio Varela', 'Nuno da Costa'] },
        { country: 'Saudi Arabia', manager: 'Georgios DONIS', players: ['Mohammed Al-Owais', 'Nawaf Al-Aqidi', 'Ahmed Al-Kassar', 'Saud Abdulhamid', 'Hassan Al-Tambakti', 'Abdulelah Al-Amri', 'Nawaf Boushal', 'Ali Lajami', 'Ali Majrashi', 'Hassan Kadesh', 'Moteb Al-Harbi', 'Jehad Thakri', 'Mohammed Abu Al-Shamat', 'Salem Al-Dawsari', 'Mohamed Kanno', 'Nasser Al-Dawsari', 'Abdullah Al-Khaibari', 'Musab Al-Juwayr', 'Ayman Yahya', 'Ziyad Al-Johani', 'Sultan Mandash', 'Alaa Al-Hejji', 'Firas Al-Buraikan', 'Saleh Al-Shehri', 'Abdullah Al-Hamdan', 'Khalid Al-Ghannam'] },
        { country: 'Uruguay', manager: 'Marcelo BIELSA', players: ['Fernando Muslera', 'Sergio Rochet', 'Santiago Mele', 'José María Giménez', 'Matías Viña', 'Mathías Olivera', 'Guillermo Varela', 'Ronald Araújo', 'Sebastián Cáceres', 'Joaquín Piquerez', 'Santiago Bueno', 'Rodrigo Bentancur', 'Federico Valverde', 'Giorgian de Arrascaeta', 'Facundo Pellistri', 'Manuel Ugarte', 'Nicolás de la Cruz', 'Brian Rodríguez', 'Maximiliano Araújo', 'Agustín Canobbio', 'Emiliano Martínez', 'Rodrigo Zalazar', 'Juan Manuel Sanabria', 'Darwin Núñez', 'Federico Viñas', 'Rodrigo Aguirre'] },
        { country: 'France', manager: 'Didier Deschamps', players: ['Mike Maignan', 'Brice Samba', 'Robin Risser', 'Lucas Digne', 'Jules Koundé', 'Théo Hernandez', 'Lucas Hernandez', 'Dayot Upamecano', 'William Saliba', 'Ibrahima Konaté', 'Malo Gusto', 'Maxence Lacroix', 'N\'Golo Kanté', 'Adrien Rabiot', 'Aurélien Tchouaméni', 'Manu Koné', 'Warren Zaïre-Emery', 'Kylian Mbappé', 'Ousmane Dembélé', 'Marcus Thuram', 'Bradley Barcola', 'Michael Olise', 'Maghnes Akliouche', 'Désiré Doué', 'Rayan Cherki', 'Jean-Philippe Mateta'] },
        { country: 'Senegal', manager: 'Pape THIAW', players: ['Yehvann Diouf', 'Édouard Mendy', 'Mory Diaw', 'Mamadou Sarr', 'Kalidou Koulibaly', 'Abdoulaye Seck', 'Ismail Jakobs', 'Krépin Diatta', 'Moussa Niakhaté', 'Antoine Mendy', 'El Hadji Malick Diouf', 'Idrissa Gueye', 'Pathé Ciss', 'Lamine Camara', 'Pape Matar Sarr', 'Habib Diarra', 'Bara Sapoko Ndiaye', 'Pape Gueye', 'Assane Diao', 'Bamba Dieng', 'Sadio Mané', 'Nicolas Jackson', 'Cherif Ndiaye', 'Iliman Ndiaye', 'Ismaïla Sarr', 'Ibrahim Mbaye'] },
        { country: 'Iraq', manager: 'Graham James Arnold', players: ['Jalal Hassan', 'Fahad Talib', 'Ahmed Basil', 'Rebin Sulaka', 'Manaf Younis', 'Merchas Doski', 'Zaid Tahseen', 'Frans Putros', 'Hussein Ali', 'Ahmed Maknazi', 'Mustafa Saadoon', 'Akam Hashim', 'Ibrahim Bayesh', 'Amir Al-Ammari', 'Ali Jasim', 'Youssef Amyn', 'Zidane Iqbal', 'Marko Farji', 'Kevin Yakob', 'Aimar Sher', 'Zaid Ismail', 'Ahmed Qasem', 'Aymen Hussein', 'Mohanad Ali', 'Ali Al-Hamadi', 'Ali Yousif'] },
        { country: 'Norway', manager: 'Ståle Solbakken', players: ['Ørjan Nyland', 'Egil Selvik', 'Sander Tangvik', 'Kristoffer Ajer', 'Julian Ryerson', 'Leo Østigård', 'Marcus Holmgren Pedersen', 'David Møller Wolfe', 'Fredrik André Bjørkan', 'Torbjørn Heggem', 'Sondre Langås', 'Henrik Falchener', 'Martin Ødegaard', 'Sander Berge', 'Patrick Berg', 'Kristian Thorstvedt', 'Morten Thorsby', 'Antonio Nusa', 'Fredrik Aursnes', 'Oscar Bobb', 'Jens Petter Hauge', 'Andreas Schjelderup', 'Thelo Aasgaard', 'Alexander Sørloth', 'Erling Haaland', 'Jørgen Strand Larsen'] },
        { country: 'Argentina', manager: 'Lionel SCALONI', players: ['Emiliano Martínez', 'Gerónimo Rulli', 'Juan Musso', 'Marcos Senesi', 'Nicolás Tagliafico', 'Gonzalo Montiel', 'Lisandro Martínez', 'Cristian Romero', 'Nicolás Otamendi', 'Facundo Medina', 'Nahuel Molina', 'Leandro Paredes', 'Rodrigo De Paul', 'Valentín Barco', 'Giovani Lo Celso', 'Exequiel Palacios', 'Alexis Mac Allister', 'Enzo Fernández', 'Julián Alvarez', 'Lionel Messi', 'Nicolás González', 'Thiago Almada', 'Giuliano Simeone', 'Nico Paz', 'José Manuel López', 'Lautaro Martínez'] },
        { country: 'Algeria', manager: 'Vladimir PETKOVIC', players: ['Luca Zidane', 'Oussama Benbot', 'Melvin Mastil', 'Aïssa Mandi', 'Ramy Bensebaini', 'Mohamed Amine Tougai', 'Rayan Aït-Nouri', 'Jaouen Hadjam', 'Rafik Belghali', 'Zineddine Belaïd', 'Achref Abada', 'Samir Chergui', 'Nabil Bentaleb', 'Ramiz Zerrouki', 'Hicham Boudaoui', 'Farès Chaïbi', 'Houssem Aouar', 'Ibrahim Maza', 'Yacine Titraoui', 'Riyad Mahrez', 'Mohamed Amoura', 'Amine Gouiri', 'Anis Hadj Moussa', 'Adil Boulbina', 'Nadhir Benbouali', 'Farès Ghedjemis'] },
        { country: 'Austria', manager: 'Ralf RANGNICK', players: ['Alexander Schlager', 'Patrick Pentz', 'Florian Wiegele', 'David Alaba', 'Stefan Posch', 'Philipp Lienhart', 'Kevin Danso', 'Phillipp Mwene', 'Alexander Prass', 'Marco Friedl', 'Michael Svoboda', 'David Affengruber', 'Marcel Sabitzer', 'Dejan Ljubicic', 'Florian Grillitsch', 'Konrad Laimer', 'Xaver Schlager', 'Nicolas Seiwald', 'Alessandro Schöpf', 'Romano Schmid', 'Patrick Wimmer', 'Carney Chukwuemeka', 'Paul Wanner', 'Marko Arnautović', 'Michael Gregoritsch', 'Saša Kalajdžić'] },
        { country: 'Jordan', manager: 'Jamal SELLAMI', players: ['Yazeed Abulaila', 'Nour Bani Attiah', 'Abdallah Al-Fakhouri', 'Mohammad Abu Hashish', 'Abdallah Nasib', 'Husam Abu Dahab', 'Yazan Al-Arab', 'Mo Abualnadi', 'Salim Obaid', 'Saed Al-Rosan', 'Ihsan Haddad', 'Anas Badawi', 'Amer Jamous', 'Noor Al-Rawabdeh', 'Rajaei Ayed', 'Ibrahim Sadeh', 'Mohannad Abu Taha', 'Nizar Al-Rashdan', 'Mohammad Al-Dawoud', 'Mohammad Abu Zrayq', 'Ali Olwan', 'Musa Al-Taamari', 'Odeh Al-Fakhouri', 'Mahmoud Al-Mardi', 'Ibrahim Sabra', 'Ali Azaizeh'] },
        { country: 'Portugal', manager: 'Roberto Martínez Montoliú', players: ['Diogo Costa', 'José Sá', 'Rui Silva', 'Rúben Dias', 'João Cancelo', 'Nélson Semedo', 'Nuno Mendes', 'Diogo Dalot', 'Gonçalo Inácio', 'Matheus Nunes', 'Renato Veiga', 'Tomás Araújo', 'Bernardo Silva', 'Bruno Fernandes', 'Rúben Neves', 'Vitinha', 'João Neves', 'Samú Costa', 'Cristiano Ronaldo', 'João Félix', 'Rafael Leão', 'Gonçalo Guedes', 'Gonçalo Ramos', 'Pedro Neto', 'Francisco Trincão', 'Francisco Conceição'] },
        { country: 'DR Congo', manager: 'Sébastien Desabre', players: ['Lionel Mpasi', 'Timothy Fayulu', 'Matthieu Epolo', 'Chancel Mbemba', 'Arthur Masuaku', 'Gédéon Kalulu', 'Joris Kayembe', 'Dylan Batubinsika', 'Axel Tuanzebe', 'Aaron Wan-Bissaka', 'Steve Kapuadi', 'Meschak Elia', 'Samuel Moutoussamy', 'Edo Kayembe', 'Charles Pickel', 'Gaël Kakuta', 'Noah Sadiki', 'Nathanaël Mbuku', 'Aaron Tshibola', 'Ngal\'ayel Mukau', 'Brian Cipenga', 'Cédric Bakambu', 'Théo Bongonda', 'Fiston Mayele', 'Yoane Wissa', 'Simon Banza'] },
        { country: 'Uzbekistan', manager: 'Fabio CANNAVARO', players: ['Utkir Yusupov', 'Abduvohid Nematov', 'Botirali Ergashev', 'Abdukodir Khusanov', 'Khojiakbar Alijonov', 'Farrukh Sayfiev', 'Rustam Ashurmatov', 'Sherzod Nasrullaev', 'Umar Eshmurodov', 'Abdulla Abdullaev', 'Bekhruz Karimov', 'Avazbek Ulmasaliev', 'Jakhongir Urozov', 'Akmal Mozgovoy', 'Otabek Shukurov', 'Jamshid Iskanderov', 'Odiljon Hamrobekov', 'Jaloliddin Masharipov', 'Oston Urunov', 'Dostonbek Khamdamov', 'Azizjon Ganiev', 'Abbosbek Fayzullaev', 'Sherzod Esanov', 'Eldor Shomurodov', 'Azizbek Amonov', 'Igor Sergeev'] },
        { country: 'Colombia', manager: 'Néstor Gabriel Lorenzo', players: ['David Ospina', 'Camilo Vargas', 'Álvaro Montero', 'Davinson Sánchez', 'Santiago Arias', 'Yerry Mina', 'Daniel Muñoz', 'Johan Mojica', 'Jhon Lucumi', 'Deiver Machado', 'Willer Ditta', 'James Rodríguez', 'Jefferson Lerma', 'Juan Fernando Quintero', 'Jhon Arias', 'Richard Ríos', 'Kevin Castaño', 'Jorge Carrascal', 'Jaminton Campaz', 'Juan Portilla', 'Gustavo Puerta', 'Luis Díaz', 'Jhon Córdoba', 'Luis Suárez', 'Cucho Hernández', 'Andrés Gómez'] },
        { country: 'England', manager: 'Thomas Tuchel', players: ['Jordan Pickford', 'Dean Henderson', 'James Trafford', 'John Stones', 'Marc Guéhi', 'Reece James', 'Ezri Konsa', 'Dan Burn', 'Tino Livramento', 'Djed Spence', 'Nico O\'Reilly', 'Jarell Quansah', 'Jordan Henderson', 'Declan Rice', 'Jude Bellingham', 'Morgan Rogers', 'Kobbie Mainoo', 'Elliot Anderson', 'Harry Kane', 'Marcus Rashford', 'Bukayo Saka', 'Ollie Watkins', 'Anthony Gordon', 'Eberechi Eze', 'Noni Madueke', 'Ivan Toney'] },
        { country: 'Croatia', manager: 'Zlatko Dalić', players: ['Dominik Livaković', 'Dominik Kotarski', 'Ivor Pandur', 'Joško Gvardiol', 'Duje Ćaleta-Car', 'Josip Šutalo', 'Josip Stanišić', 'Marin Pongračić', 'Martin Erlić', 'Luka Vušković', 'Luka Modrić', 'Mateo Kovačić', 'Mario Pašalić', 'Nikola Vlašić', 'Luka Sučić', 'Martin Baturina', 'Kristijan Jakić', 'Petar Sučić', 'Nikola Moro', 'Toni Fruk', 'Ivan Perišić', 'Andrej Kramarić', 'Ante Budimir', 'Marco Pašalić', 'Petar Musa', 'Igor Matanović'] },
        { country: 'Ghana', manager: 'Carlos QUEIROZ', players: ['Lawrence Ati-Zigi', 'Joseph Anang', 'Benjamin Asare', 'Alidu Seidu', 'Jonas Adjetey', 'Abdul Mumin', 'Gideon Mensah', 'Abdul Rahman Baba', 'Jerome Opoku', 'Kojo Peprah Oppong', 'Derrick Luckassen', 'Marvin Senaya', 'Caleb Yirenkyi', 'Thomas Partey', 'Kwasi Sibo', 'Antoine Semenyo', 'Elisha Owusu', 'Augustine Boakye', 'Abdul Fatawu', 'Jordan Ayew', 'Brandon Thomas-Asante', 'Christopher Bonsu Baah', 'Iñaki Williams', 'Kamaldeen Sulemana', 'Ernest Nuamah', 'Prince Kwabena Adu'] },
        { country: 'Panama', manager: 'Thomas Christiansen Tarín', players: ['Luis Mejía', 'Orlando Mosquera', 'César Samudio', 'Eric Davis', 'Fidel Escobar', 'Michael Amir Murillo', 'Roderick Miller', 'Andrés Andrade', 'César Blackman', 'José Córdoba', 'Jiovany Ramos', 'Jorge Gutiérrez', 'Edgardo Fariña', 'Aníbal Godoy', 'Alberto Quintero', 'Yoel Bárcenas', 'Adalberto Carrasquilla', 'José Luis Rodríguez', 'Cristian Martínez', 'César Yanis', 'Carlos Harvey', 'Azarias Londoño', 'José Fajardo', 'Ismael Díaz', 'Cecilio Waterman', 'Tomás Rodríguez'] }
      ];

      // Seed national team players (48 teams x 26 players = 1248 total players)
      for (const team of teamsData) {
        team.players.forEach((playerName, i) => {
          const id = getPaddedId(stickerIndex);
          let rarity = 'Common';
          let description = `Elite squad player for ${team.country} preparing for a historic campaign at the 2026 World Cup.`;
          
          if (i === 0) {
            rarity = 'Legendary';
            description = `Team Captain & World-Class Talisman - The leading beacon of ${team.country}'s 2026 World Cup odyssey.`;
          } else if (i === 1) {
            rarity = 'Epic';
            description = `Elite Playmaker of absolute caliber, ready to dictate terms on the World Cup pitch.`;
          } else if (i === 2 || i === 3) {
            rarity = 'Rare';
            description = `Stalwart core defender of ${team.country}'s strategic backline.`;
          } else if (i >= 22) {
            description = `Talented reserve player for ${team.country} offering valuable squad depth and tactical flexibility.`;
          }
          
          insertSticker.run(id, playerName, description, 'National Teams', team.country, rarity);
          stickerIndex++;
        });
      }

      // Seed Stadiums & Host Cities (all 16 official stadiums!)
      const stadiums = [
        { name: 'MetLife Stadium', city: 'East Rutherford, New Jersey, USA', description: 'Hosts the grand FIFA World Cup 2026 Final! Epic arena with futuristic technology.', rarity: 'Legendary', country: 'United States' },
        { name: 'SoFi Stadium', city: 'Los Angeles, California, USA', description: 'Hosts the USA opening match. State-of-the-art cinematic masterwork with a massive circular screen.', rarity: 'Legendary', country: 'United States' },
        { name: 'Azteca Stadium', city: 'Mexico City, Mexico', description: 'Host of the official Opening Match! The historic cathedral of world football, hosting its third World Cup opening game.', rarity: 'Legendary', country: 'Mexico' },
        { name: 'BMO Field', city: 'Toronto, Ontario, Canada', description: 'Hosts Canada\'s historic opener. Atmosphere-packed lakeside stadium backing the Maple Leafs.', rarity: 'Rare', country: 'Canada' },
        { name: 'BC Place', city: 'Vancouver, British Columbia, Canada', description: 'Scenic Pacific host city venue with a legendary stadium structure and atmosphere.', rarity: 'Rare', country: 'Canada' },
        { name: 'AT&T Stadium', city: 'Dallas, Texas, USA', description: 'Futuristic host city venue slated for major semi-final blockbusters.', rarity: 'Epic', country: 'United States' },
        { name: 'Hard Rock Stadium', city: 'Miami, Florida, USA', description: 'Sun-kissed open-air icon hosting the historic World Cup Bronze Medal Match.', rarity: 'Rare', country: 'United States' },
        { name: 'Mercedes-Benz Stadium', city: 'Atlanta, Georgia, USA', description: 'Hyper-stunning stadium with a retractable oculus roof and world-class acoustics.', rarity: 'Epic', country: 'United States' },
        { name: 'Gillette Stadium', city: 'Boston, Massachusetts, USA', description: 'Legendary New England football stadium welcoming the global family with supreme pride.', rarity: 'Common', country: 'United States' },
        { name: 'Lincoln Financial Field', city: 'Philadelphia, Pennsylvania, USA', description: 'High-octane atmosphere in the city of Independence, bringing fierce support.', rarity: 'Common', country: 'United States' },
        { name: 'GEHA Field at Arrowhead', city: 'Kansas City, Missouri, USA', description: 'Renowned as the loudest open-air stadium in the world. High-decibel action.', rarity: 'Rare', country: 'United States' },
        { name: 'Lumen Field', city: 'Seattle, Washington, USA', description: 'Scenic Pacific Northwest coliseum famous for its raucous, passionate community.', rarity: 'Rare', country: 'United States' },
        { name: 'Levi\'s Stadium', city: 'San Francisco, California, USA', description: 'Silicon Valley tech-hub stadium showcasing premier soccer match-ups of class.', rarity: 'Common', country: 'United States' },
        { name: 'NRG Stadium', city: 'Houston, Texas, USA', description: 'Enormous indoor-outdoor Texas marvel hosting critical group and knockout ties.', rarity: 'Common', country: 'United States' },
        { name: 'Estadio Akron', city: 'Guadalajara, Jalisco, Mexico', description: 'Famed "Chivas" home base with a stunning active volcano shell structure design.', rarity: 'Rare', country: 'Mexico' },
        { name: 'Estadio BBVA', city: 'Monterrey, Nuevo León, Mexico', description: 'Known as "The Steel Giant", framed by the breathtaking Sierra de la Silla mountain view.', rarity: 'Rare', country: 'Mexico' }
      ];

      for (const s of stadiums) {
        const id = getPaddedId(stickerIndex);
        insertSticker.run(id, s.name, `${s.city} - ${s.description}`, 'Stadiums', s.country, s.rarity);
        stickerIndex++;
      }

      // Seed Host Cities (all 16 official host cities!)
      const hostCities = [
        { name: 'New York/New Jersey', country: 'United States', description: 'Metropolitan giant hosting the grand final of the 2026 World Cup. A global center of commerce, culture, and sports heritage.' },
        { name: 'Los Angeles', country: 'United States', description: 'Vibrant coastal metropolis hosting USA\'s opening match. World-famous entertainment capital with world-class sporting venues.' },
        { name: 'Mexico City', country: 'Mexico', description: 'Vast capital hosting the tournament\'s celebratory Opening Match. Rich with generations of Aztec history and football devotion.' },
        { name: 'Dallas', country: 'United States', description: 'Enormous Texas metropolis playing host to critical semi-final action. Known for its soaring skylines and booming athletic spirit.' },
        { name: 'Miami', country: 'United States', description: 'Sun-drenched coastal capital hosting the Bronze Medal match. Fusing diverse Latin styles, beaches, and football madness.' },
        { name: 'Atlanta', country: 'United States', description: 'Pioneering southern center of music, green forests, and modern architectural stadium spectacles.' },
        { name: 'Boston', country: 'United States', description: 'Historic home of American liberty, academic supremacy, and a legendary legacy of sports champions.' },
        { name: 'Philadelphia', country: 'United States', description: 'The cradle of modern democracy, ringing with historic independence and fiercely passionate neighborhoods.' },
        { name: 'Kansas City', country: 'United States', description: 'The high-velocity soccer city of the Midwest, celebrated for iconic slow-smoked BBQ and raucous sports supporters.' },
        { name: 'Seattle', country: 'United States', description: 'Stunning emerald city of the Pacific Northwest, blending tech innovation, scenic marine ways, and severe soccer culture.' },
        { name: 'San Francisco Bay Area', country: 'United States', description: 'Bay area tech capital hosting premier match-ups, surrounded by majestic redwood reserves and iconic suspension bridges.' },
        { name: 'Houston', country: 'United States', description: 'Diverse southern aerospace launch hub, preparing retractable roof arenas for massive international crowds.' },
        { name: 'Guadalajara', country: 'Mexico', description: 'Capital of mariachi folklore, craft tequila, and gorgeous historic cathedrals embracing global fans.' },
        { name: 'Monterrey', country: 'Mexico', description: 'Majestic industrial peak capital framed by the Saddle Mountain. Home to ferocious, world-famous soccer support.' },
        { name: 'Toronto', country: 'Canada', description: 'Vast multi-cultural lakeside city hosting Canada\'s historic sports opener beside the sky-high CN Tower.' },
        { name: 'Vancouver', country: 'Canada', description: 'Scenic Pacific harbor gem where dense snow-capped mountains touch beautiful deep blue waters.' }
      ];

      for (const city of hostCities) {
        const id = getPaddedId(stickerIndex);
        insertSticker.run(id, city.name, `${city.name}, ${city.country} - ${city.description}`, 'Host Cities', city.country, 'Rare');
        stickerIndex++;
      }

      // Seed Legends (24)
      const legends = [
        { name: 'Pelé', country: 'Brazil', description: 'The immortal king of football. Only 3-time World Cup champion and eternal symbol of Jogo Bonito.' },
        { name: 'Diego Maradona', country: 'Argentina', description: 'Orchestrator of the 1986 triumph, famed for the "Goal of the Century" and "Hand of God"' },
        { name: 'Zinedine Zidane', country: 'France', description: 'Elegant midfield master who guided France to their historic first World Cup crown in 1998.' },
        { name: 'Ronaldo Nazário', country: 'Brazil', description: 'The ultimate number nine who redeemed himself in 2002 to score both final goals.' },
        { name: 'Johan Cruyff', country: 'Netherlands', description: 'Creator of Total Football and the Cruyff Turn. Redefined the sport\'s philosophy.' },
        { name: 'Ronaldinho', country: 'Brazil', description: 'Samba genius who brought pure joy, magic tricks, and the legendary 2002 free kick.' },
        { name: 'Franz Beckenbauer', country: 'Germany', description: 'Der Kaiser — the only man to both captain and manage a World Cup-winning nation.' },
        { name: 'Garrincha', country: 'Brazil', description: 'The joyful winger with crooked legs who dribbled past entire defenses in 1958 and 1962.' },
        { name: 'Bobby Charlton', country: 'England', description: 'Survived Munich to lead England to 1966 glory with thunderous long-range strikes.' },
        { name: 'Eusébio', country: 'Portugal', description: 'The Black Panther scored 9 goals at the 1966 World Cup, still the highest single-tournament total.' },
        { name: 'Lev Yashin', country: 'Russia', description: 'The Black Spider — the only goalkeeper ever to win the Ballon d\'Or.' },
        { name: 'Gerd Müller', country: 'Germany', description: 'Der Bomber scored the 1974 final winner and held the all-time WC goals record for 32 years.' },
        { name: 'Michel Platini', country: 'France', description: 'Midfield artist whose vision and free kicks defined France\'s golden generation of the 80s.' },
        { name: 'Dino Zoff', country: 'Italy', description: 'World Cup winning captain at age 40 — the oldest champion in tournament history.' },
        { name: 'Paolo Rossi', country: 'Italy', description: 'Returned from a match-fixing ban to score 6 goals and carry Italy to the 1982 title.' },
        { name: 'Geoff Hurst', country: 'England', description: 'The only man to score a hat-trick in a World Cup final — 1966, forever etched in history.' },
        { name: 'Just Fontaine', country: 'France', description: 'Holds the record for most goals in a single World Cup: 13 goals in 1958.' },
        { name: 'Miroslav Klose', country: 'Germany', description: 'All-time World Cup top scorer with 16 goals across four tournaments. 2014 champion.' },
        { name: 'Roberto Baggio', country: 'Italy', description: 'The divine ponytail who almost single-handedly carried Italy to the 1994 final.' },
        { name: 'Zico', country: 'Brazil', description: 'The White Pelé — midfield maestro and free-kick genius of the 1978-86 Brazilian sides.' },
        { name: 'Lothar Matthäus', country: 'Germany', description: 'Record 25 World Cup matches across five tournaments. Captained West Germany to 1990 glory.' },
        { name: 'Paolo Maldini', country: 'Italy', description: 'Defensive elegance personified across four World Cups. Never won, but forever respected.' },
        { name: 'Hristo Stoichkov', country: 'Bulgaria', description: '1994 Golden Boot winner who led unfancied Bulgaria to a stunning fourth-place finish.' },
        { name: 'Diego Forlán', country: 'Uruguay', description: '2010 Golden Ball winner with three spectacular long-range goals in South Africa.' }
      ];

      for (const l of legends) {
        const id = getPaddedId(stickerIndex);
        insertSticker.run(id, l.name, l.description, 'Legends', l.country, 'Legendary');
        stickerIndex++;
      }

      // Seed Trophies (4)
      const trophies = [
        { name: 'FIFA World Cup Trophy', description: '18-carat solid gold trophy. The most coveted sports emblem on Earth.', rarity: 'Legendary' },
        { name: 'Golden Ball', description: 'Awarded to the tournament\'s best player. Won by legendary figures.', rarity: 'Epic' },
        { name: 'Golden Boot', description: 'Presented to the top goalscorer of the World Cup tournament.', rarity: 'Epic' },
        { name: 'Golden Glove', description: 'Awarded to the outstanding goalkeeper protecting their country\'s lines.', rarity: 'Rare' }
      ];

      for (const t of trophies) {
        const id = getPaddedId(stickerIndex);
        insertSticker.run(id, t.name, t.description, 'Trophies', 'International', t.rarity);
        stickerIndex++;
      }
    };
    db.transaction(generateSeedStickers)();
    console.log("Seeded 1356 authentic 2026 World Cup stickers successfully!");

    // Seed admin account with all stickers unlocked
    const adminId = 'admin';
    const existingAdmin = db.prepare('SELECT id FROM users WHERE id = ?').get(adminId);
    if (!existingAdmin) {
      const adminRecoveryCode = 'ADMIN-64K5-82D9-58R1';
      const adminDate = new Date().toISOString();
      db.prepare('INSERT INTO users (id, nickname, recovery_code, join_date, country, avatar, coins, xp, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(adminId, 'Admin', adminRecoveryCode, adminDate, 'International', '', 999999, 999999, adminDate);

      const allStickers = db.prepare('SELECT id FROM stickers').all() as { id: string }[];
      const insertAdminSticker = db.prepare('INSERT OR IGNORE INTO user_stickers (id, user_id, sticker_id, is_duplicate, created_at) VALUES (?, ?, ?, 0, ?)');
      const seedAdminStickers = () => {
        const now = new Date().toISOString();
        for (const sticker of allStickers) {
          const usId = Math.random().toString(36).substring(2, 11);
          insertAdminSticker.run(usId, adminId, sticker.id, now);
        }
      };
      db.transaction(seedAdminStickers)();
      console.log(`Seeded admin account with ${allStickers.length} stickers! Recovery code: ADMIN-64K5-82D9-58R1`);
    }

  } catch (err) {
    console.error("Failed to seed stickers:", err);
  }
}

// Migration: rename stickers for injury/squad replacements (existing DBs)
try {
  const renameMap: Record<string, { newName: string }> = {
    'Marcelo Flores': { newName: 'Jayden Nelson' },
    'Lennart Karl': { newName: 'Assan Ouedraogo' },
    'Jurriën Timber': { newName: 'Lutsharel Geertruida' },
    'Wataru Endo': { newName: 'Shuto Machino' },
    'Clément Akpa': { newName: 'Christopher Operi' },
    'Nidal Čelik': { newName: 'Arjan Malic' },
    'Leverton Pierre': { newName: 'Garven Metusala' },
    'Ahmed Yahya': { newName: 'Ahmed Maknazi' },
    'Leonardo Balerdi': { newName: 'Marcos Senesi' },
    'Nayef Aguerd': { newName: 'Marwane Saadane' },
    'Abde Ezzalzouli': { newName: 'Amine Sbai' },
    'Christoph Baumgartner': { newName: 'Dejan Ljubicic' },

  };
  for (const [oldName, { newName }] of Object.entries(renameMap)) {
    const result = db.prepare("UPDATE stickers SET name = ? WHERE name = ? AND category = 'National Teams'").run(newName, oldName);
    if (result.changes > 0) console.log(`Renamed sticker: "${oldName}" → "${newName}"`);
  }
} catch (e) {
  console.error("Migration for sticker renames failed:", e);
}

// Migration: add is_extra column and mark star player stickers
try {
  db.prepare("ALTER TABLE stickers ADD COLUMN is_extra INTEGER DEFAULT 0").run();
  console.log("Added is_extra column to stickers");
} catch { /* column already exists */ }
const extraIds = ['S241','S114','S333','S543','S1059','S935','S819','S432','S076','S644','S1159','S850','S750','S956','S1140','S1181','S674','S513','S020','S227'];
for (const id of extraIds) {
  db.prepare("UPDATE stickers SET is_extra = 1 WHERE id = ?").run(id);
}
console.log(`Marked ${extraIds.length} extra star player stickers`);

// Migration: add manager stickers for existing databases (48 managers, S1309-S1356)
const mgrCheck = db.prepare("SELECT COUNT(*) as c FROM stickers WHERE id = 'S1309'").get() as {c: number};
if (mgrCheck.c === 0) {
  try {
    const teamsData = [
      { country: 'Mexico', manager: 'Javier Aguirre Onaindía' },
      { country: 'South Africa', manager: 'Hugo Henri Broos' },
      { country: 'South Korea', manager: 'Myung-Bo Hong' },
      { country: 'Czechia', manager: 'Miroslav KOUBEK' },
      { country: 'Canada', manager: 'Jesse Alan Marsch' },
      { country: 'Bosnia and Herzegovina', manager: 'Sergej BARBAREZ' },
      { country: 'Qatar', manager: 'Julen Lopetegui Argote' },
      { country: 'Switzerland', manager: 'Murat Yakin' },
      { country: 'Brazil', manager: 'Carlo Ancelotti' },
      { country: 'Morocco', manager: 'Mohamed OUAHBI' },
      { country: 'Haiti', manager: 'Sebastien MIGNE' },
      { country: 'Scotland', manager: 'Stephen Clark' },
      { country: 'United States', manager: 'Mauricio POCHETTINO' },
      { country: 'Paraguay', manager: 'Gustavo ALFARO' },
      { country: 'Australia', manager: 'Tony Popović' },
      { country: 'Türkiye', manager: 'Vincenzo MONTELLA' },
      { country: 'Germany', manager: 'Julian NAGELSMANN' },
      { country: 'Curaçao', manager: 'Dick ADVOCAAT' },
      { country: 'Ivory Coast', manager: 'Emerse FAE' },
      { country: 'Ecuador', manager: 'Sebastián Andrés Beccacece' },
      { country: 'Netherlands', manager: 'Ronald KOEMAN' },
      { country: 'Japan', manager: 'Hajime Moriyasu' },
      { country: 'Sweden', manager: 'Graham POTTER' },
      { country: 'Tunisia', manager: 'Sabri LAMOUCHI' },
      { country: 'Belgium', manager: 'Rudi GARCIA' },
      { country: 'Egypt', manager: 'Hossam Hassan Hussein' },
      { country: 'Iran', manager: 'Amir Ghalenoei' },
      { country: 'New Zealand', manager: 'Darren BAZELEY' },
      { country: 'Spain', manager: 'Luis de la Fuente Castillo' },
      { country: 'Cabo Verde', manager: 'Pedro Leitão Brito' },
      { country: 'Saudi Arabia', manager: 'Georgios DONIS' },
      { country: 'Uruguay', manager: 'Marcelo BIELSA' },
      { country: 'France', manager: 'Didier Deschamps' },
      { country: 'Senegal', manager: 'Pape THIAW' },
      { country: 'Iraq', manager: 'Graham James Arnold' },
      { country: 'Norway', manager: 'Ståle Solbakken' },
      { country: 'Argentina', manager: 'Lionel SCALONI' },
      { country: 'Algeria', manager: 'Vladimir PETKOVIC' },
      { country: 'Austria', manager: 'Ralf RANGNICK' },
      { country: 'Jordan', manager: 'Jamal SELLAMI' },
      { country: 'Portugal', manager: 'Roberto Martínez Montoliú' },
      { country: 'DR Congo', manager: 'Sébastien Desabre' },
      { country: 'Uzbekistan', manager: 'Fabio CANNAVARO' },
      { country: 'Colombia', manager: 'Néstor Gabriel Lorenzo' },
      { country: 'England', manager: 'Thomas Tuchel' },
      { country: 'Croatia', manager: 'Zlatko Dalić' },
      { country: 'Ghana', manager: 'Carlos QUEIROZ' },
      { country: 'Panama', manager: 'Thomas Christiansen Tarín' }
    ];
    const stickerCount = db.prepare('SELECT COUNT(*) as c FROM stickers').get() as {c: number};
    let mid = stickerCount.c + 1;
    const insertMgr = db.prepare('INSERT OR IGNORE INTO stickers (id, name, description, category, country, rarity) VALUES (?, ?, ?, ?, ?, ?)');
    const pad = (n: number) => 'S' + String(n).padStart(3, '0');
    const migrateMgr = () => {
      for (const t of teamsData) {
        insertMgr.run(pad(mid), t.manager, `Head Coach & Tactical Leader - The mastermind guiding ${t.country}'s 2026 World Cup campaign.`, 'National Teams', t.country, 'Legendary');
        mid++;
      }
    };
    db.transaction(migrateMgr)();
    console.log(`Seeded ${teamsData.length} manager stickers!`);
    // Grant manager stickers to admin
    const adminExists = db.prepare("SELECT id FROM users WHERE id = 'admin'").get();
    if (adminExists) {
      const now = new Date().toISOString();
      const insertAdmin = db.prepare('INSERT OR IGNORE INTO user_stickers (id, user_id, sticker_id, is_duplicate, created_at) VALUES (?, ?, ?, 0, ?)');
      const newManagers = db.prepare('SELECT id FROM stickers WHERE CAST(SUBSTR(id,2) AS INTEGER) >= 1309').all() as {id: string}[];
      for (const st of newManagers) {
        const usId = Math.random().toString(36).substring(2, 11);
        insertAdmin.run(usId, 'admin', st.id, now);
      }
      console.log(`Granted ${newManagers.length} manager stickers to admin`);
    }
  } catch (e) {
    console.error("Migration for manager stickers failed:", e);
  }
}

// Migration: add more legend stickers for existing databases
const newLegendsCheck = db.prepare("SELECT COUNT(*) as c FROM stickers WHERE name = 'Franz Beckenbauer'").get() as {c: number};
if (newLegendsCheck.c === 0) {
  try {
    const moreLegends = [
      { name: 'Franz Beckenbauer', country: 'Germany', description: 'Der Kaiser — the only man to both captain and manage a World Cup-winning nation.' },
      { name: 'Garrincha', country: 'Brazil', description: 'The joyful winger with crooked legs who dribbled past entire defenses in 1958 and 1962.' },
      { name: 'Bobby Charlton', country: 'England', description: 'Survived Munich to lead England to 1966 glory with thunderous long-range strikes.' },
      { name: 'Eusébio', country: 'Portugal', description: 'The Black Panther scored 9 goals at the 1966 World Cup, still the highest single-tournament total.' },
      { name: 'Lev Yashin', country: 'Russia', description: 'The Black Spider — the only goalkeeper ever to win the Ballon d\'Or.' },
      { name: 'Gerd Müller', country: 'Germany', description: 'Der Bomber scored the 1974 final winner and held the all-time WC goals record for 32 years.' },
      { name: 'Michel Platini', country: 'France', description: 'Midfield artist whose vision and free kicks defined France\'s golden generation of the 80s.' },
      { name: 'Dino Zoff', country: 'Italy', description: 'World Cup winning captain at age 40 — the oldest champion in tournament history.' },
      { name: 'Paolo Rossi', country: 'Italy', description: 'Returned from a match-fixing ban to score 6 goals and carry Italy to the 1982 title.' },
      { name: 'Geoff Hurst', country: 'England', description: 'The only man to score a hat-trick in a World Cup final — 1966, forever etched in history.' },
      { name: 'Just Fontaine', country: 'France', description: 'Holds the record for most goals in a single World Cup: 13 goals in 1958.' },
      { name: 'Miroslav Klose', country: 'Germany', description: 'All-time World Cup top scorer with 16 goals across four tournaments. 2014 champion.' },
      { name: 'Roberto Baggio', country: 'Italy', description: 'The divine ponytail who almost single-handedly carried Italy to the 1994 final.' },
      { name: 'Zico', country: 'Brazil', description: 'The White Pelé — midfield maestro and free-kick genius of the 1978-86 Brazilian sides.' },
      { name: 'Lothar Matthäus', country: 'Germany', description: 'Record 25 World Cup matches across five tournaments. Captained West Germany to 1990 glory.' },
      { name: 'Paolo Maldini', country: 'Italy', description: 'Defensive elegance personified across four World Cups. Never won, but forever respected.' },
      { name: 'Hristo Stoichkov', country: 'Bulgaria', description: '1994 Golden Boot winner who led unfancied Bulgaria to a stunning fourth-place finish.' },
      { name: 'Diego Forlán', country: 'Uruguay', description: '2010 Golden Ball winner with three spectacular long-range goals in South Africa.' }
    ];
    const maxId = db.prepare("SELECT id FROM stickers ORDER BY CAST(SUBSTR(id,2) AS INTEGER) DESC LIMIT 1").get() as {id: string} | undefined;
    let nextNum = maxId ? parseInt(maxId.id.slice(1), 10) + 1 : 1339;
    const insertLegend = db.prepare('INSERT OR IGNORE INTO stickers (id, name, description, category, country, rarity) VALUES (?, ?, ?, ?, ?, ?)');
    const pad = (n: number) => 'S' + String(n).padStart(3, '0');
    for (const l of moreLegends) {
      insertLegend.run(pad(nextNum), l.name, l.description, 'Legends', l.country, 'Legendary');
      nextNum++;
    }
    console.log(`Migrated ${moreLegends.length} new legend stickers!`);
    const adminExists = db.prepare("SELECT id FROM users WHERE id = 'admin'").get();
    if (adminExists) {
      const now = new Date().toISOString();
      const insertAdmin = db.prepare('INSERT OR IGNORE INTO user_stickers (id, user_id, sticker_id, is_duplicate, created_at) VALUES (?, ?, ?, 0, ?)');
      for (const l of moreLegends) {
        const st = db.prepare("SELECT id FROM stickers WHERE name = ? AND category = 'Legends'").get(l.name) as {id: string} | undefined;
        if (st) {
          const usId = Math.random().toString(36).substring(2, 11);
          insertAdmin.run(usId, 'admin', st.id, now);
        }
      }
      console.log(`Granted ${moreLegends.length} legend stickers to admin`);
    }
  } catch (e) {
    console.error("Migration for new legends failed:", e);
  }
}

const questionsCount = db.prepare('SELECT COUNT(*) as count FROM questions').get() as {count: number};
if (questionsCount.count < 300) {
  db.prepare('DELETE FROM questions').run();
  const seedPath = path.join(process.cwd(), 'data', 'questions_seed.json');
  if (fs.existsSync(seedPath)) {
    try {
      const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      const insertQ = db.prepare('INSERT INTO questions (id, question, category, difficulty, correct_answer, option_a, option_b, option_c, option_d, xp_reward, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const seedQ = () => {
        for (const q of seedData) {
          insertQ.run(q.id, q.question, q.category, q.difficulty, q.correct_answer, q.option_a, q.option_b, q.option_c, q.option_d, q.xp_reward, q.language || 'en');
        }
      };
      db.transaction(seedQ)();
      const enCount = seedData.filter((q: any) => (q.language || 'en') === 'en').length;
      const arCount = seedData.filter((q: any) => q.language === 'ar').length;
      console.log(`Seeded ${seedData.length} questions (${enCount} EN + ${arCount} AR) from questions_seed.json!`);
    } catch (e) {
      console.error("Failed to seed questions from seed JSON:", e);
    }
  } else {
    const insertQ = db.prepare('INSERT INTO questions (id, question, category, difficulty, correct_answer, option_a, option_b, option_c, option_d, xp_reward, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const seedQ = () => {
      insertQ.run('Q001', 'Who won the 2022 FIFA World Cup?', 'FIFA World Cup History', 'Easy', 'Argentina', 'France', 'Brazil', 'Argentina', 'Germany', 10, 'en');
      insertQ.run('Q002', 'Which 3 countries will host the 2026 World Cup?', 'World Cup 2026', 'Medium', 'USA, Mexico, Canada', 'USA, Mexico, Canada', 'Brazil, Argentina, Chile', 'Spain, Portugal, Morocco', 'Japan, South Korea, China', 25, 'en');
    };
    db.transaction(seedQ)();
  }
}

// API Routes
app.post('/api/auth/register', (req, res) => {
  try {
    const { nickname, country, avatar, favoriteTeam, predictedWinner } = req.body;
    if (!nickname) {
        return res.status(400).json({ error: 'Nickname is required' });
    }
    
    // Generate recovery code format WC26-XXXX-XXXX-XXXX
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'WC26';
    for (let i = 0; i < 3; i++) {
        let chunk = '';
        for (let j = 0; j < 4; j++) chunk += chars.charAt(Math.floor(Math.random() * chars.length));
        code += '-' + chunk;
    }
    
    const id = Math.random().toString(36).substring(2, 11);
    const date = new Date().toISOString();
    
    const insert = db.prepare('INSERT INTO users (id, nickname, recovery_code, join_date, country, avatar, coins, xp, last_login, favorite_team, predicted_winner) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    insert.run(id, nickname, code, date, country || 'Unknown', avatar || '', 1000, 300, date, favoriteTeam || null, predictedWinner || null);
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json({ user, recoveryCode: code });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { recoveryCode } = req.body;
  if (!recoveryCode) {
    return res.status(400).json({ error: 'Recovery code required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE recovery_code = ?').get(recoveryCode);
  if (!user) {
    return res.status(404).json({ error: 'Invalid recovery code' });
  }
  
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), (user as any).id);
  res.json({ user });
});

app.get('/api/', (req, res) => {
  res.json({ ok: true, db: !!db, stickers: db.prepare('SELECT COUNT(*) as c FROM stickers').get() });
});

app.get('/api/me', (req, res) => {
    // Basic auth logic via Header for simplicity in prototype
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
});

app.get('/api/stickers', (req, res) => {
    const stickers = db.prepare('SELECT * FROM stickers').all() as any[];
    const overrides = loadManualOverrides();
    for (const s of stickers) {
      const o = overrides[s.id];
      if (o) {
        s.image = o.url;
        s.image_position = o.position || 'center center';
      }
    }
    res.json({ stickers });
});

app.get('/api/my-stickers', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const userStickers = db.prepare('SELECT us.*, s.name, s.category, s.rarity, s.country, s.description, s.image FROM user_stickers us JOIN stickers s ON us.sticker_id = s.id WHERE us.user_id = ?').all(userId);
    const overrides = loadManualOverrides();
    for (const us of userStickers as any[]) {
      const o = overrides[us.sticker_id];
      if (o) {
        us.image = o.url;
        us.image_position = o.position || 'center center';
      }
    }
    res.json({ userStickers });
});

app.get('/api/user/stats', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const totalStickersObj = db.prepare('SELECT COUNT(*) as count FROM stickers').get() as { count: number };
    const totalStickers = totalStickersObj ? totalStickersObj.count : 24;

    const uniqueOwnedObj = db.prepare('SELECT COUNT(DISTINCT sticker_id) as count FROM user_stickers WHERE user_id = ?').get(userId) as { count: number };
    const uniqueOwned = uniqueOwnedObj ? uniqueOwnedObj.count : 0;

    const totalOwnedObj = db.prepare('SELECT COUNT(*) as count FROM user_stickers WHERE user_id = ?').get(userId) as { count: number };
    const totalOwned = totalOwnedObj ? totalOwnedObj.count : 0;

    const duplicates = Math.max(0, totalOwned - uniqueOwned);

    const questionsAnsweredObj = db.prepare('SELECT COUNT(*) as count FROM user_completed_questions WHERE user_id = ?').get(userId) as { count: number };
    const questionsAnswered = questionsAnsweredObj ? questionsAnsweredObj.count : 0;

    res.json({
        totalStickers,
        uniqueOwned,
        totalOwned,
        duplicates,
        questionsAnswered
    });
});

app.post('/api/packs/open', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const { type } = req.body; // Bronze, Silver, Gold
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const cost = type === 'Gold' ? 500 : type === 'Silver' ? 250 : 100;
        if (user.coins < cost) {
            return res.status(400).json({ error: 'Not enough coins! Complete quizzes or claim your daily free pack to earn more.' });
        }

    const allStickers = db.prepare('SELECT id, rarity FROM stickers').all() as {id: string, rarity: string}[];
    if (allStickers.length === 0) return res.status(500).json({ error: 'No stickers available' });
    
    const count = type === 'Gold' ? 7 : type === 'Silver' ? 5 : 3;
    const unlocked: any[] = [];
    
    db.transaction(() => {
        // Reduct user's coins
        db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(cost, userId);

        const packOverrides = loadManualOverrides();
        for(let i=0; i<count; i++) {
            const randomSticker = allStickers[Math.floor(Math.random() * allStickers.length)];
            const usId = Math.random().toString(36).substring(2, 11);
            db.prepare('INSERT INTO user_stickers (id, user_id, sticker_id, created_at) VALUES (?, ?, ?, ?)').run(usId, userId, randomSticker.id, new Date().toISOString());
            const s = db.prepare('SELECT * FROM stickers WHERE id = ?').get(randomSticker.id) as any;
            const o = packOverrides[s.id];
            if (o) { s.image = o.url; s.image_position = o.position || 'center center'; }
            unlocked.push(s);
        }
    })();
    
    res.json({ unlocked });
});

// Daily free pack (5 random stickers + coins, once per day)
app.post('/api/user/claim-booster', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = db.prepare('SELECT last_daily_pack FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    const today = new Date().toISOString().slice(0, 10);
    if (user.last_daily_pack?.slice(0, 10) === today) return res.status(400).json({ error: 'Daily pack already claimed today! Come back tomorrow.' });

    const allStickers = db.prepare('SELECT id, rarity FROM stickers').all() as {id: string, rarity: string}[];
    const packOverrides = loadManualOverrides();
    const unlocked: any[] = [];
    const count = 5;

    db.transaction(() => {
        db.prepare('UPDATE users SET last_daily_pack = ?, coins = coins + 200, xp = xp + 50 WHERE id = ?').run(new Date().toISOString(), userId);
        for (let i = 0; i < count; i++) {
            const randomSticker = allStickers[Math.floor(Math.random() * allStickers.length)];
            const usId = Math.random().toString(36).substring(2, 11);
            db.prepare('INSERT INTO user_stickers (id, user_id, sticker_id, created_at) VALUES (?, ?, ?, ?)').run(usId, userId, randomSticker.id, new Date().toISOString());
            const s = db.prepare('SELECT * FROM stickers WHERE id = ?').get(randomSticker.id) as any;
            const o = packOverrides[s.id];
            if (o) { s.image = o.url; s.image_position = o.position || 'center center'; }
            unlocked.push(s);
        }
    })();

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({ user: updated, unlocked });
});

app.post('/api/user/reward', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const { xp, coins } = req.body;
    if (!userId) return res.status(100).json({ error: 'Unauthorized' });

    const user = db.prepare('SELECT xp, coins, level, total_points FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newXp = (user.xp || 0) + (xp || 0);
    const newCoins = (user.coins || 0) + (coins || 0);
    const newTotalPoints = (user.total_points || 0) + (xp || 0);
    const newLevel = Math.floor(newXp / 1000) + 1;

    db.prepare('UPDATE users SET xp = ?, coins = ?, total_points = ?, level = ? WHERE id = ?')
      .run(newXp, newCoins, newTotalPoints, newLevel, userId);

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({ user: updatedUser });
});

app.get('/api/questions/random', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const lang = (req.query.lang as string) === 'ar' ? 'ar' : 'en';

    // Select 5 random questions that this particular user has NOT completed yet, filtered by language
    const questions = db.prepare(`
        SELECT * FROM questions
        WHERE language = ?
          AND id NOT IN (SELECT question_id FROM user_completed_questions WHERE user_id = ?)
        ORDER BY RANDOM() LIMIT 5
    `).all(lang, userId);

    if (questions.length === 0) {
        // Fallback if the user has completed all questions in this language! Return any random 5.
        const fallbackQuestions = db.prepare('SELECT * FROM questions WHERE language = ? ORDER BY RANDOM() LIMIT 5').all(lang);
        res.json({ questions: fallbackQuestions, language: lang });
    } else {
        res.json({ questions, language: lang });
    }
});

app.post('/api/questions/answer', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { questionId, selectedOption } = req.body;
    if (!questionId) return res.status(400).json({ error: 'Question ID is required' });

    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId) as any;
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const isCorrect = (selectedOption === question.correct_answer);

    // Track that the user has answered this question so it is never repeated to them again
    try {
        db.prepare('INSERT OR IGNORE INTO user_completed_questions (user_id, question_id) VALUES (?, ?)')
          .run(userId, questionId);
    } catch (e) {
        console.error("Error inserting user_completed_questions:", e);
    }

    let xpEarned = 0;
    let coinsEarned = 0;
    let updatedUser = null;

    if (isCorrect) {
        xpEarned = question.xp_reward;
        coinsEarned = question.xp_reward;

        const u = db.prepare('SELECT xp, coins, level, total_points FROM users WHERE id = ?').get(userId) as any;
        if (u) {
            const newXp = (u.xp || 0) + xpEarned;
            const newCoins = (u.coins || 0) + coinsEarned;
            const newTotalPoints = (u.total_points || 0) + xpEarned;
            const newLevel = Math.floor(newXp / 1000) + 1;

            db.prepare('UPDATE users SET xp = ?, coins = ?, total_points = ?, level = ? WHERE id = ?')
              .run(newXp, newCoins, newTotalPoints, newLevel, userId);
        }
    }

    updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({
        correct: isCorrect,
        correctAnswer: question.correct_answer,
        xpEarned,
        coinsEarned,
        user: updatedUser
    });
});

// --- Admin endpoints (require x-user-id = 'admin') ---
function requireAdmin(req: express.Request, res: express.Response): boolean {
  const userId = req.headers['x-user-id'] as string;
  if (userId !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return false;
  }
  return true;
}

// FIFA 2026 WC team ID mapping (app country -> FIFA teamId)
const FIFA_TEAM_IDS: Record<string, string> = {
  'United States': '43921', Mexico: '43911', Canada: '43899',
  Argentina: '43922', Brazil: '43924', France: '43946', England: '43942',
  Spain: '43969', Portugal: '43963', Germany: '43948', Netherlands: '43960',
  Belgium: '43935', Uruguay: '43930', Colombia: '43926', Morocco: '43872',
  Senegal: '43879', Japan: '43819', 'South Korea': '43822', Australia: '43976',
  Croatia: '43938', Switzerland: '43971', Sweden: '43970', Austria: '43934',
  Turkey: '43972', Türkiye: '43972', Scotland: '43967', Ecuador: '43927', Paraguay: '43928',
  Algeria: '43843', Egypt: '43855', 'Ivory Coast': '43854', Ghana: '43860',
  'Saudi Arabia': '43835', Iran: '43817', 'New Zealand': '43978', Norway: '43961',
  'Bosnia and Herzegovina': '44037', 'Cabo Verde': '43850', Curaçao: '1895293',
  Czechia: '43995', 'DR Congo': '20014', Haiti: '43908', Iraq: '43818',
  Jordan: '43820', Panama: '43914', Qatar: '43834', 'South Africa': '43883',
  Tunisia: '43888', Uzbekistan: '44005',
};
const FIFA_SORTED_COUNTRIES = Object.keys(FIFA_TEAM_IDS).sort((a, b) => b.length - a.length);

// Known sticker-name to FIFA-name overrides for players whose names differ completely
const NAME_ALIASES: Record<string, string> = {
  'Munir Mohamedi': 'Munir El Kajoui',
  'Lee Ki-hyuk': 'LEE Gihyuk',
  'Cho Yu-min': 'CHO Wije',
  'Tahsin Jamshid': 'TAHSIN MOHAMMED',
  // Iran
  'Ehsan Hajsafi': 'Ehsan HAJISAFI',
  'Hossein Kanaanizadegan': 'Hossein KANANI',
  'Shojae Khalilzadeh': 'Shoja KHALILZADEH',
  'Danial Eiri': 'Danial IRI',
  'Rouzbeh Cheshmi': 'Roozbeh CHESHMI',
  'Mohammad Mohebi': 'Mohammad MOHEBBI',
  'Aria Yousefi': 'Arya YOUSEFI',
  'Amirmohammad Razzaghinia': 'Amirmohammad RAZAGHINIA',
  'Shahriyar Moghanlou': 'Shahriyar MOGHANLOO',
  'Dennis Eckert': 'Dennis DARGAHI',
  // Replaced/renamed players (for existing DBs with old names)
  'Lennart Karl': 'Assan OUEDRAOGO',
  'Jurriën Timber': 'Lutsharel GEERTRUIDA',
  'Wataru Endo': 'Shuto MACHINO',
  'Clément Akpa': 'Christopher OPERI',
  'Nidal Čelik': 'Arjan MALIC',
  'Leverton Pierre': 'Garven METUSALA',
  'Ahmed Yahya': 'AHMED MAKNAZI',
  'Marcelo Flores': 'Jayden Nelson',
  'Leonardo Balerdi': 'Marcos SENESI',
  'Nayef Aguerd': 'Marwane SAADANE',
  'Abde Ezzalzouli': 'Amine SBAI',
  'Christoph Baumgartner': 'Dejan LJUBICIC',
  'Ibrahim Sabra': 'IBRAHIM SADEH',
  // Egypt
  'Mostafa Shobeir': 'MOSTAFA SHOUBIR',
  'Mohamed Abdelmonem': 'MOHAMED ABDELMONEIM',
  'Marwan Attia': 'MARAWAN ATTIA',
  'Mohanad Lasheen': 'MOHANAD LASHIN',
  'Nabil Emad': 'NABIL DONGA',
  'Mostafa Ziko': 'MOSTAFA ZICO',
  // Saudi Arabia
  'Nawaf Boushal': 'NAWAF BU WASHL',
  'Jehad Thakri': 'JEHAD THIKRI',
  'Ayman Yahya': 'AIMAN YAHYA',
  'Alaa Al-Hejji': 'ALA ALHAJJI',
  'Firas Al-Buraikan': 'FERAS ALBRIKAN',
  // Jordan
  'Salim Obaid': 'SALEEM OBAID',
  'Ihsan Haddad': 'EHSAN HADDAD',
  'Musa Al-Taamari': 'MOUSA ALTAMARI',
  'Odeh Al-Fakhouri': 'ODEH FAKHOURY',
  // Haiti
  'Carl Fred Sainté': 'Carl SAINTE',
  'Don Deedson Louicius': 'Louicius DEEDSON',
  'Duke Lacroix': 'Markhus LACROIX',
  // Norway
  'Ørjan Nyland': 'Orjan NYLAND',
  'Torbjørn Heggem': 'Torbjorn HEGGEM',
  'Martin Ødegaard': 'Martin ODEGAARD',
  // Iraq
  'Manaf Younis': 'MUNAF YOUNUS',
  'Zaid Ismail': 'ZAID ISMAEL',
  // Uzbekistan
  'Bekhruz Karimov': 'Behruzjon KARIMOV',
  'Avazbek Ulmasaliev': 'Avazbek ULMASALIYEV',
  'Odiljon Hamrobekov': 'Odiljon XAMROBEKOV',
  // Others
  'Maximilian Arfsten': 'Max ARFSTEN',
  'Cammy Devlin': 'Cameron DEVLIN',
  'Maximiliano Araújo': 'Maxi ARAUJO',
  'Juan Fernando Quintero': 'Juan QUINTERO',
  'Yacine Titraoui': 'Yassine TITRAOUI',
  'Nicolás González': 'Nico GONZALEZ',
  'Abdul Rahman Baba': 'Baba RAHMAN',
  'Prince Kwabena Adu': 'Prince ADU',
  'Anis Ben Slimane': 'Anis SLIMANE',
  'Adem Arous': 'Adam AROUS',
  'Phillipp Mwene': 'Phillip MWENE',
  'Kaku': 'Alejandro ROMERO GAMARRA',
};

// Normalize a name for fuzzy matching: remove accents, normalize Turkish chars, lowercase
function normalizeName(s: string): string {
  return s.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Strip combining diacritics (é, è, ê, etc.)
    .replace(/['’.]/g, '')             // Strip apostrophes and periods
    .replace(/-/g, ' ')                // Hyphen to space
    // Turkish character normalization (these are not decomposed by NFD)
    .replace(/[ı]/g, 'i')              // Dotless i
    .replace(/[İ]/g, 'i')              // Dotted capital I
    .replace(/[ğĞ]/g, 'g')             // Soft g
    .replace(/[şŞ]/g, 's')             // S-cedilla
    .replace(/[öÖ]/g, 'o')             // O-umlaut
    .replace(/[üÜ]/g, 'u')             // U-umlaut
    .replace(/[çÇ]/g, 'c')             // C-cedilla
    .toLowerCase()
    .trim();
}

function nameMatches(stickerWords: string[], fifaFullName: string, fifaShortName: string): boolean {
  const strict = stickerWords.every(w => fifaFullName.includes(w) || fifaShortName.includes(w));
  if (strict) return true;
  // Soft match: handle umlaut digraphs (FIFA uses oe for ö, ue for ü, ae for ä)
  const softF = fifaFullName.replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/ae/g, 'a');
  const softS = fifaShortName.replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/ae/g, 'a');
  if (stickerWords.every(w => softF.includes(w) || softS.includes(w))) return true;
  // Korean/Asian name handling: FIFA may combine given name syllables and use different romanization
  // e.g., "Lee Ki-hyuk" (3 words) vs "LEE Gihyuk" (2 words)
  if (stickerWords.length > 1) {
    const allJoined = stickerWords.join('');
    const fifaNoSpace = fifaFullName.replace(/\s+/g, '');
    if (fifaNoSpace.includes(allJoined)) return true;
    // Try romanization variations on both sticker and FIFA name
    const stickerVar = allJoined.replace(/k/g, 'g').replace(/t/g, 'd').replace(/p/g, 'b').replace(/ch/g, 'j');
    const fifaVar = fifaNoSpace.replace(/k/g, 'g').replace(/t/g, 'd').replace(/p/g, 'b').replace(/ch/g, 'j');
    if (stickerVar === fifaVar || stickerVar.includes(fifaVar) || fifaVar.includes(stickerVar)) return true;
    // Try combining adjacent word pairs
    const fNS = fifaNoSpace, sF = softF, sS = softS;
    for (let i = 0; i < stickerWords.length - 1; i++) {
      const pair = stickerWords[i] + stickerWords[i + 1];
      if (fNS.includes(pair) || sF.includes(pair) || sS.includes(pair)) return true;
      const pr = pair.replace(/^k/, 'g').replace(/^t/, 'd').replace(/^ch/, 'j').replace(/^p/, 'b');
      const pr2 = pair.replace(/k$/, 'g').replace(/t$/, 'd').replace(/p$/, 'b');
      if (fNS.includes(pr) || fNS.includes(pr2)) return true;
    }
  }
  return false;
}

async function searchFIFAImage(q: string): Promise<{ title: string; url: string; thumb: string }[]> {
  // Apply name aliases before processing
  for (const [stickerName, fifaName] of Object.entries(NAME_ALIASES)) {
    if (q.startsWith(stickerName)) {
      q = q.replace(stickerName, fifaName);
      break;
    }
  }
  const qNorm = normalizeName(q);
  let matchedCountry = '';
  for (const c of FIFA_SORTED_COUNTRIES) {
    if (qNorm.includes(normalizeName(c))) { matchedCountry = c; break; }
  }
  if (!matchedCountry) return [];
  const teamId = FIFA_TEAM_IDS[matchedCountry];
  const playerNameQuery = qNorm.replace(normalizeName(matchedCountry), '').trim();
  const queryWords = playerNameQuery.split(/\s+/).filter(Boolean);
  if (!queryWords.length) return [];

  try {
    const res = await fetch(
      `https://api.fifa.com/api/v3/teams/${teamId}/squad?idCompetition=17&idSeason=285023&language=en`,
      { headers: { 'User-Agent': 'Paninarr/1.0', Accept: 'application/json' } }
    );
    if (!res.ok) return [];
    const data = await res.json() as any;
    const players: any[] = data?.Players || [];
    if (!players.length) return [];

    const results: { title: string; url: string; thumb: string }[] = [];
    for (const p of players) {
      const fifaName = normalizeName(p.PlayerName?.[0]?.Description || '');
      const shortName = normalizeName(p.ShortName?.[0]?.Description || '');
      const pictureUrl: string = p.PlayerPicture?.PictureUrl;
      if (!pictureUrl) continue;
      if (!pictureUrl.startsWith('https://digitalhub.fifa.com/transform/')) continue;

      if (!nameMatches(queryWords, fifaName, shortName)) continue;

      const fullUrl = pictureUrl + '?io=transform:fill,aspectratio:1x1,width:640,gravity:top&quality=75';
      results.push({
        title: `FIFA: ${p.PlayerName[0].Description} (#${p.JerseyNum || ''})`,
        url: fullUrl,
        thumb: fullUrl,
      });
      if (results.length >= 3) break;
    }
    // If no player match, try officials (manager)
    if (!results.length && data?.Officials) {
      const officials: any[] = data.Officials;
      for (const o of officials) {
        if (o.Role !== 0) continue;
        const coachName = o.Name?.[0]?.Description || o.PersonName?.[0]?.Description || '';
        if (!coachName) continue;
        const coachWords = normalizeName(coachName).split(/\s+/).filter(Boolean);
        const allMatch = queryWords.every((w: string) => coachWords.includes(w)) || coachWords.every((w: string) => queryWords.includes(w));
        if (!allMatch) continue;
        const coachPic = o.PictureUrl;
        if (!coachPic?.startsWith('https://digitalhub.fifa.com/transform/')) break;
        const fullUrl = coachPic + '?io=transform:fill,aspectratio:1x1,width:640,gravity:top&quality=75';
        results.push({ title: `FIFA Coach: ${coachName}`, url: fullUrl, thumb: fullUrl });
        break;
      }
    }
    return results;
  } catch {
    return [];
  }
}

// Search images for a player name via FIFA, Wikidata + Commons
app.get('/api/admin/image-search', async (req, res) => {
  console.log('[admin] image-search called with q=', req.query.q);
  if (!requireAdmin(req, res)) return;
  const q = req.query.q as string;
  if (!q) return res.status(400).json({ error: 'Missing query parameter ?q=' });

  try {
    const candidates: { title: string; url: string; thumb: string }[] = [];
    const seen = new Set<string>();

    // Source 1: FIFA official player images (highest priority)
    try {
      const fifaResults = await searchFIFAImage(q);
      for (const r of fifaResults) {
        if (!seen.has(r.url)) {
          seen.add(r.url);
          candidates.push(r);
        }
      }
    } catch (e: any) {
      console.error('[admin] FIFA search failed:', e.message);
    }

    // Source 2: Openverse (CC-licensed search)
    try {
      const ovUrl = new URL('https://api.openverse.engineering/v1/images/');
      ovUrl.searchParams.set('q', q);
      ovUrl.searchParams.set('page_size', '20');

      const ovRes = await fetch(ovUrl.toString(), {
        headers: { 'User-Agent': 'Paninarr/1.0 (admin image search)' }
      });
      if (ovRes.ok) {
        const ovData = await ovRes.json() as any;
        for (const r of (ovData?.results || [])) {
          const url = r.url || r.thumbnail;
          if (!url || seen.has(url)) continue;
          seen.add(url);
          candidates.push({
            title: r.title || 'Image',
            url: url,
            thumb: r.thumbnail || url,
          });
          if (candidates.length >= 20) break;
        }
      }
    } catch (e: any) {
      console.error('[admin] Openverse search failed:', e.message);
    }

    // Source 3: Wikimedia Commons direct search (works reliably)
    try {
      const commonsUrl = new URL('https://commons.wikimedia.org/w/api.php');
      commonsUrl.searchParams.set('action', 'query');
      commonsUrl.searchParams.set('format', 'json');
      commonsUrl.searchParams.set('list', 'search');
      commonsUrl.searchParams.set('srsearch', q);
      commonsUrl.searchParams.set('srnamespace', '6');
      commonsUrl.searchParams.set('srlimit', '20');

      const commonsRes = await fetch(commonsUrl.toString(), {
        headers: { 'User-Agent': 'Paninarr/1.0 (admin image search)' }
      });
      if (commonsRes.ok) {
        const commonsData = await commonsRes.json() as any;
        const titles = (commonsData?.query?.search || []).map((r: any) => r.title);

        for (const title of titles) {
          const imgUrl = new URL('https://commons.wikimedia.org/w/api.php');
          imgUrl.searchParams.set('action', 'query');
          imgUrl.searchParams.set('format', 'json');
          imgUrl.searchParams.set('prop', 'imageinfo');
          imgUrl.searchParams.set('iiprop', 'url');
          imgUrl.searchParams.set('iiurlwidth', '200');
          imgUrl.searchParams.set('titles', title);

          const imgRes = await fetch(imgUrl.toString(), {
            headers: { 'User-Agent': 'Paninarr/1.0 (admin image search)' }
          });
          if (imgRes.ok) {
            const imgData = await imgRes.json() as any;
            const page = Object.values(imgData?.query?.pages || {})[0] as any;
            if (page?.imageinfo?.[0]) {
              const url = page.imageinfo[0].url;
              if (!seen.has(url)) {
                seen.add(url);
                candidates.push({
                  title: title.replace(/^File:/, ''),
                  url: url,
                  thumb: page.imageinfo[0].thumburl || url,
                });
                if (candidates.length >= 24) break;
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.error('[admin] Commons search failed:', e.message);
    }

    // Source 4: Wikipedia page images
    if (candidates.length < 12) {
      try {
        const wikiUrl = new URL('https://en.wikipedia.org/w/api.php');
        wikiUrl.searchParams.set('action', 'query');
        wikiUrl.searchParams.set('format', 'json');
        wikiUrl.searchParams.set('list', 'search');
        wikiUrl.searchParams.set('srsearch', q);
        wikiUrl.searchParams.set('srlimit', '8');

        const wikiRes = await fetch(wikiUrl.toString(), {
          headers: { 'User-Agent': 'Paninarr/1.0 (admin image search)' }
        });
        const wikiData = await wikiRes.json() as any;
        const titles = (wikiData?.query?.search || []).map((r: any) => r.title);

        for (const title of titles) {
          const piUrl = new URL('https://en.wikipedia.org/w/api.php');
          piUrl.searchParams.set('action', 'query');
          piUrl.searchParams.set('format', 'json');
          piUrl.searchParams.set('prop', 'pageimages');
          piUrl.searchParams.set('piprop', 'original|thumbnail');
          piUrl.searchParams.set('pithumbsize', '200');
          piUrl.searchParams.set('titles', title);

          const piRes = await fetch(piUrl.toString(), {
            headers: { 'User-Agent': 'Paninarr/1.0 (admin image search)' }
          });
          const piData = await piRes.json() as any;
          const page = Object.values(piData?.query?.pages || {})[0] as any;
          const url = page?.original?.source || page?.thumbnail?.source;
          if (url && !seen.has(url)) {
            seen.add(url);
            candidates.push({
              title: title,
              url: url,
              thumb: page?.thumbnail?.source || url,
            });
            if (candidates.length >= 24) break;
          }
        }
      } catch (e: any) {
        console.error('[admin] Wikipedia search failed:', e.message);
      }
    }

    res.json({ candidates });
  } catch (err: any) {
    console.error('[admin] image-search unexpected error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Audit a single team's squad vs FIFA API
app.post('/api/admin/audit-team', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { country } = req.body;
  if (!country) return res.status(400).json({ error: 'country required' });
  const teamId = FIFA_TEAM_IDS[country];
  if (!teamId) return res.status(400).json({ error: `No FIFA team ID for ${country}` });
  try {
    const stickers = db.prepare("SELECT id, name, country, category FROM stickers WHERE country = ? AND category = 'National Teams'").all(country) as any[];
    const overrides = loadManualOverrides();
    const UA = 'Paninarr/1.0';
    const result: any = { country, teamId, dbPlayers: stickers.length, fifaPlayers: 0, matched: [], unmatchedDb: [], unmatchedFifa: [], noPhoto: [], hasPhoto: [] };
    const res2 = await fetch(`https://api.fifa.com/api/v3/teams/${teamId}/squad?idCompetition=17&idSeason=285023&language=en`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res2.ok) return res.status(502).json({ error: `FIFA API HTTP ${res2.status}` });
    const data = await res2.json() as any;
    const fifaPlayers: any[] = data?.Players || [];
    result.fifaPlayers = fifaPlayers.length;
    // Match DB stickers to FIFA
    for (const sticker of stickers) {
      const numId = parseInt(sticker.id.replace(/^S/i, ''), 10);
      const mgrThreshold = parseInt('S1309'.slice(1), 10);
      const isManager = !isNaN(numId) && numId >= mgrThreshold;
      const aliasName = NAME_ALIASES[sticker.name] || sticker.name;
      const nameNorm = normalizeName(aliasName);
      const nameWords = nameNorm.split(/\s+/).filter(Boolean);
      let matchedFifa: any = null;
      for (const fp of fifaPlayers) {
        const fifaName = normalizeName(fp.PlayerName?.[0]?.Description || '');
        const shortName = normalizeName(fp.ShortName?.[0]?.Description || '');
        if (nameMatches(nameWords, fifaName, shortName)) { matchedFifa = fp; break; }
      }
      const override = overrides[sticker.id];
      const hasImage = override?.url || sticker.image;
      if (matchedFifa) {
        const hasPhoto = !!matchedFifa.PlayerPicture?.PictureUrl?.startsWith('https://digitalhub.fifa.com/transform/');
        result.matched.push({ stickerId: sticker.id, name: sticker.name, isManager, fifaName: matchedFifa.PlayerName?.[0]?.Description, hasPhoto, hasImage: !!hasImage });
        if (hasPhoto) result.hasPhoto.push(sticker.name);
        else result.noPhoto.push(sticker.name);
      } else {
        result.unmatchedDb.push({ stickerId: sticker.id, name: sticker.name, isManager, hasImage: !!hasImage });
      }
    }
    // Find FIFA players not in DB
    const dbNames = stickers.map(s => normalizeName(s.name));
    for (const fp of fifaPlayers) {
      const fifaName = normalizeName(fp.PlayerName?.[0]?.Description || '');
      const shortName = normalizeName(fp.ShortName?.[0]?.Description || '');
      const fifaWords = fifaName.split(/\s+/).filter(Boolean);
      let found = false;
      for (const sticker of stickers) {
        const aliasName = NAME_ALIASES[sticker.name] || sticker.name;
        const nameNorm = normalizeName(aliasName);
        const nameWords = nameNorm.split(/\s+/).filter(Boolean);
        if (nameMatches(nameWords, fifaName, shortName)) { found = true; break; }
      }
      if (!found) {
        result.unmatchedFifa.push({ fifaName: fp.PlayerName?.[0]?.Description, shortName: fp.ShortName?.[0]?.Description });
      }
    }
    // Coach check
    if (data?.Officials) {
      const coach = data.Officials.find((o: any) => o.Role === 0);
      if (coach) {
        result.coach = { fifaName: coach.Name?.[0]?.Description, hasPhoto: !!coach.PictureUrl?.startsWith('https://digitalhub.fifa.com/transform/') };
      }
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Resolve a single team's missing images via FIFA + Wiki fallback
app.post('/api/admin/resolve-team', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { country } = req.body;
  if (!country) return res.status(400).json({ error: 'country required' });
  try {
    const teamId = FIFA_TEAM_IDS[country];
    if (!teamId) return res.status(400).json({ error: `No FIFA team ID for ${country}` });
    const stickers = db.prepare("SELECT id, name, country FROM stickers WHERE country = ? AND category = 'National Teams'").all(country) as any[];
    const overrides = loadManualOverrides();
    const UA = 'Paninarr/1.0';
    const results = { country, total: stickers.length, resolved: 0, fifaResolved: 0, wikiResolved: 0, notFound: 0, errors: 0, details: [] as any[] };
    const mgrThreshold = parseInt('S1309'.slice(1), 10);
    const managerStickers: any[] = [];
    const playerStickers: any[] = [];
    for (const s of stickers) {
      const numId = parseInt(s.id.replace(/^S/i, ''), 10);
      if (overrides[s.id]?.url) { continue; }
      if (!isNaN(numId) && numId >= mgrThreshold) { managerStickers.push(s); }
      else { playerStickers.push(s); }
    }
    try {
      const res2 = await fetch(`https://api.fifa.com/api/v3/teams/${teamId}/squad?idCompetition=17&idSeason=285023&language=en`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
      const data = await res2.json() as any;
      const fifaPlayers: any[] = data?.Players || [];

      for (const sticker of playerStickers) {
        if (overrides[sticker.id]?.url) continue;
        const aliasName = NAME_ALIASES[sticker.name] || sticker.name;
        const nameNorm = normalizeName(aliasName);
        const nameWords = nameNorm.split(/\s+/).filter(Boolean);
        let match: any = null;
        for (const fp of fifaPlayers) {
          const pictureUrl: string = fp.PlayerPicture?.PictureUrl;
          if (!pictureUrl || !pictureUrl.startsWith('https://digitalhub.fifa.com/transform/')) continue;
          const fifaName = normalizeName(fp.PlayerName?.[0]?.Description || '');
          const shortName = normalizeName(fp.ShortName?.[0]?.Description || '');
          if (nameMatches(nameWords, fifaName, shortName)) { match = fp; break; }
        }
        if (!match) {
          // Wiki fallback
          try {
            const wikiQ = sticker.name + (sticker.country ? ' ' + sticker.country : '') + ' footballer';
            const wikiUrl = new URL('https://en.wikipedia.org/w/api.php');
            wikiUrl.searchParams.set('action', 'query'); wikiUrl.searchParams.set('format', 'json');
            wikiUrl.searchParams.set('list', 'search'); wikiUrl.searchParams.set('srsearch', wikiQ); wikiUrl.searchParams.set('srlimit', '3');
            const wikiRes = await fetch(wikiUrl.toString(), { headers: { 'User-Agent': UA } });
            if (wikiRes.ok) {
              const wikiData = await wikiRes.json() as any;
              for (const r of (wikiData?.query?.search || [])) {
                const piUrl = new URL('https://en.wikipedia.org/w/api.php');
                piUrl.searchParams.set('action', 'query'); piUrl.searchParams.set('format', 'json');
                piUrl.searchParams.set('prop', 'pageimages'); piUrl.searchParams.set('piprop', 'original|thumbnail');
                piUrl.searchParams.set('pithumbsize', '300'); piUrl.searchParams.set('titles', r.title);
                const piRes = await fetch(piUrl.toString(), { headers: { 'User-Agent': UA } });
                if (piRes.ok) {
                  const piData = await piRes.json() as any;
                  const page = Object.values(piData?.query?.pages || {})[0] as any;
                  const wUrl = page?.original?.source || page?.thumbnail?.source;
                  if (wUrl) {
                    overrides[sticker.id] = { url: wUrl, position: overrides[sticker.id]?.position || 'center center' };
                    results.wikiResolved++; results.resolved++;
                    results.details.push({ stickerId: sticker.id, name: sticker.name, status: 'resolved_wiki' });
                    match = { PlayerPicture: { PictureUrl: wUrl } };
                    break;
                  }
                }
              }
            }
          } catch {}
        }
        if (!match) { results.notFound++; results.details.push({ stickerId: sticker.id, name: sticker.name, status: 'not_found' }); continue; }
        const fullUrl = match.PlayerPicture.PictureUrl + (match.PlayerPicture.PictureUrl.includes('digitalhub.fifa.com') ? '?io=transform:fill,aspectratio:1x1,width:640,gravity:top&quality=75' : '');
        overrides[sticker.id] = { url: fullUrl, position: overrides[sticker.id]?.position || 'center center' };
        if (!results.details.some((d: any) => d.stickerId === sticker.id)) {
          results.fifaResolved++; results.resolved++;
          results.details.push({ stickerId: sticker.id, name: sticker.name, status: 'resolved_fifa', url: fullUrl });
        }
      }

      // Manager
      for (const mSticker of managerStickers) {
        if (overrides[mSticker.id]?.url) continue;
        if (!data?.Officials) { results.notFound++; results.details.push({ stickerId: mSticker.id, name: mSticker.name, status: 'no_officials' }); continue; }
        const coach = data.Officials.find((o: any) => o.Role === 0);
        if (!coach) { results.notFound++; results.details.push({ stickerId: mSticker.id, name: mSticker.name, status: 'no_coach' }); continue; }
        const coachPic = coach.PictureUrl;
        if (!coachPic?.startsWith('https://digitalhub.fifa.com/transform/')) { results.notFound++; results.details.push({ stickerId: mSticker.id, name: mSticker.name, status: 'no_image' }); continue; }
        overrides[mSticker.id] = { url: coachPic + '?io=transform:fill,aspectratio:1x1,width:640,gravity:top&quality=75', position: overrides[mSticker.id]?.position || 'center center' };
        results.fifaResolved++; results.resolved++;
        results.details.push({ stickerId: mSticker.id, name: mSticker.name, status: 'resolved_manager' });
      }
    } catch (e: any) {
      results.errors++;
      results.details.push({ country, status: 'error', message: e.message });
    }
    saveManualOverrides(overrides);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Batch-resolve all player images from FIFA
app.post('/api/admin/resolve-all-fifa', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const stickers = db.prepare("SELECT id, name, country FROM stickers WHERE country IS NOT NULL AND country != ''").all() as any[];
    const overrides = loadManualOverrides();
    const results = { total: 0, resolved: 0, notFound: 0, errors: 0, details: [] as any[] };

    // Group by country
    const byCountry: Record<string, any[]> = {};
    for (const s of stickers) {
      const teamId = FIFA_TEAM_IDS[s.country];
      if (!teamId) continue;
      results.total++;
      if (!byCountry[s.country]) byCountry[s.country] = [];
      byCountry[s.country].push(s);
    }

    for (const [country, players] of Object.entries(byCountry)) {
      const teamId = FIFA_TEAM_IDS[country];
      try {
        const res2 = await fetch(
          `https://api.fifa.com/api/v3/teams/${teamId}/squad?idCompetition=17&idSeason=285023&language=en`,
          { headers: { 'User-Agent': 'Paninarr/1.0', Accept: 'application/json' } }
        );
        if (!res2.ok) { throw new Error(`HTTP ${res2.status}`); }
        const data = await res2.json() as any;
        const fifaPlayers: any[] = data?.Players || [];

        // Separate manager sticker from players
        const managerStickers: any[] = [];
        const playerStickers: any[] = [];
        const mgrThreshold = parseInt('S1309'.slice(1), 10);
        for (const s of players) {
          const numId = parseInt(s.id.replace(/^S/i, ''), 10);
          if (!isNaN(numId) && numId >= mgrThreshold) { managerStickers.push(s); }
          else { playerStickers.push(s); }
        }

        // Match regular players
        for (const sticker of playerStickers) {
          const aliasName = NAME_ALIASES[sticker.name] || sticker.name;
          const nameNorm = normalizeName(aliasName);
          const nameWords = nameNorm.split(/\s+/).filter(Boolean);

          let match: any = null;
          for (const fp of fifaPlayers) {
            const pictureUrl: string = fp.PlayerPicture?.PictureUrl;
            if (!pictureUrl || !pictureUrl.startsWith('https://digitalhub.fifa.com/transform/')) continue;
            const fifaName = normalizeName(fp.PlayerName?.[0]?.Description || '');
            const shortName = normalizeName(fp.ShortName?.[0]?.Description || '');
            if (nameMatches(nameWords, fifaName, shortName)) { match = fp; break; }
          }
          if (!match) {
            // Fallback: try Wikipedia/Wikimedia for this player
            try {
              const wikiNames = [sticker.name];
              const aliasName2 = NAME_ALIASES[sticker.name];
              if (aliasName2 && aliasName2 !== sticker.name) wikiNames.push(aliasName2);
              let foundWikiUrl: string | null = null;
              for (const wName of wikiNames) {
                const wikiQ = wName + (sticker.country ? ' ' + sticker.country : '') + ' footballer';
                const wikiUrl = new URL('https://en.wikipedia.org/w/api.php');
                wikiUrl.searchParams.set('action', 'query');
                wikiUrl.searchParams.set('format', 'json');
                wikiUrl.searchParams.set('list', 'search');
                wikiUrl.searchParams.set('srsearch', wikiQ);
                wikiUrl.searchParams.set('srlimit', '3');
                const wikiRes = await fetch(wikiUrl.toString(), { headers: { 'User-Agent': 'Paninarr/1.0' } });
                if (wikiRes.ok) {
                  const wikiData = await wikiRes.json() as any;
                  for (const r of (wikiData?.query?.search || [])) {
                    const piUrl = new URL('https://en.wikipedia.org/w/api.php');
                    piUrl.searchParams.set('action', 'query');
                    piUrl.searchParams.set('format', 'json');
                    piUrl.searchParams.set('prop', 'pageimages');
                    piUrl.searchParams.set('piprop', 'original|thumbnail');
                    piUrl.searchParams.set('pithumbsize', '300');
                    piUrl.searchParams.set('titles', r.title);
                    const piRes = await fetch(piUrl.toString(), { headers: { 'User-Agent': 'Paninarr/1.0' } });
                    if (piRes.ok) {
                      const piData = await piRes.json() as any;
                      const page = Object.values(piData?.query?.pages || {})[0] as any;
                      const wikiUrl2 = page?.original?.source || page?.thumbnail?.source;
                      if (wikiUrl2) {
                        foundWikiUrl = wikiUrl2;
                        break;
                      }
                    }
                  }
                }
                if (foundWikiUrl) break;
              }
              if (foundWikiUrl) {
                overrides[sticker.id] = { url: foundWikiUrl, position: overrides[sticker.id]?.position || 'center center' };
                results.resolved++;
                results.details.push({ stickerId: sticker.id, name: sticker.name, status: 'resolved_wiki_fallback', url: foundWikiUrl });
                match = { PlayerPicture: { PictureUrl: foundWikiUrl } };
              }
            } catch {}
          }
          if (!match) {
            results.notFound++;
            results.details.push({ stickerId: sticker.id, name: sticker.name, status: 'not_found' });
            continue;
          }
          const fullUrl = match.PlayerPicture.PictureUrl + (match.PlayerPicture.PictureUrl.includes('digitalhub.fifa.com') ? '?io=transform:fill,aspectratio:1x1,width:640,gravity:top&quality=75' : '');
          overrides[sticker.id] = { url: fullUrl, position: overrides[sticker.id]?.position || 'center center' };
          results.resolved++;
          results.details.push({ stickerId: sticker.id, name: sticker.name, status: 'resolved', url: fullUrl });
        }

        // Match manager sticker via Officials (Role: 0 = head coach)
        for (const managerSticker of managerStickers) {
          if (!data?.Officials) { results.notFound++; results.details.push({ stickerId: managerSticker.id, name: managerSticker.name, status: 'not_found' }); continue; }
          const officials: any[] = data.Officials;
          const coach = officials.find((o: any) => o.Role === 0);
          if (!coach) { results.notFound++; results.details.push({ stickerId: managerSticker.id, name: managerSticker.name, status: 'not_found' }); continue; }
          const coachName = coach.Name?.[0]?.Description || coach.PersonName?.[0]?.Description || '';
          const coachWords = normalizeName(coachName).split(/\s+/).filter(Boolean);
          const mgrNorm = normalizeName(managerSticker.name);
          const mgrWords = mgrNorm.split(/\s+/).filter(Boolean);
          const allMatch = mgrWords.every((w: string) => coachWords.includes(w)) || coachWords.every((w: string) => mgrWords.includes(w));
          if (!allMatch) { results.notFound++; results.details.push({ stickerId: managerSticker.id, name: managerSticker.name, status: 'not_found' }); continue; }
          const coachPic = coach.PictureUrl;
          if (!coachPic?.startsWith('https://digitalhub.fifa.com/transform/')) { results.notFound++; results.details.push({ stickerId: managerSticker.id, name: managerSticker.name, status: 'no_image' }); continue; }
          const fullUrl = coachPic + '?io=transform:fill,aspectratio:1x1,width:640,gravity:top&quality=75';
          overrides[managerSticker.id] = { url: fullUrl, position: overrides[managerSticker.id]?.position || 'center center' };
          results.resolved++;
          results.details.push({ stickerId: managerSticker.id, name: managerSticker.name, status: 'resolved_manager', url: fullUrl });
        }
      } catch (e: any) {
        results.errors++;
        results.details.push({ country, status: 'error', message: e.message });
      }
    }

    saveManualOverrides(overrides);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Batch-resolve images for non-player stickers (Legends, Stadiums, Host Cities, Trophies) via Wikipedia/Wikimedia
app.post('/api/admin/resolve-all-generic', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const stickers = db.prepare("SELECT id, name, country, category FROM stickers WHERE category IN ('Legends','Stadiums','Host Cities','Trophies')").all() as any[];
    const overrides = loadManualOverrides();
    const results = { total: 0, resolved: 0, notFound: 0, errors: 0, details: [] as any[] };
    const seen = new Set<string>();
    const UA = 'Paninarr/1.0';

    for (const sticker of stickers) {
      if (overrides[sticker.id]?.url) { continue; }
      results.total++;
      const q = sticker.name + (sticker.country && sticker.country !== 'International' ? ' ' + sticker.country : '') + ' football';
      let found = false;

      // Source 1: Wikipedia page images
      try {
        const wikiUrl = new URL('https://en.wikipedia.org/w/api.php');
        wikiUrl.searchParams.set('action', 'query');
        wikiUrl.searchParams.set('format', 'json');
        wikiUrl.searchParams.set('list', 'search');
        wikiUrl.searchParams.set('srsearch', q);
        wikiUrl.searchParams.set('srlimit', '5');
        const wikiRes = await fetch(wikiUrl.toString(), { headers: { 'User-Agent': UA } });
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json() as any;
          for (const r of (wikiData?.query?.search || [])) {
            const piUrl = new URL('https://en.wikipedia.org/w/api.php');
            piUrl.searchParams.set('action', 'query');
            piUrl.searchParams.set('format', 'json');
            piUrl.searchParams.set('prop', 'pageimages');
            piUrl.searchParams.set('piprop', 'original|thumbnail');
            piUrl.searchParams.set('pithumbsize', '300');
            piUrl.searchParams.set('titles', r.title);
            const piRes = await fetch(piUrl.toString(), { headers: { 'User-Agent': UA } });
            if (piRes.ok) {
              const piData = await piRes.json() as any;
              const page = Object.values(piData?.query?.pages || {})[0] as any;
              const url = page?.original?.source || page?.thumbnail?.source;
              if (url && !seen.has(url)) {
                seen.add(url);
                overrides[sticker.id] = { url, position: overrides[sticker.id]?.position || 'center center' };
                results.resolved++;
                results.details.push({ stickerId: sticker.id, name: sticker.name, status: 'resolved', url });
                found = true;
                break;
              }
            }
          }
        }
      } catch (e: any) { console.error('[resolve-generic] Wikipedia search failed:', sticker.name, e.message); }

      // Source 2: Wikimedia Commons if Wikipedia didn't find anything
      if (!found) {
        try {
          const commonsUrl = new URL('https://commons.wikimedia.org/w/api.php');
          commonsUrl.searchParams.set('action', 'query');
          commonsUrl.searchParams.set('format', 'json');
          commonsUrl.searchParams.set('list', 'search');
          commonsUrl.searchParams.set('srsearch', q);
          commonsUrl.searchParams.set('srnamespace', '6');
          commonsUrl.searchParams.set('srlimit', '5');
          const commonsRes = await fetch(commonsUrl.toString(), { headers: { 'User-Agent': UA } });
          if (commonsRes.ok) {
            const commonsData = await commonsRes.json() as any;
            for (const result of (commonsData?.query?.search || [])) {
              const imgUrl = new URL('https://commons.wikimedia.org/w/api.php');
              imgUrl.searchParams.set('action', 'query');
              imgUrl.searchParams.set('format', 'json');
              imgUrl.searchParams.set('prop', 'imageinfo');
              imgUrl.searchParams.set('iiprop', 'url');
              imgUrl.searchParams.set('iiurlwidth', '300');
              imgUrl.searchParams.set('titles', result.title);
              const imgRes = await fetch(imgUrl.toString(), { headers: { 'User-Agent': UA } });
              if (imgRes.ok) {
                const imgData = await imgRes.json() as any;
                const page = Object.values(imgData?.query?.pages || {})[0] as any;
                if (page?.imageinfo?.[0]) {
                  const url = page.imageinfo[0].url;
                  if (!seen.has(url)) {
                    seen.add(url);
                    overrides[sticker.id] = { url, position: overrides[sticker.id]?.position || 'center center' };
                    results.resolved++;
                    results.details.push({ stickerId: sticker.id, name: sticker.name, status: 'resolved_commons', url });
                    found = true;
                    break;
                  }
                }
              }
            }
          }
        } catch (e: any) { console.error('[resolve-generic] Commons search failed:', sticker.name, e.message); }
      }

      if (!found) {
        results.notFound++;
        results.details.push({ stickerId: sticker.id, name: sticker.name, status: 'not_found' });
      }
    }

    saveManualOverrides(overrides);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cache all resolved FIFA photos locally
app.post('/api/admin/cache-fifa-photos', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const cacheDir = path.join(process.cwd(), 'public', 'fifa-cache');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    const overrides = loadManualOverrides();
    const results = { total: 0, cached: 0, skipped: 0, failed: 0, details: [] as any[] };

    for (const [stickerId, ov] of Object.entries(overrides)) {
      if (!ov.url || ov.url.startsWith('/fifa-cache/')) { results.skipped++; results.details.push({ stickerId, status: 'skipped' }); continue; }
      results.total++;
      try {
        const resp = await fetch(ov.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buffer = Buffer.from(await resp.arrayBuffer());
        const ext = 'jpg';
        const localPath = `/fifa-cache/${stickerId}.${ext}`;
        fs.writeFileSync(path.join(cacheDir, `${stickerId}.${ext}`), buffer);
        overrides[stickerId] = { ...ov, url: localPath };
        results.cached++;
        results.details.push({ stickerId, status: 'cached', url: localPath });
      } catch (e: any) {
        results.failed++;
        results.details.push({ stickerId, status: 'error', message: e.message });
      }
    }

    saveManualOverrides(overrides);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Set a manual image override for a sticker (auto-caches to local if remote URL)
app.post('/api/admin/set-image', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { stickerId, imageUrl, position } = req.body;
  if (!stickerId || !imageUrl) return res.status(400).json({ error: 'stickerId and imageUrl required' });

  const overrides = loadManualOverrides();
  if (!imageUrl.startsWith('/fifa-cache/') && !imageUrl.startsWith('http://localhost') && !imageUrl.startsWith('/')) {
    try {
      const cacheDir = path.join(process.cwd(), 'public', 'fifa-cache');
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      const resp = await fetch(imageUrl);
      if (resp.ok) {
        const buffer = Buffer.from(await resp.arrayBuffer());
        const ext = 'jpg';
        const localPath = `/fifa-cache/${stickerId}.${ext}`;
        fs.writeFileSync(path.join(cacheDir, `${stickerId}.${ext}`), buffer);
        overrides[stickerId] = { url: localPath, position: position || 'center center' };
        saveManualOverrides(overrides);
        return res.json({ ok: true, stickerId, imageUrl: localPath, cdnUrl: imageUrl, position: overrides[stickerId].position });
      }
    } catch {}
  }
  overrides[stickerId] = { url: imageUrl, position: position || 'center center' };
  saveManualOverrides(overrides);
  res.json({ ok: true, stickerId, imageUrl, position: overrides[stickerId].position });
});

// Update just the position of a manual image override
app.post('/api/admin/set-image-position', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { stickerId, position } = req.body;
  if (!stickerId || !position) return res.status(400).json({ error: 'stickerId and position required' });

  const overrides = loadManualOverrides();
  if (overrides[stickerId]) {
    overrides[stickerId].position = position;
  } else {
    // No override yet, store position only (will be applied if image is set later)
    overrides[stickerId] = { url: '', position };
  }
  saveManualOverrides(overrides);
  res.json({ ok: true, stickerId, position });
});

// Remove a manual image override
app.post('/api/admin/remove-image', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { stickerId } = req.body;
  if (!stickerId) return res.status(400).json({ error: 'stickerId required' });

  const overrides = loadManualOverrides();
  delete overrides[stickerId];
  saveManualOverrides(overrides);
  res.json({ ok: true, stickerId });
});

// Force-set position on ALL overrides to 50% 20%
app.post('/api/admin/set-all-positions', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { position } = req.body;
  if (!position) return res.status(400).json({ error: 'position required (e.g. "50% 20%")' });
  const overrides = loadManualOverrides();
  let count = 0;
  for (const id of Object.keys(overrides)) {
    overrides[id].position = position;
    count++;
  }
  saveManualOverrides(overrides);
  res.json({ ok: true, count, position });
});

// Upload a photo from the admin's local machine
app.post('/api/admin/upload-image', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { stickerId, image } = req.body;
  if (!stickerId || !image) return res.status(400).json({ error: 'stickerId and image (base64 data-URL) required' });
  const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return res.status(400).json({ error: 'Invalid image format. Expected data:image/...;base64,...' });
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const data = Buffer.from(matches[2], 'base64');
  const uploadDir = path.join(process.cwd(), 'public', 'player-uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const fileName = `${stickerId}.${ext}`;
  fs.writeFileSync(path.join(uploadDir, fileName), data);
  const overrides = loadManualOverrides();
  const url = `/player-uploads/${fileName}`;
  overrides[stickerId] = { url, position: overrides[stickerId]?.position || 'center center' };
  saveManualOverrides(overrides);
  res.json({ ok: true, url });
});

// Get all manual overrides
app.get('/api/admin/image-overrides', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ overrides: loadManualOverrides() });
});

app.get('/api/leaderboard', (req, res) => {
    const top = db.prepare("SELECT id, nickname, level, xp, coins, avatar, COALESCE(favorite_team, country, 'Unknown') as country FROM users ORDER BY xp DESC LIMIT 20").all();
    res.json({ leaderboard: top });
});

// --- Swap / Trade endpoints ---

// Find all possible swap partners for a sticker I need
app.post('/api/swaps/find', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { stickerId } = req.body;
  if (!stickerId) return res.status(400).json({ error: 'stickerId required' });

  const needSticker = db.prepare('SELECT * FROM stickers WHERE id = ?').get(stickerId) as any;
  if (!needSticker) return res.status(404).json({ error: 'Sticker not found' });
  const so = loadManualOverrides()[needSticker.id];
  if (so) { needSticker.image = so.url; needSticker.image_position = so.position || 'center center'; }

  const myCount = db.prepare('SELECT COUNT(*) as c FROM user_stickers WHERE user_id = ? AND sticker_id = ?').get(userId, stickerId) as any;
  if (myCount.c > 0) return res.status(400).json({ error: 'You already own this sticker' });

  const rows = db.prepare(`
    SELECT
      p.id as partner_id, p.nickname, p.country, p.level,
      s.id as give_sticker_id, s.name as give_name, s.rarity as give_rarity,
      s.category as give_category, s.country as give_country,
      us_my.dup_count
    FROM users p
    JOIN user_stickers us_partner_has ON us_partner_has.user_id = p.id AND us_partner_has.sticker_id = ?
    JOIN (
      SELECT sticker_id, COUNT(*) as dup_count
      FROM user_stickers
      WHERE user_id = ?
      GROUP BY sticker_id
      HAVING COUNT(*) >= 2
    ) us_my ON 1=1
    JOIN stickers s ON s.id = us_my.sticker_id
    WHERE p.id != ?
      AND NOT EXISTS (
        SELECT 1 FROM user_stickers us_partner_needs
        WHERE us_partner_needs.user_id = p.id
          AND us_partner_needs.sticker_id = s.id
      )
    ORDER BY p.nickname, s.rarity DESC
  `).all(stickerId, userId, userId);

  const partnerMap = new Map<string, any>();
  for (const row of rows as any[]) {
    if (!partnerMap.has(row.partner_id)) {
      partnerMap.set(row.partner_id, {
        partner: { id: row.partner_id, nickname: row.nickname, country: row.country, level: row.level },
        trades: []
      });
    }
    partnerMap.get(row.partner_id).trades.push({
      giveSticker: {
        id: row.give_sticker_id,
        name: row.give_name,
        rarity: row.give_rarity,
        category: row.give_category,
        country: row.give_country,
      },
      duplicatesCount: row.dup_count
    });
  }

  res.json({ needSticker, options: Array.from(partnerMap.values()) });
});

// Execute a swap between two users
app.post('/api/swaps/execute', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { partnerUserId, myNeedStickerId, iGiveStickerId } = req.body;
  if (!partnerUserId || !myNeedStickerId || !iGiveStickerId) {
    return res.status(400).json({ error: 'Missing parameters: partnerUserId, myNeedStickerId, iGiveStickerId' });
  }

  // Verify I have a duplicate of iGiveStickerId
  const myGiveCount = db.prepare('SELECT COUNT(*) as c FROM user_stickers WHERE user_id = ? AND sticker_id = ?').get(userId, iGiveStickerId) as any;
  if (myGiveCount.c < 2) return res.status(400).json({ error: "You don't have a duplicate of this sticker to trade" });

  // Verify partner has myNeedStickerId
  const partnerHasNeed = db.prepare('SELECT COUNT(*) as c FROM user_stickers WHERE user_id = ? AND sticker_id = ?').get(partnerUserId, myNeedStickerId) as any;
  if (partnerHasNeed.c < 1) return res.status(400).json({ error: 'Partner does not have this sticker' });

  // Verify partner doesn't already have iGiveStickerId
  const partnerHasGive = db.prepare('SELECT COUNT(*) as c FROM user_stickers WHERE user_id = ? AND sticker_id = ?').get(partnerUserId, iGiveStickerId) as any;
  if (partnerHasGive.c > 0) return res.status(400).json({ error: 'Partner already has this sticker' });

  db.transaction(() => {
    // I give one of my duplicate rows to partner
    const myGiveRow = db.prepare('SELECT id FROM user_stickers WHERE user_id = ? AND sticker_id = ? LIMIT 1').get(userId, iGiveStickerId) as any;
    db.prepare('DELETE FROM user_stickers WHERE id = ?').run(myGiveRow.id);
    const partnerNewId = Math.random().toString(36).substring(2, 11);
    db.prepare('INSERT INTO user_stickers (id, user_id, sticker_id, created_at) VALUES (?, ?, ?, ?)').run(partnerNewId, partnerUserId, iGiveStickerId, new Date().toISOString());

    // Partner gives me the sticker I need
    const partnerNeedRow = db.prepare('SELECT id FROM user_stickers WHERE user_id = ? AND sticker_id = ? LIMIT 1').get(partnerUserId, myNeedStickerId) as any;
    db.prepare('DELETE FROM user_stickers WHERE id = ?').run(partnerNeedRow.id);
    const myNewId = Math.random().toString(36).substring(2, 11);
    db.prepare('INSERT INTO user_stickers (id, user_id, sticker_id, created_at) VALUES (?, ?, ?, ?)').run(myNewId, userId, myNeedStickerId, new Date().toISOString());
  })();

  res.json({ success: true });
});

// --- Tournament Simulation endpoints ---

app.get('/api/tournament/state', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const state = getOrInitTournament(userId);
  let advancing: string[] = [];
  let thirdPlace: any[] = [];
  if (state.currentRound === 'group' || state.currentRound === 'r32_ready') {
    const result = getAdvancingTeams(state.groups);
    advancing = result.advancing;
    thirdPlace = result.thirdPlaceAll;
  }
  const allMatches = state.matches;
  let knockoutMatches: Record<string, { round: string; name: string; matches: TourMatch[] }> = {};
  if (state.currentRound !== 'group') {
    for (const r of [{ key: 'r32', name: 'Round of 32' }, { key: 'r16', name: 'Round of 16' }, { key: 'qf', name: 'Quarter-Finals' }, { key: 'sf', name: 'Semi-Finals' }, { key: 'final', name: 'Final' }]) {
      const ms = allMatches.filter(m => m.round === r.key);
      if (ms.length > 0) knockoutMatches[r.key] = { round: r.key, name: r.name, matches: ms };
    }
  }
  const roundNames: Record<string, string> = {
    group: 'Group Stage', r32_ready: 'Groups Complete',
    sf_ready: 'Knockout Part 1 Complete',
    completed: 'Tournament Complete'
  };
  const simulationPhase = state.currentRound === 'group' ? 'groups' :
    state.currentRound === 'r32_ready' ? 'knockout1' :
    state.currentRound === 'sf_ready' ? 'knockout2' : 'complete';
  res.json({
    currentRound: state.currentRound, roundName: roundNames[state.currentRound] || state.currentRound,
    groups: state.groups, matches: allMatches, knockoutMatches,
    advancing, thirdPlace, winner: state.winner, eliminatedTeams: state.eliminatedTeams,
    simulationPhase, regenerationsUsed: state.regenerationsUsed || 0
  });
});

app.post('/api/tournament/simulate-next', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  let state = getOrInitTournament(userId);
  if (state.currentRound === 'completed') return res.status(400).json({ error: 'Tournament already complete' });

  function playRoundsAndGenerate(rounds: string[], finalRound: string): string | null {
    let champion: string | null = null;
    for (let ri = 0; ri < rounds.length; ri++) {
      const r = rounds[ri];
      const roundMatches = state.matches.filter(m => m.round === r && !m.played);
      if (roundMatches.length === 0) continue;
      const result = playKnockoutRound(roundMatches, r);
      state.eliminatedTeams.push(...roundMatches.map(m => m.teamA !== result.winners.find((w: string) => w === m.teamA) ? m.teamA : m.teamB));
      const nextRound = ri < rounds.length - 1 ? rounds[ri + 1] : finalRound;
      if (nextRound) {
        const nextMatches: TourMatch[] = [];
        for (let i = 0; i < result.winners.length; i += 2) {
          nextMatches.push({ id: `ko-${nextRound}-${i / 2}`, round: nextRound, matchNumber: i / 2, teamA: result.winners[i], teamB: result.winners[i + 1], scoreA: null, scoreB: null, played: 0 });
        }
        state.matches.push(...nextMatches);
      } else {
        champion = result.winners[0];
      }
    }
    return champion;
  }

  if (state.currentRound === 'group') {
    const played = playGroupMatches(state.groups, state.matches);
    state.groups = played.groups; state.matches = played.matches;
    const adv = getAdvancingTeams(state.groups);
    state.advancingTeams = adv.advancing;
    state.roundOf32Pairings = createKnockoutPairings(adv.advancing);
    state.matches.push(...state.roundOf32Pairings);
    state.currentRound = 'r32_ready';
    state.eliminatedTeams = allCountries.filter(c => !adv.advancing.includes(c));
    saveTournament(state, userId);
    return res.json({ phase: 'groups', currentRound: 'r32_ready', groups: state.groups, advancing: adv.advancing });
  }

  if (state.currentRound === 'r32_ready') {
    playRoundsAndGenerate(['r32', 'r16', 'qf'], 'sf');
    state.currentRound = 'sf_ready';
    saveTournament(state, userId);
    return res.json({ phase: 'r32_r16_qf', currentRound: 'sf_ready' });
  }

  if (state.currentRound === 'sf_ready') {
    const champion = playRoundsAndGenerate(['sf', 'final'], '');
    state.currentRound = 'completed';
    state.winner = champion;
    saveTournament(state, userId);
    if (champion) {
      db.prepare("UPDATE users SET simulation_winner = ? WHERE id = ?").run(champion, userId);
    }
    return res.json({ phase: 'sf_final', currentRound: 'completed', winner: champion });
  }

  return res.status(400).json({ error: 'Unknown tournament state' });
});

app.post('/api/tournament/reset', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const p = getTournamentPath(userId);
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  db.prepare("UPDATE users SET simulation_winner = NULL WHERE id = ?").run(userId);
  res.json({ ok: true });
});

app.post('/api/tournament/regenerate', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    let state = getOrInitTournament(userId);
    if (state.currentRound !== 'completed') return res.status(400).json({ error: 'Tournament must be complete to regenerate' });
    const used = state.regenerationsUsed || 0;
    if (used >= 3) return res.status(400).json({ error: 'Maximum 3 regenerations reached' });

    // Full re-simulate: init fresh, run all steps
    state = initTournament(userId);
    state.regenerationsUsed = used + 1;

    // Step 1: Group stage
    const played = playGroupMatches(state.groups, state.matches);
    state.groups = played.groups; state.matches = played.matches;
    const adv = getAdvancingTeams(state.groups);
    state.advancingTeams = adv.advancing;
    state.roundOf32Pairings = createKnockoutPairings(adv.advancing);
    state.matches.push(...state.roundOf32Pairings);
    state.eliminatedTeams = allCountries.filter(c => !adv.advancing.includes(c));

    // Step 2: R32 → R16 → QF
    function playRoundsAndGenerate(rounds: string[], finalRound: string): string | null {
      let champion: string | null = null;
      for (let ri = 0; ri < rounds.length; ri++) {
        const r = rounds[ri];
        const roundMatches = state.matches.filter(m => m.round === r && !m.played);
        if (roundMatches.length === 0) continue;
        const result = playKnockoutRound(roundMatches, r);
        state.eliminatedTeams.push(...roundMatches.map(m => m.teamA !== result.winners.find((w: string) => w === m.teamA) ? m.teamA : m.teamB));
        const nextRound = ri < rounds.length - 1 ? rounds[ri + 1] : finalRound;
        if (nextRound) {
          const nextMatches: TourMatch[] = [];
          for (let i = 0; i < result.winners.length; i += 2) {
            nextMatches.push({ id: `ko-${nextRound}-${i / 2}`, round: nextRound, matchNumber: i / 2, teamA: result.winners[i], teamB: result.winners[i + 1], scoreA: null, scoreB: null, played: 0 });
          }
          state.matches.push(...nextMatches);
        } else {
          champion = result.winners[0];
        }
      }
      return champion;
    }
    playRoundsAndGenerate(['r32', 'r16', 'qf'], 'sf');

    // Step 3: SF → Final
    const champion = playRoundsAndGenerate(['sf', 'final'], '');
    state.currentRound = 'completed';
    state.winner = champion;
    saveTournament(state, userId);
    if (champion) {
      db.prepare("UPDATE users SET simulation_winner = ? WHERE id = ?").run(champion, userId);
    }

    res.json({ winner: champion, regenerationsUsed: state.regenerationsUsed, remaining: 3 - state.regenerationsUsed });
  } catch (e: any) {
    console.error('Regenerate error:', e);
    res.status(500).json({ error: e?.message || 'Unknown error during regeneration' });
  }
});

app.get('/api/tournament/predictions', (req, res) => {
  const predictions = db.prepare("SELECT predicted_winner, COUNT(*) as count FROM users WHERE predicted_winner IS NOT NULL AND predicted_winner != '' GROUP BY predicted_winner ORDER BY count DESC").all();
  const total = (db.prepare("SELECT COUNT(*) as c FROM users WHERE predicted_winner IS NOT NULL AND predicted_winner != ''").get() as any)?.c || 0;
  res.json({ predictions, total });
});

// Global champion: aggregated from all user simulation results
app.get('/api/tournament/global-champion', (req, res) => {
  const rankings = db.prepare("SELECT simulation_winner as team, COUNT(*) as count FROM users WHERE simulation_winner IS NOT NULL AND simulation_winner != '' GROUP BY simulation_winner ORDER BY count DESC").all();
  const total = (db.prepare("SELECT COUNT(*) as c FROM users WHERE simulation_winner IS NOT NULL AND simulation_winner != ''").get() as any)?.c || 0;
  res.json({ rankings, total });
});

// --- Badge endpoints ---

app.post('/api/badges/claim', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const user = db.prepare('SELECT predicted_winner FROM users WHERE id = ?').get(userId) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.predicted_winner) return res.status(400).json({ error: 'You did not make a prediction' });

  db.exec("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)");
  const realWinnerRow = db.prepare("SELECT value FROM app_settings WHERE key = 'real_winner'").get() as any;
  const realWinner = realWinnerRow?.value;
  if (!realWinner) return res.status(400).json({ error: 'The real winner has not been set yet by admin' });
  if (user.predicted_winner !== realWinner) return res.status(400).json({ error: `Your prediction does not match the actual winner` });

  const existing = db.prepare('SELECT * FROM user_badges WHERE user_id = ? AND badge_id = ?').get(userId, 'ultimate_champion');
  if (existing) return res.json({ badge: { id: 'ultimate_champion', name: 'Ultimate Champion' }, alreadyOwned: true });

  db.prepare('INSERT INTO user_badges (user_id, badge_id, awarded_at) VALUES (?, ?, ?)').run(userId, 'ultimate_champion', new Date().toISOString());

  // Unlock all stickers for this user
  const allStickers = db.prepare('SELECT id FROM stickers').all() as { id: string }[];
  const userHas = db.prepare('SELECT DISTINCT sticker_id FROM user_stickers WHERE user_id = ?').all(userId) as { sticker_id: string }[];
  const hasSet = new Set(userHas.map(h => h.sticker_id));
  const now = new Date().toISOString();
  const insertUs = db.prepare('INSERT OR IGNORE INTO user_stickers (id, user_id, sticker_id, created_at) VALUES (?, ?, ?, ?)');
  for (const s of allStickers) if (!hasSet.has(s.id)) insertUs.run(Math.random().toString(36).substring(2, 11), userId, s.id, now);

  res.json({ badge: { id: 'ultimate_champion', name: 'Ultimate Champion' }, alreadyOwned: false });
});

app.get('/api/badges', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const badges = db.prepare(`SELECT b.id, b.name, b.description, ub.awarded_at FROM badges b LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = ? ORDER BY b.id`).all(userId);
  res.json({ badges });
});

app.post('/api/admin/set-winner', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { team } = req.body;
  if (!team) return res.status(400).json({ error: 'team required' });
  db.exec("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)");
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run('real_winner', team);
  console.log(`[admin] Real winner set to: ${team}`);
  res.json({ ok: true, winner: team });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

// Vercel SPA catch-all (production only)
if (process.env.VERCEL) {
  const distPath = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

export default app;
