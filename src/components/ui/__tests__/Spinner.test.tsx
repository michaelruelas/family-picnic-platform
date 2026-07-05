import { render, screen } from '@testing-library/react';
import Spinner, { LoadingOverlay } from '../Spinner';

describe('Spinner', () => {
  it('renders with default size', () => {
    const { container } = render(<Spinner />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(spinner!.className).toContain('h-8 w-8');
  });

  it('renders with different sizes', () => {
    const { container: smContainer } = render(<Spinner size="sm" />);
    expect(smContainer.querySelector('.animate-spin')!.className).toContain('h-4 w-4');

    const { container: mdContainer } = render(<Spinner size="md" />);
    expect(mdContainer.querySelector('.animate-spin')!.className).toContain('h-8 w-8');

    const { container: lgContainer } = render(<Spinner size="lg" />);
    expect(lgContainer.querySelector('.animate-spin')!.className).toContain('h-12 w-12');
  });

  it('shows label when provided', () => {
    render(<Spinner label="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

describe('LoadingOverlay', () => {
  it('shows spinner when isLoading is true', () => {
    render(
      <LoadingOverlay isLoading>
        <div>Content</div>
      </LoadingOverlay>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('hides spinner when isLoading is false', () => {
    render(
      <LoadingOverlay isLoading={false}>
        <div>Content</div>
      </LoadingOverlay>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <LoadingOverlay isLoading={false}>
        <span>Child element</span>
      </LoadingOverlay>,
    );
    expect(screen.getByText('Child element')).toBeInTheDocument();
  });

  it('uses custom spinner when provided', () => {
    render(
      <LoadingOverlay isLoading spinner={<span>Custom Spinner</span>}>
        <div>Content</div>
      </LoadingOverlay>,
    );
    expect(screen.getByText('Custom Spinner')).toBeInTheDocument();
  });
});
