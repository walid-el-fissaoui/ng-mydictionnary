import Dexie, { Table } from 'dexie';
import { AppSettings, Collection, Word, WordLink } from './models';

export class DictionaryDb extends Dexie {
  words!: Table<Word, number>;
  links!: Table<WordLink, number>;
  collections!: Table<Collection, number>;
  settings!: Table<AppSettings, number>;

  constructor() {
    super('mydictionnary');
    this.version(1).stores({
      // &[lang+textNorm]: one word per language and normalized text
      // *collectionIds: multi-entry index, a word can sit in many collections
      words: '++id, lang, &[lang+textNorm], *collectionIds, createdAt',
      // &[a+b]: one link per pair, a < b
      links: '++id, &[a+b], a, b',
      collections: '++id, createdAt',
      settings: 'id',
    });
  }
}

export const db = new DictionaryDb();
