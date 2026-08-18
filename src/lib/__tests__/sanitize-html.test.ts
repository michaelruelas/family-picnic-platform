import { describe, it, expect } from 'vitest';
import { sanitizeRichText } from '../sanitize-html';

describe('sanitizeRichText', () => {
  it('returns an empty string for nullish or blank input', () => {
    expect(sanitizeRichText(null)).toBe('');
    expect(sanitizeRichText(undefined)).toBe('');
    expect(sanitizeRichText('')).toBe('');
    expect(sanitizeRichText('   ')).toBe('');
  });

  it('escapes plain text and converts newlines to <br>', () => {
    const out = sanitizeRichText('Line one.\nLine two.');
    expect(out).toContain('Line one.');
    expect(out).toContain('<br');
    expect(out).not.toContain('<script');
  });

  it('preserves allowed Tiptap tags from rich text input', () => {
    const html = '<p>Hello <strong>world</strong></p><h2>Title</h2><ul><li>One</li></ul>';
    const out = sanitizeRichText(html);
    expect(out).toContain('<strong>world</strong>');
    expect(out).toContain('<h2>Title</h2>');
    expect(out).toContain('<li>One</li>');
  });

  it('preserves link href attributes', () => {
    const html = '<p>See <a href="https://example.com">example</a></p>';
    const out = sanitizeRichText(html);
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('>example</a>');
  });

  it('strips script tags', () => {
    const out = sanitizeRichText('<p>Safe</p><script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).toContain('Safe');
  });

  it('strips javascript: URLs', () => {
    const out = sanitizeRichText('<p><a href="javascript:alert(1)">click</a></p>');
    expect(out).not.toContain('javascript:');
    expect(out).not.toMatch(/href="javascript:/i);
  });

  it('strips event handler attributes', () => {
    const out = sanitizeRichText('<p onclick="alert(1)">click</p>');
    expect(out).not.toContain('onclick');
  });

  it('strips disallowed tags like <iframe>', () => {
    const out = sanitizeRichText('<iframe src="https://evil.example"></iframe><p>OK</p>');
    expect(out).not.toContain('<iframe');
    expect(out).toContain('OK');
  });
});
