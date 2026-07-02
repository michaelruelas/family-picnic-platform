'use client';

import { useState, useRef } from 'react';
import { parseCsv, generateSampleCsv, CsvParseResult } from '~/lib/csv-parser';

interface CsvUploaderProps {
  eventId: string;
  onImportComplete?: (result: {
    householdsCreated: number;
    usersCreated: number;
    rsvpsCreated: number;
  }) => void;
}

export default function CsvUploader({ eventId, onImportComplete }: CsvUploaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setFile(file);
    setParseResult(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseCsv(text);
      setParseResult(result);
    };
    reader.readAsText(file);
  };

  const handleDryRun = () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseCsv(text);
      setParseResult(result);
    };
    reader.readAsText(file);
  };

  const handleImport = async (dryRun: boolean = false) => {
    if (!parseResult || parseResult.errors.length > 0) return;

    setImporting(true);
    setImportResult(null);

    try {
      const response = await fetch('/api/admin/csv-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          households: parseResult.households,
          dryRun,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setImportResult({ success: false, message: data.error || 'Import failed' });
      } else if (dryRun) {
        setImportResult({
          success: true,
          message: `Dry run complete: ${parseResult.households.length} households would be created`,
        });
      } else {
        setImportResult({
          success: true,
          message: `Successfully imported ${data.householdsCreated} households, ${data.usersCreated} new users, ${data.rsvpsCreated} RSVPs`,
        });
        if (onImportComplete) {
          onImportComplete(data);
        }
      }
    } catch {
      setImportResult({ success: false, message: 'Network error occurred' });
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadSample = () => {
    const csv = generateSampleCsv();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'households-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900">Bulk CSV Import</h3>
          <p className="mt-1 text-sm text-stone-600">Import households and RSVPs from a CSV file</p>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
        >
          {isOpen ? 'Close' : 'Import CSV'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={handleDownloadSample}
              className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-200"
            >
              Download Template
            </button>
          </div>

          <div
            className={`relative rounded-lg border-2 border-dashed p-8 text-center ${
              dragActive ? 'border-amber-500 bg-amber-50' : 'border-stone-300'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-stone-600">
              {file ? (
                <span className="font-medium text-stone-900">{file.name}</span>
              ) : (
                'Drag and drop a CSV file here, or'
              )}{' '}
              {file ? (
                <button
                  onClick={() => {
                    setFile(null);
                    setParseResult(null);
                    setImportResult(null);
                  }}
                  className="ml-2 text-amber-600 hover:text-amber-700"
                >
                  Remove
                </button>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="ml-1 font-medium text-amber-600 hover:text-amber-700"
                >
                  browse
                </button>
              )}
            </p>
          </div>

          {parseResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-stone-50 p-3">
                <div className="text-sm">
                  <span className="font-medium text-stone-900">{parseResult.totalRows}</span> rows
                  <span className="mx-2 text-stone-400">|</span>
                  <span className="font-medium text-green-600">
                    {parseResult.households.length}
                  </span>{' '}
                  households parsed
                  {parseResult.errors.length > 0 && (
                    <>
                      <span className="mx-2 text-stone-400">|</span>
                      <span className="font-medium text-red-600">
                        {parseResult.errors.length} errors
                      </span>
                    </>
                  )}
                </div>
                <button
                  onClick={handleDryRun}
                  className="text-sm font-medium text-amber-600 hover:text-amber-700"
                >
                  Re-parse
                </button>
              </div>

              {parseResult.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3">
                  <h4 className="mb-2 text-sm font-medium text-red-800">Errors</h4>
                  <ul className="space-y-1">
                    {parseResult.errors.map((err, i) => (
                      <li key={i} className="text-sm text-red-700">
                        {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {parseResult.households.length > 0 && (
                <div className="max-h-60 overflow-y-auto rounded-lg border border-stone-200 p-3">
                  <h4 className="mb-2 text-sm font-medium text-stone-700">Preview</h4>
                  <ul className="space-y-2">
                    {parseResult.households.slice(0, 10).map((hh, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium text-stone-900">{hh.name}</span>
                        <span className="ml-2 text-stone-500">
                          ({hh.members.length} member{hh.members.length !== 1 ? 's' : ''})
                        </span>
                        <ul className="ml-4 text-stone-600">
                          {hh.members.map((m, j) => (
                            <li key={j}>
                              {m.name} ({m.email})
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                    {parseResult.households.length > 10 && (
                      <li className="text-sm text-stone-500">
                        ...and {parseResult.households.length - 10} more households
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {importResult && (
                <div
                  className={`rounded-lg p-3 ${
                    importResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  {importResult.message}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleImport(true)}
                  disabled={importing || parseResult.errors.length > 0}
                  className="rounded-lg bg-stone-100 px-4 py-2 font-medium text-stone-700 hover:bg-stone-200 disabled:bg-stone-300"
                >
                  Dry Run
                </button>
                <button
                  onClick={() => handleImport(false)}
                  disabled={importing || parseResult.errors.length > 0}
                  className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:bg-stone-300"
                >
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
