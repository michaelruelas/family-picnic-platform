import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Accessibility - Events Page', () => {
  const componentsDir = path.join(process.cwd(), 'src/components');

  describe('Toast aria-live (SPEC §1 / Ticket 38)', () => {
    const toastPath = path.join(componentsDir, 'ui', 'Toast.tsx');

    it('Toast component has aria-live="polite" for non-intrusive announcements', async () => {
      const content = await fs.readFile(toastPath, 'utf-8');
      expect(content).toMatch(/aria-live=["']polite["']/);
    });

    it('Toast has role="alert" for important notifications', async () => {
      const content = await fs.readFile(toastPath, 'utf-8');
      expect(content).toMatch(/role=["']alert["']/);
    });

    it('Toast has aria-atomic for screen reader announcements', async () => {
      const content = await fs.readFile(toastPath, 'utf-8');
      expect(content).toMatch(/aria-atomic=["']true["']/);
    });
  });

  describe('Input component accessibility (Ticket 38)', () => {
    const inputPath = path.join(componentsDir, 'ui', 'Input.tsx');

    it('Input has proper label association with htmlFor', async () => {
      const content = await fs.readFile(inputPath, 'utf-8');
      expect(content).toContain('htmlFor=');
      expect(content).toContain('id=');
    });

    it('Input has focus ring styles for keyboard navigation', async () => {
      const content = await fs.readFile(inputPath, 'utf-8');
      expect(content).toContain('focus:outline-none');
      expect(content).toContain('focus:ring-');
    });

    it('Input supports error prop and displays error messages', async () => {
      const content = await fs.readFile(inputPath, 'utf-8');
      expect(content).toContain('error?:');
      expect(content).toContain('error &&');
    });
  });

  describe('Button component accessibility (SPEC §1 multi-generational)', () => {
    const buttonPath = path.join(componentsDir, 'ui', 'Button.tsx');

    it('Button has visible focus styles for keyboard navigation', async () => {
      const content = await fs.readFile(buttonPath, 'utf-8');
      const hasFocusStyles = content.includes('focus:outline-none') || content.includes('focus-visible:');
      expect(hasFocusStyles).toBeTruthy();
    });

    it('Button supports disabled state with proper cursor', async () => {
      const content = await fs.readFile(buttonPath, 'utf-8');
      expect(content).toContain('disabled:');
      expect(content).toContain('cursor-not-allowed');
    });

    it('Button has touch-friendly sizing (min-h-12 for lg)', async () => {
      const content = await fs.readFile(buttonPath, 'utf-8');
      expect(content).toContain('min-h-12');
    });
  });

  describe('Contrast ratios (WCAG 4.5:1 requirement - Ticket 38)', () => {
    it('amber-800 on white background meets 4.5:1 contrast ratio', () => {
      const amber800 = '#b45309';
      const white = '#ffffff';
      const contrast = getContrastRatio(amber800, white);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });

    it('green-700 on white background meets 4.5:1 contrast ratio', () => {
      const green700 = '#15803d';
      const white = '#ffffff';
      const contrast = getContrastRatio(green700, white);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });

    it('red-700 on white background meets 4.5:1 contrast ratio', () => {
      const red700 = '#b91c1c';
      const white = '#ffffff';
      const contrast = getContrastRatio(red700, white);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });
  });
});

function getContrastRatio(color1: string, color2: string): number {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}
