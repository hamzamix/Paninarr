import fs from 'fs';
import path from 'path';

type Question = {
  id: string;
  question: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Very Hard';
  correct_answer: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  xp_reward: number;
  language: 'en' | 'ar';
};

const dataDir = path.join(process.cwd(), 'data');
const filePath = path.join(dataDir, 'questions_seed.json');

const allQuestions: Question[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
console.log(`Loaded ${allQuestions.length} total entries (${allQuestions.filter(q => q.language === 'en').length} EN + ${allQuestions.filter(q => q.language === 'ar').length} AR)`);

const enQuestions = allQuestions.filter(q => q.language === 'en');
const arQuestions = allQuestions.filter(q => q.language === 'ar');

// Find and remove duplicates: Q282 (same as Q212)
const dupEnId = 'Q282';
const dupArId = 'AR_Q282';
const dupEn = enQuestions.find(q => q.id === dupEnId);
const dupAr = arQuestions.find(q => q.id === dupArId);
if (dupEn && dupAr) {
  const q212 = enQuestions.find(q => q.id === 'Q212');
  console.log(`Duplicate found: Q282 matches Q212 - both ask "${q212?.question}"`);
  console.log(`Removing ${dupEnId} and ${dupArId}`);
} else {
  console.log('No duplicate found to remove');
}

const filtered = allQuestions.filter(q => q.id !== dupEnId && q.id !== dupArId);
console.log(`After removing duplicates: ${filtered.length} entries`);

// Collect existing EN question texts for uniqueness check
const existingEnTexts = new Set(filtered.filter(q => q.language === 'en').map(q => q.question.toLowerCase()));

const difficultyXp: Record<string, number> = {
  'Easy': 10,
  'Medium': 25,
  'Hard': 50,
  'Very Hard': 75,
};

type QuestionPair = {
  en: Omit<Question, 'language'>;
  ar: Omit<Question, 'language'>;
};

function makePair(
  id: string,
  enQuestion: string,
  enCategory: string,
  enDifficulty: string,
  enCorrect: string,
  enA: string,
  enB: string,
  enC: string,
  enD: string,
  arQuestion: string,
  arCorrect: string,
  arA: string,
  arB: string,
  arC: string,
  arD: string,
): QuestionPair {
  const xp = difficultyXp[enDifficulty] || 10;
  return {
    en: { id, question: enQuestion, category: enCategory, difficulty: enDifficulty as any, correct_answer: enCorrect, option_a: enA, option_b: enB, option_c: enC, option_d: enD, xp_reward: xp },
    ar: { id: `AR_${id}`, question: arQuestion, category: enCategory, difficulty: enDifficulty as any, correct_answer: arCorrect, option_a: arA, option_b: arB, option_c: arC, option_d: arD, xp_reward: xp },
  };
}

const newPairs: QuestionPair[] = [
  // ===== World Cup 2026 (22) =====
  makePair('Q311', 'Which city will host the 2026 World Cup final?', 'World Cup 2026', 'Easy',
    'New York/New Jersey', 'Los Angeles', 'Dallas', 'New York/New Jersey', 'Mexico City',
    'أي مدينة ستستضيف نهائي كأس العالم 2026؟', 'نيويورك/نيوجيرسي', 'لوس أنجلوس', 'دالاس', 'نيويورك/نيوجيرسي', 'مكسيكو سيتي'),
  makePair('Q312', 'How many groups will there be in the 2026 World Cup?', 'World Cup 2026', 'Medium',
    '16', '8', '12', '16', '32',
    'كم عدد المجموعات في كأس العالم 2026؟', '16', '8', '12', '16', '32'),
  makePair('Q313', 'How many teams qualify from each group in the 2026 World Cup?', 'World Cup 2026', 'Easy',
    '2', '1', '2', '3', '4',
    'كم عدد الفرق التي تتأهل من كل مجموعة في كأس العالم 2026؟', '2', '1', '2', '3', '4'),
  makePair('Q314', 'Which US city will host matches at the 2026 World Cup in the Pacific Northwest?', 'World Cup 2026', 'Medium',
    'Seattle', 'San Francisco', 'Seattle', 'Los Angeles', 'Vancouver',
    'أي مدينة أمريكية ستستضيف مباريات كأس العالم 2026 في شمال غرب المحيط الهادئ؟', 'سياتل', 'سان فرانسيسكو', 'سياتل', 'لوس أنجلوس', 'فانكوفر'),
  makePair('Q315', 'Which Canadian city will host 2026 World Cup matches?', 'World Cup 2026', 'Easy',
    'Vancouver', 'Toronto', 'Vancouver', 'Montreal', 'Calgary',
    'أي مدينة كندية ستستضيف مباريات كأس العالم 2026؟', 'فانكوفر', 'تورونتو', 'فانكوفر', 'مونتريال', 'كالغاري'),
  makePair('Q316', 'Which Mexican stadium will host the opening match of the 2026 World Cup?', 'World Cup 2026', 'Hard',
    'Estadio Azteca', 'Estadio Azteca', 'Estadio BBVA', 'Estadio Akron', 'Estadio Universitario',
    'أي ملعب مكسيكي سيستضيف المباراة الافتتاحية لكأس العالم 2026؟', 'ملعب أزتيكا', 'ملعب أزتيكا', 'ملعب بي بي في إيه', 'ملعب أكرون', 'الملعب الجامعي'),
  makePair('Q317', 'Which of these is NOT a 2026 World Cup host city in the USA?', 'World Cup 2026', 'Medium',
    'Denver', 'Atlanta', 'Boston', 'Denver', 'Philadelphia',
    'أي من هذه ليست مدينة مضيفة لكأس العالم 2026 في الولايات المتحدة؟', 'دنفر', 'أتلانتا', 'بوسطن', 'دنفر', 'فيلادلفيا'),
  makePair('Q318', 'Which country will make its World Cup debut in 2026?', 'World Cup 2026', 'Medium',
    'Canada', 'Canada', 'Venezuela', 'Iceland', 'Panama',
    'أي دولة ستظهر لأول مرة في كأس العالم 2026؟', 'كندا', 'كندا', 'فنزويلا', 'آيسلندا', 'بنما'),
  makePair('Q319', 'How many matches will be played in the 2026 World Cup?', 'World Cup 2026', 'Hard',
    '104', '64', '80', '104', '128',
    'كم مباراة ستلعب في كأس العالم 2026؟', '104', '64', '80', '104', '128'),
  makePair('Q320', 'Which 2026 World Cup host city is home to the Mercedes-Benz Stadium?', 'World Cup 2026', 'Medium',
    'Atlanta', 'Atlanta', 'Dallas', 'Houston', 'Los Angeles',
    'أي مدينة مضيفة لكأس العالم 2026 هي موطن ملعب مرسيدس بنز؟', 'أتلانتا', 'أتلانتا', 'دالاس', 'هيوستن', 'لوس أنجلوس'),
  makePair('Q321', 'Which 2026 World Cup venue is known as "SoFi Stadium"?', 'World Cup 2026', 'Medium',
    'Los Angeles', 'Los Angeles', 'Dallas', 'Miami', 'Kansas City',
    'أي ملعب من ملاعب كأس العالم 2026 يُعرف باسم "ملعب سوفي"؟', 'لوس أنجلوس', 'لوس أنجلوس', 'دالاس', 'ميامي', 'كانساس سيتي'),
  makePair('Q322', 'Which AFC team qualified for the 2026 World Cup as Asian champions?', 'World Cup 2026', 'Hard',
    'Japan', 'Japan', 'South Korea', 'Saudi Arabia', 'Australia',
    'أي فريق آسيوي تأهل لكأس العالم 2026 كبطل آسيا؟', 'اليابان', 'اليابان', 'كوريا الجنوبية', 'المملكة العربية السعودية', 'أستراليا'),
  makePair('Q323', 'How many African teams will participate in the 2026 World Cup?', 'World Cup 2026', 'Hard',
    '9', '5', '9', '7', '11',
    'كم عدد المنتخبات الأفريقية التي ستشارك في كأس العالم 2026؟', '9', '5', '9', '7', '11'),
  makePair('Q324', 'Which 2026 World Cup venue has a retractable roof in Dallas?', 'World Cup 2026', 'Medium',
    'AT&T Stadium', 'AT&T Stadium', 'NRG Stadium', 'MetLife Stadium', 'Hard Rock Stadium',
    'أي ملعب من ملاعب كأس العالم 2026 له سقف قابل للطي في دالاس؟', 'ملعب إيه تي آند تي', 'ملعب إيه تي آند تي', 'ملعب إن آر جي', 'ملعب ميتلايف', 'ملعب هارد روك'),
  makePair('Q325', 'Which CONCACAF team will participate in its first World Cup in 2026?', 'World Cup 2026', 'Hard',
    'Honduras', 'Jamaica', 'Honduras', 'El Salvador', 'Costa Rica',
    'أي منتخب من الكونكاكاف سيشارك في أول كأس عالم له في 2026؟', 'هندوراس', 'جامايكا', 'هندوراس', 'السلفادور', 'كوستاريكا'),
  makePair('Q326', 'How many host cities does the 2026 World Cup have across three countries?', 'World Cup 2026', 'Medium',
    '16', '12', '14', '16', '18',
    'كم عدد المدن المضيفة لكأس العالم 2026 عبر ثلاث دول؟', '16', '12', '14', '16', '18'),
  makePair('Q327', 'Which 2026 World Cup venue will host the most matches?', 'World Cup 2026', 'Very Hard',
    'MetLife Stadium', 'SoFi Stadium', 'AT&T Stadium', 'MetLife Stadium', 'Estadio Azteca',
    'أي ملعب من ملاعب كأس العالم 2026 سيستضيف أكبر عدد من المباريات؟', 'ملعب ميتلايف', 'ملعب سوفي', 'ملعب إيه تي آند تي', 'ملعب ميتلايف', 'ملعب أزتيكا'),
  makePair('Q328', 'Which European nation will be making its World Cup debut in 2026?', 'World Cup 2026', 'Very Hard',
    'North Macedonia', 'Finland', 'North Macedonia', 'Iceland', 'Montenegro',
    'أي دولة أوروبية ستظهر لأول مرة في كأس العالم 2026؟', 'مقدونيا الشمالية', 'فنلندا', 'مقدونيا الشمالية', 'آيسلندا', 'الجبل الأسود'),
  makePair('Q329', 'What is the new round introduced in the 2026 World Cup knockout stage?', 'World Cup 2026', 'Medium',
    'Round of 32', 'Round of 32', 'Round of 24', 'Quarter-finals', 'Round of 40',
    'ما هو الدور الجديد الذي أُدخل في مرحلة خروج المغلوب بكأس العالم 2026؟', 'دور الـ32', 'دور الـ32', 'دور الـ24', 'ربع النهائي', 'دور الـ40'),
  makePair('Q330', 'Which of these 2026 World Cup host stadiums is located in Massachusetts?', 'World Cup 2026', 'Medium',
    'Gillette Stadium', 'Gillette Stadium', 'MetLife Stadium', 'Lincoln Financial Field', 'Hard Rock Stadium',
    'أي من ملاعب كأس العالم 2026 يقع في ماساتشوستس؟', 'ملعب جيليت', 'ملعب جيليت', 'ملعب ميتلايف', 'ملعب لينكولن فاينانشال', 'ملعب هارد روك'),
  makePair('Q331', 'Which African nation qualified for the 2026 World Cup as AFCON champion?', 'World Cup 2026', 'Hard',
    'Ivory Coast', 'Ivory Coast', 'Senegal', 'Nigeria', 'Morocco',
    'أي دولة أفريقية تأهلت لكأس العالم 2026 كبطلة لأمم أفريقيا؟', 'ساحل العاج', 'ساحل العاج', 'السنغال', 'نيجيريا', 'المغرب'),
  makePair('Q332', 'How many South American teams will compete in the 2026 World Cup?', 'World Cup 2026', 'Hard',
    '6', '4', '6', '5', '7',
    'كم عدد المنتخبات الأمريكية الجنوبية التي ستتنافس في كأس العالم 2026؟', '6', '4', '6', '5', '7'),

  // ===== Stadiums (10) =====
  makePair('Q333', 'Which stadium is known as "The Theatre of Dreams"?', 'Stadiums', 'Easy',
    'Old Trafford', 'Old Trafford', 'Anfield', 'Camp Nou', 'Wembley',
    'أي ملعب يُعرف باسم "مسرح الأحلام"؟', 'أولد ترافورد', 'أولد ترافورد', 'أنفيلد', 'كامب نو', 'ويمبلي'),
  makePair('Q334', 'In which country is the Maracanã stadium located?', 'Stadiums', 'Easy',
    'Brazil', 'Brazil', 'Argentina', 'Portugal', 'Spain',
    'في أي دولة يقع ملعب ماراكانا؟', 'البرازيل', 'البرازيل', 'الأرجنتين', 'البرتغال', 'إسبانيا'),
  makePair('Q335', 'What is the capacity of Camp Nou?', 'Stadiums', 'Medium',
    'Over 99,000', 'Over 99,000', 'Over 80,000', 'Over 90,000', 'Over 70,000',
    'ما هي سعة ملعب كامب نو؟', 'أكثر من 99,000', 'أكثر من 99,000', 'أكثر من 80,000', 'أكثر من 90,000', 'أكثر من 70,000'),
  makePair('Q336', 'Which stadium hosted the 1999 Champions League final?', 'Stadiums', 'Medium',
    'Camp Nou', 'Camp Nou', 'Old Trafford', 'Wembley', 'San Siro',
    'أي ملعب استضاف نهائي دوري أبطال أوروبا 1999؟', 'كامب نو', 'كامب نو', 'أولد ترافورد', 'ويمبلي', 'سان سيرو'),
  makePair('Q337', 'Which stadium is home to Liverpool FC?', 'Stadiums', 'Easy',
    'Anfield', 'Anfield', 'Goodison Park', 'Emirates', 'Stamford Bridge',
    'أي ملعب هو موطن نادي ليفربول؟', 'أنفيلد', 'أنفيلد', 'غوديسون بارك', 'الإمارات', 'ستامفورد بريدج'),
  makePair('Q338', 'In which city is the Parc des Princes stadium located?', 'Stadiums', 'Easy',
    'Paris', 'Paris', 'Lyon', 'Marseille', 'Monaco',
    'في أي مدينة يقع ملعب حديقة الأمراء؟', 'باريس', 'باريس', 'ليون', 'مارسيليا', 'موناكو'),
  makePair('Q339', 'Which stadium is known for its distinctive arch structure in London?', 'Stadiums', 'Easy',
    'Wembley Stadium', 'Wembley Stadium', 'Emirates Stadium', 'Tottenham Hotspur Stadium', 'Stamford Bridge',
    'أي ملعب يُعرف بهيكله المقوس المميز في لندن؟', 'ملعب ويمبلي', 'ملعب ويمبلي', 'ملعب الإمارات', 'ملعب توتنهام هوتسبير', 'ستامفورد بريدج'),
  makePair('Q340', 'Which German stadium has a transparent exterior that can change color?', 'Stadiums', 'Medium',
    'Allianz Arena', 'Allianz Arena', 'Olympiastadion', 'Signal Iduna Park', 'Volksparkstadion',
    'أي ملعب ألماني له واجهة شفافة يمكنها تغيير اللون؟', 'أليانز أرينا', 'أليانز أرينا', 'الملعب الأولمبي', 'سيغنال إيدونا بارك', 'فولكسباركستاديون'),
  makePair('Q341', 'Which Italian stadium is shared by AC Milan and Inter Milan?', 'Stadiums', 'Easy',
    'San Siro', 'San Siro', 'Stadio Olimpico', 'Juventus Stadium', 'Stadio San Paolo',
    'أي ملعب إيطالي مشترك بين إيه سي ميلان وإنتر ميلان؟', 'سان سيرو', 'سان سيرو', 'ملعب أولمبيكو', 'ملعب يوفنتوس', 'ملعب سان باولو'),
  makePair('Q342', 'What is the name of Atletico Madrid\'s home stadium?', 'Stadiums', 'Medium',
    'Metropolitano Stadium', 'Metropolitano Stadium', 'Santiago Bernabeu', 'Camp Nou', 'Mestalla',
    'ما اسم الملعب الرئيسي لأتلتيكو مدريد؟', 'ملعب ميتروبوليتانو', 'ملعب ميتروبوليتانو', 'سانتياغو برنابيو', 'كامب نو', 'ميستايا'),

  // ===== Rules (8) =====
  makePair('Q343', 'What does the abbreviation "VAR" stand for?', 'Rules', 'Easy',
    'Video Assistant Referee', 'Video Assistant Referee', 'Virtual Assistant Referee', 'Visual Action Replay', 'Verified Accurate Review',
    'ماذا يعني اختصار VAR؟', 'حكم الفيديو المساعد', 'حكم الفيديو المساعد', 'الحكم الافتراضي المساعد', 'إعادة الحركة البصرية', 'مراجعة دقيقة موثقة'),
  makePair('Q344', 'How many substitutions is a team allowed in a standard Premier League match?', 'Rules', 'Easy',
    '5', '3', '5', '4', '6',
    'كم عدد التبديلات المسموح بها لفريق في مباراة الدوري الإنجليزي الممتاز؟', '5', '3', '5', '4', '6'),
  makePair('Q345', 'What is the minimum distance a free kick wall must be from the ball?', 'Rules', 'Medium',
    '10 yards', '8 yards', '10 yards', '12 yards', '15 yards',
    'ما هي المسافة الدنيا التي يجب أن يكون عليها حائط الركلة الحرة من الكرة؟', '10 ياردات', '8 ياردات', '10 ياردات', '12 ياردة', '15 ياردة'),
  makePair('Q346', 'What happens if a goalkeeper touches the ball with their hand outside the penalty area?', 'Rules', 'Easy',
    'Free kick and possible card', 'Free kick and possible card', 'Penalty kick', 'Corner kick', 'Goal kick',
    'ماذا يحدث إذا لمست يد حارس المرمى الكرة خارج منطقة الجزاء؟', 'ركلة حرة وبطاقة محتملة', 'ركلة حرة وبطاقة محتملة', 'ركلة جزاء', 'ركلة ركنية', 'ركلة مرمى'),
  makePair('Q347', 'How long is extra time in a knockout match?', 'Rules', 'Easy',
    '30 minutes', '20 minutes', '30 minutes', '40 minutes', '15 minutes',
    'كم مدة الوقت الإضافي في مباراة خروج المغلوب؟', '30 دقيقة', '20 دقيقة', '30 دقيقة', '40 دقيقة', '15 دقيقة'),
  makePair('Q348', 'What color card indicates a player has been sent off?', 'Rules', 'Easy',
    'Red', 'Yellow', 'Blue', 'Red', 'Orange',
    'ما لون البطاقة التي تشير إلى طرد اللاعب؟', 'الأحمر', 'الأصفر', 'الأزرق', 'الأحمر', 'البرتقالي'),
  makePair('Q349', 'When was the back-pass rule (prohibiting goalkeepers from handling deliberate back-passes) introduced?', 'Rules', 'Hard',
    '1992', '1990', '1992', '1994', '1996',
    'متى تم تقديم قاعدة إرجاع الكرة للحارس (منع حراس المرمى من مسك الكرة المعادلة عن قصد)؟', '1992', '1990', '1992', '1994', '1996'),
  makePair('Q350', 'In the 2026 World Cup, how many points does a win give in the group stage?', 'Rules', 'Easy',
    '3', '2', '3', '4', '1',
    'في كأس العالم 2026، كم نقطة يمنح الفوز في دور المجموعات؟', '3', '2', '3', '4', '1'),

  // ===== History (10) =====
  makePair('Q351', 'In which year was FIFA founded?', 'History', 'Medium',
    '1904', '1904', '1900', '1908', '1912',
    'في أي عام تأسس الاتحاد الدولي لكرة القدم (الفيفا)؟', '1904', '1904', '1900', '1908', '1912'),
  makePair('Q352', 'Which country played in the first-ever international football match in 1872?', 'History', 'Hard',
    'Scotland', 'England', 'Scotland', 'Wales', 'Ireland',
    'أي دولة لعبت في أول مباراة دولية في التاريخ عام 1872؟', 'اسكتلندا', 'إنجلترا', 'اسكتلندا', 'ويلز', 'أيرلندا'),
  makePair('Q353', 'What was the original name of the FIFA World Cup trophy?', 'History', 'Medium',
    'Jules Rimet Trophy', 'Jules Rimet Trophy', 'World Cup Trophy', 'FIFA Cup', 'Golden Trophy',
    'ما هو الاسم الأصلي لكأس العالم؟', 'كأس جول ريميه', 'كأس جول ريميه', 'كأس العالم', 'كأس الفيفا', 'الكأس الذهبية'),
  makePair('Q354', 'Which country hosted the first Olympic football tournament in 1908?', 'History', 'Hard',
    'England', 'France', 'England', 'Greece', 'Italy',
    'أي دولة استضافت أول بطولة كرة قدم أولمبية في 1908؟', 'إنجلترا', 'فرنسا', 'إنجلترا', 'اليونان', 'إيطاليا'),
  makePair('Q355', 'When was the first FA Cup final played?', 'History', 'Hard',
    '1872', '1863', '1872', '1880', '1895',
    'متى أقيم أول نهائي لكأس الاتحاد الإنجليزي؟', '1872', '1863', '1872', '1880', '1895'),
  makePair('Q356', 'Which club has won the most English top-flight league titles overall?', 'History', 'Medium',
    'Manchester United', 'Liverpool', 'Manchester United', 'Arsenal', 'Everton',
    'أي نادٍ فاز بأكبر عدد من ألقاب الدوري الإنجليزي الممتاز عبر التاريخ؟', 'مانشستر يونايتد', 'ليفربول', 'مانشستر يونايتد', 'أرسنال', 'إيفرتون'),
  makePair('Q357', 'In which year were penalty shootouts introduced to the World Cup?', 'History', 'Medium',
    '1978', '1974', '1978', '1982', '1986',
    'في أي عام تم تقديم ركلات الترجيح في كأس العالم؟', '1978', '1974', '1978', '1982', '1986'),
  makePair('Q358', 'Which was the first professional football league in the world?', 'History', 'Medium',
    'The Football League (England)', 'The Football League (England)', 'Scottish Football League', 'Serie A', 'La Liga',
    'ما هو أول دوري كرة قدم احترافي في العالم؟', 'دوري كرة القدم الإنجليزي', 'دوري كرة القدم الإنجليزي', 'الدوري الاسكتلندي', 'الدوري الإيطالي', 'الدوري الإسباني'),
  makePair('Q359', 'Which country won the gold medal in football at the 1992 Barcelona Olympics?', 'History', 'Hard',
    'Spain', 'Spain', 'Argentina', 'Brazil', 'Nigeria',
    'أي دولة فازت بالميدالية الذهبية في كرة القدم في أولمبياد برشلونة 1992؟', 'إسبانيا', 'إسبانيا', 'الأرجنتين', 'البرازيل', 'نيجيريا'),
  makePair('Q360', 'What was the score of the 1954 World Cup final known as "The Miracle of Bern"?', 'History', 'Hard',
    '3-2', '3-2', '4-2', '2-1', '5-3',
    'ما هي نتيجة نهائي كأس العالم 1954 المعروفة باسم "معجزة برن"؟', '3-2', '3-2', '4-2', '2-1', '5-3'),

  // ===== Tactics (8) =====
  makePair('Q361', 'What does "Gegenpressing" mean in football tactics?', 'Tactics', 'Medium',
    'Counter-pressing after losing the ball', 'Counter-pressing after losing the ball', 'Defensive parking the bus', 'High defensive line', 'Long ball strategy',
    'ماذا يعني "غيغنبريسينغ" في تكتيكات كرة القدم؟', 'الضغط المضاد بعد فقدان الكرة', 'الضغط المضاد بعد فقدان الكرة', 'الدفاع بإيقاف الحافلة', 'خط دفاع مرتفع', 'استراتيجية الكرات الطويلة'),
  makePair('Q362', 'Which formation is commonly known as the classic English 4-4-2?', 'Tactics', 'Easy',
    'Four defenders, four midfielders, two forwards', 'Four defenders, four midfielders, two forwards', 'Three defenders, five midfielders, two forwards', 'Four defenders, three midfielders, three forwards', 'Five defenders, four midfielders, one forward',
    'أي تشكيل معروف باسم 4-4-2 الإنجليزي الكلاسيكي؟', 'أربعة مدافعين وأربعة لاعبي وسط ومهاجمين', 'أربعة مدافعين وأربعة لاعبي وسط ومهاجمين', 'ثلاثة مدافعين وخمسة لاعبي وسط ومهاجمين', 'أربعة مدافعين وثلاثة لاعبي وسط وثلاثة مهاجمين', 'خمسة مدافعين وأربعة لاعبي وسط ومهاجم واحد'),
  makePair('Q363', 'Which team popularized "Tiki-Taka" style of play?', 'Tactics', 'Easy',
    'Barcelona and Spain', 'Barcelona and Spain', 'Real Madrid', 'Bayern Munich', 'Manchester City',
    'أي فريق نشر أسلوب "تيكي تاكا" في اللعب؟', 'برشلونة وإسبانيا', 'برشلونة وإسبانيا', 'ريال مدريد', 'بايرن ميونخ', 'مانشستر سيتي'),
  makePair('Q364', 'What is a "False 9" in football?', 'Tactics', 'Medium',
    'A forward who drops deep into midfield', 'A forward who drops deep into midfield', 'A defender who plays as a forward', 'A goalkeeper who plays as a sweeper', 'A midfielder who stays forward',
    'ما هو "المهاجم الوهمي" (False 9) في كرة القدم؟', 'مهاجم يتراجع إلى وسط الملعب', 'مهاجم يتراجع إلى وسط الملعب', 'مدافع يلعب كمهاجم', 'حارس مرمى يلعب كليبرو', 'لاعب وسط يبقى في الأمام'),
  makePair('Q365', 'Who is credited with inventing "Total Football" (Totaalvoetbal)?', 'Tactics', 'Medium',
    'Rinus Michels', 'Johan Cruyff', 'Rinus Michels', 'Louis van Gaal', 'Pep Guardiola',
    'من يُنسب إليه اختراع "كرة القدم الشاملة" (توتال فوتبال)؟', 'رينوس ميتشلز', 'يوهان كرويف', 'رينوس ميتشلز', 'لويس فان خال', 'بيب غوارديولا'),
  makePair('Q366', 'What does the "Catenaccio" system emphasize?', 'Tactics', 'Medium',
    'Defensive solidity with a sweeper', 'Defensive solidity with a sweeper', 'Attacking flair with wingers', 'High pressing and quick passing', 'Possession-based play',
    'ماذا يؤكد نظام "كاتيناتشيو" الدفاعي؟', 'الصلابة الدفاعية مع ليبرو', 'الصلابة الدفاعية مع ليبرو', 'الإبداع الهجومي بالأجنحة', 'الضغط العالي والتمرير السريع', 'اللعب القائم على الاستحواذ'),
  makePair('Q367', 'In the 3-5-2 formation, how many defenders are there?', 'Tactics', 'Easy',
    '3', '3', '4', '5', '2',
    'في تشكيل 3-5-2، كم عدد المدافعين؟', '3', '3', '4', '5', '2'),
  makePair('Q368', 'What is a "Sweeper Keeper" concept introduced by Manuel Neuer?', 'Tactics', 'Hard',
    'A goalkeeper who acts as an extra defender outside the box', 'A goalkeeper who acts as an extra defender outside the box', 'A goalkeeper who never leaves the goal line', 'A goalkeeper who specializes in penalties', 'A goalkeeper who plays as a striker',
    'ما هو مفهوم "حارس المرمى الكاسح" الذي قدمه مانويل نوير؟', 'حارس مرمى يعمل كمدافع إضافي خارج المنطقة', 'حارس مرمى يعمل كمدافع إضافي خارج المنطقة', 'حارس مرمى لا يغادر خط المرمى أبداً', 'حارس مرمى متخصص في ركلات الجزاء', 'حارس مرمى يلعب كمهاجم'),

  // ===== International (10) =====
  makePair('Q369', 'Which country has won the most AFC Asian Cup titles?', 'International', 'Medium',
    'Japan', 'Saudi Arabia', 'Japan', 'Iran', 'South Korea',
    'أي دولة فازت بأكبر عدد من ألقاب كأس آسيا؟', 'اليابان', 'المملكة العربية السعودية', 'اليابان', 'إيران', 'كوريا الجنوبية'),
  makePair('Q370', 'Which country won the 2019 Africa Cup of Nations?', 'International', 'Medium',
    'Algeria', 'Senegal', 'Algeria', 'Nigeria', 'Tunisia',
    'أي دولة فازت بكأس أمم أفريقيا 2019؟', 'الجزائر', 'السنغال', 'الجزائر', 'نيجيريا', 'تونس'),
  makePair('Q371', 'Which national team is known as "La Albiceleste"?', 'International', 'Easy',
    'Argentina', 'Argentina', 'Uruguay', 'Chile', 'Colombia',
    'أي منتخب يُعرف باسم "لا ألبيسيليستي"؟', 'الأرجنتين', 'الأرجنتين', 'أوروغواي', 'تشيلي', 'كولومبيا'),
  makePair('Q372', 'Which country has won the most CONCACAF Gold Cup titles?', 'International', 'Medium',
    'Mexico', 'Mexico', 'USA', 'Costa Rica', 'Canada',
    'أي دولة فازت بأكبر عدد من ألقاب كأس الذهب للكونكاكاف؟', 'المكسيك', 'المكسيك', 'الولايات المتحدة', 'كوستاريكا', 'كندا'),
  makePair('Q373', 'How many teams participated in the 2024 Copa America?', 'International', 'Medium',
    '16', '12', '16', '10', '24',
    'كم عدد الفرق التي شاركت في كوبا أمريكا 2024؟', '16', '12', '16', '10', '24'),
  makePair('Q374', 'Which national team is called "The Black Stars"?', 'International', 'Easy',
    'Ghana', 'Ghana', 'Nigeria', 'Cameroon', 'Ivory Coast',
    'أي منتخب يُدعى "النجوم السوداء"؟', 'غانا', 'غانا', 'نيجيريا', 'الكاميرون', 'ساحل العاج'),
  makePair('Q375', 'Which team won the 2022 AFC Asian Cup?', 'International', 'Medium',
    'Qatar', 'Japan', 'Qatar', 'Iran', 'South Korea',
    'أي منتخب فاز بكأس آسيا 2022؟', 'قطر', 'اليابان', 'قطر', 'إيران', 'كوريا الجنوبية'),
  makePair('Q376', 'Which country won the first-ever Copa America in 1916?', 'International', 'Hard',
    'Uruguay', 'Uruguay', 'Argentina', 'Brazil', 'Chile',
    'أي دولة فازت بأول كوبا أمريكا في 1916؟', 'أوروغواي', 'أوروغواي', 'الأرجنتين', 'البرازيل', 'تشيلي'),
  makePair('Q377', 'What is the nickname of the Japanese national team?', 'International', 'Easy',
    'Samurai Blue', 'Samurai Blue', 'Blue Dragons', 'Red Suns', 'Asian Tigers',
    'ما هو لقب المنتخب الياباني لكرة القدم؟', 'الساموراي الأزرق', 'الساموراي الأزرق', 'التنانين الزرقاء', 'الشمس الحمراء', 'النمور الآسيوية'),
  makePair('Q378', 'Which OFC nation has qualified for the most FIFA World Cups?', 'International', 'Hard',
    'New Zealand', 'New Zealand', 'Australia', 'Fiji', 'Tahiti',
    'أي دولة من أوقيانوسيا تأهلت لمعظم كؤوس العالم؟', 'نيوزيلندا', 'نيوزيلندا', 'أستراليا', 'فيجي', 'تاهيتي'),

  // ===== Clubs (10) =====
  makePair('Q379', 'Which club has won the most La Liga titles?', 'International', 'Easy',
    'Real Madrid', 'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Athletic Bilbao',
    'أي نادٍ فاز بأكبر عدد من ألقاب الدوري الإسباني؟', 'ريال مدريد', 'ريال مدريد', 'برشلونة', 'أتلتيكو مدريد', 'أتلتيك بلباو'),
  makePair('Q380', 'Which Serie A team is nicknamed "I Bianconeri" (The White-Blacks)?', 'Clubs', 'Easy',
    'Juventus', 'Juventus', 'AC Milan', 'Inter Milan', 'Napoli',
    'أي فريق في الدوري الإيطالي يُلقب بـ "البيانكونيري"؟', 'يوفنتوس', 'يوفنتوس', 'إيه سي ميلان', 'إنتر ميلان', 'نابولي'),
  makePair('Q381', 'Which English club plays at the Emirates Stadium?', 'Clubs', 'Easy',
    'Arsenal', 'Arsenal', 'Chelsea', 'Tottenham', 'West Ham',
    'أي نادٍ إنجليزي يلعب في ملعب الإمارات؟', 'أرسنال', 'أرسنال', 'تشيلسي', 'توتنهام', 'وست هام'),
  makePair('Q382', 'Which Ligue 1 club has won the most French league titles?', 'Clubs', 'Medium',
    'Paris Saint-Germain', 'Paris Saint-Germain', 'Marseille', 'Monaco', 'Lyon',
    'أي نادٍ في الدوري الفرنسي فاز بأكبر عدد من ألقاب الدوري؟', 'باريس سان جيرمان', 'باريس سان جيرمان', 'مارسيليا', 'موناكو', 'ليون'),
  makePair('Q383', 'Which club has won the most Serie A titles?', 'Clubs', 'Easy',
    'Juventus', 'Juventus', 'AC Milan', 'Inter Milan', 'Roma',
    'أي نادٍ فاز بأكبر عدد من ألقاب الدوري الإيطالي؟', 'يوفنتوس', 'يوفنتوس', 'إيه سي ميلان', 'إنتر ميلان', 'روما'),
  makePair('Q384', 'Which club won the Premier League in the 2023-24 season?', 'Clubs', 'Easy',
    'Manchester City', 'Manchester City', 'Arsenal', 'Liverpool', 'Chelsea',
    'أي نادٍ فاز بالدوري الإنجليزي الممتاز في موسم 2023-24؟', 'مانشستر سيتي', 'مانشستر سيتي', 'أرسنال', 'ليفربول', 'تشيلسي'),
  makePair('Q385', 'Which Dutch club has won the most Eredivisie titles?', 'Clubs', 'Medium',
    'Ajax', 'Ajax', 'PSV Eindhoven', 'Feyenoord', 'AZ Alkmaar',
    'أي نادٍ هولندي فاز بأكبر عدد من ألقاب الدوري الهولندي؟', 'أياكس', 'أياكس', 'آيندهوفن', 'فينورد', 'ألكمار'),
  makePair('Q386', 'Which club is known as "Los Colchoneros" in Spain?', 'Clubs', 'Medium',
    'Atletico Madrid', 'Atletico Madrid', 'Real Madrid', 'Barcelona', 'Sevilla',
    'أي نادٍ يُعرف باسم "لوس كولتشونيروس" في إسبانيا؟', 'أتلتيكو مدريد', 'أتلتيكو مدريد', 'ريال مدريد', 'برشلونة', 'إشبيلية'),
  makePair('Q387', 'Which Portuguese club is known as "Os Três Grandes" (The Big Three) that includes Benfica and Porto?', 'Clubs', 'Medium',
    'Sporting CP', 'Sporting CP', 'Braga', 'Vitoria Guimaraes', 'Belenenses',
    'أي نادٍ برتغالي هو أحد "الثلاثة الكبار" مع بنفيكا وبورتو؟', 'سبورتينغ لشبونة', 'سبورتينغ لشبونة', 'براغا', 'فيتوريا غيماريش', 'بيلينينسيس'),
  makePair('Q388', 'Which club has won the most Bundesliga titles after Bayern Munich?', 'Clubs', 'Medium',
    'Borussia Dortmund', 'Borussia Dortmund', 'Werder Bremen', 'Borussia Monchengladbach', 'Hamburg',
    'أي نادٍ فاز بأكبر عدد من ألقاب البوندسليغا بعد بايرن ميونخ؟', 'بوروسيا دورتموند', 'بوروسيا دورتموند', 'فيردر بريمن', 'بوروسيا مونشنغلادباخ', 'هامبورغ'),

  // ===== Records (8) =====
  makePair('Q389', 'Who has scored the most goals in a single Premier League season (38 games)?', 'Records', 'Medium',
    'Erling Haaland', 'Erling Haaland', 'Mohamed Salah', 'Alan Shearer', 'Harry Kane',
    'من سجل أكبر عدد من الأهداف في موسم واحد من الدوري الإنجليزي الممتاز (38 مباراة)؟', 'إيرلينغ هالاند', 'إيرلينغ هالاند', 'محمد صلاح', 'آلان شيرر', 'هاري كين'),
  makePair('Q390', 'Which player has made the most appearances in Premier League history?', 'Records', 'Medium',
    'Gareth Barry', 'Ryan Giggs', 'Gareth Barry', 'Frank Lampard', 'James Milner',
    'أي لاعب لديه أكبر عدد من المشاركات في تاريخ الدوري الإنجليزي الممتاز؟', 'غاريث باري', 'ريان غيغز', 'غاريث باري', 'فرانك لامبارد', 'جيمس ميلنر'),
  makePair('Q391', 'Who holds the record for the fastest hat-trick in Premier League history?', 'Records', 'Hard',
    'Sadio Mane', 'Sadio Mane', 'Robbie Fowler', 'Sergio Aguero', 'Harry Kane',
    'من يحمل الرقم القياسي لأسرع هاتريك في تاريخ الدوري الإنجليزي الممتاز؟', 'ساديو ماني', 'ساديو ماني', 'روبي فاولر', 'سيرجيو أغويرو', 'هاري كين'),
  makePair('Q392', 'Which nation holds the record for the longest unbeaten run in international football?', 'Records', 'Hard',
    'Spain', 'Brazil', 'Spain', 'Argentina', 'Italy',
    'أي دولة تحمل الرقم القياسي لأطول سلسلة لا هزيمة في كرة القدم الدولية؟', 'إسبانيا', 'البرازيل', 'إسبانيا', 'الأرجنتين', 'إيطاليا'),
  makePair('Q393', 'Who is the youngest player to score in a FIFA World Cup match?', 'Records', 'Medium',
    'Pele', 'Pele', 'Kylian Mbappe', 'Lionel Messi', 'Michael Owen',
    'من هو أصغر لاعب يسجل في مباراة بكأس العالم؟', 'بيليه', 'بيليه', 'كيليان مبابي', 'ليونيل ميسي', 'مايكل أوين'),
  makePair('Q394', 'Which goalkeeper has kept the most clean sheets in World Cup history?', 'Records', 'Medium',
    'Manuel Neuer', 'Manuel Neuer', 'Gianluigi Buffon', 'Iker Casillas', 'Peter Shilton',
    'أي حارس مرمى حافظ على أكبر عدد من الشباك النظيفة في تاريخ كأس العالم؟', 'مانويل نوير', 'مانويل نوير', 'جانلويجي بوفون', 'إيكر كاسياس', 'بيتر شيلتون'),
  makePair('Q395', 'What is the record attendance for a football match?', 'Records', 'Hard',
    '199,854', '150,000', '199,854', '174,000', '120,000',
    'ما هو الرقم القياسي لحضور مباراة كرة قدم؟', '199,854', '150,000', '199,854', '174,000', '120,000'),
  makePair('Q396', 'Which player has won the most FIFA World Cup matches?', 'Records', 'Medium',
    'Miroslav Klose', 'Miroslav Klose', 'Pele', 'Lothar Matthaus', 'Lionel Messi',
    'أي لاعب فاز بأكبر عدد من مباريات كأس العالم؟', 'ميروسلاف كلوزه', 'ميروسلاف كلوزه', 'بيليه', 'لوثار ماتيوس', 'ليونيل ميسي'),

  // ===== Awards (6) =====
  makePair('Q397', 'Which award is given to the top scorer of the World Cup?', 'Awards', 'Easy',
    'Golden Boot', 'Golden Boot', 'Golden Ball', 'Golden Glove', 'Golden Boy',
    'ما الجائزة التي تُمنح لهداف كأس العالم؟', 'الحذاء الذهبي', 'الحذاء الذهبي', 'الكرة الذهبية', 'القفاز الذهبي', 'الفتى الذهبي'),
  makePair('Q398', 'Who won the Ballon d\'Or in 2021?', 'Awards', 'Easy',
    'Lionel Messi', 'Lionel Messi', 'Robert Lewandowski', 'Karim Benzema', 'Jorginho',
    'من فاز بالكرة الذهبية في 2021؟', 'ليونيل ميسي', 'ليونيل ميسي', 'روبرت ليفاندوفسكي', 'كريم بنزيما', 'جورجينيو'),
  makePair('Q399', 'Who won the Ballon d\'Or in 2022?', 'Awards', 'Easy',
    'Karim Benzema', 'Karim Benzema', 'Lionel Messi', 'Erling Haaland', 'Kylian Mbappe',
    'من فاز بالكرة الذهبية في 2022؟', 'كريم بنزيما', 'كريم بنزيما', 'ليونيل ميسي', 'إيرلينغ هالاند', 'كيليان مبابي'),
  makePair('Q400', 'Which award is given to the best young player at the World Cup?', 'Awards', 'Easy',
    'Best Young Player Award', 'Golden Boot', 'Golden Glove', 'Best Young Player Award', 'Golden Ball',
    'ما الجائزة التي تُمنح لأفضل لاعب شاب في كأس العالم؟', 'جائزة أفضل لاعب شاب', 'الحذاء الذهبي', 'القفاز الذهبي', 'جائزة أفضل لاعب شاب', 'الكرة الذهبية'),
  makePair('Q401', 'Who won the FIFA Puskas Award in 2023 for the best goal?', 'Awards', 'Hard',
    'Guilherme Madruga', 'Guilherme Madruga', 'Kylian Mbappe', 'Nuno Santos', 'Iván Morante',
    'من فاز بجائزة بوشكاش من الفيفا في 2023 لأفضل هدف؟', 'غييرمي مادروغا', 'غييرمي مادروغا', 'كيليان مبابي', 'نونو سانتوس', 'إيفان مورانتي'),
  makePair('Q402', 'How many Ballon d\'Or awards has Lionel Messi won as of 2025?', 'Awards', 'Easy',
    '8', '7', '8', '6', '9',
    'كم عدد جوائز الكرة الذهبية التي فاز بها ليونيل ميسي حتى 2025؟', '8', '7', '8', '6', '9'),

  // ===== Legends (9) =====
  makePair('Q403', 'Which Brazilian legend is known as "O Fenômeno" (The Phenomenon)?', 'Legends', 'Easy',
    'Ronaldo Nazario', 'Ronaldo Nazario', 'Pele', 'Ronaldinho', 'Kaka',
    'أي أسطورة برازيلية تُعرف باسم "الظاهرة"؟', 'رونالدو نازاريو', 'رونالدو نازاريو', 'بيليه', 'رونالدينيو', 'كاكا'),
  makePair('Q404', 'Which English striker scored 260 Premier League goals, the most in the competition?', 'Legends', 'Easy',
    'Alan Shearer', 'Alan Shearer', 'Harry Kane', 'Wayne Rooney', 'Frank Lampard',
    'أي مهاجم إنجليزي سجل 260 هدفاً في الدوري الإنجليزي الممتاز، الأكثر في المسابقة؟', 'آلان شيرر', 'آلان شيرر', 'هاري كين', 'واين روني', 'فرانك لامبارد'),
  makePair('Q405', 'Which Dutch legend won the Ballon d\'Or three times (1988, 1989, 1992)?', 'Legends', 'Medium',
    'Marco van Basten', 'Marco van Basten', 'Johan Cruyff', 'Ruud Gullit', 'Dennis Bergkamp',
    'أي أسطورة هولندية فازت بالكرة الذهبية ثلاث مرات (1988، 1989، 1992)؟', 'ماركو فان باستن', 'ماركو فان باستن', 'يوهان كرويف', 'رود خوليت', 'دينيس بيرغكامب'),
  makePair('Q406', 'Which German player is known as "Der Kaiser" (The Emperor)?', 'Legends', 'Easy',
    'Franz Beckenbauer', 'Franz Beckenbauer', 'Gerd Muller', 'Lothar Matthaus', 'Karl-Heinz Rummenigge',
    'أي لاعب ألماني يُعرف باسم "القيصر"؟', 'فرانتس بيكنباور', 'فرانتس بيكنباور', 'غيرد مولر', 'لوثار ماتيوس', 'كارل هاينز رومينغه'),
  makePair('Q407', 'Which Italian defender played his entire career at AC Milan from 1984 to 2009?', 'Legends', 'Medium',
    'Paolo Maldini', 'Paolo Maldini', 'Franco Baresi', 'Alessandro Nesta', 'Fabio Cannavaro',
    'أي مدافع إيطالي لعب مسيرته الكاملة في إيه سي ميلان من 1984 إلى 2009؟', 'باولو مالديني', 'باولو مالديني', 'فرانكو باريزي', 'أليساندرو نيستا', 'فابيو كانافارو'),
  makePair('Q408', 'Which Liberian footballer won the Ballon d\'Or in 1995 and later became president?', 'Legends', 'Medium',
    'George Weah', 'George Weah', 'Samuel Eto\'o', 'Didier Drogba', 'Roger Milla',
    'أي لاعب كرة قدم ليبيري فاز بالكرة الذهبية في 1995 وأصبح رئيساً لاحقاً؟', 'جورج وياه', 'جورج وياه', 'صامويل إيتو', 'ديدييه دروغبا', 'روجيه ميلا'),
  makePair('Q409', 'Which French legend scored three goals in the 1998 World Cup final?', 'Legends', 'Easy',
    'Zinedine Zidane', 'Zinedine Zidane', 'Thierry Henry', 'Youri Djorkaeff', 'Emmanuel Petit',
    'أي أسطورة فرنسية سجل ثلاثة أهداف في نهائي كأس العالم 1998؟', 'زين الدين زيدان', 'زين الدين زيدان', 'تييري هنري', 'يوري دجوركاييف', 'إيمانويل بوتي'),
  makePair('Q410', 'Which Portuguese legend won the Ballon d\'Or in 1965 and is known as the "Black Panther"?', 'Legends', 'Hard',
    'Eusebio', 'Eusebio', 'Luis Figo', 'Cristiano Ronaldo', 'Rui Costa',
    'أي أسطورة برتغالية فاز بالكرة الذهبية في 1965 ويُعرف باسم "النمر الأسود"؟', 'أوزيبيو', 'أوزيبيو', 'لويس فيغو', 'كريستيانو رونالدو', 'روي كوستا'),
  makePair('Q411', 'Which Argentine legend scored 91 goals in a calendar year (2012)?', 'Legends', 'Easy',
    'Lionel Messi', 'Lionel Messi', 'Diego Maradona', 'Gabriel Batistuta', 'Alfredo Di Stefano',
    'أي أسطورة أرجنتينية سجل 91 هدفاً في سنة تقويمية واحدة (2012)؟', 'ليونيل ميسي', 'ليونيل ميسي', 'دييغو مارادونا', 'غابرييل باتيستوتا', 'ألفريدو دي ستيفانو'),
];

// Verify no duplicates in new questions
const newEnTexts = new Set<string>();
const dupes: string[] = [];
for (const p of newPairs) {
  const text = p.en.question.toLowerCase();
  if (newEnTexts.has(text) || existingEnTexts.has(text)) {
    dupes.push(text);
  }
  newEnTexts.add(text);
}

if (dupes.length > 0) {
  console.error(`ERROR: Duplicate questions found: ${dupes.join(', ')}`);
  process.exit(1);
}

// Build the output
const output: Question[] = [...filtered];

const enStartingCount = filtered.filter(q => q.language === 'en').length;

for (const p of newPairs) {
  output.push({ ...p.en, language: 'en' });
  output.push({ ...p.ar, language: 'ar' });
}

// Do a final uniqueness check on question text
const finalEnTexts = new Set<string>();
const finalDupes: string[] = [];
for (const q of output.filter(q => q.language === 'en')) {
  const text = q.question.toLowerCase();
  if (finalEnTexts.has(text)) {
    finalDupes.push(q.id + ': ' + q.question);
  }
  finalEnTexts.add(text);
}

if (finalDupes.length > 0) {
  console.error(`FATAL: Final duplicate EN questions found: ${finalDupes.join('\n')}`);
  process.exit(1);
}

fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf8');

const finalEnCount = output.filter(q => q.language === 'en').length;
const finalArCount = output.filter(q => q.language === 'ar').length;

console.log('\n========= SUMMARY =========');
console.log(`Duplicates removed: Q282 and AR_Q282`);
console.log(`New EN questions added: ${newPairs.length}`);
console.log(`New AR questions added: ${newPairs.length}`);
console.log(`Total entries written: ${output.length}`);
console.log(`Final EN questions: ${finalEnCount}`);
console.log(`Final AR questions: ${finalArCount}`);
console.log(`Final unique stems (EN): ${finalEnCount}`);
console.log(`Category breakdown:`);
const cats: Record<string, number> = {};
for (const p of newPairs) {
  cats[p.en.category] = (cats[p.en.category] || 0) + 1;
}
for (const [cat, count] of Object.entries(cats).sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${cat}: ${count}`);
}
console.log('==========================');
