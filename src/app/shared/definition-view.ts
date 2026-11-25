import { Component, input } from '@angular/core';
import { WordDefinition } from '../core/models';

/** Renders a dictionary definition grouped by entry and part of speech. */
@Component({
  selector: 'app-definition-view',
  template: `
    @for (entry of definition().entries; track $index) {
      <div class="entry">
        @if (definition().entries.length > 1) {
          <p class="entry-label">Entry {{ $index + 1 }}</p>
        }
        @for (meaning of entry.meanings; track $index) {
          <div class="meaning">
            @if (meaning.partOfSpeech) {
              <span class="pos">{{ meaning.partOfSpeech }}</span>
            }
            @if (meaning.definitions.length) {
              <ol class="senses">
                @for (sense of meaning.definitions; track $index) {
                  <li>
                    <span class="def">{{ sense.definition }}</span>
                    @if (sense.example) {
                      <span class="example">“{{ sense.example }}”</span>
                    }
                    @if (sense.synonyms.length) {
                      <span class="related"><b>Synonyms:</b> {{ sense.synonyms.join(', ') }}</span>
                    }
                    @if (sense.antonyms.length) {
                      <span class="related"><b>Antonyms:</b> {{ sense.antonyms.join(', ') }}</span>
                    }
                  </li>
                }
              </ol>
            }
            @if (meaning.synonyms.length) {
              <div class="words">
                <span class="words-label">Synonyms</span>
                @for (w of meaning.synonyms; track w) {
                  <span class="word-chip">{{ w }}</span>
                }
              </div>
            }
            @if (meaning.antonyms.length) {
              <div class="words">
                <span class="words-label">Antonyms</span>
                @for (w of meaning.antonyms; track w) {
                  <span class="word-chip">{{ w }}</span>
                }
              </div>
            }
          </div>
        }
        @if (entry.origin) {
          <p class="origin"><b>Origin:</b> {{ entry.origin }}</p>
        }
      </div>
    }
    @if (showSource() && definition().sourceUrls.length) {
      <p class="source">
        Source:
        @for (url of definition().sourceUrls; track url; let last = $last) {
          <a [href]="url" target="_blank" rel="noopener noreferrer">{{ url }}</a>{{ last ? '' : ', ' }}
        }
      </p>
    }
  `,
  styles: `
    :host { display: block; line-height: 1.5; overflow-wrap: anywhere; }
    .entry + .entry { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--app-line); }
    .entry-label { margin: 0 0 6px; color: var(--app-mu); font-size: 12px; font-weight: 600; }
    .meaning + .meaning { margin-top: 12px; }
    .pos {
      display: inline-block; margin-bottom: 4px; padding: 1px 10px; border-radius: 999px;
      background: var(--app-accbg); color: var(--app-acc); font-size: 12px; font-weight: 600; font-style: italic;
    }
    .senses { margin: 0; padding-inline-start: 22px; }
    .senses li + li { margin-top: 6px; }
    .senses li::marker { color: var(--app-mu); }
    .def, .example, .related { display: block; }
    .example { margin-top: 2px; color: var(--app-mu); font-style: italic; }
    .related { margin-top: 2px; color: var(--app-mu); font-size: 13px; }
    .words { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
    .words-label { color: var(--app-mu); font-size: 12px; font-weight: 600; }
    .word-chip { padding: 1px 9px; border-radius: 999px; background: var(--app-chip); font-size: 13px; }
    .origin { margin: 10px 0 0; color: var(--app-mu); font-size: 13px; }
    .source { margin: 14px 0 0; color: var(--app-mu); font-size: 12px; }
    .source a { color: var(--app-acc); }
    b { font-weight: 600; }
  `,
})
export class DefinitionView {
  readonly definition = input.required<WordDefinition>();
  readonly showSource = input(true);
}
