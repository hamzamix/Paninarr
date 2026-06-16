import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Swords, RefreshCw, Sparkles, Crown, BarChart3, Goal } from 'lucide-react';
import { toast } from 'sonner';

type TourMatch = { id: string; round: string; groupName?: string; matchNumber: number; teamA: string; teamB: string; scoreA: number | null; scoreB: number | null; played: number; goalsA?: { player: string; minute: number }[]; goalsB?: { player: string; minute: number }[]; };
type GroupStanding = { team: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; pts: number; };
type TourGroup = { name: string; teams: GroupStanding[]; };

const TEAM_FLAG_COLORS: Record<string, string[]> = {
  'United States': ['#3C3B6E', '#FFFFFF', '#B22234'], 'Mexico': ['#006847', '#FFFFFF', '#C8102E'],
  'Canada': ['#FF0000', '#FFFFFF', '#FF0000'], 'Argentina': ['#75AADB', '#FFFFFF', '#75AADB'],
  'Brazil': ['#009739', '#FEDF00', '#002776'], 'France': ['#002395', '#FFFFFF', '#ED2939'],
  'England': ['#FFFFFF', '#CE1124', '#FFFFFF'], 'Spain': ['#C11B17', '#FBBF24', '#C11B17'],
  'Portugal': ['#046A38', '#DA291C'], 'Germany': ['#000000', '#FF0000', '#FFCC00'],
  'Netherlands': ['#AE1C28', '#FFFFFF', '#21468B', '#F17300'], 'Norway': ['#BA0C2F', '#FFFFFF', '#003087'],
  'Belgium': ['#000000', '#FDDA24', '#EF3340'], 'Uruguay': ['#0038A8', '#FFFFFF', '#FCD116'],
  'Colombia': ['#FCD116', '#0038A8', '#CE1124'], 'Morocco': ['#C1272D', '#006233', '#C1272D'],
  'Senegal': ['#00853F', '#FDEF42', '#E31B23'], 'Japan': ['#FFFFFF', '#BC002D', '#FFFFFF'],
  'South Korea': ['#FFFFFF', '#CD2E3A', '#0047A0'], 'Australia': ['#012169', '#FF0000', '#FFFFFF', '#00843D', '#FFCD00'],
  'Croatia': ['#FF0000', '#FFFFFF', '#171796'], 'Switzerland': ['#D52B1E', '#FFFFFF', '#D52B1E'],
  'Sweden': ['#006AA7', '#FECC00'], 'Austria': ['#ED2939', '#FFFFFF', '#ED2939'],
  'Türkiye': ['#E30A17', '#FFFFFF'], 'Scotland': ['#005EB8', '#FFFFFF'],
  'Ecuador': ['#FFD100', '#003F87', '#EF3340'], 'Paraguay': ['#D52B1E', '#FFFFFF', '#0038A8'],
  'Algeria': ['#006633', '#FFFFFF', '#D21034'], 'Egypt': ['#C8102E', '#FFFFFF', '#000000'],
  'Ivory Coast': ['#F77F00', '#FFFFFF', '#009E60'], 'Ghana': ['#CE1124', '#FCD116', '#006B3F'],
  'Saudi Arabia': ['#006C35', '#FFFFFF'], 'Iran': ['#239F40', '#FFFFFF', '#DA121A'],
  'New Zealand': ['#000000', '#FFFFFF', '#C8102E'], 'Bosnia and Herzegovina': ['#001F3F', '#FECB00', '#FFFFFF'],
  'Cabo Verde': ['#003893', '#FFFFFF', '#CF2027', '#F7D116'], 'Curaçao': ['#002B7F', '#FFFFFF', '#FED141'],
  'Czechia': ['#11457E', '#FFFFFF', '#D7141A'], 'DR Congo': ['#007FFF', '#CE1126', '#F7D618'],
  'Haiti': ['#00209F', '#D21034', '#FFFFFF'], 'Iraq': ['#CE1126', '#FFFFFF', '#007A3D'],
  'Jordan': ['#CE1126', '#FFFFFF', '#007A3D', '#000000'], 'Panama': ['#FFFFFF', '#CE1126', '#005294'],
  'Qatar': ['#8C1B1B', '#FFFFFF'], 'South Africa': ['#DE3831', '#FFFFFF', '#002395', '#FFB81C', '#007A4D'],
  'Tunisia': ['#E70013', '#FFFFFF'], 'Uzbekistan': ['#0099B5', '#FFFFFF', '#1EB53A', '#CE1126'],
};

function FlagColors({ team, className = '' }: { team: string; className?: string }) {
  const colors = TEAM_FLAG_COLORS[team] || ['#10B981', '#6366F1'];
  return (
    <div className={`flex overflow-hidden rounded-sm ${className}`}>
      {colors.map((c, i) => <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />)}
    </div>
  );
}

const MATCH_NUM_OFFSET: Record<string, number> = { r32: 73, r16: 89, qf: 97, sf: 101, final: 104 };
const ROUND_DATES: Record<string, string[]> = {
  r32: ['2026.06.28','2026.06.29','2026.06.30','2026.07.01'],
  r16: ['2026.07.04','2026.07.05'],
  qf: ['2026.07.09','2026.07.10'],
  sf: ['2026.07.14','2026.07.15'],
  final: ['2026.07.19'],
};
const ROUND_CITIES: Record<string, string[]> = {
  r32: ['Los Angeles','Houston','Dallas','Boston','Monterrey','Toronto','Atlanta','Vancouver','New York/New Jersey','Philadelphia','Miami','Mexico City','San Francisco','Seattle','Kansas City','Chicago'],
  r16: ['Philadelphia','Houston','Atlanta','Mexico City'],
  qf: ['Boston','Los Angeles','Dallas','Miami'],
  sf: ['Dallas','Kansas City'],
  final: ['New York/New Jersey'],
};

const CW = 1780;
const PITCH = 104;
const TOP = 80;
const BOX_H = 82;
const COL_W: Record<string, number> = { r32: 186, r16: 168, qf: 158, sf: 150, final: 180 };
const LEFT_X: Record<string, number> = { r32: 24, r16: 250, qf: 452, sf: 638 };
const rightX = (r: string) => CW - LEFT_X[r] - COL_W[r];
const FINAL_X = (CW - COL_W.final) / 2;
const LABEL_Y = 28;
const ROUND_LABELS_DATA = [
  { label: 'R32+', x: LEFT_X.r32 + COL_W.r32 / 2 },
  { label: 'R16', x: LEFT_X.r16 + COL_W.r16 / 2 },
  { label: 'QF', x: LEFT_X.qf + COL_W.qf / 2 },
  { label: 'SF', x: LEFT_X.sf + COL_W.sf / 2 },
  { label: 'FINAL', x: FINAL_X + COL_W.final / 2, isFinal: true },
  { label: 'SF', x: rightX('sf') + COL_W.sf / 2 },
  { label: 'QF', x: rightX('qf') + COL_W.qf / 2 },
  { label: 'R16', x: rightX('r16') + COL_W.r16 / 2 },
  { label: 'R32+', x: rightX('r32') + COL_W.r32 / 2 },
];

function getTeamCode(team: string): string {
  const map: Record<string, string> = {
    'United States':'USA','South Korea':'KOR','Bosnia and Herzegovina':'BIH',
    'Ivory Coast':'CIV','Cabo Verde':'CPV','Curaçao':'CUW','DR Congo':'COD',
    'New Zealand':'NZL','Saudi Arabia':'KSA','South Africa':'RSA','Türkiye':'TUR',
  };
  return map[team] || team.slice(0, 3).toUpperCase();
}

function getMatchDisplayNum(round: string, matchNumber: number): string {
  const offset = MATCH_NUM_OFFSET[round] ?? 73;
  return `M${offset + matchNumber}`;
}

function getMatchDate(round: string, matchNumber: number): string {
  const dates = ROUND_DATES[round] || ['2026.06.28'];
  return dates[Math.floor(matchNumber / (round === 'r32' ? 4 : round === 'r16' ? 2 : 1))] || dates[0];
}

function getMatchCity(round: string, matchNumber: number): string {
  const cities = ROUND_CITIES[round] || ['Dallas'];
  return cities[matchNumber % cities.length] || cities[0];
}

export default function Simulation() {
  const { user } = useAuth();
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [activeRound, setActiveRound] = useState<string>('group');
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupModalTab, setGroupModalTab] = useState<'matches' | 'goals'>('matches');
  const [predictions, setPredictions] = useState<{ predictions: { predicted_winner: string; count: number }[]; total: number } | null>(null);
  const [globalChampion, setGlobalChampion] = useState<{ rankings: { team: string; count: number }[]; total: number } | null>(null);
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(() => {
    const saved = localStorage.getItem('sim_zoom');
    const parsed = saved ? parseFloat(saved) : 0.8;
    return isNaN(parsed) ? 0.8 : Math.max(0.3, Math.min(3, parsed));
  });
  const fitboxRef = useRef<HTMLDivElement>(null);
  const [fitboxW, setFitboxW] = useState(900);
  const cleanupRef = useRef<(() => void) | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const bracketCallbackRef = useCallback((el: HTMLDivElement | null) => {
    viewportRef.current = el;
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoomLevel(z => Math.max(0.3, Math.min(3, +(z - e.deltaY * 0.001).toFixed(2))));
    };
    el.addEventListener('wheel', handler, { passive: false });
    cleanupRef.current = () => el.removeEventListener('wheel', handler);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = viewportRef.current;
    if (!el) return;
    dragRef.current = { isDragging: true, startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag.isDragging) return;
      const el = viewportRef.current;
      if (!el) return;
      e.preventDefault();
      el.scrollLeft = drag.scrollLeft - (e.clientX - drag.startX);
      el.scrollTop = drag.scrollTop - (e.clientY - drag.startY);
    };
    const handleMouseUp = () => { dragRef.current.isDragging = false; };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, []);

  useEffect(() => {
    const el = fitboxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => { for (const e of entries) setFitboxW(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem('sim_zoom', String(zoomLevel));
  }, [zoomLevel]);

  const loadState = () => {
    if (!user?.id) return;
    setLoading(true);
    api.get('/tournament/state', user.id)
      .then(data => {
        setState(data);
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadState(); fetchPredictions(); fetchGlobalChampion(); }, [user?.id]);

  const fetchPredictions = () => {
    if (!user?.id) return;
    api.get('/tournament/predictions', user.id)
      .then(data => setPredictions(data))
      .catch(() => {});
  };

  const fetchGlobalChampion = () => {
    if (!user?.id) return;
    api.get('/tournament/global-champion', user.id)
      .then(data => setGlobalChampion(data))
      .catch(() => {});
  };

  const simulateNext = async () => {
    if (!user?.id) return;
    setSimulating(true);
    try {
      const data = await api.post('/tournament/simulate-next', {}, user.id);
      if (data.winner) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 5000); }
      await loadState();
      fetchPredictions();
      const msgs: Record<string, string> = { groups: 'Group Stage complete!', r32_r16_qf: 'R32 → QF complete!', sf_final: 'Semi-Finals → Final complete!' };
      toast.success(msgs[data.phase] || 'Round complete!');
    } catch (err: any) { toast.error(err.message); } finally { setSimulating(false); }
  };

  const handleReset = async () => {
    if (!user?.id) return;
    setSimulating(true);
    try {
      await api.post('/tournament/reset', {}, user.id);
      await loadState();
      toast.success('Tournament reset');
    } catch (err: any) { toast.error(err.message); } finally { setSimulating(false); }
  };

  const handleRegenerate = async () => {
    if (!user?.id) return;
    setSimulating(true);
    try {
      const data = await api.post('/tournament/regenerate', {}, user.id);
      await loadState();
      setShowConfetti(true); setTimeout(() => setShowConfetti(false), 5000);
      toast.success(`Regenerated! ${data.remaining} remaining`);
    } catch (err: any) { toast.error(err.message); } finally { setSimulating(false); }
  };

  const geometry = useMemo(() => {
    if (!state?.matches) return { geom: {} as Record<string, any>, connectors: [] as any[], canvasH: 600 };
    const ko = state.matches.filter((m: TourMatch) => m.round !== 'group');
    const byRound: Record<string, TourMatch[]> = {};
    for (const m of ko) { if (!byRound[m.round]) byRound[m.round] = []; byRound[m.round].push(m); }
    for (const r of Object.keys(byRound)) byRound[r].sort((a: TourMatch, b: TourMatch) => a.matchNumber - b.matchNumber);

    const geom: Record<string, { x: number; y: number; cy: number; w: number; h: number; side: string }> = {};

    const r32 = byRound.r32 || [];
    r32.forEach((m: TourMatch, i: number) => {
      const side = i < 8 ? 'left' : 'right';
      const idx = side === 'left' ? i : i - 8;
      const y = TOP + idx * PITCH;
      geom[m.id] = { x: side === 'left' ? LEFT_X.r32 : rightX('r32'), y, cy: y + BOX_H / 2, w: COL_W.r32, h: BOX_H, side };
    });

    const r16 = byRound.r16 || [];
    r16.forEach((m: TourMatch, i: number) => {
      const side = i < 4 ? 'left' : 'right';
      const f1 = r32[2 * i], f2 = r32[2 * i + 1];
      if (!f1 || !f2 || !geom[f1.id] || !geom[f2.id]) return;
      const cy = (geom[f1.id].cy + geom[f2.id].cy) / 2;
      geom[m.id] = { x: side === 'left' ? LEFT_X.r16 : rightX('r16'), y: cy - BOX_H / 2, cy, w: COL_W.r16, h: BOX_H, side };
    });

    const qf = byRound.qf || [];
    qf.forEach((m: TourMatch, i: number) => {
      const side = i < 2 ? 'left' : 'right';
      const f1 = r16[2 * i], f2 = r16[2 * i + 1];
      if (!f1 || !f2 || !geom[f1.id] || !geom[f2.id]) return;
      const cy = (geom[f1.id].cy + geom[f2.id].cy) / 2;
      geom[m.id] = { x: side === 'left' ? LEFT_X.qf : rightX('qf'), y: cy - BOX_H / 2, cy, w: COL_W.qf, h: BOX_H, side };
    });

    const sf = byRound.sf || [];
    sf.forEach((m: TourMatch, i: number) => {
      const side = i === 0 ? 'left' : 'right';
      const f1 = qf[2 * i], f2 = qf[2 * i + 1];
      if (!f1 || !f2 || !geom[f1.id] || !geom[f2.id]) return;
      const cy = (geom[f1.id].cy + geom[f2.id].cy) / 2;
      geom[m.id] = { x: side === 'left' ? LEFT_X.sf : rightX('sf'), y: cy - BOX_H / 2, cy, w: COL_W.sf, h: BOX_H, side };
    });

    const finalArr = byRound.final || [];
    if (finalArr[0] && sf[0] && sf[1] && geom[sf[0].id] && geom[sf[1].id]) {
      const cy = (geom[sf[0].id].cy + geom[sf[1].id].cy) / 2;
      geom[finalArr[0].id] = { x: FINAL_X, y: cy - BOX_H / 2, cy, w: COL_W.final, h: BOX_H, side: 'center' };
    }

    const connectors: { from: string; to: string; path: string }[] = [];
    const rounds = ['r32', 'r16', 'qf', 'sf'] as const;
    for (let ri = 0; ri < rounds.length; ri++) {
      const round = rounds[ri];
      const nextRound = ri < rounds.length - 1 ? rounds[ri + 1] : 'final';
      const ms = byRound[round] || [];
      const nms = byRound[nextRound] || [];
      ms.forEach((m: TourMatch, i: number) => {
        const parent = nms[Math.floor(i / 2)];
        if (!parent || !geom[m.id] || !geom[parent.id]) return;
        const g = geom[m.id], pg = geom[parent.id];
        let cx: number, px: number;
        if (g.side === 'left' || g.side === 'center') { cx = g.x + g.w; px = pg.x; }
        else { cx = g.x; px = pg.x + pg.w; }
        const mx = (cx + px) / 2;
        connectors.push({ from: m.id, to: parent.id, path: `M ${cx} ${g.cy} C ${mx} ${g.cy} ${mx} ${pg.cy} ${px} ${pg.cy}` });
      });
    }

    const maxBottom = Math.max(...Object.values(geom).map(g => g.y + g.h), TOP + 8 * PITCH + BOX_H);
    return { geom, connectors, canvasH: maxBottom + 40 };
  }, [state]);

  const teamPath = useMemo(() => {
    if (!hoveredTeam || !state?.matches) return { matches: new Set<string>(), connectors: new Set<number>() };
    const matchIds = new Set<string>();
    const rounds = ['r32', 'r16', 'qf', 'sf', 'final'];
    for (const round of rounds) {
      const m = state.matches.find((m: TourMatch) => m.round === round && !matchIds.has(m.id) && (m.teamA === hoveredTeam || m.teamB === hoveredTeam));
      if (m) matchIds.add(m.id);
    }
    const connIdx = new Set<number>();
    geometry.connectors.forEach((c, i) => { if (matchIds.has(c.from) && matchIds.has(c.to)) connIdx.add(i); });
    return { matches: matchIds, connectors: connIdx };
  }, [hoveredTeam, state?.matches, geometry]);

  const canSimulate = state && state.currentRound !== 'completed';
  const phaseSimulateLabel: Record<string, string> = { groups: 'Simulate Group Stage', knockout1: 'Simulate R32 → QF', knockout2: 'Simulate SF → Final' };
  const simulateLabel = state ? (phaseSimulateLabel[state.simulationPhase] || 'Simulate Next') : '';
  const bracketHasRound = state?.knockoutMatches && Object.keys(state.knockoutMatches).length > 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 space-y-4 animate-pulse">
        <Swords className="h-12 w-12 text-emerald-500 animate-bounce" />
        <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">Setting up the tournament...</p>
      </div>
    );
  }

  const roundTabs = [
    { key: 'group', label: 'Groups' },
    { key: 'knockout', label: 'Knockout' },
    { key: 'global', label: 'Global' },
  ];

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl p-4 bg-slate-900/50 border border-white/5 flex-shrink-0">
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 30 }).map((_, i) => (
              <motion.div key={i} className="absolute h-2 w-2 rounded-full"
                style={{ backgroundColor: ['#5b8cff','#ffc857','#34e2a4','#ff5d8f','#6366F1'][i % 5], left: `${Math.random()*100}%` }}
                initial={{ y: -20, opacity: 1 }} animate={{ y: 400, opacity: 0 }}
                transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 0.5, ease: 'easeIn' }} />
            ))}
          </div>
        )}
        <div className="relative z-10 flex flex-col gap-1.5">
          {/* Line 1 */}
          <div className="flex items-center">
            <div className="flex-[3]">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-1.5">
                <Swords className="h-3.5 w-3.5" /> Tournament Simulation
              </span>
            </div>
              <div className="flex-[4] flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
               <span>Current: <span className="text-indigo-400 font-bold">{state?.roundName || 'Loading...'}</span></span>
               {predictions && predictions.total > 0 && predictions.predictions[0] && (
                 <span>· Community: <span className="text-indigo-400 font-bold">{predictions.predictions[0].predicted_winner}</span> ({predictions.predictions[0].count}/{predictions.total})</span>
               )}
            </div>
            <div className="flex-[3]" />
          </div>
          {/* Line 2 */}
          <div className="flex items-center">
            <div className="flex-[3]">
              <h1 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-tight" style={{ fontFamily: 'system-ui, sans-serif' }}>World Cup 2026</h1>
            </div>
            <div className="flex-[4] flex items-center justify-center gap-2">
              {/* Round Tabs */}
              <div className="flex items-center gap-0.5 bg-slate-800 p-0.5 rounded-lg border border-white/5">
                {roundTabs.map((tab) => {
                  const isActive = activeRound === tab.key;
                  const hasContent = tab.key === 'group' || (tab.key === 'knockout' && bracketHasRound);
                  return (
                    <button key={tab.key} type="button"
                      onClick={() => { if (tab.key !== 'group' && !hasContent) return; setActiveRound(tab.key); }}
                      className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all whitespace-nowrap ${
                        isActive ? 'bg-indigo-500 text-white' : hasContent ? 'text-slate-400 hover:text-white' : 'text-slate-700 cursor-not-allowed'}`}>
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-1.5">
                {canSimulate && (
                  <Button onClick={simulateNext} disabled={simulating}
                    className="bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-black rounded-xl uppercase tracking-wider px-4 py-1.5 h-auto shadow-lg disabled:opacity-50 text-[10px]">
                    {simulating ? <RefreshCw className="h-3 w-3 animate-spin mr-1.5" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
                    {simulating ? 'Simulating...' : simulateLabel}
                  </Button>
                )}
                {!canSimulate && state?.currentRound === 'completed' && (state.regenerationsUsed || 0) < 3 && (
                  <Button onClick={handleRegenerate} disabled={simulating}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl uppercase tracking-wider px-4 py-1.5 h-auto shadow-lg disabled:opacity-50 text-[10px]">
                    {simulating ? <RefreshCw className="h-3 w-3 animate-spin mr-1.5" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
                    {simulating ? 'Regenerating...' : `Regenerate (${3 - (state.regenerationsUsed || 0)})`}
                  </Button>
                )}
                {state?.currentRound && state.currentRound !== 'group' && (
                  <button onClick={handleReset} disabled={simulating}
                    className="text-[9px] text-slate-600 hover:text-white font-mono uppercase tracking-wider transition-colors">
                    reset
                  </button>
                )}
              </div>
            </div>
            {/* Winner badge */}
            {state?.winner ? (
              <div className="flex-[3] flex items-center justify-end gap-2">
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400/60">Champion</p>
                  <p className="text-sm font-black text-amber-400">{state.winner}</p>
                </div>
                <Crown className="h-6 w-6 text-amber-400" />
              </div>
            ) : <div className="flex-[3]" />}
          </div>
        </div>
      </header>

      {/* Group Stage View */}
      {activeRound === 'group' && state?.groups && (
        <div className="overflow-y-auto flex-1 min-h-0 px-4 md:px-0">
          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
          {state.groups.map((group: TourGroup) => {
            const sorted = [...group.teams].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team));
            const advancing = state.advancing || [];
            const topTwo = sorted.slice(0, 2).map(t => t.team);
            return (
              <Card key={group.name} className="bg-slate-900 border border-white/5 rounded-xl overflow-hidden cursor-pointer hover:border-emerald-500/30 transition-all" onClick={() => setSelectedGroup(group.name)}>
                <div className="bg-slate-900/80 px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
                  <span className="font-black text-xs text-white uppercase tracking-wider">Group {group.name}</span>
                </div>
                <CardContent className="p-0">
                  <table className="w-full text-[10px] font-mono">
                    <thead><tr className="text-slate-500 text-[8px] uppercase tracking-wider border-b border-white/5">
                      <th className="text-left py-1.5 px-2 font-bold">Team</th>
                      <th className="py-1.5 px-0.5 font-bold">P</th><th className="py-1.5 px-0.5 font-bold">W</th>
                      <th className="py-1.5 px-0.5 font-bold">D</th><th className="py-1.5 px-0.5 font-bold">L</th>
                      <th className="py-1.5 px-0.5 font-bold">GF</th><th className="py-1.5 px-0.5 font-bold">GA</th>
                      <th className="py-1.5 px-0.5 font-bold">GD</th><th className="py-1.5 px-1 font-bold">Pts</th>
                    </tr></thead>
                    <tbody>
                      {sorted.map((t) => {
                        const isAdv = topTwo.includes(t.team);
                        return (
                          <tr key={t.team} className={`border-b border-white/5 last:border-0 ${isAdv ? 'bg-emerald-500/5' : ''}`}>
                            <td className="py-1.5 px-2 flex items-center gap-1">
                              <FlagColors team={t.team} className="h-2 w-3 flex-shrink-0" />
                              <span className={`font-bold truncate max-w-[70px] ${isAdv ? 'text-emerald-400' : 'text-slate-400'}`}>{t.team}</span>
                              {isAdv && <Trophy className="h-2 w-2 text-emerald-400 flex-shrink-0" />}
                            </td>
                            <td className="py-1.5 px-0.5 text-center text-slate-400">{t.played}</td>
                            <td className="py-1.5 px-0.5 text-center text-slate-400">{t.won}</td>
                            <td className="py-1.5 px-0.5 text-center text-slate-400">{t.drawn}</td>
                            <td className="py-1.5 px-0.5 text-center text-slate-400">{t.lost}</td>
                            <td className="py-1.5 px-0.5 text-center text-slate-400">{t.gf}</td>
                            <td className="py-1.5 px-0.5 text-center text-slate-400">{t.ga}</td>
                            <td className="py-1.5 px-0.5 text-center font-bold text-slate-400">{t.gd > 0 ? '+' : ''}{t.gd}</td>
                            <td className="py-1.5 px-1 text-center font-black text-white">{t.pts}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>
        </div>
      )}

      {/* Bracket View */}
      {activeRound !== 'group' && bracketHasRound && (
        <div ref={fitboxRef} className="relative w-full rounded-xl bg-slate-900/50 border border-white/5 flex flex-col flex-1 min-h-0">
          {/* Scrollable Viewport */}
          <div ref={bracketCallbackRef} onMouseDown={handleMouseDown} className="overflow-hidden cursor-grab active:cursor-grabbing select-none flex justify-center flex-1 min-h-0">
            <div style={{ width: CW * zoomLevel, height: geometry.canvasH * zoomLevel, flexShrink: 0 }}>
              <div className="relative" style={{ width: CW, height: geometry.canvasH, transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}>
                {/* SVG Connectors */}
                <svg className="absolute inset-0 pointer-events-none" style={{ width: CW, height: geometry.canvasH }}>
                  {geometry.connectors.map((c, i) => {
                    const isLit = teamPath.connectors.has(i);
                    return <path key={i} d={c.path} fill="none"
                      stroke={isLit ? '#6366F1' : 'rgba(255,255,255,0.08)'}
                      strokeWidth={isLit ? 2.5 : 1.5}
                      style={isLit ? { filter: 'drop-shadow(0 0 6px rgba(99,102,241,0.5))', transition: 'stroke 0.3s, stroke-width 0.3s' } : { transition: 'stroke 0.3s' }} />;
                  })}
                </svg>

                {/* Round Labels */}
                {ROUND_LABELS_DATA.map((label, i) => (
                  <div key={i} className="absolute pointer-events-none" style={{ left: label.x, top: LABEL_Y, transform: 'translateX(-50%)' }}>
                    <span className={`text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap ${label.isFinal ? 'text-amber-400' : 'text-slate-600'}`}>{label.label}</span>
                  </div>
                ))}

                {/* Match Boxes */}
                {Object.entries(geometry.geom).map(([matchId, g]) => {
                  const match = state.matches.find((m: TourMatch) => m.id === matchId);
                  if (!match || match.round === 'group') return null;
                  const isFinal = match.round === 'final';
                  const isHovered = teamPath.matches.has(matchId);
                  const teamAWon = match.played && match.scoreA !== null && match.scoreB !== null && match.scoreA > match.scoreB;
                  const teamBWon = match.played && match.scoreB !== null && match.scoreA !== null && match.scoreB > match.scoreA;
                  const isUpset = match.played && (
                    (teamAWon && (TEAM_FLAG_COLORS[match.teamA] || []).length < (TEAM_FLAG_COLORS[match.teamB] || []).length) ||
                    (teamBWon && (TEAM_FLAG_COLORS[match.teamB] || []).length < (TEAM_FLAG_COLORS[match.teamA] || []).length)
                  );
                  const dimmed = hoveredTeam && !isHovered;

                  return (
                    <div key={matchId}
                      style={{ left: g.x, top: g.y, width: g.w, height: g.h, opacity: dimmed ? 0.3 : 1 }}
                      className={`absolute rounded-xl overflow-hidden cursor-pointer transition-all duration-200 bg-slate-900 ${isFinal ? 'ring-1 ring-amber-400/40 shadow-[0_0_20px_rgba(255,200,87,0.15)]' : 'shadow-sm'}`}>
                      {/* Cap */}
                      <div className="flex items-center gap-1 px-2 py-1 border-b border-white/5 flex-nowrap overflow-hidden">
                        <span className="text-[10px] font-extrabold whitespace-nowrap flex-shrink-0" style={{ color: isFinal ? '#FBBF24' : '#6366F1' }}>
                          {getMatchDisplayNum(match.round, match.matchNumber)}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono ml-auto whitespace-nowrap flex-shrink-0">{getMatchDate(match.round, match.matchNumber)}</span>
                        {isUpset && <span className="text-[8px] font-extrabold text-rose-400 bg-rose-400/15 rounded px-1 whitespace-nowrap flex-shrink-0">UPSET</span>}
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider whitespace-nowrap flex-shrink-0 truncate max-w-[80px]">{getMatchCity(match.round, match.matchNumber)}</span>
                      </div>
                      {/* Rows */}
                      <div className="flex flex-col">
                        {[match.teamA, match.teamB].map((team, ti) => {
                          const isWin = ti === 0 ? teamAWon : teamBWon;
                          const isTeamHovered = hoveredTeam === team;
                          return (
                            <div key={team}
                              onMouseEnter={() => setHoveredTeam(team)}
                              onMouseLeave={() => setHoveredTeam(null)}
                              className={`flex items-center gap-2 px-2.5 transition-all duration-150 relative ${
                                isWin ? '' : 'opacity-40'
                              } ${isTeamHovered ? 'bg-indigo-500/15' : ''}`}
                              style={{ height: (g.h - 28) / 2 }}>
                              {isWin && <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r" style={{ background: isFinal ? '#FBBF24' : '#6366F1' }} />}
                              <FlagColors team={team} className="h-3 w-5 flex-shrink-0" />
                              <span className="text-[11px] font-extrabold w-8 flex-shrink-0" style={{ color: isWin ? (isFinal ? '#FBBF24' : '#f1f5f9') : '#64748b' }}>
                                {getTeamCode(team)}
                              </span>
                              <span className="text-[11px] truncate flex-1" style={{ color: isWin ? '#cbd5e1' : '#475569' }}>
                                {team}
                              </span>
                              {isWin && <span className="text-[11px] font-extrabold ml-auto" style={{ color: isFinal ? '#FBBF24' : '#6366F1' }}>✓</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Champion View */}
      {activeRound === 'global' && (
        <div className="overflow-y-auto flex-1 min-h-0 px-4 md:px-0">
          <div className="mx-auto space-y-3 pb-4" style={{ maxWidth: '36rem' }}>
            <div className="bg-slate-900/70 border border-white/5 rounded-xl p-4 text-center">
              <Trophy className="h-8 w-8 text-amber-400 mx-auto mb-2" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Global Champion Rankings</h2>
              <p className="text-[10px] text-slate-500 mt-1">
                {globalChampion?.total || 0} user{globalChampion?.total !== 1 ? 's' : ''} completed their simulation
              </p>
            </div>
            {(!globalChampion || globalChampion.rankings.length === 0) ? (
              <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-white/5 border-dashed">
                <Swords className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 font-bold text-sm">No simulations completed yet</p>
                <p className="text-[10px] text-slate-600 mt-1">Run your simulation to contribute!</p>
              </div>
            ) : (
              <div className="space-y-1">
                {globalChampion.rankings.map((r, i) => (
                  <div key={r.team} className="flex items-center gap-3 bg-slate-900/50 border border-white/5 rounded-lg px-4 py-2.5 hover:border-amber-500/30 transition-all">
                    <span className={`w-6 text-center font-black text-xs ${i === 0 ? 'text-amber-400' : i < 3 ? 'text-slate-400' : 'text-slate-600'}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                    <FlagColors team={r.team} className="h-4 w-6 flex-shrink-0 rounded" />
                    <span className="flex-1 font-bold text-xs text-white">{r.team}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all" style={{ width: `${(r.count / globalChampion.total) * 100}%` }} />
                      </div>
                      <span className="text-xs font-black text-amber-400 w-8 text-right">{r.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fallback */}
      {activeRound !== 'group' && activeRound !== 'global' && !bracketHasRound && (
        <div className="text-center py-16 bg-slate-900/50 rounded-xl border border-white/5 border-dashed">
          <Swords className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 font-bold text-sm">
            {state?.currentRound === 'completed' ? 'Tournament is over!' : 'The knockout stage hasn\'t started yet.'}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">Simulate the Group Stage to begin.</p>
        </div>
      )}

      {/* Group Modal */}
      <AnimatePresence>
        {selectedGroup && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedGroup(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl max-h-[80vh] flex flex-col">
              <div className="bg-slate-900/80 px-5 py-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Group {selectedGroup}</h3>
                <button type="button" onClick={() => setSelectedGroup(null)} className="text-[#808080] hover:text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer">✕</button>
              </div>
              <div className="flex border-b border-white/10 flex-shrink-0">
                {(['matches', 'goals'] as const).map(tab => (
                  <button key={tab} type="button" onClick={() => setGroupModalTab(tab)}
                    className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all ${
                      groupModalTab === tab ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-white'}`}>
                    {tab === 'matches' ? <><Trophy className="h-3 w-3 inline mr-1 -mt-0.5" />Matches</> : <><Goal className="h-3 w-3 inline mr-1 -mt-0.5" />Goals</>}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-2 overflow-y-auto flex-1">
                {groupModalTab === 'matches' ? (
                  (state?.matches || []).filter((m: TourMatch) => m.groupName === selectedGroup && m.round === 'group').length === 0 ? (
                    <p className="text-slate-500 text-xs text-center py-8">No matches played yet.</p>
                  ) : (state?.matches || []).filter((m: TourMatch) => m.groupName === selectedGroup && m.round === 'group').map((m: TourMatch) => (
                    <div key={m.id} className="bg-slate-900/80 border border-white/5 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <FlagColors team={m.teamA} className="h-3 w-5 flex-shrink-0" />
                        <span className={`text-xs font-bold truncate ${m.played && (m.scoreA ?? 0) > (m.scoreB ?? 0) ? 'text-emerald-400' : m.played ? 'text-slate-500' : 'text-white'}`}>{m.teamA}</span>
                      </div>
                      <span className="text-sm font-black font-mono px-3">
                        {m.played ? `${m.scoreA} - ${m.scoreB}` : <span className="text-slate-600">vs</span>}
                      </span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                        <span className={`text-xs font-bold truncate text-right ${m.played && (m.scoreB ?? 0) > (m.scoreA ?? 0) ? 'text-emerald-400' : m.played ? 'text-slate-500' : 'text-white'}`}>{m.teamB}</span>
                        <FlagColors team={m.teamB} className="h-3 w-5 flex-shrink-0" />
                      </div>
                    </div>
                  ))
                ) : (() => {
                  const gm = (state?.matches || []).filter((m: TourMatch) => m.groupName === selectedGroup && m.round === 'group' && m.played);
                  const gc: Record<string, { player: string; team: string; count: number }> = {};
                  for (const m of gm) {
                    for (const g of (m.goalsA || [])) { const k = g.player + '|' + m.teamA; if (!gc[k]) gc[k] = { player: g.player, team: m.teamA, count: 0 }; gc[k].count++; }
                    for (const g of (m.goalsB || [])) { const k = g.player + '|' + m.teamB; if (!gc[k]) gc[k] = { player: g.player, team: m.teamB, count: 0 }; gc[k].count++; }
                  }
                  const sorted = Object.values(gc).sort((a, b) => b.count - a.count || a.player.localeCompare(b.player));
                  return sorted.length === 0 ? <p className="text-[#808080] text-xs text-center py-8">No goals yet.</p> : (
                    <div className="space-y-1">
                      {sorted.map((g, i) => (
                          <div key={g.player + g.team} className="flex items-center gap-2 py-1 px-2 rounded bg-slate-900/50">
                          <span className="text-[9px] font-mono font-bold text-slate-600 w-4 text-right">#{i + 1}</span>
                          <FlagColors team={g.team} className="h-2.5 w-4 flex-shrink-0" />
                          <span className="text-xs text-white font-medium truncate">{g.player}</span>
                          <span className="text-[9px] text-slate-500 font-mono ml-auto truncate">{g.team}</span>
                          <span className="text-[11px] font-black text-emerald-400 w-4 text-right">{g.count}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
