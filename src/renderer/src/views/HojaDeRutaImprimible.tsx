import React, { useState } from 'react';

export const HojaDeRutaImprimible: React.FC = () => {
  const [cobrador, setCobrador] = useState<string>('Ariel');
  const [fecha, setFecha] = useState<string>('2026-09-04');

  const clientesHoja = [
    { orden: 1, op: 450, cliente: 'PÉREZ JUAN CARLOS', dom: 'AV. BELGRANO 1420 - B° CENTRO', tel: '385-4123456', tipo: 'EFECTIVO', cuota: 5000, atraso: 0 },
    { orden: 2, op: 452, cliente: 'COMERCIAL EL AMIGO - SILVIA', dom: 'LIBERTAD 840 - B° HUAICO HONDO', tel: '385-5987654', tipo: 'PRODUCTO', cuota: 4000, atraso: 0 },
    { orden: 3, op: 458, cliente: 'GÓMEZ MARÍA LAURA', dom: 'ROCA SUR 245 - B° CABILDO', tel: '385-6112233', tipo: 'EFECTIVO', cuota: 2500, atraso: 1 },
    { orden: 4, op: 461, cliente: 'TALLER MECÁNICO RODRÍGUEZ', dom: 'AV. COLÓN SUR 3100', tel: '385-4889900', tipo: 'PRODUCTO', cuota: 8000, atraso: 0 },
    { orden: 5, op: 469, cliente: 'CORVALÁN RAMÓN E.', dom: 'PASAJE 12 CASA 44 - B° AUTONOMÍA', tel: '385-5334455', tipo: 'EFECTIVO', cuota: 15000, atraso: 2 },
    { orden: 6, op: 472, cliente: 'FARMACIA SAN ROQUE', dom: 'MITRE 620 - CENTRO', tel: '385-4221199', tipo: 'PRODUCTO', cuota: 6000, atraso: 0 },
    { orden: 7, op: 480, cliente: 'LÓPEZ PATRICIA', dom: 'MORENO NORTE 1150 - B° 8 DE ABRIL', tel: '385-6778899', tipo: 'EFECTIVO', cuota: 4000, atraso: 0 },
  ];

  const handleImprimir = () => {
    if (window.electronAPI?.imprimirHojaDeRuta) {
      window.electronAPI.imprimirHojaDeRuta();
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Barra de Controles (Oculta al Imprimir) */}
      <div className="no-print bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Emisión de Planilla Física de Cobranza</h2>
          <p className="text-xs text-slate-500">
            Formato A4 oficial para contingencia de corte de energía eléctrica o falta de señal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={cobrador}
            onChange={(e) => setCobrador(e.target.value)}
            className="bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white text-sm font-medium text-slate-800 px-3 py-2 rounded-xl focus:outline-none transition"
          >
            <option value="Ariel">Ariel (Zona Centro)</option>
            <option value="Álvaro">Álvaro (Zona Sur)</option>
            <option value="Antonela">Antonela (Zona La Banda)</option>
            <option value="Oriana">Oriana (Zona Norte)</option>
          </select>

          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white text-sm font-medium text-slate-800 px-3 py-2 rounded-xl focus:outline-none transition"
          />

          <button
            onClick={handleImprimir}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition"
          >
            <span className="material-symbols-outlined text-[20px]">print</span>
            Imprimir Planilla A4
          </button>
        </div>
      </div>

      {/* DOCUMENTO IMPRIMIBLE A4 */}
      <div className="bg-white text-black p-8 rounded-2xl shadow-md max-w-4xl mx-auto font-sans border border-slate-200">
        <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-end">
          <div>
            <div className="text-2xl font-black tracking-tight">CREDIT-ON</div>
            <div className="text-xs uppercase tracking-wider font-semibold text-gray-700">
              Equipamiento Comercial y Préstamos Diarios
            </div>
            <div className="text-xs text-gray-500">Santiago del Estero — Hoja de Ruta Oficial</div>
          </div>
          <div className="text-right text-xs space-y-1 font-mono">
            <div><strong>COBRADOR:</strong> {cobrador.toUpperCase()}</div>
            <div><strong>FECHA:</strong> {fecha}</div>
            <div><strong>CLIENTES:</strong> {clientesHoja.length}</div>
          </div>
        </div>

        <table className="w-full text-left text-xs border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100 text-gray-900 border-b border-gray-400">
              <th className="p-2 border-r border-gray-400 text-center w-8">#</th>
              <th className="p-2 border-r border-gray-400 w-12">OP</th>
              <th className="p-2 border-r border-gray-400">Cliente / Razón Social</th>
              <th className="p-2 border-r border-gray-400">Domicilio de Cobro</th>
              <th className="p-2 border-r border-gray-400 text-center">Tipo</th>
              <th className="p-2 border-r border-gray-400 text-right w-20">Cuota ($)</th>
              <th className="p-2 border-r border-gray-400 text-center w-16">Atraso</th>
              <th className="p-2 border-r border-gray-400 w-24 text-center">Cobrado ($)</th>
              <th className="p-2 text-center w-10">Firma</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300 font-sans">
            {clientesHoja.map((c) => (
              <tr key={c.op} className="h-10">
                <td className="p-2 border-r border-gray-300 text-center font-bold">{c.orden}</td>
                <td className="p-2 border-r border-gray-300 font-mono">#{c.op}</td>
                <td className="p-2 border-r border-gray-300 font-bold">{c.cliente}</td>
                <td className="p-2 border-r border-gray-300 text-[11px] leading-tight">{c.dom}</td>
                <td className="p-2 border-r border-gray-300 text-center text-[10px] font-bold">
                  {c.tipo === 'EFECTIVO' ? 'EFECT' : 'PROD'}
                </td>
                <td className="p-2 border-r border-gray-300 text-right font-mono font-bold">
                  ${c.cuota.toLocaleString('es-AR')}
                </td>
                <td className="p-2 border-r border-gray-300 text-center text-[10px]">
                  {c.atraso > 0 ? (
                    <span className="font-bold text-red-600">{c.atraso} d</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="p-2 border-r border-gray-300 bg-gray-50/50"></td>
                <td className="p-2 text-center border-gray-300">
                  <div className="w-4 h-4 border border-gray-400 mx-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 border-t-2 border-black pt-4 grid grid-cols-3 gap-4 text-xs">
          <div className="space-y-1 font-mono">
            <div className="font-bold uppercase">Total Exigible en Ruta:</div>
            <div className="text-lg font-bold">
              ${clientesHoja.reduce((s, c) => s + c.cuota, 0).toLocaleString('es-AR')}
            </div>
          </div>
          <div className="space-y-1 border-x border-gray-300 px-4">
            <div className="font-bold uppercase">Total Efectivo Rendido:</div>
            <div className="h-6 border-b border-gray-400"></div>
          </div>
          <div className="space-y-1 text-center">
            <div className="font-bold uppercase">Firma del Cobrador:</div>
            <div className="h-10 border-b border-gray-400 mt-2"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
