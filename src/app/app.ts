import { Component, computed, inject } from '@angular/core';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterOutlet } from '@angular/router';
import { DictionaryService } from './core/dictionary.service';
import { LayoutService } from './core/layout.service';
import { ThemeService } from './core/theme.service';
import { Sidebar } from './layout/sidebar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatIconModule, Sidebar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly layout = inject(LayoutService);
  protected readonly dict = inject(DictionaryService);
  protected readonly theme = inject(ThemeService);
  private readonly snack = inject(MatSnackBar);

  protected readonly primary = computed(() => this.dict.primaryLang().toUpperCase());
  protected readonly secondary = computed(() => this.dict.secondaryLang().toUpperCase());

  constructor() {
    // Outline icons everywhere, to match the lighter look.
    inject(MatIconRegistry).setDefaultFontSetClass('material-icons-outlined');
  }

  protected async swap(): Promise<void> {
    try {
      await this.dict.swapLanguages();
    } catch (e) {
      this.snack.open(e instanceof Error ? e.message : 'Could not swap languages', 'OK');
    }
  }
}
