import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseCsv, generateSampleCsv, CsvRowSchema } from '../csv-parser';

describe('parseCsv', () => {
  const validCsv = `household_name,primary_email,primary_name
"The Garcia Family",maria.garcia@example.com,Maria Garcia`;

  const csvWithMembers = `household_name,primary_email,primary_name,member2_email,member2_name
"The Garcia Family",maria.garcia@example.com,Maria Garcia,carlos.garcia@example.com,Carlos Garcia`;

  it('parses valid CSV with required columns', () => {
    const result = parseCsv(validCsv);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.totalRows).toBe(1);
    expect(result.households).toHaveLength(1);
    expect(result.households[0]!.name).toBe('The Garcia Family');
    expect(result.households[0]!.members).toHaveLength(1);
    expect(result.households[0]!.members[0]!.email).toBe('maria.garcia@example.com');
    expect(result.households[0]!.members[0]!.name).toBe('Maria Garcia');
  });

  it('parses CSV with member columns', () => {
    const result = parseCsv(csvWithMembers);
    expect(result.success).toBe(true);
    expect(result.households).toHaveLength(1);
    expect(result.households[0]!.members).toHaveLength(2);
    expect(result.households[0]!.members[1]!.email).toBe('carlos.garcia@example.com');
    expect(result.households[0]!.members[1]!.name).toBe('Carlos Garcia');
  });

  it('returns error for fewer than 2 rows', () => {
    const result = parseCsv('household_name,primary_email,primary_name');
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain(
      'CSV must have at least a header row and one data row',
    );
  });

  it('returns error for missing required columns', () => {
    const result = parseCsv('name,email\n"Test",test@example.com');
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain(
      'CSV must have household_name, primary_email, and primary_name columns',
    );
  });

  it('returns error for invalid email', () => {
    const result = parseCsv(
      'household_name,primary_email,primary_name\n"Test",not-an-email,Test User',
    );
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('Valid primary email is required');
  });

  it('returns error for missing household name', () => {
    const result = parseCsv(
      'household_name,primary_email,primary_name\n,test@example.com,Test User',
    );
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('Household name is required');
  });

  it('returns error for duplicate emails in the same row', () => {
    const csv = `household_name,primary_email,primary_name,member2_email,member2_name
"Test",test@example.com,Test User,test@example.com,Duplicate`;
    const result = parseCsv(csv);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('Duplicate email');
  });

  it('handles Papa Parse errors', () => {
    const result = parseCsv('"unclosed quote');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns success=true when there are no errors', () => {
    const result = parseCsv(validCsv);
    expect(result.success).toBe(true);
  });

  it('returns success=false when there are errors', () => {
    const result = parseCsv('household_name,primary_email,primary_name\n,not-an-email,');
    expect(result.success).toBe(false);
  });
});

describe('generateSampleCsv', () => {
  it('returns a string containing expected column headers', () => {
    const csv = generateSampleCsv();
    expect(csv).toContain('household_name');
    expect(csv).toContain('primary_email');
    expect(csv).toContain('primary_name');
    expect(csv).toContain('member2_email');
    expect(csv).toContain('member2_name');
  });

  it('returns a string containing sample data', () => {
    const csv = generateSampleCsv();
    expect(csv).toContain('The Johnson Family');
    expect(csv).toContain('sarah.johnson@example.com');
    expect(csv).toContain('Sarah Johnson');
    expect(csv).toContain('The Garcia Family');
    expect(csv).toContain('maria.garcia@example.com');
  });

  it('has at least two data rows', () => {
    const csv = generateSampleCsv();
    const lines = csv.trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });
});

describe('CsvRowSchema', () => {
  it('validates correct data', () => {
    const result = CsvRowSchema.safeParse({
      household_name: 'The Garcia Family',
      primary_email: 'maria.garcia@example.com',
      primary_name: 'Maria Garcia',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing household_name', () => {
    const result = CsvRowSchema.safeParse({
      primary_email: 'test@example.com',
      primary_name: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing primary_email', () => {
    const result = CsvRowSchema.safeParse({
      household_name: 'Test',
      primary_name: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing primary_name', () => {
    const result = CsvRowSchema.safeParse({
      household_name: 'Test',
      primary_email: 'test@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = CsvRowSchema.safeParse({
      household_name: 'Test',
      primary_email: 'not-an-email',
      primary_name: 'Test',
    });
    expect(result.success).toBe(false);
  });
});
