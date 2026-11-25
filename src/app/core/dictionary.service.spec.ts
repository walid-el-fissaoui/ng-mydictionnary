import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { DictionaryService } from './dictionary.service';

async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 50));
  TestBed.tick();
}

describe('DictionaryService', () => {
  let dict: DictionaryService;

  beforeEach(async () => {
    await db.words.clear();
    await db.links.clear();
    await db.collections.clear();
    await db.settings.clear();
    TestBed.resetTestingModule();
    dict = TestBed.inject(DictionaryService);
    await settle();
  });

  it('defaults to en -> ar with no selected collection', () => {
    expect(dict.primaryLang()).toBe('en');
    expect(dict.secondaryLang()).toBe('ar');
    expect(dict.activeCollectionId()).toBeNull();
  });

  it('adds a word with several translations and shows them', async () => {
    await dict.saveWord({ text: 'knife', meaning: 'cuts', translations: ['سكين', 'مدية'], collectionIds: [] });
    await settle();
    const [w] = dict.wordsInView();
    expect(w.text).toBe('knife');
    expect(dict.translations().get(w.id!)!.map((t) => t.text)).toEqual(['سكين', 'مدية']);
  });

  it('reverses the flow when languages are swapped, without duplicating data', async () => {
    await dict.saveWord({ text: 'knife', meaning: '', translations: ['سكين', 'مدية'], collectionIds: [] });
    await settle();
    await dict.swapLanguages();
    await settle();
    expect(dict.primaryLang()).toBe('ar');
    const texts = dict.wordsInView().map((w) => w.text).sort();
    expect(texts).toEqual(['سكين', 'مدية'].sort());
    const first = dict.wordsInView()[0];
    expect(dict.translations().get(first.id!)!.map((t) => t.text)).toEqual(['knife']);
    expect(await db.words.count()).toBe(3);
    expect(await db.links.count()).toBe(2);
  });

  it('one Arabic word can translate several English words (many to many)', async () => {
    await dict.saveWord({ text: 'knife', meaning: '', translations: ['سكين'], collectionIds: [] });
    await dict.saveWord({ text: 'blade', meaning: '', translations: ['سكين'], collectionIds: [] });
    await settle();
    expect(await db.words.count()).toBe(3);
    await dict.swapLanguages();
    await settle();
    const [ar] = dict.wordsInView();
    expect(dict.translations().get(ar.id!)!.map((t) => t.text).sort()).toEqual(['blade', 'knife']);
  });

  it('merges when adding an existing word instead of duplicating', async () => {
    await dict.saveWord({ text: 'Knife', meaning: 'first', translations: ['سكين'], collectionIds: [] });
    const r = await dict.saveWord({ text: ' knife ', meaning: 'second', translations: ['مدية'], collectionIds: [] });
    await settle();
    expect(r.merged).toBe(true);
    expect(dict.allCount()).toBe(1);
    const [w] = dict.wordsInView();
    expect(w.meaning).toBe('first');
    expect(dict.translations().get(w.id!)!.length).toBe(2);
  });

  it('stores, keeps, merges and removes the structured definition', async () => {
    const def = {
      entries: [{ meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'Sharp tool.', synonyms: [], antonyms: [] }], synonyms: [], antonyms: [] }] }],
      sourceUrls: [],
    };
    const { id } = await dict.saveWord({ text: 'knife', meaning: '', definition: def, translations: [], collectionIds: [] });
    expect((await db.words.get(id))!.definition).toEqual(def);

    // Edit without passing a definition keeps it.
    await dict.saveWord({ id, text: 'knife', meaning: 'note', translations: [], collectionIds: [] });
    expect((await db.words.get(id))!.definition).toEqual(def);

    // Search finds text inside the definition.
    await settle();
    dict.query.set('sharp');
    expect(dict.visibleWords().map((w) => w.text)).toEqual(['knife']);

    // Backup round-trip accepts it.
    await dict.importBackup(await dict.exportBackup());
    expect((await db.words.get(id))!.definition).toEqual(def);

    // null removes it.
    await dict.saveWord({ id, text: 'knife', meaning: 'note', definition: null, translations: [], collectionIds: [] });
    expect('definition' in (await db.words.get(id))!).toBe(false);

    // Merging an existing word adds a definition when it had none.
    await dict.saveWord({ text: 'knife', meaning: '', definition: def, translations: [], collectionIds: [] });
    expect((await db.words.get(id))!.definition).toEqual(def);
  });

  it('matches Arabic regardless of diacritics', async () => {
    await dict.saveWord({ text: 'book', meaning: '', translations: ['كِتَاب'], collectionIds: [] });
    await dict.saveWord({ text: 'books', meaning: '', translations: ['كتاب'], collectionIds: [] });
    expect(await db.words.where('lang').equals('ar').count()).toBe(1);
  });

  it('editing replaces translations and removes dropped links', async () => {
    const { id } = await dict.saveWord({ text: 'knife', meaning: '', translations: ['سكين', 'مدية'], collectionIds: [] });
    await dict.saveWord({ id, text: 'knife', meaning: 'x', translations: ['سكين'], collectionIds: [] });
    await settle();
    expect(dict.translations().get(id)!.map((t) => t.text)).toEqual(['سكين']);
    expect(await db.links.count()).toBe(1);
  });

  it('rejects renaming a word onto an existing one', async () => {
    await dict.saveWord({ text: 'a', meaning: '', translations: [], collectionIds: [] });
    const { id } = await dict.saveWord({ text: 'b', meaning: '', translations: [], collectionIds: [] });
    await expect(dict.saveWord({ id, text: 'A', meaning: '', translations: [], collectionIds: [] })).rejects.toThrow(/already/);
  });

  it('collections: newest first, filter the view, translations join, delete cleans up', async () => {
    const c1 = await dict.addCollection('Kitchen');
    await new Promise((r) => setTimeout(r, 5));
    const c2 = await dict.addCollection('Sports');
    await settle();
    expect(dict.collections().map((c) => c.name)).toEqual(['Sports', 'Kitchen']);
    await expect(dict.addCollection('kitchen')).rejects.toThrow(/already exists/);

    await dict.saveWord({ text: 'knife', meaning: '', translations: ['سكين'], collectionIds: [c1] });
    await dict.saveWord({ text: 'ball', meaning: '', translations: ['كرة'], collectionIds: [c2] });
    await settle();
    expect(dict.allCount()).toBe(2);
    await dict.selectCollection(c1);
    await settle();
    expect(dict.wordsInView().map((w) => w.text)).toEqual(['knife']);

    // Arabic view of Kitchen is not empty because translations joined the collection.
    await dict.swapLanguages();
    await settle();
    expect(dict.wordsInView().map((w) => w.text)).toEqual(['سكين']);
    await dict.swapLanguages();

    await dict.deleteCollection(c1);
    await settle();
    expect(dict.activeCollectionId()).toBeNull();
    expect(await db.words.where('collectionIds').equals(c1).count()).toBe(0);
    expect(dict.allCount()).toBe(2);
  });

  it('a word can sit in several collections', async () => {
    const a = await dict.addCollection('A');
    const b = await dict.addCollection('B');
    await dict.saveWord({ text: 'x', meaning: '', translations: [], collectionIds: [a, b] });
    await settle();
    expect(dict.countByCollection().get(a)).toBe(1);
    expect(dict.countByCollection().get(b)).toBe(1);
  });

  it('works with any language pair and keeps pairs separate', async () => {
    await dict.saveWord({ text: 'knife', meaning: '', translations: ['سكين'], collectionIds: [] });
    await dict.setLanguages('en', 'fr');
    await dict.saveWord({ text: 'knife', meaning: '', translations: ['couteau'], collectionIds: [] });
    await settle();
    expect(dict.allCount()).toBe(1);
    const [w] = dict.wordsInView();
    expect(dict.translations().get(w.id!)!.map((t) => t.text)).toEqual(['couteau']);
    await dict.setLanguages('en', 'ar');
    await settle();
    expect(dict.translations().get(w.id!)!.map((t) => t.text)).toEqual(['سكين']);
    await expect(dict.setLanguages('en', 'en')).rejects.toThrow();
  });

  it('search matches word, meaning and translation', async () => {
    await dict.saveWord({ text: 'knife', meaning: 'sharp tool', translations: ['سكين'], collectionIds: [] });
    await dict.saveWord({ text: 'ball', meaning: '', translations: ['كرة'], collectionIds: [] });
    await settle();
    dict.query.set('kni');
    expect(dict.visibleWords().map((w) => w.text)).toEqual(['knife']);
    dict.query.set('sharp');
    expect(dict.visibleWords().map((w) => w.text)).toEqual(['knife']);
    dict.query.set('كرة');
    expect(dict.visibleWords().map((w) => w.text)).toEqual(['ball']);
    dict.query.set('');
  });

  it('suggests a word from the active view, and follows collection and deletion', async () => {
    const k = await dict.addCollection('Kitchen');
    await dict.saveWord({ text: 'knife', meaning: '', translations: ['سكين'], collectionIds: [k] });
    await dict.saveWord({ text: 'ball', meaning: '', translations: ['كرة'], collectionIds: [] });
    await settle();
    expect(dict.suggested()).not.toBeNull();
    await dict.selectCollection(k);
    await settle();
    expect(dict.suggested()!.text).toBe('knife');
    await dict.deleteWord(dict.suggested()!.id!);
    await settle();
    expect(dict.suggested()).toBeNull();
  });

  it('deleting a word removes its links but keeps its translations as words', async () => {
    const { id } = await dict.saveWord({ text: 'knife', meaning: '', translations: ['سكين'], collectionIds: [] });
    await dict.deleteWord(id);
    expect(await db.links.count()).toBe(0);
    expect(await db.words.count()).toBe(1);
  });
});
