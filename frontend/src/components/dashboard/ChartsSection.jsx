import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
  CartesianGrid,
} from 'recharts';

const COLORS = ['#0b4dbf', '#c9a227', '#0a1f44', '#6b21a8', '#0f766e', '#b91c1c', '#6d28d9'];

const SkeletonChart = ({ height = 'h-56' }) => (
  <div className={`${height} w-full animate-pulse bg-stone-100 rounded-xl flex items-center justify-center`}>
    <svg className="w-8 h-8 text-stone-200" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  </div>
);

const tooltipStyle = {
  contentStyle: {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  cursor: { fill: 'rgba(11,77,191,0.05)' },
};

const truncate = (s, n) => (typeof s === 'string' && s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default function ChartsSection({ growth, byCongregation, byGroup, retention, loading }) {
  const congregationHeight = Math.max(220, byCongregation.length * 30);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <div className="bg-white rounded-xl border border-stone-100 p-4 sm:p-6">
        <h3 className="font-display text-base sm:text-lg text-ibbiNavy">Crescimento de pessoas</h3>
        <p className="text-xs text-slate-400 mb-4">Novos cadastros nos últimos 6 meses</p>
        {loading.growth ? <SkeletonChart /> : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#0b4dbf"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: 'white' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-100 p-4 sm:p-6">
        <h3 className="font-display text-base sm:text-lg text-ibbiNavy">Pessoas por congregação</h3>
        <p className="text-xs text-slate-400 mb-4">Total por congregação</p>
        {loading.congregation ? <SkeletonChart height="h-[300px]" /> : (
          <div style={{ height: congregationHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCongregation} layout="vertical" margin={{ top: 5, right: 36, left: 0, bottom: 5 }}>
                <CartesianGrid stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <YAxis
                  dataKey="congregacao"
                  type="category"
                  width={110}
                  interval={0}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickFormatter={(v) => truncate(v, 16)}
                />
                <Tooltip {...tooltipStyle} />
                <Bar
                  dataKey="total"
                  fill="#c9a227"
                  radius={[0, 6, 6, 0]}
                  label={{ position: 'right', fill: '#0a1f44', fontSize: 12, fontWeight: 700 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-100 p-4 sm:p-6">
        <h3 className="font-display text-base sm:text-lg text-ibbiNavy">Distribuição por grupo</h3>
        <p className="text-xs text-slate-400 mb-4">Proporção por grupo</p>
        {loading.group ? <SkeletonChart height="h-[300px]" /> : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Pie
                  data={byGroup}
                  dataKey="total"
                  nameKey="grupo"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={3}
                >
                  {byGroup.map((entry, index) => (
                    <Cell key={`cell-${entry.grupo}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value, entry) => `${value} (${entry.payload.total})`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-100 p-4 sm:p-6">
        <h3 className="font-display text-base sm:text-lg text-ibbiNavy">Taxa de retenção</h3>
        <p className="text-xs text-slate-400 mb-4">Entradas vs saídas por mês</p>
        {loading.retention ? <SkeletonChart /> : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={retention} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                <Area type="monotone" dataKey="entradas" stackId="1" stroke="#0b4dbf" fill="#0b4dbf" fillOpacity={0.25} />
                <Area type="monotone" dataKey="saidas" stackId="1" stroke="#c2410c" fill="#c2410c" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
