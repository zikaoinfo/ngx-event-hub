/**
 * Component tests via Angular Testing Library (zoneless).
 */
import { render, screen } from '@testing-library/angular';
import { ZenGridComponent } from './zen-grid.component';
import { ColDefOrGroup } from '../../types/column-def.types';

interface Item {
  id: number;
  name: string;
  price: number;
}

const COLUMNS: ColDefOrGroup<Item>[] = [
  { field: 'name', filter: 'text' },
  { field: 'price', filter: 'number' },
];

const ROWS: Item[] = [
  { id: 1, name: 'Alpha', price: 10 },
  { id: 2, name: 'Beta', price: 20 },
];

async function renderGrid(): Promise<ReturnType<typeof render<ZenGridComponent<Item>>>> {
  return render(ZenGridComponent<Item>, {
    inputs: {
      columnDefs: COLUMNS,
      rowData: ROWS,
      options: { getRowId: (r: Item) => r.id, ariaLabel: 'Items' },
    },
  });
}

describe('ZenGridComponent', () => {
  it('renders with the grid ARIA role and label', async () => {
    await renderGrid();
    expect(screen.getByRole('grid', { name: 'Items' })).toBeTruthy();
  });

  it('renders column headers', async () => {
    await renderGrid();
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Price')).toBeTruthy();
  });

  it('exposes a typed GridApi on the component instance', async () => {
    const { fixture } = await renderGrid();
    expect(fixture.componentInstance.api.getDisplayedRows()).toHaveLength(2);
  });

  // jsdom has no layout, so rendered row assertions need a mocked viewport
  // size (ResizeObserver). These are exercised in browser/e2e runs instead.
  it.todo('renders virtualized rows for the visible window');
  it.todo('recycles DOM row elements while scrolling (stable poolKey)');
  it.todo('navigates cells with arrow keys and announces sort changes');
  it.todo('starts and commits inline edits via Enter / F2 / double-click');
  it.todo('flashes cells on transaction updates');
});
