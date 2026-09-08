import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { descargarPlantillaCSV, parsearCSV, obtenerValor, obtenerNumero } from '../utils/csv-helper';
import { inferirIconoProducto } from '../utils/producto-helper';

interface ProductoInventario {
  id: number;
  nombre: string;
  lote: string;
  icono: string;
  costo: number;
  stock_deposito: number;
  stock_calle: number;
  valuacion: number;
  retorno: number;
  estado: 'Stock Óptimo' | 'Stock Bajo' | 'Stock Alto';
  series: string[];
}

export interface BienEnRiesgo {
  nro_op: number;
  opFormateada: string;
  clienteNombre: string;
  clienteDni: string;
  clienteTel: string;
  domicilio: string;
  cobrador: string;
  nombreBien: string;
  serieBien: string;
  saldoImpago: number;
  vencidasCount: number;
  diasMora: number;
  nivelMora: string;
  esCritico: boolean;
  estadoOperacion?: string;
}

const BIENES_RIESGO_BASE: BienEnRiesgo[] = [
  {
    nro_op: 9841,
    opFormateada: '#PR-09841',
    clienteNombre: 'RAMÓN SOSA',
    clienteDni: '28.491.032',
    clienteTel: '385-4991288',
    domicilio: 'Calle Belgrano 1420, B° Belgrano, SDE',
    cobrador: 'Ariel (Zona Centro)',
    nombreBien: 'Smart TV Noblex 43" Full HD',
    serieBien: 'NBX-43FHD-994103',
    saldoImpago: 94000,
    vencidasCount: 4,
    diasMora: 18,
    nivelMora: 'EVALUAR_RETIRO',
    esCritico: true,
  },
  {
    nro_op: 105,
    opFormateada: '#OP-105',
    clienteNombre: 'BENÍTEZ CLAUDIO ANDRÉS',
    clienteDni: '29.887.112',
    clienteTel: '385-4771234',
    domicilio: 'Calle 12 N° 450 - B° Mishqui Mayu',
    cobrador: 'Carlos Mendilaharzu (Zona Oeste)',
    nombreBien: 'Heladera con Freezer Gafa 280L',
    serieBien: 'GAF-SERIE-8812',
    saldoImpago: 81000,
    vencidasCount: 6,
    diasMora: 14,
    nivelMora: 'EVALUAR_RETIRO',
    esCritico: true,
  },
  {
    nro_op: 104,
    opFormateada: '#OP-104',
    clienteNombre: 'TALLER MECÁNICO RODRÍGUEZ',
    clienteDni: '25.667.788',
    clienteTel: '385-4889900',
    domicilio: 'Av. Colón Sur 3100',
    cobrador: 'Mauro Sánchez (Zona Este)',
    nombreBien: 'Ventilador Industrial 30" Metal',
    serieBien: 'VENT-SN-9901',
    saldoImpago: 126000,
    vencidasCount: 3,
    diasMora: 21,
    nivelMora: 'MORA_CRITICA',
    esCritico: true,
  },
];

const PRODUCTOS_DEMO: ProductoInventario[] = [
  {
    id: 1,
    nombre: 'Smart TV 43" Noblex / Philips',
    lote: 'Lote NBX-PHIL-24 | 36 trazados',
    icono: 'tv',
    costo: 220000,
    stock_deposito: 14,
    stock_calle: 22,
    valuacion: 3080000,
    retorno: 64,
    estado: 'Stock Óptimo',
    series: ['NBX-43FHD-994103', 'NBX-43FHD-994104', 'PH-43SMART-00219'],
  },
  {
    id: 2,
    nombre: 'Heladera con Freezer Gafa 280L',
    lote: 'Lote GAF-280-W | 24 trazados',
    icono: 'kitchen',
    costo: 340000,
    stock_deposito: 8,
    stock_calle: 16,
    valuacion: 2720000,
    retorno: 58,
    estado: 'Stock Bajo',
    series: ['GAF-SERIE-8812', 'GAF-SERIE-8819'],
  },
  {
    id: 3,
    nombre: 'Sommier 2 Plazas Piero Espuma',
    lote: 'Lote PIERO-CORONA | 50 trazados',
    icono: 'bed',
    costo: 185000,
    stock_deposito: 19,
    stock_calle: 31,
    valuacion: 3515000,
    retorno: 72,
    estado: 'Stock Óptimo',
    series: ['PIERO-SER-1190', 'PIERO-SER-1194', 'PIERO-SER-1201'],
  },
  {
    id: 4,
    nombre: 'Celular Moto G54 256GB 5G',
    lote: 'Lote MOT-G54-BLUE | 40 trazados',
    icono: 'smartphone',
    costo: 145000,
    stock_deposito: 22,
    stock_calle: 18,
    valuacion: 3190000,
    retorno: 81,
    estado: 'Stock Alto',
    series: ['IMEI: 358920119283401', 'IMEI: 358920119283402'],
  },
  {
    id: 5,
    nombre: 'Ventilador Industrial 30" Metal',
    lote: 'Lote VENT-IND-30 | 46 trazados',
    icono: 'mode_fan',
    costo: 520000,
    stock_deposito: 35,
    stock_calle: 11,
    valuacion: 1820000,
    retorno: 69,
    estado: 'Stock Alto',
    series: ['VENT-SN-9901', 'VENT-SN-9902', 'VENT-SN-9903'],
  },
];

export const GestionStock: React.FC = () => {
  const [productos, setProductos] = useState<ProductoInventario[]>(() => {
    try {
      const guardado = localStorage.getItem('credit_on_inventario_productos');
      if (guardado) return JSON.parse(guardado);
    } catch {}
    return PRODUCTOS_DEMO;
  });

  const guardarProductos = (nuevos: ProductoInventario[]) => {
    setProductos(nuevos);
    try {
      localStorage.setItem('credit_on_inventario_productos', JSON.stringify(nuevos));
      window.dispatchEvent(new Event('credit_on_storage_update'));
    } catch {}
  };

  // Estados para CRUD de Productos
  const [modalNuevoProducto, setModalNuevoProducto] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('Electrodomésticos');
  const [nuevoCosto, setNuevoCosto] = useState<string>('150000');
  const [nuevoStockDeposito, setNuevoStockDeposito] = useState<string>('10');
  const [nuevoStockCalle, setNuevoStockCalle] = useState<string>('0');

  // Estado para Edición de Producto
  const [modalEditarProducto, setModalEditarProducto] = useState<ProductoInventario | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editCosto, setEditCosto] = useState('');
  const [editStockDeposito, setEditStockDeposito] = useState('');
  const [editStockCalle, setEditStockCalle] = useState('');

  // Estado para Carga Masiva Excel
  const [modalImportarExcel, setModalImportarExcel] = useState(false);
  const [archivoCargando, setArchivoCargando] = useState(false);
  const [archivoError, setArchivoError] = useState<string | null>(null);
  const inputExcelRef = useRef<HTMLInputElement | null>(null);

  // Totales dinámicos calculados a partir del inventario real
  const totalValuacionDeposito = productos.reduce((sum, p) => sum + (p.costo * p.stock_deposito), 0);
  const totalUnidadesDeposito = productos.reduce((sum, p) => sum + p.stock_deposito, 0);
  const totalUnidadesCalle = productos.reduce((sum, p) => sum + p.stock_calle, 0);
  const totalCapitalFinanciado = productos.reduce((sum, p) => sum + Math.round(p.costo * 1.7 * p.stock_calle), 0);

  // Formulario de Ingreso de Compra
  const [categoriaCompra, setCategoriaCompra] = useState('Electrodomésticos');
  const [proveedorCompra, setProveedorCompra] = useState('Distribuidora Cuyo Norte');
  const [descCompra, setDescCompra] = useState('Lavarropas Drean Next 8.12 Eco');
  const [cantidadCompra, setCantidadCompra] = useState<number>(6);
  const [costoCompra, setCostoCompra] = useState<number>(385000);
  const [financiacionBase, setFinanciacionBase] = useState<number>(680000);

  // Carga y sincronización reactiva de cartera de operaciones
  const [carteraOperaciones, setCarteraOperaciones] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('credit_on_cartera_operaciones');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const cargarCartera = () => {
    try {
      const raw = localStorage.getItem('credit_on_cartera_operaciones');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCarteraOperaciones(parsed);
      }
    } catch {}
  };

  useEffect(() => {
    cargarCartera();
    const handleUpdate = () => cargarCartera();
    window.addEventListener('credit_on_storage_update', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('credit_on_storage_update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Lista viva de bienes financiados en riesgo de recupero
  const bienesEnRiesgo = useMemo<BienEnRiesgo[]>(() => {
    const listado: BienEnRiesgo[] = [];

    // 1. Extraer operaciones de la cartera viva que correspondan a productos con deuda
    if (carteraOperaciones && Array.isArray(carteraOperaciones)) {
      carteraOperaciones.forEach((op: any) => {
        const saldo = Number(op.saldo_restante || 0);
        const esProducto = op.tipo === 'PRODUCTO' || op.tipo === 'MERCADERIA' || !!op.producto;
        const noCancelada = op.estado_operacion !== 'CANCELADO_POR_RECUPERO' && op.mora?.nivel !== 'RECUPERADO';

        if (esProducto && saldo > 0 && noCancelada) {
          const cuotas = op.cuotas || [];
          const vencidas = cuotas.filter((c: any) => c.estado === 'VENCIDA').length;
          const diasMora = op.mora?.dias_mora ?? (vencidas * 7);
          const esCritico =
            op.mora?.sugerencia_retiro_mercaderia === true ||
            op.mora?.nivel === 'MORA_CRITICA' ||
            op.mora?.nivel === 'EVALUAR_RETIRO' ||
            vencidas >= 2 ||
            diasMora >= 12;

          const nombreBien =
            op.producto ||
            op.detalle_producto ||
            (op.nro_op === 105
              ? 'Heladera con Freezer Gafa 280L'
              : op.nro_op === 104
              ? 'Ventilador Industrial 30" Metal'
              : 'Smart TV 43" Noblex / Philips');

          const serieBien = op.serie || `SN-${op.nro_op}-${Math.floor(1000 + (op.nro_op * 31) % 9000)}`;

          listado.push({
            nro_op: Number(op.nro_op),
            opFormateada: `#OP-${op.nro_op}`,
            clienteNombre: (op.cliente?.nombre || 'CLIENTE').toUpperCase(),
            clienteDni: op.cliente?.dni || 'Sin DNI',
            clienteTel: op.cliente?.telefono || '-',
            domicilio: op.domicilio_cobro || op.cliente?.domicilio || 'Domicilio no registrado',
            cobrador: op.cobrador?.nombre || 'Cobrador General',
            nombreBien,
            serieBien,
            saldoImpago: saldo,
            vencidasCount: vencidas || (op.mora?.cuotas_vencidas_impagas ?? 1),
            diasMora: diasMora || 14,
            nivelMora: op.mora?.nivel || (esCritico ? 'EVALUAR_RETIRO' : 'ALERTA'),
            esCritico,
          });
        }
      });
    }

    // 2. Si la base viva no contiene bienes en riesgo, incorporar los modelos base para simulación
    if (listado.length === 0) {
      return BIENES_RIESGO_BASE;
    }

    // Unir sin duplicar por nro_op
    const combinados = [...listado];
    BIENES_RIESGO_BASE.forEach((base) => {
      if (!combinados.some((b) => b.nro_op === base.nro_op)) {
        combinados.push(base);
      }
    });

    // 3. Ordenar: Críticos primero, luego por días de mora descendente
    return combinados.sort((a, b) => {
      if (a.esCritico && !b.esCritico) return -1;
      if (!a.esCritico && b.esCritico) return 1;
      return b.diasMora - a.diasMora;
    });
  }, [carteraOperaciones]);

  // Modales y filtros para Bienes en Riesgo
  const [modalBienesEnRiesgo, setModalBienesEnRiesgo] = useState<boolean>(false);
  const [filtroBienesTexto, setFiltroBienesTexto] = useState<string>('');
  const [filtroBienesTab, setFiltroBienesTab] = useState<'TODOS' | 'CRITICOS'>('TODOS');

  // Formulario de Recupero
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<BienEnRiesgo>(BIENES_RIESGO_BASE[0]);
  const [opRecupero, setOpRecupero] = useState<string>(BIENES_RIESGO_BASE[0].opFormateada);
  const [causalRetiro, setCausalRetiro] = useState('Incumplimiento contractual reiterado');
  const [estadoBien, setEstadoBien] = useState('Detalles cosméticos (Desgaste menor)');
  const [depositoReceptor, setDepositoReceptor] = useState('Galpón Central Alberdi #340');

  // Modales y Toasts
  const [modalSeries, setModalSeries] = useState<{ nombre: string; series: string[] } | null>(null);
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);
  const [filtroMatriz, setFiltroMatriz] = useState<string>('');

  // Estados para Escáner y Rastreo de IMEI / Series
  const [modalEscanerIMEI, setModalEscanerIMEI] = useState<boolean>(false);
  const [busquedaIMEI, setBusquedaIMEI] = useState<string>('');
  const [tabEscaner, setTabEscaner] = useState<'buscar' | 'asignar'>('buscar');
  const [prodSeleccionadoAsignar, setProdSeleccionadoAsignar] = useState<number>(productos[0]?.id || 1);
  const [nuevoIMEITexto, setNuevoIMEITexto] = useState<string>('');

  // Unificación de todas las series registradas en el sistema (Galpón y Calle)
  const seriesRegistradas = useMemo(() => {
    const listado: {
      serie: string;
      producto: string;
      ubicacion: 'GALPON' | 'CALLE';
      titular?: string;
      nro_op?: number;
      saldo?: number;
      diasMora?: number;
      esCritico?: boolean;
      bienRiesgo?: BienEnRiesgo;
    }[] = [];

    // 1. Series en depósito (productos)
    productos.forEach((p) => {
      (p.series || []).forEach((s) => {
        listado.push({
          serie: s,
          producto: p.nombre,
          ubicacion: 'GALPON',
        });
      });
    });

    // 2. Series en calle (bienes en riesgo / operaciones)
    bienesEnRiesgo.forEach((b) => {
      if (b.serieBien) {
        listado.push({
          serie: b.serieBien,
          producto: b.nombreBien,
          ubicacion: 'CALLE',
          titular: b.clienteNombre,
          nro_op: b.nro_op,
          saldo: b.saldoImpago,
          diasMora: b.diasMora,
          esCritico: b.esCritico,
          bienRiesgo: b,
        });
      }
    });

    return listado;
  }, [productos, bienesEnRiesgo]);

  const seriesFiltradas = useMemo(() => {
    const q = busquedaIMEI.trim().toLowerCase();
    if (!q) return seriesRegistradas;
    return seriesRegistradas.filter(
      (item) =>
        item.serie.toLowerCase().includes(q) ||
        item.producto.toLowerCase().includes(q) ||
        (item.titular && item.titular.toLowerCase().includes(q)) ||
        (item.nro_op && String(item.nro_op).includes(q))
    );
  }, [seriesRegistradas, busquedaIMEI]);

  // Exportación oficial del Reporte CIAL en formato Excel (.xlsx)
  const exportarReporteCIAL = () => {
    try {
      const wb = XLSX.utils.book_new();
      const fechaStr = new Date().toISOString().split('T')[0];
      const horaStr = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

      // HOJA 1: Auditoría CIAL - Bienes Prendados en Calle
      const totalRiesgo = bienesEnRiesgo.reduce((acc, b) => acc + (b.saldoImpago || 0), 0);
      const wsBienesData = [
        ['CREDIT-ON — REPORTE OFICIAL CIAL: AUDITORÍA DE BIENES PRENDADOS'],
        [`Fecha de Emisión: ${new Date().toLocaleDateString('es-AR')} ${horaStr} | Sede Central Santiago del Estero`],
        ['Marco Normativo: Certificación de Trazabilidad Prendaria y Recupero Extrajudicial'],
        [],
        [
          'N° OP',
          'Titular del Crédito',
          'DNI',
          'Teléfono',
          'Domicilio de Retiro',
          'Cobrador / Zona',
          'Bien Prendado',
          'N° Serie / IMEI',
          'Saldo Impago (ARS)',
          'Cuotas Vencidas',
          'Días de Mora',
          'Estado Legal / Dictamen'
        ],
        ...bienesEnRiesgo.map((b) => [
          b.nro_op,
          b.clienteNombre,
          b.clienteDni,
          b.clienteTel,
          b.domicilio,
          b.cobrador,
          b.nombreBien,
          b.serieBien,
          b.saldoImpago,
          b.vencidasCount,
          b.diasMora,
          b.esCritico ? 'MORA CRÍTICA - APTO RETIRO' : 'EN ALERTA TEMPRANA'
        ]),
        [],
        [
          'TOTALES',
          `${bienesEnRiesgo.length} Expedientes en seguimiento`,
          '',
          '',
          '',
          '',
          '',
          'Total Saldo en Riesgo:',
          totalRiesgo,
          '',
          '',
          'Auditoría CIAL Conforme'
        ]
      ];
      const wsBienes = XLSX.utils.aoa_to_sheet(wsBienesData);
      XLSX.utils.book_append_sheet(wb, wsBienes, 'Bienes Prendados CIAL');

      // HOJA 2: Inventario Físico en Depósito Central y Mercadería en Calle
      const wsStockData = [
        ['CREDIT-ON — INVENTARIO CONSOLIDADO Y CONTROL DE LOTES'],
        [`Fecha de Cierre: ${new Date().toLocaleDateString('es-AR')} ${horaStr}`],
        [],
        [
          'Código',
          'Descripción del Producto',
          'Lote',
          'Costo Compra ($)',
          'Stock en Galpón',
          'Stock en Calle',
          'Valuación Depósito ($)',
          'Retorno (%)',
          'Estado',
          'Números de Serie / IMEIs Registrados'
        ],
        ...productos.map((p) => [
          p.id,
          p.nombre,
          p.lote,
          p.costo,
          p.stock_deposito,
          p.stock_calle,
          p.valuacion,
          `${p.retorno}%`,
          p.estado,
          (p.series || []).join(', ')
        ]),
        [],
        [
          'TOTALES',
          `${productos.length} Modelos Registrados`,
          '',
          '',
          totalUnidadesDeposito,
          totalUnidadesCalle,
          totalValuacionDeposito,
          '',
          '',
          ''
        ]
      ];
      const wsStock = XLSX.utils.aoa_to_sheet(wsStockData);
      XLSX.utils.book_append_sheet(wb, wsStock, 'Inventario y Lotes');

      XLSX.writeFile(wb, `Reporte_CIAL_Bienes_Prendados_CreditOn_${fechaStr}.xlsx`);
      setToastMensaje('✓ Reporte CIAL oficial de bienes prendados exportado exitosamente en Excel (.xlsx).');
      setTimeout(() => setToastMensaje(null), 5000);
    } catch (e) {
      console.error('Error exportando reporte CIAL:', e);
      setToastMensaje('Error al exportar archivo Excel. Revise la consola.');
      setTimeout(() => setToastMensaje(null), 5000);
    }
  };

  // Asignar nuevas series / IMEIs a un producto en inventario
  const handleVincularNuevoIMEI = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoIMEITexto.trim()) return;

    const nuevasSeries = nuevoIMEITexto
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (nuevasSeries.length === 0) return;

    const actualizados = productos.map((p) => {
      if (p.id === prodSeleccionadoAsignar) {
        const seriesPrevias = p.series || [];
        const unicas = Array.from(new Set([...nuevasSeries, ...seriesPrevias]));
        return {
          ...p,
          series: unicas,
        };
      }
      return p;
    });

    guardarProductos(actualizados);
    setNuevoIMEITexto('');
    setToastMensaje(`✓ ${nuevasSeries.length} número(s) de serie/IMEI vinculados al inventario con éxito.`);
    setTimeout(() => setToastMensaje(null), 4000);
  };

  // Sincronizar expediente seleccionado si cambia la lista
  useEffect(() => {
    if (bienesEnRiesgo.length > 0) {
      const match = bienesEnRiesgo.find((b) => b.nro_op === expedienteSeleccionado?.nro_op);
      if (match) {
        setExpedienteSeleccionado(match);
      } else {
        setExpedienteSeleccionado(bienesEnRiesgo[0]);
        setOpRecupero(bienesEnRiesgo[0].opFormateada);
      }
    }
  }, [bienesEnRiesgo]);

  // Acción de Cargar Expediente desde la lista o modal
  const seleccionarExpediente = (bien: BienEnRiesgo) => {
    setExpedienteSeleccionado(bien);
    setOpRecupero(bien.opFormateada);
    setModalBienesEnRiesgo(false);
    const el = document.getElementById('protocolo-recupero');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setToastMensaje(`Expediente de ${bien.clienteNombre} cargado en el Protocolo de Retiro.`);
    setTimeout(() => setToastMensaje(null), 4000);
  };

  // Validar expediente ingresado en el buscador
  const handleValidarExpediente = () => {
    const q = opRecupero.trim().toLowerCase().replace('#', '').replace('op-', '').replace('pr-', '');
    if (!q) return;

    const encontrado = bienesEnRiesgo.find(
      (b) =>
        String(b.nro_op).includes(q) ||
        b.clienteNombre.toLowerCase().includes(q) ||
        b.clienteDni.replace(/\./g, '').includes(q) ||
        b.nombreBien.toLowerCase().includes(q)
    );

    if (encontrado) {
      setExpedienteSeleccionado(encontrado);
      setOpRecupero(encontrado.opFormateada);
      setToastMensaje(`✓ Expediente #${encontrado.nro_op} (${encontrado.clienteNombre}) localizado con éxito.`);
    } else {
      setToastMensaje(`No se encontró expediente con "${opRecupero}". Revise la lista de Bienes en Riesgo.`);
    }
    setTimeout(() => setToastMensaje(null), 4000);
  };

  // Ejecución real del retiro de mercadería
  const handleEjecutarRetiro = () => {
    if (!expedienteSeleccionado) {
      setToastMensaje('Seleccione primero un expediente de bien en riesgo.');
      setTimeout(() => setToastMensaje(null), 4000);
      return;
    }

    const nroOp = expedienteSeleccionado.nro_op;
    const clienteNombre = expedienteSeleccionado.clienteNombre;
    const bienNombre = expedienteSeleccionado.nombreBien;
    const saldoCompensado = expedienteSeleccionado.saldoImpago;

    // 1. Actualizar cartera de operaciones
    try {
      const rawOps = localStorage.getItem('credit_on_cartera_operaciones');
      if (rawOps) {
        const ops = JSON.parse(rawOps);
        const actualizadas = ops.map((op: any) => {
          if (Number(op.nro_op) === Number(nroOp)) {
            return {
              ...op,
              saldo_restante: 0,
              estado_operacion: 'CANCELADO_POR_RECUPERO',
              mora: {
                nivel: 'RECUPERADO',
                mensaje: `Bien retirado en ${depositoReceptor}. Saldo compensado.`,
                cuotas_vencidas_impagas: 0,
                deuda_vencida_total: 0,
                sugerencia_retiro_mercaderia: false,
                dias_mora: 0,
              },
              cuotas: (op.cuotas || []).map((c: any) =>
                c.estado !== 'PAGADA' ? { ...c, estado: 'CANCELADA_POR_RECUPERO' } : c
              ),
              fecha_recupero: new Date().toISOString().split('T')[0],
              motivo_cancelacion: causalRetiro,
              deposito_recupero: depositoReceptor,
            };
          }
          return op;
        });
        localStorage.setItem('credit_on_cartera_operaciones', JSON.stringify(actualizadas));
        setCarteraOperaciones(actualizadas);
      }
    } catch (e) {
      console.warn('Error actualizando cartera tras recupero:', e);
    }

    // 2. Reingresar la unidad física a stock_deposito y restar de stock_calle
    try {
      let encontrado = false;
      const prodsActualizados = productos.map((p) => {
        const coincideNombre =
          p.nombre.toLowerCase().includes(bienNombre.toLowerCase().slice(0, 8)) ||
          bienNombre.toLowerCase().includes(p.nombre.toLowerCase().slice(0, 8));

        if (!encontrado && coincideNombre) {
          encontrado = true;
          const nuevoDep = p.stock_deposito + 1;
          const nuevaCalle = Math.max(0, p.stock_calle - 1);
          return {
            ...p,
            stock_deposito: nuevoDep,
            stock_calle: nuevaCalle,
            valuacion: nuevoDep * p.costo,
            series: [expedienteSeleccionado.serieBien, ...(p.series || [])],
          };
        }
        return p;
      });

      if (!encontrado) {
        const costoEstimado = Math.round(saldoCompensado * 0.65) || 150000;
        const nuevoProdRecuperado: ProductoInventario = {
          id: Date.now(),
          nombre: `[Recuperado] ${bienNombre}`,
          lote: `Lote REC-${nroOp}`,
          icono: 'assignment_return',
          costo: costoEstimado,
          stock_deposito: 1,
          stock_calle: 0,
          valuacion: costoEstimado,
          retorno: 65,
          estado: 'Stock Bajo',
          series: [expedienteSeleccionado.serieBien],
        };
        prodsActualizados.unshift(nuevoProdRecuperado);
      }

      guardarProductos(prodsActualizados);
    } catch (e) {
      console.warn('Error actualizando stock tras recupero:', e);
    }

    // 3. Registrar auditoría en credit_on_historial_cobros
    try {
      const rawHist = localStorage.getItem('credit_on_historial_cobros');
      const hist = rawHist ? JSON.parse(rawHist) : [];
      hist.unshift({
        id_cobro: Date.now(),
        nro_op: nroOp,
        fecha_hora: new Date().toISOString(),
        monto_cobrado: 0,
        cuotas_equivalentes: expedienteSeleccionado.vencidasCount,
        observacion: `Recupero extrajudicial: "${bienNombre}" (${expedienteSeleccionado.serieBien}) de ${clienteNombre}. Reintegrado a ${depositoReceptor}. Saldo compensado: $${saldoCompensado.toLocaleString('es-AR')}. Causal: ${causalRetiro}.`,
        cobradores: { nombre: expedienteSeleccionado.cobrador },
        tipo_accion: 'RECUPERO_MERCADERIA',
      });
      localStorage.setItem('credit_on_historial_cobros', JSON.stringify(hist.slice(0, 100)));
    } catch (e) {
      console.warn('Error registrando auditoría de recupero:', e);
    }

    // 4. Notificar a todo el sistema reactivo
    window.dispatchEvent(new Event('credit_on_storage_update'));

    // 5. Toast de confirmación ejecutoria
    setToastMensaje(
      `¡Retiro efectuado con éxito! El bien "${bienNombre}" reingresó a ${depositoReceptor} (+1 unidad a depósito) y se extinguió el saldo en mora de $${saldoCompensado.toLocaleString('es-AR')} de ${clienteNombre}.`
    );
    setTimeout(() => setToastMensaje(null), 6000);
  };

  const handleCrearProducto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;
    const costoNum = parseFloat(nuevoCosto) || 0;
    const depNum = parseInt(nuevoStockDeposito, 10) || 0;
    const calleNum = parseInt(nuevoStockCalle, 10) || 0;

    const nuevo: ProductoInventario = {
      id: Date.now(),
      nombre: nuevoNombre.trim(),
      lote: `LT-${Math.floor(1000 + Math.random() * 9000)}`,
      icono: inferirIconoProducto(nuevoNombre || nuevaCategoria),
      costo: costoNum,
      stock_deposito: depNum,
      stock_calle: calleNum,
      valuacion: costoNum * depNum,
      retorno: 75,
      estado: depNum > 15 ? 'Stock Alto' : depNum > 3 ? 'Stock Óptimo' : 'Stock Bajo',
      series: [`SN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`],
    };

    const actualizados = [nuevo, ...productos];
    guardarProductos(actualizados);
    setModalNuevoProducto(false);
    setNuevoNombre('');
    setNuevoCosto('150000');
    setNuevoStockDeposito('10');
    setNuevoStockCalle('0');
    setToastMensaje(`Producto "${nuevo.nombre}" agregado con éxito al inventario.`);
    setTimeout(() => setToastMensaje(null), 4000);
  };

  const handleIngresarLote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descCompra.trim()) {
      alert('Por favor ingrese la descripción del bien o mercadería.');
      return;
    }
    const cant = parseInt(cantCompra, 10) || 1;
    const costo = parseFloat(costoCompra) || 0;
    const finBase = parseFloat(financiacionBase) || costo * 1.7;
    const retornoPct = costo > 0 ? Math.round(((finBase - costo) / costo) * 100) : 70;

    let encontrado = false;
    const actualizados = productos.map((p) => {
      if (p.nombre.toLowerCase().trim() === descCompra.toLowerCase().trim()) {
        encontrado = true;
        const nuevoDep = p.stock_deposito + cant;
        return {
          ...p,
          costo: costo > 0 ? costo : p.costo,
          stock_deposito: nuevoDep,
          valuacion: nuevoDep * (costo > 0 ? costo : p.costo),
          retorno: retornoPct,
          estado: (nuevoDep > 15 ? 'Stock Alto' : nuevoDep > 3 ? 'Stock Óptimo' : 'Stock Bajo') as 'Stock Alto' | 'Stock Óptimo' | 'Stock Bajo',
        };
      }
      return p;
    });

    if (!encontrado) {
      const nuevo: ProductoInventario = {
        id: Date.now(),
        nombre: descCompra.trim(),
        lote: `LT-${Math.floor(1000 + Math.random() * 9000)}`,
        icono: inferirIconoProducto(descCompra || categoriaCompra),
        costo,
        stock_deposito: cant,
        stock_calle: 0,
        valuacion: costo * cant,
        retorno: retornoPct,
        estado: (cant > 15 ? 'Stock Alto' : cant > 3 ? 'Stock Óptimo' : 'Stock Bajo') as 'Stock Alto' | 'Stock Óptimo' | 'Stock Bajo',
        series: Array.from({ length: Math.min(cant, 10) }, (_, i) => `LT-${Date.now().toString().slice(-4)}-0${i + 1}`),
      };
      actualizados.unshift(nuevo);
    }

    guardarProductos(actualizados);
    setToastMensaje(`✓ Lote de ${cant} un. de "${descCompra.trim()}" ingresado al depósito central exitosamente.`);
    setTimeout(() => setToastMensaje(null), 5000);
    setDescCompra('');
    setCantidadCompra(1);
  };

  const abrirEditarProducto = (p: ProductoInventario) => {
    setModalEditarProducto(p);
    setEditNombre(p.nombre);
    setEditCosto(p.costo.toString());
    setEditStockDeposito(p.stock_deposito.toString());
    setEditStockCalle(p.stock_calle.toString());
  };

  const handleGuardarEdicion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditarProducto) return;
    const costoNum = parseFloat(editCosto) || 0;
    const depNum = parseInt(editStockDeposito, 10) || 0;
    const calleNum = parseInt(editStockCalle, 10) || 0;

    const actualizados: ProductoInventario[] = productos.map((p) => {
      if (p.id === modalEditarProducto.id) {
        return {
          ...p,
          nombre: editNombre.trim() || p.nombre,
          costo: costoNum,
          stock_deposito: depNum,
          stock_calle: calleNum,
          valuacion: costoNum * depNum,
          estado: (depNum > 15 ? 'Stock Alto' : depNum > 3 ? 'Stock Óptimo' : 'Stock Bajo') as 'Stock Alto' | 'Stock Óptimo' | 'Stock Bajo',
        };
      }
      return p;
    });

    guardarProductos(actualizados);
    setModalEditarProducto(null);
    setToastMensaje(`Producto actualizado correctamente.`);
    setTimeout(() => setToastMensaje(null), 4000);
  };

  const handleEliminarProducto = (id: number) => {
    if (confirm('¿Estás seguro de eliminar este producto del inventario?')) {
      const actualizados = productos.filter((p) => p.id !== id);
      guardarProductos(actualizados);
      setToastMensaje('Producto eliminado del inventario.');
      setTimeout(() => setToastMensaje(null), 4000);
    }
  };

  const handleVaciarInventario = () => {
    if (confirm('¿Deseas vaciar todo el inventario para comenzar desde cero en blanco?')) {
      guardarProductos([]);
      setToastMensaje('Inventario vaciado por completo (en blanco para pruebas).');
      setTimeout(() => setToastMensaje(null), 4000);
    }
  };

  const handleRestaurarDemo = () => {
    guardarProductos(PRODUCTOS_DEMO);
    setToastMensaje('Datos de demostración de inventario restaurados.');
    setTimeout(() => setToastMensaje(null), 4000);
  };

  const handleArchivoExcelSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchivoCargando(true);
    setArchivoError(null);

    try {
      const filas = await parsearCSV(file);
      if (filas.length === 0) {
        throw new Error('El archivo no contiene filas o está vacío.');
      }

      const nuevosProductos: ProductoInventario[] = filas.map((fila, idx) => {
        const nombre =
          obtenerValor(fila, ['nombre', 'producto', 'articulo', 'item', 'descripcion', 'modelo', 'bienes']) ||
          Object.values(fila).find(v => typeof v === 'string' && v.trim().length > 1) ||
          `Producto ${idx + 1}`;

        const cat =
          obtenerValor(fila, ['categoria', 'rubro', 'tipo', 'familia']) || 'Electrodomésticos';

        const costo =
          obtenerNumero(fila, ['costo', 'costo_ars', 'precio', 'valor', 'unitario', 'costo_unitario']) ||
          150000;

        const dep =
          obtenerNumero(fila, ['stock_deposito', 'deposito', 'galpon', 'stock_galpon', 'en_deposito', 'dep']) || 0;

        const calle =
          obtenerNumero(fila, ['stock_calle', 'calle', 'financiado', 'en_calle', 'circulacion']) || 0;

        return {
          id: Date.now() + idx,
          nombre,
          lote: `LT-${Math.floor(1000 + Math.random() * 9000)}`,
          icono: cat.toLowerCase().includes('moto')
            ? 'two_wheeler'
            : cat.toLowerCase().includes('colch') || cat.toLowerCase().includes('mueble')
            ? 'bed'
            : cat.toLowerCase().includes('celular') || cat.toLowerCase().includes('telef')
            ? 'smartphone'
            : 'inventory_2',
          costo,
          stock_deposito: dep,
          stock_calle: calle,
          valuacion: costo * dep,
          retorno: 75,
          estado: (dep > 15 ? 'Stock Alto' : dep > 3 ? 'Stock Óptimo' : 'Stock Bajo') as 'Stock Alto' | 'Stock Óptimo' | 'Stock Bajo',
          series: [`IMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`],
        };
      });

      const combinados = [...nuevosProductos, ...productos];
      guardarProductos(combinados);
      setModalImportarExcel(false);
      setToastMensaje(`¡Se importaron ${nuevosProductos.length} productos desde el archivo exitosamente!`);
      setTimeout(() => setToastMensaje(null), 5000);
    } catch (err: any) {
      setArchivoError(err?.message || 'Error al procesar el archivo CSV/Excel');
    } finally {
      setArchivoCargando(false);
      if (inputExcelRef.current) inputExcelRef.current.value = '';
    }
  };

  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(filtroMatriz.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-24">
      {/* Toast Notificación */}
      {toastMensaje && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-600 text-[24px]">check_circle</span>
            <span className="font-bold text-sm">{toastMensaje}</span>
          </div>
          <button
            onClick={() => setToastMensaje(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-3 py-1 bg-emerald-100/60 rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. TOP HEADER CONTEXT BAR */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 bg-slate-900 text-white font-mono text-[11px] font-bold rounded uppercase tracking-wider">
              Módulo Logístico &amp; Legal
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-mono text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              AUDIT-SYNC ACTIVO
            </span>
          </div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
            Control de Stock Físico, Inventario en Calle &amp; Recupero por Mora
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            Trazabilidad de unidades activas, gestión judicial de secuestros y conciliación de mercadería financiada.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportarReporteCIAL}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-sm"
            title="Exportar archivo Excel (.xlsx) con auditoría CIAL oficial de bienes prendados"
          >
            <span className="material-symbols-outlined text-[18px]">inventory</span>
            <span>Exportar Reporte CIAL</span>
          </button>

          <button
            type="button"
            onClick={() => setModalEscanerIMEI(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
            title="Abrir escáner y rastreador en vivo de números de serie / IMEI"
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
            <span>Escanear IMEI / Serie</span>
          </button>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 2. LAS 5 TARJETAS SUPERIORES DE KPIS LOGÍSTICOS */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Valuación en Depósito */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Valuación Depósito</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">warehouse</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900">
              ARS ${totalValuacionDeposito.toLocaleString('es-AR')}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600 font-bold">
              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
              <span>+4.2%</span>
              <span className="text-slate-400 font-normal">vs. cierre anterior</span>
            </div>
          </div>
        </div>

        {/* Card 2: Capital Financiado */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Capital Financiado</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">storefront</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-emerald-700">
              ARS ${totalCapitalFinanciado.toLocaleString('es-AR')}
            </div>
            <div className="text-xs text-slate-400 mt-1">Valor de colocación activa</div>
          </div>
        </div>

        {/* Card 3: Stock en Galpón */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Stock en Galpón</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">shelves</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900">
              {totalUnidadesDeposito} <span className="text-xs font-normal text-slate-400">un.</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-slate-900 h-full rounded-full"
                style={{ width: `${Math.min(100, Math.round((totalUnidadesDeposito / (totalUnidadesDeposito + totalUnidadesCalle || 1)) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Mercadería en Calle */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Mercadería en Calle</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">local_shipping</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900">
              {totalUnidadesCalle} <span className="text-xs font-normal text-slate-400">un.</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{Math.max(0, totalUnidadesCalle - 5)} contratadas sin mora</span>
            </div>
          </div>
        </div>

        {/* Card 5: Bienes en Riesgo (Interactivo) */}
        <div
          onClick={() => setModalBienesEnRiesgo(true)}
          role="button"
          tabIndex={0}
          title="Haga clic para ver el listado de bienes en riesgo y quién los tiene"
          className="bg-rose-50 hover:bg-rose-100/70 p-5 rounded-2xl shadow-sm border border-rose-200 hover:border-rose-300 transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
        >
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-rose-700">
              Bienes en Riesgo
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 group-hover:bg-rose-200 text-rose-700 flex items-center justify-center transition">
              <span className="material-symbols-outlined text-[18px]">gavel</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-rose-700 flex items-baseline gap-1.5">
              <span>{bienesEnRiesgo.length}</span>
              <span className="text-xs font-normal text-rose-600">artículos en calle</span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-rose-200/60 text-xs font-bold text-rose-700">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">list_alt</span>
                Ver quién los tiene
              </span>
              <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. DOS PANELES OPERATIVOS: RECUPERO POR MORA (7 cols) & INGRESO DE COMPRAS (5 cols) */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Columna Izquierda: Protocolo de Recupero de Mercadería (7 cols) */}
        <div id="protocolo-recupero" className="xl:col-span-7 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-rose-200 space-y-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">unfold_more_double</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Protocolo de Recupero de Mercadería por Incumplimiento
                </h3>
                <p className="text-xs text-slate-500">
                  Secuestro extrajudicial, restitución a stock y extinción de deuda
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalBienesEnRiesgo(true)}
                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition flex items-center gap-1"
                title="Abrir listado de bienes en riesgo"
              >
                <span className="material-symbols-outlined text-[15px]">list_alt</span>
                <span>Bienes en Riesgo ({bienesEnRiesgo.length})</span>
              </button>
              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg uppercase tracking-wider">
                Acción Ejecutoria
              </span>
            </div>
          </div>

          {/* Selector Rápido y Buscador de Expedientes en Mora */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px] flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-rose-600">emergency</span>
                Expedientes de Bienes en Mora Reclamables:
              </span>
              <button
                type="button"
                onClick={() => setModalBienesEnRiesgo(true)}
                className="text-rose-600 hover:text-rose-800 font-bold hover:underline text-[11px]"
              >
                Ver quién tiene cada bien →
              </button>
            </div>

            {/* Dropdown de 1 clic para cambiar de expediente */}
            <select
              value={expedienteSeleccionado?.nro_op || ''}
              onChange={(e) => {
                const encontrado = bienesEnRiesgo.find((b) => b.nro_op === Number(e.target.value));
                if (encontrado) {
                  setExpedienteSeleccionado(encontrado);
                  setOpRecupero(encontrado.opFormateada);
                  setToastMensaje(`Expediente de ${encontrado.clienteNombre} cargado.`);
                  setTimeout(() => setToastMensaje(null), 3000);
                }
              }}
              className="w-full bg-slate-50 border border-slate-300 focus:border-rose-400 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none transition"
            >
              {bienesEnRiesgo.map((b) => (
                <option key={b.nro_op} value={b.nro_op}>
                  {b.opFormateada} — {b.clienteNombre} ({b.nombreBien} | Deuda: ${b.saldoImpago.toLocaleString('es-AR')} | {b.diasMora}d mora)
                </option>
              ))}
            </select>

            {/* Buscador libre por N° OP, Cliente o DNI */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={opRecupero}
                  onChange={(e) => setOpRecupero(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleValidarExpediente()}
                  placeholder="Buscar por OP (ej. #OP-105), nombre de cliente o DNI..."
                  className="w-full bg-slate-50 border border-slate-300 focus:border-rose-400 focus:bg-white pl-10 pr-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none transition"
                />
              </div>
              <button
                type="button"
                onClick={handleValidarExpediente}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">manage_search</span>
                <span>Buscar Expediente</span>
              </button>
            </div>
          </div>

          {/* Ficha Dinámica del Expediente Seleccionado */}
          <div className="bg-rose-50/50 rounded-2xl p-5 border border-rose-200/80 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-rose-200/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">person_off</span>
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">
                    {expedienteSeleccionado?.clienteNombre || 'CLIENTE NO SELECCIONADO'}{' '}
                    <span className="text-xs font-normal text-slate-500 font-mono">
                      (DNI: {expedienteSeleccionado?.clienteDni || '-'})
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[14px] text-rose-600">pin_drop</span>
                    <span>{expedienteSeleccionado?.domicilio || 'Domicilio de cobro'}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 text-rose-700 text-xs font-bold uppercase font-mono">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                  {expedienteSeleccionado?.diasMora || 0} DÍAS EN MORA ({expedienteSeleccionado?.vencidasCount || 0} cuotas)
                </span>
                <div className="text-sm font-bold font-mono text-rose-700">
                  Saldo impago: ARS ${(expedienteSeleccionado?.saldoImpago || 0).toLocaleString('es-AR')}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-rose-200/70 space-y-1">
                <span className="font-bold uppercase tracking-wider text-slate-400 block text-[10px]">
                  Bien Prendado a Recuperar
                </span>
                <div className="font-bold text-slate-900">
                  {expedienteSeleccionado?.nombreBien || 'Artículo Comercial'}
                </div>
                <div className="font-mono text-slate-500 text-[11px]">
                  IMEI / SERIE: {expedienteSeleccionado?.serieBien || 'SN-REGISTRADO'}
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-rose-200/70 space-y-1">
                <span className="font-bold uppercase tracking-wider text-slate-400 block text-[10px]">
                  Cobrador y Contacto
                </span>
                <div className="font-bold text-slate-900 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-emerald-600">badge</span>
                  <span>{expedienteSeleccionado?.cobrador || 'Sin cobrador'}</span>
                </div>
                <div className="text-slate-500 font-mono text-[11px]">
                  Tel: {expedienteSeleccionado?.clienteTel || 'No registrado'}
                </div>
              </div>
            </div>
          </div>

          {/* Selectores de Parámetros de Retiro */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Causal de Retiro
              </label>
              <select
                value={causalRetiro}
                onChange={(e) => setCausalRetiro(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-rose-400 p-2.5 rounded-xl text-slate-800 font-medium focus:outline-none transition"
              >
                <option value="Incumplimiento contractual reiterado">Incumplimiento reiterado</option>
                <option value="Renuncia voluntaria deudor">Renuncia voluntaria deudor</option>
                <option value="Orden de secuestro ejecutorio">Orden de secuestro ejecutorio</option>
              </select>
            </div>

            <div>
              <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Estado de Recepción
              </label>
              <select
                value={estadoBien}
                onChange={(e) => setEstadoBien(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-rose-400 p-2.5 rounded-xl text-slate-800 font-medium focus:outline-none transition"
              >
                <option value="Buen estado (Operativo)">Buen estado (Operativo)</option>
                <option value="Detalles cosméticos (Desgaste menor)">Detalles cosméticos</option>
                <option value="Requiere servicio técnico / Incompleto">Requiere servicio técnico</option>
              </select>
            </div>

            <div>
              <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Depósito Receptor
              </label>
              <select
                value={depositoReceptor}
                onChange={(e) => setDepositoReceptor(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-rose-400 p-2.5 rounded-xl text-slate-800 font-medium focus:outline-none transition"
              >
                <option value="Galpón Central Alberdi #340">Galpón Central Alberdi #340</option>
                <option value="Depósito Sur - Calle La Plata 820">Depósito Sur - La Plata 820</option>
                <option value="Taller de Servicio Oficial">Taller de Servicio Oficial</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={handleEjecutarRetiro}
              className="w-full py-3.5 px-6 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition"
            >
              <span className="material-symbols-outlined text-[20px]">assignment_return</span>
              <span>
                Registrar Retiro de "{expedienteSeleccionado?.nombreBien || 'Mercadería'}" por Falta de Pago
              </span>
            </button>

            <div className="text-center text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/70 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified_user</span>
              <span>
                Efecto: Devuelve automáticamente 1 unidad al inventario bajo '{depositoReceptor}' (+1 un. en depósito) y extingue el saldo en mora de ${(expedienteSeleccionado?.saldoImpago || 0).toLocaleString('es-AR')}.
              </span>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Ingreso de Mercadería (5 cols) */}
        <div className="xl:col-span-5 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">add_business</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Ingreso de Mercadería</h3>
                <p className="text-xs text-slate-500">Alta de stock por compra directa a mayoristas</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold font-mono rounded-lg">
              Lote Nuevo
            </span>
          </div>

          <form onSubmit={handleIngresarLote} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">Categoría</label>
                <select
                  value={categoriaCompra}
                  onChange={(e) => setCategoriaCompra(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-800 font-medium focus:outline-none transition"
                >
                  <option value="Electrodomésticos">Electrodomésticos</option>
                  <option value="Muebles &amp; Colchonería">Muebles &amp; Colchonería</option>
                  <option value="Motos / Rodados">Motos / Rodados</option>
                  <option value="Telefonía Celular">Telefonía Celular</option>
                </select>
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">Proveedor Oficial</label>
                <input
                  type="text"
                  value={proveedorCompra}
                  onChange={(e) => setProveedorCompra(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-800 font-medium focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">Descripción del Producto</label>
              <input
                type="text"
                value={descCompra}
                onChange={(e) => setDescCompra(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-800 font-medium focus:outline-none transition"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={cantidadCompra}
                  onChange={(e) => setCantidadCompra(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-900 font-mono font-bold focus:outline-none transition"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">Costo Unit. ($)</label>
                <input
                  type="number"
                  value={costoCompra}
                  onChange={(e) => setCostoCompra(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-900 font-mono font-bold focus:outline-none transition"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">Financiación Base</label>
                <input
                  type="number"
                  value={financiacionBase}
                  onChange={(e) => setFinanciacionBase(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-emerald-700 font-mono font-bold focus:outline-none transition"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Inversión Total de Lote:</span>
                <span className="text-base font-bold font-mono text-slate-900">
                  ARS ${(cantidadCompra * costoCompra).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Margen Teórico:</span>
                <span className="text-sm font-bold font-mono text-emerald-600">
                  +{costoCompra > 0 ? (((financiacionBase - costoCompra) / costoCompra) * 100).toFixed(1) : '0.0'}% retorno
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition"
            >
              <span className="material-symbols-outlined text-[18px]">post_add</span>
              <span>Ingresar al Inventario Físico</span>
            </button>
          </form>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. MATRIZ DE INVENTARIO FÍSICO VS. CALLE FINANCIADA (TABLA COMPLETA) */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">table_chart_view</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Matriz de Inventario Físico vs. Calle Financiada
              </h3>
              <p className="text-xs text-slate-500">
                Visualización comparativa de stock cautivo en depósito contra rotación activa en cartera de clientes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                filter_list
              </span>
              <input
                type="text"
                value={filtroMatriz}
                onChange={(e) => setFiltroMatriz(e.target.value)}
                placeholder="Filtrar inventario..."
                className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white rounded-xl text-xs text-slate-800 focus:outline-none transition w-48"
              />
            </div>

            <button
              type="button"
              onClick={() => setModalNuevoProducto(true)}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Crear un nuevo producto individual"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Nuevo Producto</span>
            </button>

            <button
              type="button"
              onClick={() => setModalImportarExcel(true)}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Importar varios productos desde archivo Excel/CSV"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              <span>Subir Excel</span>
            </button>

            <button
              type="button"
              onClick={() => descargarPlantillaCSV('productos')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200"
              title="Descargar plantilla de ejemplo de Excel/CSV para rellenar"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Plantilla Ejemplo</span>
            </button>

            <button
              type="button"
              onClick={handleVaciarInventario}
              className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-rose-200"
              title="Dejar en blanco todo el inventario para pruebas"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              <span>Vaciar</span>
            </button>

            <button
              type="button"
              onClick={handleRestaurarDemo}
              className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition flex items-center gap-1"
              title="Restaurar datos de prueba por defecto"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Demo</span>
            </button>
          </div>
        </div>

        {/* Tabla Espaciosa con Todos los Datos */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Producto / Referencia Técnica</th>
                <th className="py-3 px-4 text-right">Costo Unit. ($)</th>
                <th className="py-3 px-4 text-center">En Depósito</th>
                <th className="py-3 px-4 text-center">En Calle</th>
                <th className="py-3 px-4 text-right">Valuación Depósito</th>
                <th className="py-3 px-4 text-center">Tasa Retorno</th>
                <th className="py-3 px-4 text-center">Estado Stock</th>
                <th className="py-3 px-4 text-right">Acciones Directas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="material-symbols-outlined text-4xl text-slate-300">inventory_2</span>
                      <p className="font-semibold text-sm text-slate-700">No hay productos en el inventario</p>
                      <p className="text-xs text-slate-400 max-w-md">
                        El catálogo está en blanco. Puedes agregar productos manualmente, cargar una hoja de Excel o restaurar los datos de prueba.
                      </p>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => setModalNuevoProducto(true)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">add</span>
                          <span>+ Nuevo Producto</span>
                        </button>
                        <button
                          onClick={() => setModalImportarExcel(true)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">upload_file</span>
                          <span>Subir Excel</span>
                        </button>
                        <button
                          onClick={handleRestaurarDemo}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                          <span>Restaurar Demo</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-[18px]">{p.icono}</span>
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{p.nombre}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{p.lote}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                      ${p.costo.toLocaleString('es-AR')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono font-bold">
                        {p.stock_deposito} un.
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-100">
                        {p.stock_calle} un.
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ${p.valuacion.toLocaleString('es-AR')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1 font-mono font-bold text-emerald-600">
                        <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        <span>{p.retorno}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          p.estado === 'Stock Óptimo'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.estado === 'Stock Bajo'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            p.estado === 'Stock Óptimo'
                              ? 'bg-emerald-500'
                              : p.estado === 'Stock Bajo'
                              ? 'bg-rose-500'
                              : 'bg-slate-400'
                          }`}
                        />
                        {p.estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => abrirEditarProducto(p)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition"
                          title="Editar Producto y Stocks"
                        >
                          <span className="material-symbols-outlined text-[17px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminarProducto(p.id)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                          title="Eliminar del inventario"
                        >
                          <span className="material-symbols-outlined text-[17px]">delete</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalSeries({ nombre: p.nombre, series: p.series })}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                          title="Ver Números de Serie / IMEI"
                        >
                          <span className="material-symbols-outlined text-[17px]">barcode</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => alert(`Reasignando unidad de ${p.nombre} a nuevo crédito en trámite...`)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                          title="Reasignar a Nuevo Crédito"
                        >
                          <span className="material-symbols-outlined text-[13px]">sync_alt</span>
                          <span>Reasignar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal de Trazabilidad de Números de Serie */}
      {modalSeries && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-800 text-[22px]">fingerprint</span>
                <h4 className="font-bold text-sm text-slate-900">{modalSeries.nombre}</h4>
              </div>
              <button
                onClick={() => setModalSeries(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Listado de unidades únicas registradas en el libro mayor de garantías prendarias:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto bg-slate-50 p-3 rounded-xl border border-slate-200/70">
              {modalSeries.series.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 text-xs font-mono">
                  <span className="text-slate-800 font-bold">{s}</span>
                  <span className="text-emerald-600 font-bold text-[10px]">ACTIVO</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalSeries(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Escáner y Rastreador de IMEI / Series */}
      {modalEscanerIMEI && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">qr_code_scanner</span>
                </div>
                <div>
                  <h3 className="font-black text-base text-white tracking-tight">
                    Rastreador &amp; Escáner de IMEI / Serie
                  </h3>
                  <p className="text-xs text-slate-300">
                    Trazabilidad de unidades físicas en depósito y mercadería prendada en calle
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalEscanerIMEI(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Pestañas de Navegación */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setTabEscaner('buscar')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
                  tabEscaner === 'buscar'
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">search</span>
                <span>Rastrear &amp; Escanear ({seriesRegistradas.length} series)</span>
              </button>
              <button
                type="button"
                onClick={() => setTabEscaner('asignar')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
                  tabEscaner === 'asignar'
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Vincular Nuevo IMEI a Inventario</span>
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {tabEscaner === 'buscar' && (
                <div className="space-y-4">
                  {/* Buscador / Escáner directo */}
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">
                      qr_code_scanner
                    </span>
                    <input
                      type="text"
                      autoFocus
                      value={busquedaIMEI}
                      onChange={(e) => setBusquedaIMEI(e.target.value)}
                      placeholder="Escanee código de barras o ingrese serie/IMEI (ej: SN-105-4255, NBX...)"
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 hover:bg-slate-50 pl-11 pr-10 py-3.5 text-sm font-mono text-slate-900 outline-none transition focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
                    />
                    {busquedaIMEI && (
                      <button
                        type="button"
                        onClick={() => setBusquedaIMEI('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span>
                      Mostrando <strong className="text-slate-800 font-mono">{seriesFiltradas.length}</strong> de{' '}
                      {seriesRegistradas.length} series registradas
                    </span>
                    <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">
                      Lector láser activo / Entrada manual
                    </span>
                  </div>

                  {/* Listado de Resultados */}
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {seriesFiltradas.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                        <span className="material-symbols-outlined text-slate-400 text-4xl">search_off</span>
                        <p className="text-xs font-bold text-slate-700">No se encontró ninguna unidad con "{busquedaIMEI}"</p>
                        <p className="text-[11px] text-slate-500">
                          Puedes registrar este IMEI vinculándolo a un producto desde la pestaña "Vincular Nuevo IMEI".
                        </p>
                      </div>
                    ) : (
                      seriesFiltradas.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-white p-3.5 rounded-2xl border border-slate-200/80 hover:border-slate-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-slate-900 tracking-tight">
                                {item.serie}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                  item.ubicacion === 'CALLE'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {item.ubicacion === 'CALLE' ? 'En Calle (Cliente)' : 'En Galpón Central'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 font-semibold truncate">
                              {item.producto}
                            </p>

                            {item.ubicacion === 'CALLE' && item.titular && (
                              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                <span>Titular: <strong className="text-slate-800">{item.titular}</strong></span>
                                {item.nro_op && <span>OP: <strong className="font-mono text-slate-700">#{item.nro_op}</strong></span>}
                                {item.saldo && (
                                  <span className="text-rose-600 font-bold font-mono">
                                    Deuda: ${item.saldo.toLocaleString('es-AR')}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {item.ubicacion === 'CALLE' && item.bienRiesgo && (
                            <button
                              type="button"
                              onClick={() => {
                                seleccionarExpediente(item.bienRiesgo!);
                                setModalEscanerIMEI(false);
                              }}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1 shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[16px]">gavel</span>
                              <span>Cargar en Retiro</span>
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {tabEscaner === 'asignar' && (
                <form onSubmit={handleVincularNuevoIMEI} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Seleccionar Producto de Inventario:
                    </label>
                    <select
                      value={prodSeleccionadoAsignar}
                      onChange={(e) => setProdSeleccionadoAsignar(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white text-sm font-semibold text-slate-800 px-3.5 py-2.5 rounded-xl focus:outline-none transition shadow-sm"
                    >
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} (Lote: {p.lote} — Stock: {p.stock_deposito} un.)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Números de Serie / IMEI a Vincular:
                    </label>
                    <textarea
                      rows={4}
                      value={nuevoIMEITexto}
                      onChange={(e) => setNuevoIMEITexto(e.target.value)}
                      placeholder="Ingrese o escanee con pistola láser las series (puede ingresar varias separadas por coma o salto de línea, ej:&#10;IMEI-358920119283401&#10;IMEI-358920119283402)"
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 p-3.5 text-xs font-mono text-slate-900 outline-none transition focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      💡 Puede disparar el lector de código de barras sucesivamente para acumular números de serie en el campo.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setTabEscaner('buscar')}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[17px]">save</span>
                      <span>Vincular al Inventario</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
              <span>Auditoría de Garantías Prendarias CREDIT-ON</span>
              <button
                type="button"
                onClick={() => setModalEscanerIMEI(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Producto Individual */}
      {modalNuevoProducto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">add_box</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Agregar Nuevo Producto</h4>
                  <p className="text-[11px] text-slate-500">Alta individual al inventario de stock</p>
                </div>
              </div>
              <button
                onClick={() => setModalNuevoProducto(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCrearProducto} className="space-y-4 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Nombre del Producto / Modelo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Smart TV Philco 43 FHD"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-900 font-medium focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Categoría
                  </label>
                  <select
                    value={nuevaCategoria}
                    onChange={(e) => setNuevaCategoria(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-800 font-medium focus:outline-none transition"
                  >
                    <option value="Electrodomésticos">Electrodomésticos</option>
                    <option value="Muebles &amp; Colchonería">Muebles &amp; Colchonería</option>
                    <option value="Motos / Rodados">Motos / Rodados</option>
                    <option value="Telefonía Celular">Telefonía Celular</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Costo Unitario ($) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="150000"
                    value={nuevoCosto}
                    onChange={(e) => setNuevoCosto(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-900 font-mono font-bold focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Stock Inicial en Depósito
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={nuevoStockDeposito}
                    onChange={(e) => setNuevoStockDeposito(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-900 font-mono font-bold focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Stock Inicial en Calle (Financiado)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={nuevoStockCalle}
                    onChange={(e) => setNuevoStockCalle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-900 font-mono font-bold focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNuevoProducto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Guardar Producto</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Producto */}
      {modalEditarProducto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Editar Producto</h4>
                  <p className="text-[11px] text-slate-500">Modificar datos y niveles de stock</p>
                </div>
              </div>
              <button
                onClick={() => setModalEditarProducto(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="space-y-4 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Nombre del Producto
                </label>
                <input
                  type="text"
                  required
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 p-2.5 rounded-xl text-slate-900 font-medium focus:outline-none transition"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Costo Unitario ($)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editCosto}
                  onChange={(e) => setEditCosto(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 p-2.5 rounded-xl text-slate-900 font-mono font-bold focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Stock en Depósito (un.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editStockDeposito}
                    onChange={(e) => setEditStockDeposito(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 p-2.5 rounded-xl text-slate-900 font-mono font-bold focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Stock en Calle (un.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editStockCalle}
                    onChange={(e) => setEditStockCalle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 p-2.5 rounded-xl text-slate-900 font-mono font-bold focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEditarProducto(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Importar Excel / CSV */}
      {modalImportarExcel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">upload_file</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Importar Productos desde Excel</h4>
                  <p className="text-[11px] text-slate-500">Carga masiva por archivo CSV o Excel (.csv / .xlsx)</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalImportarExcel(false);
                  setArchivoError(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">info</span>
                  Formato de la Hoja de Cálculo
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  El archivo debe contener las siguientes columnas (puedes descargarte nuestra plantilla de ejemplo en Excel/CSV):
                </p>
                <div className="font-mono text-[11px] bg-white p-2.5 rounded-lg border border-slate-200 text-slate-800 font-bold">
                  Nombre ; Categoria ; Costo ; Stock Deposito ; Stock Calle
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 text-xs block">¿No tienes el archivo listo?</span>
                  <span className="text-[11px] text-slate-500">Descarga la plantilla con ejemplos reales.</span>
                </div>
                <button
                  type="button"
                  onClick={() => descargarPlantillaCSV('productos')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[15px]">download</span>
                  <span>Descargar Plantilla</span>
                </button>
              </div>

              {/* Zona de Selección de Archivo */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition bg-slate-50/50">
                <input
                  ref={inputExcelRef}
                  type="file"
                  accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleArchivoExcelSeleccionado}
                  className="hidden"
                  id="input-archivo-stock"
                />
                <label
                  htmlFor="input-archivo-stock"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <span className="material-symbols-outlined text-4xl text-emerald-600">cloud_upload</span>
                  <span className="font-bold text-slate-800 text-xs">
                    {archivoCargando ? 'Procesando archivo...' : 'Haz clic aquí para seleccionar tu archivo Excel o CSV'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Soporta archivos Excel nativos (.xlsx / .xls) y hojas CSV (.csv)
                  </span>
                </label>
              </div>

              {archivoError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{archivoError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setModalImportarExcel(false);
                  setArchivoError(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Escaneo & Trazabilidad de Series / IMEI */}
      {modalEscanerIMEI && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-slate-50 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header del Modal */}
            <div className="p-5 sm:p-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">qr_code_scanner</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Centro de Escaneo &amp; Trazabilidad de Series
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Búsqueda con pistola lectora o ingreso manual de IMEI y vinculación a lotes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalEscanerIMEI(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Pestañas: Rastrear vs Vincular */}
            <div className="bg-white border-b border-slate-200 px-6 pt-3 flex gap-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTabEscaner('buscar')}
                className={`pb-3 border-b-2 flex items-center gap-2 transition ${
                  tabEscaner === 'buscar'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">search</span>
                <span>Rastrear &amp; Escanear</span>
              </button>
              <button
                type="button"
                onClick={() => setTabEscaner('asignar')}
                className={`pb-3 border-b-2 flex items-center gap-2 transition ${
                  tabEscaner === 'asignar'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">add_link</span>
                <span>Vincular a Lote</span>
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {tabEscaner === 'buscar' ? (
                <div className="space-y-4">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                      barcode_scanner
                    </span>
                    <input
                      type="text"
                      autoFocus
                      value={busquedaIMEI}
                      onChange={(e) => setBusquedaIMEI(e.target.value)}
                      placeholder="Apuntá con la pistola lectora o escribí el IMEI / número de serie..."
                      className="w-full bg-white border border-slate-300 focus:border-emerald-500 pl-11 pr-4 py-3 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition shadow-inner"
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Resultados de Series ({seriesFiltradas.length})
                    </span>
                    <div className="max-h-72 overflow-y-auto space-y-2 divide-y divide-slate-100">
                      {seriesFiltradas.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-400">
                          No se encontraron series que coincidan con "{busquedaIMEI}".
                        </div>
                      ) : (
                        seriesFiltradas.map((item, idx) => (
                          <div
                            key={`${item.serie}-${idx}`}
                            className="pt-2 first:pt-0 flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200/80 hover:border-slate-300 transition"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-slate-900">
                                  {item.serie}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    item.ubicacion === 'GALPON'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-indigo-100 text-indigo-800'
                                  }`}
                                >
                                  {item.ubicacion === 'GALPON' ? 'EN DEPÓSITO' : 'EN CALLE (PRENDADO)'}
                                </span>
                              </div>
                              <div className="text-xs text-slate-600 mt-0.5">
                                {item.producto}
                                {item.titular && ` • Titular: ${item.titular}`}
                                {item.saldo ? ` • Deuda: $${item.saldo.toLocaleString('es-AR')}` : ''}
                              </div>
                            </div>

                            {item.bienRiesgo && (
                              <button
                                type="button"
                                onClick={() => {
                                  seleccionarExpediente(item.bienRiesgo!);
                                  setModalEscanerIMEI(false);
                                }}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shrink-0"
                              >
                                Cargar en Retiro
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Seleccionar Producto para Vincular Series
                    </label>
                    <select
                      value={prodSeleccionadoAsignar}
                      onChange={(e) => setProdSeleccionadoAsignar(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 focus:border-emerald-500 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-900 focus:outline-none transition"
                    >
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} (Stock actual: {p.stock} un.)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Pegá o escaneá una lista de números de serie
                    </label>
                    <textarea
                      rows={5}
                      value={nuevoIMEITexto}
                      onChange={(e) => setNuevoIMEITexto(e.target.value)}
                      placeholder="SN-1001&#10;SN-1002&#10;SN-1003"
                      className="w-full bg-white border border-slate-300 focus:border-emerald-500 p-3 rounded-xl text-xs font-mono text-slate-900 focus:outline-none transition"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Podés escanear con la pistola código de barras / QR directamente aquí una serie por línea.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nuevas = nuevoIMEITexto
                        .split(/[\n,;]/)
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0);
                      if (nuevas.length === 0) return;
                      setProductos((prev) =>
                        prev.map((p) =>
                          p.id === prodSeleccionadoAsignar
                            ? { ...p, series: Array.from(new Set([...(p.series || []), ...nuevas])) }
                            : p
                        )
                      );
                      setNuevoIMEITexto('');
                      setToastMensaje(`Se vincularon ${nuevas.length} series al producto.`);
                      setTimeout(() => setToastMensaje(null), 4000);
                      setTabEscaner('buscar');
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                  >
                    Guardar y Vincular Series
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setModalEscanerIMEI(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bienes Financiados en Riesgo de Recupero */}
      {modalBienesEnRiesgo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-slate-50 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header del Modal */}
            <div className="p-5 sm:p-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">gavel</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900">
                      Bienes Financiados en Riesgo de Recupero
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      {bienesEnRiesgo.length} {bienesEnRiesgo.length === 1 ? 'artículo' : 'artículos'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Detalle de clientes en mora y artículos retirables. Seleccione un caso para cargar su expediente en el protocolo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalBienesEnRiesgo(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Barra de Búsqueda y Filtros */}
            <div className="p-4 bg-white border-b border-slate-200/80 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={filtroBienesTexto}
                  onChange={(e) => setFiltroBienesTexto(e.target.value)}
                  placeholder="Buscar por cliente, DNI, producto, serie, domicilio o cobrador..."
                  className="w-full bg-slate-50 border border-slate-300 focus:border-rose-400 focus:bg-white pl-10 pr-9 py-2 rounded-xl text-xs font-medium text-slate-900 focus:outline-none transition"
                />
                {filtroBienesTexto && (
                  <button
                    onClick={() => setFiltroBienesTexto('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                  </button>
                )}
              </div>

              {/* Pestañas de Filtro */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setFiltroBienesTab('TODOS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filtroBienesTab === 'TODOS'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({bienesEnRiesgo.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroBienesTab('CRITICOS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    filtroBienesTab === 'CRITICOS'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  <span>Críticos ({bienesEnRiesgo.filter((b) => b.esCritico).length})</span>
                </button>
              </div>
            </div>

            {/* Listado de Bienes y Titulares (Scrollable) */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 flex-1">
              {(() => {
                const lista = bienesEnRiesgo.filter((b) => {
                  if (filtroBienesTab === 'CRITICOS' && !b.esCritico) return false;
                  if (!filtroBienesTexto.trim()) return true;
                  const q = filtroBienesTexto.toLowerCase();
                  return (
                    b.clienteNombre.toLowerCase().includes(q) ||
                    b.nombreBien.toLowerCase().includes(q) ||
                    b.clienteDni.toLowerCase().includes(q) ||
                    b.domicilio.toLowerCase().includes(q) ||
                    b.cobrador.toLowerCase().includes(q) ||
                    b.opFormateada.toLowerCase().includes(q) ||
                    b.serieBien.toLowerCase().includes(q)
                  );
                });

                if (lista.length === 0) {
                  return (
                    <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                      <span className="material-symbols-outlined text-4xl text-slate-300">search_off</span>
                      <p className="font-bold text-slate-700 text-sm">
                        No se encontraron bienes en riesgo con esos criterios
                      </p>
                      <p className="text-xs text-slate-400">
                        Prueba borrando el texto de búsqueda o cambiando a la pestaña "Todos".
                      </p>
                    </div>
                  );
                }

                return lista.map((b) => {
                  const esActual = expedienteSeleccionado?.nro_op === b.nro_op;

                  return (
                    <div
                      key={b.nro_op}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                        esActual
                          ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-400/30 shadow-md'
                          : b.esCritico
                          ? 'bg-white hover:bg-rose-50/30 border-rose-200 hover:border-rose-300 shadow-sm'
                          : 'bg-white hover:bg-slate-50/60 border-slate-200 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      {/* Fila Superior: Producto, OP, Serie y Nivel de Alerta */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="material-symbols-outlined text-indigo-600 text-[20px]">
                            devices_other
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {b.nombreBien}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-xs text-slate-700 border border-slate-200">
                            {b.opFormateada}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-50 font-mono text-[11px] text-slate-500 border border-slate-200">
                            S/N: {b.serieBien}
                          </span>
                        </div>

                        <div>
                          {b.esCritico ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                              Retiro Recomendado ({b.diasMora}d mora)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              En Alerta ({b.diasMora}d mora)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Grid Central: Quién lo tiene / Dónde está / Cuánto debe */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 my-3.5 p-3.5 bg-slate-50/70 rounded-xl border border-slate-100">
                        {/* Columna 1: Titular del Crédito */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Quién lo tiene (Titular)
                          </span>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-indigo-600">person</span>
                            <span>{b.clienteNombre}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            DNI: <span className="text-slate-700 font-bold">{b.clienteDni}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-slate-400">call</span>
                            <span>{b.clienteTel}</span>
                          </div>
                        </div>

                        {/* Columna 2: Domicilio de Retiro & Cobrador */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Ubicación Física &amp; Zona
                          </span>
                          <div className="text-xs text-slate-800 font-medium flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-rose-500 shrink-0 mt-0.5">pin_drop</span>
                            <span>{b.domicilio}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            Cobrador a cargo: <span className="font-bold text-slate-700">{b.cobrador}</span>
                          </div>
                        </div>

                        {/* Columna 3: Saldo y Cuotas Impagas */}
                        <div className="space-y-1 md:border-l md:border-slate-200 md:pl-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Incumplimiento &amp; Saldo
                          </span>
                          <div className="font-mono text-sm font-black text-rose-700">
                            ${b.saldoImpago.toLocaleString('es-AR')}
                          </div>
                          <div className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            <span>{b.vencidasCount} cuotas vencidas impagas</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Estado legal: Mora grave extrajudicial
                          </div>
                        </div>
                      </div>

                      {/* Fila Inferior: Botón de Acción Directa */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-slate-400 text-[16px]">info</span>
                          <span>Al seleccionar, se cargará automáticamente en el formulario de retiro.</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => seleccionarExpediente(b)}
                          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm ${
                            esActual
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-rose-600 hover:bg-rose-700 text-white active:scale-95'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {esActual ? 'check_circle' : 'gavel'}
                          </span>
                          <span>
                            {esActual ? 'Expediente Actualmente Cargado' : 'Cargar en Protocolo de Retiro →'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer del Modal */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 text-[11px]">
                💡 Tip: Puede dar de baja definitiva la deuda y reintegrar el bien físico pulsando "Ejecutar Retiro y Restitución" en el formulario de protocolo.
              </span>
              <button
                type="button"
                onClick={() => setModalBienesEnRiesgo(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition self-end sm:self-auto"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notificación Flotante */}
      {toastMensaje && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200 max-w-md">
          <span className="material-symbols-outlined text-emerald-400 text-[20px] shrink-0">
            check_circle
          </span>
          <span className="text-xs font-medium leading-relaxed">{toastMensaje}</span>
          <button
            type="button"
            onClick={() => setToastMensaje(null)}
            className="text-slate-400 hover:text-white text-xs ml-auto shrink-0 pl-2"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
};
