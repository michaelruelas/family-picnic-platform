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
    expect(screen.getByText('Test').className).toContain('p-5');

    rerender(<Card padding="lg">Test</Card>);
    expect(screen.getByText('Test').className).toContain('p-7');

    rerender(<Card padding="xl">Test</Card>);
    expect(screen.getByText('Test').className).toContain('p-9');
  });

  it('applies variant classes', () => {
    const { rerender } = render(<Card variant="success">Test</Card>);
    expect(screen.getByText('Test').className).toContain('bg-sage/10');

    rerender(<Card variant="warning">Test</Card>);
    expect(screen.getByText('Test').className).toContain('bg-sunlight/20');

    rerender(<Card variant="error">Test</Card>);
    expect(screen.getByText('Test').className).toContain('bg-destructive/10');

    rerender(<Card variant="muted">Test</Card>);
    expect(screen.getByText('Test').className).toContain('bg-secondary');

    rerender(<Card variant="default">Test</Card>);
    expect(screen.getByText('Test').className).toContain('bg-card');
  });

  it('uses rounded-2xl by default', () => {
    render(<Card>Test</Card>);
    expect(screen.getByText('Test').className).toContain('rounded-2xl');
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

  it('CardTitle renders heading with display font', () => {
    render(<CardTitle>My Title</CardTitle>);
    const heading = screen.getByRole('heading', { name: /my title/i });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H3');
    expect(heading.className).toContain('font-display');
    expect(heading.className).toContain('font-semibold');
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

  it('supports hover lift', () => {
    render(<Card hover>Test</Card>);
    expect(screen.getByText('Test').className).toContain('hover-lift');
  });
});
