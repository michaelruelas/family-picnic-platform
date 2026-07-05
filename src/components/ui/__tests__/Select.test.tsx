import { render, screen } from '@testing-library/react';
import Select from '../Select';

const options = [
  { value: 'opt1', label: 'Option 1' },
  { value: 'opt2', label: 'Option 2' },
  { value: 'opt3', label: 'Option 3', disabled: true },
];

describe('Select', () => {
  it('renders select element', () => {
    render(<Select options={options} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows label when provided', () => {
    render(<Select label="Category" name="category" options={options} />);
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
  });

  it('renders options', () => {
    render(<Select options={options} />);
    const select = screen.getByRole('combobox');
    expect(select.querySelectorAll('option')).toHaveLength(3);
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('shows placeholder when provided', () => {
    render(<Select options={options} placeholder="Choose an option" />);
    expect(screen.getByText('Choose an option')).toBeInTheDocument();
    const placeholderOption = screen.getByText('Choose an option') as HTMLOptionElement;
    expect(placeholderOption.disabled).toBe(true);
    expect(placeholderOption.value).toBe('');
  });

  it('shows error when error prop is set', () => {
    render(<Select options={options} error="Selection required" />);
    expect(screen.getByText('Selection required')).toBeInTheDocument();
    expect(screen.getByText('Selection required').className).toContain('text-destructive');
  });

  it('shows hint when hint is provided', () => {
    render(<Select options={options} hint="Pick one category" />);
    expect(screen.getByText('Pick one category')).toBeInTheDocument();
    expect(screen.getByText('Pick one category').className).toContain('text-muted-foreground');
  });

  it('hides hint when error is present', () => {
    render(<Select options={options} hint="A hint" error="An error" />);
    expect(screen.queryByText('A hint')).not.toBeInTheDocument();
    expect(screen.getByText('An error')).toBeInTheDocument();
  });

  it('links label htmlFor to select id', () => {
    render(<Select label="Category" name="category_id" options={options} />);
    const select = screen.getByLabelText('Category');
    expect(select).toHaveAttribute('id', 'category_id');
  });
});
