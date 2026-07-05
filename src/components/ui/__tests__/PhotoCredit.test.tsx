import { render, screen } from '@testing-library/react';
import { PhotoCredit } from '../PhotoCredit';

describe('PhotoCredit', () => {
  it('renders photographer name and platform', () => {
    render(<PhotoCredit photographer="Alasdair Elmes" platform="Unsplash" />);
    expect(screen.getByText(/Alasdair Elmes/)).toBeInTheDocument();
    expect(screen.getByText(/Unsplash/)).toBeInTheDocument();
  });

  it('links the photographer to their profile URL', () => {
    render(
      <PhotoCredit
        photographer="Alasdair Elmes"
        photographerUrl="https://unsplash.com/@alasdair_elmes"
      />,
    );
    const link = screen.getByRole('link', { name: /Alasdair Elmes/ });
    expect(link).toHaveAttribute('href', 'https://unsplash.com/@alasdair_elmes');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('links the platform to a license URL when provided', () => {
    render(
      <PhotoCredit
        photographer="Photographer"
        platform="Unsplash"
        licenseUrl="https://unsplash.com/license"
      />,
    );
    const link = screen.getByRole('link', { name: /Unsplash/ });
    expect(link).toHaveAttribute('href', 'https://unsplash.com/license');
  });

  it('opens links in a new tab securely', () => {
    render(
      <PhotoCredit
        photographer="Alasdair Elmes"
        photographerUrl="https://example.com"
        platform="Unsplash"
        licenseUrl="https://example.com/license"
      />,
    );
    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toMatch(/noopener/);
    });
  });

  it('sets a descriptive aria-label by default', () => {
    render(<PhotoCredit photographer="Jane Doe" platform="Pexels" />);
    const el = screen.getByLabelText('Photo by Jane Doe on Pexels');
    expect(el).toBeInTheDocument();
  });

  it('allows custom aria-label override', () => {
    render(<PhotoCredit photographer="Jane Doe" platform="Pexels" ariaLabel="Custom credit" />);
    expect(screen.getByLabelText('Custom credit')).toBeInTheDocument();
  });
});
