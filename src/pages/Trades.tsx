import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, ArrowRightLeft, RefreshCw, UserCheck, Package, CheckCircle2, Lock, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { getStickerPhotoUrl } from '../utils/stickerImages';

type Sticker = {
    id: string;
    sticker_id: string;
    name: string;
    category: string;
    rarity: string;
    is_duplicate: number;
    country?: string;
    description?: string;
    image?: string;
}

const TEAM_FLAGS: Record<string, string> = {
    'United States': '🇺🇸', 'Mexico': '🇲🇽', 'Canada': '🇨🇦',
    'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'France': '🇫🇷',
    'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Spain': '🇪🇸', 'Portugal': '🇵🇹',
    'Germany': '🇩🇪', 'Netherlands': '🇳🇱', 'Belgium': '🇧🇪',
    'Uruguay': '🇺🇾', 'Colombia': '🇨🇴', 'Morocco': '🇲🇦',
    'Senegal': '🇸🇳', 'Japan': '🇯🇵', 'South Korea': '🇰🇷',
    'Australia': '🇦🇺', 'Croatia': '🇭🇷', 'Switzerland': '🇨🇭',
    'Sweden': '🇸🇪', 'Austria': '🇦🇹', 'Turkey': '🇹🇷',
    'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Ecuador': '🇪🇨', 'Paraguay': '🇵🇾',
    'Algeria': '🇩🇿', 'Egypt': '🇪🇬', 'Ivory Coast': '🇨🇮',
    'Ghana': '🇬🇭', 'Saudi Arabia': '🇸🇦', 'Iran': '🇮🇷',
    'New Zealand': '🇳🇿', 'Bosnia and Herzegovina': '🇧🇦',
    'Cabo Verde': '🇨🇻', 'Curaçao': '🇨🇼', 'Czechia': '🇨🇿',
    'DR Congo': '🇨🇩', 'Haiti': '🇭🇹', 'Iraq': '🇮🇶',
    'Jordan': '🇯🇴', 'Panama': '🇵🇦', 'Qatar': '🇶🇦',
    'South Africa': '🇿🇦', 'Tunisia': '🇹🇳', 'Uzbekistan': '🇺🇿',
    'International': '⚽'
};

const TEAM_FLAG_COLORS: Record<string, string[]> = {
    'United States': ['#3C3B6E', '#FFFFFF', '#B22234'],
    'Mexico': ['#006847', '#FFFFFF', '#C8102E'],
    'Canada': ['#FF0000', '#FFFFFF', '#FF0000'],
    'Argentina': ['#75AADB', '#FFFFFF', '#75AADB'],
    'Brazil': ['#009739', '#FEDF00', '#002776'],
    'France': ['#002395', '#FFFFFF', '#ED2939'],
    'England': ['#FFFFFF', '#CE1124', '#FFFFFF'],
    'Spain': ['#C11B17', '#FBBF24', '#C11B17'],
    'Portugal': ['#046A38', '#DA291C'],
    'Germany': ['#000000', '#FF0000', '#FFCC00'],
    'Netherlands': ['#AE1C28', '#FFFFFF', '#21468B', '#F17300'],
    'Belgium': ['#000000', '#FDDA24', '#EF3340'],
    'Uruguay': ['#0038A8', '#FFFFFF', '#FCD116'],
    'Colombia': ['#FCD116', '#0038A8', '#CE1124'],
    'Morocco': ['#C1272D', '#006233', '#C1272D'],
    'Senegal': ['#00853F', '#FDEF42', '#E31B23'],
    'Japan': ['#FFFFFF', '#BC002D', '#FFFFFF'],
    'South Korea': ['#FFFFFF', '#CD2E3A', '#0047A0'],
    'Australia': ['#012169', '#FF0000', '#FFFFFF', '#00843D', '#FFCD00'],
    'Croatia': ['#FF0000', '#FFFFFF', '#171796'],
    'Switzerland': ['#D52B1E', '#FFFFFF', '#D52B1E'],
    'Sweden': ['#006AA7', '#FECC00'],
    'Austria': ['#ED2939', '#FFFFFF', '#ED2939'],
    'Turkey': ['#E30A17', '#FFFFFF'],
    'Scotland': ['#005EB8', '#FFFFFF'],
    'Ecuador': ['#FFD100', '#003F87', '#EF3340'],
    'Paraguay': ['#D52B1E', '#FFFFFF', '#0038A8'],
    'Algeria': ['#006633', '#FFFFFF', '#D21034'],
    'Egypt': ['#C8102E', '#FFFFFF', '#000000'],
    'Ivory Coast': ['#F77F00', '#FFFFFF', '#009E60'],
    'Ghana': ['#CE1124', '#FCD116', '#006B3F'],
    'Saudi Arabia': ['#006C35', '#FFFFFF'],
    'Iran': ['#239F40', '#FFFFFF', '#DA121A'],
    'New Zealand': ['#000000', '#FFFFFF', '#C8102E'],
    'Bosnia and Herzegovina': ['#001F3F', '#FECB00', '#FFFFFF'],
    'Cabo Verde': ['#003893', '#FFFFFF', '#CF2027', '#F7D116'],
    'Curaçao': ['#002B7F', '#FFFFFF', '#FED141'],
    'Czechia': ['#11457E', '#FFFFFF', '#D7141A'],
    'DR Congo': ['#007FFF', '#CE1126', '#F7D618'],
    'Haiti': ['#00209F', '#D21034', '#FFFFFF'],
    'Iraq': ['#CE1126', '#FFFFFF', '#007A3D'],
    'Jordan': ['#CE1126', '#FFFFFF', '#007A3D', '#000000'],
    'Panama': ['#FFFFFF', '#CE1126', '#005294'],
    'Qatar': ['#8C1B1B', '#FFFFFF'],
    'South Africa': ['#DE3831', '#FFFFFF', '#002395', '#FFB81C', '#007A4D'],
    'Tunisia': ['#E70013', '#FFFFFF'],
    'Uzbekistan': ['#0099B5', '#FFFFFF', '#1EB53A', '#CE1126'],
    'International': ['#10B981', '#6366F1']
};

const rarityStyles: Record<string, string> = {
    Legendary: 'bg-amber-500 text-slate-950',
    Epic: 'bg-purple-500 text-white',
    Rare: 'bg-blue-500 text-white',
    Common: 'bg-slate-800 text-slate-300'
};

export default function Trades() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const needStickerId = searchParams.get('need');
    const [stickers, setStickers] = useState<Sticker[]>([]);
    const [searchVal, setSearchVal] = useState('');
    const [searchResults, setSearchResults] = useState<any[] | null>(null);
    const [swapData, setSwapData] = useState<{ needSticker: any; options: any[] } | null>(null);
    const [loadingSwap, setLoadingSwap] = useState(false);
    const [executingSwap, setExecutingSwap] = useState<string | null>(null);
    const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);

    useEffect(() => {
        if (!user?.id) return;
        api.get('/my-stickers', user.id)
           .then(data => setStickers(data.userStickers || []))
           .catch(console.error);
    }, [user?.id]);

    useEffect(() => {
        if (!needStickerId || !user?.id) {
            setSwapData(null);
            return;
        }
        setLoadingSwap(true);
        api.post('/swaps/find', { stickerId: needStickerId }, user.id)
           .then(data => setSwapData(data))
           .catch(err => toast.error(err.message))
           .finally(() => setLoadingSwap(false));
    }, [needStickerId, user?.id]);

    const dupMap = new Map<string, { sticker: Sticker; count: number }>();
    for (const s of stickers) {
      const key = s.sticker_id;
      if (dupMap.has(key)) { dupMap.get(key)!.count++; }
      else { dupMap.set(key, { sticker: s, count: 1 }); }
    }
    const duplicates = Array.from(dupMap.values()).filter(d => d.count >= 2).map(d => ({ ...d.sticker, is_duplicate: d.count }));

    const handleSearch = () => {
        if (!searchVal.trim()) {
            toast.error("Enter a collector's nickname");
            return;
        }
        setSearchResults([
            { nickname: 'FootballPro99', country: 'Brazil', level: 12, active_duplicates: ['S001', 'S003'], seeks: ['S002'] },
            { nickname: 'Messi_Fanatic', country: 'Argentina', level: 8, active_duplicates: ['S004', 'S005'], seeks: ['S001'] },
        ].filter(p => p.nickname.toLowerCase().includes(searchVal.toLowerCase())));
        toast.info(`Found collectors matching "${searchVal}"`);
    }

    const proposeTrade = (p: any) => {
        toast.success(`Trade proposal sent to ${p.nickname}!`);
    }

    const executeSwap = async (partnerUserId: string, partnerNickname: string, giveStickerId: string, giveName: string) => {
        if (!needStickerId || !user?.id || !partnerUserId) return;
        const key = `${partnerUserId}-${giveStickerId}`;
        setExecutingSwap(key);
        try {
            await api.post('/swaps/execute', { partnerUserId, myNeedStickerId: needStickerId, iGiveStickerId: giveStickerId }, user.id);
            toast.success(`Swapped! You got ${swapData?.needSticker?.name} and gave ${giveName} to ${partnerNickname}`);
            navigate('/catalog');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setExecutingSwap(null);
        }
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto pt-4 animate-in fade-in pb-12">

            {/* Header */}
            <header className="border-b border-white/10 pb-5">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-1.5 mb-2">
                   <ArrowRightLeft className="h-4 w-4" /> Global Swap Network
                </span>
                <h1 className="text-3xl lg:text-4xl font-black text-white uppercase italic tracking-tight">Trade Center</h1>
                <p className="text-sm text-slate-400 font-medium mt-1">Exchange duplicate stickers with collectors worldwide</p>
            </header>

            {/* Active swap flow banner when ?need= is set */}
            {needStickerId && swapData && (
                <div className="bg-gradient-to-r from-indigo-600/20 to-emerald-600/20 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-500/20 p-2 rounded-xl">
                            <Package className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Active Swap</p>
                            <p className="text-xs text-slate-400">
                                You need: <span className="text-emerald-400 font-bold">{swapData.needSticker?.name}</span>
                                {' '}({swapData.needSticker?.rarity})
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/catalog')}
                        className="text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 px-4 py-2 rounded-xl border border-white/10 font-bold uppercase tracking-wider transition-all cursor-pointer"
                    >
                        Back to Catalog
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main panel: Swap flow or search */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Swap options when ?need= is set */}
                    {needStickerId && swapData ? (
                        <div className="bg-slate-900/40 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden">
                            <div className="p-5 border-b border-white/5">
                                <h2 className="text-lg font-black uppercase text-white tracking-tight italic">Trading Partners</h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {swapData.options.length} collector{swapData.options.length !== 1 ? 's' : ''} have this sticker
                                </p>
                            </div>
                            {swapData.options.length === 0 ? (
                                <div className="py-16 text-center text-slate-500 px-6">
                                    <p className="text-slate-400 font-bold mb-1">No partners available</p>
                                    <p className="text-xs text-slate-500">No one has this sticker available for trade right now.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {swapData.options.map((group: any) => (
                                        <div key={group.partner.id} className="p-5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400">
                                                    {group.partner.nickname[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-white text-sm">{group.partner.nickname}</span>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                        <span>{TEAM_FLAGS[group.partner.country] || '⚽'} {group.partner.country}</span>
                                                        <span className="text-amber-400">Lv.{group.partner.level}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {group.trades.map((t: any) => (
                                                    <div key={t.giveSticker.id} className="flex items-center gap-3 bg-slate-950/60 border border-white/10 rounded-xl p-3 hover:border-emerald-500/30 transition-all">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${rarityStyles[t.giveSticker.rarity] || rarityStyles.Common}`}>
                                                                    {t.giveSticker.rarity}
                                                                </span>
                                                                <span className="text-xs font-bold text-white truncate">{t.giveSticker.name}</span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 font-mono">
                                                                {t.duplicatesCount}x dup &middot; {t.giveSticker.category}
                                                                {t.giveSticker.country && ` · ${t.giveSticker.country}`}
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={executingSwap === `${group.partner.id}-${t.giveSticker.id}`}
                                                            onClick={() => executeSwap(group.partner.id, group.partner.nickname, t.giveSticker.id, t.giveSticker.name)}
                                                            className="bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-wider h-auto flex-shrink-0 disabled:opacity-50 transition-all cursor-pointer"
                                                        >
                                                            {executingSwap === `${group.partner.id}-${t.giveSticker.id}` ? (
                                                                <RefreshCw className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                'Swap'
                                                            )}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : needStickerId && loadingSwap ? (
                        <div className="bg-slate-900/40 border border-white/10 rounded-2xl backdrop-blur-md p-12 text-center">
                            <RefreshCw className="h-6 w-6 text-emerald-400 animate-spin mx-auto mb-3" />
                            <p className="text-sm text-slate-400 font-medium">Searching for trading partners...</p>
                        </div>
                    ) : null}

                    {/* Search panel (shown always unless ?need= is active with data) */}
                    {(!needStickerId || !swapData) && (
                        <div className="bg-slate-900/40 border border-white/10 rounded-2xl backdrop-blur-md">
                            <div className="p-5 border-b border-white/5">
                                <h2 className="text-lg font-black uppercase text-white tracking-tight italic">Find Collectors</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Search by nickname to find trade partners</p>
                            </div>
                            <div className="p-5">
                                <div className="flex flex-col sm:flex-row gap-3 mb-5">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                        <input
                                            value={searchVal}
                                            onChange={(e) => setSearchVal(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            placeholder="Search nickname..."
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleSearch}
                                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl uppercase tracking-wider px-6 py-3 text-sm transition-all cursor-pointer"
                                    >
                                        Search
                                    </button>
                                </div>

                                {searchResults && searchResults.length > 0 ? (
                                    <div className="space-y-3">
                                        {searchResults.map((p, i) => (
                                            <div key={i} className="flex items-center justify-between bg-slate-950/50 border border-white/10 rounded-xl p-4 hover:border-indigo-500/30 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center text-sm font-black text-white">
                                                        {p.nickname[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-white text-sm block">{p.nickname}</span>
                                                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                                            <span>{TEAM_FLAGS[p.country] || '⚽'} {p.country}</span>
                                                            <span className="text-amber-400">Lv.{p.level}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => proposeTrade(p)}
                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer"
                                                >
                                                    Propose Swap
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : searchResults !== null ? (
                                    <div className="py-10 text-center text-slate-500 bg-slate-950/30 rounded-xl border border-white/5 border-dashed">
                                        <UserCheck className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                                        <p className="text-slate-400 font-bold text-sm">No collectors found</p>
                                        <p className="text-xs text-slate-500 mt-1">Try a different nickname</p>
                                    </div>
                                ) : (
                                    <div className="py-10 text-center text-slate-600 bg-slate-950/20 rounded-xl border border-white/5 border-dashed">
                                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm font-medium">Search the collector network</p>
                                        <p className="text-xs text-slate-600 mt-1">Find players who need your duplicate stickers</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar: Your duplicate inventory */}
                <div className="space-y-4">
                    <div className="bg-slate-900/40 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase text-white tracking-tight italic">Your Swap Cards</h3>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{duplicates.length}</span>
                        </div>
                        {duplicates.length > 0 ? (
                            <div className="p-4 max-h-[600px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-2">
                                {duplicates.map((sticker, i) => (
                                    <div key={i} onClick={() => setSelectedSticker(sticker)} className="flex items-center gap-3 bg-slate-950/50 border border-white/[0.07] rounded-xl p-2.5 hover:border-white/20 hover:bg-slate-900/80 transition-all group cursor-pointer">
                                        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                                            <img
                                                src={getStickerPhotoUrl(sticker.sticker_id, sticker.category, sticker.image)}
                                                alt={sticker.name}
                                                referrerPolicy="no-referrer"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
                                            {sticker.country && TEAM_FLAG_COLORS[sticker.country] && (
                                                <div className="absolute bottom-0 left-0 right-0 h-0.5 flex">
                                                    {TEAM_FLAG_COLORS[sticker.country].map((col, idx) => (
                                                        <div key={idx} className="flex-1" style={{ backgroundColor: col }} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded ${rarityStyles[sticker.rarity] || rarityStyles.Common}`}>
                                                    {sticker.rarity}
                                                </span>
                                                <span className="text-xs font-bold text-white truncate">{sticker.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                <span>{TEAM_FLAGS[sticker.country || ''] || '⚽'} {sticker.country || 'International'}</span>
                                                <span className="text-emerald-400 font-bold">{sticker.is_duplicate}x</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 text-center text-slate-500">
                                <Package className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                                <p className="text-sm font-bold text-slate-400">No duplicates yet</p>
                                <p className="text-[11px] text-slate-600 mt-1">Open packs to collect duplicate stickers for trading</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sticker Card Modal */}
            {selectedSticker && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedSticker(null)}>
                    <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-y-auto max-h-[90vh] max-w-lg w-full shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                        {/* Card Image */}
                        <div className="relative aspect-[16/10] bg-slate-950 overflow-hidden select-none">
                            <img
                                src={getStickerPhotoUrl(selectedSticker.sticker_id, selectedSticker.category, selectedSticker.image)}
                                alt={selectedSticker.name}
                                draggable={false}
                                className="w-full h-full object-cover"
                                style={{ objectPosition: 'center center' }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent pointer-events-none" />
                            <button
                                onClick={() => setSelectedSticker(null)}
                                className="absolute top-4 right-4 bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white p-2 rounded-full border border-white/15 transition-all text-sm font-bold cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <div className="absolute bottom-4 left-6 right-6 pointer-events-none">
                                <span className="text-[10px] font-mono uppercase bg-slate-950/70 border border-white/10 px-2 py-0.5 rounded tracking-widest text-emerald-400">
                                    {selectedSticker.sticker_id}
                                </span>
                                <h2 className="text-2xl font-black text-white uppercase italic tracking-tight mt-1">{selectedSticker.name}</h2>
                                <p className="text-xs text-slate-400 font-mono tracking-wide flex items-center gap-1.5 mt-1">
                                    <span>{selectedSticker.category}</span>
                                    {selectedSticker.country && (
                                        <>
                                            <span>•</span>
                                            <span>{selectedSticker.country}</span>
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 text-center">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Rarity</span>
                                    <span className={`text-[10px] uppercase py-0.5 px-2 rounded-full font-black ${rarityStyles[selectedSticker.rarity] || rarityStyles.Common}`}>
                                        {selectedSticker.rarity}
                                    </span>
                                </div>
                                <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 text-center">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Status</span>
                                    <span className="text-emerald-400 text-xs font-black uppercase flex items-center justify-center gap-1">
                                        <CheckCircle2 className="h-3 w-3 inline" /> Owned
                                    </span>
                                </div>
                                <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 text-center">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Duplicates</span>
                                    <span className="text-white text-xs font-black uppercase">
                                        {selectedSticker.is_duplicate}x
                                    </span>
                                </div>
                            </div>

                            {selectedSticker.description && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Sticker Insights</h4>
                                    <p className="text-sm text-slate-400 leading-relaxed bg-slate-950/20 p-4 rounded-xl border border-white/5">
                                        {selectedSticker.description}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setSelectedSticker(null)}
                                    className="flex-1 bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                                >
                                    Close
                                </button>
                                {!needStickerId && (
                                    <button
                                        onClick={() => {
                                            navigate(`/trades?need=${selectedSticker.sticker_id}`);
                                            setSelectedSticker(null);
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                        Need this Sticker?
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
