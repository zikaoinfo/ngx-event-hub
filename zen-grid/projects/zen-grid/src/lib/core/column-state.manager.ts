/**
 * Column runtime state: order, width, visibility, pinning — plus multi-level
 * header layout and JSON save/restore (localStorage / query-param friendly).
 */
import { Injectable, PLATFORM_ID, Signal, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ColDefOrGroup,
  ColumnDef,
  ColumnGroupDef,
  ColumnPinned,
  colIdOf,
  defaultHeaderName,
  isColumnGroup,
} from '../types/column-def.types';
import { StatePersistenceOptions } from '../types/grid-options.types';

/** JSON-serializable state of one column. */
export interface ColumnState {
  colId: string;
  width: number;
  flex: number | null;
  hide: boolean;
  pinned: ColumnPinned;
}

/** A rendered header cell in the multi-level header. */
export interface HeaderCell<T extends object = object> {
  colId: string;
  label: string;
  colSpan: number;
  rowSpan: number;
  /** Index of the first visible leaf column this cell covers. */
  leafStart: number;
  isGroup: boolean;
  leaf: ColumnDef<T> | null;
  pinned: ColumnPinned;
}

const DEFAULT_WIDTH = 160;

@Injectable()
export class ColumnStateManager<T extends object = object> {
  private readonly platformId = inject(PLATFORM_ID);

  /** Leaf defs in original definition order, keyed for lookups. */
  private defs: ColumnDef<T>[] = [];
  private defById = new Map<string, ColumnDef<T>>();
  private groupTree: readonly ColDefOrGroup<T>[] = [];
  private persistence: StatePersistenceOptions | null = null;

  /** Runtime state in *display order* — this array's order IS column order. */
  readonly columnStates = signal<readonly ColumnState[]>([]);

  // ── Derived ────────────────────────────────────────────────────

  readonly visibleStates: Signal<readonly ColumnState[]> = computed(() =>
    this.columnStates().filter((s) => !s.hide),
  );

  readonly leftPinned: Signal<readonly ColumnDef<T>[]> = computed(() =>
    this.pickDefs((s) => s.pinned === 'left'),
  );
  readonly centerColumns: Signal<readonly ColumnDef<T>[]> = computed(() =>
    this.pickDefs((s) => s.pinned === null || s.pinned === undefined),
  );
  readonly rightPinned: Signal<readonly ColumnDef<T>[]> = computed(() =>
    this.pickDefs((s) => s.pinned === 'right'),
  );

  /** All visible leaf columns in display order (pinned-left, center, pinned-right). */
  readonly visibleLeafColumns: Signal<readonly ColumnDef<T>[]> = computed(() => [
    ...this.leftPinned(),
    ...this.centerColumns(),
    ...this.rightPinned(),
  ]);

  readonly centerWidths: Signal<readonly number[]> = computed(() =>
    this.centerColumns().map((c) => this.widthOf(colIdOf(c))),
  );
  readonly leftPinnedWidth: Signal<number> = computed(() =>
    this.leftPinned().reduce((acc, c) => acc + this.widthOf(colIdOf(c)), 0),
  );
  readonly rightPinnedWidth: Signal<number> = computed(() =>
    this.rightPinned().reduce((acc, c) => acc + this.widthOf(colIdOf(c)), 0),
  );
  readonly totalCenterWidth: Signal<number> = computed(() =>
    this.centerWidths().reduce((a, b) => a + b, 0),
  );

  /** Multi-level header rows (group cells with col/row spans + leaf cells). */
  readonly headerRows: Signal<readonly HeaderCell<T>[][]> = computed(() => {
    this.columnStates(); // recompute on visibility/order changes
    return buildHeaderRows(this.groupTree, this.visibleLeafColumns());
  });

  // ── Setup ──────────────────────────────────────────────────────

  setColumnDefs(defs: readonly ColDefOrGroup<T>[], defaults?: Partial<ColumnDef<T>>): void {
    this.groupTree = defs;
    this.defs = collectLeaves(defs).map((d) => ({ ...defaults, ...d }));
    this.defById = new Map(this.defs.map((d) => [colIdOf(d), d]));
    const prior = new Map(this.columnStates().map((s) => [s.colId, s]));
    this.columnStates.set(this.defs.map((d) => this.initialStateFor(d, prior.get(colIdOf(d)))));
    this.restoreFromPersistence();
  }

  /**
   * Builds the runtime state for a column. Prior state (user resizes, order,
   * pinning) survives def refreshes, but `flex` always follows the def and
   * `lockVisible` columns can never stay hidden.
   */
  private initialStateFor(d: ColumnDef<T>, prior: ColumnState | undefined): ColumnState {
    const id = colIdOf(d);
    if (prior) {
      return {
        ...prior,
        flex: d.flex ?? null,
        hide: d.lockVisible ? (d.hide ?? false) : prior.hide,
      };
    }
    return {
      colId: id,
      width: d.width ?? DEFAULT_WIDTH,
      flex: d.flex ?? null,
      hide: d.hide ?? false,
      pinned: d.pinned ?? null,
    };
  }

  configurePersistence(opts: StatePersistenceOptions | null): void {
    this.persistence = opts;
    this.restoreFromPersistence();
  }

  defOf(colId: string): ColumnDef<T> | undefined {
    return this.defById.get(colId);
  }

  /** All leaf defs (visible or not) — used by the data pipeline. */
  allLeafDefs(): readonly ColumnDef<T>[] {
    return this.defs;
  }

  headerNameOf(colId: string): string {
    const def = this.defById.get(colId);
    return def?.headerName ?? defaultHeaderName(colId);
  }

  widthOf(colId: string): number {
    return this.columnStates().find((s) => s.colId === colId)?.width ?? DEFAULT_WIDTH;
  }

  // ── Mutations ──────────────────────────────────────────────────

  setWidth(colId: string, width: number): void {
    const def = this.defById.get(colId);
    const clamped = Math.max(def?.minWidth ?? 40, Math.min(def?.maxWidth ?? 4000, width));
    this.patch(colId, { width: clamped, flex: null });
  }

  setVisible(colId: string, visible: boolean): void {
    if (this.defById.get(colId)?.lockVisible) return;
    this.patch(colId, { hide: !visible });
  }

  setPinned(colId: string, pinned: ColumnPinned): void {
    this.patch(colId, { pinned });
  }

  /** Move a column to a new display index (drag-and-drop reorder). */
  move(colId: string, toIndex: number): void {
    if (this.defById.get(colId)?.suppressMovable) return;
    const states = [...this.columnStates()];
    const from = states.findIndex((s) => s.colId === colId);
    if (from === -1) return;
    const [s] = states.splice(from, 1);
    states.splice(Math.max(0, Math.min(states.length, toIndex)), 0, s);
    this.columnStates.set(states);
    this.persist();
  }

  /** Distribute flex widths across available center width. */
  applyFlex(availableWidth: number): void {
    const states = this.columnStates();
    const flexStates = states.filter((s) => !s.hide && s.flex !== null && s.pinned == null);
    if (flexStates.length === 0) return;
    const fixed = states
      .filter((s) => !s.hide && s.flex === null && s.pinned == null)
      .reduce((acc, s) => acc + s.width, 0);
    const free = Math.max(0, availableWidth - fixed);
    const totalFlex = flexStates.reduce((acc, s) => acc + (s.flex ?? 0), 0);
    if (totalFlex === 0) return;
    this.columnStates.set(
      states.map((s) =>
        s.flex !== null && !s.hide && s.pinned == null
          ? { ...s, width: Math.max(40, Math.floor((free * (s.flex ?? 0)) / totalFlex)) }
          : s,
      ),
    );
  }

  // ── Persistence ────────────────────────────────────────────────

  getColumnState(): ColumnState[] {
    return this.columnStates().map((s) => ({ ...s }));
  }

  applyColumnState(state: readonly ColumnState[]): void {
    const byId = new Map(state.map((s) => [s.colId, s]));
    // Order follows the supplied state; unknown columns keep relative order at end.
    const ordered: ColumnState[] = [];
    for (const s of state) {
      if (this.defById.has(s.colId)) ordered.push({ ...s });
    }
    for (const s of this.columnStates()) {
      if (!byId.has(s.colId)) ordered.push(s);
    }
    this.columnStates.set(ordered);
    this.persist();
  }

  /** Back to def-declared defaults, discarding all user state. */
  resetColumnState(): void {
    this.columnStates.set(this.defs.map((d) => this.initialStateFor(d, undefined)));
    this.persist();
  }

  private patch(colId: string, patch: Partial<ColumnState>): void {
    this.columnStates.set(
      this.columnStates().map((s) => (s.colId === colId ? { ...s, ...patch } : s)),
    );
    this.persist();
  }

  private persist(): void {
    const p = this.persistence;
    if (!p) return;
    const json = JSON.stringify(this.getColumnState());
    if (p.strategy === 'custom' && p.save) {
      p.save(p.key, json);
      return;
    }
    if (isPlatformBrowser(this.platformId)) {
      // SSR-GUARD: localStorage only exists in the browser.
      if (p.strategy === 'localStorage') {
        localStorage.setItem(`zen-grid:${p.key}`, json);
      } else if (p.strategy === 'queryParams') {
        const url = new URL(window.location.href);
        url.searchParams.set(`zg_${p.key}`, btoa(json));
        history.replaceState(history.state, '', url.toString());
      }
    }
  }

  private restoreFromPersistence(): void {
    const p = this.persistence;
    if (!p || this.defs.length === 0) return;
    let json: string | null = null;
    if (p.strategy === 'custom' && p.load) {
      json = p.load(p.key);
    } else if (isPlatformBrowser(this.platformId)) {
      // SSR-GUARD
      if (p.strategy === 'localStorage') {
        json = localStorage.getItem(`zen-grid:${p.key}`);
      } else if (p.strategy === 'queryParams') {
        const raw = new URL(window.location.href).searchParams.get(`zg_${p.key}`);
        json = raw ? atob(raw) : null;
      }
    }
    if (!json) return;
    try {
      const state = JSON.parse(json) as ColumnState[];
      if (Array.isArray(state)) this.applyColumnStateWithoutPersist(state);
    } catch {
      // Corrupt persisted state is ignored — defaults win.
    }
  }

  private applyColumnStateWithoutPersist(state: readonly ColumnState[]): void {
    const byId = new Map(state.map((s) => [s.colId, s]));
    const ordered: ColumnState[] = [];
    for (const s of state) if (this.defById.has(s.colId)) ordered.push({ ...s });
    for (const s of this.columnStates()) if (!byId.has(s.colId)) ordered.push(s);
    this.columnStates.set(ordered);
  }

  private pickDefs(predicate: (s: ColumnState) => boolean): ColumnDef<T>[] {
    const out: ColumnDef<T>[] = [];
    for (const s of this.columnStates()) {
      if (s.hide || !predicate(s)) continue;
      const def = this.defById.get(s.colId);
      if (def) out.push(def);
    }
    return out;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Header layout helpers
// ─────────────────────────────────────────────────────────────────────────────

function collectLeaves<T extends object>(defs: readonly ColDefOrGroup<T>[]): ColumnDef<T>[] {
  const out: ColumnDef<T>[] = [];
  for (const d of defs) {
    if (isColumnGroup(d)) out.push(...collectLeaves(d.children));
    else out.push(d);
  }
  return out;
}

function treeDepth<T extends object>(defs: readonly ColDefOrGroup<T>[]): number {
  let max = 1;
  for (const d of defs) {
    if (isColumnGroup(d)) max = Math.max(max, 1 + treeDepth(d.children));
  }
  return max;
}

/**
 * Builds header rows for multi-level headers. Group cells span their visible
 * leaves (colSpan); leaf cells under shallow branches span down (rowSpan).
 */
function buildHeaderRows<T extends object>(
  tree: readonly ColDefOrGroup<T>[],
  visibleLeaves: readonly ColumnDef<T>[],
): HeaderCell<T>[][] {
  const depth = treeDepth(tree);
  const rows: HeaderCell<T>[][] = Array.from({ length: depth }, () => []);
  const visibleIds = new Set(visibleLeaves.map((c) => colIdOf(c)));

  const visibleLeafCount = (def: ColDefOrGroup<T>): number => {
    if (isColumnGroup(def)) return def.children.reduce((acc, c) => acc + visibleLeafCount(c), 0);
    return visibleIds.has(colIdOf(def)) ? 1 : 0;
  };

  let leafCursor = 0;
  const walk = (defs: readonly ColDefOrGroup<T>[], level: number): void => {
    for (const def of defs) {
      const span = visibleLeafCount(def);
      if (span === 0) continue;
      if (isColumnGroup(def)) {
        rows[level].push({
          colId: def.groupId,
          label: def.headerName,
          colSpan: span,
          rowSpan: 1,
          leafStart: leafCursor,
          isGroup: true,
          leaf: null,
          pinned: null,
        });
        walk(def.children, level + 1);
      } else {
        rows[level].push({
          colId: colIdOf(def),
          label: def.headerName ?? defaultHeaderName(colIdOf(def)),
          colSpan: 1,
          rowSpan: depth - level,
          leafStart: leafCursor,
          isGroup: false,
          leaf: def,
          pinned: def.pinned ?? null,
        });
        leafCursor++;
      }
    }
  };
  walk(tree, 0);

  // Flat defs (no groups) collapse to a single header row.
  return rows.filter((r) => r.length > 0);
}
