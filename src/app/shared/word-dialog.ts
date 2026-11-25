import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DictionaryService } from '../core/dictionary.service';
import { fetchDefinition } from '../core/dictionary-api';
import { Word, WordDefinition, languageName } from '../core/models';
import { DefinitionView } from './definition-view';
import { NameDialog, NameDialogData } from './name-dialog';

export interface WordDialogData {
  /** Present when editing. */
  word?: Word;
  /** Prefills the word field when adding from the details dialog. */
  initialText?: string;
}

export interface WordDialogResult {
  merged: boolean;
}

@Component({
  selector: 'app-word-dialog',
  imports: [DefinitionView, FormsModule, MatDialogModule, MatIconModule],
  templateUrl: './word-dialog.html',
  styleUrl: './word-dialog.scss',
})
export class WordDialog {
  protected readonly data = inject<WordDialogData>(MAT_DIALOG_DATA);
  protected readonly dict = inject(DictionaryService);
  private readonly ref = inject(MatDialogRef<WordDialog, WordDialogResult>);
  private readonly dialog = inject(MatDialog);

  protected readonly primaryName = computed(() => languageName(this.dict.primaryLang()));
  protected readonly secondaryName = computed(() => languageName(this.dict.secondaryLang()));

  protected readonly text = signal(this.data.word?.text ?? this.data.initialText ?? '');
  protected readonly meaning = signal(this.data.word?.meaning ?? '');
  protected readonly definition = signal<WordDefinition | null>(this.data.word?.definition ?? null);
  protected readonly translations = signal<string[]>(
    this.data.word
      ? (this.dict.translations().get(this.data.word.id!) ?? []).map((t) => t.text)
      : [],
  );
  protected readonly collectionIds = signal<number[]>(
    this.data.word
      ? [...this.data.word.collectionIds]
      : this.dict.activeCollectionId() !== null
        ? [this.dict.activeCollectionId()!]
        : [],
  );
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly lookingUpMeaning = signal(false);

  /** Fetches the full English definition (all meanings, examples and origin). */
  protected async lookupMeaning(): Promise<void> {
    const word = this.text().trim();
    if (!word || this.lookingUpMeaning()) return;

    this.error.set('');
    this.lookingUpMeaning.set(true);
    try {
      this.definition.set(await fetchDefinition(word));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      this.lookingUpMeaning.set(false);
    }
  }

  /** Enter or a comma (Latin or Arabic) confirms a translation; Backspace on empty removes the last. */
  protected onTranslationKey(event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.isComposing) return;
    if (event.key === ',' || event.key === '،' || (event.key === 'Enter' && input.value.trim())) {
      event.preventDefault();
      this.commit(input);
    } else if (event.key === 'Backspace' && !input.value) {
      this.translations.update((list) => list.slice(0, -1));
    }
  }

  protected commit(input: HTMLInputElement): void {
    this.pushTranslations(input.value);
    input.value = '';
  }

  protected removeTranslation(t: string): void {
    this.translations.update((list) => list.filter((x) => x !== t));
  }

  /** Splits on commas (Latin and Arabic) and adds each non-empty, new value. */
  private pushTranslations(raw: string): void {
    const parts = raw
      .split(/[,،]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    this.translations.update((list) => {
      const next = [...list];
      for (const p of parts) if (!next.includes(p)) next.push(p);
      return next;
    });
  }

  protected toggleCollection(id: number): void {
    this.collectionIds.update((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  }

  protected newCollection(): void {
    const data: NameDialogData = {
      title: 'New collection',
      label: 'Name',
      confirmLabel: 'Create',
      submit: async (name) => {
        const id = await this.dict.addCollection(name);
        this.collectionIds.update((list) => [...list, id]);
      },
    };
    this.dialog.open(NameDialog, { data, width: '380px', maxWidth: '92vw' });
  }

  protected async save(pending: HTMLInputElement): Promise<void> {
    if (this.busy()) return;
    // Include a translation that was typed but not confirmed yet.
    this.commit(pending);
    this.busy.set(true);
    try {
      const result = await this.dict.saveWord({
        id: this.data.word?.id,
        text: this.text(),
        meaning: this.meaning(),
        definition: this.definition(),
        translations: this.translations(),
        collectionIds: this.collectionIds(),
      });
      this.ref.close({ merged: result.merged });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      this.busy.set(false);
    }
  }
}
