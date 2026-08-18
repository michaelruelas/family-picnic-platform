import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import RichTextEditor from '../RichTextEditor';

describe('RichTextEditor', () => {
  it('renders a toolbar and a contenteditable surface', async () => {
    render(<RichTextEditor value="" onChange={() => {}} ariaLabel="Test editor" />);
    expect(screen.getByRole('toolbar', { name: /formatting/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Test editor')).toBeInTheDocument();
    });
  });

  it('renders bold, italic, heading, and list toolbar buttons', async () => {
    render(<RichTextEditor value="" onChange={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^heading$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bulleted list/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /numbered list/i })).toBeInTheDocument();
  });

  it('hydrates the editor with the initial value', async () => {
    const html = '<p>Hello <strong>bold</strong> world</p>';
    render(<RichTextEditor value={html} onChange={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('bold')).toBeInTheDocument();
    });
  });

  it('passes ariaLabel to the contenteditable surface', async () => {
    render(<RichTextEditor value="" onChange={() => {}} ariaLabel="Custom label" />);
    await waitFor(() => {
      expect(screen.getByLabelText('Custom label')).toBeInTheDocument();
    });
  });
});
