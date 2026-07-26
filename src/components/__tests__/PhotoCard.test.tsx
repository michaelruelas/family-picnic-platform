import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

vi.mock('~/hooks', () => ({
  usePhotoReactionMutation: () => ({
    addReaction: { mutateAsync: vi.fn() },
    removeReaction: { mutateAsync: vi.fn() },
  }),
}));

vi.mock('./PhotoReactionButton', () => ({
  default: () => <div data-testid="reaction-button" />,
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as never;

const { default: PhotoCard } = await import('../PhotoCard');

const basePhoto = {
  id: 'p-1',
  caption: 'Test caption',
  url: 'https://example.com/photo.jpg',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  createdAt: new Date('2025-01-01'),
  uploadedByUserId: 'u-1',
  reactions: [],
};

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true } as never);
});

describe('PhotoCard', () => {
  it('renders the photo with caption as alt text', () => {
    render(<PhotoCard photo={basePhoto} eventName="Picnic" />);
    expect(screen.getByAltText('Test caption')).toBeInTheDocument();
  });

  it('uses event name as alt text when no caption', () => {
    render(<PhotoCard photo={{ ...basePhoto, caption: null }} eventName="Picnic" />);
    expect(screen.getByAltText('Picnic photo')).toBeInTheDocument();
  });

  it('uses thumbnailUrl when provided', () => {
    render(<PhotoCard photo={basePhoto} eventName="Picnic" />);
    const img = screen.getByAltText('Test caption') as HTMLImageElement;
    expect(img.src).toContain('thumb.jpg');
  });

  it('falls back to url when thumbnailUrl is null', () => {
    render(<PhotoCard photo={{ ...basePhoto, thumbnailUrl: null }} eventName="Picnic" />);
    const img = screen.getByAltText('Test caption') as HTMLImageElement;
    expect(img.src).toContain('photo.jpg');
  });

  it('does not show delete button for non-owner non-admin', () => {
    render(<PhotoCard photo={basePhoto} eventName="Picnic" userId="u-2" userRole="ADMIN_ADULT" />);
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('shows delete button for uploader', async () => {
    const { container } = render(<PhotoCard photo={basePhoto} eventName="Picnic" userId="u-1" />);
    const menuTrigger = container.querySelector('button svg')!.parentElement!;
    fireEvent.click(menuTrigger);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('shows delete button for admin', async () => {
    const { container } = render(<PhotoCard photo={basePhoto} eventName="Picnic" userId="u-2" userRole="ADMIN" />);
    const menuTrigger = container.querySelector('button svg')!.parentElement!;
    fireEvent.click(menuTrigger);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('shows delete confirmation dialog', async () => {
    const { container } = render(<PhotoCard photo={basePhoto} eventName="Picnic" userId="u-1" />);
    const menuTrigger = container.querySelector('button svg')!.parentElement!;
    fireEvent.click(menuTrigger);
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByText(/Delete this photo\?/)).toBeInTheDocument();
  });

  it('calls delete API and refreshes router on confirm', async () => {
    const { container } = render(<PhotoCard photo={basePhoto} eventName="Picnic" userId="u-1" />);
    const menuTrigger = container.querySelector('button svg')!.parentElement!;
    fireEvent.click(menuTrigger);
    fireEvent.click(screen.getByText('Delete'));
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/photo-delete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ photoId: 'p-1' }),
        }),
      );
    });
  });

  it('hides dialog on cancel', async () => {
    const { container } = render(<PhotoCard photo={basePhoto} eventName="Picnic" userId="u-1" />);
    const menuTrigger = container.querySelector('button svg')!.parentElement!;
    fireEvent.click(menuTrigger);
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText(/Delete this photo\?/)).not.toBeInTheDocument();
  });
});
