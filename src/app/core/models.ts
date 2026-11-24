export interface Word {
  id?: number;
  lang: string;
  text: string;
  /** Normalized text used for matching and uniqueness (per language). */
  textNorm: string;
  meaning: string;
  collectionIds: number[];
  createdAt: number;
}

/** Undirected translation link between two words. Always stored with a < b. */
export interface WordLink {
  id?: number;
  a: number;
  b: number;
}

export interface Collection {
  id?: number;
  name: string;
  createdAt: number;
}

export interface AppSettings {
  id: 1;
  primaryLang: string;
  secondaryLang: string;
  selectedCollectionId: number | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  primaryLang: 'en',
  secondaryLang: 'ar',
  selectedCollectionId: null,
};

export interface LanguageOption {
  code: string;
  name: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'Arabic' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ur', name: 'Urdu' },
  { code: 'fa', name: 'Persian' },
  { code: 'he', name: 'Hebrew' },
];

export function languageName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase();
}

const RTL = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'ku', 'sd', 'yi', 'dv']);

export function isRtl(code: string): boolean {
  return RTL.has(code.toLowerCase().split('-')[0]);
}

/**
 * Normalizes text for matching: trims, collapses whitespace, lowercases and
 * strips Arabic diacritics (tashkeel) and tatweel so "كِتَاب" matches "كتاب".
 */
export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
