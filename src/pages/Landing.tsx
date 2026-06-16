import React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Trophy, ShieldCheck, Sparkles, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const TEAMS = [
  'Argentina', 'Brazil', 'France', 'England', 'Spain', 'Portugal', 'Germany', 'Netherlands',
  'Belgium', 'Croatia', 'Uruguay', 'Colombia', 'Morocco', 'Japan', 'Switzerland', 'United States',
  'Mexico', 'Senegal', 'South Korea', 'Iran', 'Sweden', 'Norway', 'Türkiye', 'Ecuador',
  'Paraguay', 'Algeria', 'Egypt', 'Ivory Coast', 'Ghana', 'Saudi Arabia', 'Australia', 'New Zealand',
  'Scotland', 'Austria', 'Czechia', 'Canada', 'Tunisia', 'Qatar', 'Jordan', 'Iraq',
  'Uzbekistan', 'South Africa', 'Bosnia and Herzegovina', 'Cabo Verde', 'Curaçao', 'Haiti', 'DR Congo', 'Panama'
];

export default function Landing() {
  const { register, login, user } = useAuth();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState('');
  const [predictedWinner, setPredictedWinner] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFavDropdown, setShowFavDropdown] = useState(false);
  const [showPredDropdown, setShowPredDropdown] = useState(false);

  React.useEffect(() => {
    if (user) {
        navigate('/dashboard');
    }
  }, [user, navigate]);

  if (user) {
      return null;
  }

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!nickname.trim()) return;
      setLoading(true);
      const success = await register(nickname, favoriteTeam || undefined, predictedWinner || undefined);
      setLoading(false);
      if (success) {
          toast.success("Welcome aboard! Saved recovery code in local storage.");
          navigate('/dashboard');
      }
      else toast.error("Failed to create profile. Try a different nickname.");
  }

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!recoveryCode.trim()) return;
      setLoading(true);
      const success = await login(recoveryCode);
      setLoading(false);
      if (success) {
          toast.success("Account successfully recovered!");
          navigate('/dashboard');
      }
      else toast.error("Invalid recovery code sequence.");
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic ambient lights */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="z-10 w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-3">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5 shadow-2xl">
                <div className="w-full h-full rounded-[1.4rem] bg-slate-950 flex items-center justify-center">
                    <Trophy className="h-7 w-7 text-emerald-400" />
                </div>
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">World Cup 2026</h1>
            <p className="text-xs font-mono uppercase text-slate-400 tracking-[0.2em] font-bold">Digital Sticker Challenge</p>
        </div>

        <Card className="bg-slate-900/60 border border-white/10 backdrop-blur-md rounded-[2rem] shadow-2xl overflow-hidden">
          <Tabs defaultValue="new" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-950/80 p-1 border-b border-white/5">
              <TabsTrigger value="new" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 font-black rounded-xl uppercase py-2.5 text-xs tracking-wider transition-all">New Player</TabsTrigger>
              <TabsTrigger value="returning" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 font-black rounded-xl uppercase py-2.5 text-xs tracking-wider transition-all">Returning</TabsTrigger>
            </TabsList>
            
            <TabsContent value="new" className="outline-none">
              <form onSubmit={handleRegister}>
                <CardHeader>
                  <CardTitle className="text-2xl font-black uppercase italic tracking-tight text-white flex items-center gap-2">
                     <Sparkles className="h-5 w-5 text-emerald-400" /> Create Profile
                  </CardTitle>
                  <CardDescription className="text-slate-400 font-medium">
                    No traditional password required. We will automatically generate your recovery code credential keys.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="nickname" className="text-xs font-bold uppercase tracking-wider text-slate-400">Choose Username Nickname</label>
                    <Input 
                        id="nickname" 
                        placeholder="e.g. Hamza" 
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="bg-slate-950 border-white/5 text-white rounded-xl py-6 px-4 h-auto font-bold placeholder:text-slate-600 focus:border-emerald-500 transition-colors"
                        maxLength={20}
                    />
                  </div>

                  {/* Favorite Team Selector */}
                  <div className="space-y-2 relative">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Favorite Team</label>
                    <button
                      type="button"
                      onClick={() => { setShowFavDropdown(!showFavDropdown); setShowPredDropdown(false); }}
                      className="w-full bg-slate-950 border border-white/10 text-white rounded-xl py-4 px-4 h-auto font-bold text-left flex items-center justify-between hover:border-emerald-500/40 transition-all cursor-pointer"
                    >
                      <span className={favoriteTeam ? 'text-white' : 'text-slate-600'}>{favoriteTeam || 'Select your favorite team...'}</span>
                      <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${showFavDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showFavDropdown && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl max-h-48 overflow-y-auto shadow-2xl backdrop-blur-md">
                        <button type="button" onClick={() => { setFavoriteTeam(''); setShowFavDropdown(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-500 hover:bg-slate-800 hover:text-white font-bold transition-all">— None —</button>
                        {TEAMS.map(t => (
                          <button key={t} type="button" onClick={() => { setFavoriteTeam(t); setShowFavDropdown(false); }} className="w-full text-left px-4 py-2 text-xs text-white hover:bg-emerald-500/10 hover:text-emerald-400 font-bold transition-all">{t}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Predicted Winner Selector */}
                  <div className="space-y-2 relative">
                    <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Trophy className="h-3 w-3" /> Predict 2026 World Cup Winner
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowPredDropdown(!showPredDropdown); setShowFavDropdown(false); }}
                      className="w-full bg-slate-950 border border-amber-500/30 text-white rounded-xl py-4 px-4 h-auto font-bold text-left flex items-center justify-between hover:border-amber-500/60 transition-all cursor-pointer"
                    >
                      <span className={predictedWinner ? 'text-amber-400' : 'text-slate-600'}>{predictedWinner || 'Who will win the World Cup?'}</span>
                      <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${showPredDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showPredDropdown && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl max-h-48 overflow-y-auto shadow-2xl backdrop-blur-md">
                        <button type="button" onClick={() => { setPredictedWinner(''); setShowPredDropdown(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-500 hover:bg-slate-800 hover:text-white font-bold transition-all">— None —</button>
                        {TEAMS.map(t => (
                          <button key={t} type="button" onClick={() => { setPredictedWinner(t); setShowPredDropdown(false); }} className="w-full text-left px-4 py-2 text-xs text-white hover:bg-amber-500/10 hover:text-amber-400 font-bold transition-all">{t}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button type="submit" disabled={loading || nickname.length < 3} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl uppercase tracking-wider py-5 h-auto transition-transform hover:scale-[1.02]">
                    {loading ? "Registering..." : "Start Collecting Stickers"}
                  </Button>
                  {predictedWinner && (
                    <p className="text-[10px] text-slate-500 font-mono text-center">Your prediction: <span className="text-amber-400 font-bold">{predictedWinner}</span> &middot; Correct = Ultimate Champion badge unlocks all stickers!</p>
                  )}
                </CardFooter>
              </form>
            </TabsContent>
            
            <TabsContent value="returning" className="outline-none">
              <form onSubmit={handleLogin}>
                <CardHeader>
                  <CardTitle className="text-2xl font-black uppercase italic tracking-tight text-white flex items-center gap-2">
                     <ShieldCheck className="h-5 w-5 text-indigo-400" /> Restore Account
                  </CardTitle>
                  <CardDescription className="text-slate-400 font-medium">
                    State your custom generated 16-character challenge account key sequence.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="code" className="text-xs font-bold uppercase tracking-wider text-slate-400">Recovery Credential Code</label>
                    <Input 
                        id="code" 
                        placeholder="WC26-XXXX-XXXX-XXXX" 
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                        className="bg-slate-950 border-white/5 text-white font-mono uppercase rounded-xl py-6 px-4 h-auto font-bold placeholder:text-slate-600 focus:border-[#10B981] transition-colors"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={loading || recoveryCode.length < 10} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl uppercase tracking-wider py-5 h-auto transition-transform hover:scale-[1.02]">
                    {loading ? "Restoring Access..." : "Claim Existing Profile"}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
