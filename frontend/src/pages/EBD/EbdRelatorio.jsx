import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import api from '../../services/api';

export default function EbdRelatorio() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get('/ebd/relatorio/geral').then(({ data }) => setRows(data));
  }, []);

  return (
    <div>
      <Header title="Relatórios EBD" subtitle="Resumo geral" />
      <div className="bg-white rounded-xl shadow-soft p-6">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-2">Classe</th>
              <th className="px-4 py-2">Presenças</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.classe} className="border-t">
                <td className="px-4 py-2">{r.classe}</td>
                <td className="px-4 py-2">{r.presentes}</td>
                <td className="px-4 py-2">{r.total}</td>
                <td className="px-4 py-2">{r.percentual}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
