import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

interface CustomerChartProps {
  isDark?: boolean;
  totalCustomers?: number;
}

const customerData = {
  monthly: [120, 98, 145, 132, 178, 165, 203, 189, 142, 198, 221, 187],
  weekly:  [28, 35, 22, 41, 38, 52, 45],
  labels: {
    monthly: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
    weekly:  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  peakMetrics: {
    monthly: { value: '1,377', subtitle: 'peak month customers' },
    weekly: { value: '261', subtitle: 'peak week customers' },
  }
};

export const CustomerChart: React.FC<CustomerChartProps> = ({ isDark = false, totalCustomers }) => {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const labels = customerData.labels[period];
    const data = customerData[period];
    const peakIdx = data.indexOf(Math.max(...data));

    const gridColor = isDark ? 'rgba(51,65,85,0.8)' : 'rgba(232,237,241,0.8)';
    const tickColor = isDark ? '#94A3B8' : '#6B7280';
    const tooltipBg = isDark ? 'rgba(30,41,59,0.97)' : 'rgba(23,33,43,0.95)';

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Customers',
            data,
            backgroundColor: data.map((_, i) =>
              i === peakIdx ? '#0FA05F' : 'rgba(15,160,95,0.18)'
            ),
            borderColor: data.map((_, i) => (i === peakIdx ? '#0FA05F' : 'transparent')),
            borderWidth: 0,
            borderRadius: 6,
            borderSkipped: false,
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
            callbacks: {
              label: (context) => ` ${context.parsed.y} customers`,
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
                return val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val;
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
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h2 className="card-title">Customer Growth</h2>
            <p className="card-subtitle">Active accounts &amp; acquisition</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--background)' }}>
            {(['weekly', 'monthly'] as const).map((p) => (
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
          {customerData.peakMetrics[period].value}
        </span>
        <span className="text-xs text-[var(--muted)]">{customerData.peakMetrics[period].subtitle}</span>
      </div>
      <div className="h-64 sm:h-72 w-full">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};
