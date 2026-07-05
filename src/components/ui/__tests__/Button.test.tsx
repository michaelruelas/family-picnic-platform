import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import Button from '../Button';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('applies default variant class (primary)', () => {
    render(<Button>Test</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-terracotta');
  });

  it.each(['secondary', 'danger', 'ghost', 'outline', 'sage'] as const)(
    'applies %s variant class',
    (variant) => {
      render(<Button variant={variant}>Test</Button>);
      const button = screen.getByRole('button');
      const variantMap: Record<string, string> = {
        secondary: 'bg-secondary',
        danger: 'bg-destructive',
        ghost: 'bg-transparent',
        outline: 'border-border',
        sage: 'bg-sage',
      };
      expect(button.className).toContain(variantMap[variant]);
    },
  );

  it.each(['sm', 'md', 'lg', 'xl'] as const)('applies %s size class', (size) => {
    render(<Button size={size}>Test</Button>);
    const button = screen.getByRole('button');
    const sizeMap: Record<string, string> = {
      sm: 'px-4 py-2',
      md: 'px-5 py-2.5',
      lg: 'px-6 py-3',
      xl: 'px-8 py-3.5',
    };
    expect(button.className).toContain(sizeMap[size]);
  });

  it('shows spinner when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>);
    const button = screen.getByRole('button');
    const spinner = button.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('disables button when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('merges custom className', () => {
    render(<Button className="my-custom-class">Test</Button>);
    expect(screen.getByRole('button').className).toContain('my-custom-class');
  });

  it('onClick handler works', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('defaults to pill shape', () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole('button').className).toContain('rounded-pill');
  });

  it('supports non-pill shape', () => {
    render(<Button pill={false}>Test</Button>);
    expect(screen.getByRole('button').className).toContain('rounded-xl');
    expect(screen.getByRole('button').className).not.toContain('rounded-pill');
  });
});
