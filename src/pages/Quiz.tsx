import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';

type Question = {
    id: string;
    question: string;
    category: string;
    difficulty: string;
    correct_answer: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    xp_reward: number;
    language: 'en' | 'ar';
}

type Lang = 'en' | 'ar';

export default function Quiz() {
    const { user, refreshUser } = useAuth();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [lang, setLang] = useState<Lang>(() => {
        if (typeof window === 'undefined') return 'en';
        const saved = localStorage.getItem('wc_quiz_lang');
        return saved === 'ar' ? 'ar' : 'en';
    });
    const [stats, setStats] = useState<{ en: number; ar: number }>({ en: 0, ar: 0 });

    useEffect(() => {
        if (!user?.id) return;
        loadQuestions();
    }, [user?.id, lang]);

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = lang;
        }
    }, [lang]);

    const loadQuestions = () => {
        setLoading(true);
        api.get(`/questions/random?lang=${lang}`, user!.id)
           .then(data => {
               setQuestions(data.questions);
               setCurrentIndex(0);
               setSelected(null);
           })
           .catch(console.error)
           .finally(() => setLoading(false));
    }

    const changeLang = (newLang: Lang) => {
        if (newLang === lang) return;
        localStorage.setItem('wc_quiz_lang', newLang);
        setLang(newLang);
    };

    const handleSelect = async (opt: string) => {
        if (selected || isChecking) return;
        
        // Capture the current question reference immediately
        const currentQIndex = currentIndex;
        const q = questions[currentQIndex];
        
        setSelected(opt);
        setIsChecking(true);
        
        try {
            const data = await api.post('/questions/answer', { questionId: q.id, selectedOption: opt }, user!.id);
            if (data.correct) {
                 toast.success(`Correct! +${data.xpEarned} XP & +${data.coinsEarned} Coins 🪙`);
            } else {
                 toast.error(`Wrong! Correct answer was: ${data.correctAnswer}`);
            }
            await refreshUser();
        } catch(e) {
            console.error("Failed to reward quiz response:", e);
            toast.error("Error submitting answer.");
        }

        setTimeout(() => {
             if (currentQIndex < questions.length - 1) {
                 setCurrentIndex(currentQIndex + 1);
                 setSelected(null);
                 setIsChecking(false);
             } else {
                 toast.success('Tournament Quiz Session Complete!');
                 loadQuestions();
                 // loadQuestions resets currentIndex to 0 and selected to null
                 setIsChecking(false);
              }
         }, 1800);
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4 animate-pulse">
                <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
                <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">
                    {lang === 'ar' ? 'جاري تحميل أسئلة المباراة...' : 'Loading match day questions...'}
                </p>
            </div>
        );
    }

    if (questions.length === 0) {
        return (
            <div className="text-center py-20 bg-slate-900/30 rounded-[2rem] border border-white/5 border-dashed">
                <p className="text-slate-400 font-bold">
                    {lang === 'ar' ? 'لا توجد أسئلة متاحة. يرجى المراجعة لاحقاً.' : 'No trivia questions ready. Please check back later.'}
                </p>
            </div>
        );
    }

    const currentQ = questions[currentIndex];
    const options = [currentQ.option_a, currentQ.option_b, currentQ.option_c, currentQ.option_d];

    return (
        <div className="space-y-8 max-w-2xl mx-auto pt-6">
            <header className="text-center">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#10B981] mb-2 block">Interactive Stadium Trivia</span>
                <h1 className="text-3xl lg:text-4xl font-black text-white uppercase italic tracking-tight">
                    {lang === 'ar' ? 'اختبار كرة القدم' : 'Football Quiz'}
                </h1>
                <p className="text-sm text-slate-400 font-medium">
                    {lang === 'ar' ? 'اكسب العملات اليومية ونقاط الخبرة من خلال الإجابة على أسئلة تاريخ كرة القدم وكأس العالم.' : 'Earn daily coins and experience points by compiling correct historic football world cup matches answers.'}
                </p>

                {/* Language Selector */}
                <div className="mt-6 inline-flex items-center gap-2 bg-slate-900/60 border border-white/10 rounded-full p-1">
                    <button
                        type="button"
                        onClick={() => changeLang('en')}
                        className={`px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${lang === 'en' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        English
                    </button>
                    <button
                        type="button"
                        onClick={() => changeLang('ar')}
                        className={`px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${lang === 'ar' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        العربية
                    </button>
                </div>

                <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-wider font-extrabold bg-slate-900/60 border border-white/5 p-4 rounded-2xl">
                    <span className="text-emerald-400">
                        {lang === 'ar' ? `سؤال ${currentIndex + 1} / ${questions.length}` : `Match Trivia ${currentIndex + 1} / ${questions.length}`}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                        currentQ.difficulty === 'Hard' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        currentQ.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                        {currentQ.difficulty} (+{currentQ.xp_reward} XP)
                    </span>
                </div>
            </header>

            <Card className="bg-slate-900/60 border border-white/10 p-6 rounded-[2rem] backdrop-blur-md shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 rounded-full blur-[40px] pointer-events-none" />
                <CardContent className="pt-6 relative z-10">
                    <h2 className="text-xl md:text-2xl font-black text-white mb-8 text-center italic leading-snug uppercase tracking-tight">{currentQ.question}</h2>
                    <div className="grid grid-cols-1 gap-4">
                        {options.map((opt, i) => {
                             let optClass = "bg-slate-950 border-white/5 text-slate-300 hover:border-emerald-500 hover:bg-slate-900/40 hover:text-white";
                             if (selected) {
                                 if (opt === currentQ.correct_answer) {
                                     optClass = "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
                                  } else if (opt === selected) {
                                     optClass = "bg-red-500/20 border-red-500 text-red-400";
                                  } else {
                                     optClass = "bg-slate-950/40 border-white/5 text-slate-600 opacity-40";
                                  }
                             }
                             return (
                                 <Button 
                                     key={i}
                                     variant="outline"
                                     className={`h-auto py-4 px-6 text-left justify-start whitespace-normal font-bold rounded-2xl uppercase tracking-tight text-sm transition-all duration-200 ${optClass}`}
                                     onClick={() => handleSelect(opt)}
                                     disabled={!!selected}
                                 >
                                     <span className="opacity-45 mr-3 font-mono">0{i+1}.</span> {opt}
                                 </Button>
                             )
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
