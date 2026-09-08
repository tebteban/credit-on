import React, { useState, useEffect, useMemo } from 'react';

import { COBRADORES_CANONICOS } from '../utils/cobradores-catalogo';

interface CobradorOpt {
  id: number;
  nombre: string;
  zona?: string;
}

const DEFAULT_COBRADORES: CobradorOpt[] = COBRADORES_CANONICOS.map((c) => ({
  id: c.id_cobrador,
  nombre: c.nombre,
  zona: c.zona,
}));

export const HojaDeRutaImprimible: React.FC = () => {
  const [cobradores, setCobradores] = useState<CobradorOpt[]>(DEFAULT_COBRADORES);
  const [cobradorSeleccionado, setCobradorSeleccionado] = useState<string>(DEFAULT_COBRADORES[0]?.nombre || 'Ariel Gómez');
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [operaciones, setOperaciones] = useState<any[]>([]);
  const [cobrosHoy, setCobrosHoy] = useState<any[]>([]);

  // Carga reactiva de datos desde localStorage
  const cargarDatos = () => {
    try {
      // 1. Cobradores dinámicos
      const rawCob = localStorage.getItem('credit_on_cobradores');
      if (rawCob) {
        const parsed = JSON.parse(rawCob);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cList: CobradorOpt[] = parsed
            .filter((c: any) => c.activo !== false)
            .map((c: any, idx: number) => ({
              id: Number(c.id_cobrador || c.id || idx + 1),
              nombre: c.nombre || `Cobrador #${idx + 1}`,
              zona: c.zona || 'Ruta General',
            }));
          if (cList.length > 0) {
            setCobradores(cList);
            if (
              cobradorSeleccionado !== 'TODOS' &&
              !cList.some((c) => c.nombre.toLowerCase() === cobradorSeleccionado.toLowerCase())
            ) {
              setCobradorSeleccionado(cList[0].nombre);
            }
          }
        }
      }

      // 2. Cartera de Operaciones
      const rawOps = localStorage.getItem('credit_on_cartera_operaciones');
      if (rawOps) {
        const parsedOps = JSON.parse(rawOps);
        if (Array.isArray(parsedOps)) {
          setOperaciones(parsedOps);
        }
      }

      // 3. Historial de cobros hoy
      const rawHist = localStorage.getItem('credit_on_historial_cobros');
      if (rawHist) {
        const parsedHist = JSON.parse(rawHist);
        if (Array.isArray(parsedHist)) {
          setCobrosHoy(parsedHist);
        }
      }
    } catch (e) {
      console.warn('Error al cargar datos reactivos en Hoja de Ruta:', e);
    }
  };

  useEffect(() => {
    cargarDatos();
    const handleStorageUpdate = () => cargarDatos();
    window.addEventListener('credit_on_storage_update', handleStorageUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.removeEventListener('credit_on_storage_update', handleStorageUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  // Clientes filtrados para la hoja de ruta
  const clientesHoja = useMemo(() => {
    if (!operaciones || operaciones.length === 0) {
      // Clientes de demostración si aún no hay base de operaciones cargada
      return [
        { orden: 1, op: 101, cliente: 'PÉREZ JUAN CARLOS', dom: 'AV. BELGRANO 1420 - CENTRO', tel: '385-4123456', tipo: 'EFECTIVO', cuota: 5000, atraso: 0, cobradoHoy: 0 },
        { orden: 2, op: 102, cliente: 'GÓMEZ MARÍA LAURA', dom: 'ROCA SUR 245 - B° CABILDO', tel: '385-6112233', tipo: 'EFECTIVO', cuota: 4000, atraso: 0, cobradoHoy: 0 },
        { orden: 3, op: 103, cliente: 'RODRÍGUEZ HUGO O.', dom: 'AV. COLÓN SUR 3100 - B° EJ. ARGENTINO', tel: '385-4889900', tipo: 'PRODUCTO', cuota: 12000, atraso: 0, cobradoHoy: 0 },
        { orden: 4, op: 104, cliente: 'BENÍTEZ CLAUDIO A.', dom: 'CALLE 12 N° 450 - B° MISHQUI MAYU', tel: '385-4771234', tipo: 'EFECTIVO', cuota: 3000, atraso: 0, cobradoHoy: 0 },
        { orden: 5, op: 105, cliente: 'BAZÁN NORMA BEATRIZ', dom: 'JUJUY 560 - B° CENTRO', tel: '385-5129988', tipo: 'PRODUCTO', cuota: 13500, atraso: 0, cobradoHoy: 0 },
        { orden: 6, op: 106, cliente: 'CORVALÁN RAMÓN E.', dom: 'PASAJE 12 CASA 44 - B° AUTONOMÍA', tel: '385-5334455', tipo: 'EFECTIVO', cuota: 6000, atraso: 0, cobradoHoy: 0 },
      ];
    }

    // Filtrar operaciones por cobrador
    const filtradas = operaciones.filter((op: any) => {
      // Ignorar operaciones con saldo 0
      if (Number(op.saldo_restante) <= 0 && (!op.cuotas_pendientes || op.cuotas_pendientes === 0)) {
        return false;
      }
      if (cobradorSeleccionado === 'TODOS') return true;

      const nomCobOp = (op.cobrador?.nombre || '').toLowerCase().trim();
      const nomCobSel = cobradorSeleccionado.toLowerCase().trim();
      return nomCobOp.includes(nomCobSel) || nomCobSel.includes(nomCobOp);
    });

    return filtradas.map((op: any, index: number) => {
      // Verificar si ya tiene cobro imputado en la fecha seleccionada
      const cobroRegistrado = cobrosHoy.find(
        (ch: any) =>
          Number(ch.nro_op) === Number(op.nro_op) &&
          (ch.fecha_hora || '').startsWith(fecha) &&
          Number(ch.monto_cobrado) > 0
      );

      // Calcular atraso
      let cuotasAtraso = 0;
      if (op.mora && typeof op.mora === 'object' && op.mora.dias_mora > 0) {
        cuotasAtraso = Math.ceil(op.mora.dias_mora / 1);
      } else if (op.cuotas && Array.isArray(op.cuotas)) {
        cuotasAtraso = op.cuotas.filter((c: any) => c.estado === 'VENCIDA').length;
      }

      return {
        orden: index + 1,
        op: op.nro_op || index + 1,
        cliente: (op.cliente?.nombre || 'CLIENTE REGISTRADO').toUpperCase(),
        dom: (op.domicilio_cobro || op.cliente?.domicilio || 'DOMICILIO REGISTRADO').toUpperCase(),
        tel: op.cliente?.telefono || '-',
        tipo: op.tipo === 'MERCADERIA' || op.tipo === 'PRODUCTO' ? 'PRODUCTO' : 'EFECTIVO',
        cuota: Number(op.importe_cuota || 0),
        atraso: cuotasAtraso,
        cobradoHoy: cobroRegistrado ? Number(cobroRegistrado.monto_cobrado) : 0,
      };
    });
  }, [operaciones, cobradorSeleccionado, cobrosHoy, fecha]);

  const cobradorInfoActivo = useMemo(() => {
    if (cobradorSeleccionado === 'TODOS') {
      return { nombre: 'TODOS LOS COBRADORES', zona: 'CONSOLIDADO GENERAL' };
    }
    const cob = cobradores.find((c) => c.nombre === cobradorSeleccionado);
    return cob ? { nombre: cob.nombre, zona: cob.zona || 'Ruta de Cobranza' } : { nombre: cobradorSeleccionado, zona: 'Ruta de Cobranza' };
  }, [cobradores, cobradorSeleccionado]);

  const totalExigible = useMemo(() => {
    return clientesHoja.reduce((acc, c) => acc + (c.cuota || 0), 0);
  }, [clientesHoja]);

  const totalYaCobradoHoy = useMemo(() => {
    return clientesHoja.reduce((acc, c) => acc + (c.cobradoHoy || 0), 0);
  }, [clientesHoja]);

  const handleImprimir = () => {
    // Abrir cuadro de diálogo nativo de impresión / guardar como PDF
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Barra de Controles (Oculta al Imprimir) */}
      <div className="no-print bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Emisión de Planilla Física de Cobranza</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Datos en Vivo
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Planilla A4 oficial para contingencia en calle, corte de energía o falta de conectividad 4G.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Selector Dinámico de Cobradores */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-slate-600">Cobrador:</label>
            <select
              value={cobradorSeleccionado}
              onChange={(e) => setCobradorSeleccionado(e.target.value)}
              className="bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white text-sm font-semibold text-slate-800 px-3 py-2 rounded-xl focus:outline-none transition shadow-sm"
            >
              <option value="TODOS">TODOS LOS COBRADORES (Consolidado)</option>
              {cobradores.map((c) => (
                <option key={c.id} value={c.nombre}>
                  {c.nombre} {c.zona ? `(${c.zona})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-slate-600">Fecha:</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white text-sm font-medium text-slate-800 px-3 py-2 rounded-xl focus:outline-none transition shadow-sm"
            />
          </div>

          {/* Botón Imprimir */}
          <button
            onClick={handleImprimir}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition"
            title="Abrir cuadro de diálogo para imprimir o guardar como PDF"
          >
            <span className="material-symbols-outlined text-[20px]">print</span>
            Imprimir Planilla A4
          </button>
        </div>
      </div>

      {/* DOCUMENTO IMPRIMIBLE A4 */}
      <div className="bg-white text-black p-8 rounded-2xl shadow-md max-w-4xl mx-auto font-sans border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full">
        <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-end">
          <div>
            <div className="text-2xl font-black tracking-tight">CREDIT-ON</div>
            <div className="text-xs uppercase tracking-wider font-semibold text-gray-700">
              Equipamiento Comercial y Préstamos Diarios
            </div>
            <div className="text-xs text-gray-500">
              Santiago del Estero — Hoja de Ruta Oficial de Cobranza en Calle
            </div>
          </div>
          <div className="text-right text-xs space-y-1 font-mono">
            <div><strong>COBRADOR:</strong> {cobradorInfoActivo.nombre.toUpperCase()}</div>
            <div><strong>ZONA:</strong> {cobradorInfoActivo.zona.toUpperCase()}</div>
            <div><strong>FECHA:</strong> {fecha}</div>
            <div><strong>CLIENTES EN RUTA:</strong> {clientesHoja.length}</div>
          </div>
        </div>

        {clientesHoja.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm border border-dashed border-gray-300 rounded-xl my-4">
            No se registran clientes activos asignados para este cobrador en la cartera actual.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse border border-gray-400">
            <thead>
              <tr className="bg-gray-100 text-gray-900 border-b border-gray-400">
                <th className="p-2 border-r border-gray-400 text-center w-8">#</th>
                <th className="p-2 border-r border-gray-400 w-12">OP</th>
                <th className="p-2 border-r border-gray-400">Cliente / Razón Social</th>
                <th className="p-2 border-r border-gray-400">Domicilio de Cobro</th>
                <th className="p-2 border-r border-gray-400">Teléfono</th>
                <th className="p-2 border-r border-gray-400 text-center">Tipo</th>
                <th className="p-2 border-r border-gray-400 text-right w-20">Cuota ($)</th>
                <th className="p-2 border-r border-gray-400 text-center w-14">Atraso</th>
                <th className="p-2 border-r border-gray-400 w-24 text-center">Cobrado ($)</th>
                <th className="p-2 text-center w-12">Firma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300 font-sans">
              {clientesHoja.map((c) => (
                <tr key={c.op} className="h-10">
                  <td className="p-2 border-r border-gray-300 text-center font-bold">{c.orden}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">#{c.op}</td>
                  <td className="p-2 border-r border-gray-300 font-bold">{c.cliente}</td>
                  <td className="p-2 border-r border-gray-300 text-[11px] leading-tight">{c.dom}</td>
                  <td className="p-2 border-r border-gray-300 text-[11px] font-mono">{c.tel}</td>
                  <td className="p-2 border-r border-gray-300 text-center text-[10px] font-bold">
                    {c.tipo === 'EFECTIVO' ? 'EFECT' : 'PROD'}
                  </td>
                  <td className="p-2 border-r border-gray-300 text-right font-mono font-bold">
                    ${c.cuota.toLocaleString('es-AR')}
                  </td>
                  <td className="p-2 border-r border-gray-300 text-center text-[10px]">
                    {c.atraso > 0 ? (
                      <span className="font-bold text-red-600">{c.atraso} cta</span>
                    ) : (
                      <span className="text-gray-400">Al día</span>
                    )}
                  </td>
                  <td className="p-2 border-r border-gray-300 bg-gray-50/50 text-center font-mono font-bold">
                    {c.cobradoHoy > 0 ? (
                      <span className="text-emerald-700">${c.cobradoHoy.toLocaleString('es-AR')}</span>
                    ) : null}
                  </td>
                  <td className="p-2 text-center border-gray-300">
                    <div className="w-5 h-5 border border-gray-300 rounded mx-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Resumen Final y Firmas Físicas (En Blanco para Firma Manual) */}
        <div className="mt-8 border-t-2 border-black pt-4 grid grid-cols-3 gap-6 text-xs">
          <div className="space-y-1 font-mono">
            <div className="font-bold uppercase text-gray-700">Total Exigible en Ruta:</div>
            <div className="text-lg font-black text-black">
              ${totalExigible.toLocaleString('es-AR')}
            </div>
            {totalYaCobradoHoy > 0 && (
              <div className="text-[11px] text-emerald-800 font-bold">
                Ya Asentado en Sistema: ${totalYaCobradoHoy.toLocaleString('es-AR')}
              </div>
            )}
          </div>

          <div className="space-y-1 border-x border-gray-300 px-4">
            <div className="font-bold uppercase text-gray-700">Total Efectivo Rendido:</div>
            <div className="h-7 border-b border-gray-400 mt-2"></div>
            <div className="text-[10px] text-gray-400 text-center">(Completar en arqueo de caja)</div>
          </div>

          <div className="space-y-1 text-center">
            <div className="font-bold uppercase text-gray-700">Firma del Cobrador:</div>
            <div className="h-10 border-b border-gray-400 mt-2"></div>
            <div className="text-[10px] text-gray-400">{cobradorInfoActivo.nombre}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
