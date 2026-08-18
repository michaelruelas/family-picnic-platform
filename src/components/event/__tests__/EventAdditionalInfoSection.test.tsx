import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventAdditionalInfoSection } from '../EventAdditionalInfoSection';

describe('EventAdditionalInfoSection (FPP-136 / FPP-137)', () => {
  it('renders quiet placeholder when body is empty and no attachments', () => {
    render(<EventAdditionalInfoSection body="" attachments={[]} />);
    expect(screen.getByText('Nothing extra to share yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('event-downloads-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('additional-info-body')).not.toBeInTheDocument();
  });

  it('renders sanitized rich-text body when body is provided', () => {
    render(
      <EventAdditionalInfoSection
        body='<p><strong>Bring extra sunscreen</strong> and check out <a href="https://park.example.com">Park Guide</a></p>'
        attachments={[]}
      />,
    );
    expect(screen.queryByText('Nothing extra to share yet.')).not.toBeInTheDocument();
    expect(screen.getByTestId('additional-info-body')).toBeInTheDocument();
    expect(screen.getByText('Bring extra sunscreen')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Park Guide' });
    expect(link).toHaveAttribute('href', 'https://park.example.com');
  });

  it('renders embedded downloads when attachments are provided without body', () => {
    render(
      <EventAdditionalInfoSection
        body={null}
        attachments={[{ id: 'att-1', filename: 'Park_Map.pdf', sizeBytes: 2048 }]}
      />,
    );
    expect(screen.queryByText('Nothing extra to share yet.')).not.toBeInTheDocument();
    expect(screen.getByTestId('event-downloads-section')).toBeInTheDocument();
    expect(screen.getByText('Park_Map.pdf')).toBeInTheDocument();
  });

  it('renders both body and downloads when both are provided', () => {
    render(
      <EventAdditionalInfoSection
        body="<p>Here is some important information.</p>"
        attachments={[{ id: 'att-1', filename: 'Schedule.pdf', sizeBytes: 1024 }]}
      />,
    );
    expect(screen.getByTestId('additional-info-body')).toBeInTheDocument();
    expect(screen.getByText('Here is some important information.')).toBeInTheDocument();
    expect(screen.getByTestId('event-downloads-section')).toBeInTheDocument();
    expect(screen.getByText('Schedule.pdf')).toBeInTheDocument();
  });
});
