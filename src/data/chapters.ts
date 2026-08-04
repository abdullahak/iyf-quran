export type Chapter = {
  number: number;
  arabicName: string;
  englishName: string;
  meaning: string;
  ayahCount: number;
  revelationType: 'Meccan' | 'Medinan';
};

// Source: https://api.alquran.cloud/v1/surah
// Retrieved as build-time metadata; see THIRD_PARTY_NOTICES.md.
export const CHAPTERS: readonly Chapter[] = [
  {
    "number": 1,
    "arabicName": "سُورَةُ ٱلْفَاتِحَةِ",
    "englishName": "Al-Faatiha",
    "meaning": "The Opening",
    "ayahCount": 7,
    "revelationType": "Meccan"
  },
  {
    "number": 2,
    "arabicName": "سُورَةُ البَقَرَةِ",
    "englishName": "Al-Baqara",
    "meaning": "The Cow",
    "ayahCount": 286,
    "revelationType": "Medinan"
  },
  {
    "number": 3,
    "arabicName": "سُورَةُ آلِ عِمۡرَانَ",
    "englishName": "Aal-i-Imraan",
    "meaning": "The Family of Imraan",
    "ayahCount": 200,
    "revelationType": "Medinan"
  },
  {
    "number": 4,
    "arabicName": "سُورَةُ النِّسَاءِ",
    "englishName": "An-Nisaa",
    "meaning": "The Women",
    "ayahCount": 176,
    "revelationType": "Medinan"
  },
  {
    "number": 5,
    "arabicName": "سُورَةُ المَائـِدَةِ",
    "englishName": "Al-Maaida",
    "meaning": "The Table",
    "ayahCount": 120,
    "revelationType": "Medinan"
  },
  {
    "number": 6,
    "arabicName": "سُورَةُ الأَنۡعَامِ",
    "englishName": "Al-An'aam",
    "meaning": "The Cattle",
    "ayahCount": 165,
    "revelationType": "Meccan"
  },
  {
    "number": 7,
    "arabicName": "سُورَةُ الأَعۡرَافِ",
    "englishName": "Al-A'raaf",
    "meaning": "The Heights",
    "ayahCount": 206,
    "revelationType": "Meccan"
  },
  {
    "number": 8,
    "arabicName": "سُورَةُ الأَنفَالِ",
    "englishName": "Al-Anfaal",
    "meaning": "The Spoils of War",
    "ayahCount": 75,
    "revelationType": "Medinan"
  },
  {
    "number": 9,
    "arabicName": "سُورَةُ التَّوۡبَةِ",
    "englishName": "At-Tawba",
    "meaning": "The Repentance",
    "ayahCount": 129,
    "revelationType": "Medinan"
  },
  {
    "number": 10,
    "arabicName": "سُورَةُ يُونُسَ",
    "englishName": "Yunus",
    "meaning": "Jonas",
    "ayahCount": 109,
    "revelationType": "Meccan"
  },
  {
    "number": 11,
    "arabicName": "سُورَةُ هُودٍ",
    "englishName": "Hud",
    "meaning": "Hud",
    "ayahCount": 123,
    "revelationType": "Meccan"
  },
  {
    "number": 12,
    "arabicName": "سُورَةُ يُوسُفَ",
    "englishName": "Yusuf",
    "meaning": "Joseph",
    "ayahCount": 111,
    "revelationType": "Meccan"
  },
  {
    "number": 13,
    "arabicName": "سُورَةُ الرَّعۡدِ",
    "englishName": "Ar-Ra'd",
    "meaning": "The Thunder",
    "ayahCount": 43,
    "revelationType": "Medinan"
  },
  {
    "number": 14,
    "arabicName": "سُورَةُ إِبۡرَاهِيمَ",
    "englishName": "Ibrahim",
    "meaning": "Abraham",
    "ayahCount": 52,
    "revelationType": "Meccan"
  },
  {
    "number": 15,
    "arabicName": "سُورَةُ الحِجۡرِ",
    "englishName": "Al-Hijr",
    "meaning": "The Rock",
    "ayahCount": 99,
    "revelationType": "Meccan"
  },
  {
    "number": 16,
    "arabicName": "سُورَةُ النَّحۡلِ",
    "englishName": "An-Nahl",
    "meaning": "The Bee",
    "ayahCount": 128,
    "revelationType": "Meccan"
  },
  {
    "number": 17,
    "arabicName": "سُورَةُ الإِسۡرَاءِ",
    "englishName": "Al-Israa",
    "meaning": "The Night Journey",
    "ayahCount": 111,
    "revelationType": "Meccan"
  },
  {
    "number": 18,
    "arabicName": "سُورَةُ الكَهۡفِ",
    "englishName": "Al-Kahf",
    "meaning": "The Cave",
    "ayahCount": 110,
    "revelationType": "Meccan"
  },
  {
    "number": 19,
    "arabicName": "سُورَةُ مَرۡيَمَ",
    "englishName": "Maryam",
    "meaning": "Mary",
    "ayahCount": 98,
    "revelationType": "Meccan"
  },
  {
    "number": 20,
    "arabicName": "سُورَةُ طه",
    "englishName": "Taa-Haa",
    "meaning": "Taa-Haa",
    "ayahCount": 135,
    "revelationType": "Meccan"
  },
  {
    "number": 21,
    "arabicName": "سُورَةُ الأَنبِيَاءِ",
    "englishName": "Al-Anbiyaa",
    "meaning": "The Prophets",
    "ayahCount": 112,
    "revelationType": "Meccan"
  },
  {
    "number": 22,
    "arabicName": "سُورَةُ الحَجِّ",
    "englishName": "Al-Hajj",
    "meaning": "The Pilgrimage",
    "ayahCount": 78,
    "revelationType": "Medinan"
  },
  {
    "number": 23,
    "arabicName": "سُورَةُ المُؤۡمِنُونَ",
    "englishName": "Al-Muminoon",
    "meaning": "The Believers",
    "ayahCount": 118,
    "revelationType": "Meccan"
  },
  {
    "number": 24,
    "arabicName": "سُورَةُ النُّورِ",
    "englishName": "An-Noor",
    "meaning": "The Light",
    "ayahCount": 64,
    "revelationType": "Medinan"
  },
  {
    "number": 25,
    "arabicName": "سُورَةُ الفُرۡقَانِ",
    "englishName": "Al-Furqaan",
    "meaning": "The Criterion",
    "ayahCount": 77,
    "revelationType": "Meccan"
  },
  {
    "number": 26,
    "arabicName": "سُورَةُ الشُّعَرَاءِ",
    "englishName": "Ash-Shu'araa",
    "meaning": "The Poets",
    "ayahCount": 227,
    "revelationType": "Meccan"
  },
  {
    "number": 27,
    "arabicName": "سُورَةُ النَّمۡلِ",
    "englishName": "An-Naml",
    "meaning": "The Ant",
    "ayahCount": 93,
    "revelationType": "Meccan"
  },
  {
    "number": 28,
    "arabicName": "سُورَةُ القَصَصِ",
    "englishName": "Al-Qasas",
    "meaning": "The Stories",
    "ayahCount": 88,
    "revelationType": "Meccan"
  },
  {
    "number": 29,
    "arabicName": "سُورَةُ العَنكَبُوتِ",
    "englishName": "Al-Ankaboot",
    "meaning": "The Spider",
    "ayahCount": 69,
    "revelationType": "Meccan"
  },
  {
    "number": 30,
    "arabicName": "سُورَةُ الرُّومِ",
    "englishName": "Ar-Room",
    "meaning": "The Romans",
    "ayahCount": 60,
    "revelationType": "Meccan"
  },
  {
    "number": 31,
    "arabicName": "سُورَةُ لُقۡمَانَ",
    "englishName": "Luqman",
    "meaning": "Luqman",
    "ayahCount": 34,
    "revelationType": "Meccan"
  },
  {
    "number": 32,
    "arabicName": "سُورَةُ السَّجۡدَةِ",
    "englishName": "As-Sajda",
    "meaning": "The Prostration",
    "ayahCount": 30,
    "revelationType": "Meccan"
  },
  {
    "number": 33,
    "arabicName": "سُورَةُ الأَحۡزَابِ",
    "englishName": "Al-Ahzaab",
    "meaning": "The Clans",
    "ayahCount": 73,
    "revelationType": "Medinan"
  },
  {
    "number": 34,
    "arabicName": "سُورَةُ سَبَإٍ",
    "englishName": "Saba",
    "meaning": "Sheba",
    "ayahCount": 54,
    "revelationType": "Meccan"
  },
  {
    "number": 35,
    "arabicName": "سُورَةُ فَاطِرٍ",
    "englishName": "Faatir",
    "meaning": "The Originator",
    "ayahCount": 45,
    "revelationType": "Meccan"
  },
  {
    "number": 36,
    "arabicName": "سُورَةُ يسٓ",
    "englishName": "Yaseen",
    "meaning": "Yaseen",
    "ayahCount": 83,
    "revelationType": "Meccan"
  },
  {
    "number": 37,
    "arabicName": "سُورَةُ الصَّافَّاتِ",
    "englishName": "As-Saaffaat",
    "meaning": "Those drawn up in Ranks",
    "ayahCount": 182,
    "revelationType": "Meccan"
  },
  {
    "number": 38,
    "arabicName": "سُورَةُ صٓ",
    "englishName": "Saad",
    "meaning": "The letter Saad",
    "ayahCount": 88,
    "revelationType": "Meccan"
  },
  {
    "number": 39,
    "arabicName": "سُورَةُ الزُّمَرِ",
    "englishName": "Az-Zumar",
    "meaning": "The Groups",
    "ayahCount": 75,
    "revelationType": "Meccan"
  },
  {
    "number": 40,
    "arabicName": "سُورَةُ غَافِرٍ",
    "englishName": "Ghafir",
    "meaning": "The Forgiver",
    "ayahCount": 85,
    "revelationType": "Meccan"
  },
  {
    "number": 41,
    "arabicName": "سُورَةُ فُصِّلَتۡ",
    "englishName": "Fussilat",
    "meaning": "Explained in detail",
    "ayahCount": 54,
    "revelationType": "Meccan"
  },
  {
    "number": 42,
    "arabicName": "سُورَةُ الشُّورَىٰ",
    "englishName": "Ash-Shura",
    "meaning": "Consultation",
    "ayahCount": 53,
    "revelationType": "Meccan"
  },
  {
    "number": 43,
    "arabicName": "سُورَةُ الزُّخۡرُفِ",
    "englishName": "Az-Zukhruf",
    "meaning": "Ornaments of gold",
    "ayahCount": 89,
    "revelationType": "Meccan"
  },
  {
    "number": 44,
    "arabicName": "سُورَةُ الدُّخَانِ",
    "englishName": "Ad-Dukhaan",
    "meaning": "The Smoke",
    "ayahCount": 59,
    "revelationType": "Meccan"
  },
  {
    "number": 45,
    "arabicName": "سُورَةُ الجَاثِيَةِ",
    "englishName": "Al-Jaathiya",
    "meaning": "Crouching",
    "ayahCount": 37,
    "revelationType": "Meccan"
  },
  {
    "number": 46,
    "arabicName": "سُورَةُ الأَحۡقَافِ",
    "englishName": "Al-Ahqaf",
    "meaning": "The Dunes",
    "ayahCount": 35,
    "revelationType": "Meccan"
  },
  {
    "number": 47,
    "arabicName": "سُورَةُ مُحَمَّدٍ",
    "englishName": "Muhammad",
    "meaning": "Muhammad",
    "ayahCount": 38,
    "revelationType": "Medinan"
  },
  {
    "number": 48,
    "arabicName": "سُورَةُ الفَتۡحِ",
    "englishName": "Al-Fath",
    "meaning": "The Victory",
    "ayahCount": 29,
    "revelationType": "Medinan"
  },
  {
    "number": 49,
    "arabicName": "سُورَةُ الحُجُرَاتِ",
    "englishName": "Al-Hujuraat",
    "meaning": "The Inner Apartments",
    "ayahCount": 18,
    "revelationType": "Medinan"
  },
  {
    "number": 50,
    "arabicName": "سُورَةُ قٓ",
    "englishName": "Qaaf",
    "meaning": "The letter Qaaf",
    "ayahCount": 45,
    "revelationType": "Meccan"
  },
  {
    "number": 51,
    "arabicName": "سُورَةُ الذَّارِيَاتِ",
    "englishName": "Adh-Dhaariyat",
    "meaning": "The Winnowing Winds",
    "ayahCount": 60,
    "revelationType": "Meccan"
  },
  {
    "number": 52,
    "arabicName": "سُورَةُ الطُّورِ",
    "englishName": "At-Tur",
    "meaning": "The Mount",
    "ayahCount": 49,
    "revelationType": "Meccan"
  },
  {
    "number": 53,
    "arabicName": "سُورَةُ النَّجۡمِ",
    "englishName": "An-Najm",
    "meaning": "The Star",
    "ayahCount": 62,
    "revelationType": "Meccan"
  },
  {
    "number": 54,
    "arabicName": "سُورَةُ القَمَرِ",
    "englishName": "Al-Qamar",
    "meaning": "The Moon",
    "ayahCount": 55,
    "revelationType": "Meccan"
  },
  {
    "number": 55,
    "arabicName": "سُورَةُ الرَّحۡمَٰن",
    "englishName": "Ar-Rahmaan",
    "meaning": "The Beneficent",
    "ayahCount": 78,
    "revelationType": "Medinan"
  },
  {
    "number": 56,
    "arabicName": "سُورَةُ الوَاقِعَةِ",
    "englishName": "Al-Waaqia",
    "meaning": "The Inevitable",
    "ayahCount": 96,
    "revelationType": "Meccan"
  },
  {
    "number": 57,
    "arabicName": "سُورَةُ الحَدِيدِ",
    "englishName": "Al-Hadid",
    "meaning": "The Iron",
    "ayahCount": 29,
    "revelationType": "Medinan"
  },
  {
    "number": 58,
    "arabicName": "سُورَةُ المُجَادلَةِ",
    "englishName": "Al-Mujaadila",
    "meaning": "The Pleading Woman",
    "ayahCount": 22,
    "revelationType": "Medinan"
  },
  {
    "number": 59,
    "arabicName": "سُورَةُ الحَشۡرِ",
    "englishName": "Al-Hashr",
    "meaning": "The Exile",
    "ayahCount": 24,
    "revelationType": "Medinan"
  },
  {
    "number": 60,
    "arabicName": "سُورَةُ المُمۡتَحنَةِ",
    "englishName": "Al-Mumtahana",
    "meaning": "She that is to be examined",
    "ayahCount": 13,
    "revelationType": "Medinan"
  },
  {
    "number": 61,
    "arabicName": "سُورَةُ الصَّفِّ",
    "englishName": "As-Saff",
    "meaning": "The Ranks",
    "ayahCount": 14,
    "revelationType": "Medinan"
  },
  {
    "number": 62,
    "arabicName": "سُورَةُ الجُمُعَةِ",
    "englishName": "Al-Jumu'a",
    "meaning": "Friday",
    "ayahCount": 11,
    "revelationType": "Medinan"
  },
  {
    "number": 63,
    "arabicName": "سُورَةُ المُنَافِقُونَ",
    "englishName": "Al-Munaafiqoon",
    "meaning": "The Hypocrites",
    "ayahCount": 11,
    "revelationType": "Medinan"
  },
  {
    "number": 64,
    "arabicName": "سُورَةُ التَّغَابُنِ",
    "englishName": "At-Taghaabun",
    "meaning": "Mutual Disillusion",
    "ayahCount": 18,
    "revelationType": "Medinan"
  },
  {
    "number": 65,
    "arabicName": "سُورَةُ الطَّلَاقِ",
    "englishName": "At-Talaaq",
    "meaning": "Divorce",
    "ayahCount": 12,
    "revelationType": "Medinan"
  },
  {
    "number": 66,
    "arabicName": "سُورَةُ التَّحۡرِيمِ",
    "englishName": "At-Tahrim",
    "meaning": "The Prohibition",
    "ayahCount": 12,
    "revelationType": "Medinan"
  },
  {
    "number": 67,
    "arabicName": "سُورَةُ المُلۡكِ",
    "englishName": "Al-Mulk",
    "meaning": "The Sovereignty",
    "ayahCount": 30,
    "revelationType": "Meccan"
  },
  {
    "number": 68,
    "arabicName": "سُورَةُ القَلَمِ",
    "englishName": "Al-Qalam",
    "meaning": "The Pen",
    "ayahCount": 52,
    "revelationType": "Meccan"
  },
  {
    "number": 69,
    "arabicName": "سُورَةُ الحَاقَّةِ",
    "englishName": "Al-Haaqqa",
    "meaning": "The Reality",
    "ayahCount": 52,
    "revelationType": "Meccan"
  },
  {
    "number": 70,
    "arabicName": "سُورَةُ المَعَارِجِ",
    "englishName": "Al-Ma'aarij",
    "meaning": "The Ascending Stairways",
    "ayahCount": 44,
    "revelationType": "Meccan"
  },
  {
    "number": 71,
    "arabicName": "سُورَةُ نُوحٍ",
    "englishName": "Nooh",
    "meaning": "Noah",
    "ayahCount": 28,
    "revelationType": "Meccan"
  },
  {
    "number": 72,
    "arabicName": "سُورَةُ الجِنِّ",
    "englishName": "Al-Jinn",
    "meaning": "The Jinn",
    "ayahCount": 28,
    "revelationType": "Meccan"
  },
  {
    "number": 73,
    "arabicName": "سُورَةُ المُزَّمِّلِ",
    "englishName": "Al-Muzzammil",
    "meaning": "The Enshrouded One",
    "ayahCount": 20,
    "revelationType": "Meccan"
  },
  {
    "number": 74,
    "arabicName": "سُورَةُ المُدَّثِّرِ",
    "englishName": "Al-Muddaththir",
    "meaning": "The Cloaked One",
    "ayahCount": 56,
    "revelationType": "Meccan"
  },
  {
    "number": 75,
    "arabicName": "سُورَةُ القِيَامَةِ",
    "englishName": "Al-Qiyaama",
    "meaning": "The Resurrection",
    "ayahCount": 40,
    "revelationType": "Meccan"
  },
  {
    "number": 76,
    "arabicName": "سُورَةُ الإِنسَانِ",
    "englishName": "Al-Insaan",
    "meaning": "Man",
    "ayahCount": 31,
    "revelationType": "Medinan"
  },
  {
    "number": 77,
    "arabicName": "سُورَةُ المُرۡسَلَاتِ",
    "englishName": "Al-Mursalaat",
    "meaning": "The Emissaries",
    "ayahCount": 50,
    "revelationType": "Meccan"
  },
  {
    "number": 78,
    "arabicName": "سُورَةُ النَّبَإِ",
    "englishName": "An-Naba",
    "meaning": "The Announcement",
    "ayahCount": 40,
    "revelationType": "Meccan"
  },
  {
    "number": 79,
    "arabicName": "سُورَةُ النَّازِعَاتِ",
    "englishName": "An-Naazi'aat",
    "meaning": "Those who drag forth",
    "ayahCount": 46,
    "revelationType": "Meccan"
  },
  {
    "number": 80,
    "arabicName": "سُورَةُ عَبَسَ",
    "englishName": "Abasa",
    "meaning": "He frowned",
    "ayahCount": 42,
    "revelationType": "Meccan"
  },
  {
    "number": 81,
    "arabicName": "سُورَةُ التَّكۡوِيرِ",
    "englishName": "At-Takwir",
    "meaning": "The Overthrowing",
    "ayahCount": 29,
    "revelationType": "Meccan"
  },
  {
    "number": 82,
    "arabicName": "سُورَةُ الانفِطَارِ",
    "englishName": "Al-Infitaar",
    "meaning": "The Cleaving",
    "ayahCount": 19,
    "revelationType": "Meccan"
  },
  {
    "number": 83,
    "arabicName": "سُورَةُ المُطَفِّفِينَ",
    "englishName": "Al-Mutaffifin",
    "meaning": "Defrauding",
    "ayahCount": 36,
    "revelationType": "Meccan"
  },
  {
    "number": 84,
    "arabicName": "سُورَةُ الانشِقَاقِ",
    "englishName": "Al-Inshiqaaq",
    "meaning": "The Splitting Open",
    "ayahCount": 25,
    "revelationType": "Meccan"
  },
  {
    "number": 85,
    "arabicName": "سُورَةُ البُرُوجِ",
    "englishName": "Al-Burooj",
    "meaning": "The Constellations",
    "ayahCount": 22,
    "revelationType": "Meccan"
  },
  {
    "number": 86,
    "arabicName": "سُورَةُ الطَّارِقِ",
    "englishName": "At-Taariq",
    "meaning": "The Morning Star",
    "ayahCount": 17,
    "revelationType": "Meccan"
  },
  {
    "number": 87,
    "arabicName": "سُورَةُ الأَعۡلَىٰ",
    "englishName": "Al-A'laa",
    "meaning": "The Most High",
    "ayahCount": 19,
    "revelationType": "Meccan"
  },
  {
    "number": 88,
    "arabicName": "سُورَةُ الغَاشِيَةِ",
    "englishName": "Al-Ghaashiya",
    "meaning": "The Overwhelming",
    "ayahCount": 26,
    "revelationType": "Meccan"
  },
  {
    "number": 89,
    "arabicName": "سُورَةُ الفَجۡرِ",
    "englishName": "Al-Fajr",
    "meaning": "The Dawn",
    "ayahCount": 30,
    "revelationType": "Meccan"
  },
  {
    "number": 90,
    "arabicName": "سُورَةُ البَلَدِ",
    "englishName": "Al-Balad",
    "meaning": "The City",
    "ayahCount": 20,
    "revelationType": "Meccan"
  },
  {
    "number": 91,
    "arabicName": "سُورَةُ الشَّمۡسِ",
    "englishName": "Ash-Shams",
    "meaning": "The Sun",
    "ayahCount": 15,
    "revelationType": "Meccan"
  },
  {
    "number": 92,
    "arabicName": "سُورَةُ اللَّيۡلِ",
    "englishName": "Al-Lail",
    "meaning": "The Night",
    "ayahCount": 21,
    "revelationType": "Meccan"
  },
  {
    "number": 93,
    "arabicName": "سُورَةُ الضُّحَىٰ",
    "englishName": "Ad-Dhuhaa",
    "meaning": "The Morning Hours",
    "ayahCount": 11,
    "revelationType": "Meccan"
  },
  {
    "number": 94,
    "arabicName": "سُورَةُ الشَّرۡحِ",
    "englishName": "Ash-Sharh",
    "meaning": "The Consolation",
    "ayahCount": 8,
    "revelationType": "Meccan"
  },
  {
    "number": 95,
    "arabicName": "سُورَةُ التِّينِ",
    "englishName": "At-Tin",
    "meaning": "The Fig",
    "ayahCount": 8,
    "revelationType": "Meccan"
  },
  {
    "number": 96,
    "arabicName": "سُورَةُ العَلَقِ",
    "englishName": "Al-Alaq",
    "meaning": "The Clot",
    "ayahCount": 19,
    "revelationType": "Meccan"
  },
  {
    "number": 97,
    "arabicName": "سُورَةُ القَدۡرِ",
    "englishName": "Al-Qadr",
    "meaning": "The Power, Fate",
    "ayahCount": 5,
    "revelationType": "Meccan"
  },
  {
    "number": 98,
    "arabicName": "سُورَةُ البَيِّنَةِ",
    "englishName": "Al-Bayyina",
    "meaning": "The Evidence",
    "ayahCount": 8,
    "revelationType": "Medinan"
  },
  {
    "number": 99,
    "arabicName": "سُورَةُ الزَّلۡزَلَةِ",
    "englishName": "Az-Zalzala",
    "meaning": "The Earthquake",
    "ayahCount": 8,
    "revelationType": "Medinan"
  },
  {
    "number": 100,
    "arabicName": "سُورَةُ العَادِيَاتِ",
    "englishName": "Al-Aadiyaat",
    "meaning": "The Chargers",
    "ayahCount": 11,
    "revelationType": "Meccan"
  },
  {
    "number": 101,
    "arabicName": "سُورَةُ القَارِعَةِ",
    "englishName": "Al-Qaari'a",
    "meaning": "The Calamity",
    "ayahCount": 11,
    "revelationType": "Meccan"
  },
  {
    "number": 102,
    "arabicName": "سُورَةُ التَّكَاثُرِ",
    "englishName": "At-Takaathur",
    "meaning": "Competition",
    "ayahCount": 8,
    "revelationType": "Meccan"
  },
  {
    "number": 103,
    "arabicName": "سُورَةُ العَصۡرِ",
    "englishName": "Al-Asr",
    "meaning": "The Declining Day, Epoch",
    "ayahCount": 3,
    "revelationType": "Meccan"
  },
  {
    "number": 104,
    "arabicName": "سُورَةُ الهُمَزَةِ",
    "englishName": "Al-Humaza",
    "meaning": "The Traducer",
    "ayahCount": 9,
    "revelationType": "Meccan"
  },
  {
    "number": 105,
    "arabicName": "سُورَةُ الفِيلِ",
    "englishName": "Al-Fil",
    "meaning": "The Elephant",
    "ayahCount": 5,
    "revelationType": "Meccan"
  },
  {
    "number": 106,
    "arabicName": "سُورَةُ قُرَيۡشٍ",
    "englishName": "Quraish",
    "meaning": "Quraysh",
    "ayahCount": 4,
    "revelationType": "Meccan"
  },
  {
    "number": 107,
    "arabicName": "سُورَةُ المَاعُونِ",
    "englishName": "Al-Maa'un",
    "meaning": "Almsgiving",
    "ayahCount": 7,
    "revelationType": "Meccan"
  },
  {
    "number": 108,
    "arabicName": "سُورَةُ الكَوۡثَرِ",
    "englishName": "Al-Kawthar",
    "meaning": "Abundance",
    "ayahCount": 3,
    "revelationType": "Meccan"
  },
  {
    "number": 109,
    "arabicName": "سُورَةُ الكَافِرُونَ",
    "englishName": "Al-Kaafiroon",
    "meaning": "The Disbelievers",
    "ayahCount": 6,
    "revelationType": "Meccan"
  },
  {
    "number": 110,
    "arabicName": "سُورَةُ النَّصۡرِ",
    "englishName": "An-Nasr",
    "meaning": "Divine Support",
    "ayahCount": 3,
    "revelationType": "Medinan"
  },
  {
    "number": 111,
    "arabicName": "سُورَةُ المَسَدِ",
    "englishName": "Al-Masad",
    "meaning": "The Palm Fibre",
    "ayahCount": 5,
    "revelationType": "Meccan"
  },
  {
    "number": 112,
    "arabicName": "سُورَةُ الإِخۡلَاصِ",
    "englishName": "Al-Ikhlaas",
    "meaning": "Sincerity",
    "ayahCount": 4,
    "revelationType": "Meccan"
  },
  {
    "number": 113,
    "arabicName": "سُورَةُ الفَلَقِ",
    "englishName": "Al-Falaq",
    "meaning": "The Dawn",
    "ayahCount": 5,
    "revelationType": "Meccan"
  },
  {
    "number": 114,
    "arabicName": "سُورَةُ النَّاسِ",
    "englishName": "An-Naas",
    "meaning": "Mankind",
    "ayahCount": 6,
    "revelationType": "Meccan"
  }
];

export function chapterByNumber(number: number): Chapter | undefined {
  return CHAPTERS.find((chapter) => chapter.number === number);
}
