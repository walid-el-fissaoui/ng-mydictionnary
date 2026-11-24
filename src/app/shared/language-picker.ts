import { Component, computed, input, linkedSignal, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LANGUAGES } from '../core/models';

const OTHER = '__other__';

let nextId = 0;

@Component({
  selector: 'app-language-picker',
  imports: [FormsModule],
  template: `
    <div class="field">
      <label class="field-label" [for]="id">{{ label() }}</label>
      <select class="input" [id]="id" [ngModel]="selected()" (ngModelChange)="onSelect($event)">
        @for (l of languages; track l.code) {
          <option [value]="l.code">{{ l.name }} ({{ l.code }})</option>
        }
        <option [value]="other">Other…</option>
      </select>
    </div>
    @if (isCustom()) {
      <div class="field">
        <label class="field-label" [for]="id + '-code'">Language code</label>
        <input
          class="input"
          [id]="id + '-code'"
          autocomplete="off"
          placeholder="nl"
          [ngModel]="customText()"
          (ngModelChange)="onCustom($event)"
        />
        <p class="field-hint">Two or three letters, like nl or fil.</p>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class LanguagePicker {
  readonly label = input.required<string>();
  readonly value = model.required<string>();

  protected readonly id = `lang-${nextId++}`;
  protected readonly languages = LANGUAGES;
  protected readonly other = OTHER;

  private readonly customMode = signal(false);
  /** Starts from the current value when it isn't a listed language. */
  protected readonly customText = linkedSignal(() =>
    LANGUAGES.some((l) => l.code === this.value()) ? '' : this.value(),
  );

  protected readonly isCustom = computed(
    () => this.customMode() || !LANGUAGES.some((l) => l.code === this.value()),
  );
  protected readonly selected = computed(() => (this.isCustom() ? OTHER : this.value()));

  protected onSelect(code: string): void {
    if (code === OTHER) {
      this.customMode.set(true);
    } else {
      this.customMode.set(false);
      this.value.set(code);
    }
  }

  protected onCustom(text: string): void {
    this.customText.set(text);
    const code = text.trim().toLowerCase();
    if (/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/.test(code)) this.value.set(code);
  }
}
