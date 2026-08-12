'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatItineraryTime } from '~/lib/itinerary-time';

// FPP-45 / QUB-31.2: admin-side itinerary item editor with
// drag-to-reorder. The host adds, edits, and deletes rows via
// inline forms; drags call onReorder with the new id sequence,
// which the parent persists through the API.
//
// The drag UX is implemented with native HTML5 drag and drop
// (no external library) so the bundle stays small. We track the
// currently-dragged id in a ref + a `draggingId` state hoist so
// siblings can flip visual state without re-rendering the whole
// list.

export interface ItineraryItem {
  id: string;
  time: string | null;
  title: string;
  description: string | null;
  order: number;
}

export interface ItineraryEditorProps {
  eventId: string;
  initialItems: ItineraryItem[];
}

interface FormState {
  time: string;
  title: string;
  description: string;
}

const EMPTY_FORM: FormState = { time: '', title: '', description: '' };

export default function ItineraryEditor({ eventId, initialItems }: ItineraryEditorProps) {
  const router = useRouter();
  const [items, setItems] = useState<ItineraryItem[]>(() =>
    [...initialItems].sort((a, b) => a.order - b.order),
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingReorder, setPendingReorder] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOverIdRef = useRef<string | null>(null);

  const handleAdd = async (form: FormState) => {
    setError(null);
    try {
      const response = await fetch('/api/admin/itinerary-items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId,
          time: form.time,
          title: form.title,
          description: form.description,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to add item');
        return;
      }
      setShowAddForm(false);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  const handleUpdate = async (id: string, form: FormState) => {
    setError(null);
    try {
      const response = await fetch(`/api/admin/itinerary-items/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          time: form.time,
          title: form.title,
          description: form.description,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to update item');
        return;
      }
      setEditingId(null);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/admin/itinerary-items/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to delete item');
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      setDeleteConfirm(null);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  const persistReorder = useCallback(
    async (nextOrder: ItineraryItem[]) => {
      // EH-002: snapshot the order we started from so we can restore
      // locally on failure BEFORE router.refresh() fires. Without
      // this, the server's authoritative order renders first and the
      // list flashes as the rollback settles.
      const previousOrder = items;
      setError(null);
      setPendingReorder(true);
      try {
        const response = await fetch('/api/admin/itinerary-items/reorder', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            eventId,
            itemIds: nextOrder.map((item) => item.id),
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || 'Failed to save new order');
          // Restore the snapshot locally so the UI is correct on
          // the next paint, then refresh in the background to
          // converge with the server's authoritative state.
          setItems(previousOrder);
          router.refresh();
          return;
        }
        // The mutation is durable; rely on the next refresh to
        // pull the canonical order, but flip the local view so the
        // UI matches what was persisted.
        router.refresh();
      } catch {
        setError('Something went wrong. Please try again.');
        setItems(previousOrder);
        router.refresh();
      } finally {
        setPendingReorder(false);
      }
    },
    [eventId, items, router],
  );

  const reorderAround = useCallback(
    (draggedId: string, targetId: string) => {
      // EH-003: ignore nested drag/drop while a reorder is in
      // flight. The up/down buttons already gate on `pendingReorder`,
      // but the drag handlers bypass that check and would otherwise
      // mutate state on top of stale `items` closure.
      if (pendingReorder) return;
      if (draggedId === targetId) return;
      const fromIdx = items.findIndex((item) => item.id === draggedId);
      const toIdx = items.findIndex((item) => item.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return;
      const next = [...items];
      const [moved] = next.splice(fromIdx, 1);
      if (!moved) return;
      next.splice(toIdx, 0, moved);
      const withOrder = next.map((item, idx) => ({ ...item, order: idx }));
      setItems(withOrder);
      void persistReorder(withOrder);
    },
    [items, pendingReorder, persistReorder],
  );

  const onDragStart = (id: string) => (e: React.DragEvent<HTMLLIElement>) => {
    if (pendingReorder) {
      e.preventDefault();
      return;
    }
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const onDragOver = (id: string) => (e: React.DragEvent<HTMLLIElement>) => {
    if (pendingReorder) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverIdRef.current = id;
  };

  const onDrop = (id: string) => (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    if (pendingReorder) return;
    const draggedId = draggingId ?? e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    dragOverIdRef.current = null;
    if (draggedId) {
      reorderAround(draggedId, id);
    }
  };

  const onDragEnd = () => {
    setDraggingId(null);
    dragOverIdRef.current = null;
  };

  const handleMoveUp = (id: string) => {
    const idx = items.findIndex((item) => item.id === id);
    if (idx <= 0) return;
    const next = [...items];
    const [moved] = next.splice(idx, 1);
    if (!moved) return;
    next.splice(idx - 1, 0, moved);
    const withOrder = next.map((item, i) => ({ ...item, order: i }));
    setItems(withOrder);
    void persistReorder(withOrder);
  };

  const handleMoveDown = (id: string) => {
    const idx = items.findIndex((item) => item.id === id);
    if (idx < 0 || idx >= items.length - 1) return;
    const next = [...items];
    const [moved] = next.splice(idx, 1);
    if (!moved) return;
    next.splice(idx + 1, 0, moved);
    const withOrder = next.map((item, i) => ({ ...item, order: i }));
    setItems(withOrder);
    void persistReorder(withOrder);
  };

  if (items.length === 0 && !showAddForm) {
    return (
      <div className="bg-sunlight/20 rounded-xl p-8 text-center">
        <div className="text-5xl">📋</div>
        <h3 className="text-foreground mt-4 text-xl font-semibold">No Itinerary Items Yet</h3>
        <p className="text-terracotta mt-2">
          Add the day&apos;s schedule so guests know what to expect.
        </p>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-terracotta hover:bg-terracotta mt-4 rounded-lg px-6 py-2 font-medium text-white"
        >
          Add First Item
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{error}</div>
      )}

      {showAddForm && (
        <ItineraryItemForm mode="add" onSubmit={handleAdd} onCancel={() => setShowAddForm(false)} />
      )}

      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="border-border bg-secondary/60 text-muted-foreground hover:bg-sunlight/20 hover:text-terracotta flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm font-medium hover:border-amber-400"
          data-testid="itinerary-add-button"
        >
          <span className="text-lg">+</span> Add Itinerary Item
        </button>
      )}

      <ol className="space-y-3" data-testid="itinerary-editor-list">
        {items.map((item, idx) => (
          <li
            key={item.id}
            draggable
            onDragStart={onDragStart(item.id)}
            onDragOver={onDragOver(item.id)}
            onDrop={onDrop(item.id)}
            onDragEnd={onDragEnd}
            data-testid="itinerary-editor-item"
            data-itinerary-id={item.id}
            className={`border-border bg-card rounded-lg border p-4 transition-shadow ${
              draggingId === item.id ? 'opacity-50 shadow-md' : ''
            } ${pendingReorder ? 'opacity-90' : ''}`}
          >
            {editingId === item.id ? (
              <ItineraryItemForm
                mode="edit"
                initial={{
                  time: item.time ?? '',
                  title: item.title,
                  description: item.description ?? '',
                }}
                onSubmit={(form) => handleUpdate(item.id, form)}
                onCancel={() => setEditingId(null)}
              />
            ) : deleteConfirm === item.id ? (
              <div className="space-y-2">
                <p className="text-foreground/85 text-sm">
                  Delete <strong>{item.title}</strong>?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="bg-destructive hover:bg-destructive flex-1 rounded-lg px-3 py-1 text-sm font-medium text-white"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="bg-secondary text-foreground/85 hover:bg-secondary flex-1 rounded-lg px-3 py-1 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="text-muted-foreground hover:text-foreground cursor-grab pt-1 text-sm select-none active:cursor-grabbing">
                  <span aria-hidden="true">⋮⋮</span>
                  <span className="sr-only">Drag to reorder</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.time ? (
                      <span className="bg-sage/20 text-foreground rounded-pill px-2.5 py-1 text-xs font-semibold tracking-wide">
                        {formatItineraryTime(item.time)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                        No time
                      </span>
                    )}
                    <span className="text-muted-foreground text-xs">#{idx + 1}</span>
                  </div>
                  <p className="text-foreground mt-1 font-semibold">{item.title}</p>
                  {item.description && (
                    <p className="text-muted-foreground mt-1 text-sm">{item.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(item.id)}
                      disabled={idx === 0 || pendingReorder}
                      aria-label="Move up"
                      className="text-muted-foreground hover:bg-secondary hover:text-foreground rounded px-2 py-1 text-xs disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(item.id)}
                      disabled={idx >= items.length - 1 || pendingReorder}
                      aria-label="Move down"
                      className="text-muted-foreground hover:bg-secondary hover:text-foreground rounded px-2 py-1 text-xs disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingId(item.id)}
                      className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded px-3 py-1 text-xs font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(item.id)}
                      className="bg-destructive/15 text-destructive hover:bg-destructive/20 rounded px-3 py-1 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

interface ItineraryItemFormProps {
  mode: 'add' | 'edit';
  initial?: FormState;
  onSubmit: (form: FormState) => void | Promise<void>;
  onCancel: () => void;
}

function ItineraryItemForm({ mode, initial, onSubmit, onCancel }: ItineraryItemFormProps) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card space-y-3 rounded-xl p-4 shadow-sm"
      data-testid={mode === 'add' ? 'itinerary-add-form' : 'itinerary-edit-form'}
    >
      <h3 className="text-foreground text-lg font-semibold">
        {mode === 'add' ? 'Add Itinerary Item' : 'Edit Itinerary Item'}
      </h3>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="item-time" className="text-foreground/85 block text-sm font-medium">
            Time <span className="text-muted-foreground text-xs font-normal">(optional)</span>
          </label>
          <input
            type="time"
            id="item-time"
            name="time"
            value={form.time}
            onChange={handleChange}
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="item-title" className="text-foreground/85 block text-sm font-medium">
            Title *
          </label>
          <input
            type="text"
            id="item-title"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            maxLength={200}
            className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
            placeholder="Setup & Early Arrival"
          />
        </div>
      </div>

      <div>
        <label htmlFor="item-description" className="text-foreground/85 block text-sm font-medium">
          Description <span className="text-muted-foreground text-xs font-normal">(optional)</span>
        </label>
        <textarea
          id="item-description"
          name="description"
          value={form.description}
          onChange={handleChange}
          maxLength={2000}
          rows={3}
          className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
          placeholder="Unloading coolers and firing up the grill."
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="bg-terracotta hover:bg-terracotta flex-1 rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Saving...' : mode === 'add' ? 'Add Item' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-secondary text-foreground/85 hover:bg-secondary flex-1 rounded-lg px-4 py-2 font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
