import { render, screen } from '@testing-library/react';
import Input from '../Input';

describe('Input', () => {
  it('renders input element', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows label when provided', () => {
    render(<Input label="Email" name="email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows error message when error prop is set', () => {
    render(<Input label="Email" name="email" error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByText('This field is required').className).toContain('text-red-600');
  });

  it('shows hint when hint prop is provided (and no error)', () => {
    render(<Input label="Email" name="email" hint="We will never share your email" />);
    expect(screen.getByText('We will never share your email')).toBeInTheDocument();
    expect(screen.getByText('We will never share your email').className).toContain(
      'text-stone-500',
    );
  });

  it('does not show hint when error is present', () => {
    render(<Input label="Email" name="email" hint="A hint" error="An error" />);
    expect(screen.queryByText('A hint')).not.toBeInTheDocument();
    expect(screen.getByText('An error')).toBeInTheDocument();
  });

  it('applies error styles when error is set', () => {
    render(<Input label="Email" name="email" error="Error" />);
    const input = screen.getByLabelText('Email');
    expect(input.className).toContain('border-red-300');
    expect(input.className).toContain('focus:border-red-500');
    expect(input.className).toContain('focus:ring-red-500');
  });

  it('applies custom className', () => {
    render(<Input className="my-custom" />);
    expect(screen.getByRole('textbox').className).toContain('my-custom');
  });

  it('links label with htmlFor to input id', () => {
    render(<Input label="Name" name="user_name" />);
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('id', 'user_name');
  });
});
