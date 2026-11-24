import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DictionaryService } from '../core/dictionary.service';
import { ThemeMode, ThemeService } from '../core/theme.service';
import { LanguagePicker } from '../shared/language-picker';

@Component({
  selector: 'app-settings',
  imports: [MatIconModule, LanguagePicker],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  protected readonly dict = inject(DictionaryService);
  protected readonly theme = inject(ThemeService);
  private readonly snack = inject(MatSnackBar);

  protected readonly themes: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'system', label: 'System', icon: 'brightness_auto' },
    { mode: 'light', label: 'Light', icon: 'light_mode' },
    { mode: 'dark', label: 'Dark', icon: 'dark_mode' },
  ];

  protected async exportData(): Promise<void> {
    try {
      const backup = await this.dict.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mydictionnary-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      this.snack.open('Dictionary exported', 'OK');
    } catch {
      this.snack.open('Could not export dictionary', 'OK');
    }
  }

  protected async importData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!window.confirm('Importing this backup will replace all words, collections, translations, and settings on this device. Continue?')) return;
    try {
      const backup: unknown = JSON.parse(await file.text());
      await this.dict.importBackup(backup);
      this.snack.open('Dictionary imported', 'OK');
    } catch (e) {
      this.snack.open(e instanceof Error ? e.message : 'Could not import this file', 'OK');
    }
  }

  protected async setPrimary(code: string): Promise<void> {
    if (code === this.dict.primaryLang()) return;
    // Picking the language that is currently secondary swaps the two.
    const secondary = code === this.dict.secondaryLang() ? this.dict.primaryLang() : this.dict.secondaryLang();
    await this.apply(code, secondary);
  }

  protected async setSecondary(code: string): Promise<void> {
    if (code === this.dict.secondaryLang()) return;
    const primary = code === this.dict.primaryLang() ? this.dict.secondaryLang() : this.dict.primaryLang();
    await this.apply(primary, code);
  }

  protected async swap(): Promise<void> {
    await this.dict.swapLanguages();
  }

  private async apply(primary: string, secondary: string): Promise<void> {
    try {
      await this.dict.setLanguages(primary, secondary);
    } catch (e) {
      this.snack.open(e instanceof Error ? e.message : 'Could not save languages', 'OK');
    }
  }
}
