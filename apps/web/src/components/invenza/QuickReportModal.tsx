import React, { useState } from 'react';
import { SaleItem, LowStockProduct } from '../../types/invenza';
import { generateQuickReportPdf } from '../../utils/generateQuickReportPdf';
import { ModalShell, ModalFooter } from './ModalShell';

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
    <ModalShell
      zIndex={120}
      boxClassName="modal-box modal-lg"
      maxWidth="720px"
      iconClassName="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      }
      title="Instant Executive Summary (PDF)"
      titleFontSize="18px"
      subtitle={<>Generate official inventory audit &amp; sales overview report</>}
      onClose={onClose}
      footer={
        <ModalFooter
          left={
            <button
              type="button"
              className="btn btn-secondary btn-sm cursor-pointer"
              onClick={onClose}
              disabled={isGenerating}
            >
              Cancel
            </button>
          }
          right={
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm flex items-center gap-2 cursor-pointer"
                onClick={handlePrintPdf}
                disabled={isGenerating}
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
                className="btn btn-primary btn-sm flex items-center gap-2 cursor-pointer"
                onClick={handleDownloadPdf}
                disabled={isGenerating}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {isGenerating ? 'Exporting...' : 'Download PDF Report'}
              </button>
            </div>
          }
        />
      }
    >
      {/* Modal Body */}
      <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Preset Report Selection */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
            Select Report Scope
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                reportType === 'comprehensive'
                  ? 'border-primary-strong bg-[var(--primary-light)]'
                  : 'border-[var(--border)] hover:bg-[var(--background)]'
              }`}
              onClick={() => {
                setReportType('comprehensive');
                setIncludeSummary(true);
                setIncludeInventory(true);
                setIncludeSales(true);
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, color: reportType === 'comprehensive' ? 'var(--primary)' : 'var(--text)' }}>
                Comprehensive
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                Full inventory + sales
              </div>
            </button>

            <button
              type="button"
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                reportType === 'inventory'
                  ? 'border-primary-strong bg-[var(--primary-light)]'
                  : 'border-[var(--border)] hover:bg-[var(--background)]'
              }`}
              onClick={() => {
                setReportType('inventory');
                setIncludeSummary(true);
                setIncludeInventory(true);
                setIncludeSales(false);
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, color: reportType === 'inventory' ? 'var(--primary)' : 'var(--text)' }}>
                Stock Health
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                Thresholds &amp; reorder items
              </div>
            </button>

            <button
              type="button"
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                reportType === 'sales'
                  ? 'border-primary-strong bg-[var(--primary-light)]'
                  : 'border-[var(--border)] hover:bg-[var(--background)]'
              }`}
              onClick={() => {
                setReportType('sales');
                setIncludeSummary(true);
                setIncludeInventory(false);
                setIncludeSales(true);
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, color: reportType === 'sales' ? 'var(--primary)' : 'var(--text)' }}>
                Sales Overview
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                Recent invoices &amp; revenue
              </div>
            </button>
          </div>
        </div>

        {/* Period & Section Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              Accounting Period
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPeriod('mtd')}
                className={`btn btn-sm flex-1 cursor-pointer ${
                  period === 'mtd' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                Month-to-Date (MTD)
              </button>
              <button
                type="button"
                onClick={() => setPeriod('ytd')}
                className={`btn btn-sm flex-1 cursor-pointer ${
                  period === 'ytd' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                Year-to-Date (YTD)
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              Include Sections
            </label>
            <div className="flex flex-wrap gap-3 mt-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSummary}
                  onChange={(e) => setIncludeSummary(e.target.checked)}
                  className="accent-[var(--primary)]"
                />
                <span>KPI Highlights</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeInventory}
                  onChange={(e) => setIncludeInventory(e.target.checked)}
                  className="accent-[var(--primary)]"
                />
                <span>Inventory Table</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSales}
                  onChange={(e) => setIncludeSales(e.target.checked)}
                  className="accent-[var(--primary)]"
                />
                <span>Sales Ledger</span>
              </label>
            </div>
          </div>
        </div>

        {/* Live Preview Metric Pill Box */}
        <div
          className="p-4 rounded-xl flex items-center justify-between"
          style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Estimated Report Volume
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                ${estRev.toLocaleString()} Rev
              </span>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>•</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-strong)' }}>
                ${estProfit.toLocaleString()} Net
              </span>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>•</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: criticalCount > 0 ? 'var(--danger)' : 'var(--text)' }}>
                {criticalCount} Critical
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="badge badge-info">A4 Ready</span>
          </div>
        </div>

        {/* Optional Executive Note */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
            Executive Observation Note (Optional)
          </label>
          <textarea
            rows={2}
            placeholder="Leave blank for auto-generated AI replenishment recommendations..."
            className="form-input w-full"
            style={{ fontSize: '12px', resize: 'vertical' }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </ModalShell>
  );
};
