export interface CountryMetadata {
    flag: string;
    code: string;
    colors: string[];
    emoji: string;
}

export const COUNTRY_DATA: { [key: string]: CountryMetadata } = {
    'United States': { flag: 'us', code: 'USA', colors: ['#3C3B6E', '#FFFFFF', '#B22234'], emoji: '🇺🇸' },
    'Mexico': { flag: 'mx', code: 'MEX', colors: ['#006847', '#FFFFFF', '#C8102E'], emoji: '🇲🇽' },
    'Canada': { flag: 'ca', code: 'CAN', colors: ['#FF0000', '#FFFFFF', '#FF0000'], emoji: '🇨🇦' },
    'Argentina': { flag: 'ar', code: 'ARG', colors: ['#75AADB', '#FFFFFF', '#75AADB'], emoji: '🇦🇷' },
    'Brazil': { flag: 'br', code: 'BRA', colors: ['#009739', '#FEDF00', '#002776'], emoji: '🇧🇷' },
    'France': { flag: 'fr', code: 'FRA', colors: ['#002395', '#FFFFFF', '#ED2939'], emoji: '🇫🇷' },
    'England': { flag: 'gb-eng', code: 'ENG', colors: ['#FFFFFF', '#CE1124', '#FFFFFF'], emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    'Spain': { flag: 'es', code: 'ESP', colors: ['#C11B17', '#FBBF24', '#C11B17'], emoji: '🇪🇸' },
    'Portugal': { flag: 'pt', code: 'POR', colors: ['#046A38', '#DA291C'], emoji: '🇵🇹' },
    'Germany': { flag: 'de', code: 'GER', colors: ['#000000', '#FF0000', '#FFCC00'], emoji: '🇩🇪' },
    'Netherlands': { flag: 'nl', code: 'NED', colors: ['#AE1C28', '#FFFFFF', '#21468B', '#F17300'], emoji: '🇳🇱' },
    'Belgium': { flag: 'be', code: 'BEL', colors: ['#000000', '#FDDA24', '#EF3340'], emoji: '🇧🇪' },
    'Uruguay': { flag: 'uy', code: 'URU', colors: ['#0038A8', '#FFFFFF', '#FCD116'], emoji: '🇺🇾' },
    'Colombia': { flag: 'co', code: 'COL', colors: ['#FCD116', '#0038A8', '#CE1124'], emoji: '🇨🇴' },
    'Morocco': { flag: 'ma', code: 'MAR', colors: ['#C1272D', '#006233', '#C1272D'], emoji: '🇲🇦' },
    'Senegal': { flag: 'sn', code: 'SEN', colors: ['#00853F', '#FDEF42', '#E31B23'], emoji: '🇸🇳' },
    'Japan': { flag: 'jp', code: 'JPN', colors: ['#FFFFFF', '#BC002D', '#FFFFFF'], emoji: '🇯🇵' },
    'South Korea': { flag: 'kr', code: 'KOR', colors: ['#FFFFFF', '#CD2E3A', '#0047A0'], emoji: '🇰🇷' },
    'Australia': { flag: 'au', code: 'AUS', colors: ['#012169', '#FF0000', '#FFFFFF', '#00843D', '#FFCD00'], emoji: '🇦🇺' },
    'Croatia': { flag: 'hr', code: 'CRO', colors: ['#FF0000', '#FFFFFF', '#171796'], emoji: '🇭🇷' },
    'Switzerland': { flag: 'ch', code: 'SUI', colors: ['#D52B1E', '#FFFFFF', '#D52B1E'], emoji: '🇨🇭' },
    'Sweden': { flag: 'se', code: 'SWE', colors: ['#006AA7', '#FECC00'], emoji: '🇸🇪' },
    'Austria': { flag: 'at', code: 'AUT', colors: ['#ED2939', '#FFFFFF', '#ED2939'], emoji: '🇦🇹' },
    'Turkey': { flag: 'tr', code: 'TUR', colors: ['#E30A17', '#FFFFFF'], emoji: '🇹🇷' },
    'Türkiye': { flag: 'tr', code: 'TUR', colors: ['#E30A17', '#FFFFFF'], emoji: '🇹🇷' },
    'Scotland': { flag: 'gb-sct', code: 'SCO', colors: ['#005EB8', '#FFFFFF'], emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
    'Ecuador': { flag: 'ec', code: 'ECU', colors: ['#FFD100', '#003F87', '#EF3340'], emoji: '🇪🇨' },
    'Paraguay': { flag: 'py', code: 'PAR', colors: ['#D52B1E', '#FFFFFF', '#0038A8'], emoji: '🇵🇾' },
    'Algeria': { flag: 'dz', code: 'ALG', colors: ['#006633', '#FFFFFF', '#D21034'], emoji: '🇩🇿' },
    'Egypt': { flag: 'eg', code: 'EGY', colors: ['#C8102E', '#FFFFFF', '#000000'], emoji: '🇪🇬' },
    'Ivory Coast': { flag: 'ci', code: 'CIV', colors: ['#F77F00', '#FFFFFF', '#009E60'], emoji: '🇨🇮' },
    'Ghana': { flag: 'gh', code: 'GHA', colors: ['#CE1124', '#FCD116', '#006B3F'], emoji: '🇬🇭' },
    'Saudi Arabia': { flag: 'sa', code: 'KSA', colors: ['#006C35', '#FFFFFF'], emoji: '🇸🇦' },
    'Iran': { flag: 'ir', code: 'IRN', colors: ['#239F40', '#FFFFFF', '#DA121A'], emoji: '🇮🇷' },
    'New Zealand': { flag: 'nz', code: 'NZL', colors: ['#000000', '#FFFFFF', '#C8102E'], emoji: '🇳🇿' },
    'Norway': { flag: 'no', code: 'NOR', colors: ['#BA0C2F', '#FFFFFF', '#003087'], emoji: '🇳🇴' },
    'Bosnia and Herzegovina': { flag: 'ba', code: 'BIH', colors: ['#001F3F', '#FECB00', '#FFFFFF'], emoji: '🇧🇦' },
    'Cabo Verde': { flag: 'cv', code: 'CPV', colors: ['#003893', '#FFFFFF', '#CF2027', '#F7D116'], emoji: '🇨🇻' },
    'Curaçao': { flag: 'cw', code: 'CUW', colors: ['#002B7F', '#FFFFFF', '#FED141'], emoji: '🇨🇼' },
    'Czechia': { flag: 'cz', code: 'CZE', colors: ['#11457E', '#FFFFFF', '#D7141A'], emoji: '🇨🇿' },
    'DR Congo': { flag: 'cd', code: 'COD', colors: ['#007FFF', '#CE1126', '#F7D618'], emoji: '🇨🇩' },
    'Haiti': { flag: 'ht', code: 'HAI', colors: ['#00209F', '#D21034', '#FFFFFF'], emoji: '🇭🇹' },
    'Iraq': { flag: 'iq', code: 'IRQ', colors: ['#CE1126', '#FFFFFF', '#007A3D'], emoji: '🇮🇶' },
    'Jordan': { flag: 'jo', code: 'JOR', colors: ['#CE1126', '#FFFFFF', '#007A3D', '#000000'], emoji: '🇯🇴' },
    'Panama': { flag: 'pa', code: 'PAN', colors: ['#FFFFFF', '#CE1126', '#005294'], emoji: '🇵🇦' },
    'Qatar': { flag: 'qa', code: 'QAT', colors: ['#8C1B1B', '#FFFFFF'], emoji: '🇶🇦' },
    'South Africa': { flag: 'za', code: 'RSA', colors: ['#DE3831', '#FFFFFF', '#002395', '#FFB81C', '#007A4D'], emoji: '🇿🇦' },
    'Tunisia': { flag: 'tn', code: 'TUN', colors: ['#E70013', '#FFFFFF'], emoji: '🇹🇳' },
    'Uzbekistan': { flag: 'uz', code: 'UZB', colors: ['#0099B5', '#FFFFFF', '#1EB53A', '#CE1126'], emoji: '🇺🇿' },
    'International': { flag: 'un', code: 'INT', colors: ['#10B981', '#6366F1'], emoji: '⚽' }
};

export const getFlagImgUrl = (countryName: string): string => {
    const data = COUNTRY_DATA[countryName];
    if (!data) return '';
    return `https://flagcdn.com/w80/${data.flag}.png`;
};

export const getCountryCode = (countryName: string): string => {
    const data = COUNTRY_DATA[countryName];
    return data ? data.code : countryName.toUpperCase().slice(0, 3);
};
