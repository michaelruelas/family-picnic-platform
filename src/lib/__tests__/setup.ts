/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';

// cmdk uses ResizeObserver for its listbox. jsdom does not implement it,
// and the missing global makes any test that renders a Command crash on
// mount with `ReferenceError: ResizeObserver is not defined`. Stub it
// with a no-op class so cmdk can register its observer without erroring.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// cmdk also calls `element.scrollIntoView` when the user moves the
// active item with the keyboard. jsdom does not implement
// scrollIntoView on Element.prototype, so install a no-op so the
// layout effect inside cmdk does not throw.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {
    // no-op
  };
}

// Tiptap/ProseMirror measures caret and selection position via
// getClientRects and getBoundingClientRect. jsdom does not implement
// either on Range, so editor interactions throw `target.getClientRects
// is not a function`. Stub them with a single zero-rect so the
// editor's view code can run without erroring.
const zeroRect: DOMRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON() {
    return {};
  },
};

if (typeof Range !== 'undefined') {
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = function () {
      return zeroRect;
    };
  }
  if (!Range.prototype.getClientRects) {
    const rectList = [zeroRect] as unknown as DOMRectList;
    Object.defineProperty(rectList, 'item', {
      value(index: number) {
        return index === 0 ? zeroRect : null;
      },
    });
    Range.prototype.getClientRects = function () {
      return rectList;
    };
  }
}
