'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  ArrowRight,
  Database,
  ShieldCheck,
  Check,
  X,
  FileDown,
  Trash2,
  Download,
  FileText,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { LedgerPanel } from '@/components/integrations/XeroPanel';
import { toPence, formatPence } from '@/lib/money';

interface ParsedRow {
  code: string;
  name: string;
  type: string;
  debit: string;
  credit: string;
  debitPence: bigint;
  creditPence: bigint;
}

export default function ImportDataPage() {
  const params = useParams();
  const router = useRouter();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeSource, setActiveSource] = useState<'csv' | 'blynt' | 'xero' | 'quickbooks'>('csv');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawCsvText, setRawCsvText] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isCommitted, setIsCommitted] = useState(false);
  const [snapshotHash, setSnapshotHash] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  // Active client lookup
  const activeEngagement = db.engagements.find((e) => e.id === engagementId);
  const activeClient = db.clients.find((c) => c.id === activeEngagement?.client_id);

  // Calculated totals strictly in BigInt pence
  const totalDebits = parsedRows.reduce((acc, r) => acc + r.debitPence, 0n);
  const totalCredits = parsedRows.reduce((acc, r) => acc + r.creditPence, 0n);
  const difference = totalDebits - totalCredits;
  const isBalanced = parsedRows.length > 0 && difference === 0n;

  // Duplicate codes check
  const codesSet = new Set<string>();
  const duplicateCodes: string[] = [];
  parsedRows.forEach((r) => {
    if (codesSet.has(r.code)) {
      duplicateCodes.push(r.code);
    } else {
      codesSet.add(r.code);
    }
  });

  // RFC 4180 compliant CSV parser respecting quoted commas and line breaks
  const parseCsvRows = (text: string): string[][] => {
    const rows: string[][] = [];
    let curRow: string[] = [];
    let curField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          curField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        curRow.push(curField.trim());
        curField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && text[i + 1] === '\n') {
          i++;
        }
        curRow.push(curField.trim());
        curField = '';
        if (curRow.some((f) => f.length > 0)) {
          rows.push(curRow.map((c) => c.replace(/^"|"$/g, '').trim()));
        }
        curRow = [];
      } else {
        curField += char;
      }
    }
    if (curField.length > 0 || curRow.length > 0) {
      curRow.push(curField.trim());
      if (curRow.some((f) => f.length > 0)) {
        rows.push(curRow.map((c) => c.replace(/^"|"$/g, '').trim()));
      }
    }
    return rows;
  };

  // Parse CSV text into rows
  const parseCsv = (text: string, sourceName: string) => {
    setFileName(sourceName);
    setRawCsvText(text);
    setIsCommitted(false);
    setValidationError(null);
    setClearMessage(null);

    const allRows = parseCsvRows(text);
    if (allRows.length < 2) {
      setValidationError('The uploaded file contains no data rows.');
      setParsedRows([]);
      return;
    }

    // Dynamic Header Detection: scans first 12 rows to find actual table header row (skips metadata preambles like "Trial Balance", "MB Therapy", "As at...")
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(allRows.length, 12); r++) {
      const row = allRows[r];
      const hasAccountOrCode = row.some((c) => /\b(code|nominal|acct|acc|account)\b/i.test(c));
      const hasDebitOrCredit = row.some((c) => /\b(debit|credit|dr|cr|balance|net|amount)\b/i.test(c));
      if (hasAccountOrCode && hasDebitOrCredit) {
        headerRowIdx = r;
        break;
      }
    }
    if (headerRowIdx === -1) {
      headerRowIdx = allRows.findIndex((r) => r.filter((c) => c.length > 0).length >= 3);
      if (headerRowIdx === -1) headerRowIdx = 0;
    }

    const rawHeaders = allRows[headerRowIdx];
    setHeaders(rawHeaders);

    // Identify column indices
    // Whole-word matches, so "Description" is never read as a credit ("cr") column
    let codeIdx = rawHeaders.findIndex((h) => /\b(code|nominal|acct|acc|account\s*(no|num|#))\b/i.test(h));
    let nameIdx = rawHeaders.findIndex((h) => /\b(desc|description|name|title|particulars|account)\b/i.test(h));
    let typeIdx = rawHeaders.findIndex((h) => /\b(cat|category|type|class|group|heading)\b/i.test(h));
    let debitIdx = rawHeaders.findIndex((h) => /\b(debit|dr)\b/i.test(h));
    let creditIdx = rawHeaders.findIndex((h) => /\b(credit|cr)\b/i.test(h));
    let netIdx = rawHeaders.findIndex((h) => /\b(balance|net|amount|ytd|total)\b/i.test(h));

    // Fallbacks if header names are generic
    if (codeIdx === -1) codeIdx = 0;
    if (nameIdx === -1 || nameIdx === codeIdx) {
      nameIdx = rawHeaders.findIndex((h, idx) => idx !== codeIdx && /\b(name|desc|account|title)\b/i.test(h));
      if (nameIdx === -1) nameIdx = rawHeaders.length > 1 ? (codeIdx === 0 ? 1 : 0) : 0;
    }

    const isSingleNet = (debitIdx === -1 || creditIdx === -1) && netIdx !== -1;
    if (debitIdx === -1 && !isSingleNet) {
      debitIdx = Math.min(rawHeaders.length - 2, 2);
    }
    if (creditIdx === -1 && !isSingleNet) {
      creditIdx = Math.min(rawHeaders.length - 1, 3);
    }

    const rows: ParsedRow[] = [];
    const badRows: number[] = [];

    for (let i = headerRowIdx + 1; i < allRows.length; i++) {
      const cols = allRows[i];
      if (!cols.some((c) => c.length > 0)) continue;

      let name = (cols[nameIdx] || '').trim();
      let code = (cols[codeIdx] || '').trim();
      const type = (typeIdx !== -1 && cols[typeIdx] ? cols[typeIdx] : 'General') || 'General';

      // Skip summary / report footer total lines
      const isTotalRow =
        /^total(s)?\b/i.test(code) ||
        /^total(s)?\b/i.test(name) ||
        /^(grand\s*total|report\s*total|trial\s*balance\s*total)/i.test(name) ||
        /^(grand\s*total|report\s*total)/i.test(code);
      if (isTotalRow) {
        continue;
      }

      // Auto-generate code if missing but name exists (e.g. Starling Business Account)
      if (!code && name) {
        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
        code = cleanName ? `ACC-${cleanName}` : `ACC-${i + 1}`;
      }
      if (!name && code) {
        name = `Account ${code}`;
      }
      if (!code && !name) continue;

      let debitP = 0n;
      let creditP = 0n;
      let debitStr = '0.00';
      let creditStr = '0.00';

      if (isSingleNet) {
        const netRaw = cols[netIdx] || '0.00';
        try {
          const netP = toPence(netRaw);
          if (netP >= 0n) {
            debitP = netP;
            debitStr = (Number(netP) / 100).toFixed(2);
          } else {
            creditP = -netP;
            creditStr = (Number(-netP) / 100).toFixed(2);
          }
        } catch {
          badRows.push(i + 1);
          continue;
        }
      } else {
        const debitRaw = cols[debitIdx] || '0.00';
        const creditRaw = cols[creditIdx] || '0.00';

        try {
          debitP = toPence(debitRaw);
          debitStr = debitP !== 0n ? (Number(debitP) / 100).toFixed(2) : (debitRaw.trim() || '0.00');
        } catch {
          badRows.push(i + 1);
          continue;
        }

        try {
          creditP = toPence(creditRaw);
          creditStr = creditP !== 0n ? (Number(creditP) / 100).toFixed(2) : (creditRaw.trim() || '0.00');
        } catch {
          badRows.push(i + 1);
          continue;
        }
      }

      rows.push({
        code,
        name,
        type,
        debit: debitStr,
        credit: creditStr,
        debitPence: debitP,
        creditPence: creditP,
      });
    }

    if (badRows.length) {
      setValidationError(
        `Row${badRows.length === 1 ? '' : 's'} ${badRows.slice(0, 10).join(', ')} ${badRows.length === 1 ? 'has' : 'have'} a debit or credit that is not a number. Fix the file and upload it again.`
      );
      setParsedRows([]);
      return;
    }
    setParsedRows(rows);
  };

  // Handle file picker selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCsv(content, file.name);
    };
    reader.readAsText(file);
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCsv(content, file.name);
    };
    reader.readAsText(file);
  };

  // Load sample CSV directly
  const handleLoadSample = async (samplePath: string, name: string) => {
    try {
      const res = await fetch(samplePath);
      const text = await res.text();
      parseCsv(text, name);
    } catch (err) {
      setValidationError('Failed to load sample CSV: ' + String(err));
    }
  };

  // Clear existing test data on engagement
  const handleClearTestData = async () => {
    if (!confirm('Are you sure you want to remove all existing trial balance and mapping data for this engagement? This cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    try {
      const res = await fetch(`/api/v1/engagements/${engagementId}/imports`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setClearMessage('All previous test data for this engagement has been removed. You can now import a clean CSV.');
        setParsedRows([]);
        setFileName(null);
        setIsCommitted(false);
      } else {
        alert('Error clearing test data: ' + data.error);
      }
    } catch (err) {
      alert('Network error while clearing test data: ' + String(err));
    } finally {
      setIsClearing(false);
    }
  };

  // Commit Import to database
  const handleCommitImport = async () => {
    if (!isBalanced) {
      alert('Cannot import unbalanced trial balance: sum of debits must equal sum of credits.');
      return;
    }

    const payload = {
      lines: parsedRows.map((r) => ({
        code: r.code,
        name: r.name,
        type: r.type,
        debit: r.debit,
        credit: r.credit,
      })),
      source: activeSource,
    };

    try {
      const res = await fetch(`/api/v1/engagements/${engagementId}/imports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSnapshotHash(data.snapshot.sha256);
        setIsCommitted(true);
        // Automatically route to Step 2 (Account Mapping)
        setTimeout(() => {
          router.push(`/engagements/${engagementId}/mapping`);
        }, 1200);
      } else {
        alert('Import error: ' + (data.error || 'Failed to import trial balance'));
      }
    } catch (err) {
      alert('Network error during import: ' + String(err));
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#5B6478] mb-1">
            <Link href="/" className="hover:text-[#B8432F]">Blynt</Link>
            <span>/</span>
            <span className="text-[#102654] font-semibold">{activeClient?.name ?? "Engagement"}</span>
            <span>/</span>
            <span>1 Import data</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102654] tracking-tight">
            Import trial balance
          </h1>
          <p className="text-xs text-[#5B6478] mt-0.5">
            Ingest trial balance with real CSV parsing, debits=credits verification, and immutable cryptographic snapshot.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClearTestData}
            disabled={isClearing}
            className="min-h-[44px] px-3.5 py-2 border border-[#D5DBE7] hover:border-[#B42318] hover:bg-[#FDECEA] text-[#B42318] text-xs font-bold rounded-[10px] flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-[#B42318]" />
            <span>{isClearing ? 'Clearing...' : 'Clear test data'}</span>
          </button>

          <Link
            href={`/engagements/${engagementId}/mapping`}
            className="min-h-[44px] px-4 py-2 bg-[#102654] text-white text-xs font-bold rounded-[10px] flex items-center gap-2 hover:bg-[#0B1B3D]"
          >
            <span>Go to mapping</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Clear notification banner */}
      {clearMessage && (
        <div className="p-4 bg-[#E6F4EF] border border-[#0B6B52]/30 rounded-[12px] flex items-center gap-3 text-xs text-[#0B6B52] font-semibold">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{clearMessage}</span>
        </div>
      )}

      {/* CSV Samples & Templates Card */}
      <div className="blynt-card p-5 bg-[#F6F7FB] border border-[#D5DBE7]">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E3E7EF]">
          <div className="flex items-center gap-2 text-xs font-bold text-[#102654]">
            <FileSpreadsheet className="w-4 h-4 text-[#1D4E89]" />
            <span>Trial balance CSV samples &amp; downloadable templates</span>
          </div>
          <span className="text-[10px] text-[#5B6478] font-mono">Ready to use</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Sample 0: MB Therapy Real Practice File */}
          <div className="bg-white p-3.5 rounded-[12px] border border-[#102654]/30 shadow-xs flex flex-col justify-between gap-3 ring-1 ring-[#102654]/10">
            <div>
              <div className="text-xs font-bold text-[#102654] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FF7D6B]" />
                MB Therapy Ltd (Client Practice)
              </div>
              <p className="text-[11px] text-[#5B6478] mt-1">
                39 rows • Balanced at £164,755.68 • Preamble headers &amp; blank bank code.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/samples/mb_therapy_trial_balance.csv"
                download="mb_therapy_trial_balance.csv"
                className="flex-1 py-1.5 px-2 bg-[#F6F7FB] hover:bg-[#EAF5FC] border border-[#D5DBE7] text-[#102654] text-[10px] font-semibold rounded-[6px] text-center flex items-center justify-center gap-1"
              >
                <Download className="w-3 h-3 text-[#5B6478]" />
                Download
              </a>
              <button
                type="button"
                onClick={() => handleLoadSample('/samples/mb_therapy_trial_balance.csv', 'mb_therapy_trial_balance.csv')}
                className="py-1.5 px-3 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] text-[10px] font-bold rounded-[6px] cursor-pointer shadow-xs"
              >
                Load &amp; Parse
              </button>
            </div>
          </div>
          {/* Sample 1: Acme Corp Balanced */}
          <div className="bg-white p-3.5 rounded-[12px] border border-[#E3E7EF] flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-[#102654] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0B6B52]" />
                Test Company Ltd (Balanced)
              </div>
              <p className="text-[11px] text-[#5B6478] mt-1">
                27 rows • Balanced at £14,349,000.00 • Difference £0.00.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/samples/acme_corp_trial_balance.csv"
                download="acme_corp_trial_balance.csv"
                className="flex-1 py-1.5 px-2.5 bg-[#F6F7FB] hover:bg-[#EAF5FC] border border-[#D5DBE7] text-[#102654] text-[11px] font-semibold rounded-[6px] text-center flex items-center justify-center gap-1"
              >
                <Download className="w-3 h-3 text-[#5B6478]" />
                Download CSV
              </a>
              <button
                type="button"
                onClick={() => handleLoadSample('/samples/acme_corp_trial_balance.csv', 'acme_corp_trial_balance.csv')}
                className="py-1.5 px-3 bg-[#102654] hover:bg-[#0B1B3D] text-white text-[11px] font-bold rounded-[6px] cursor-pointer"
              >
                Load
              </button>
            </div>
          </div>

          {/* Sample 2: Unbalanced Test */}
          <div className="bg-white p-3.5 rounded-[12px] border border-[#E3E7EF] flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-[#102654] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#A23A27]" />
                Unbalanced Sample (£15 diff)
              </div>
              <p className="text-[11px] text-[#5B6478] mt-1">
                2 rows • Tests Acceptance Rule 1 (Rejection with difference shown).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/samples/trial_balance_unbalanced.csv"
                download="trial_balance_unbalanced.csv"
                className="flex-1 py-1.5 px-2.5 bg-[#F6F7FB] hover:bg-[#FFF1EE] border border-[#D5DBE7] text-[#102654] text-[11px] font-semibold rounded-[6px] text-center flex items-center justify-center gap-1"
              >
                <Download className="w-3 h-3 text-[#5B6478]" />
                Download CSV
              </a>
              <button
                type="button"
                onClick={() => handleLoadSample('/samples/trial_balance_unbalanced.csv', 'trial_balance_unbalanced.csv')}
                className="py-1.5 px-3 bg-[#B8432F] hover:bg-[#a03825] text-white text-[11px] font-bold rounded-[6px] cursor-pointer"
              >
                Load
              </button>
            </div>
          </div>

          {/* Sample 3: Blank Template */}
          <div className="bg-white p-3.5 rounded-[12px] border border-[#E3E7EF] flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-[#102654] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#1D4E89]" />
                Blank Template CSV
              </div>
              <p className="text-[11px] text-[#5B6478] mt-1">
                Standard headers ready for entering custom trial balances.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/samples/blank_template.csv"
                download="blank_template.csv"
                className="flex-1 py-1.5 px-2.5 bg-[#F6F7FB] hover:bg-[#EAF5FC] border border-[#D5DBE7] text-[#102654] text-[11px] font-semibold rounded-[6px] text-center flex items-center justify-center gap-1"
              >
                <Download className="w-3 h-3 text-[#5B6478]" />
                Download CSV
              </a>
              <button
                type="button"
                onClick={() => handleLoadSample('/samples/blank_template.csv', 'blank_template.csv')}
                className="py-1.5 px-3 bg-[#102654] hover:bg-[#0B1B3D] text-white text-[11px] font-bold rounded-[6px] cursor-pointer"
              >
                Load
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Source Selection Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: 'csv', name: 'CSV / Excel Upload', desc: 'Real column matching & ingestion' },
          { id: 'blynt', name: 'Blynt Accounting', desc: 'Native chart of accounts feed' },
          { id: 'xero', name: 'Xero', desc: 'Pull the trial balance from Xero' },
          { id: 'quickbooks', name: 'QuickBooks Online', desc: 'Pull the trial balance from QuickBooks' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSource(tab.id as any)}
            className={`p-3.5 rounded-[14px] text-left border transition-all cursor-pointer ${
              activeSource === tab.id
                ? 'bg-white border-[#102654] shadow-sm ring-2 ring-[#102654]'
                : 'bg-white/60 border-[#E3E7EF] hover:bg-white'
            }`}
          >
            <div className="text-xs font-bold text-[#102654]">{tab.name}</div>
            <div className="text-[10px] text-[#5B6478] mt-0.5">{tab.desc}</div>
          </button>
        ))}
      </div>

      {(activeSource === 'xero' || activeSource === 'quickbooks') && (
        <LedgerPanel
          key={activeSource}
          provider={activeSource}
          clientId={db.engagements.find((e) => e.id === engagementId)?.client_id ?? ''}
          engagementId={engagementId}
          reconnectNeeded={Boolean(db.clients.find((c) => c.id === db.engagements.find((e) => e.id === engagementId)?.client_id)?.reconnect_needed)}
        />
      )}

      {/* Main Flow Card */}
      <div className={`blynt-card p-6 sm:p-8 flex flex-col gap-6 ${activeSource === 'xero' || activeSource === 'quickbooks' ? 'hidden' : ''}`}>
        {/* Hidden Real File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".csv,text/csv,text/plain"
          onChange={handleFileChange}
          className="hidden"
        />

        {validationError && (
          <div role="alert" className="p-3 rounded-[10px] text-xs border bg-[#FFF1EE] border-[#FF7D6B]/40 text-[#A23A27]">
            {validationError}
          </div>
        )}

        {/* Upload Zone */}
        {parsedRows.length === 0 && !isCommitted ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-[#D5DBE7] hover:border-[#FF7D6B] rounded-[16px] p-8 text-center bg-[#F6F7FB] hover:bg-[#FFF1EE]/20 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3"
          >
            <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-[#102654]">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#102654]">
                Choose your CSV file or drag and drop here
              </div>
              <p className="text-xs text-[#5B6478] mt-1">
                Reads and calculates directly in integer pence. Supports .csv up to 50 MB.
              </p>
            </div>
            <button
              type="button"
              className="mt-2 min-h-[40px] px-4 bg-white border border-[#D5DBE7] hover:border-[#102654] rounded-[10px] text-xs font-bold text-[#102654] shadow-2xs"
            >
              Browse CSV file
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* File Info Bar */}
            <div className="p-4 bg-[#EAF5FC] border border-[#1D4E89]/20 rounded-[12px] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-[#1D4E89]" />
                <div>
                  <div className="text-xs font-bold text-[#102654]">
                    {fileName || 'Trial_Balance.csv'}
                  </div>
                  <div className="text-[11px] text-[#5B6478]">
                    {parsedRows.length} nominal accounts parsed successfully
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setParsedRows([]);
                  setFileName(null);
                  setIsCommitted(false);
                }}
                className="text-xs text-[#B8432F] hover:underline font-semibold cursor-pointer"
              >
                Choose another file
              </button>
            </div>

            {/* Unbalanced Trial Balance Alert (Ground Rule 1 & Acceptance Test 1) */}
            {!isBalanced && (
              <div className="p-4 bg-[#FFF1EE] border-2 border-[#FF7D6B] rounded-[12px] flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#A23A27]">
                  <AlertCircle className="w-5 h-5 text-[#B8432F]" />
                  <span>Unbalanced Trial Balance Rejected</span>
                </div>
                <p className="text-xs text-[#5B6478]">
                  Total debits ({formatPence(totalDebits)}) do not equal total credits ({formatPence(totalCredits)}).
                  Net difference: <span className="font-mono font-bold text-[#A23A27]">{formatPence(difference)}</span>.
                  The trial balance cannot be imported until debits equal credits.
                </p>
              </div>
            )}

            {/* Pre-Import Checks Panel */}
            <div className="p-4 bg-[#F6F7FB] border border-[#E3E7EF] rounded-[14px] flex flex-col gap-3">
              <div className="text-xs font-bold text-[#102654]">
                Pre-import verification checks (Strict BigInt pence calculation)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Check 1: Balanced */}
                <div className="p-3 bg-white rounded-[10px] border border-[#E3E7EF] flex items-center gap-2.5">
                  {isBalanced ? (
                    <CheckCircle2 className="w-4 h-4 text-[#0B6B52] shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[#B8432F] shrink-0" />
                  )}
                  <div>
                    <div className="font-bold text-[#102654]">
                      {isBalanced ? 'Debits = Credits' : 'Unbalanced'}
                    </div>
                    <div className="text-[10px] font-mono text-[#5B6478]">
                      Diff: {formatPence(difference)}
                    </div>
                  </div>
                </div>

                {/* Check 2: Unique codes */}
                <div className="p-3 bg-white rounded-[10px] border border-[#E3E7EF] flex items-center gap-2.5">
                  {duplicateCodes.length === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-[#0B6B52] shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[#B8432F] shrink-0" />
                  )}
                  <div>
                    <div className="font-bold text-[#102654]">Unique Codes</div>
                    <div className="text-[10px] text-[#5B6478]">
                      {duplicateCodes.length === 0
                        ? `${parsedRows.length} unique nominals`
                        : `${duplicateCodes.length} duplicates detected`}
                    </div>
                  </div>
                </div>

                {/* Check 3: Valid format */}
                <div className="p-3 bg-white rounded-[10px] border border-[#E3E7EF] flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#0B6B52] shrink-0" />
                  <div>
                    <div className="font-bold text-[#102654]">Data Integrity</div>
                    <div className="text-[10px] text-[#5B6478]">
                      All rows parsed to integer pence
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Parsed Rows Preview Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-[#102654]">
                  Preview ({parsedRows.length} accounts)
                </h3>
                <span className="text-[11px] font-mono text-[#5B6478]">
                  Debits: {formatPence(totalDebits)} | Credits: {formatPence(totalCredits)}
                </span>
              </div>

              <div className="border border-[#E3E7EF] rounded-[12px] overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs text-[#102654]">
                  <thead className="bg-[#F6F7FB] text-[#5B6478] uppercase text-[10px] font-bold tracking-wider border-b border-[#E3E7EF] sticky top-0">
                    <tr>
                      <th scope="col" className="p-2.5 pl-3">Code</th>
                      <th scope="col" className="p-2.5">Account Description</th>
                      <th scope="col" className="p-2.5">Category</th>
                      <th scope="col" className="p-2.5 text-right">Debit</th>
                      <th scope="col" className="p-2.5 pr-3 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E7EF]">
                    {parsedRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-[#F6F7FB]">
                        <td className="p-2.5 pl-3 font-mono font-bold text-[#102654]">{r.code}</td>
                        <td className="p-2.5 font-semibold text-[#102654]">{r.name}</td>
                        <td className="p-2.5 text-[#5B6478]">{r.type}</td>
                        <td className="p-2.5 text-right font-mono-numbers">
                          {r.debitPence > 0n ? formatPence(r.debitPence) : '—'}
                        </td>
                        <td className="p-2.5 pr-3 text-right font-mono-numbers">
                          {r.creditPence > 0n ? formatPence(r.creditPence) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Commit Import Action */}
            {!isCommitted ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[#E3E7EF]">
                <div className="text-xs text-[#5B6478]">
                  Creating an import creates an immutable snapshot with cryptographic SHA-256 checksum.
                </div>
                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={!isBalanced}
                  className={`min-h-[44px] px-6 text-xs font-bold rounded-[10px] flex items-center justify-center gap-2 shadow-sm transition-all ${
                    isBalanced
                      ? 'bg-[#102654] hover:bg-[#0B1B3D] text-white cursor-pointer'
                      : 'bg-[#D5DBE7] text-[#7E8DA6] cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Import trial balance ({parsedRows.length} accounts)</span>
                </button>
              </div>
            ) : (
              <div className="p-5 bg-[#E6F4EF] border border-[#0B6B52]/30 rounded-[14px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-sm text-[#0B6B52] flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Trial balance imported &amp; snapshot committed
                  </div>
                  <div className="text-[11px] text-[#102654] font-mono mt-1">
                    SHA-256: {snapshotHash}
                  </div>
                </div>

                <Link
                  href={`/engagements/${engagementId}/mapping`}
                  className="min-h-[44px] px-5 bg-[#0B6B52] text-white text-xs font-bold rounded-[10px] flex items-center gap-2 hover:bg-[#095742] shrink-0"
                >
                  <span>Proceed to account mapping</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
