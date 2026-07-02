import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('Accessibility - Profile Page', () => {
  const componentsDir = path.join(process.cwd(), 'src/components');

  describe('Modal accessibility (Ticket 38)', () => {
    const modalPath = path.join(componentsDir, 'ui', 'Modal.tsx');

    it('Modal has proper ARIA dialog role', async () => {
      const content = await fs.readFile(modalPath, 'utf-8');
      expect(content).toMatch(/role=["']dialog["']/);
    });

    it('Modal has aria-modal attribute', async () => {
      const content = await fs.readFile(modalPath, 'utf-8');
      expect(content).toMatch(/aria-modal=["']true["']/);
    });

    it('Modal has focus management with ref', async () => {
      const content = await fs.readFile(modalPath, 'utf-8');
      const hasFocusManagement = content.includes('ref') || content.includes('focus');
      expect(hasFocusManagement).toBeTruthy();
    });

    it('Modal can be closed with escape key', async () => {
      const content = await fs.readFile(modalPath, 'utf-8');
      const hasEscapeHandling = content.includes('keydown') || content.includes('Escape') || content.includes('onKeyDown');
      expect(hasEscapeHandling).toBeTruthy();
    });
  });

  describe('Select component accessibility (Ticket 38)', () => {
    const selectPath = path.join(componentsDir, 'ui', 'Select.tsx');

    it('Select has label prop', async () => {
      const content = await fs.readFile(selectPath, 'utf-8');
      expect(content).toContain('label');
    });

    it('Select has htmlFor for label association', async () => {
      const content = await fs.readFile(selectPath, 'utf-8');
      expect(content).toContain('htmlFor');
    });

    it('Select has focus styles', async () => {
      const content = await fs.readFile(selectPath, 'utf-8');
      const hasFocusStyles = content.includes('focus:outline-none') || content.includes('focus:ring');
      expect(hasFocusStyles).toBeTruthy();
    });
  });

  describe('Textarea component accessibility (Ticket 38)', () => {
    const textareaPath = path.join(componentsDir, 'ui', 'Textarea.tsx');

    it('Textarea has label prop', async () => {
      const content = await fs.readFile(textareaPath, 'utf-8');
      expect(content).toContain('label');
    });

    it('Textarea has htmlFor for label association', async () => {
      const content = await fs.readFile(textareaPath, 'utf-8');
      expect(content).toContain('htmlFor');
    });

    it('Textarea has resize styling', async () => {
      const content = await fs.readFile(textareaPath, 'utf-8');
      expect(content).toContain('resize');
    });
  });

  describe('Color contrast verification (WCAG 4.5:1 - Ticket 38)', () => {
    it('green-700 text on white background meets 4.5:1', () => {
      const green700 = '#15803d';
      const white = '#ffffff';
      const contrast = getContrastRatio(green700, white);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });

    it('red-700 text on white background meets 4.5:1', () => {
      const red700 = '#b91c1c';
      const white = '#ffffff';
      const contrast = getContrastRatio(red700, white);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });

    it('stone-700 text on white background meets 4.5:1', () => {
      const stone700 = '#44403c';
      const white = '#ffffff';
      const contrast = getContrastRatio(stone700, white);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });

    it('amber-800 text on white background meets 4.5:1', () => {
      const amber800 = '#b45309';
      const white = '#ffffff';
      const contrast = getContrastRatio(amber800, white);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('UI Primitives accessibility baseline (Ticket 38)', () => {
    it('Button has touch-friendly sizing (SPEC §1 multi-generational)', async () => {
      const buttonPath = path.join(componentsDir, 'ui', 'Button.tsx');
      const content = await fs.readFile(buttonPath, 'utf-8');
      expect(content).toContain('min-h-12');
    });

    it('Input uses text-lg for readability (SPEC §1 multi-generational)', async () => {
      const inputPath = path.join(componentsDir, 'ui', 'Input.tsx');
      const content = await fs.readFile(inputPath, 'utf-8');
      expect(content).toContain('text-lg');
    });

    it('Card components have proper structure', async () => {
      const cardPath = path.join(componentsDir, 'ui', 'Card.tsx');
      const content = await fs.readFile(cardPath, 'utf-8');
      const hasCardExport = content.includes('export');
      expect(hasCardExport).toBeTruthy();
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
