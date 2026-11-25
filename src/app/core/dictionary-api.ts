import { DefinitionEntry, DefinitionMeaning, WordDefinition } from './models';

/** Raw response shape of https://dictionaryapi.dev (phonetics are ignored on purpose). */
interface ApiEntry {
  origin?: string;
  meanings?: Array<{
    partOfSpeech?: string;
    synonyms?: string[];
    antonyms?: string[];
    definitions?: Array<{
      definition?: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }>;
  }>;
  sourceUrls?: string[];
}

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

function mergeWords(target: string[], extra: unknown): void {
  if (!Array.isArray(extra)) return;
  for (const raw of extra) {
    const w = clean(raw);
    if (w && !target.some((t) => t.toLowerCase() === w.toLowerCase())) target.push(w);
  }
}

/**
 * Converts the API response into a WordDefinition, keeping every definition,
 * example, synonym, antonym and origin. The API often splits one word into
 * several entries that only differ by pronunciation, so entries sharing the
 * same origin are merged, and repeated definitions are dropped.
 */
export function parseDictionaryResponse(raw: unknown): WordDefinition | null {
  if (!Array.isArray(raw)) return null;

  const entries: DefinitionEntry[] = [];
  const sourceUrls: string[] = [];

  for (const apiEntry of raw as ApiEntry[]) {
    if (!apiEntry || typeof apiEntry !== 'object') continue;
    mergeWords(sourceUrls, apiEntry.sourceUrls);

    const origin = clean(apiEntry.origin) || undefined;
    let entry = entries.find((e) => e.origin === origin);
    if (!entry) {
      entry = { ...(origin ? { origin } : {}), meanings: [] };
      entries.push(entry);
    }

    for (const apiMeaning of apiEntry.meanings ?? []) {
      const partOfSpeech = clean(apiMeaning?.partOfSpeech);
      let meaning = entry.meanings.find((m) => m.partOfSpeech === partOfSpeech);
      if (!meaning) {
        meaning = { partOfSpeech, definitions: [], synonyms: [], antonyms: [] };
        entry.meanings.push(meaning);
      }
      mergeWords(meaning.synonyms, apiMeaning?.synonyms);
      mergeWords(meaning.antonyms, apiMeaning?.antonyms);

      for (const apiDef of apiMeaning?.definitions ?? []) {
        const definition = clean(apiDef?.definition);
        if (!definition) continue;
        let sense = meaning.definitions.find((d) => d.definition === definition);
        if (!sense) {
          sense = { definition, synonyms: [], antonyms: [] };
          meaning.definitions.push(sense);
        }
        const example = clean(apiDef?.example);
        if (example && !sense.example) sense.example = example;
        mergeWords(sense.synonyms, apiDef?.synonyms);
        mergeWords(sense.antonyms, apiDef?.antonyms);
      }
    }
  }

  // Drop empty shells (a meaning with no definitions but with synonyms is kept).
  const useful = (m: DefinitionMeaning) =>
    m.definitions.length > 0 || m.synonyms.length > 0 || m.antonyms.length > 0;
  const kept = entries
    .map((e) => ({ ...e, meanings: e.meanings.filter(useful) }))
    .filter((e) => e.meanings.length > 0);

  return kept.length > 0 ? { entries: kept, sourceUrls } : null;
}

/** Fetches an English definition from dictionaryapi.dev (no API key needed). */
export async function fetchDefinition(word: string): Promise<WordDefinition> {
  let response: Response;
  try {
    response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`,
    );
  } catch {
    throw new Error('Could not reach the dictionary. Check your connection and try again.');
  }
  if (response.status === 404) throw new Error('No definition found for this word.');
  if (!response.ok) throw new Error('The dictionary is unavailable right now. Try again later.');

  const definition = parseDictionaryResponse(await response.json());
  if (!definition) throw new Error('No definition found for this word.');
  return definition;
}

/** Flattens a definition into plain text, used for search. */
export function definitionText(def: WordDefinition | undefined): string {
  if (!def) return '';
  const parts: string[] = [];
  for (const e of def.entries) {
    if (e.origin) parts.push(e.origin);
    for (const m of e.meanings) {
      parts.push(m.partOfSpeech, ...m.synonyms, ...m.antonyms);
      for (const d of m.definitions) {
        parts.push(d.definition, d.example ?? '', ...d.synonyms, ...d.antonyms);
      }
    }
  }
  return parts.filter(Boolean).join(' ');
}

/** First definition, used as a one-line summary in lists. */
export function firstDefinition(def: WordDefinition | undefined): string {
  for (const e of def?.entries ?? []) {
    for (const m of e.meanings) {
      if (m.definitions[0]) return m.definitions[0].definition;
    }
  }
  return '';
}
