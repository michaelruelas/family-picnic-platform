import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from '../Tabs';

function buildTabs() {
  return [
    { key: 'one', label: 'Tab One', panel: <div>Panel One</div> },
    { key: 'two', label: 'Tab Two', panel: <div>Panel Two</div> },
    { key: 'three', label: 'Tab Three', panel: <div>Panel Three</div> },
  ];
}

function ControlledTabs({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (key: string) => void;
}) {
  return <Tabs tabs={buildTabs()} value={value} onValueChange={onValueChange} ariaLabel="Test" />;
}

describe('Tabs (FPP-46)', () => {
  it('renders a tablist with one button per tab', () => {
    render(<ControlledTabs value="one" onValueChange={() => {}} />);
    expect(screen.getByRole('tablist', { name: 'Test' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('marks the active tab via aria-selected and data-active', () => {
    render(<ControlledTabs value="two" onValueChange={() => {}} />);
    const activeTab = screen.getByRole('tab', { name: 'Tab Two' });
    expect(activeTab).toHaveAttribute('aria-selected', 'true');
    expect(activeTab).toHaveAttribute('data-active', 'true');
    const inactiveTab = screen.getByRole('tab', { name: 'Tab One' });
    expect(inactiveTab).toHaveAttribute('aria-selected', 'false');
    expect(inactiveTab).toHaveAttribute('data-active', 'false');
  });

  it('wires aria-controls to a panel with matching aria-labelledby', () => {
    render(<ControlledTabs value="one" onValueChange={() => {}} />);
    const tab = screen.getByRole('tab', { name: 'Tab One' });
    const controlsId = tab.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    const panel = document.getElementById(controlsId!);
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute('aria-labelledby')).toBe(tab.id);
  });

  it('shows the active panel and hides the rest via the hidden attribute', () => {
    render(<ControlledTabs value="two" onValueChange={() => {}} />);
    const onePanel = document.getElementById('event-tab-panel-one');
    const twoPanel = document.getElementById('event-tab-panel-two');
    expect(twoPanel).not.toHaveAttribute('hidden');
    expect(onePanel).toHaveAttribute('hidden');
    expect(screen.getByText('Panel Two')).toBeVisible();
  });

  it('calls onValueChange with the clicked tab key', () => {
    const onChange = vi.fn();
    render(<ControlledTabs value="one" onValueChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tab Two' }));
    expect(onChange).toHaveBeenCalledWith('two');
  });

  it('does not call onValueChange when the already-active tab is clicked', () => {
    const onChange = vi.fn();
    render(<ControlledTabs value="one" onValueChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tab One' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves focus + activates next tab on ArrowRight', () => {
    const onChange = vi.fn();
    render(<ControlledTabs value="one" onValueChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Tab One' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('two');
  });

  it('wraps focus back to the first tab on ArrowLeft from the start', () => {
    const onChange = vi.fn();
    render(<ControlledTabs value="one" onValueChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Tab One' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('three');
  });

  it('jumps to the last tab on End', () => {
    const onChange = vi.fn();
    render(<ControlledTabs value="one" onValueChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Tab One' }), { key: 'End' });
    expect(onChange).toHaveBeenCalledWith('three');
  });

  it('jumps to the first tab on Home', () => {
    const onChange = vi.fn();
    render(<ControlledTabs value="three" onValueChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Tab Three' }), { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith('one');
  });

  it('ignores unrelated keys', () => {
    const onChange = vi.fn();
    render(<ControlledTabs value="one" onValueChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Tab One' }), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sets tabIndex=0 on the active tab and -1 on the rest (roving tabindex)', () => {
    render(<ControlledTabs value="two" onValueChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Tab Two' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Tab One' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Tab Three' })).toHaveAttribute('tabindex', '-1');
  });
});
