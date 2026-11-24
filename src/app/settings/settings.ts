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
