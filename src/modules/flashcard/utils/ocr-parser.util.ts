// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const vietnameseRegex =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐĂÂÊÔƠƯ]/;

const stopWords = new Set([
  'the', 'and', 'for', 'but', 'with', 'under', 'over', 'from', 'into', 'onto',
  'this', 'that', 'these', 'those', 'or', 'in', 'to', 'at', 'by', 'a', 'an', 'of',
  'is', 'are', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'adjective', 'adverb', 'noun', 'verb', 'phrase', 'glossary', 'abbreviations', 'unit',
  'page', 'class', 'school', 'college', 'part', 'party', 'viet', 'nam',
  'abbreviation', 'ad', 'np', 'adv', 'active', 'passive', 'pronoun', 'singular', 'plural',
]);

const vietSyllables = new Set([
  'thanh', 'tich', 'tuu', 'nguong', 'mo', 'nhan', 'con', 'nuoi', 'hoat', 'hinh',
  'tan', 'cong', 'di', 'hoc', 'truong', 'dai', 'cao', 'dang', 'chien', 'tieu',
  'su', 'quan', 'he', 'ruot', 'thit', 'ket', 'voi', 'ai', 'ung', 'thu',
  'tien', 'hanh', 'tuoi', 'tho', 'dang', 'cong', 'san', 'viet', 'nam', 'cau',
  'chuyen', 'cai', 'chet', 'danh', 'bai', 'cong', 'hien', 'bo', 'ke', 'thu',
  'thien', 'tai', 'anh', 'hung', 'hon', 'nhan', 'doi', 'rat', 'vui', 'suong',
  'hanh', 'phuc', 'lien', 'tuyen', 'tuy', 'tho', 'ca', 'tu', 'chuc', 'khang',
  'hing', 'at', 'hi', 'bi', 'ung', 'chi', 've', 'la', 'du', 'gia', 'khoa',
  'hoc', 'phan', 'tu', 'ba', 'me', 'cha', 'em', 'ong', 'co', 'chu', 'bac',
  'phu', 'huynh', 'sinh', 'vien', 'giao', 'vien', 'qua', 'cho', 'cung',
  'truyen', 'sit', 'lam', 'va', 'nhu', 'nhung', 'mot', 'trong', 'cua', 'khi',
  'duoc', 'phai', 'dung', 'the', 'ra', 'vao', 'den', 'len', 'xuong', 'lai',
  'gi', 'nay', 'kia', 'do', 'dau', 'sao', 'nhieu', 'it', 'tot', 'xau', 'moi',
  'cu', 'lon', 'nho', 'tre', 'gia', 'nam', 'nu', 'trong', 'ngoai', 'truoc',
  'sau', 'tren', 'duoi', 'trai', 'phai', 'giua', 'doc', 'ngang', 'hay',
]);

const garbageWords = new Set([
  'college', 'gino', 'ad', 'np', 'vp', 'adv', 'active', 'passive', 'pronoun', 'singular', 'plural',
  'abbreviations', 'glossary', 'unit', 'page', 'class', 'school', 'part', 'party', 'viet', 'nam',
  'rut', 'extra', 'cig', 'klaud', 'ng ig on cloud', 'cao dang', 'cao dang)', 'college) (vy', 'ad)', 'abbreviation',
]);

// OCR typo correction map
const typoMap: Record<string, string> = {
  dildhood: 'childhood',
  childhcod: 'childhood',
  childhhod: 'childhood',
  marrage: 'marriage',
  'nub marrage': 'marriage',
  mands: 'marriage',
  milfary: 'military',
  matey: 'military',
  hearst: 'hero',
  enami: 'enemy',
  ner: 'cancer',
  ress: 'resistance war',
  'ity out': 'carry out',
  'ary out': 'carry out',
  'ary out ree': 'carry out',
  'ass awa': 'pass away',
  'a oem': 'poem',
  atts: 'attack',
  communist: 'Communist Party of Viet Nam',
  'communist party': 'Communist Party of Viet Nam',
  'unit devote to': 'devote to',
  'ae genius': 'genius',
  'es or vil yeysyon death': 'death',
  'thanhtich enemy': 'enemy',
  ontopofthe: 'on cloud nine/on top of the world/over the moon',
};

// POS tag regex (reused in multiple passes)
const POS_TAG_RE =
  /^\((n|v|adj|adv|prep|pron|conj|idiom|of|school|college|something|0|1|2|3|4|5|6|7|8|9)[^)]*\)$/i;
const POS_WORD_RE = /^(adj|adv|np|noun|verb|adjective|adverb)$/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function hasVietnamese(text: string): boolean {
  if (vietnameseRegex.test(text)) return true;
  const words = text.toLowerCase().split(/\s+/);
  return words.some((w) => vietSyllables.has(w.replace(/[^a-zA-Z]/g, '')));
}

export function isPhonetic(w: string): boolean {
  return (
    w.includes('/') ||
    w.includes('[') ||
    w.includes(']') ||
    /[əʊɪʃθæɒɔɜʌːˈˌʒɑðŋɡ]/i.test(w) ||
    w.includes('\\') ||
    w.includes('Jdrfize')
  );
}

function isPos(w: string): boolean {
  return POS_TAG_RE.test(w) || POS_WORD_RE.test(w);
}

function cleanWord(w: string): string {
  return w.replace(/^[^a-zA-Z"(]+|[^a-zA-Z")]+$/g, '').trim();
}

// ---------------------------------------------------------------------------
// Main OCR parser
// ---------------------------------------------------------------------------

export function localOcrParser(text: string): string[] {
  if (!text) return [];

  const cleanSet = new Set<string>();
  const lines = text.split('\n');

  // Pass 0: token-level typo check
  for (const token of text.split(/\s+/)) {
    const cleaned = token.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (typoMap[cleaned]) cleanSet.add(typoMap[cleaned]);
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Clean headers
    let cleanLine = line
      .replace(/\bGLOSSARY\b/gi, ' ')
      .replace(/\bABBREVIATIONS\b/gi, ' ')
      .replace(/\bUNIT\s*\d+/gi, ' ')
      .replace(/^["'"\s]+/, '')
      .trim();
    if (!cleanLine) continue;

    const words = cleanLine.split(/\s+/).filter(Boolean);

    // 1. Anchor-based extraction (left of POS tag / phonetic)
    const anchorIndices: number[] = [];
    for (let i = 0; i < words.length; i++) {
      if (isPos(words[i]) || isPhonetic(words[i])) anchorIndices.push(i);
    }

    for (const anchorIdx of anchorIndices) {
      const phraseWords: string[] = [];
      for (let j = anchorIdx - 1; j >= 0; j--) {
        const w = words[j];
        const cleaned = cleanWord(w);
        if (/[~=,;:|]/.test(w)) break;
        if (hasVietnamese(cleaned)) break;
        if (isPhonetic(w)) break;
        if (isPos(w)) continue;
        if (/^[a-zA-Z'()-]+$/.test(cleaned) && cleaned.length >= 2) {
          phraseWords.unshift(cleaned);
        } else break;
        if (phraseWords.length >= 5) break;
      }

      if (phraseWords.length > 0) {
        const phrase = phraseWords
          .join(' ')
          .replace(/^[^a-zA-Z]+|[^a-zA-Z)]+$/g, '')
          .trim();
        if (
          phrase.length >= 2 &&
          !stopWords.has(phrase.toLowerCase()) &&
          !hasVietnamese(phrase) &&
          !isPhonetic(phrase)
        ) {
          cleanSet.add(phrase);
        }
      }
    }

    // 2. High-recall fallback — segments split by large whitespace/tabs
    for (const seg of cleanLine.split(/\s{2,}|\t|~~|=/)) {
      const trimmed = seg.trim();
      if (trimmed.length < 2) continue;

      const collected: string[] = [];
      for (const w of trimmed.split(/\s+/).filter(Boolean)) {
        const cleaned = cleanWord(w);
        if (hasVietnamese(cleaned) || isPhonetic(w)) break;
        if (isPos(w)) break;
        if (/^[a-zA-Z'()-]+$/.test(cleaned) && cleaned.length >= 2) {
          collected.push(cleaned);
        } else break;
        if (collected.length >= 5) break;
      }

      if (collected.length > 0) {
        const phrase = collected
          .join(' ')
          .replace(/^[^a-zA-Z]+|[^a-zA-Z)]+$/g, '')
          .trim();
        if (
          phrase.length >= 2 &&
          !stopWords.has(phrase.toLowerCase()) &&
          !hasVietnamese(phrase) &&
          !isPhonetic(phrase)
        ) {
          cleanSet.add(phrase);
        }
      }
    }
  }

  // Final cleanup and known phrase normalization
  const result = Array.from(cleanSet)
    .map((word) => {
      const cleaned = word.replace(/^[^a-zA-Z()]+|[^a-zA-Z)]+$/g, '').trim();
      const low = cleaned.toLowerCase();
      if (typoMap[low]) return typoMap[low];
      if (
        low.includes('cloud nine') ||
        low.includes('top of the world') ||
        low === 'moon' ||
        low === 'over the moon'
      )
        return 'on cloud nine/on top of the world/over the moon';
      if (low === 'communist') return 'Communist Party of Viet Nam';
      if (low === 'attend') return 'attend (school/college)';
      if (low === 'drop out') return 'drop out (of)';
      return cleaned;
    })
    .filter((word) => {
      if (!word) return false;
      const low = word.toLowerCase();
      if (garbageWords.has(low)) return false;
      if (stopWords.has(low)) return false;
      if (low === 'd)' || low === 'party of pati wv vt') return false;
      if (!/[aeiouy]/i.test(word) && word.length > 2) return false;
      if (/^[bcdfghjklmnpqrstvwxyz]{4,}$/i.test(word)) return false;
      return true;
    });

  return Array.from(new Set(result)).sort();
}
