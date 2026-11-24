import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Word } from '../core/models';

export interface WordDetailsDialogData {
  word: Word;
  translations: string[];
  collections: string[];
}

@Component({
  selector: 'app-word-details-dialog',
  imports: [MatDialogModule],
  template: `
    <h2 mat-dialog-title dir="auto">{{ data.word.text }}</h2>
    <mat-dialog-content>
      @if (data.word.meaning) {
        <section class="detail-section" (mouseup)="captureMeaningSelection()" (keyup)="captureMeaningSelection()">
          <h3>Meaning</h3>
          <p class="meaning meaning-text" dir="auto">{{ data.word.meaning }}</p>
        </section>
      }

      <section class="detail-section">
        <h3>Translations</h3>
        @if (data.translations.length) {
          <ul dir="auto">
            @for (translation of data.translations; track translation) {
              <li>{{ translation }}</li>
            }
          </ul>
        } @else {
          <p class="empty">No translations yet.</p>
        }
      </section>

      @if (data.collections.length) {
        <section class="detail-section">
          <h3>Collections</h3>
          <p dir="auto">{{ data.collections.join(', ') }}</p>
        </section>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" class="btn btn-primary" mat-dialog-close>Close</button>
    </mat-dialog-actions>
    @if (selectedWord() && appendPosition(); as position) {
      <button
        type="button"
        class="btn btn-primary append-selection"
        [style.top.px]="position.top"
        [style.left.px]="position.left"
        (mousedown)="$event.preventDefault()"
        (click)="appendSelected()"
      >Append</button>
    }
  `,
  styles: `
    :host { display: block; min-width: min(380px, 78vw); }
    .detail-section { margin: 0 0 18px; }
    .detail-section:last-child { margin-bottom: 0; }
    h3 { margin: 0 0 6px; color: var(--app-mu); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
    p, ul { margin: 0; overflow-wrap: anywhere; }
    ul { padding-inline-start: 20px; }
    li + li { margin-top: 4px; }
    .meaning { white-space: pre-wrap; line-height: 1.55; }
    .empty { color: var(--app-mu); }
    .append-selection { position: fixed; z-index: 1000; transform: translateX(-50%); box-shadow: 0 4px 14px rgb(0 0 0 / 22%); }
  `,
})
export class WordDetailsDialog {
  protected readonly data = inject<WordDetailsDialogData>(MAT_DIALOG_DATA);
  protected readonly selectedWord = signal('');
  protected readonly appendPosition = signal<{ top: number; left: number } | null>(null);
  private readonly ref = inject(MatDialogRef<WordDetailsDialog, string>);

  protected captureMeaningSelection(): void {
    const selection = document.getSelection();
    const selected = selection?.toString().trim() ?? '';
    const meaning = document.querySelector('.meaning-text');
    if (!selected || !selection?.rangeCount || !meaning?.contains(selection.anchorNode)) {
      this.selectedWord.set('');
      this.appendPosition.set(null);
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    this.selectedWord.set(selected);
    this.appendPosition.set({
      top: Math.min(rect.bottom + 8, window.innerHeight - 48),
      left: Math.min(Math.max(rect.left + rect.width / 2, 52), window.innerWidth - 52),
    });
  }

  protected appendSelected(): void {
    const selected = this.selectedWord().trim();
    if (selected) this.ref.close(selected);
  }
}
