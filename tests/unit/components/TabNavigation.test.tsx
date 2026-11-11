import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabNavigation } from '@/popup/components/TabNavigation';

describe('TabNavigation', () => {
  it('renders the libraries and plans tabs and reports a change', () => {
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="libraries" onTabChange={onTabChange} />);

    expect(
      screen.getByRole('button', { name: 'Workout Libraries' })
    ).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Plans Library' }));
    expect(onTabChange).toHaveBeenCalledWith('plans');
  });

  it('offers no destination-specific tabs', () => {
    render(<TabNavigation activeTab="libraries" onTabChange={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('does not report a click on the already active tab', () => {
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="plans" onTabChange={onTabChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Plans Library' }));
    expect(onTabChange).not.toHaveBeenCalled();
  });
});
