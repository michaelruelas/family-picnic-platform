import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventDownloadsSection } from '../EventDownloadsSection';

describe('EventDownloadsSection', () => {
  it('renders nothing when no attachments', () => {
    const { container } = render(<EventDownloadsSection attachments={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one link per attachment', () => {
    render(
      <EventDownloadsSection
        attachments={[
          { id: 'a-1', filename: 'directions.pdf', sizeBytes: 1024 },
          { id: 'a-2', filename: 'waiver.pdf', sizeBytes: 5_242_880 },
        ]}
      />,
    );
    const items = screen.getAllByTestId('event-downloads-item');
    expect(items).toHaveLength(2);
    const links = screen.getAllByRole('link');
    expect(links[0]?.getAttribute('href')).toBe('/api/public/event-attachments/a-1/download');
    expect(links[1]?.getAttribute('href')).toBe('/api/public/event-attachments/a-2/download');
    expect(screen.getByText('directions.pdf')).toBeInTheDocument();
    expect(screen.getByText('waiver.pdf')).toBeInTheDocument();
    expect(screen.getByText(/1\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/5\.0 MB/)).toBeInTheDocument();
  });

  it('hints the suggested filename via the download attribute', () => {
    render(
      <EventDownloadsSection
        attachments={[{ id: 'a-1', filename: 'Directions.pdf', sizeBytes: 1024 }]}
      />,
    );
    const link = screen.getByRole('link');
    expect(link.getAttribute('download')).toBe('Directions.pdf');
  });
});
