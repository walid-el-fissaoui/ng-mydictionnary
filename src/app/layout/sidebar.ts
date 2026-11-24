import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { DictionaryService } from '../core/dictionary.service';
import { LayoutService } from '../core/layout.service';
import { Collection } from '../core/models';
import { ConfirmDialog, ConfirmDialogData } from '../shared/confirm-dialog';
import { NameDialog, NameDialogData } from '../shared/name-dialog';

@Component({
  selector: 'app-sidebar',
  imports: [FormsModule, RouterLink, RouterLinkActive, MatIconModule, MatMenuModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected readonly dict = inject(DictionaryService);
  protected readonly layout = inject(LayoutService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected readonly filter = signal('');
  protected readonly filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const all = this.dict.collections();
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  });

  protected async select(id: number | null): Promise<void> {
    await this.dict.selectCollection(id);
    this.dict.query.set('');
    this.layout.closeDrawer();
    if (this.router.url !== '/') await this.router.navigateByUrl('/');
  }

  protected createCollection(): void {
    const data: NameDialogData = {
      title: 'New collection',
      label: 'Name',
      confirmLabel: 'Create',
      submit: async (name) => {
        const id = await this.dict.addCollection(name);
        await this.select(id);
      },
    };
    this.dialog.open(NameDialog, { data, width: '360px', maxWidth: '92vw' });
  }

  protected rename(c: Collection): void {
    const data: NameDialogData = {
      title: 'Rename collection',
      label: 'Name',
      value: c.name,
      confirmLabel: 'Save',
      submit: (name) => this.dict.renameCollection(c.id!, name),
    };
    this.dialog.open(NameDialog, { data, width: '360px', maxWidth: '92vw' });
  }

  protected remove(c: Collection): void {
    const data: ConfirmDialogData = {
      title: 'Delete collection',
      message: `Delete "${c.name}"? Its words stay in your dictionary.`,
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialog, { data, width: '380px', maxWidth: '92vw' })
      .afterClosed()
      .subscribe(async (ok) => {
        if (!ok) return;
        await this.dict.deleteCollection(c.id!);
        this.snack.open('Collection deleted', undefined, { duration: 2500 });
      });
  }

  protected openCollections(): void {
    this.layout.expand();
  }
}
