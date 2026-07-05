import { render, screen } from '@testing-library/react';
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Content</Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies padding classes', () => {
    const { rerender } = render(<Card padding="none">Test</Card>);
    expect(screen.getByText('Test').className).not.toContain('p-');

    rerender(<Card padding="sm">Test</Card>);
    expect(screen.getByText('Test').className).toContain('p-3');

    rerender(<Card padding="md">Test</Card>);
    expect(screen.getByText('Test').className).toContain('p-4');

    rerender(<Card padding="lg">Test</Card>);
    expect(screen.getByText('Test').className).toContain('p-6');
  });

  it('applies variant classes', () => {
    const { rerender } = render(<Card variant="success">Test</Card>);
    expect(screen.getByText('Test').className).toContain('bg-green-50');

    rerender(<Card variant="warning">Test</Card>);
    expect(screen.getByText('Test').className).toContain('bg-amber-50');

    rerender(<Card variant="error">Test</Card>);
    expect(screen.getByText('Test').className).toContain('bg-red-50');

    rerender(<Card variant="muted">Test</Card>);
    expect(screen.getByText('Test').className).toContain('bg-stone-100');

    rerender(<Card variant="default">Test</Card>);
    expect(screen.getByText('Test').className).toContain('bg-white');
  });

  it('CardHeader renders with correct structure', () => {
    render(
      <Card>
        <CardHeader>Header Content</CardHeader>
      </Card>,
    );
    const header = screen.getByText('Header Content');
    expect(header.className).toContain('flex items-center justify-between');
  });

  it('CardTitle renders heading', () => {
    render(<CardTitle>My Title</CardTitle>);
    const heading = screen.getByRole('heading', { name: /my title/i });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H3');
    expect(heading.className).toContain('text-lg font-semibold');
  });

  it('CardContent renders children', () => {
    render(<CardContent>Body text</CardContent>);
    const content = screen.getByText('Body text');
    expect(content.className).toContain('mt-4');
  });

  it('CardFooter renders with flex container', () => {
    render(
      <CardFooter>
        <button>Cancel</button>
        <button>Save</button>
      </CardFooter>,
    );
    const footer = screen.getByText('Cancel').parentElement!;
    expect(footer.className).toContain('flex items-center gap-3');
    expect(footer.className).toContain('mt-4');
  });

  it('CardHeader forwards ref', () => {
    const ref = { current: null } as unknown as React.RefObject<HTMLDivElement>;
    render(
      <Card ref={ref}>
        <CardHeader>Header</CardHeader>
      </Card>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
