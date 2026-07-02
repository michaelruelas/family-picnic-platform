import Papa from 'papaparse';
import { z } from 'zod';

export const CsvRowSchema = z.object({
  household_name: z.string().min(1, 'Household name is required'),
  primary_email: z.string().email('Invalid primary email'),
  primary_name: z.string().min(1, 'Primary name is required'),
});

export type CsvRow = z.infer<typeof CsvRowSchema>;

export interface ParsedHousehold {
  name: string;
  members: {
    email: string;
    name: string;
    headcount: number;
  }[];
}

export interface CsvParseResult {
  success: boolean;
  households: ParsedHousehold[];
  errors: { row: number; message: string }[];
  totalRows: number;
}

export function parseCsv(csvText: string): CsvParseResult {
  const result: CsvParseResult = {
    success: false,
    households: [],
    errors: [],
    totalRows: 0,
  };

  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    result.errors = parsed.errors.map((err) => ({
      row: err.row ?? 0,
      message: err.message,
    }));
    return result;
  }

  const rows = parsed.data;
  if (rows.length < 2) {
    result.errors.push({ row: 0, message: 'CSV must have at least a header row and one data row' });
    return result;
  }

  const header = rows[0]!;
  const householdNameIdx = header.findIndex((h) => h.toLowerCase().trim() === 'household_name');
  const primaryEmailIdx = header.findIndex((h) => h.toLowerCase().trim() === 'primary_email');
  const primaryNameIdx = header.findIndex((h) => h.toLowerCase().trim() === 'primary_name');

  if (householdNameIdx === -1 || primaryEmailIdx === -1 || primaryNameIdx === -1) {
    result.errors.push({
      row: 0,
      message: 'CSV must have household_name, primary_email, and primary_name columns',
    });
    return result;
  }

  const memberEmailIdxs: number[] = [];
  const memberNameIdxs: number[] = [];
  for (let i = 0; i < header.length; i++) {
    const h = header[i]!.toLowerCase().trim();
    if (h.startsWith('member') && h.endsWith('_email')) {
      memberEmailIdxs.push(i);
    } else if (h.startsWith('member') && h.endsWith('_name')) {
      memberNameIdxs.push(i);
    }
  }

  result.totalRows = rows.length - 1;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 1;

    try {
      const rowData: Record<string, string> = {};
      for (let j = 0; j < row.length; j++) {
        const headerCell = header[j];
        const rowCell = row[j];
        if (headerCell && rowCell !== undefined) {
          rowData[headerCell.toLowerCase().trim()] = rowCell.trim();
        }
      }

      const householdName = rowData['household_name'];
      const primaryEmail = rowData['primary_email'];
      const primaryName = rowData['primary_name'];

      if (!householdName) {
        result.errors.push({ row: rowNum, message: `Row ${rowNum}: Household name is required` });
        continue;
      }

      if (!primaryEmail || !isValidEmail(primaryEmail)) {
        result.errors.push({
          row: rowNum,
          message: `Row ${rowNum}: Valid primary email is required`,
        });
        continue;
      }

      if (!primaryName) {
        result.errors.push({ row: rowNum, message: `Row ${rowNum}: Primary name is required` });
        continue;
      }

      const members: ParsedHousehold['members'] = [
        {
          email: primaryEmail,
          name: primaryName,
          headcount: 1,
        },
      ];

      const matchedEmails = new Set<string>([primaryEmail.toLowerCase()]);

      for (const emailIdx of memberEmailIdxs) {
        const nameIdx = memberNameIdxs[memberEmailIdxs.indexOf(emailIdx)];
        const email = row[emailIdx]?.trim();
        const name = nameIdx !== undefined ? row[nameIdx]?.trim() : '';

        if (email) {
          const lowerEmail = email.toLowerCase();
          if (matchedEmails.has(lowerEmail)) {
            result.errors.push({
              row: rowNum,
              message: `Row ${rowNum}: Duplicate email ${email} in row`,
            });
            continue;
          }
          matchedEmails.add(lowerEmail);

          if (!isValidEmail(email)) {
            result.errors.push({
              row: rowNum,
              message: `Row ${rowNum}: Invalid member email ${email}`,
            });
            continue;
          }

          if (!name) {
            result.errors.push({
              row: rowNum,
              message: `Row ${rowNum}: Member name required for email ${email}`,
            });
            continue;
          }

          members.push({ email, name, headcount: 1 });
        }
      }

      result.households.push({
        name: householdName,
        members,
      });
    } catch {
      result.errors.push({ row: rowNum, message: `Row ${rowNum}: Failed to parse row` });
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

function isValidEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}

export function generateSampleCsv(): string {
  return `household_name,primary_email,primary_name,member2_email,member2_name
"The Johnson Family",sarah.johnson@example.com,Sarah Johnson,mike.johnson@example.com,Mike Johnson
"The Garcia Family",maria.garcia@example.com,Maria Garcia,pedro.garcia@example.com,Pedro Garcia`;
}
