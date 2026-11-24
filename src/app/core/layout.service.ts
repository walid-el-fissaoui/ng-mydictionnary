import { BreakpointObserver } from '@angular/cdk/layout';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

const KEY = 'mydictionnary.sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly mobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 768px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  /** Desktop only: sidebar shrinks to an icon rail. */
  readonly collapsed = signal(readCollapsed());
  /** Mobile only: sidebar slides over the content. */
  readonly drawerOpen = signal(false);

  /** True when the sidebar shows icons only. */
  readonly compact = computed(() => !this.mobile() && this.collapsed());

  toggle(): void {
    if (this.mobile()) {
      this.drawerOpen.update((v) => !v);
      return;
    }
    this.collapsed.update((v) => !v);
    try {
      localStorage.setItem(KEY, this.collapsed() ? '1' : '0');
    } catch {
      // Storage unavailable: the preference just isn't remembered.
    }
  }

  expand(): void {
    if (this.collapsed()) this.toggle();
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }
}
