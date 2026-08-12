import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

const SKIP_BG_WHITE = ['src/components/PhotoReactionButton.tsx', 'src/app/events/[id]/page.tsx'];

/**
 * FPP-44: regression tests that prevent panel/card surfaces from
 * rendering with hard-coded colors in dark mode.
 *
 * Panels must use the theme tokens (`bg-card`, `ring-border`,
 * `divide-border`, etc.) so the dark variant applies. Hard-coded
 * Tailwind color utilities (`bg-white`, `bg-stone-*`, `ring-stone-*`,
 * `divide-stone-*`) bypass the dark theme and leave the panel
 * brighter than the surrounding dark surface — exactly the bug
 * FPP-44 reports.
 *
 * A small allow-list keeps intentional overlays (translucent
 * `bg-white/N` on top of `bg-black/50` photo chips, hero status
 * badge) from being flagged.
 */
describe('Dark mode panel surfaces (FPP-44)', () => {
  const srcDir = path.join(process.cwd(), 'src');

  it('panel-style components do not use hard-coded bg-white', async () => {
    const offenders = await findOffenders(/\bbg-white\b/, (line) => /\bbg-white\/\d+\b/.test(line));
    assertNoOffenders(
      offenders,
      'hard-coded bg-white in panel surfaces',
      'Use bg-card (or another theme token) so dark mode works.',
    );
  });

  it('panel-style components do not use a hard-coded stone ring border', async () => {
    const offenders = await findOffenders(/\bring-stone-\d+\b/, () => false);
    assertNoOffenders(
      offenders,
      'hard-coded stone-color ring borders',
      'Use ring-border so the border adapts to dark mode.',
    );
  });

  it('panel-style components do not use a hard-coded stone divide color', async () => {
    const offenders = await findOffenders(/\bdivide-stone-\d+\b/, () => false);
    assertNoOffenders(
      offenders,
      'hard-coded stone-color divide utilities',
      'Use divide-border so table/list dividers adapt to dark mode.',
    );
  });

  it('panel-style components do not use a hard-coded stone background', async () => {
    const offenders = await findOffenders(/\bbg-stone-\d+\b/, () => false);
    assertNoOffenders(
      offenders,
      'hard-coded stone-color backgrounds',
      'Use bg-muted, bg-secondary, or another theme token so the background adapts to dark mode.',
    );
  });

  it('disabled buttons do not use a hard-coded stone-color background', async () => {
    const offenders = await findOffenders(/\bdisabled:bg-stone-\d+\b/, () => false);
    assertNoOffenders(
      offenders,
      'hard-coded disabled:bg-stone-* utilities',
      'Use disabled:opacity-50 (or another theme token) so the disabled state adapts to dark mode.',
    );
  });

  it('globals.css defines dark mode border tokens', async () => {
    const css = await fs.readFile(path.join(srcDir, 'app', 'globals.css'), 'utf-8');
    expect(css).toMatch(/\.dark\s*\{[^}]*--border:/s);
    expect(css).toMatch(/\.dark\s*\{[^}]*--card:/s);
    expect(css).toMatch(/\.dark\s*\{[^}]*--background:/s);
  });

  it('globals.css darkens shadows for dark mode', async () => {
    const css = await fs.readFile(path.join(srcDir, 'app', 'globals.css'), 'utf-8');
    expect(css).toMatch(/\.dark\s+\.shadow-card/);
    expect(css).toMatch(/\.dark\s+\.shadow-soft/);
    expect(css).toMatch(/\.dark\s+\.shadow-pop/);
  });

  it('dark shadow inset highlight opacity follows card >= soft >= pop', async () => {
    const css = await fs.readFile(path.join(srcDir, 'app', 'globals.css'), 'utf-8');
    const soft = extractInsetOpacity(css, '.shadow-soft');
    const card = extractInsetOpacity(css, '.shadow-card');
    const pop = extractInsetOpacity(css, '.shadow-pop');
    expect(card).not.toBeNull();
    expect(soft).not.toBeNull();
    expect(pop).not.toBeNull();
    expect(card!).toBeGreaterThanOrEqual(soft!);
    expect(soft!).toBeGreaterThanOrEqual(pop!);
  });
});

async function findOffenders(
  pattern: RegExp,
  skipLine: (line: string) => boolean,
): Promise<{ file: string; line: number; snippet: string }[]> {
  const offenders: { file: string; line: number; snippet: string }[] = [];
  const files = await walk(path.join(process.cwd(), 'src'));
  for (const file of files) {
    if (!/\.(tsx|ts)$/.test(file)) continue;
    if (SKIP_BG_WHITE.some((skip) => file.endsWith(skip.replace(/^src\//, '')))) continue;
    const content = await fs.readFile(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (skipLine(line)) return;
      if (!pattern.test(line)) return;
      offenders.push({
        file: path.relative(process.cwd(), file),
        line: index + 1,
        snippet: line.trim(),
      });
    });
  }
  return offenders;
}

function assertNoOffenders(
  offenders: { file: string; line: number; snippet: string }[],
  description: string,
  fix: string,
): void {
  if (offenders.length === 0) {
    expect(offenders).toHaveLength(0);
    return;
  }
  const message = offenders.map((o) => `  ${o.file}:${o.line}\n    ${o.snippet}`).join('\n');
  throw new Error(`Found ${offenders.length} ${description}. ${fix}\n${message}`);
}

function extractInsetOpacity(css: string, shadowClass: string): number | null {
  const re = new RegExp(
    `\\.dark ${shadowClass.replace(/\./g, '\\.')}[^{]*\\{[^}]*inset 0 1px 0 rgba\\(\\d+, \\d+, \\d+, ([\\d.]+)\\)`,
    's',
  );
  const match = re.exec(css);
  return match ? Number.parseFloat(match[1]!) : null;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...(await walk(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}
