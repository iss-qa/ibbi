export default function FrequencyBadge({ value }) {
  const color = value < 50 ? 'bg-red-100 text-red-700' : value < 75 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-700';
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{value}%</span>;
}
