import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import type { PulseCard } from '@/types';
import { STORAGE_KEY } from '@/types';

function addCardViaForm(title: string, status = 'green', note = '') {
  const addPanel = screen.getByTestId('add-card-panel');
  fireEvent.change(within(addPanel).getByLabelText('Title'), { target: { value: title } });
  fireEvent.change(within(addPanel).getByLabelText('Status'), { target: { value: status } });
  fireEvent.change(within(addPanel).getByLabelText('Note'), { target: { value: note } });
  fireEvent.click(within(addPanel).getByTestId('add-card-submit'));
}

function getStoredCards(): PulseCard[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as PulseCard[]) : [];
}

describe('App smoke', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders identity strip and add form', () => {
    render(<App />);
    expect(screen.getByText('Pulse Board')).toBeTruthy();
    expect(screen.getByTestId('add-card-submit')).toBeTruthy();
  });

  it('adds a card when form is submitted', () => {
    render(<App />);
    const addPanel = screen.getByTestId('add-card-panel');

    fireEvent.change(within(addPanel).getByLabelText('Title'), { target: { value: 'Deploy' } });
    fireEvent.change(within(addPanel).getByLabelText('Status'), { target: { value: 'green' } });
    fireEvent.change(within(addPanel).getByLabelText('Note'), { target: { value: 'Pipeline green' } });
    fireEvent.click(within(addPanel).getByTestId('add-card-submit'));

    expect(screen.getByText('Deploy')).toBeTruthy();
    expect(screen.getByText('Pipeline green')).toBeTruthy();
    expect(within(screen.getByTestId('status-card')).getByText('OK')).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Deploy');
  });

  it('clears all cards after confirm', () => {
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<App />);
    const addPanel = screen.getByTestId('add-card-panel');
    fireEvent.change(within(addPanel).getByLabelText('Title'), { target: { value: 'Temp' } });
    fireEvent.click(within(addPanel).getByTestId('add-card-submit'));
    expect(screen.getByText('Temp')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.queryByText('Temp')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    vi.unstubAllGlobals();
  });

  it('edits a card and refreshes title, status, note, and updatedAt (D5)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T10:00:00.000Z'));

    render(<App />);
    addCardViaForm('Deploy', 'green', 'Pipeline green');

    const beforeEdit = getStoredCards()[0];
    expect(beforeEdit.title).toBe('Deploy');
    expect(beforeEdit.status).toBe('green');
    expect(beforeEdit.note).toBe('Pipeline green');
    expect(beforeEdit.updatedAt).toBe('2026-09-07T10:00:00.000Z');

    vi.setSystemTime(new Date('2026-09-07T11:30:00.000Z'));

    const card = screen.getByTestId('status-card');
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Deploy v2' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'red' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Rollback required' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Deploy v2')).toBeTruthy();
    expect(screen.getByText('Rollback required')).toBeTruthy();
    expect(within(screen.getByTestId('status-card')).getByText('FAIL')).toBeTruthy();

    const afterEdit = getStoredCards()[0];
    expect(afterEdit.id).toBe(beforeEdit.id);
    expect(afterEdit.title).toBe('Deploy v2');
    expect(afterEdit.status).toBe('red');
    expect(afterEdit.note).toBe('Rollback required');
    expect(afterEdit.updatedAt).toBe('2026-09-07T11:30:00.000Z');
    expect(afterEdit.updatedAt).not.toBe(beforeEdit.updatedAt);
  });

  it('removes a single card and leaves siblings intact (D6)', () => {
    render(<App />);
    addCardViaForm('Keep me', 'green', 'Stay');
    addCardViaForm('Remove me', 'amber', 'Gone');

    expect(screen.getAllByTestId('status-card')).toHaveLength(2);

    const toRemove = screen
      .getAllByTestId('status-card')
      .find((card) => within(card).queryByText('Remove me'));
    expect(toRemove).toBeTruthy();
    fireEvent.click(within(toRemove!).getByRole('button', { name: 'Remove' }));

    expect(screen.queryByText('Remove me')).toBeNull();
    expect(screen.getByText('Keep me')).toBeTruthy();
    expect(screen.getByText('Stay')).toBeTruthy();
    expect(screen.getAllByTestId('status-card')).toHaveLength(1);

    const stored = getStoredCards();
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('Keep me');
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('Remove me');
  });
});
