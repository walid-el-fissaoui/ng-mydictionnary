import { Injectable, computed, effect, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';
import { db } from './db';
import { AppSettings, Collection, DEFAULT_SETTINGS, Word, WordLink, normalize } from './models';

export interface DictionaryBackup {
  format: 'mydictionnary-backup';
  version: 1;
  exportedAt: string;
  words: Word[];
  links: WordLink[];
  collections: Collection[];
  settings: AppSettings;
}

export interface WordInput {
  /** Present when editing an existing word. */
  id?: number;
  text: string;
  meaning: string;
  /** Translations in the current secondary language. */
  translations: string[];
  collectionIds: number[];
}

export interface SaveResult {
  id: number;
  /** True when the word already existed and the input was merged into it. */
  merged: boolean;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

@Injectable({ providedIn: 'root' })
export class DictionaryService {
  // Live views of IndexedDB. `undefined` means "not loaded yet".
  private readonly rawWords = toSignal(from(liveQuery(() => db.words.toArray())));
  private readonly rawLinks = toSignal(from(liveQuery(() => db.links.toArray())));
  private readonly rawCollections = toSignal(from(liveQuery(() => db.collections.toArray())));
  private readonly rawSettings = toSignal(
    from(liveQuery(async () => (await db.settings.get(1)) ?? null)),
  );

  readonly loaded = computed(
    () =>
      this.rawWords() !== undefined &&
      this.rawLinks() !== undefined &&
      this.rawCollections() !== undefined &&
      this.rawSettings() !== undefined,
  );

  readonly settings = computed<AppSettings>(() => this.rawSettings() ?? DEFAULT_SETTINGS);
  readonly primaryLang = computed(() => this.settings().primaryLang);
  readonly secondaryLang = computed(() => this.settings().secondaryLang);

  /** Newest first. */
  readonly collections = computed<Collection[]>(() =>
    [...(this.rawCollections() ?? [])].sort(
      (a, b) => b.createdAt - a.createdAt || (b.id ?? 0) - (a.id ?? 0),
    ),
  );
  private readonly collectionById = computed(
    () => new Map(this.collections().map((c) => [c.id!, c] as const)),
  );

  /** Selected collection id, or null for "All words". */
  readonly activeCollectionId = computed(() => {
    const id = this.settings().selectedCollectionId;
    return id !== null && this.collectionById().has(id) ? id : null;
  });
  readonly activeCollection = computed(() => {
    const id = this.activeCollectionId();
    return id === null ? null : (this.collectionById().get(id) ?? null);
  });

  private readonly wordById = computed(
    () => new Map((this.rawWords() ?? []).map((w) => [w.id!, w] as const)),
  );

  /** Words in the primary language, newest first. */
  private readonly primaryWords = computed(() => {
    const lang = this.primaryLang();
    return (this.rawWords() ?? [])
      .filter((w) => w.lang === lang)
      .sort((a, b) => b.createdAt - a.createdAt || (b.id ?? 0) - (a.id ?? 0));
  });

  readonly allCount = computed(() => this.primaryWords().length);
  readonly countByCollection = computed(() => {
    const counts = new Map<number, number>();
    for (const w of this.primaryWords()) {
      for (const id of w.collectionIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  });

  /** Primary-language word id -> its translations in the secondary language. */
  readonly translations = computed(() => {
    const map = new Map<number, Word[]>();
    const byId = this.wordById();
    const p = this.primaryLang();
    const s = this.secondaryLang();
    const add = (from: Word, to: Word) => {
      if (from.lang === p && to.lang === s) {
        const list = map.get(from.id!) ?? [];
        list.push(to);
        map.set(from.id!, list);
      }
    };
    for (const link of this.rawLinks() ?? []) {
      const a = byId.get(link.a);
      const b = byId.get(link.b);
      if (!a || !b) continue;
      add(a, b);
      add(b, a);
    }
    return map;
  });

  /** Primary-language words in the active collection (or all). */
  readonly wordsInView = computed(() => {
    const id = this.activeCollectionId();
    const words = this.primaryWords();
    return id === null ? words : words.filter((w) => w.collectionIds.includes(id));
  });

  readonly query = signal('');

  /** wordsInView narrowed by the search box (word, meaning, or translation). */
  readonly visibleWords = computed(() => {
    const q = normalize(this.query());
    const words = this.wordsInView();
    if (!q) return words;
    const tr = this.translations();
    return words.filter(
      (w) =>
        w.textNorm.includes(q) ||
        normalize(w.meaning).includes(q) ||
        (tr.get(w.id!) ?? []).some((t) => t.textNorm.includes(q)),
    );
  });

  // ---- Suggested word -------------------------------------------------------

  private readonly suggestedId = signal<number | null>(null);
  readonly suggested = computed(() => {
    const id = this.suggestedId();
    return id === null ? null : (this.wordById().get(id) ?? null);
  });

  constructor() {
    // Keep the suggestion valid: pick one on startup and whenever the current
    // one leaves the active view (collection or language change, deletion).
    effect(() => {
      if (!this.loaded()) return;
      const view = this.wordsInView();
      const current = untracked(this.suggestedId);
      if (view.length === 0) {
        if (current !== null) this.suggestedId.set(null);
      } else if (current === null || !view.some((w) => w.id === current)) {
        this.suggestedId.set(this.pickRandom(view, null));
      }
    });
  }

  /** Shows another random word from the active view. */
  next(): void {
    this.suggestedId.set(this.pickRandom(this.wordsInView(), this.suggestedId()));
  }

  /** Prefers words that have a translation; avoids repeating the current one. */
  private pickRandom(view: Word[], current: number | null): number | null {
    if (view.length === 0) return null;
    const tr = this.translations();
    const withTr = view.filter((w) => tr.has(w.id!));
    let pool = withTr.length > 0 ? withTr : view;
    if (pool.length > 1) pool = pool.filter((w) => w.id !== current);
    return pool[Math.floor(Math.random() * pool.length)].id!;
  }

  // ---- Settings -------------------------------------------------------------

  private async saveSettings(patch: Partial<AppSettings>): Promise<void> {
    // Read from the database, not the signal, so a quick second write never uses stale values.
    const current = (await db.settings.get(1)) ?? DEFAULT_SETTINGS;
    await db.settings.put({ ...current, ...patch, id: 1 });
  }

  async setLanguages(primaryLang: string, secondaryLang: string): Promise<void> {
    const p = primaryLang.trim().toLowerCase();
    const s = secondaryLang.trim().toLowerCase();
    if (!p || !s) throw new Error('Choose both languages');
    if (p === s) throw new Error('The two languages must be different');
    await this.saveSettings({ primaryLang: p, secondaryLang: s });
  }

  async swapLanguages(): Promise<void> {
    const current = (await db.settings.get(1)) ?? DEFAULT_SETTINGS;
    await this.saveSettings({
      primaryLang: current.secondaryLang,
      secondaryLang: current.primaryLang,
    });
  }

  async selectCollection(id: number | null): Promise<void> {
    await this.saveSettings({ selectedCollectionId: id });
  }

  async exportBackup(): Promise<DictionaryBackup> {
    const [words, links, collections, settings] = await Promise.all([
      db.words.toArray(),
      db.links.toArray(),
      db.collections.toArray(),
      db.settings.get(1),
    ]);
    return {
      format: 'mydictionnary-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      words,
      links,
      collections,
      settings: settings ?? DEFAULT_SETTINGS,
    };
  }

  async importBackup(value: unknown): Promise<void> {
    const backup = this.validateBackup(value);
    await db.transaction('rw', db.words, db.links, db.collections, db.settings, async () => {
      await db.words.clear();
      await db.links.clear();
      await db.collections.clear();
      await db.settings.clear();
      await db.collections.bulkPut(backup.collections);
      await db.words.bulkPut(backup.words);
      await db.links.bulkPut(backup.links);
      await db.settings.put(backup.settings);
    });
  }

  private validateBackup(value: unknown): DictionaryBackup {
    const fail = (): never => { throw new Error('This file is not a valid mydictionnary backup'); };
    if (!value || typeof value !== 'object') return fail();
    const b = value as Partial<DictionaryBackup>;
    if (b.format !== 'mydictionnary-backup' || b.version !== 1 ||
        !Array.isArray(b.words) || !Array.isArray(b.links) || !Array.isArray(b.collections) ||
        !b.settings || typeof b.settings !== 'object') return fail();

    const ids = (items: { id?: number }[]): Set<number> | null => {
      const set = new Set<number>();
      for (const item of items) {
        if (!Number.isSafeInteger(item?.id) || item.id! < 1 || set.has(item.id!)) return null;
        set.add(item.id!);
      }
      return set;
    };
    const wordIds = ids(b.words);
    const collectionIds = ids(b.collections);
    const linkIds = ids(b.links);
    if (!wordIds || !collectionIds || !linkIds) return fail();
    const norms = new Set<string>();
    for (const w of b.words) {
      if (!w || typeof w.lang !== 'string' || !w.lang.trim() || typeof w.text !== 'string' ||
          typeof w.meaning !== 'string' || !Array.isArray(w.collectionIds) ||
          !w.collectionIds.every((id) => Number.isSafeInteger(id) && collectionIds.has(id)) ||
          !Number.isFinite(w.createdAt) || w.textNorm !== normalize(w.text)) return fail();
      const key = `${w.lang}\0${w.textNorm}`;
      if (norms.has(key)) return fail();
      norms.add(key);
    }
    for (const c of b.collections) {
      if (!c || typeof c.name !== 'string' || !c.name.trim() || !Number.isFinite(c.createdAt)) return fail();
    }
    const pairs = new Set<string>();
    for (const l of b.links) {
      if (!l || !wordIds.has(l.a) || !wordIds.has(l.b) || l.a >= l.b) return fail();
      const key = `${l.a}:${l.b}`;
      if (pairs.has(key)) return fail();
      pairs.add(key);
    }
    const s = b.settings;
    if (s.id !== 1 || typeof s.primaryLang !== 'string' || !s.primaryLang.trim() ||
        typeof s.secondaryLang !== 'string' || !s.secondaryLang.trim() ||
        s.primaryLang === s.secondaryLang ||
        (s.selectedCollectionId !== null && !collectionIds.has(s.selectedCollectionId))) return fail();
    return b as DictionaryBackup;
  }

  // ---- Collections ----------------------------------------------------------

  async addCollection(name: string): Promise<number> {
    const clean = this.validCollectionName(name);
    return db.collections.add({ name: clean, createdAt: Date.now() });
  }

  async renameCollection(id: number, name: string): Promise<void> {
    const clean = this.validCollectionName(name, id);
    await db.collections.update(id, { name: clean });
  }

  async deleteCollection(id: number): Promise<void> {
    await db.transaction('rw', db.words, db.collections, db.settings, async () => {
      await db.words
        .where('collectionIds')
        .equals(id)
        .modify((w) => {
          w.collectionIds = w.collectionIds.filter((c) => c !== id);
        });
      await db.collections.delete(id);
      const s = await db.settings.get(1);
      if (s?.selectedCollectionId === id) await db.settings.put({ ...s, selectedCollectionId: null });
    });
  }

  private validCollectionName(name: string, ignoreId?: number): string {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) throw new Error('Enter a collection name');
    const lower = clean.toLowerCase();
    const clash = this.collections().some((c) => c.id !== ignoreId && c.name.toLowerCase() === lower);
    if (clash) throw new Error('A collection with that name already exists');
    return clean;
  }

  collectionName(id: number): string {
    return this.collectionById().get(id)?.name ?? '';
  }

  // ---- Words ----------------------------------------------------------------

  /**
   * Adds or edits a word in the primary language and syncs its translations in
   * the secondary language. Translations are found or created, never duplicated,
   * and join the word's collections.
   *
   * Adding a word that already exists merges into it: translations and
   * collections are added, nothing is removed, and an existing meaning is kept.
   */
  async saveWord(input: WordInput): Promise<SaveResult> {
    const current = (await db.settings.get(1)) ?? DEFAULT_SETTINGS;
    const lang = current.primaryLang;
    const sLang = current.secondaryLang;
    const text = input.text.trim().replace(/\s+/g, ' ');
    const norm = normalize(text);
    if (!norm) throw new Error('Enter a word');
    const meaning = input.meaning.trim();

    const seen = new Set<string>();
    const translations: { text: string; norm: string }[] = [];
    for (const raw of input.translations) {
      const t = raw.trim().replace(/\s+/g, ' ');
      const n = normalize(t);
      if (n && !seen.has(n)) {
        seen.add(n);
        translations.push({ text: t, norm: n });
      }
    }

    return db.transaction('rw', db.words, db.links, async () => {
      const now = Date.now();
      const existing = await db.words.where('[lang+textNorm]').equals([lang, norm]).first();
      let merged = false;
      let word: Word;

      if (input.id != null) {
        const current = await db.words.get(input.id);
        if (!current) throw new Error('That word no longer exists');
        if (existing && existing.id !== current.id) {
          throw new Error(`"${existing.text}" is already in your dictionary`);
        }
        word = { ...current, text, textNorm: norm, meaning, collectionIds: unique(input.collectionIds) };
        await db.words.put(word);
      } else if (existing) {
        merged = true;
        word = {
          ...existing,
          meaning: existing.meaning || meaning,
          collectionIds: unique([...existing.collectionIds, ...input.collectionIds]),
        };
        await db.words.put(word);
      } else {
        word = {
          lang,
          text,
          textNorm: norm,
          meaning,
          collectionIds: unique(input.collectionIds),
          createdAt: now,
        };
        word.id = await db.words.add(word);
      }
      const wordId = word.id!;

      // Find or create each translation word, and make it join the collections.
      const targetIds: number[] = [];
      for (const t of translations) {
        let tw = await db.words.where('[lang+textNorm]').equals([sLang, t.norm]).first();
        if (!tw) {
          tw = {
            lang: sLang,
            text: t.text,
            textNorm: t.norm,
            meaning: '',
            collectionIds: [...word.collectionIds],
            createdAt: now,
          };
          tw.id = await db.words.add(tw);
        } else {
          const joined = unique([...tw.collectionIds, ...word.collectionIds]);
          if (joined.length !== tw.collectionIds.length) {
            await db.words.update(tw.id!, { collectionIds: joined });
          }
        }
        targetIds.push(tw.id!);
      }

      // Sync links to secondary-language words (links to other languages are left alone).
      const links = await db.links.where('a').equals(wordId).or('b').equals(wordId).toArray();
      const linkedIds = new Set<number>();
      for (const link of links) {
        const otherId = link.a === wordId ? link.b : link.a;
        const other = await db.words.get(otherId);
        if (!other) {
          await db.links.delete(link.id!);
        } else if (other.lang === sLang) {
          if (!merged && !targetIds.includes(otherId)) await db.links.delete(link.id!);
          else linkedIds.add(otherId);
        }
      }
      for (const tid of targetIds) {
        if (!linkedIds.has(tid)) {
          await db.links.add({ a: Math.min(wordId, tid), b: Math.max(wordId, tid) });
        }
      }

      return { id: wordId, merged };
    });
  }

  /** Deletes a word and its links. Its translations stay in the dictionary as words. */
  async deleteWord(id: number): Promise<void> {
    await db.transaction('rw', db.words, db.links, async () => {
      await db.links.where('a').equals(id).delete();
      await db.links.where('b').equals(id).delete();
      await db.words.delete(id);
    });
  }
}
