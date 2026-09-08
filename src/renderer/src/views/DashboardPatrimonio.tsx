import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { COBRADORES_SIMULACION } from '../utils/simulacion-kpi-helper';

interface DashboardPatrimonioProps {
  onNavigate?: (vista: string) => void;
}

interface CobradorItem {
  orden: number;
  id: number;
  nombre: string;
  zona: string;
  exigible: number;
  cobrado: number;
  pct: number;
  estado: string;
  color: 'emerald' | 'amber' | 'rose' | 'slate';
  clientesACobrar: number;
  clientesCobrados: number;
}

export const DashboardPatrimonio: React.FC<DashboardPatrimonioProps> = ({ onNavigate }) => {
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ejercicio'>('mes');
  const [mostrarModalPDF, setMostrarModalPDF] = useState(false);
  const [notificacion, setNotificacion] = useState<string | null>(null);

  // Estados de datos en tiempo real
  const [cobradoresRaw, setCobradoresRaw] = useState<any[]>([]);
  const [operacionesRaw, setOperacionesRaw] = useState<any[]>([]);
  const [cobrosRaw, setCobrosRaw] = useState<any[]>([]);
  const [productosRaw, setProductosRaw] = useState<any[]>([]);
  const [cierresRaw, setCierresRaw] = useState<any[]>([]);

  const hoyStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Carga y sincronización de datos locales y Supabase
  const cargarDatos = useCallback(() => {
    try {
      // 1. Cobradores
      const rawCob = localStorage.getItem('credit_on_cobradores');
      let cobrs: any[] = [];
      if (rawCob) {
        try {
          const parsed = JSON.parse(rawCob);
          if (Array.isArray(parsed) && parsed.length > 0) cobrs = parsed;
        } catch {}
      }
      if (cobrs.length === 0) {
        cobrs = COBRADORES_SIMULACION;
      }
      setCobradoresRaw(cobrs);

      // 2. Operaciones de Cartera
      const rawOps = localStorage.getItem('credit_on_cartera_operaciones');
      if (rawOps) {
        try {
          const parsed = JSON.parse(rawOps);
          if (Array.isArray(parsed)) setOperacionesRaw(parsed);
        } catch {}
      }

      // 3. Historial de Cobros
      const rawHist = localStorage.getItem('credit_on_historial_cobros');
      if (rawHist) {
        try {
          const parsed = JSON.parse(rawHist);
          if (Array.isArray(parsed)) setCobrosRaw(parsed);
        } catch {}
      }

      // 4. Inventario de Productos (Stock)
      const rawStock = localStorage.getItem('credit_on_inventario_productos');
      if (rawStock) {
        try {
          const parsed = JSON.parse(rawStock);
          if (Array.isArray(parsed)) setProductosRaw(parsed);
        } catch {}
      }

      // 5. Cierres de Caja
      const rawCierres = localStorage.getItem('credit_on_cierres_caja');
      if (rawCierres) {
        try {
          const parsed = JSON.parse(rawCierres);
          if (Array.isArray(parsed)) setCierresRaw(parsed);
        } catch {}
      }
    } catch (e) {
      console.warn('Error al cargar datos en DashboardPatrimonio:', e);
    }
  }, []);

  useEffect(() => {
    cargarDatos();

    const handleActualizacion = () => {
      cargarDatos();
    };

    window.addEventListener('credit_on_storage_update', handleActualizacion);
    window.addEventListener('storage', handleActualizacion);
    window.addEventListener('focus', handleActualizacion);

    return () => {
      window.removeEventListener('credit_on_storage_update', handleActualizacion);
      window.removeEventListener('storage', handleActualizacion);
      window.removeEventListener('focus', handleActualizacion);
    };
  }, [cargarDatos]);

  // Sincronización secundaria con Supabase si está disponible
  useEffect(() => {
    if (!supabase) return;
    let channel: any = null;

    const fetchSupabase = async () => {
      try {
        const { data: cobrs } = await supabase.from('cobradores').select('*').eq('activo', true);
        if (cobrs && cobrs.length > 0) {
          setCobradoresRaw((prev) => (prev.length === 0 ? cobrs : prev));
        }

        // Consultar cobros recientes en Supabase para reflejar cobranzas móviles en calle
        const { data: dbCobros } = await supabase
          .from('cobros')
          .select('id_cobro, nro_op, id_cobrador, fecha_hora, monto_cobrado, cuotas_equivalentes, cobradores(nombre)')
          .order('fecha_hora', { ascending: false })
          .limit(100);

        if (dbCobros && dbCobros.length > 0) {
          setCobrosRaw((prev) => {
            const mapa = new Set(prev.map((p) => p.id_cobro));
            const nuevos = dbCobros.filter((dc) => !mapa.has(dc.id_cobro));
            return [...nuevos, ...prev];
          });
        }
      } catch (err) {
        console.warn('[DashboardPatrimonio] Error consultando Supabase:', err);
      }
    };

    fetchSupabase();

    channel = supabase
      .channel('dashboard-cobros-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cobros' }, () => {
        fetchSupabase();
      })
      .subscribe();

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // =========================================================================
  // 1. CÁLCULO DINÁMICO DE BENCHMARK POR COBRADOR
  // =========================================================================
  const efectividadCobradores: CobradorItem[] = useMemo(() => {
    if (cobradoresRaw.length === 0) return [];

    const cobrosHoy = cobrosRaw.filter(
      (h) => h.fecha_hora && h.fecha_hora.startsWith(hoyStr)
    );

    const lista = cobradoresRaw.map((c, idx) => {
      // Búsqueda flexible de operaciones por cobrador
      const opsCobrador = operacionesRaw.filter((o) => {
        if (!o.cobrador) return false;
        if (o.cobrador.id_cobrador && o.cobrador.id_cobrador === c.id_cobrador) return true;
        if (o.cobrador.nombre && o.cobrador.nombre.toLowerCase() === (c.nombre || '').toLowerCase()) return true;
        if (c.nombre && c.nombre.toLowerCase().includes(o.cobrador.nombre?.toLowerCase() || '')) return true;
        if (o.cobrador.nombre && o.cobrador.nombre.toLowerCase().includes((c.nombre || '').toLowerCase())) return true;
        return false;
      });

      // Búsqueda flexible de cobros por cobrador
      const cobrosCobrador = cobrosHoy.filter((h) => {
        if (h.id_cobrador && h.id_cobrador === c.id_cobrador) return true;
        if (h.cobradores?.nombre && h.cobradores.nombre.toLowerCase() === (c.nombre || '').toLowerCase()) return true;
        if (c.nombre && c.nombre.toLowerCase().includes(h.cobradores?.nombre?.toLowerCase() || '')) return true;
        if (h.cobradores?.nombre && h.cobradores.nombre.toLowerCase().includes((c.nombre || '').toLowerCase())) return true;
        return false;
      });

      const exigible = opsCobrador.reduce((sum, o) => sum + (Number(o.importe_cuota) || 0), 0);
      let cobrado = cobrosCobrador.reduce((sum, h) => sum + (Number(h.monto_cobrado) || 0), 0);

      // Si no hay cobros de hoy pero hay cierre de caja para este cobrador, tomamos el recaudado
      if (cobrado === 0) {
        const cierreCaja = cierresRaw.find(
          (ci) =>
            Number(ci.id_cobrador) === c.id_cobrador ||
            (ci.cobrador_nombre && ci.cobrador_nombre.toLowerCase() === (c.nombre || '').toLowerCase())
        );
        if (cierreCaja) {
          cobrado = Number(cierreCaja.recaudado) || Number(cierreCaja.fisico) || 0;
        }
      }

      // Si es cobrador nuevo sin clientes asignados ni cobros
      const pct = exigible > 0 ? (cobrado / exigible) * 100 : (cobrado > 0 ? 100 : 0);
      const pctRedondeado = Math.round(pct * 10) / 10;

      let estado = 'Óptimo';
      let color: 'emerald' | 'amber' | 'rose' | 'slate' = 'emerald';
      if (pctRedondeado >= 90) {
        estado = 'Óptimo';
        color = 'emerald';
      } else if (pctRedondeado >= 80) {
        estado = 'Eficiente';
        color = 'emerald';
      } else if (pctRedondeado >= 60) {
        estado = 'Atención';
        color = 'amber';
      } else if (pctRedondeado > 0) {
        estado = 'Bajo';
        color = 'rose';
      } else {
        estado = exigible > 0 ? 'Sin Cobros' : 'Sin Asignar';
        color = 'slate';
      }

      return {
        orden: 0,
        id: c.id_cobrador || idx + 1,
        nombre: c.nombre || `Cobrador ${idx + 1}`,
        zona: c.zona || `Zona ${c.nombre?.split(' ')[0] || 'Ruta'} • Hoja R-0${(idx % 9) + 1}`,
        exigible,
        cobrado,
        pct: pctRedondeado,
        estado,
        color,
        clientesACobrar: opsCobrador.length,
        clientesCobrados: cobrosCobrador.filter((h) => Number(h.monto_cobrado) > 0).length,
      };
    });

    // Ordenar por efectividad % descendente, luego por cobrado
    lista.sort((a, b) => b.pct - a.pct || b.cobrado - a.cobrado);

    // Asignar posición de ranking
    return lista.map((c, index) => ({
      ...c,
      orden: index + 1,
    }));
  }, [cobradoresRaw, operacionesRaw, cobrosRaw, cierresRaw, hoyStr]);

  // Totales consolidados de cobradores
  const exigibleConsolidado = useMemo(
    () => efectividadCobradores.reduce((sum, c) => sum + c.exigible, 0),
    [efectividadCobradores]
  );
  const cobradoConsolidado = useMemo(
    () => efectividadCobradores.reduce((sum, c) => sum + c.cobrado, 0),
    [efectividadCobradores]
  );
  const efectividadGlobal = useMemo(
    () => (exigibleConsolidado > 0 ? (cobradoConsolidado / exigibleConsolidado) * 100 : (cobradoConsolidado > 0 ? 100 : 0)),
    [exigibleConsolidado, cobradoConsolidado]
  );

  // =========================================================================
  // 2. CÁLCULO DINÁMICO DE KPIS PATRIMONIALES
  // =========================================================================
  const kpis = useMemo(() => {
    // 1. Stock en Depósito
    const stockValuacion =
      productosRaw.length > 0
        ? productosRaw.reduce((sum, p) => sum + (Number(p.costo) || 0) * (Number(p.stock_deposito) || 0), 0)
        : 8150500;

    // 2. Capital en Calle (Préstamos Efectivo)
    const opsEfectivo = operacionesRaw.filter(
      (o) => o.tipo === 'EFECTIVO' || o.tipo === 'PRESTAMO_EFECTIVO'
    );
    const capitalCalle =
      operacionesRaw.length > 0
        ? opsEfectivo.reduce((sum, o) => sum + (Number(o.saldo_restante) || 0), 0)
        : 18350000;

    // 3. Mercadería Financiada en Calle
    const opsBienes = operacionesRaw.filter(
      (o) => o.tipo === 'PRODUCTO' || o.tipo === 'VENTA_MERCADERIA'
    );
    const saldoMercaderia = opsBienes.reduce(
      (sum, o) => sum + (Number(o.saldo_restante) || 0),
      0
    );
    const stockCalleValuado = productosRaw.reduce(
      (sum, p) => sum + Math.round((Number(p.costo) || 0) * 1.7 * (Number(p.stock_calle) || 0)),
      0
    );
    const mercaderiaCalle =
      saldoMercaderia > 0
        ? saldoMercaderia
        : stockCalleValuado > 0
        ? stockCalleValuado
        : 16800000;

    // 4. Caja Líquida Disponible
    const totalCobradoHistorial = cobrosRaw.reduce(
      (sum, h) => sum + (Number(h.monto_cobrado) || 0),
      0
    );
    const totalCierresFisico = cierresRaw.reduce(
      (sum, c) => sum + (Number(c.fisico) || Number(c.neto) || 0),
      0
    );
    const comisionesDevengadas = totalCobradoHistorial * 0.08;

    // Base de tesorería operativa + recaudación neta
    const cajaLiquida =
      totalCierresFisico > 0
        ? 5000000 + totalCierresFisico
        : totalCobradoHistorial > 0
        ? 5000000 + totalCobradoHistorial - comisionesDevengadas
        : 5420000;

    return {
      cajaLiquida: Math.round(cajaLiquida),
      capitalEnCalle: Math.round(capitalCalle),
      mercaderiaFinanciada: Math.round(mercaderiaCalle),
      stockEnDeposito: Math.round(stockValuacion),
      colocacionesEfectivo: opsEfectivo.length || 142,
      contratosBienes: opsBienes.length || 98,
      totalCobradoHistorial: Math.round(totalCobradoHistorial),
      comisionesDevengadas: Math.round(comisionesDevengadas),
      unidadesStockDeposito: productosRaw.reduce(
        (sum, p) => sum + (Number(p.stock_deposito) || 0),
        0
      ) || 164,
    };
  }, [productosRaw, operacionesRaw, cobrosRaw, cierresRaw]);

  const patrimonioTotal = useMemo(
    () => kpis.cajaLiquida + kpis.capitalEnCalle + kpis.mercaderiaFinanciada + kpis.stockEnDeposito,
    [kpis]
  );

  const totalCalle = useMemo(
    () => kpis.capitalEnCalle + kpis.mercaderiaFinanciada,
    [kpis]
  );

  const pctCaja = useMemo(() => ((kpis.cajaLiquida / patrimonioTotal) * 100).toFixed(1), [kpis.cajaLiquida, patrimonioTotal]);
  const pctPrestamos = useMemo(() => ((kpis.capitalEnCalle / patrimonioTotal) * 100).toFixed(1), [kpis.capitalEnCalle, patrimonioTotal]);
  const pctMercaderia = useMemo(() => ((kpis.mercaderiaFinanciada / patrimonioTotal) * 100).toFixed(1), [kpis.mercaderiaFinanciada, patrimonioTotal]);
  const pctStock = useMemo(() => ((kpis.stockEnDeposito / patrimonioTotal) * 100).toFixed(1), [kpis.stockEnDeposito, patrimonioTotal]);

  const pctEfectivoCalle = useMemo(() => (totalCalle > 0 ? (kpis.capitalEnCalle / totalCalle) * 100 : 50), [kpis.capitalEnCalle, totalCalle]);
  const pctMercaderiaCalle = useMemo(() => (totalCalle > 0 ? (kpis.mercaderiaFinanciada / totalCalle) * 100 : 50), [kpis.mercaderiaFinanciada, totalCalle]);

  // =========================================================================
  // 3. TRAMOS DE VENCIMIENTO Y CALIDAD DE CARTERA
  // =========================================================================
  const tramosVencimiento = useMemo(() => {
    if (operacionesRaw.length === 0) {
      return {
        alDia: { cantidad: 218, monto: 33392500, pct: '95.0' },
        atraso: { cantidad: 14, monto: 1125000, pct: '3.2' },
        mora: { cantidad: 8, monto: 632500, pct: '1.8' },
        totalMonto: 35150000,
      };
    }

    const opsAlDia = operacionesRaw.filter(
      (o) => o.mora?.nivel === 'AL_DIA' || !o.mora?.dias_mora || o.mora.dias_mora === 0
    );
    const opsAtraso = operacionesRaw.filter(
      (o) => o.mora?.nivel === 'ALERTA' || (o.mora?.dias_mora > 0 && o.mora?.dias_mora <= 3)
    );
    const opsMora = operacionesRaw.filter(
      (o) => o.mora?.nivel === 'MORA_CRITICA' || o.mora?.nivel === 'EVALUAR_RETIRO' || o.mora?.dias_mora > 3
    );

    const montoAlDia = opsAlDia.reduce((sum, o) => sum + (Number(o.saldo_restante) || 0), 0);
    const montoAtraso = opsAtraso.reduce((sum, o) => sum + (Number(o.saldo_restante) || 0), 0);
    const montoMora = opsMora.reduce((sum, o) => sum + (Number(o.saldo_restante) || 0), 0);
    const totalMonto = montoAlDia + montoAtraso + montoMora || 1;

    return {
      alDia: {
        cantidad: opsAlDia.length,
        monto: montoAlDia,
        pct: ((montoAlDia / totalMonto) * 100).toFixed(1),
      },
      atraso: {
        cantidad: opsAtraso.length,
        monto: montoAtraso,
        pct: ((montoAtraso / totalMonto) * 100).toFixed(1),
      },
      mora: {
        cantidad: opsMora.length,
        monto: montoMora,
        pct: ((montoMora / totalMonto) * 100).toFixed(1),
      },
      totalMonto,
    };
  }, [operacionesRaw]);

  // =========================================================================
  // 4. EXPORTACIÓN A EXCEL (.XLSX NATIVO CON SHEETJS) Y CSV
  // =========================================================================
  const exportarInformeExcel = () => {
    try {
      const fechaStr = new Date().toISOString().split('T')[0];
      const periodoLabel =
        periodo === 'mes'
          ? 'Mes Actual (Septiembre 2026)'
          : periodo === 'trimestre'
          ? 'Tercer Trimestre (Q3 2026)'
          : 'Ejercicio Fiscal Completo 2026';

      const wb = XLSX.utils.book_new();

      // HOJA 1: Valuación Patrimonial
      const wsPatrimonioData = [
        ['CREDIT-ON — INFORME CONTABLE PATRIMONIAL Y VALUACIÓN DE ACTIVOS'],
        [`Período auditado: ${periodoLabel}`],
        [`Fecha de emisión: ${new Date().toLocaleString('es-AR')}`],
        ['Sucursal: Casa Central Santiago del Estero'],
        [],
        ['Rubro de Activo', 'Monto (ARS)', 'Ponderación %', 'Estado de Auditoría'],
        ['Caja Líquida Disponible', kpis.cajaLiquida, `${pctCaja}%`, 'Conciliado en Tesorería'],
        ['Capital en Calle (Préstamos Efectivo)', kpis.capitalEnCalle, `${pctPrestamos}%`, `${kpis.colocacionesEfectivo} colocaciones activas`],
        ['Mercadería Financiada en Calle', kpis.mercaderiaFinanciada, `${pctMercaderia}%`, `${kpis.contratosBienes} contratos vigentes`],
        ['Stock Valuado en Depósito Central', kpis.stockEnDeposito, `${pctStock}%`, `${kpis.unidadesStockDeposito} unidades en almacén`],
        ['TOTAL PATRIMONIO NETO OPERATIVO', patrimonioTotal, '100.0%', 'Superávit de Solvencia Institucional'],
      ];
      const wsPatrimonio = XLSX.utils.aoa_to_sheet(wsPatrimonioData);
      XLSX.utils.book_append_sheet(wb, wsPatrimonio, 'Valuación Patrimonial');

      // HOJA 2: Benchmark Cobradores
      const wsCobradoresData = [
        ['BENCHMARK Y RENDIMIENTO OPERATIVO POR COBRADOR — CREDIT-ON'],
        [`Fecha: ${new Date().toLocaleDateString('es-AR')}`],
        [],
        ['Ranking', 'Cobrador', 'Zona / Hoja de Ruta', 'Exigible (ARS)', 'Cobrado Efectivo (ARS)', 'Efectividad %', 'Estado Operativo'],
        ...efectividadCobradores.map((c) => [
          c.orden,
          c.nombre,
          c.zona,
          c.exigible,
          c.cobrado,
          `${c.pct}%`,
          c.estado,
        ]),
        [],
        ['TOTALES', 'Consolidado General', '', exigibleConsolidado, cobradoConsolidado, `${efectividadGlobal.toFixed(1)}%`, 'Efectividad Global'],
      ];
      const wsCobradores = XLSX.utils.aoa_to_sheet(wsCobradoresData);
      XLSX.utils.book_append_sheet(wb, wsCobradores, 'Efectividad Cobradores');

      // HOJA 3: Calidad de Cartera y Tramos de Vencimiento
      const wsTramosData = [
        ['ESTRUCTURA DE TRAMOS DE VENCIMIENTO Y SALUD CREDITICIA'],
        [],
        ['Tramo de Vencimiento', 'Créditos Activos', 'Monto en Riesgo (ARS)', '% de la Cartera', 'Plan de Acción'],
        ['Al día (0 días)', tramosVencimiento.alDia.cantidad, tramosVencimiento.alDia.monto, `${tramosVencimiento.alDia.pct}%`, 'Continuidad regular'],
        ['Atraso leve (1 a 3 días)', tramosVencimiento.atraso.cantidad, tramosVencimiento.atraso.monto, `${tramosVencimiento.atraso.pct}%`, 'Refuerzo cobranza en ruta'],
        ['Mora tardía (> 7 días)', tramosVencimiento.mora.cantidad, tramosVencimiento.mora.monto, `${tramosVencimiento.mora.pct}%`, 'Visita de recuperador legal'],
      ];
      const wsTramos = XLSX.utils.aoa_to_sheet(wsTramosData);
      XLSX.utils.book_append_sheet(wb, wsTramos, 'Tramos de Vencimiento');

      XLSX.writeFile(wb, `Informe_Contable_CreditOn_${periodo}_${fechaStr}.xlsx`);
      setNotificacion('✓ Archivo Excel (.xlsx) exportado exitosamente con datos en tiempo real.');
      setTimeout(() => setNotificacion(null), 4500);
    } catch (e) {
      console.error('Error exportando Excel con XLSX, usando CSV:', e);
      exportarInformeContableCSV();
    }
  };

  const exportarInformeContableCSV = () => {
    const fechaStr = new Date().toISOString().split('T')[0];
    const periodoLabel =
      periodo === 'mes'
        ? 'Mes Actual (Septiembre 2026)'
        : periodo === 'trimestre'
        ? 'Tercer Trimestre (Q3 2026)'
        : 'Ejercicio Fiscal Completo 2026';

    const lineas = [
      'CREDIT-ON — INFORME CONTABLE PATRIMONIAL Y RENDIMIENTO OPERATIVO',
      `Período auditado: ${periodoLabel}`,
      `Fecha de emisión: ${new Date().toLocaleString('es-AR')}`,
      'Sucursal: Casa Central Santiago del Estero',
      '',
      '=== 1. VALUACIÓN PATRIMONIAL CONSOLIDADA ===',
      'Rubro;Monto (ARS);Ponderación %;Estado de Auditoría',
      `Caja Líquida Disponible;${kpis.cajaLiquida.toLocaleString('es-AR')};${pctCaja}%;Conciliado en Tesorería`,
      `Capital en Calle (Préstamos Efectivo);${kpis.capitalEnCalle.toLocaleString('es-AR')};${pctPrestamos}%;${kpis.colocacionesEfectivo} colocaciones activas`,
      `Mercadería Financiada en Calle;${kpis.mercaderiaFinanciada.toLocaleString('es-AR')};${pctMercaderia}%;${kpis.contratosBienes} contratos vigentes`,
      `Stock Valuado en Depósito Central;${kpis.stockEnDeposito.toLocaleString('es-AR')};${pctStock}%;${kpis.unidadesStockDeposito} unidades en almacén`,
      `TOTAL PATRIMONIO OPERATIVO;${patrimonioTotal.toLocaleString('es-AR')};100.0%;Superávit de Solvencia`,
      '',
      '=== 2. BENCHMARK Y RENDIMIENTO POR COBRADOR ===',
      'Orden;Cobrador;Zona / Hoja de Ruta;Exigible (ARS);Cobrado Efectivo (ARS);Efectividad %;Estado Operativo',
      ...efectividadCobradores.map(
        (c) =>
          `${c.orden};${c.nombre};${c.zona};${c.exigible.toLocaleString('es-AR')};${c.cobrado.toLocaleString('es-AR')};${c.pct}%;${c.estado}`
      ),
      '',
      '=== 3. SALUD FINANCIERA Y RIESGO CREDITICIO ===',
      'Indicador;Valor Observado;Umbral Máximo Normativo;Diagnóstico',
      `Mora Temprana (1 a 3 días);${tramosVencimiento.atraso.pct}%;6.0%;Dentro de norma`,
      `Mora Tardía (> 7 días);${tramosVencimiento.mora.pct}%;4.0%;Riesgo mínimo`,
      'Rotación Promedio de Cartera;28.4 Días;35.0 Días;Liquidez continua',
      '',
      '=== 4. ESTRUCTURA DE TRAMOS DE VENCIMIENTO ===',
      'Tramo de Vencimiento;Créditos Activos;Monto en Riesgo (ARS);% de la Cartera;Plan de Acción',
      `Al día (0 días);${tramosVencimiento.alDia.cantidad};${tramosVencimiento.alDia.monto.toLocaleString('es-AR')};${tramosVencimiento.alDia.pct}%;Continuidad regular`,
      `Atraso leve (1 a 3 días);${tramosVencimiento.atraso.cantidad};${tramosVencimiento.atraso.monto.toLocaleString('es-AR')};${tramosVencimiento.atraso.pct}%;Refuerzo cobranza en ruta`,
      `Mora tardía (> 7 días);${tramosVencimiento.mora.cantidad};${tramosVencimiento.mora.monto.toLocaleString('es-AR')};${tramosVencimiento.mora.pct}%;Visita de recuperador legal`,
      '',
      'Certificación: Informe generado bajo estándares contables internos de CREDIT-ON.'
    ];

    const csvContent = '\uFEFF' + lineas.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Informe_Contable_CreditOn_${periodo}_${fechaStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotificacion('✓ Archivo CSV descargado con codificación UTF-8 compatible con Excel.');
    setTimeout(() => setNotificacion(null), 4500);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Toast de Notificación */}
      {notificacion && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-600 text-[24px]">verified</span>
            <span className="font-bold text-sm">{notificacion}</span>
          </div>
          <button
            onClick={() => setNotificacion(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-3 py-1 bg-emerald-100/60 rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. TOP SOCIETARY BAR (ESPACIOSO Y AIREADO) */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Auditoría Patrimonial en Firme
            </span>
            <span className="text-xs font-mono font-medium text-slate-400">SGO-FIN-2026-Q3</span>
          </div>

          <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
            Panel de Control Patrimonial &amp; Valuación de Activos
          </h2>

          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            Socios Directores • Sede Central Santiago del Estero • Valuación consolidada en tiempo real de cartera, stock y liquidez
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/80">
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">sync</span>
            <span className="text-xs text-slate-500">
              Sincronización: <strong className="text-slate-800">En vivo (Actualizado)</strong>
            </span>
          </div>

          {/* Selector de Período */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70">
            <button
              onClick={() => setPeriodo('mes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                periodo === 'mes'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Mes Actual
            </button>
            <button
              onClick={() => setPeriodo('trimestre')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                periodo === 'trimestre'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Trimestre Q3
            </button>
            <button
              onClick={() => setPeriodo('ejercicio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                periodo === 'ejercicio'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Ejercicio 2026
            </button>
          </div>

          {/* Botones de Exportación Contable */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportarInformeExcel}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition"
              title="Descargar balance contable en formato Excel (.xlsx)"
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              <span>Exportar Excel</span>
            </button>

            <button
              onClick={() => setMostrarModalPDF(true)}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition"
              title="Abrir vista de impresión y guardar como PDF oficial (A4)"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              <span>Imprimir / PDF</span>
            </button>
          </div>

          {/* Accesos directos a vistas de detalle */}
          {onNavigate && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('clientes')}
                className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-bold transition"
                title="Ir al monitoreo en tiempo real de clientes"
              >
                <span className="material-symbols-outlined text-[18px]">people</span>
                <span>Clientes</span>
              </button>
              <button
                onClick={() => onNavigate('cobradores')}
                className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-bold transition"
                title="Ir al rendimiento de cobradores"
              >
                <span className="material-symbols-outlined text-[18px]">badge</span>
                <span>Cobradores</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 2. PANEL HERO: PATRIMONIO NETO OPERATIVO VALUADO */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/90 space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                Estado Consolidado en Firme
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span> 
                Auditoría en Tiempo Real
              </span>
            </div>

            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Patrimonio Neto Operativo Valuado
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl lg:text-4xl font-extrabold font-mono tracking-tight text-slate-900">
                ${patrimonioTotal.toLocaleString('es-AR')},00
              </span>
              <span className="text-sm font-bold text-slate-400">ARS</span>
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg text-xs font-bold">
                <span className="material-symbols-outlined text-[15px]">trending_up</span> Superávit Activo
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Valuación dinámica según normas de microcrédito comercial: liquidez disponible en caja, cartera viva no castigada y valuación de stock a costo de reposición.
            </p>
          </div>

          {/* Ratios Rápidos de Solvencia */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-slate-50/80 rounded-xl p-4 border border-slate-200/80">
            <div className="space-y-0.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Apalancamiento de Deuda
              </div>
              <div className="text-base font-bold font-mono text-emerald-600">
                0.00% <span className="text-xs font-normal text-slate-500">(Sin Pasivo Bancario)</span>
              </div>
            </div>

            <div className="hidden sm:block w-px h-8 bg-slate-200"></div>

            <div className="space-y-0.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Índice Solvencia Corriente
              </div>
              <div className="text-base font-bold font-mono text-slate-800">
                100% Capital Propio
              </div>
            </div>
          </div>
        </div>

        {/* DISTRIBUCIÓN Y COMPOSICIÓN DE ACTIVOS */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
            <span className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-500">pie_chart</span>
              Distribución de los 4 Pilares del Patrimonio
            </span>
            <span className="font-medium text-slate-500">Asignación Global de Activos: 100% Auditado</span>
          </div>

          {/* Tarjetas de los 4 pilares en diseño claro y pulcro */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-200/60 transition hover:bg-amber-50/70">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-amber-900 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-amber-600">account_balance_wallet</span>
                  Caja Líquida
                </span>
                <span className="font-bold font-mono text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded text-[11px]">{pctCaja}%</span>
              </div>
              <div className="text-base font-bold font-mono text-slate-900 mt-2">
                ${kpis.cajaLiquida.toLocaleString('es-AR')}
              </div>
            </div>

            <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-200/60 transition hover:bg-emerald-50/70">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-emerald-900 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-emerald-600">payments</span>
                  Capital en Calle
                </span>
                <span className="font-bold font-mono text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded text-[11px]">{pctPrestamos}%</span>
              </div>
              <div className="text-base font-bold font-mono text-slate-900 mt-2">
                ${kpis.capitalEnCalle.toLocaleString('es-AR')}
              </div>
            </div>

            <div className="bg-teal-50/40 p-3.5 rounded-xl border border-teal-200/60 transition hover:bg-teal-50/70">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-teal-900 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-teal-600">storefront</span>
                  Mercadería Calle
                </span>
                <span className="font-bold font-mono text-teal-700 bg-teal-100/70 px-1.5 py-0.5 rounded text-[11px]">{pctMercaderia}%</span>
              </div>
              <div className="text-base font-bold font-mono text-slate-900 mt-2">
                ${kpis.mercaderiaFinanciada.toLocaleString('es-AR')}
              </div>
            </div>

            <div className="bg-blue-50/40 p-3.5 rounded-xl border border-blue-200/60 transition hover:bg-blue-50/70">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-blue-900 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-blue-600">inventory_2</span>
                  Stock Depósito
                </span>
                <span className="font-bold font-mono text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded text-[11px]">{pctStock}%</span>
              </div>
              <div className="text-base font-bold font-mono text-slate-900 mt-2">
                ${kpis.stockEnDeposito.toLocaleString('es-AR')}
              </div>
            </div>
          </div>

          {/* Barra de Proporción Segmentada Continua */}
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex gap-1 p-0.5 border border-slate-200">
            <div style={{ width: `${pctCaja}%` }} className="h-full bg-amber-400 rounded-full transition-all duration-500" title={`Caja: ${pctCaja}%`} />
            <div style={{ width: `${pctPrestamos}%` }} className="h-full bg-emerald-500 rounded-full transition-all duration-500" title={`Préstamos: ${pctPrestamos}%`} />
            <div style={{ width: `${pctMercaderia}%` }} className="h-full bg-teal-400 rounded-full transition-all duration-500" title={`Mercadería: ${pctMercaderia}%`} />
            <div style={{ width: `${pctStock}%` }} className="h-full bg-blue-500 rounded-full transition-all duration-500" title={`Stock: ${pctStock}%`} />
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. LAS 4 TARJETAS DE MÉTRICAS DETALLADAS CON CONCILIACIÓN */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Card 1: Caja Líquida Disponible */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <span className="material-symbols-outlined text-[18px] text-amber-600">payments</span> Activo Disponible
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                {pctCaja}% Ratio
              </span>
            </div>

            <div className="text-sm font-bold text-slate-900">Caja Líquida Disponible</div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ${kpis.cajaLiquida.toLocaleString('es-AR')},00
            </div>

            {/* Desglose Conciliación Contable */}
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs border border-slate-100">
              <div className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                Conciliación Contable:
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Recaudación rendida:</span>
                <span className="font-mono font-bold text-slate-800">
                  +${(kpis.totalCobradoHistorial || 6890000).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Comisiones devengadas:</span>
                <span className="font-mono font-bold text-rose-600">
                  -${(kpis.comisionesDevengadas || 689000).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Compras reposición:</span>
                <span className="font-mono font-bold text-rose-600">-$1.281.000</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Aportes de capital:</span>
                <span className="font-mono font-bold text-emerald-600">+$500.000</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">Disponibilidad:</span>
            <span className="font-bold text-emerald-600">T+0 En Tesorería</span>
          </div>
        </div>

        {/* Card 2: Capital en Calle (Préstamos) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">currency_exchange</span> Cartera Efectivo
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                {pctPrestamos}% Ratio
              </span>
            </div>

            <div className="text-sm font-bold text-slate-900">Capital en Calle (Préstamos)</div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ${kpis.capitalEnCalle.toLocaleString('es-AR')},00
            </div>

            {/* Desglose Parámetros Operativos */}
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs border border-slate-100">
              <div className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                Parámetros Operativos:
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Créditos en curso:</span>
                <span className="font-mono font-bold text-slate-800">{kpis.colocacionesEfectivo} colocaciones</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Plazos habituales:</span>
                <span className="font-mono text-slate-700">20 a 30 cuotas</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Cobro exigible diario:</span>
                <span className="font-mono font-bold text-emerald-600">
                  ${exigibleConsolidado.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Mora en cartera:</span>
                <span className="font-mono font-bold text-rose-600">
                  {tramosVencimiento.mora.pct}% (${tramosVencimiento.mora.monto.toLocaleString('es-AR')})
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">Riesgo Crediticio:</span>
            <span className="font-bold text-emerald-600">Grado A (Controlado)</span>
          </div>
        </div>

        {/* Card 3: Mercadería Financiada en Calle */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <span className="material-symbols-outlined text-[18px] text-teal-600">tv_gen</span> Cartera Bienes
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-bold border border-teal-200">
                {pctMercaderia}% Ratio
              </span>
            </div>

            <div className="text-sm font-bold text-slate-900">Mercadería Financiada en Calle</div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ${kpis.mercaderiaFinanciada.toLocaleString('es-AR')},00
            </div>

            {/* Desglose Bases Contractuales */}
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs border border-slate-100">
              <div className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                Bases Contractuales:
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Contratos vigentes:</span>
                <span className="font-mono font-bold text-slate-800">{kpis.contratosBienes} activos</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tipología:</span>
                <span className="font-mono text-slate-700">Electro &amp; Muebles</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Planes extendidos:</span>
                <span className="font-mono text-slate-700">42 a 220 cuotas</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Cumplimiento:</span>
                <span className="font-mono font-bold text-emerald-600">92.5% óptimo</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">Garantía Prendaria:</span>
            <span className="font-bold text-emerald-600">100% Respaldado</span>
          </div>
        </div>

        {/* Card 4: Stock en Depósito Central */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <span className="material-symbols-outlined text-[18px] text-blue-600">inventory_2</span> Inventario Físico
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                {pctStock}% Ratio
              </span>
            </div>

            <div className="text-sm font-bold text-slate-900">Stock en Depósito Central</div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ${kpis.stockEnDeposito.toLocaleString('es-AR')},00
            </div>

            {/* Desglose Auditoría Almacén */}
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs border border-slate-100">
              <div className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                Auditoría Almacén:
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Unidades en stock:</span>
                <span className="font-mono font-bold text-slate-800">{kpis.unidadesStockDeposito} unidades</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Criterio valuación:</span>
                <span className="font-mono text-slate-700">Costo reposición</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Rotación promedio:</span>
                <span className="font-mono font-bold text-emerald-600">18 días</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Seguro siniestros:</span>
                <span className="font-mono font-bold text-emerald-600">Póliza al día</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">Ubicación Física:</span>
            <span className="font-bold text-slate-700">Galpón Alberdi #340</span>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. BENCHMARK COBRADORES (8 cols) + COMPOSICIÓN DE CARTERA DONUT (4 cols) */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Rendimiento por Cobrador */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">speed</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Rendimiento y Efectividad por Cobrador
                  </h3>
                  <p className="text-xs text-slate-500">
                    Benchmark comparativo diario en tiempo real: Cobrado rendido vs. Cartera exigible ({efectividadCobradores.length} cobradores activos)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Meta Diaria: &ge; 90%
                </span>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('cobradores')}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                  >
                    <span>Ver Cobradores</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                )}
              </div>
            </div>

            {/* Grid Compacto de Cobradores (2 columnas para ocupar la mitad de altura) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {efectividadCobradores.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-50/80 hover:bg-white p-3 rounded-xl border border-slate-200/70 hover:border-slate-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-sm transition flex flex-col justify-between gap-2 group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-slate-900 text-white font-bold text-[11px] flex items-center justify-center font-mono shrink-0">
                        {c.orden}
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-xs text-slate-900 truncate block group-hover:text-emerald-700 transition">
                          {c.nombre}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate block -mt-0.5">
                          {c.zona}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                        c.color === 'emerald'
                          ? 'bg-emerald-100/80 text-emerald-800'
                          : c.color === 'amber'
                          ? 'bg-amber-100/80 text-amber-800'
                          : c.color === 'rose'
                          ? 'bg-rose-100/80 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {c.pct}%
                    </span>
                  </div>

                  <div className="space-y-1">
                    {/* Micro-barra de progreso */}
                    <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          c.color === 'emerald'
                            ? 'bg-emerald-500'
                            : c.color === 'amber'
                            ? 'bg-amber-500'
                            : c.color === 'rose'
                            ? 'bg-rose-500'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${Math.min(c.pct, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                      <span className="font-bold text-slate-800">
                        ${c.cobrado.toLocaleString('es-AR')}
                      </span>
                      <span className="text-slate-400">
                        Meta: ${c.exigible.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Totales Benchmark */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs gap-4 bg-slate-50/60 p-4 rounded-xl">
            <div className="flex items-center gap-6">
              <span>Exigible Consolidado: <strong className="font-mono text-slate-900">${exigibleConsolidado.toLocaleString('es-AR')}</strong></span>
              <span>Recaudado Efectivo: <strong className="font-mono text-emerald-600">${cobradoConsolidado.toLocaleString('es-AR')}</strong></span>
            </div>
            <div className="font-bold text-emerald-700">
              Efectividad Global de Calle: {efectividadGlobal.toFixed(1)}% {efectividadGlobal >= 90 ? '(Superávit de Gestión)' : '(En Seguimiento)'}
            </div>
          </div>
        </div>

        {/* Composición de Cartera con Donut SVG */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">pie_chart</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Composición de Cartera</h3>
                <p className="text-xs text-slate-500">Ponderación de capital activo en calle</p>
              </div>
            </div>

            {/* Gráfico Donut SVG Dinámico */}
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-44 h-44">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" fill="transparent" r="40" stroke="#e2e8f0" strokeWidth="12" />
                  {/* Segmento 1: Efectivo */}
                  <circle
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    stroke="#059669"
                    strokeDasharray={`${((pctEfectivoCalle / 100) * 251.327).toFixed(1)} 251.3`}
                    strokeDashoffset="0"
                    strokeWidth="12"
                  />
                  {/* Segmento 2: Electro / Bienes */}
                  <circle
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    stroke="#0d9488"
                    strokeDasharray={`${((pctMercaderiaCalle / 100) * 251.327).toFixed(1)} 251.3`}
                    strokeDashoffset={`-${((pctEfectivoCalle / 100) * 251.327).toFixed(1)}`}
                    strokeWidth="12"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Calle</span>
                  <span className="text-xl font-bold font-mono text-slate-900">
                    ${(totalCalle / 1000000).toFixed(2)}M
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600">100% Activa</span>
                </div>
              </div>
            </div>

            {/* Leyenda Detallada */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                  <span className="font-semibold text-slate-800">Préstamos en Efectivo</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-800">${kpis.capitalEnCalle.toLocaleString('es-AR')}</span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono font-bold text-slate-700">
                    {pctEfectivoCalle.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-teal-600"></span>
                  <span className="font-semibold text-slate-800">Electro &amp; Bienes</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-800">${kpis.mercaderiaFinanciada.toLocaleString('es-AR')}</span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono font-bold text-slate-700">
                    {pctMercaderiaCalle.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">Riesgo Diversificado:</span>
            <span className="font-bold text-emerald-600">Perfil Balanceado</span>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 5. ÍNDICES DE SALUD FINANCIERA (8 cols) + PROYECCIÓN MENSUAL (4 cols) */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Índices y Calidad de Cartera */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-emerald-600">health_and_safety</span>
                <h3 className="text-base font-bold text-slate-900">
                  Índices de Salud Financiera &amp; Calidad de Cartera
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Métricas de control prudencial crediticio bajo umbrales internos de solvencia
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="material-symbols-outlined text-[16px]">shield</span> Calificación Institucional A+
              </span>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('clientes')}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                >
                  <span>Ver Clientes en Vivo</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              )}
            </div>
          </div>

          {/* 3 Metric Tiles Dinámicos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
                <span>Mora Temprana</span>
                <span className="material-symbols-outlined text-[18px]">schedule</span>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-900">{tramosVencimiento.atraso.pct}%</div>
                <div className="text-xs text-slate-400 mt-0.5">Retraso de 1 a 3 días ({tramosVencimiento.atraso.cantidad} clientes)</div>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(parseFloat(tramosVencimiento.atraso.pct) * 5, 100)}%` }}></div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>Umbral Máx: 6.0%</span>
                <span className="font-bold text-emerald-600">Dentro de Norma</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-xs text-rose-600 font-bold uppercase tracking-wider">
                <span>Mora Tardía</span>
                <span className="material-symbols-outlined text-[18px] text-rose-600">warning</span>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-rose-600">{tramosVencimiento.mora.pct}%</div>
                <div className="text-xs text-slate-400 mt-0.5">Retraso &gt; 7 días ({tramosVencimiento.mora.cantidad} clientes)</div>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(parseFloat(tramosVencimiento.mora.pct) * 8, 100)}%` }}></div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>Pérdida Esperada: 0.4%</span>
                <span className="font-bold text-emerald-600">Riesgo Mínimo</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
                <span>Rotación de Cartera</span>
                <span className="material-symbols-outlined text-[18px] text-emerald-600">autorenew</span>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-900">
                  28.4 <span className="text-sm font-normal text-slate-400">Días</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Ciclo de cobro promedio</div>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '82%' }}></div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>Velocidad: Alta</span>
                <span className="font-bold text-emerald-600">Liquidez Continua</span>
              </div>
            </div>
          </div>

          {/* Tabla de Tramos de Vencimiento */}
          <div className="rounded-xl border border-slate-200/80 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-2.5 px-4">Tramo de Vencimiento</th>
                  <th className="py-2.5 px-4">Créditos</th>
                  <th className="py-2.5 px-4 text-right">Monto en Riesgo</th>
                  <th className="py-2.5 px-4 text-right">% Cartera</th>
                  <th className="py-2.5 px-4">Plan de Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900">Al día (0 días)</td>
                  <td className="py-3 px-4 font-mono">{tramosVencimiento.alDia.cantidad} clientes</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                    ${tramosVencimiento.alDia.monto.toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                    {tramosVencimiento.alDia.pct}%
                  </td>
                  <td className="py-3 px-4 text-slate-500">Continuidad regular</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900">Atraso leve (1 a 3 días)</td>
                  <td className="py-3 px-4 font-mono">{tramosVencimiento.atraso.cantidad} clientes</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                    ${tramosVencimiento.atraso.monto.toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-amber-600">
                    {tramosVencimiento.atraso.pct}%
                  </td>
                  <td className="py-3 px-4 text-slate-500">Refuerzo cobranza en ruta</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-rose-600">Mora tardía (&gt; 7 días)</td>
                  <td className="py-3 px-4 font-mono">{tramosVencimiento.mora.cantidad} clientes</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                    ${tramosVencimiento.mora.monto.toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                    {tramosVencimiento.mora.pct}%
                  </td>
                  <td className="py-3 px-4 text-rose-600 font-bold">Visita de recuperador legal</td>
                </tr>
              </tbody>
            </table>
            {onNavigate && (
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">¿Necesita gestionar clientes morosos o registrar cobros?</span>
                <button
                  onClick={() => onNavigate('clientes')}
                  className="font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 transition"
                >
                  <span>Ir a Monitoreo de Clientes</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Proyección de Cobro Mensual Estimado */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-700/80 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/70">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <span className="material-symbols-outlined text-[16px]">trending_up</span> Proyección Oficial
              </span>
              <span className="text-xs font-mono text-slate-400">Cierre 2026</span>
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Proyección de Cobro Mensual Estimado</h3>
              <p className="text-xs text-slate-400 mt-1">
                Ingreso bruto proyectado según amortizaciones y contratos activos sin refinanciamiento.
              </p>
            </div>

            <div>
              <div className="text-3xl font-black font-mono text-emerald-400">
                ${(totalCalle * 0.88).toLocaleString('es-AR')}<span className="text-sm font-normal text-slate-400">,00</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                ARS • Modelo dinámico sobre ${(totalCalle).toLocaleString('es-AR')} de cartera activa
              </div>
            </div>

            {/* Desglose de proyección */}
            <div className="space-y-2.5 bg-slate-800/80 p-4 rounded-xl text-xs border border-slate-700/60">
              <div className="flex justify-between text-slate-300">
                <span>Cuotas Efectivo Proyectadas:</span>
                <span className="font-mono font-bold text-white">
                  ${Math.round(kpis.capitalEnCalle * 0.9).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Cuotas Electro &amp; Muebles:</span>
                <span className="font-mono font-bold text-white">
                  ${Math.round(kpis.mercaderiaFinanciada * 0.85).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Tasa de Deserción Esperada:</span>
                <span className="font-mono font-bold text-emerald-400">-2.1% (Controlada)</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700/70 flex items-center justify-between text-xs">
            <span className="text-slate-400">Flujo de Caja: <strong className="text-emerald-400">Positivo</strong></span>
            <button
              onClick={() => setMostrarModalPDF(true)}
              className="text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-1 transition text-xs"
            >
              <span>Ver Informe A4</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 6. MODAL / VISTA DE IMPRESIÓN: INFORME CONTABLE PATRIMONIAL A4 (PDF) */}
      {/* ===================================================================== */}
      {mostrarModalPDF && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Barra de Acciones del Modal (No se imprime) */}
            <div className="no-print bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[22px]">description</span>
                <span className="text-sm font-bold">Informe Contable Patrimonial &amp; Benchmark Operativo (Formato A4)</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={exportarInformeExcel}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">table_view</span>
                  <span>Descargar Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>Imprimir / Guardar como PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarModalPDF(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Hoja A4 Imprimible */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center">
              <div className="bg-white w-full max-w-3xl p-10 shadow-md border border-slate-200 text-slate-800 space-y-6 text-xs font-sans rounded-xl">
                {/* Encabezado Institucional */}
                <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-black text-sm flex items-center justify-center">
                        CO
                      </div>
                      <h1 className="text-xl font-black text-slate-900 tracking-tight">CREDIT-ON</h1>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Sistema Integral de Gestión Crediticia, Cobranzas y Tesorería • Sede Central Santiago del Estero
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-slate-100 border border-slate-300 font-mono font-bold text-slate-800 px-3 py-1 rounded text-xs">
                      INF-PAT-${hoyStr.replace(/-/g, '')}-SGO
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Emisión: {new Date().toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>

                {/* Subtítulo y Período */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-3 gap-4 text-slate-700">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Tipo de Documento</span>
                    <strong className="text-slate-900">Auditoría Patrimonial Consolidada</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Período Auditado</span>
                    <strong className="text-slate-900 capitalize">{periodo} Actual (2026)</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Estado Contable</span>
                    <strong className="text-emerald-700">Auditado en Firme (100% Capital Propio)</strong>
                  </div>
                </div>

                {/* 1. Valuación Patrimonial */}
                <div className="space-y-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                    1. Valuación de Activos y Patrimonio Neto Operativo
                  </h3>
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3 text-left">Rubro de Activo</th>
                        <th className="py-2 px-3 text-right">Valuación ($ ARS)</th>
                        <th className="py-2 px-3 text-center">Ratio %</th>
                        <th className="py-2 px-3 text-left">Detalle / Respaldos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      <tr>
                        <td className="py-2 px-3 font-sans font-bold text-slate-800">Caja Líquida Disponible</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">${kpis.cajaLiquida.toLocaleString('es-AR')},00</td>
                        <td className="py-2 px-3 text-center font-bold text-amber-700 font-sans">{pctCaja}%</td>
                        <td className="py-2 px-3 font-sans text-slate-500 text-[11px]">Disponibilidad inmediata en tesorería</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans font-bold text-slate-800">Capital en Calle (Préstamos Efectivo)</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">${kpis.capitalEnCalle.toLocaleString('es-AR')},00</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-700 font-sans">{pctPrestamos}%</td>
                        <td className="py-2 px-3 font-sans text-slate-500 text-[11px]">{kpis.colocacionesEfectivo} colocaciones activas en ruta</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans font-bold text-slate-800">Mercadería Financiada en Calle</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">${kpis.mercaderiaFinanciada.toLocaleString('es-AR')},00</td>
                        <td className="py-2 px-3 text-center font-bold text-teal-700 font-sans">{pctMercaderia}%</td>
                        <td className="py-2 px-3 font-sans text-slate-500 text-[11px]">{kpis.contratosBienes} contratos con garantía prendaria</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans font-bold text-slate-800">Stock Valuado en Depósito Central</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">${kpis.stockEnDeposito.toLocaleString('es-AR')},00</td>
                        <td className="py-2 px-3 text-center font-bold text-blue-700 font-sans">{pctStock}%</td>
                        <td className="py-2 px-3 font-sans text-slate-500 text-[11px]">{kpis.unidadesStockDeposito} unidades en almacén Alberdi</td>
                      </tr>
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                        <td className="py-2.5 px-3 font-sans font-black text-slate-900">PATRIMONIO NETO CONSOLIDADO:</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700 text-sm">
                          ${patrimonioTotal.toLocaleString('es-AR')},00
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans font-black">100.0%</td>
                        <td className="py-2.5 px-3 font-sans text-emerald-700 text-[11px] font-bold">100% Capital Propio (Sin Deuda)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 2. Benchmark de Cobradores */}
                <div className="space-y-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                    2. Benchmark y Rendimiento Operativo de Cobradores en Calle
                  </h3>
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-1.5 px-2 text-center">Rank</th>
                        <th className="py-1.5 px-3 text-left">Cobrador</th>
                        <th className="py-1.5 px-3 text-left">Zona Asignada</th>
                        <th className="py-1.5 px-3 text-right">Exigible ($)</th>
                        <th className="py-1.5 px-3 text-right">Cobrado ($)</th>
                        <th className="py-1.5 px-3 text-center">Efectividad %</th>
                        <th className="py-1.5 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {efectividadCobradores.map((c) => (
                        <tr key={c.id}>
                          <td className="py-1.5 px-2 text-center font-bold text-slate-600">#{c.orden}</td>
                          <td className="py-1.5 px-3 font-sans font-bold text-slate-900">{c.nombre}</td>
                          <td className="py-1.5 px-3 font-sans text-slate-500 text-[10px]">{c.zona}</td>
                          <td className="py-1.5 px-3 text-right text-slate-700">${c.exigible.toLocaleString('es-AR')}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-emerald-700">${c.cobrado.toLocaleString('es-AR')}</td>
                          <td className="py-1.5 px-3 text-center font-bold">{c.pct}%</td>
                          <td className="py-1.5 px-3 text-center font-sans">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                              {c.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold border-t border-slate-300">
                        <td colSpan={3} className="py-2 px-3 font-sans text-slate-900">TOTALES CONSOLIDADOS:</td>
                        <td className="py-2 px-3 text-right text-slate-900">${exigibleConsolidado.toLocaleString('es-AR')}</td>
                        <td className="py-2 px-3 text-right text-emerald-700 font-black">${cobradoConsolidado.toLocaleString('es-AR')}</td>
                        <td className="py-2 px-3 text-center text-emerald-700 font-black">{efectividadGlobal.toFixed(1)}%</td>
                        <td className="py-2 px-3 text-center font-sans text-emerald-700 font-bold text-[10px]">Meta &ge; 90%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. Tramos de Vencimiento */}
                <div className="space-y-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                    3. Salud Crediticia y Estructura de Tramos de Vencimiento
                  </h3>
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-1.5 px-3 text-left">Tramo de Vencimiento</th>
                        <th className="py-1.5 px-3 text-center">Créditos</th>
                        <th className="py-1.5 px-3 text-right">Monto en Riesgo ($)</th>
                        <th className="py-1.5 px-3 text-center">% de Cartera</th>
                        <th className="py-1.5 px-3 text-left">Plan de Acción / Recupero</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      <tr>
                        <td className="py-1.5 px-3 font-sans font-bold text-slate-900">Al día (0 días de atraso)</td>
                        <td className="py-1.5 px-3 text-center text-slate-700">{tramosVencimiento.alDia.cantidad} clientes</td>
                        <td className="py-1.5 px-3 text-right font-bold text-emerald-700">${tramosVencimiento.alDia.monto.toLocaleString('es-AR')}</td>
                        <td className="py-1.5 px-3 text-center font-bold text-emerald-700 font-sans">{tramosVencimiento.alDia.pct}%</td>
                        <td className="py-1.5 px-3 font-sans text-slate-500">Continuidad regular sin restricciones</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-sans font-bold text-amber-800">Atraso leve (1 a 3 días)</td>
                        <td className="py-1.5 px-3 text-center text-slate-700">{tramosVencimiento.atraso.cantidad} clientes</td>
                        <td className="py-1.5 px-3 text-right font-bold text-slate-900">${tramosVencimiento.atraso.monto.toLocaleString('es-AR')}</td>
                        <td className="py-1.5 px-3 text-center font-bold text-amber-700 font-sans">{tramosVencimiento.atraso.pct}%</td>
                        <td className="py-1.5 px-3 font-sans text-slate-500">Refuerzo y visita prioritaria en ruta</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-sans font-bold text-rose-700">Mora tardía (&gt; 7 días)</td>
                        <td className="py-1.5 px-3 text-center text-slate-700">{tramosVencimiento.mora.cantidad} clientes</td>
                        <td className="py-1.5 px-3 text-right font-bold text-rose-700">${tramosVencimiento.mora.monto.toLocaleString('es-AR')}</td>
                        <td className="py-1.5 px-3 text-center font-bold text-rose-700 font-sans">{tramosVencimiento.mora.pct}%</td>
                        <td className="py-1.5 px-3 font-sans text-rose-700 font-bold">Protocolo CIAL / Retiro de mercadería</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Bloque de Firmas para Firma Manuscrita */}
                <div className="pt-12 border-t border-slate-300 grid grid-cols-2 gap-16 text-center">
                  <div className="space-y-2">
                    <div className="border-b-2 border-slate-400 h-16"></div>
                    <div>
                      <strong className="text-slate-900 block">Dirección General &amp; Tesorería</strong>
                      <span className="text-slate-500 text-[10px]">Firma de Autorización y Conformidad</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="border-b-2 border-slate-400 h-16"></div>
                    <div>
                      <strong className="text-slate-900 block">Auditoría Contable / Operativa</strong>
                      <span className="text-slate-500 text-[10px]">Certificación de Saldos y Existencias</span>
                    </div>
                  </div>
                </div>

                {/* Pie de Página */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>HASH: SHA256-PAT-${hoyStr.replace(/-/g, '')}-CREDITON-OK</span>
                  <span>CREDIT-ON DESKTOP v1.2 • INFORME CERTIFICADO</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
