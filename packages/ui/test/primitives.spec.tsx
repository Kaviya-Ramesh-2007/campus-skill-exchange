import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, EmptyState } from '../src';

describe('UI primitives', () => {
  it('renders an accessible button and disabled loading state', () => {
    render(<Button loading>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true');
  });

  it('renders an empty state without product data', () => {
    render(<EmptyState title="Nothing here yet" description="Foundation state" />);

    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
  });
});
