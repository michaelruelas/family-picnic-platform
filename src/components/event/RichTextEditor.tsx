'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  id?: string;
}

const toolbarButtonBase =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-sm px-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/50 disabled:cursor-not-allowed disabled:opacity-50';
const toolbarButtonIdle = 'text-foreground/70 hover:bg-secondary hover:text-foreground';
const toolbarButtonActive = 'bg-terracotta/15 text-terracotta';

type ToolbarAction = {
  key: string;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
  label: string;
  title: string;
  disabled?: (editor: Editor) => boolean;
};

const ACTIONS: ToolbarAction[] = [
  {
    key: 'bold',
    label: 'B',
    title: 'Bold',
    isActive: (editor) => editor.isActive('bold'),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    key: 'italic',
    label: 'I',
    title: 'Italic',
    isActive: (editor) => editor.isActive('italic'),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    key: 'h2',
    label: 'H2',
    title: 'Heading',
    isActive: (editor) => editor.isActive('heading', { level: 2 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    key: 'h3',
    label: 'H3',
    title: 'Subheading',
    isActive: (editor) => editor.isActive('heading', { level: 3 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    key: 'bulletList',
    label: '•',
    title: 'Bulleted list',
    isActive: (editor) => editor.isActive('bulletList'),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    key: 'orderedList',
    label: '1.',
    title: 'Numbered list',
    isActive: (editor) => editor.isActive('orderedList'),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    key: 'blockquote',
    label: '"',
    title: 'Quote',
    isActive: (editor) => editor.isActive('blockquote'),
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    key: 'clear',
    label: 'Clear',
    title: 'Clear formatting',
    isActive: () => false,
    run: (editor) => editor.chain().focus().unsetAllMarks().clearNodes().run(),
    disabled: (editor) => editor.state.doc.textContent.length === 0,
  },
];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write something...',
  ariaLabel,
  className = '',
  id,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'rich-text-content text-foreground focus:outline-none min-h-[120px] px-4 py-3 text-base leading-relaxed',
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        ...(id ? { id } : {}),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className={`border-border bg-card min-h-[160px] rounded-sm border ${className}`.trim()}
        aria-busy="true"
      />
    );
  }

  return (
    <div
      className={`border-border bg-card focus-within:border-foreground rounded-sm border shadow-sm transition-colors focus-within:shadow-[0_0_0_3px_rgba(2,132,199,0.15)] ${className}`.trim()}
      data-testid="rich-text-editor"
    >
      <div
        role="toolbar"
        aria-label="Formatting"
        className="border-border/60 flex flex-wrap items-center gap-1 border-b px-2 py-1.5"
      >
        {ACTIONS.map((action) => {
          const active = action.isActive(editor);
          const disabled = action.disabled?.(editor) ?? false;
          return (
            <button
              key={action.key}
              type="button"
              onClick={() => action.run(editor)}
              disabled={disabled}
              title={action.title}
              aria-label={action.title}
              aria-pressed={active}
              className={`${toolbarButtonBase} ${active ? toolbarButtonActive : toolbarButtonIdle}`}
              data-active={active ? 'true' : 'false'}
            >
              {action.label}
            </button>
          );
        })}
      </div>
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
}
