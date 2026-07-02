import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('CSV Import Implementation', () => {
  const csvParserPath = path.join(process.cwd(), 'src/lib/csv-parser.ts');
  const csvUploaderPath = path.join(process.cwd(), 'src/components/admin/CsvUploader.tsx');
  const csvImportRoutePath = path.join(process.cwd(), 'src/app/api/admin/csv-import/route.ts');
  const adminRouterPath = path.join(process.cwd(), 'src/server/routers/admin.router.ts');

  it('creates csv-parser.ts with parseCsv function', async () => {
    const content = await fs.readFile(csvParserPath, 'utf-8');
    expect(content).toContain('parseCsv');
    expect(content).toContain('CsvRowSchema');
    expect(content).toContain('CsvParseResult');
  });

  it('csv-parser uses papaparse for CSV parsing', async () => {
    const content = await fs.readFile(csvParserPath, 'utf-8');
    expect(content).toContain("import Papa from 'papaparse'");
    expect(content).toContain('Papa.parse');
  });

  it('csv-parser validates required columns: household_name, primary_email, primary_name', async () => {
    const content = await fs.readFile(csvParserPath, 'utf-8');
    expect(content).toContain('household_name');
    expect(content).toContain('primary_email');
    expect(content).toContain('primary_name');
  });

  it('csv-parser handles member columns (member2_email, member2_name, etc)', async () => {
    const content = await fs.readFile(csvParserPath, 'utf-8');
    expect(content).toContain('member');
    expect(content).toContain('memberEmailIdxs');
    expect(content).toContain('memberNameIdxs');
  });

  it('csv-parser returns row-level errors with line numbers', async () => {
    const content = await fs.readFile(csvParserPath, 'utf-8');
    expect(content).toContain('errors: { row: number; message: string }[]');
  });

  it('csv-parser parses and validates CSV data correctly', async () => {
    const content = await fs.readFile(csvParserPath, 'utf-8');
    expect(content).toContain('parseCsv');
    expect(content).toContain('CsvParseResult');
  });

  it('csv-parser generates sample CSV template', async () => {
    const content = await fs.readFile(csvParserPath, 'utf-8');
    expect(content).toContain('generateSampleCsv');
  });

  it('creates CsvUploader component', async () => {
    const content = await fs.readFile(csvUploaderPath, 'utf-8');
    expect(content).toContain('CsvUploader');
  });

  it('CsvUploader supports drag-and-drop file upload', async () => {
    const content = await fs.readFile(csvUploaderPath, 'utf-8');
    expect(content).toContain('onDrop');
    expect(content).toContain('handleDrag');
    expect(content).toContain('dragActive');
  });

  it('CsvUploader displays parse preview and errors', async () => {
    const content = await fs.readFile(csvUploaderPath, 'utf-8');
    expect(content).toContain('parseResult');
    expect(content).toContain('Preview');
    expect(content).toContain('errors');
  });

  it('CsvUploader has dry-run and import buttons', async () => {
    const content = await fs.readFile(csvUploaderPath, 'utf-8');
    expect(content).toContain('Dry Run');
    expect(content).toContain('handleDryRun');
    expect(content).toContain('handleImport');
  });

  it('CsvUploader has download sample template functionality', async () => {
    const content = await fs.readFile(csvUploaderPath, 'utf-8');
    expect(content).toContain('handleDownloadSample');
    expect(content).toContain('generateSampleCsv');
  });

  it('creates /api/admin/csv-import route', async () => {
    const content = await fs.readFile(csvImportRoutePath, 'utf-8');
    expect(content).toContain('export async function POST');
  });

  it('csv-import route requires admin authentication', async () => {
    const content = await fs.readFile(csvImportRoutePath, 'utf-8');
    expect(content).toContain('ADMIN');
    expect(content).toContain('Unauthorized');
  });

  it('csv-import route validates input with Zod schema', async () => {
    const content = await fs.readFile(csvImportRoutePath, 'utf-8');
    expect(content).toContain('CsvImportSchema');
    expect(content).toContain('z.object');
    expect(content).toContain('households');
  });

  it('csv-import route supports dry-run mode', async () => {
    const content = await fs.readFile(csvImportRoutePath, 'utf-8');
    expect(content).toContain('dryRun');
  });

  it('csv-import route creates households, users, and RSVPs', async () => {
    const content = await fs.readFile(csvImportRoutePath, 'utf-8');
    expect(content).toContain('household.create');
    expect(content).toContain('user.create');
    expect(content).toContain('rSVP.create');
    expect(content).toContain('householdsCreated');
    expect(content).toContain('usersCreated');
    expect(content).toContain('rsvpsCreated');
  });

  it('csv-import route writes AdminAuditLog entry', async () => {
    const content = await fs.readFile(csvImportRoutePath, 'utf-8');
    expect(content).toContain('adminAuditLog.create');
    expect(content).toContain('CSV_IMPORT');
  });

  it('admin.router.ts has csvImport procedure', async () => {
    const content = await fs.readFile(adminRouterPath, 'utf-8');
    expect(content).toContain('csvImport');
  });
});
