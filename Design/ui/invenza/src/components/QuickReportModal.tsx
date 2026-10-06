import React, { useState } from 'react';
import { SaleItem, LowStockProduct } from '../types';
import { generateQuickReportPdf } from '../utils/generateQuickReportPdf';

interface QuickReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: SaleItem[];
  lowStock: LowStockProduct[];
  currentDateFilter: 'mtd' | 'ytd';
  onShowToast: (title: string, message: string, type: 'info' | 'success') => void;
}

export const QuickReportModal: React.FC<QuickReportModalProps> = ({
  isOpen,
  onClose,
  sales,
  lowStock,
  currentDateFilter,
  onShowToast,
}) => {
  const [reportType, setReportType] = useState<'comprehensive' | 'inventory' | 'sales'>('comprehensive');
  const [period, setPeriod] = useState<'mtd' | 'ytd'>(currentDateFilter);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeInventory, setIncludeInventory] = useState(true);
  const [includeSales, setIncludeSales] = useState(true);
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleDownloadPdf = () => {
    setIsGenerating(true);
    onShowToast('Generating PDF', 'Compiling inventory health & sales metrics...', 'info');

    setTimeout(() => {
      try {
        const doc = generateQuickReportPdf(sales, lowStock, {
          period,
          includeSummary,
          includeInventory: reportType === 'sales' ? false : includeInventory,
          includeSales: reportType === 'inventory' ? false : includeSales,
          notes: notes.trim(),
        });

        const filename = `invenza-quick-report-${period}-${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(filename);
        setIsGenerating(false);
        onShowToast('Report Ready', `Downloaded ${filename} successfully`, 'success');
        onClose();
      } catch (err) {
        console.error(err);
        setIsGenerating(false);
        onShowToast('Generation Error', 'Failed to generate PDF. Please try again.', 'info');
      }
    }, 400);
  };

  const handlePrintPdf = () => {
    setIsGenerating(true);
    onShowToast('Preparing Print View', 'Formatting printable PDF document...', 'info');

    setTimeout(() => {
      try {
        const doc = generateQuickReportPdf(sales, lowStock, {
          period,
          includeSummary,
          includeInventory: reportType === 'sales' ? false : includeInventory,
          includeSales: reportType === 'inventory' ? false : includeSales,
          notes: notes.trim(),
        });

        const blobUrl = doc.output('bloburl');
        window.open(blobUrl, '_blank');
        setIsGenerating(false);
        onShowToast('Print Ready', 'Opened report in printable browser viewer', 'success');
      } catch (err) {
        console.error(err);
        setIsGenerating(false);
        onShowToast('Print Error', 'Failed to open print viewer.', 'info');
      }
    }, 400);
  };

  const multiplier = period === 'ytd' ? 3.4 : 1.0;
  const estRev = Math.round(17584 * multiplier);
  const estProfit = Math.round(5097 * multiplier);
  const criticalCount = lowStock.filter((p) => p.status === 'Critical' || p.status === 'Out of Stock').length;

  return (
    <div className="modal-backdrop" style={{ zIndex: 120 }}>
      <div className="modal-box modal-lg" style={{ maxWidth: '720px', width: '92%' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  Quick Reports &amp; Audit Summary
                </h3>
                <span className="badge badge-success text-[11px]">Print Ready</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                Generate an executive PDF summary of stock levels, turnover health, and sales trends.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon cursor-pointer p-1.5"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Scope Selector */}
          <div className="mb-4">
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Report Scope &amp; Focus
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setReportType('comprehensive');
                  setIncludeInventory(true);
                  setIncludeSales(true);
                }}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  reportType === 'comprehensive'
                    ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                    : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--muted)]'
                }`}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: reportType === 'comprehensive' ? 'var(--primary)' : 'var(--text)' }}>
                  Comprehensive
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  Full inventory health &amp; sales breakdown
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setReportType('inventory');
                  setIncludeInventory(true);
                  setIncludeSales(false);
                }}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  reportType === 'inventory'
                    ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                    : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--muted)]'
                }`}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: reportType === 'inventory' ? 'var(--primary)' : 'var(--text)' }}>
                  Inventory Health
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  Stock thresholds, SKUs &amp; reorders
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setReportType('sales');
                  setIncludeInventory(false);
                  setIncludeSales(true);
                }}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  reportType === 'sales'
                    ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                    : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--muted)]'
                }`}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: reportType === 'sales' ? 'var(--primary)' : 'var(--text)' }}>
                  Sales &amp; Revenue
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  Invoices, volume &amp; cash flows
                </div>
              </button>
            </div>
          </div>

          {/* Date Period & Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Reporting Timeframe
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPeriod('mtd')}
                  className={`btn btn-sm flex-1 cursor-pointer ${period === 'mtd' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Month to Date (MTD)
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('ytd')}
                  className={`btn btn-sm flex-1 cursor-pointer ${period === 'ytd' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Year to Date (YTD)
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Document Sections
              </label>
              <div className="flex flex-col gap-1.5 text-xs text-[var(--text)]">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeSummary}
                    onChange={(e) => setIncludeSummary(e.target.checked)}
                    className="accent-[var(--primary)]"
                  />
                  <span>Executive KPI Summary Cards</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeInventory}
                    disabled={reportType === 'sales'}
                    onChange={(e) => setIncludeInventory(e.target.checked)}
                    className="accent-[var(--primary)]"
                  />
                  <span>Stock Reorder &amp; Threshold Audit</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeSales}
                    disabled={reportType === 'inventory'}
                    onChange={(e) => setIncludeSales(e.target.checked)}
                    className="accent-[var(--primary)]"
                  />
                  <span>Recent Transactions &amp; Invoices Table</span>
                </label>
              </div>
            </div>
          </div>

          {/* Live Document Preview Box */}
          <div
            className="p-4 rounded-xl mb-4 border"
            style={{
              background: 'var(--background)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center justify-between mb-3 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--primary)' }}></span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Live PDF Preview Snapshot
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Format: A4 Portrait · Ready
              </span>
            </div>

            {/* Simulated Report Header */}
            <div className="p-3 bg-[var(--surface)] rounded-lg border mb-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)' }}>INVENZA</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Executive Operational Summary</div>
                </div>
                <div className="text-right" style={{ fontSize: '10px', color: 'var(--muted)' }}>
                  <div>Period: <strong className="text-[var(--text)]">{period.toUpperCase()}</strong></div>
                  <div>Auditor: John Smith (Admin)</div>
                </div>
              </div>

              {/* Mini KPI Preview */}
              {includeSummary && (
                <div className="grid grid-cols-4 gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="p-1.5 rounded bg-[var(--background)]">
                    <div style={{ fontSize: '9px', color: 'var(--muted)' }}>Est. Revenue</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text)' }}>${estRev.toLocaleString()}</div>
                  </div>
                  <div className="p-1.5 rounded bg-[var(--background)]">
                    <div style={{ fontSize: '9px', color: 'var(--muted)' }}>Est. Profit</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>${estProfit.toLocaleString()}</div>
                  </div>
                  <div className="p-1.5 rounded bg-[var(--background)]">
                    <div style={{ fontSize: '9px', color: 'var(--muted)' }}>Transactions</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text)' }}>{sales.length} logged</div>
                  </div>
                  <div className="p-1.5 rounded bg-[var(--background)]">
                    <div style={{ fontSize: '9px', color: 'var(--danger)' }}>Low Stock</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger)' }}>{criticalCount} critical</div>
                  </div>
                </div>
              )}
            </div>

            {/* Note text field */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text)' }}>
                Add Custom Executive Note (Optional):
              </label>
              <textarea
                rows={2}
                className="form-input w-full"
                style={{ fontSize: '12px', resize: 'vertical' }}
                placeholder="e.g. Critical stock reorders for Q4 have been initiated. Warehouse capacity operating at 85%."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary cursor-pointer"
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-secondary cursor-pointer flex items-center gap-1.5"
            onClick={handlePrintPdf}
            disabled={isGenerating}
            title="Open in printable browser viewer"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print Preview
          </button>

          <button
            type="button"
            className="btn btn-primary cursor-pointer flex items-center gap-2"
            onClick={handleDownloadPdf}
            disabled={isGenerating}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {isGenerating ? 'Compiling PDF...' : 'Download PDF Report'}
          </button>
        </div>
      </div>
    </div>
  );
};
