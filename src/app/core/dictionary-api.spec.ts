import { describe, expect, it } from 'vitest';
import { definitionText, firstDefinition, parseDictionaryResponse } from './dictionary-api';

describe('parseDictionaryResponse', () => {
  it('keeps every definition, example, synonym, antonym and origin, and ignores phonetics', () => {
    const def = parseDictionaryResponse([
      {
        word: 'bank',
        phonetic: '/bæŋk/',
        phonetics: [{ text: '/bæŋk/', audio: 'x.mp3' }],
        origin: 'from Old Norse',
        meanings: [
          {
            partOfSpeech: 'noun',
            synonyms: ['shore'],
            antonyms: [],
            definitions: [
              { definition: 'Edge of a river.', example: 'We sat on the bank.', synonyms: ['side'], antonyms: [] },
              { definition: 'A slope.', synonyms: [], antonyms: [] },
              { definition: 'Mound.', synonyms: [], antonyms: [] },
            ],
          },
          { partOfSpeech: 'verb', synonyms: [], antonyms: ['flatten'], definitions: [{ definition: 'To heap up.' }] },
        ],
        sourceUrls: ['https://en.wiktionary.org/wiki/bank'],
      },
      {
        word: 'bank',
        origin: 'from Italian banca',
        meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A financial institution.' }] }],
        sourceUrls: ['https://en.wiktionary.org/wiki/bank'],
      },
    ]);

    expect(def).not.toBeNull();
    expect(JSON.stringify(def)).not.toContain('bæŋk');
    expect(def!.entries).toHaveLength(2);
    expect(def!.entries[0].origin).toBe('from Old Norse');
    expect(def!.entries[0].meanings[0].definitions).toHaveLength(3);
    expect(def!.entries[0].meanings[0].definitions[0]).toEqual({
      definition: 'Edge of a river.',
      example: 'We sat on the bank.',
      synonyms: ['side'],
      antonyms: [],
    });
    expect(def!.entries[0].meanings[0].synonyms).toEqual(['shore']);
    expect(def!.entries[0].meanings[1].antonyms).toEqual(['flatten']);
    expect(def!.entries[1].meanings[0].definitions[0].definition).toBe('A financial institution.');
    expect(def!.sourceUrls).toEqual(['https://en.wiktionary.org/wiki/bank']);
  });

  it('merges entries that share an origin and drops repeated definitions', () => {
    const def = parseDictionaryResponse([
      { meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A thing.' }] }] },
      {
        meanings: [
          { partOfSpeech: 'noun', definitions: [{ definition: 'A thing.', example: 'This thing.' }, { definition: 'Other.' }] },
        ],
      },
    ]);
    expect(def!.entries).toHaveLength(1);
    expect(def!.entries[0].meanings).toHaveLength(1);
    expect(def!.entries[0].meanings[0].definitions.map((d) => d.definition)).toEqual(['A thing.', 'Other.']);
    expect(def!.entries[0].meanings[0].definitions[0].example).toBe('This thing.');
  });

  it('returns null for an empty or invalid response', () => {
    expect(parseDictionaryResponse({ title: 'No Definitions Found' })).toBeNull();
    expect(parseDictionaryResponse([{ meanings: [] }])).toBeNull();
  });

  it('flattens for search and summarizes', () => {
    const def = parseDictionaryResponse([
      { origin: 'Latin', meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'Sharp tool.', example: 'Cut it.' }] }] },
    ])!;
    expect(definitionText(def)).toContain('Cut it.');
    expect(definitionText(def)).toContain('Latin');
    expect(firstDefinition(def)).toBe('Sharp tool.');
  });
});
