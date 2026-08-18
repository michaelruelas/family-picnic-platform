import DOMPurify from 'isomorphic-dompurify';

/**
 * Whitelist of tags produced by Tiptap's StarterKit. Anything outside
 * this set is stripped before rendering on the public event page.
 * Keep this in sync with the StarterKit configuration in
 * `RichTextEditor.tsx`.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'code',
  'pre',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'hr',
];

/**
 * Whitelist of attributes that survive sanitization. Only `href` is
 * needed for the link mark; Tiptap doesn't emit anything else.
 */
const ALLOWED_ATTR = ['href'];

/**
 * Render host-authored rich text safely. Inputs go through DOMPurify
 * with a tight tag/attribute whitelist so any future leak of scripts
 * or event handlers is removed before reaching the DOM.
 *
 * Accepts either raw HTML (post-Tiptap) or plain text (legacy data
 * stored before the editor shipped). Plain text is passed through
 * unchanged after a quick escape so existing descriptions still
 * display correctly.
 */
export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.length === 0) return '';

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);

  if (!looksLikeHtml) {
    return escapeHtml(trimmed).replace(/\n/g, '<br />');
  }

  return DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    KEEP_CONTENT: true,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
