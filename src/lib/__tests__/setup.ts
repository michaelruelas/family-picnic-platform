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
