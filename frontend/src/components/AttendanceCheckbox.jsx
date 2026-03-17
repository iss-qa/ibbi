export default function AttendanceCheckbox({ checked, onChange, justificativa, onJustificativa }) {
  return (
    <div className="flex items-center gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {!checked && (
        <input
          className="border rounded-lg px-2 py-1"
          placeholder="Justificativa"
          value={justificativa || ''}
          onChange={(e) => onJustificativa(e.target.value)}
        />
      )}
    </div>
  );
}
