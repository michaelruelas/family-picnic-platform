import * as ui from '../index';

describe('UI index exports', () => {
  it('exports Button', () => {
    expect(ui.Button).toBeDefined();
  });

  it('exports Input', () => {
    expect(ui.Input).toBeDefined();
  });

  it('exports Textarea', () => {
    expect(ui.Textarea).toBeDefined();
  });

  it('exports Select', () => {
    expect(ui.Select).toBeDefined();
  });

  it('exports Card', () => {
    expect(ui.Card).toBeDefined();
  });

  it('exports CardHeader', () => {
    expect(ui.CardHeader).toBeDefined();
  });

  it('exports CardTitle', () => {
    expect(ui.CardTitle).toBeDefined();
  });

  it('exports CardContent', () => {
    expect(ui.CardContent).toBeDefined();
  });

  it('exports CardFooter', () => {
    expect(ui.CardFooter).toBeDefined();
  });

  it('exports Modal', () => {
    expect(ui.Modal).toBeDefined();
  });

  it('exports Toast', () => {
    expect(ui.Toast).toBeDefined();
  });

  it('exports ToastProvider', () => {
    expect(ui.ToastProvider).toBeDefined();
  });

  it('exports useToast', () => {
    expect(ui.useToast).toBeDefined();
  });

  it('exports EmptyState', () => {
    expect(ui.EmptyState).toBeDefined();
  });

  it('exports Spinner', () => {
    expect(ui.Spinner).toBeDefined();
  });

  it('exports LoadingOverlay', () => {
    expect(ui.LoadingOverlay).toBeDefined();
  });
});
