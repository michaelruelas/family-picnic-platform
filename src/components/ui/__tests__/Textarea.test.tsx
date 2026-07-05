import { render, screen } from '@testing-library/react';
import Textarea from '../Textarea';

describe('Textarea', () => {
  it('renders textarea element', () => {
    render(<Textarea />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows label when provided', () => {
    render(<Textarea label="Description" name="description" />);
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('shows error message when error is set', () => {
    render(<Textarea label="Bio" name="bio" error="Bio is too long" />);
    expect(screen.getByText('Bio is too long')).toBeInTheDocument();
    expect(screen.getByText('Bio is too long').className).toContain('text-destructive');
  });

  it('shows hint when hint is provided', () => {
    render(<Textarea label="Bio" name="bio" hint="Tell us about yourself" />);
    expect(screen.getByText('Tell us about yourself')).toBeInTheDocument();
    expect(screen.getByText('Tell us about yourself').className).toContain('text-muted-foreground');
  });

  it('hides hint when error is present', () => {
    render(<Textarea label="Bio" name="bio" hint="A hint" error="An error" />);
    expect(screen.queryByText('A hint')).not.toBeInTheDocument();
    expect(screen.getByText('An error')).toBeInTheDocument();
  });

  it('applies error styles', () => {
    render(<Textarea label="Bio" name="bio" error="Error text" />);
    const textarea = screen.getByLabelText('Bio');
    expect(textarea.className).toContain('border-destructive');
  });

  it('links label htmlFor to textarea id', () => {
    render(<Textarea label="Message" name="message_body" />);
    const textarea = screen.getByLabelText('Message');
    expect(textarea).toHaveAttribute('id', 'message_body');
  });

  it('applies custom className', () => {
    render(<Textarea className="my-custom" />);
    expect(screen.getByRole('textbox').className).toContain('my-custom');
  });
});
