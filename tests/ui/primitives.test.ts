import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('UI Primitives Library', () => {
  const uiDir = path.join(process.cwd(), 'src/components/ui');

  describe('Button', () => {
    const buttonPath = path.join(uiDir, 'Button.tsx');

    it('exists and exports a Button component', async () => {
      const content = await fs.readFile(buttonPath, 'utf-8');
      expect(content).toContain('const Button = forwardRef');
      expect(content).toContain('export default Button');
    });

    it('supports primary, secondary, danger, and ghost variants', async () => {
      const content = await fs.readFile(buttonPath, 'utf-8');
      expect(content).toContain('variant?: ButtonVariant');
      expect(content).toContain("'primary'");
      expect(content).toContain("'secondary'");
      expect(content).toContain("'danger'");
      expect(content).toContain("'ghost'");
    });

    it('has lg and xl sizes for touch accessibility', async () => {
      const content = await fs.readFile(buttonPath, 'utf-8');
      expect(content).toContain("'lg'");
      expect(content).toContain("'xl'");
      expect(content).toContain('min-h-12');
      expect(content).toContain('min-h-14');
    });

    it('supports loading state with spinner', async () => {
      const content = await fs.readFile(buttonPath, 'utf-8');
      expect(content).toContain('isLoading?: boolean');
      expect(content).toContain('animate-spin');
    });
  });

  describe('Input', () => {
    const inputPath = path.join(uiDir, 'Input.tsx');

    it('exists and exports an Input component', async () => {
      const content = await fs.readFile(inputPath, 'utf-8');
      expect(content).toContain('const Input = forwardRef');
      expect(content).toContain('export default Input');
    });

    it('supports label, error, and hint props', async () => {
      const content = await fs.readFile(inputPath, 'utf-8');
      expect(content).toContain('label?: string');
      expect(content).toContain('error?: string');
      expect(content).toContain('hint?: string');
    });

    it('uses large text (text-lg) for accessibility', async () => {
      const content = await fs.readFile(inputPath, 'utf-8');
      expect(content).toContain('text-lg');
    });

    it('has proper focus ring for accessibility', async () => {
      const content = await fs.readFile(inputPath, 'utf-8');
      expect(content).toContain('focus:ring-');
    });
  });

  describe('Textarea', () => {
    const textareaPath = path.join(uiDir, 'Textarea.tsx');

    it('exists and exports a Textarea component', async () => {
      const content = await fs.readFile(textareaPath, 'utf-8');
      expect(content).toContain('const Textarea = forwardRef');
      expect(content).toContain('export default Textarea');
    });

    it('supports label, error, and hint props', async () => {
      const content = await fs.readFile(textareaPath, 'utf-8');
      expect(content).toContain('label?: string');
      expect(content).toContain('error?: string');
      expect(content).toContain('hint?: string');
    });

    it('is resizable and has minimum height', async () => {
      const content = await fs.readFile(textareaPath, 'utf-8');
      expect(content).toContain('resize-y');
      expect(content).toContain('min-h-[80px]');
    });
  });

  describe('Select', () => {
    const selectPath = path.join(uiDir, 'Select.tsx');

    it('exists and exports a Select component', async () => {
      const content = await fs.readFile(selectPath, 'utf-8');
      expect(content).toContain('const Select = forwardRef');
      expect(content).toContain('export default Select');
    });

    it('accepts options array prop', async () => {
      const content = await fs.readFile(selectPath, 'utf-8');
      expect(content).toContain('options: SelectOption[]');
    });

    it('supports placeholder option', async () => {
      const content = await fs.readFile(selectPath, 'utf-8');
      expect(content).toContain('placeholder?: string');
    });
  });

  describe('Card', () => {
    const cardPath = path.join(uiDir, 'Card.tsx');

    it('exists and exports a Card component', async () => {
      const content = await fs.readFile(cardPath, 'utf-8');
      expect(content).toContain('const Card = forwardRef');
      expect(content).toContain('export default Card');
    });

    it('supports default, success, warning, error, and muted variants', async () => {
      const content = await fs.readFile(cardPath, 'utf-8');
      expect(content).toContain("'default'");
      expect(content).toContain("'success'");
      expect(content).toContain("'warning'");
      expect(content).toContain("'error'");
      expect(content).toContain("'muted'");
    });

    it('exports CardHeader, CardTitle, CardContent, and CardFooter sub-components', async () => {
      const content = await fs.readFile(cardPath, 'utf-8');
      expect(content).toContain('export { CardHeader');
      expect(content).toContain('CardTitle');
      expect(content).toContain('CardContent');
      expect(content).toContain('CardFooter');
    });
  });

  describe('Modal', () => {
    const modalPath = path.join(uiDir, 'Modal.tsx');

    it('exists and exports a Modal component', async () => {
      const content = await fs.readFile(modalPath, 'utf-8');
      expect(content).toContain('export default function Modal');
    });

    it('supports escape key to close', async () => {
      const content = await fs.readFile(modalPath, 'utf-8');
      expect(content).toContain("e.key === 'Escape'");
      expect(content).toContain('onClose()');
    });

    it('has focus management for accessibility', async () => {
      const content = await fs.readFile(modalPath, 'utf-8');
      expect(content).toContain('firstFocusable?.focus()');
      expect(content).toContain('querySelectorAll');
    });

    it('uses React portal for rendering', async () => {
      const content = await fs.readFile(modalPath, 'utf-8');
      expect(content).toContain('createPortal');
    });

    it('restores focus when closing', async () => {
      const content = await fs.readFile(modalPath, 'utf-8');
      expect(content).toContain('previousActiveElement');
    });
  });

  describe('Toast', () => {
    const toastPath = path.join(uiDir, 'Toast.tsx');

    it('exists and exports Toast components', async () => {
      const content = await fs.readFile(toastPath, 'utf-8');
      expect(content).toContain('export function Toast');
      expect(content).toContain('export function ToastProvider');
    });

    it('supports success, error, warning, and info types', async () => {
      const content = await fs.readFile(toastPath, 'utf-8');
      expect(content).toContain("'success'");
      expect(content).toContain("'error'");
      expect(content).toContain("'warning'");
      expect(content).toContain("'info'");
    });

    it('has auto-dismiss duration support', async () => {
      const content = await fs.readFile(toastPath, 'utf-8');
      expect(content).toContain('duration?: number');
      expect(content).toContain('setTimeout');
    });

    it('provides useToast hook', async () => {
      const content = await fs.readFile(toastPath, 'utf-8');
      expect(content).toContain('export function useToast');
    });
  });

  describe('EmptyState', () => {
    const emptyStatePath = path.join(uiDir, 'EmptyState.tsx');

    it('exists and exports an EmptyState component', async () => {
      const content = await fs.readFile(emptyStatePath, 'utf-8');
      expect(content).toContain('export default function EmptyState');
    });

    it('requires title prop', async () => {
      const content = await fs.readFile(emptyStatePath, 'utf-8');
      expect(content).toContain('title: string');
    });

    it('supports optional description and action props', async () => {
      const content = await fs.readFile(emptyStatePath, 'utf-8');
      expect(content).toContain('description?: string');
      expect(content).toContain('action?:');
    });

    it('provides icon variants', async () => {
      const content = await fs.readFile(emptyStatePath, 'utf-8');
      expect(content).toContain('icon?:');
    });
  });

  describe('Spinner', () => {
    const spinnerPath = path.join(uiDir, 'Spinner.tsx');

    it('exists and exports a Spinner component', async () => {
      const content = await fs.readFile(spinnerPath, 'utf-8');
      expect(content).toContain('export default function Spinner');
    });

    it('supports sm, md, lg sizes', async () => {
      const content = await fs.readFile(spinnerPath, 'utf-8');
      expect(content).toContain("'sm'");
      expect(content).toContain("'md'");
      expect(content).toContain("'lg'");
    });

    it('exports LoadingOverlay component', async () => {
      const content = await fs.readFile(spinnerPath, 'utf-8');
      expect(content).toContain('export function LoadingOverlay');
    });
  });

  describe('index', () => {
    const indexPath = path.join(uiDir, 'index.ts');

    it('exports all UI primitives', async () => {
      const content = await fs.readFile(indexPath, 'utf-8');
      expect(content).toContain('export { default as Button }');
      expect(content).toContain('export { default as Input }');
      expect(content).toContain('export { default as Textarea }');
      expect(content).toContain('export { default as Select }');
      expect(content).toContain('Card, CardHeader, CardTitle, CardContent, CardFooter');
      expect(content).toContain('export { default as Modal }');
      expect(content).toContain('export { Toast, ToastProvider, useToast }');
      expect(content).toContain('export { default as EmptyState }');
      expect(content).toContain('export { default as Spinner');
    });
  });
});
