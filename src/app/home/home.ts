import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstDefinition } from '../core/dictionary-api';
import { DictionaryService } from '../core/dictionary.service';
import { Word, languageName } from '../core/models';
import { ConfirmDialog, ConfirmDialogData } from '../shared/confirm-dialog';
import { WordDetailsDialog, WordDetailsDialogData } from '../shared/word-details-dialog';
import { WordDialog, WordDialogData, WordDialogResult } from '../shared/word-dialog';

@Component({
  selector: 'app-home',
  imports: [FormsModule, MatIconModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly dict = inject(DictionaryService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly title = computed(() => this.dict.activeCollection()?.name ?? 'All words');
  protected readonly subtitle = computed(
    () => `${languageName(this.dict.primaryLang())} → ${languageName(this.dict.secondaryLang())}`,
  );

  protected trs(word: Word): Word[] {
    return this.dict.translations().get(word.id!) ?? [];
  }

  protected trText(word: Word): string {
    return this.trs(word)
      .map((t) => t.text)
      .join(' · ');
  }

  /** Typed meaning, or the first dictionary definition as a fallback. */
  protected summary(word: Word): string {
    return word.meaning || firstDefinition(word.definition);
  }

  protected add(): void {
    this.openWordDialog({});
  }

  protected edit(word: Word): void {
    this.openWordDialog({ word });
  }

  protected showDetails(word: Word): void {
    const data: WordDetailsDialogData = {
      word,
      translations: this.trs(word).map((translation) => translation.text),
      collections: word.collectionIds.map((id) => this.dict.collectionName(id)),
    };
    this.dialog
      .open<WordDetailsDialog, WordDetailsDialogData, string>(WordDetailsDialog, {
        data,
        width: '540px',
        maxWidth: '94vw',
      })
      .afterClosed()
      .subscribe((selectedWord) => {
        if (selectedWord) this.openWordDialog({ initialText: selectedWord });
      });
  }

  private openWordDialog(data: WordDialogData): void {
    this.dialog
      .open<WordDialog, WordDialogData, WordDialogResult>(WordDialog, {
        data,
        width: '520px',
        maxWidth: '94vw',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result?.merged) {
          this.snack.open('Already in your dictionary. Merged into the existing word.', 'OK', {
            duration: 4000,
          });
        }
      });
  }

  protected remove(word: Word): void {
    const data: ConfirmDialogData = {
      title: 'Delete word',
      message: `Delete "${word.text}"? Its translations stay in your dictionary.`,
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialog, { data, width: '380px', maxWidth: '92vw' })
      .afterClosed()
      .subscribe(async (ok) => {
        if (!ok) return;
        await this.dict.deleteWord(word.id!);
        this.snack.open('Word deleted', undefined, { duration: 2500 });
      });
  }
}
