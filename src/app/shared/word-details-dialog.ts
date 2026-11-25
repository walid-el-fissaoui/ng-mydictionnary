import { Component, DestroyRef, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Word } from '../core/models';
import { DefinitionView } from './definition-view';

export interface WordDetailsDialogData {
  word: Word;
  translations: string[];
  collections: string[];
}

@Component({
  selector: 'app-word-details-dialog',
  imports: [DefinitionView, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title dir="auto">{{ data.word.text }}</h2>
    <mat-dialog-content (scroll)="onSelectionChange()">
      @if (data.word.definition; as def) {
        <section class="detail-section">
          <h3>Meaning</h3>
          <app-definition-view class="meaning-text" [definition]="def" />
        </section>
      }

      @if (data.word.meaning) {
        <section class="detail-section">
          <h3>{{ data.word.definition ? 'Notes' : 'Meaning' }}</h3>
          <p class="meaning meaning-text" dir="auto">{{ data.word.meaning }}</p>
        </section>
      }

      <section class="detail-section">
        <h3>Translations</h3>
        @if (data.translations.length) {
          <ul class="chips">
            @for (translation of data.translations; track translation) {
              <li class="chip tr-chip" dir="auto">{{ translation }}</li>
            }
          </ul>
        } @else {
          <p class="empty">No translations yet.</p>
        }
      </section>

      @if (data.collections.length) {
        <section class="detail-section">
          <h3>Collections</h3>
          <ul class="chips">
            @for (collection of data.collections; track collection) {
              <li class="chip coll-chip" dir="auto">
                <mat-icon aria-hidden="true">folder</mat-icon>
                {{ collection }}
              </li>
            }
          </ul>
        </section>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (selectedWord()) {
        <!-- Touch devices: a stable button that never sits under the native selection menu. -->
        <button
          type="button"
          class="btn btn-outline append-bar"
          (pointerdown)="keepSelection()"
        (pointercancel)="pressing = false"
          (mousedown)="$event.preventDefault()"
          (click)="appendSelected()"
        >
          <mat-icon>add</mat-icon>
          <span class="append-label" dir="auto">Add “{{ selectedWord() }}”</span>
        </button>
      }
      <button type="button" class="btn btn-primary" mat-dialog-close>Close</button>
    </mat-dialog-actions>
    @if (selectedWord() && appendPosition(); as position) {
      <!-- Mouse devices: a floating button right next to the selection. -->
      <button
        type="button"
        class="btn btn-primary append-float"
        [style.top.px]="position.top"
        [style.left.px]="position.left"
        (pointerdown)="keepSelection()"
        (pointercancel)="pressing = false"
        (mousedown)="$event.preventDefault()"
        (click)="appendSelected()"
      >
        <mat-icon>add</mat-icon>
        Append
      </button>
    }
  `,
  styles: `
    :host { display: block; min-width: min(380px, 78vw); }
    .detail-section { margin: 0 0 18px; }
    .detail-section:last-child { margin-bottom: 0; }
    h3 { margin: 0 0 6px; color: var(--app-mu); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
    p { margin: 0; overflow-wrap: anywhere; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .chip { overflow-wrap: anywhere; }
    .tr-chip { padding: 5px 14px; background: var(--app-side); border-color: var(--app-line); color: var(--app-acc); font-size: 16px; font-weight: 500; }
    .coll-chip { color: var(--app-mu); font-weight: 500; }
    .coll-chip .mat-icon { color: var(--app-mu); }
    .meaning { white-space: pre-wrap; line-height: 1.55; }
    .empty { color: var(--app-mu); font-size: 13px; }
    .append-float { position: fixed; z-index: 1000; transform: translateX(-50%); box-shadow: 0 4px 14px rgb(0 0 0 / 22%); }
    .append-bar { margin-inline-end: auto; min-width: 0; max-width: 65%; }
    .append-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* Floating button only for precise pointers; the action-bar button only for touch. */
    @media (hover: hover) and (pointer: fine) { .append-bar { display: none; } }
    @media (hover: none), (pointer: coarse) { .append-float { display: none; } }
  `,
})
export class WordDetailsDialog {
  protected readonly data = inject<WordDetailsDialogData>(MAT_DIALOG_DATA);
  protected readonly selectedWord = signal('');
  protected readonly appendPosition = signal<{ top: number; left: number } | null>(null);
  private readonly ref = inject(MatDialogRef<WordDetailsDialog, string>);

  /** True while the append button is being pressed, so the selection collapsing on tap doesn't hide it. */
  protected pressing = false;
  private clearTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // selectionchange fires for mouse, keyboard and touch (long-press + handles) selections.
    const listener = () => this.onSelectionChange();
    document.addEventListener('selectionchange', listener);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('selectionchange', listener);
      clearTimeout(this.clearTimer);
    });
  }

  protected onSelectionChange(): void {
    const selection = document.getSelection();
    const anchor = selection?.anchorNode;
    const anchorEl = anchor instanceof Element ? anchor : anchor?.parentElement;
    const inMeaning = !!anchorEl?.closest('app-word-details-dialog .meaning-text');
    // Drop surrounding punctuation/quotes that touch selection often picks up.
    const selected = inMeaning
      ? (selection?.toString() ?? '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(/\s+/g, ' ')
      : '';

    if (!selected || !selection?.rangeCount) {
      if (this.pressing) return;
      // Small delay: on touch the selection collapses just before the button's click fires.
      clearTimeout(this.clearTimer);
      this.clearTimer = setTimeout(() => {
        if (this.pressing) return;
        this.selectedWord.set('');
        this.appendPosition.set(null);
      }, 300);
      return;
    }

    clearTimeout(this.clearTimer);
    this.pressing = false;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    this.selectedWord.set(selected);
    this.appendPosition.set({
      top: Math.min(rect.bottom + 8, window.innerHeight - 48),
      left: Math.min(Math.max(rect.left + rect.width / 2, 60), window.innerWidth - 60),
    });
  }

  protected keepSelection(): void {
    this.pressing = true;
    clearTimeout(this.clearTimer);
  }

  protected appendSelected(): void {
    const selected = this.selectedWord().trim();
    this.pressing = false;
    if (selected) this.ref.close(selected);
  }
}
