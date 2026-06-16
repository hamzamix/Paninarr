import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BookOpen, Sparkles, Lock, ShieldAlert, CheckCircle2, Award, Trophy, ArrowRightLeft, MapPin, Eye } from 'lucide-react';
import { getStickerPhotoUrl } from '../utils/stickerImages';
import { getFlagImgUrl, getCountryCode } from '../utils/countryData';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

type MasterSticker = {
    id: string;
    name: string;
    category: string;
    rarity: string;
    description?: string;
    country?: string;
    image?: string;
    image_position?: string;
    is_extra?: number;
};

function parsePosition(pos?: string): { x: number; y: number } {
    if (!pos) return { x: 50, y: 50 };
    const parts = pos.split(/\s+/);
    const parsePct = (s: string) => {
        if (s === 'left' || s === 'top') return 0;
        if (s === 'right' || s === 'bottom') return 100;
        if (s === 'center') return 50;
        const n = parseFloat(s);
        return isNaN(n) ? 50 : n;
    };
    return {
        x: parts[0] ? parsePct(parts[0]) : 50,
        y: parts[1] ? parsePct(parts[1]) : 50,
    };
}

type UserStickersResponse = {
    id: string;
    user_id: string;
    sticker_id: string;
    is_duplicate: number;
    created_at: string;
    name: string;
    category: string;
    rarity: string;
};

function WorldCup2026Logo({ className = '' }: { className?: string }) {
    return (
        <img
            src="/wc2026-logo.svg"
            alt=""
            aria-hidden="true"
            className={className}
            draggable={false}
        />
    );
}

export default function Catalog() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [masterStickers, setMasterStickers] = useState<MasterSticker[]>([]);
    const [userStickers, setUserStickers] = useState<UserStickersResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All');
    const [filterStatus, setFilterStatus] = useState<'all' | 'owned' | 'locked'>('all');
    const [selectedSticker, setSelectedSticker] = useState<MasterSticker | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchCandidates, setSearchCandidates] = useState<{ title: string; url: string; thumb: string }[]>([]);
    const [searching, setSearching] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
    const [savingPosition, setSavingPosition] = useState(false);
    const ITEMS_PER_PAGE = 24;

    useEffect(() => {
        setSelectedTeam(null);
    }, [activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, filterStatus, selectedTeam]);

    const TEAM_FLAGS: { [key: string]: string } = {
        'United States': '🇺🇸',
        'Mexico': '🇲🇽',
        'Canada': '🇨🇦',
        'Argentina': '🇦🇷',
        'Brazil': '🇧🇷',
        'France': '🇫🇷',
        'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        'Spain': '🇪🇸',
        'Portugal': '🇵🇹',
        'Germany': '🇩🇪',
        'Netherlands': '🇳🇱',
        'Norway': '🇳🇴',
        'Belgium': '🇧🇪',
        'Uruguay': '🇺🇾',
        'Colombia': '🇨🇴',
        'Morocco': '🇲🇦',
        'Senegal': '🇸🇳',
        'Japan': '🇯🇵',
        'South Korea': '🇰🇷',
        'Australia': '🇦🇺',
        'Croatia': '🇭🇷',
        'Switzerland': '🇨🇭',
        'Sweden': '🇸🇪',
        'Austria': '🇦🇹',
        'Turkey': '🇹🇷',
        'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
        'Ecuador': '🇪🇨',
        'Paraguay': '🇵🇾',
        'Algeria': '🇩🇿',
        'Egypt': '🇪🇬',
        'Ivory Coast': '🇨🇮',
        'Ghana': '🇬🇭',
        'Saudi Arabia': '🇸🇦',
        'Iran': '🇮🇷',
        'New Zealand': '🇳🇿',
        'Bosnia and Herzegovina': '🇧🇦',
        'Cabo Verde': '🇨🇻',
        'Curaçao': '🇨🇼',
        'Czechia': '🇨🇿',
        'DR Congo': '🇨🇩',
        'Haiti': '🇭🇹',
        'Iraq': '🇮🇶',
        'Jordan': '🇯🇴',
        'Panama': '🇵🇦',
        'Qatar': '🇶🇦',
        'South Africa': '🇿🇦',
        'Tunisia': '🇹🇳',
        'Uzbekistan': '🇺🇿',
        'International': '⚽'
    };

    const TEAM_FLAG_COLORS: { [key: string]: string[] } = {
        'United States': ['#3C3B6E', '#FFFFFF', '#B22234'], // Blue, White, Red
        'Mexico': ['#006847', '#FFFFFF', '#C8102E'], // Green, White, Red
        'Canada': ['#FF0000', '#FFFFFF', '#FF0000'], // Red, White, Red
        'Argentina': ['#75AADB', '#FFFFFF', '#75AADB'], // Sky Blue, White, Sky Blue
        'Brazil': ['#009739', '#FEDF00', '#002776'], // Green, Yellow, Blue
        'France': ['#002395', '#FFFFFF', '#ED2939'], // Blue, White, Red
        'England': ['#FFFFFF', '#CE1124', '#FFFFFF'], // White, Red, White
        'Spain': ['#C11B17', '#FBBF24', '#C11B17'], // Red, Gold, Red
        'Portugal': ['#046A38', '#DA291C'], // Green, Red
        'Germany': ['#000000', '#FF0000', '#FFCC00'], // Black, Red, Gold
        'Netherlands': ['#AE1C28', '#FFFFFF', '#21468B', '#F17300'], // Red, White, Blue, Orange
        'Norway': ['#BA0C2F', '#FFFFFF', '#003087'], // Red, White, Blue
        'Belgium': ['#000000', '#FDDA24', '#EF3340'], // Black, Yellow, Red
        'Uruguay': ['#0038A8', '#FFFFFF', '#FCD116'], // Blue, White, Yellow
        'Colombia': ['#FCD116', '#0038A8', '#CE1124'], // Yellow, Blue, Red
        'Morocco': ['#C1272D', '#006233', '#C1272D'], // Red, Green, Red
        'Senegal': ['#00853F', '#FDEF42', '#E31B23'], // Green, Yellow, Red
        'Japan': ['#FFFFFF', '#BC002D', '#FFFFFF'], // White, Red, White
        'South Korea': ['#FFFFFF', '#CD2E3A', '#0047A0'], // White, Red, Blue
        'Australia': ['#012169', '#FF0000', '#FFFFFF', '#00843D', '#FFCD00'], // Blue, Red, Green, Gold
        'Croatia': ['#FF0000', '#FFFFFF', '#171796'], // Red, White, Blue
        'Switzerland': ['#D52B1E', '#FFFFFF', '#D52B1E'], // Red, White
        'Sweden': ['#006AA7', '#FECC00'], // Blue, Yellow
        'Austria': ['#ED2939', '#FFFFFF', '#ED2939'], // Red, White, Red
        'Turkey': ['#E30A17', '#FFFFFF'], // Red, White
        'Scotland': ['#005EB8', '#FFFFFF'], // Blue, White
        'Ecuador': ['#FFD100', '#003F87', '#EF3340'], // Yellow, Blue, Red
        'Paraguay': ['#D52B1E', '#FFFFFF', '#0038A8'], // Red, White, Blue
        'Algeria': ['#006633', '#FFFFFF', '#D21034'], // Green, White, Red
        'Egypt': ['#C8102E', '#FFFFFF', '#000000'], // Red, White, Black
        'Ivory Coast': ['#F77F00', '#FFFFFF', '#009E60'], // Orange, White, Green
        'Ghana': ['#CE1124', '#FCD116', '#006B3F'], // Red, Yellow, Green
        'Saudi Arabia': ['#006C35', '#FFFFFF'], // Green, White
        'Iran': ['#239F40', '#FFFFFF', '#DA121A'], // Green, White, Red
        'New Zealand': ['#000000', '#FFFFFF', '#C8102E'], // Black, White, Red
        'Bosnia and Herzegovina': ['#001F3F', '#FECB00', '#FFFFFF'], // Blue, Gold, White
        'Cabo Verde': ['#003893', '#FFFFFF', '#CF2027', '#F7D116'], // Blue, White, Red, Yellow
        'Curaçao': ['#002B7F', '#FFFFFF', '#FED141'], // Blue, White, Yellow
        'Czechia': ['#11457E', '#FFFFFF', '#D7141A'], // Blue, White, Red
        'DR Congo': ['#007FFF', '#CE1126', '#F7D618'], // Blue, Red, Yellow
        'Haiti': ['#00209F', '#D21034', '#FFFFFF'], // Blue, Red, White
        'Iraq': ['#CE1126', '#FFFFFF', '#007A3D'], // Red, White, Green
        'Jordan': ['#CE1126', '#FFFFFF', '#007A3D', '#000000'], // Red, White, Green, Black
        'Panama': ['#FFFFFF', '#CE1126', '#005294'], // White, Red, Blue
        'Qatar': ['#8C1B1B', '#FFFFFF'], // Maroon, White
        'South Africa': ['#DE3831', '#FFFFFF', '#002395', '#FFB81C', '#007A4D'], // Red, White, Blue, Yellow, Green
        'Tunisia': ['#E70013', '#FFFFFF'], // Red, White
        'Uzbekistan': ['#0099B5', '#FFFFFF', '#1EB53A', '#CE1126'], // Blue, White, Green, Red
        'International': ['#10B981', '#6366F1'] // Default emerald to indigo
    };

    useEffect(() => {
        if (!user?.id) return;
        
        setLoading(true);
        Promise.all([
            api.get('/stickers', user.id),
            api.get('/my-stickers', user.id)
        ])
        .then(([stickersData, userStickersData]) => {
            // Sort master stickers by ID (e.g., S001, S002, etc.)
            const sortedMaster = (stickersData.stickers || []).sort((a: MasterSticker, b: MasterSticker) => {
                return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
            });
            setMasterStickers(sortedMaster);
            setUserStickers(userStickersData.userStickers || []);
        })
        .catch(err => {
            console.error("Error loading catalog data:", err);
            toast.error("Failed to load official catalog.");
        })
        .finally(() => setLoading(false));
    }, [user?.id]);

    useEffect(() => {
        setDragPos(null);
    }, [selectedSticker?.id]);

    const categories = ['All', 'National Teams', 'Stadiums', 'Host Cities', 'Legends', 'Trophies', 'Extra Stickers'];

    // Utility details
    const getRarityBadgeStyle = (rarity: string) => {
        switch (rarity) {
            case 'Legendary':
                return 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black';
            case 'Epic':
                return 'bg-gradient-to-r from-purple-600 to-indigo-500 text-white font-black';
            case 'Rare':
                return 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold';
            default:
                return 'bg-slate-800 text-slate-300 font-medium';
        }
    };

    const getRarityBorderStyle = (rarity: string, isOwned: boolean) => {
        if (!isOwned) return 'border-white/5 bg-slate-900/40 opacity-70';
        switch (rarity) {
            case 'Legendary':
                return 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.45)]';
            case 'Epic':
                return 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)] hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]';
            case 'Rare':
                return 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)]';
            default:
                return 'border-white/10 hover:border-white/20';
        }
    };

    // Filter stickers based on active tab & discovery status
    const filteredStickers = masterStickers.filter(sticker => {
        // Tab category filter
        if (activeTab === 'Extra Stickers') {
            if (!sticker.is_extra) return false;
        } else if (activeTab !== 'All' && sticker.category !== activeTab) return false;

        // If National Teams tab, and a team is selected, filter players belonging to that country
        if (activeTab === 'National Teams' && selectedTeam && sticker.country !== selectedTeam) return false;
        
        const isOwned = userStickers.some(us => us.sticker_id === sticker.id);
        
        // Ownership lock filter
        if (filterStatus === 'owned' && !isOwned) return false;
        if (filterStatus === 'locked' && isOwned) return false;
        
        return true;
    });

    const totalPages = Math.ceil(filteredStickers.length / ITEMS_PER_PAGE);
    const paginatedStickers = filteredStickers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const uniqueTeams = Array.from(new Set(
        masterStickers
            .filter(s => s.category === 'National Teams')
            .map(s => s.country)
            .filter(Boolean)
    )) as string[];

    const ownedDistinctCount = masterStickers.filter(ms => 
        userStickers.some(us => us.sticker_id === ms.id)
    ).length;

    const completionRate = masterStickers.length > 0 
        ? Math.round((ownedDistinctCount / masterStickers.length) * 100) 
        : 0;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 space-y-4 animate-pulse">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
                <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">Opening Official Panini Catalog...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header section with album overview stats */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-6">
                <div>
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-[#10B981] flex items-center gap-1.5 mb-2">
                       <BookOpen className="h-4 w-4 text-emerald-400" /> Panini World Collection
                    </span>
                    <h1 className="text-3xl lg:text-4xl font-black text-white uppercase italic tracking-tight">Official Sticker Catalog</h1>
                    <p className="text-sm text-slate-400 font-medium max-w-xl">
                        Review the entire FIFA World Cup collection. Discover missing legend players, famous venues, and shining honors. Locked cards appear grayscale until unveiled!
                    </p>
                </div>
                
                <div className="flex flex-col items-end w-full md:w-auto bg-slate-900/80 border border-white/10 p-5 rounded-2xl md:min-w-[280px]">
                     <div className="flex justify-between items-center w-full mb-2">
                         <span className="text-xs font-mono uppercase text-slate-400 font-bold">Catalog Completion</span>
                         <span className="text-sm font-black text-emerald-400">{ownedDistinctCount} / {masterStickers.length} <span className="text-xs text-slate-500">Stickers</span></span>
                     </div>
                     <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-white/5 p-0.5">
                         <div 
                             className="h-full bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-full transition-all duration-1000"
                             style={{ width: `${completionRate}%` }}
                         />
                     </div>
                     <span className="text-[10px] font-mono text-slate-500 uppercase mt-2 tracking-wide self-start">
                         {completionRate === 100 ? "🎉 Collection Complete! Ultimate Legend Champion!" : `${masterStickers.length - ownedDistinctCount} unique stickers left to collect`}
                     </span>
                </div>
            </header>

            {/* Selection filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-4 border border-white/5 rounded-2xl backdrop-blur-md">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                    <TabsList className="bg-slate-950 p-1 flex flex-wrap gap-1 rounded-xl w-full md:w-auto">
                        {categories.map(c => (
                            <TabsTrigger 
                                key={c} 
                                value={c} 
                                className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 font-black rounded-lg px-3 py-1.5 uppercase text-[10px] tracking-wider transition-all"
                            >
                                {c === 'Extra Stickers' ? <><Sparkles className="h-3 w-3 mr-1" />{c}</> : c}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl self-stretch md:self-auto justify-center">
                    <button 
                        onClick={() => setFilterStatus('all')}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${filterStatus === 'all' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Show All
                    </button>
                    <button 
                        onClick={() => setFilterStatus('owned')}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${filterStatus === 'owned' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                        Collected
                    </button>
                    <button 
                        onClick={() => setFilterStatus('locked')}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${filterStatus === 'locked' ? 'bg-slate-800 text-slate-200' : 'text-slate-400 hover:text-white'}`}
                    >
                        Missing
                    </button>
                </div>
            </div>

            {/* Admin actions */}
            {user?.id === 'admin' && (
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('Resolve ALL player images from FIFA? This will override existing manual images. Continue?')) return;
                    try {
                      const res = await fetch('/api/admin/resolve-all-fifa', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': 'admin' } });
                      const data = await res.json();
                      if (data.error) { toast.error(data.error); return; }
                      toast.success(`FIFA resolve done: ${data.resolved} resolved, ${data.notFound} not found, ${data.errors} errors`);
                      const stickersRes = await fetch('/api/stickers');
                      const stickersData = await stickersRes.json();
                      setMasterStickers(stickersData.stickers);
                    } catch { toast.error('FIFA resolve failed'); }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all"
                >
                  Resolve All from FIFA
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('Resolve images for Legends, Stadiums, Host Cities & Trophies from Wikipedia? Continue?')) return;
                    try {
                      const res = await fetch('/api/admin/resolve-all-generic', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': 'admin' } });
                      const data = await res.json();
                      if (data.error) { toast.error(data.error); return; }
                      toast.success(`Resolved: ${data.resolved}, Not found: ${data.notFound}, Errors: ${data.errors}`);
                      const stickersRes = await fetch('/api/stickers');
                      const stickersData = await stickersRes.json();
                      setMasterStickers(stickersData.stickers);
                    } catch { toast.error('Resolve failed'); }
                  }}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-1.5 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all"
                >
                  Resolve Others (Wiki)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/admin/cache-fifa-photos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': 'admin' } });
                      const data = await res.json();
                      if (data.error) { toast.error(data.error); return; }
                      toast.success(`Cached: ${data.cached}, Skipped: ${data.skipped}, Failed: ${data.failed}`);
                      const stickersRes = await fetch('/api/stickers');
                      const stickersData = await stickersRes.json();
                      setMasterStickers(stickersData.stickers);
                    } catch { toast.error('Cache failed'); }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all"
                >
                  Cache All Photos Locally
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('Force-set image position to 50% 20% on all stickers?')) return;
                    try {
                      const res = await fetch('/api/admin/set-all-positions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': 'admin' }, body: JSON.stringify({ position: '50% 20%' }) });
                      const data = await res.json();
                      if (data.error) { toast.error(data.error); return; }
                      toast.success(`Position set to 50% 20% for ${data.count} stickers`);
                      const stickersRes = await fetch('/api/stickers');
                      const stickersData = await stickersRes.json();
                      setMasterStickers(stickersData.stickers);
                    } catch { toast.error('Set positions failed'); }
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-1.5 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all"
                >
                  Set Pos 50% / 20%
                </button>
              </div>
            )}

            {/* Catalog Grid or Team Selector */}
            {activeTab === 'National Teams' && !selectedTeam ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 animate-in fade-in duration-300">
                    {uniqueTeams.map(team => {
                        const teamPlayers = masterStickers.filter(s => s.category === 'National Teams' && s.country === team);
                        const totalInTeam = teamPlayers.length;
                        const collectedInTeam = teamPlayers.filter(s => userStickers.some(us => us.sticker_id === s.id)).length;
                        const completionRate = totalInTeam > 0 ? Math.round((collectedInTeam / totalInTeam) * 100) : 0;
                        
                        return (
                            <div 
                                key={team}
                                onClick={() => setSelectedTeam(team)}
                                className="bg-slate-900/60 border border-white/10 hover:border-emerald-500/40 rounded-3xl p-5 cursor-pointer hover:scale-[1.03] shadow-xl group transition-all duration-300 relative overflow-hidden flex flex-col justify-between aspect-square"
                                id={`team-tab-${team.replace(/\s+/g, '-').toLowerCase()}`}
                            >
                                <div className="absolute top-0 left-0 right-0 h-1.5 flex overflow-hidden z-20">
                                    {(TEAM_FLAG_COLORS[team] || ['#10B981', '#6366F1']).map((col, idx) => (
                                        <div key={idx} className="flex-1 h-full" style={{ backgroundColor: col }} />
                                    ))}
                                </div>
                                <div className="absolute -left-10 -bottom-8 w-36 h-48 pointer-events-none opacity-[0.10] select-none transition-all duration-500 group-hover:scale-110 group-hover:opacity-[0.18]">
                                    <WorldCup2026Logo className="w-full h-full object-contain" />
                                </div>
                                <div className="absolute -right-6 -bottom-6 text-7xl font-mono font-black pointer-events-none opacity-[0.06] select-none transition-transform duration-500 group-hover:scale-110 tracking-tighter text-white">
                                    {getCountryCode(team)}
                                </div>

                                <div className="flex flex-col items-start gap-1 w-full">
                                    <div className="flex items-center gap-2 mb-2 w-full justify-between">
                                        {getFlagImgUrl(team) ? (
                                            <img 
                                                src={getFlagImgUrl(team)} 
                                                alt={`${team} flag`} 
                                                className="h-6 w-9 object-cover rounded shadow border border-white/10"
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : (
                                            <span className="text-2xl">⚽</span>
                                        )}
                                        <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-white/5 shadow-inner">
                                            {getCountryCode(team)}
                                        </span>
                                    </div>
                                    <h3 className="font-extrabold text-base text-white uppercase italic tracking-tight leading-tight">{team}</h3>
                                    <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-widest">
                                        Roster Selection
                                    </span>
                                </div>

                                <div className="space-y-1.5 pt-4 mt-auto">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                                        <span>Collected</span>
                                        <span className="text-white font-mono">{collectedInTeam} / {totalInTeam}</span>
                                    </div>
                                    <div className="w-full bg-slate-950 p-[2px] rounded-full overflow-hidden border border-white/5">
                                        <div 
                                            className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-500"
                                            style={{ width: `${completionRate}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : filteredStickers.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/20 rounded-[2rem] border border-white/5 border-dashed flex flex-col items-center justify-center space-y-3">
                    <ShieldAlert className="h-8 w-8 text-slate-500" />
                    <p className="text-slate-400 text-sm font-medium">No stickers match your filters.</p>
                    <p className="text-xs text-slate-550">Try selecting "Show All" or exploring different categories.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Selected Team Header */}
                    {activeTab === 'National Teams' && selectedTeam && (
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/40 p-5 border border-white/10 rounded-2xl gap-4">
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setSelectedTeam(null)}
                                    className="bg-slate-950 hover:bg-slate-800 text-slate-350 hover:text-white px-4 py-2 rounded-xl border border-white/10 text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    ← Back to Teams
                                </button>
                                <div className="flex items-center gap-2">
                                    {getFlagImgUrl(selectedTeam) ? (
                                        <img 
                                            src={getFlagImgUrl(selectedTeam)} 
                                            alt={`${selectedTeam} flag`} 
                                            className="h-6 w-9 object-cover rounded shadow border border-white/10" 
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <span className="text-xl">⚽</span>
                                    )}
                                    <h2 className="text-xl font-black text-white uppercase italic tracking-tight">
                                        {selectedTeam} Squad <span className="text-slate-500 font-mono text-xs not-italic ml-1">({getCountryCode(selectedTeam)})</span>
                                    </h2>
                                </div>
                                {user?.id === 'admin' && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                const res = await fetch('/api/admin/resolve-team', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': 'admin' }, body: JSON.stringify({ country: selectedTeam }) });
                                                const data = await res.json();
                                                if (data.error) { toast.error(data.error); return; }
                                                toast.success(`${data.country}: ${data.fifaResolved} FIFA + ${data.wikiResolved} Wiki = ${data.resolved} resolved, ${data.notFound} not found`);
                                                const stickersRes = await fetch('/api/stickers');
                                                const stickersData = await stickersRes.json();
                                                setMasterStickers(stickersData.stickers);
                                            } catch { toast.error('Resolve failed'); }
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all"
                                    >
                                        Resolve Team
                                    </button>
                                )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono uppercase bg-slate-950 px-3 py-1.5 rounded-xl border border-white/5 font-bold">
                                Showing {filteredStickers.length} available players
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                        {paginatedStickers.map((sticker) => {
                            // Check if owned
                            const copiesOwned = userStickers.filter(us => us.sticker_id === sticker.id);
                            const isOwned = copiesOwned.length > 0;
                            const isUniqueDup = copiesOwned.length > 1;

                            return (
                                <motion.div
                                    key={sticker.id}
                                    onClick={() => setSelectedSticker(sticker)}
                                    className={`relative aspect-[3/4] rounded-2xl border flex flex-col justify-end p-3 shadow-md overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.03] ${getRarityBorderStyle(sticker.rarity, isOwned)}`}
                                >
                                    {/* Flag colors strip under the top edge */}
                                    {sticker.country && sticker.country !== 'International' && TEAM_FLAG_COLORS[sticker.country] && (
                                        <div className="absolute top-0 left-0 right-0 h-1 flex overflow-hidden z-20">
                                            {TEAM_FLAG_COLORS[sticker.country].map((col, idx) => (
                                                <div key={idx} className="flex-1 h-full" style={{ backgroundColor: col }} />
                                            ))}
                                        </div>
                                    )}
                                    {/* Full-bleed image background */}
                                    <div className="absolute inset-0 z-0">
                                        <img
                                            src={getStickerPhotoUrl(sticker.id, sticker.category, sticker.image)}
                                            alt={sticker.name}
                                            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${isOwned ? 'brightness-[0.9]' : 'brightness-[0.35] grayscale contrast-[1.1]'}`}
                                            style={{ objectPosition: (() => {
                                                const p = parsePosition(sticker.image_position);
                                                return `${p.x}% ${p.y}%`;
                                            })() }}
                                        />
                                        {/* Vignette mask overlay for readability */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/30 pointer-events-none" />
                                    </div>

                                    {/* Custom Lock Symbol overlay for locked stickers */}
                                    {!isOwned && (
                                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center justify-center space-y-1 bg-slate-950/75 p-2.5 rounded-full border border-white/5 shadow-2xl backdrop-blur-sm">
                                            <Lock className="h-4 w-4 text-slate-400" />
                                        </div>
                                    )}

                                    {/* Rarity / Duplicate tags on top of card */}
                                    <div className="absolute top-2 left-2 right-2 z-10 flex justify-between items-center gap-1">
                                        <span className="text-[8px] font-mono text-slate-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-white/5 uppercase tracking-wider backdrop-blur-sm">
                                            {sticker.id}
                                        </span>

                                        <div className="flex items-center gap-1">
                                            {sticker.country && sticker.category !== 'Stadiums' && (
                                                <span className="bg-slate-950/85 border border-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm shadow flex items-center gap-1" title={sticker.country}>
                                                    {getFlagImgUrl(sticker.country) ? (
                                                        <img 
                                                            src={getFlagImgUrl(sticker.country)} 
                                                            alt={sticker.country} 
                                                            className="h-3 w-4.5 object-cover rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.5)] border border-white/10" 
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    ) : (
                                                        <span className="text-[10px]">⚽</span>
                                                    )}
                                                    <span className="text-[9px] font-mono font-bold text-white tracking-wider">
                                                        {getCountryCode(sticker.country)}
                                                    </span>
                                                </span>
                                            )}
                                            {isOwned && isUniqueDup && (
                                                <div className="bg-gradient-to-r from-emerald-500 to-indigo-600 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded shadow border border-emerald-300/10">
                                                    +{copiesOwned.length - 1} DUP
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Information layout centered at bottom */}
                                    <div className="relative z-10 space-y-1">
                                        <div className="flex items-center gap-1 justify-between">
                                            <span className={`text-[7px] tracking-widest uppercase px-1.5 py-0.5 rounded font-black ${isOwned ? getRarityBadgeStyle(sticker.rarity) : 'bg-slate-900 text-slate-500'}`}>
                                                {sticker.rarity}
                                            </span>
                                            {isOwned ? (
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/trades?need=${sticker.id}`);
                                                    }}
                                                    className="flex items-center gap-1 text-[8px] font-black tracking-wider uppercase bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded-lg border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer"
                                                    title="Find a swap for this sticker"
                                                >
                                                    <ArrowRightLeft className="h-3 w-3" />
                                                    SWAP
                                                </button>
                                            )}
                                        </div>

                                        <div className="text-left pt-0.5">
                                            <h4 className={`font-black text-xs uppercase italic tracking-tight line-clamp-1 leading-none ${isOwned ? 'text-white' : 'text-slate-500'}`}>
                                                {sticker.name}
                                            </h4>
                                            
                                            {/* Beautiful prominently displayed Host City badge for Stadiums! */}
                                            {sticker.category === 'Stadiums' && sticker.description && (
                                                <span className="text-[8.5px] text-[#10B981] font-extrabold tracking-tight uppercase flex items-center gap-0.5 mt-0.5 drop-shadow">
                                                    <MapPin className="h-2.5 w-2.5 text-emerald-400 flex-shrink-0 animate-bounce" /> {sticker.description.split(' - ')[0]}
                                                </span>
                                            )}

                                            <span className="text-[8px] text-slate-500 font-mono tracking-wide uppercase flex items-center gap-1 mt-0.5">
                                                <span>{sticker.category}</span>
                                                {sticker.country && sticker.category !== 'Stadiums' && (
                                                    <>
                                                        <span>•</span>
                                                        {getFlagImgUrl(sticker.country) ? (
                                                            <img 
                                                                src={getFlagImgUrl(sticker.country)} 
                                                                alt={sticker.country} 
                                                                className="h-2.5 w-4 object-cover rounded-sm border border-white/5 inline-block" 
                                                                referrerPolicy="no-referrer"
                                                            />
                                                        ) : null}
                                                        <span>{sticker.country}</span>
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 mt-8 border-t border-white/5 font-mono text-xs animate-in fade-in duration-300">
                            <div className="text-slate-400">
                                Page <span className="text-emerald-400 font-bold">{currentPage}</span> of <span className="text-white font-bold">{totalPages}</span>
                                <span className="text-slate-600 hidden sm:inline"> • Showing {paginatedStickers.length} of {filteredStickers.length} available cards</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => {
                                        setCurrentPage(prev => Math.max(prev - 1, 1));
                                        window.scrollTo({ top: 300, behavior: 'smooth' });
                                    }}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg border border-white/10 bg-slate-950/40 text-slate-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-white/10 transition-all font-black uppercase text-[10px] tracking-wider cursor-pointer"
                                >
                                    Prev
                                </button>
                                
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(page => {
                                        return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                                    })
                                    .map((page, index, array) => {
                                        const showEllipsis = index > 0 && page - array[index - 1] > 1;
                                        return (
                                            <React.Fragment key={page}>
                                                {showEllipsis && <span className="text-slate-500 px-1">...</span>}
                                                <button
                                                    onClick={() => {
                                                        setCurrentPage(page);
                                                        window.scrollTo({ top: 300, behavior: 'smooth' });
                                                    }}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold font-mono transition-all border cursor-pointer ${
                                                        currentPage === page
                                                            ? 'bg-gradient-to-r from-emerald-500 to-indigo-600 border-emerald-400 text-slate-950 font-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                                            : 'bg-slate-950/40 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            </React.Fragment>
                                        );
                                    })
                                }

                                <button
                                    onClick={() => {
                                        setCurrentPage(prev => Math.min(prev + 1, totalPages));
                                        window.scrollTo({ top: 300, behavior: 'smooth' });
                                    }}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded-lg border border-white/10 bg-slate-950/40 text-slate-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-white/10 transition-all font-black uppercase text-[10px] tracking-wider cursor-pointer"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Sticker Inspection Modal */}
            <AnimatePresence>
                {selectedSticker && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900 border border-white/10 rounded-3xl overflow-y-auto max-h-[90vh] max-w-lg w-full shadow-2xl relative"
                        >
                            {/* Card Presentation Section */}
                            <div className="relative aspect-[16/10] bg-slate-950 overflow-hidden select-none">
                                <img
                                    src={getStickerPhotoUrl(selectedSticker.id, selectedSticker.category, selectedSticker.image)}
                                    alt={selectedSticker.name}
                                    draggable={false}
                                    className={`w-full h-full object-cover ${userStickers.some(us => us.sticker_id === selectedSticker.id) ? '' : 'grayscale brightness-50'}`}
                                    style={{
                                        objectPosition: (() => {
                                            const pos = dragPos || parsePosition(selectedSticker.image_position);
                                            return `${pos.x}% ${pos.y}%`;
                                        })(),
                                        cursor: user?.id === 'admin' ? (dragPos ? 'grabbing' : 'grab') : 'default',
                                        touchAction: 'none',
                                    }}
                                    onMouseDown={user?.id === 'admin' ? (e) => {
                                        e.preventDefault();
                                        const startX = e.clientX;
                                        const startY = e.clientY;
                                        const startPos = dragPos || parsePosition(selectedSticker.image_position);
                                        const img = e.currentTarget;
                                        const rect = img.getBoundingClientRect();
                                        const onMove = (ev: MouseEvent) => {
                                            const dx = ((ev.clientX - startX) / rect.width) * 100;
                                            const dy = ((ev.clientY - startY) / rect.height) * 100;
                                            const newX = Math.max(0, Math.min(100, startPos.x - dx));
                                            const newY = Math.max(0, Math.min(100, startPos.y - dy));
                                            setDragPos({ x: newX, y: newY });
                                        };
                                        const onUp = () => {
                                            window.removeEventListener('mousemove', onMove);
                                            window.removeEventListener('mouseup', onUp);
                                        };
                                        window.addEventListener('mousemove', onMove);
                                        window.addEventListener('mouseup', onUp);
                                    } : undefined}
                                    onTouchStart={user?.id === 'admin' ? (e) => {
                                        const touch = e.touches[0];
                                        const startX = touch.clientX;
                                        const startY = touch.clientY;
                                        const startPos = dragPos || parsePosition(selectedSticker.image_position);
                                        const img = e.currentTarget;
                                        const rect = img.getBoundingClientRect();
                                        const onMove = (ev: TouchEvent) => {
                                            const t = ev.touches[0];
                                            const dx = ((t.clientX - startX) / rect.width) * 100;
                                            const dy = ((t.clientY - startY) / rect.height) * 100;
                                            const newX = Math.max(0, Math.min(100, startPos.x - dx));
                                            const newY = Math.max(0, Math.min(100, startPos.y - dy));
                                            setDragPos({ x: newX, y: newY });
                                        };
                                        const onEnd = () => {
                                            window.removeEventListener('touchmove', onMove);
                                            window.removeEventListener('touchend', onEnd);
                                        };
                                        window.addEventListener('touchmove', onMove);
                                        window.addEventListener('touchend', onEnd);
                                    } : undefined}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent pointer-events-none" />

                                <button
                                    onClick={() => { setSelectedSticker(null); setDragPos(null); }}
                                    className="absolute top-4 right-4 bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white p-2 rounded-full border border-white/15 transition-all text-sm font-bold"
                                    id="close-modal-btn"
                                >
                                    ✕
                                </button>

                                <div className="absolute bottom-4 left-6 right-6 pointer-events-none">
                                    <span className="text-[10px] font-mono uppercase bg-slate-950/70 border border-white/10 px-2 py-0.5 rounded tracking-widest text-[#10B981]">
                                        {selectedSticker.id} SPOT
                                    </span>
                                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tight mt-1">{selectedSticker.name}</h2>
                                    <p className="text-xs text-slate-400 font-mono tracking-wide flex items-center gap-1.5 mt-1">
                                        <span>{selectedSticker.category}</span>
                                        {selectedSticker.country && (
                                            <>
                                                <span>•</span>
                                                {getFlagImgUrl(selectedSticker.country) ? (
                                                    <img 
                                                        src={getFlagImgUrl(selectedSticker.country)} 
                                                        alt={selectedSticker.country} 
                                                        className="h-3 w-4.5 object-cover rounded shadow-[0_1px_2px_rgba(0,0,0,0.5)] border border-white/10" 
                                                        referrerPolicy="no-referrer"
                                                    />
                                                ) : null}
                                                <span>{selectedSticker.country}</span>
                                            </>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Details parameters */}
                            <div className="p-6 space-y-6 animate-in fade-in">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 text-center">
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Rarity</span>
                                        <span className={`text-[10px] uppercase py-0.5 px-2 rounded-full font-black ${getRarityBadgeStyle(selectedSticker.rarity)}`}>
                                            {selectedSticker.rarity}
                                        </span>
                                    </div>
                                    <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 text-center">
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Status</span>
                                        {userStickers.some(us => us.sticker_id === selectedSticker.id) ? (
                                            <span className="text-emerald-400 text-xs font-black uppercase flex items-center justify-center gap-1">
                                                <CheckCircle2 className="h-3 w-3 inline" /> Owned
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 text-xs font-black uppercase flex items-center justify-center gap-1">
                                                <Lock className="h-3 w-3 inline" /> Locked
                                            </span>
                                        )}
                                    </div>
                                    <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 text-center">
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Duplicates</span>
                                        <span className="text-white text-xs font-black uppercase">
                                            {Math.max(0, userStickers.filter(us => us.sticker_id === selectedSticker.id).length - 1)} Dups
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Sticker Insights</h4>
                                    <p className="text-sm text-slate-400 leading-relaxed bg-slate-950/20 p-4 rounded-xl border border-white/5">
                                        {selectedSticker.description || (
                                            selectedSticker.category === 'Legends' ? `One of the most decorated personalities in world football. Adorned in the World Cup history book, representing supreme skill, loyalty, and unmatched prestige.` :
                                            selectedSticker.category === 'National Teams' ? `An essential squad selection for the upcoming FIFA 2026 World Cup tournament. Leading their national dream and fighting for international glory.` :
                                            selectedSticker.category === 'Host Cities' ? `An official host city of the FIFA 2026 World Cup. Ready to welcome millions of fans and embrace world-class games in local neighborhoods.` :
                                            selectedSticker.category === 'Stadiums' ? `An official host stadium of the World Cup. Featuring state-of-the-art facilities, historical soccer matches, and elite cheering fans.` :
                                            `Universal honors representing the peak of football achievements. The gold standard that every player and nation on Earth burns to lift.`
                                        )}
                                    </p>
                                </div>

                                {user?.id === 'admin' && (
                                    <div
                                        className="space-y-3 border-t border-white/5 pt-3"
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex gap-2">
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    setUploading(true);
                                                    try {
                                                        const reader = new FileReader();
                                                        reader.onload = async () => {
                                                            const base64 = reader.result as string;
                                                            const res = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': 'admin' }, body: JSON.stringify({ stickerId: selectedSticker.id, image: base64 }) });
                                                            const data = await res.json();
                                                            if (data.error) { toast.error(data.error); return; }
                                                            setMasterStickers(prev => prev.map(s => s.id === selectedSticker.id ? { ...s, image: data.url, image_position: 'center center' } : s));
                                                            setSelectedSticker(prev => prev ? { ...prev, image: data.url, image_position: 'center center' } : prev);
                                                            toast.success('Photo uploaded');
                                                        };
                                                        reader.readAsDataURL(file);
                                                    } catch { toast.error('Upload failed'); }
                                                    setUploading(false);
                                                    e.target.value = '';
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    setSearching(true);
                                                    setSearchCandidates([]);
                                                    try {
                                                        const res = await fetch(`/api/admin/image-search?q=${encodeURIComponent(selectedSticker.name + (selectedSticker.country ? ' ' + selectedSticker.country : ''))}`, { headers: { 'x-user-id': 'admin' } });
                                                        const data = await res.json();
                                                        if (data.error) { toast.error(data.error); return; }
                                                        setSearchCandidates(data.candidates || []);
                                                    } catch { toast.error('Search failed'); }
                                                    setSearching(false);
                                                }}
                                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-3 rounded-xl text-xs uppercase tracking-wider transition-all"
                                            >
                                                {searching ? 'Searching...' : 'Fetch Image'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    fileInputRef.current?.click();
                                                }}
                                                className="flex-1 bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300 font-bold py-2 px-3 rounded-xl text-xs uppercase tracking-wider transition-all"
                                            >
                                                {uploading ? 'Uploading...' : 'Upload Photo'}
                                            </button>
                                            {selectedSticker.image && (
                                                <button
                                                    type="button"
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        await fetch('/api/admin/remove-image', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': 'admin' }, body: JSON.stringify({ stickerId: selectedSticker.id }) });
                                                        setMasterStickers(prev => prev.map(s => s.id === selectedSticker.id ? { ...s, image: undefined, image_position: undefined } : s));
                                                        setSelectedSticker({ ...selectedSticker, image: undefined, image_position: undefined });
                                                        setDragPos(null);
                                                        toast.success('Image override removed');
                                                    }}
                                                    className="bg-red-900/50 hover:bg-red-800 text-red-300 font-bold py-2 px-3 rounded-xl text-xs uppercase tracking-wider transition-all"
                                                >
                                                    Reset
                                                </button>
                                            )}
                                        </div>
                                        {searchCandidates.length > 0 && (
                                            <div className="max-h-48 overflow-y-auto grid grid-cols-4 gap-2 p-2 bg-slate-950/50 rounded-xl border border-white/5">
                                                {searchCandidates.map((c, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            const res = await fetch('/api/admin/set-image', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': 'admin' }, body: JSON.stringify({ stickerId: selectedSticker.id, imageUrl: c.url, position: 'center center' }) });
                                                            const data = await res.json();
                                                            if (data.error) { toast.error(data.error); return; }
                                                            setMasterStickers(prev => prev.map(s => s.id === selectedSticker.id ? { ...s, image: c.url, image_position: 'center center' } : s));
                                                            setSelectedSticker(prev => prev ? { ...prev, image: c.url, image_position: 'center center' } : prev);
                                                            setDragPos(null);
                                                            setSearchCandidates([]);
                                                            toast.success(`Set image: ${c.title}`);
                                                        }}
                                                        className="aspect-[4/5] rounded-lg overflow-hidden border-2 border-transparent hover:border-indigo-500 transition-all bg-slate-800"
                                                    >
                                                        <img
                                                            src={c.thumb}
                                                            alt={c.title}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Image Position Controls (drag the image above to pan) */}
                                        {getStickerPhotoUrl(selectedSticker.id, selectedSticker.category, selectedSticker.image) && (
                                            <div className="flex gap-2 items-center text-[10px] font-mono text-slate-500">
                                                <span className="uppercase tracking-wider">Drag image to pan</span>
                                                {dragPos && (
                                                    <span className="text-indigo-400">
                                                        {Math.round(dragPos.x)}% / {Math.round(dragPos.y)}%
                                                    </span>
                                                )}
                                                <div className="flex-1" />
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        if (!dragPos || savingPosition) return;
                                                        setSavingPosition(true);
                                                        const pos = dragPos;
                                                        const posStr = `${Math.round(pos.x)}% ${Math.round(pos.y)}%`;
                                                        fetch('/api/admin/set-image-position', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': 'admin' }, body: JSON.stringify({ stickerId: selectedSticker.id, position: posStr }) })
                                                            .then(() => {
                                                                setMasterStickers(prev => prev.map(s => s.id === selectedSticker.id ? { ...s, image_position: posStr } : s));
                                                                setSelectedSticker(prev => prev ? { ...prev, image_position: posStr } : prev);
                                                                setDragPos(null);
                                                                toast.success(`Saved position: ${posStr}`);
                                                            })
                                                            .catch(() => toast.error('Failed to save position'))
                                                            .finally(() => setSavingPosition(false));
                                                    }}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                                                    className={`font-bold py-1.5 px-2.5 rounded-lg uppercase tracking-wider transition-all select-none ${!dragPos || savingPosition ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-indigo-700 hover:bg-indigo-600 text-white cursor-pointer'}`}
                                                >
                                                    {savingPosition ? 'Saving...' : 'Save Position'}
                                                </div>
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        if (savingPosition) return;
                                                        setSavingPosition(true);
                                                        fetch('/api/admin/set-image-position', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': 'admin' }, body: JSON.stringify({ stickerId: selectedSticker.id, position: '50% 50%' }) })
                                                            .then(() => {
                                                                setMasterStickers(prev => prev.map(s => s.id === selectedSticker.id ? { ...s, image_position: '50% 50%' } : s));
                                                                setSelectedSticker(prev => prev ? { ...prev, image_position: '50% 50%' } : prev);
                                                                setDragPos(null);
                                                                toast.success('Position reset to center');
                                                            })
                                                            .catch(() => toast.error('Failed to reset position'))
                                                            .finally(() => setSavingPosition(false));
                                                    }}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                                                    className={`font-bold py-1.5 px-2.5 rounded-lg uppercase tracking-wider transition-all select-none ${savingPosition ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer'}`}
                                                >
                                                    Reset Pos
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <button
                                        className="flex-1 bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                                        onClick={() => { setSelectedSticker(null); setDragPos(null); }}
                                        id="close-overview-btn"
                                    >
                                        Close Overview
                                    </button>
                                    {userStickers.some(us => us.sticker_id === selectedSticker.id) ? (
                                        <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2.5 rounded-xl border border-emerald-500/20 flex items-center gap-2 text-xs font-bold uppercase">
                                            <CheckCircle2 className="h-4 w-4" /> Discovered
                                        </div>
                                    ) : (
                                        <a 
                                            href="/packs" 
                                            onClick={() => setSelectedSticker(null)}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider text-center flex-1 transition-all"
                                            id="buy-packs-redirect-btn"
                                        >
                                            Buy Packs to Unlock 🪙
                                        </a>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
