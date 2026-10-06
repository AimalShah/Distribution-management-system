import React, { useState, useEffect, useRef } from 'react';
import Chart, { ScriptableContext } from 'chart.js/auto';

interface SalesChartProps {
  isDark?: boolean;
}

const salesData = {
  monthly: [42500, 38900, 51200, 47300, 56800, 62100, 67347, 58400, 53200, 61800, 72000, 68500],
  weekly:  [12400, 15200, 11800, 14600, 13900, 16200, 18400, 14100],
  daily:   [2100, 1850, 2400, 2200, 2800, 3100, 2650],
  labels: {
    monthly: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
    weekly:  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'],
    daily:   ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  totals: {
    monthly: 'Rs 67,347',
    weekly: 'Rs 18,400',
    daily: 'Rs 3,100',
  }
};

export const SalesChart: React.FC<SalesChartProps> = ({ isDark = false }) => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const labels = salesData.labels[period];
    const data = salesData[period];
    const peakIdx = data.indexOf(Math.max(...data));

    const gridColor = isDark ? 'rgba(51,65,85,0.8)' : 'rgba(232,237,241,0.8)';
    const tickColor = isDark ? '#94A3B8' : '#6B7280';
    const tooltipBg = isDark ? 'rgba(30,41,59,0.97)' : 'rgba(23,33,43,0.95)';

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Sales',
            data,
            borderColor: '#0FA05F',
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            backgroundColor: (context: ScriptableContext<'line'>) => {
              const chart = context.chart;
              const { ctx: c, chartArea } = chart;
              if (!chartArea) return 'transparent';
              const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              grad.addColorStop(0, 'rgba(15,160,95,0.18)');
              grad.addColorStop(1, 'rgba(15,160,95,0.01)');
              return grad;
            },
            pointBackgroundColor: data.map((_, i) => (i === peakIdx ? '#0FA05F' : 'transparent')),
            pointBorderColor: data.map((_, i) => (i === peakIdx ? '#fff' : 'transparent')),
            pointBorderWidth: data.map((_, i) => (i === peakIdx ? 3 : 0)),
            pointRadius: data.map((_, i) => (i === peakIdx ? 8 : 3)),
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#0FA05F',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tooltipBg,
            padding: 12,
            cornerRadius: 10,
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 13 },
            callbacks: {
              label: (context) => ` Rs ${(context.parsed.y ?? 0).toLocaleString()}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: tickColor,
              font: { size: 11, weight: 500 },
            },
          },
          y: {
            grid: { color: gridColor },
            border: { display: false },
            ticks: {
              color: tickColor,
              font: { size: 11 },
              callback: (v) => {
                const val = Number(v);
                return val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val;
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [period, isDark]);

  return (
    <div className="card lg:col-span-2 animate-slideInUp stagger-3">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <div className="stat-card-icon icon-bg-primary w-8 h-8 rounded-lg flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div>
            <h2 className="card-title">Sales Overview</h2>
            <p className="card-subtitle">Revenue trend &amp; analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--background)' }}>
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`btn btn-sm capitalize cursor-pointer ${
                  period === p ? 'btn-primary' : 'btn-ghost'
                }`}
                style={{ fontSize: '12px', padding: '4px 10px', height: 'auto' }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-2xl font-bold text-[var(--text)]">
          {salesData.totals[period]}
        </span>
        <span className="text-xs text-[var(--muted)]">in selected period</span>
      </div>
      <div className="h-64 sm:h-72 w-full">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};
