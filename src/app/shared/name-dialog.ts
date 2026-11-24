import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface NameDialogData {
  title: string;
  label: string;
  value?: string;
  confirmLabel: string;
  /** Runs on submit. Throw to show an inline error and keep the dialog open. */
  submit: (value: string) => Promise<void>;
}

@Component({
  selector: 'app-name-dialog',
  imports: [FormsModule, MatDialogModule],
  template: `
    <form (ngSubmit)="save()">
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>
        <div class="field">
          <label class="field-label" for="name">{{ data.label }}</label>
          <input
            id="name"
            class="input"
            name="name"
            dir="auto"
            autocomplete="off"
            cdkFocusInitial
            [(ngModel)]="value"
            (ngModelChange)="error.set('')"
          />
        </div>
        @if (error()) {
          <p class="form-error" role="alert">{{ error() }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn" mat-dialog-close>Cancel</button>
        <button type="submit" class="btn btn-primary" [disabled]="busy()">
          {{ data.confirmLabel }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    :host {
      display: block;
      min-width: min(340px, 78vw);
    }
  `,
})
export class NameDialog {
  protected readonly data = inject<NameDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<NameDialog>);

  protected readonly value = signal(this.data.value ?? '');
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected async save(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.data.submit(this.value());
      this.ref.close(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      this.busy.set(false);
    }
  }
}
