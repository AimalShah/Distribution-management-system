import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

interface CustomerChartProps {
  isDark: boolean;
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

export const CustomerChart: React.FC<CustomerChartProps> = ({ isDark }) => {
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
              i === peakIdx ? '#22B573' : 'rgba(34,181,115,0.18)'
            ),
            borderColor: data.map((_, i) => (i === peakIdx ? '#22B573' : 'transparent')),
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
          <div className="stat-icon icon-bg-info w-8 h-8 rounded-lg flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
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
            <h2 className="card-title">Customer Statistics</h2>
            <p className="card-subtitle">New vs returning customers</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setPeriod('weekly')}
            className={`btn btn-sm cursor-pointer ${period === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
            aria-label="View weekly customers"
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={`btn btn-sm cursor-pointer ${period === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
            aria-label="View monthly customers"
          >
            Monthly
          </button>
        </div>
      </div>
      <div className="flex items-baseline gap-3 mb-5">
        <div className="dash-chart-total">{customerData.peakMetrics[period].value}</div>
        <span className="dash-chart-subtitle">{customerData.peakMetrics[period].subtitle}</span>
      </div>
      <div className="chart-container h-[240px]">
        <canvas ref={canvasRef} id="customerChart" />
      </div>
    </div>
  );
};
