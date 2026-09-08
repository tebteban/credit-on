import React, { useState, useMemo, useEffect } from 'react';
import {
  generarCronograma,
  calcularFechaFin,
  calcularDiasCorridos,
  toISODate,
  PLANES_PRODUCTO_OFICIALES,
  PLANES_EFECTIVO_OFICIALES,
  calcularCuotaProducto,
  calcularCuotaEfectivo,
} from '@core/calendar-engine';
import { crearOperacionEnSupabase } from '../lib/supabase';
import { inferirIconoProducto } from '../utils/producto-helper';

export const AltaOperacion: React.FC = () => {
  const [modoComercial, setModoComercial] = useState<'cash' | 'goods'>('cash');
  const [clienteNombre, setClienteNombre] = useState<string>('');
  const [clienteDni, setClienteDni] = useState<string>('');
  const [clienteCuit, setClienteCuit] = useState<string>('');
  const [clienteDomicilio, setClienteDomicilio] = useState<string>('');
  const [clienteReferencia, setClienteReferencia] = useState<string>('');
  const [clienteTelefono, setClienteTelefono] = useState<string>('');
  const [cobradorSeleccionado, setCobradorSeleccionado] = useState<string>('Zona Sur - Álvaro');

  // Estado para búsqueda y selección de cliente en cartera
  const [busquedaCliente, setBusquedaCliente] = useState<string>('');
  const [mostrarDropdownClientes, setMostrarDropdownClientes] = useState<boolean>(false);
  const [modoFichaCliente, setModoFichaCliente] = useState<'buscar' | 'formulario'>('formulario');

  const clientesCartera = useMemo(() => {
    const listado: Array<{
      nombre: string;
      dni: string;
      cuit?: string;
      domicilio: string;
      referencia?: string;
      telefono: string;
      cobrador?: string;
    }> = [
      {
        nombre: 'Marcelo Alejandro Coronel',
        dni: '28.491.203',
        cuit: '20-28491203-4',
        domicilio: 'Calle 4 N° 824 - B° Siglo XXI',
        referencia: 'portón negro reja baja',
        telefono: '+54 385 512-3490',
        cobrador: 'Zona Sur - Álvaro',
      },
      {
        nombre: 'Valeria Soledad Gómez',
        dni: '32.105.884',
        cuit: '27-32105884-2',
        domicilio: 'Av. Belgrano Sur 2450',
        referencia: 'frente a la plaza',
        telefono: '+54 385 491-0022',
        cobrador: 'Zona Centro - Ariel',
      },
      {
        nombre: 'Jorge Alberto Rossi',
        dni: '24.918.302',
        cuit: '20-24918302-3',
        domicilio: 'Ruta 1 Km 5 - La Banda',
        referencia: 'casa esquina portón blanco',
        telefono: '+54 385 611-9988',
        cobrador: 'Zona La Banda - Antonela',
      },
    ];

    try {
      const raw = localStorage.getItem('credit_on_cartera_operaciones');
      if (raw) {
        const ops = JSON.parse(raw);
        if (Array.isArray(ops)) {
          for (const op of ops) {
            if (op?.cliente?.nombre) {
              const nombreLimpio = op.cliente.nombre.trim();
              const existe = listado.some(
                (c) => c.nombre.toUpperCase() === nombreLimpio.toUpperCase() ||
                       (op.cliente.dni && c.dni === op.cliente.dni)
              );
              if (!existe) {
                listado.push({
                  nombre: nombreLimpio,
                  dni: op.cliente.dni || '',
                  cuit: op.cliente.cuit || '',
                  domicilio: op.domicilio_cobro || op.cliente.domicilio || '',
                  referencia: op.cliente.referencia || '',
                  telefono: op.cliente.telefono || '',
                  cobrador: op.cobrador?.nombre || 'Zona Sur - Álvaro',
                });
              }
            }
          }
        }
      }
    } catch {}

    return listado;
  }, []);

  const clientesSugeridos = useMemo(() => {
    if (!busquedaCliente.trim()) return [];
    const q = busquedaCliente.toLowerCase().trim();
    return clientesCartera.filter(
      (c) => c.nombre.toLowerCase().includes(q) || (c.dni && c.dni.includes(q))
    );
  }, [busquedaCliente, clientesCartera]);

  const seleccionarClienteExistente = (c: {
    nombre: string;
    dni: string;
    cuit?: string;
    domicilio: string;
    referencia?: string;
    telefono: string;
    cobrador?: string;
  }) => {
    setClienteNombre(c.nombre);
    setClienteDni(c.dni);
    if (c.cuit) setClienteCuit(c.cuit);
    setClienteDomicilio(c.domicilio);
    if (c.referencia) setClienteReferencia(c.referencia);
    setClienteTelefono(c.telefono);
    if (c.cobrador) {
      setCobradorSeleccionado((prev) => {
        if (c.cobrador?.toLowerCase().includes('ariel')) return 'Zona Centro - Ariel';
        if (c.cobrador?.toLowerCase().includes('antonela')) return 'Zona La Banda - Antonela';
        if (c.cobrador?.toLowerCase().includes('oriana')) return 'Zona Norte - Oriana';
        if (c.cobrador?.toLowerCase().includes('álvaro') || c.cobrador?.toLowerCase().includes('alvaro')) return 'Zona Sur - Álvaro';
        return c.cobrador || prev;
      });
    }
    setBusquedaCliente('');
    setMostrarDropdownClientes(false);
    setToastMensaje(`Titular "${c.nombre}" cargado desde la cartera.`);
    setTimeout(() => setToastMensaje(null), 3000);
  };

  const limpiarFichaTitular = () => {
    setClienteNombre('');
    setClienteDni('');
    setClienteCuit('');
    setClienteDomicilio('');
    setClienteReferencia('');
    setClienteTelefono('');
    setBusquedaCliente('');
    setToastMensaje('Formulario limpio para cargar nuevo titular.');
    setTimeout(() => setToastMensaje(null), 3000);
  };

  // Parámetros Efectivo
  const [capitalEfectivo, setCapitalEfectivo] = useState<number>(100000);
  const [planEfectivoDias, setPlanEfectivoDias] = useState<number>(26);

  // Parámetros Producto e Inventario Real
  const [planProductoCuotas, setPlanProductoCuotas] = useState<number>(84);
  const [busquedaProducto, setBusquedaProducto] = useState<string>('');

  const [catalogoProductos, setCatalogoProductos] = useState<Array<{
    id?: number;
    nombre: string;
    icono: string;
    stock: number;
    stockCalle?: number;
    precioContado: number;
  }>>(() => {
    try {
      const raw = localStorage.getItem('credit_on_inventario_productos');
      if (raw) {
        const items = JSON.parse(raw);
        if (Array.isArray(items) && items.length > 0) {
          return items.map((p: any) => ({
            id: p.id,
            nombre: p.nombre || 'Producto',
            icono: p.icono || inferirIconoProducto(p.nombre),
            stock: p.stock_deposito ?? p.stock ?? 0,
            stockCalle: p.stock_calle ?? 0,
            precioContado: p.costo || p.precioContado || 150000,
          }));
        }
      }
    } catch {}
    return [
      { id: 1, nombre: 'Smart TV 43" Noblex / Philips', icono: 'tv', stock: 14, stockCalle: 22, precioContado: 220000 },
      { id: 2, nombre: 'Heladera con Freezer Gafa 280L', icono: 'kitchen', stock: 8, stockCalle: 16, precioContado: 340000 },
      { id: 3, nombre: 'Sommier 2 Plazas Piero Espuma', icono: 'bed', stock: 19, stockCalle: 31, precioContado: 185000 },
      { id: 4, nombre: 'Celular Moto G54 256GB 5G', icono: 'smartphone', stock: 22, stockCalle: 18, precioContado: 145000 },
      { id: 5, nombre: 'Ventilador Industrial 30" Metal', icono: 'mode_fan', stock: 35, stockCalle: 11, precioContado: 520000 },
    ];
  });

  const [productoSeleccionado, setProductoSeleccionado] = useState<{
    id?: number;
    nombre: string;
    stock: number;
    stockCalle?: number;
    precioContado: number;
    icono: string;
  }>(() => {
    try {
      const raw = localStorage.getItem('credit_on_inventario_productos');
      if (raw) {
        const items = JSON.parse(raw);
        if (Array.isArray(items) && items.length > 0) {
          const p = items[0];
          return {
            id: p.id,
            nombre: p.nombre,
            icono: p.icono || inferirIconoProducto(p.nombre),
            stock: p.stock_deposito ?? p.stock ?? 0,
            stockCalle: p.stock_calle ?? 0,
            precioContado: p.costo || p.precioContado || 150000,
          };
        }
      }
    } catch {}
    return {
      nombre: 'Smart TV 43" Noblex / Philips',
      stock: 14,
      stockCalle: 22,
      precioContado: 220000,
      icono: 'tv',
    };
  });

  // Sincronización en vivo cuando cambie el inventario en GestionStock
  useEffect(() => {
    const sincronizarInventario = () => {
      try {
        const raw = localStorage.getItem('credit_on_inventario_productos');
        if (raw) {
          const items = JSON.parse(raw);
          if (Array.isArray(items) && items.length > 0) {
            const formateados = items.map((p: any) => ({
              id: p.id,
              nombre: p.nombre || 'Producto',
              icono: p.icono || inferirIconoProducto(p.nombre),
              stock: p.stock_deposito ?? p.stock ?? 0,
              stockCalle: p.stock_calle ?? 0,
              precioContado: p.costo || p.precioContado || 150000,
            }));
            setCatalogoProductos(formateados);
            setProductoSeleccionado((prev) => {
              const existe = formateados.find((f) => f.nombre === prev?.nombre);
              return existe || formateados[0];
            });
            return;
          }
        }
      } catch {}
    };

    sincronizarInventario();
    window.addEventListener('storage', sincronizarInventario);
    window.addEventListener('focus', sincronizarInventario);
    return () => {
      window.removeEventListener('storage', sincronizarInventario);
      window.removeEventListener('focus', sincronizarInventario);
    };
  }, []);

  // Cobradores dinámicos disponibles (sincronizados con Gestión de Cobradores)
  const [cobradoresDisponibles, setCobradoresDisponibles] = useState<
    Array<{ id?: number; nombre: string; valor: string; etiqueta: string; comision?: number }>
  >(() => {
    try {
      const raw = localStorage.getItem('credit_on_cobradores');
      if (raw) {
        const guardados = JSON.parse(raw);
        if (Array.isArray(guardados) && guardados.length > 0) {
          return guardados
            .filter((c: any) => c.activo !== false)
            .map((c: any, idx: number) => {
              const nombre = (c.nombre || '').trim();
              const valor = nombre.includes(' - ') ? nombre : `Zona ${nombre.split(' ')[0]} - ${nombre}`;
              return {
                id: c.id_cobrador || c.id || idx + 1,
                nombre,
                valor,
                etiqueta: valor,
                comision: c.porcentaje_comision || 8,
              };
            });
        }
      }
    } catch {}
    return [
      { id: 1, nombre: 'Álvaro', valor: 'Zona Sur - Álvaro', etiqueta: 'Zona Sur - Álvaro', comision: 8 },
      { id: 2, nombre: 'Ariel', valor: 'Zona Centro - Ariel', etiqueta: 'Zona Centro - Ariel', comision: 8 },
      { id: 3, nombre: 'Antonela', valor: 'Zona La Banda - Antonela', etiqueta: 'Zona La Banda - Antonela', comision: 8 },
      { id: 4, nombre: 'Oriana', valor: 'Zona Norte - Oriana', etiqueta: 'Zona Norte - Oriana', comision: 8 },
    ];
  });

  // Sincronización en tiempo real cuando se agreguen o modifiquen cobradores en Cobradores.tsx
  useEffect(() => {
    const sincronizarCobradores = () => {
      try {
        const raw = localStorage.getItem('credit_on_cobradores');
        if (raw) {
          const guardados = JSON.parse(raw);
          if (Array.isArray(guardados) && guardados.length > 0) {
            const actualizados = guardados
              .filter((c: any) => c.activo !== false)
              .map((c: any, idx: number) => {
                const nombre = (c.nombre || '').trim();
                const valor = nombre.includes(' - ') ? nombre : `Zona ${nombre.split(' ')[0]} - ${nombre}`;
                return {
                  id: c.id_cobrador || c.id || idx + 1,
                  nombre,
                  valor,
                  etiqueta: valor,
                  comision: c.porcentaje_comision || 8,
                };
              });
            setCobradoresDisponibles(actualizados);
            setCobradorSeleccionado((prev) => {
              if (actualizados.some((c) => c.valor === prev || c.nombre === prev)) return prev;
              return actualizados[0]?.valor || prev;
            });
          }
        }
      } catch {}
    };

    sincronizarCobradores();
    window.addEventListener('credit_on_storage_update', sincronizarCobradores);
    window.addEventListener('storage', sincronizarCobradores);
    window.addEventListener('focus', sincronizarCobradores);
    return () => {
      window.removeEventListener('credit_on_storage_update', sincronizarCobradores);
      window.removeEventListener('storage', sincronizarCobradores);
      window.removeEventListener('focus', sincronizarCobradores);
    };
  }, []);

  const opcionesCobradores = useMemo(() => {
    const list = [...cobradoresDisponibles];
    if (cobradorSeleccionado && !list.some((c) => c.valor === cobradorSeleccionado)) {
      list.unshift({
        nombre: cobradorSeleccionado.includes(' - ')
          ? cobradorSeleccionado.split(' - ').slice(1).join(' - ').trim()
          : cobradorSeleccionado,
        valor: cobradorSeleccionado,
        etiqueta: cobradorSeleccionado,
      });
    }
    return list;
  }, [cobradoresDisponibles, cobradorSeleccionado]);

  // Información calculada y reactiva del cobrador para la Simulación del Cronograma
  const cobradorInfo = useMemo(() => {
    if (!cobradorSeleccionado) {
      return { nombre: 'Álvaro', zona: 'Zona Sur', ruta: 'Hoja de Ruta (Zona Sur)' };
    }
    if (cobradorSeleccionado.includes(' - ')) {
      const partes = cobradorSeleccionado.split(' - ');
      const zona = partes[0].trim();
      const nombre = partes.slice(1).join(' - ').trim();
      return {
        nombre: nombre || cobradorSeleccionado,
        zona: zona || 'Zona Asignada',
        ruta: `Hoja de Ruta (${zona})`,
      };
    }
    return {
      nombre: cobradorSeleccionado,
      zona: 'Circuito Activo',
      ruta: `Hoja de Ruta — ${cobradorSeleccionado}`,
    };
  }, [cobradorSeleccionado]);

  const productosFiltrados = useMemo(() => {
    if (!busquedaProducto.trim()) return catalogoProductos;
    const term = busquedaProducto.toLowerCase().trim();
    return catalogoProductos.filter((p) => p.nombre.toLowerCase().includes(term));
  }, [catalogoProductos, busquedaProducto]);

  const [fechaInicio, setFechaInicio] = useState<string>('2026-09-07');
  const [modalConfirmacion, setModalConfirmacion] = useState<boolean>(false);
  const [modalPagare, setModalPagare] = useState<boolean>(false);
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);

  // Cálculos dinámicos con el Motor de Calendario y Fórmulas Oficiales
  const calculos = useMemo(() => {
    let cuotaDiaria = 0;
    let montoTotal = 0;
    let dias = 0;
    let interes = 0;

    if (modoComercial === 'cash') {
      dias = planEfectivoDias;
      const res = calcularCuotaEfectivo(capitalEfectivo, dias);
      interes = res.interes;
      montoTotal = res.total;
      cuotaDiaria = res.cuotaDiaria;
    } else {
      dias = planProductoCuotas;
      const res = calcularCuotaProducto(productoSeleccionado.precioContado, dias);
      cuotaDiaria = res.cuotaDiaria;
      montoTotal = res.total;
      interes = res.recargo;
    }

    const fechaIniDate = new Date(`${fechaInicio}T12:00:00`);
    const cronogramaRaw = generarCronograma({
      fechaInicio: fechaIniDate,
      numeroCuotas: dias,
      importeCuota: cuotaDiaria,
    });

    let saldoAcumulado = montoTotal;
    const cronogramaConSaldo = cronogramaRaw.map((c) => {
      saldoAcumulado -= c.monto_esperado;
      return {
        ...c,
        saldoRestante: Math.max(saldoAcumulado, 0),
      };
    });

    const fechaFin = calcularFechaFin(fechaIniDate, dias);
    const diasCorridos = calcularDiasCorridos(fechaIniDate, dias);

    return {
      cuotaDiaria,
      montoTotal,
      interes,
      dias,
      cronograma: cronogramaConSaldo,
      fechaFin: toISODate(fechaFin),
      diasCorridos,
    };
  }, [modoComercial, capitalEfectivo, planEfectivoDias, productoSeleccionado, planProductoCuotas, fechaInicio]);

  const handleConfirmar = async () => {
    if (!clienteNombre.trim()) {
      setToastMensaje('Error: Por favor ingresa el nombre del titular.');
      setTimeout(() => setToastMensaje(null), 5000);
      return;
    }
    if (!clienteDomicilio.trim()) {
      setToastMensaje('Error: Por favor ingresa el domicilio de cobranza.');
      setTimeout(() => setToastMensaje(null), 5000);
      return;
    }

    try {
      const cobradorNombre = cobradorSeleccionado.split(' - ').at(-1)?.trim() || cobradorSeleccionado;
      let nroOperacion: number = 0;

      try {
        nroOperacion = await crearOperacionEnSupabase({
          cliente: {
            nombre: clienteNombre.trim().toUpperCase(),
            dni: clienteDni.trim(),
            domicilio: clienteDomicilio.trim(),
            telefono: clienteTelefono.trim(),
            referencia: clienteReferencia.trim(),
          },
          tipo: modoComercial === 'cash' ? 'EFECTIVO' : 'PRODUCTO',
          fecha: fechaInicio,
          cobradorNombre,
          planDias: calculos.dias,
          montoCapital: modoComercial === 'cash' ? capitalEfectivo : (productoSeleccionado?.precioContado || 0),
          montoTotal: calculos.montoTotal,
          importeCuota: calculos.cuotaDiaria,
          productoNombre: modoComercial === 'goods' ? productoSeleccionado?.nombre : undefined,
        });
      } catch (err: any) {
        console.warn('Supabase offline o error RLS, guardando en cartera local:', err);
      }

      if (!nroOperacion) {
        nroOperacion = Math.floor(1000 + Math.random() * 9000);
      }

      // Sincronizar inmediatamente con cartera de clientes local
      try {
        const raw = localStorage.getItem('credit_on_cartera_operaciones');
        const ops = raw ? JSON.parse(raw) : [];
        const cobradorEncontrado = cobradoresDisponibles.find(
          (c) => c.valor === cobradorSeleccionado || c.nombre === cobradorNombre
        );
        const cobradorObj = {
          id_cobrador: cobradorEncontrado?.id || 1,
          nombre: cobradorNombre,
          porcentaje_comision: cobradorEncontrado?.comision || 8,
        };
        const clienteObj = {
          id_cliente: nroOperacion,
          nombre: clienteNombre.trim().toUpperCase(),
          dni: clienteDni.trim() || null,
          domicilio: clienteDomicilio.trim(),
          telefono: clienteTelefono.trim() || null,
          referencia: clienteReferencia.trim() || null,
          calificacion: 'BUENO',
        };
        const cuotasSchedule = calculos.cronograma.map((c) => ({
          numero_cuota: c.numero_cuota,
          fecha_vencimiento: toISODate(c.fecha_vencimiento),
          monto_esperado: c.monto_esperado,
          monto_pagado: 0,
          estado: 'PENDIENTE' as const,
        }));
        const nuevaOp = {
          nro_op: nroOperacion,
          fecha: fechaInicio,
          tipo: modoComercial === 'cash' ? 'EFECTIVO' : 'PRODUCTO',
          producto: modoComercial === 'cash' ? undefined : (productoSeleccionado?.nombre || 'Artículo Financiado'),
          monto_capital: modoComercial === 'cash' ? capitalEfectivo : (productoSeleccionado?.precioContado || 0),
          monto_total: calculos.montoTotal,
          importe_cuota: calculos.cuotaDiaria,
          saldo_restante: calculos.montoTotal,
          domicilio_cobro: clienteDomicilio.trim(),
          cliente: clienteObj,
          cobrador: cobradorObj,
          cuotas: cuotasSchedule,
          mora: { nivel: 'AL_DIA', mensaje: 'Al día - Sin mora registrada', cuotas_vencidas_impagas: 0, deuda_vencida_total: 0 },
          cuotas_totales: calculos.dias,
          cuotas_pagadas: 0,
          cuotas_pendientes: calculos.dias,
          proximo_vencimiento: calculos.cronograma[0] ? toISODate(calculos.cronograma[0].fecha_vencimiento) : fechaInicio,
        };
        localStorage.setItem('credit_on_cartera_operaciones', JSON.stringify([nuevaOp, ...ops]));
        window.dispatchEvent(new Event('credit_on_storage_update'));
      } catch (e) {
        console.error('Error sincronizando con cartera local:', e);
      }

      setModalConfirmacion(false);
      setToastMensaje(`¡Operación #${nroOperacion} aprobada exitosamente y asignada a ${cobradorSeleccionado}!`);
      setTimeout(() => setToastMensaje(null), 5000);
    } catch (error: any) {
      setToastMensaje(`Error al procesar la operación: ${error.message || 'error desconocido'}`);
      setTimeout(() => setToastMensaje(null), 7000);
    }
  };

  // Handler para Imprimir Pagaré Oficial
  const handleAbrirPagare = () => {
    if (!clienteNombre.trim()) {
      setToastMensaje('Por favor especifica el nombre del titular para generar el pagaré.');
      setTimeout(() => setToastMensaje(null), 4000);
      return;
    }
    setModalPagare(true);
  };

  const ejecutarImpresionPagare = () => {
    window.print();
  };

  // Handler para Enviar Resumen de Operación vía WhatsApp
  const handleEnviarWhatsApp = () => {
    if (!clienteTelefono.trim()) {
      setToastMensaje('Por favor especifica un número de teléfono / WhatsApp para el titular.');
      setTimeout(() => setToastMensaje(null), 4000);
      return;
    }

    const celLimpio = clienteTelefono.replace(/[^0-9]/g, '');
    let waNumber = celLimpio;
    if (waNumber.startsWith('0')) waNumber = waNumber.substring(1);
    if (!waNumber.startsWith('54')) {
      waNumber = '549' + waNumber;
    } else if (waNumber.startsWith('54') && !waNumber.startsWith('549')) {
      waNumber = '549' + waNumber.substring(2);
    }

    const conceptoLinea =
      modoComercial === 'cash'
        ? `Préstamo en Efectivo ($${(capitalEfectivo || 0).toLocaleString('es-AR')} ARS)`
        : `Venta Financiada: ${productoSeleccionado.nombre || 'Artículo'} (Contado: $${(productoSeleccionado.precioContado || 0).toLocaleString('es-AR')})`;

    const texto =
      `*CREDIT-ON | COMPROBANTE DE OPERACIÓN*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Estimado/a *${clienteNombre.trim()}*,\n` +
      `Le informamos que su solicitud ha sido confirmada con éxito:\n\n` +
      `• *Concepto:* ${conceptoLinea}\n` +
      `• *Plan acordado:* ${calculos.dias} cuotas de $${(calculos.cuotaDiaria || 0).toLocaleString('es-AR')}\n` +
      `• *Total a abonar:* $${(calculos.montoTotal || 0).toLocaleString('es-AR')}\n` +
      `• *Fecha de inicio:* ${fechaInicio}\n` +
      `• *Domicilio acordado:* ${clienteDomicilio.trim() || 'A convenir'}\n` +
      `• *Cobrador asignado:* ${cobradorInfo.nombre} (${cobradorInfo.zona})\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Comprobante digital emitido por Sistema CREDIT-ON_`;

    setToastMensaje(`Abriendo WhatsApp para enviar comprobante a ${clienteNombre}...`);
    setTimeout(() => setToastMensaje(null), 5000);

    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(texto)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Toast Notificación */}
      {toastMensaje && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-600 text-[24px]">verified</span>
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
      {/* 1. TOP COMMAND CONTEXT BAR */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[26px]">contract_edit</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono uppercase font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                Módulo Originación v4.2
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Validación en tiempo real (Lunes a Sábado)
              </span>
            </div>
            <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Alta de Nueva Operación Crediticia y Simulación de Cronograma
            </h2>
          </div>
        </div>

        {/* Switcher Operador & Sucursal */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white rounded-xl shadow-sm border border-slate-200/60">
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">storefront</span>
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Sucursal</span>
              <span className="text-xs font-bold text-slate-800 leading-tight">01 - Central SDE</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white rounded-xl shadow-sm border border-slate-200/60">
            <span className="material-symbols-outlined text-slate-500 text-[18px]">badge</span>
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Operador</span>
              <span className="text-xs font-bold text-slate-800 leading-tight">C. Mendilaharzu [ADM]</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 2. GRID PRINCIPAL (COLUMNA IZQUIERDA: CONFIGURADOR / COLUMNA DERECHA: SIMULACIÓN) */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* COLUMNA IZQUIERDA: SETUP PIPELINE (7 cols) */}
        <div className="xl:col-span-7 space-y-8">
          {/* Card 1: Ficha del Titular / Deudor */}
          <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">person_pin</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">1. Ficha del Titular / Deudor</h3>
                  <p className="text-[11px] text-slate-400">Buscar en cartera o ingresar datos para nueva originación</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={limpiarFichaTitular}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
                  title="Limpiar campos para ingresar nuevo titular"
                >
                  <span className="material-symbols-outlined text-[16px]">person_add</span>
                  <span>Nuevo Titular</span>
                </button>
              </div>
            </div>

            {/* Buscador Desplegable en Cartera de Clientes */}
            <div className="relative">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Búsqueda Rápida en Cartera de Clientes Registrados:
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                  search
                </span>
                <input
                  type="text"
                  value={busquedaCliente}
                  onChange={(e) => {
                    setBusquedaCliente(e.target.value);
                    setMostrarDropdownClientes(true);
                  }}
                  onFocus={() => setMostrarDropdownClientes(true)}
                  placeholder="Escribe nombre o DNI para autocompletar desde la cartera..."
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white pl-11 pr-10 py-2.5 rounded-xl text-xs font-medium text-slate-900 focus:outline-none transition"
                />
                {busquedaCliente && (
                  <button
                    type="button"
                    onClick={() => {
                      setBusquedaCliente('');
                      setMostrarDropdownClientes(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              {/* Dropdown de Sugerencias de Clientes */}
              {mostrarDropdownClientes && busquedaCliente.trim().length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                  {clientesSugeridos.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No se encontraron clientes registrados con "{busquedaCliente}". Puedes cargar los datos manualmente a continuación.
                    </div>
                  ) : (
                    clientesSugeridos.map((c, i) => (
                      <div
                        key={c.dni ? `${c.dni}-${i}` : `${c.nombre}-${i}`}
                        onClick={() => seleccionarClienteExistente(c)}
                        className="p-3 hover:bg-emerald-50/70 cursor-pointer transition flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs font-mono">
                            {c.nombre.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{c.nombre}</div>
                            <div className="text-[11px] text-slate-500">
                              DNI: {c.dni || 'Sin DNI'} • {c.domicilio}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                          Cargar Datos
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Formulario Completo de Campos Editables */}
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Datos del Titular de la Operación:
                </span>
                <span className="text-[11px] text-slate-400">
                  Los campos marcados con (*) son obligatorios
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nombre y Apellido <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    placeholder="Ej. Juan Carlos Pérez"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-900 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    DNI / Documento <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clienteDni}
                    onChange={(e) => setClienteDni(e.target.value)}
                    placeholder="Ej. 28.491.203"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Teléfono / WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                    placeholder="Ej. +54 385 512-3490"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    CUIT / CUIL (Opcional)
                  </label>
                  <input
                    type="text"
                    value={clienteCuit}
                    onChange={(e) => setClienteCuit(e.target.value)}
                    placeholder="Ej. 20-28491203-4"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-mono text-slate-800 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Domicilio de Cobranza Diaria <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clienteDomicilio}
                    onChange={(e) => setClienteDomicilio(e.target.value)}
                    placeholder="Calle, Número, Barrio o Manzana..."
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-900 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Punto de Referencia / Entre Calles
                  </label>
                  <input
                    type="text"
                    value={clienteReferencia}
                    onChange={(e) => setClienteReferencia(e.target.value)}
                    placeholder="Ej. Portón negro reja baja, frente al kiosco..."
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white px-3.5 py-2.5 rounded-xl text-xs text-slate-800 focus:outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* Ficha Resumen del Cliente */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm font-mono">
                    {clienteNombre.trim()
                      ? clienteNombre.trim().split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                      : 'CL'}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">
                      {clienteNombre.trim() || '(Sin nombre ingresado aún)'}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      DNI: {clienteDni.trim() || '—'} {clienteCuit.trim() ? `• CUIT: ${clienteCuit.trim()}` : ''}
                    </span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{clienteNombre.trim() ? 'Titular Validado' : 'Esperando datos'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0 mt-0.5">pin_drop</span>
                  <div>
                    <strong className="text-slate-800 block">Lugar de Cobro:</strong>
                    <span>{clienteDomicilio.trim() || 'Sin domicilio especificado'}</span>
                    {clienteReferencia.trim() && (
                      <span className="text-slate-400 block text-[11px] font-mono">Ref: {clienteReferencia.trim()}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0 mt-0.5">call</span>
                  <div>
                    <strong className="text-slate-800 block">Contacto &amp; Circuito:</strong>
                    <span>{clienteTelefono.trim() || 'Sin teléfono especificado'}</span>
                    <span className="text-emerald-600 block text-[11px] font-medium">Asignado a: {cobradorSeleccionado}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: Configuración de Línea Comercial */}
          <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">tune</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">2. Configuración de Línea Comercial</h3>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Paso 2 de 3</span>
            </div>

            {/* Segmented Switcher (Cash vs Goods) */}
            <div className="grid grid-cols-2 gap-4 p-1.5 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setModoComercial('cash')}
                className={`flex items-center justify-center gap-3 py-3 px-4 rounded-xl transition ${
                  modoComercial === 'cash'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[22px] text-emerald-600">payments</span>
                <div className="text-left">
                  <div className="font-bold text-sm leading-tight">Préstamo en Efectivo</div>
                  <div className="text-[11px] text-slate-400">Microcréditos diarios directos</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setModoComercial('goods')}
                className={`flex items-center justify-center gap-3 py-3 px-4 rounded-xl transition ${
                  modoComercial === 'goods'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[22px] text-teal-600">shelves</span>
                <div className="text-left">
                  <div className="font-bold text-sm leading-tight">Venta Electrodoméstico</div>
                  <div className="text-[11px] text-slate-400">Planes extendidos con stock</div>
                </div>
              </button>
            </div>

            {/* PANEL EFECTIVO */}
            {modoComercial === 'cash' ? (
              <div className="space-y-6">
                {/* Input Capital Desembolsado con Presets */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                    <span>Capital Neto Desembolsado (Efectivo Entregado)</span>
                    <span className="text-emerald-600 font-mono">Límite asignado: ARS $250.000</span>
                  </div>

                  <div className="relative flex items-center">
                    <span className="absolute left-4 font-mono font-bold text-xl text-slate-400">ARS $</span>
                    <input
                      type="number"
                      value={capitalEfectivo}
                      step="5000"
                      onChange={(e) => setCapitalEfectivo(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white pl-20 pr-36 py-3.5 rounded-xl font-mono font-black text-2xl text-slate-900 focus:outline-none transition"
                    />
                    <div className="absolute right-3 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCapitalEfectivo(50000)}
                        className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold font-mono text-slate-700 transition"
                      >
                        50k
                      </button>
                      <button
                        type="button"
                        onClick={() => setCapitalEfectivo(100000)}
                        className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 rounded-lg text-xs font-bold font-mono text-emerald-800 transition"
                      >
                        100k
                      </button>
                      <button
                        type="button"
                        onClick={() => setCapitalEfectivo(150000)}
                        className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold font-mono text-slate-700 transition"
                      >
                        150k
                      </button>
                    </div>
                  </div>
                </div>

                {/* Planes de Amortización Diaria */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    Seleccionar Plan de Amortización Diaria:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Plan 26 Días */}
                    <div
                      onClick={() => setPlanEfectivoDias(26)}
                      className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
                        planEfectivoDias === 26
                          ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 bg-emerald-600 text-white font-mono font-bold text-xs rounded-md">
                          PLAN 26 DÍAS
                        </span>
                        <span className="text-xs font-bold text-emerald-700">Tasa Fija 30%</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 block">Cuota diaria fija:</span>
                        <div className="text-2xl font-black font-mono text-slate-900">
                          ${Math.round((capitalEfectivo * 1.3) / 26).toLocaleString('es-AR')}{' '}
                          <span className="text-xs font-normal text-slate-400">/ día</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 flex justify-between text-xs font-mono text-slate-600">
                        <span>Interés: ${Math.round(capitalEfectivo * 0.3).toLocaleString('es-AR')}</span>
                        <span className="font-bold text-slate-900">Total: ${Math.round(capitalEfectivo * 1.3).toLocaleString('es-AR')}</span>
                      </div>
                    </div>

                    {/* Plan 35 Días */}
                    <div
                      onClick={() => setPlanEfectivoDias(35)}
                      className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
                        planEfectivoDias === 35
                          ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 bg-slate-700 text-white font-mono font-bold text-xs rounded-md">
                          PLAN 35 DÍAS
                        </span>
                        <span className="text-xs font-bold text-slate-700">Tasa Fija 40%</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 block">Cuota diaria fija:</span>
                        <div className="text-2xl font-black font-mono text-slate-900">
                          ${Math.round((capitalEfectivo * 1.4) / 35).toLocaleString('es-AR')}{' '}
                          <span className="text-xs font-normal text-slate-400">/ día</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 flex justify-between text-xs font-mono text-slate-600">
                        <span>Interés: ${Math.round(capitalEfectivo * 0.4).toLocaleString('es-AR')}</span>
                        <span className="font-bold text-slate-900">Total: ${Math.round(capitalEfectivo * 1.4).toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banner de Retorno Esperado de Inversión (ROI) */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px]">analytics</span>
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Retorno Esperado de Inversión (ROI)</div>
                      <div className="text-[11px] text-slate-500">
                        Cobranza regular de {planEfectivoDias} jornadas operativas continuas sin desvío
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Margen Bruto</span>
                      <span className="font-mono font-bold text-emerald-600">
                        +{planEfectivoDias === 26 ? '30.0%' : '40.0%'} s/Capital
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Utilidad Estimada</span>
                      <span className="font-mono font-bold text-slate-900">
                        ARS ${(calculos.interes || 0).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* PANEL PRODUCTOS */
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-teal-600 text-[24px]">inventory_2</span>
                    <div>
                      <div className="font-bold text-xs text-slate-900">
                        Catálogo de Artículos en Inventario Real
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Sincronizado en tiempo real con Stock Central ({catalogoProductos.length} artículos en matriz)
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">
                    {catalogoProductos.reduce((acc, p) => acc + (p.stock || 0), 0)} un. en Depósito
                  </span>
                </div>

                {/* Buscador de Producto */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={busquedaProducto}
                    onChange={(e) => setBusquedaProducto(e.target.value)}
                    placeholder="Buscar producto por nombre..."
                    className="w-full bg-slate-50 border border-slate-300 focus:border-teal-500 focus:bg-white pl-10 pr-10 py-2.5 rounded-xl text-xs text-slate-800 focus:outline-none transition"
                  />
                  {busquedaProducto && (
                    <button
                      type="button"
                      onClick={() => setBusquedaProducto('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>

                {/* Grid de Artículos del Catálogo con Scroll si hay muchos productos */}
                {productosFiltrados.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1">
                    <span className="material-symbols-outlined text-slate-400 text-3xl">search_off</span>
                    <p className="text-xs font-bold text-slate-700">No se encontraron productos</p>
                    <p className="text-[11px] text-slate-400">
                      {busquedaProducto ? `Sin coincidencias para "${busquedaProducto}"` : 'No hay productos en inventario.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[360px] overflow-y-auto pr-1">
                    {productosFiltrados.map((p) => {
                      const isSelected = productoSeleccionado?.nombre === p.nombre;
                      return (
                        <div
                          key={p.id ? `${p.id}-${p.nombre}` : p.nombre}
                          onClick={() => setProductoSeleccionado(p)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
                            isSelected
                              ? 'bg-teal-50/80 border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                              : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="material-symbols-outlined text-teal-600 text-[22px]">{p.icono}</span>
                            <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                              p.stock > 0 ? 'bg-slate-200 text-slate-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              Stock: {p.stock}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold text-sm text-slate-900 line-clamp-1">{p.nombre}</div>
                            <div className="text-xs font-bold font-mono text-emerald-700 mt-0.5">
                              Precio Contado: ${(p.precioContado || 0).toLocaleString('es-AR')}
                            </div>
                            {p.stockCalle !== undefined && p.stockCalle > 0 && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                ({p.stockCalle} un. colocadas en calle)
                              </div>
                            )}
                          </div>
                          <div className="pt-1.5 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500">
                            <span className={isSelected ? 'text-teal-700 font-bold' : ''}>
                              {isSelected ? '✓ Seleccionado' : 'Hacer clic para elegir'}
                            </span>
                            <span className="font-mono text-teal-700 font-bold">5 planes</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selector de Planes Oficiales de Financiación (Lista de Precios) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                      Elegir Plan de Financiación para: <span className="text-teal-700 font-black">{productoSeleccionado.nombre}</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Fórmulas Oficiales: Lista de Precios
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {PLANES_PRODUCTO_OFICIALES.map((plan) => {
                      const sim = calcularCuotaProducto(productoSeleccionado.precioContado, plan.cuotas);
                      const isPlanSelected = planProductoCuotas === plan.cuotas;
                      return (
                        <div
                          key={plan.cuotas}
                          onClick={() => setPlanProductoCuotas(plan.cuotas)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
                            isPlanSelected
                              ? 'bg-teal-50/80 border-teal-500 ring-2 ring-teal-500/30 shadow-sm'
                              : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 bg-teal-700 text-white font-mono font-bold text-[11px] rounded-md">
                              {plan.cuotas} CUOTAS
                            </span>
                            <span className="text-[11px] font-bold text-teal-800">
                              {plan.semanas} sem ({plan.recargoPorcentaje})
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-medium">Cuota diaria fija:</span>
                            <div className="text-xl font-black font-mono text-slate-900">
                              ${(sim.cuotaDiaria || 0).toLocaleString('es-AR')}{' '}
                              <span className="text-[11px] font-normal text-slate-400">/ día</span>
                            </div>
                            <div className="text-[11px] font-mono text-teal-700 font-semibold mt-0.5">
                              ${(sim.cuotaSemanal || 0).toLocaleString('es-AR')} / semana
                            </div>
                          </div>
                          <div className="pt-1.5 border-t border-slate-200/60 flex justify-between text-[10px] font-mono text-slate-600">
                            <span>Recargo: ${(sim.recargo || 0).toLocaleString('es-AR')}</span>
                            <span className="font-bold text-slate-900">Total: ${(sim.total || 0).toLocaleString('es-AR')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Selector de Fecha de Desembolso / Primer Cobro */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Fecha de Desembolso / Primer Cobro
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white px-3 py-2 rounded-xl text-xs font-medium text-slate-800 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Cobrador y Zona Asignada
                </label>
                <select
                  value={cobradorSeleccionado}
                  onChange={(e) => setCobradorSeleccionado(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white px-3 py-2 rounded-xl text-xs font-medium text-slate-800 focus:outline-none transition"
                >
                  {opcionesCobradores.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Operational Action Bar */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <span className="material-symbols-outlined text-[20px] text-emerald-600">verified_user</span>
              <span>Trazabilidad criptográfica vinculada a nodo Supabase</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleAbrirPagare}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>Imprimir Pagaré</span>
              </button>

              <button
                type="button"
                onClick={handleEnviarWhatsApp}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px] text-emerald-600">send_to_mobile</span>
                <span>Enviar WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setModalConfirmacion(true)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Confirmar y Dar de Alta</span>
              </button>
            </div>
          </section>
        </div>

        {/* COLUMNA DERECHA: SIMULACIÓN DE CRONOGRAMA EN TIEMPO REAL (5 cols) */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-600 text-[24px]">calendar_month</span>
                <h3 className="text-base font-bold text-slate-900">Simulación de Cronograma</h3>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold font-mono">
                {calculos.dias} Cuotas Hábiles
              </span>
            </div>

            {/* Regla de Negocio Alert */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0 mt-0.5">event_busy</span>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-900 font-bold">Regla estricta de cobro:</strong> Los domingos quedan excluidos de la cobranza. Feriados nacionales postergan automáticamente la exigibilidad al próximo día hábil.
              </p>
            </div>

            {/* Key Milestones Bar */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Fecha Inicio</span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">{fechaInicio}</span>
                <span className="text-[11px] text-emerald-600 font-medium">Primer cobro en calle</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Vencimiento Final</span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">{calculos.fechaFin}</span>
                <span className="text-[11px] text-slate-500 font-mono">{calculos.diasCorridos} días corridos</span>
              </div>
            </div>

            {/* Metric KPI Pill */}
            <div className="flex items-center justify-between p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">assignment_turned_in</span>
                <span className="text-xs font-bold uppercase tracking-wider">Total Exigible al Cobrador:</span>
              </div>
              <span className="text-xl font-mono font-black text-emerald-700">
                ${(calculos.cuotaDiaria || 0).toLocaleString('es-AR')} / día
              </span>
            </div>

            {/* Tabla Scrollable de Cuotas */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600 uppercase font-bold tracking-wider z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">N°</th>
                      <th className="py-2.5 px-3">Vencimiento</th>
                      <th className="py-2.5 px-3 text-right">Cuota</th>
                      <th className="py-2.5 px-3 text-right">Saldo Rest.</th>
                      <th className="py-2.5 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {calculos.cronograma.map((c) => (
                      <tr key={c.numero_cuota} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 font-mono font-bold">{String(c.numero_cuota).padStart(2, '0')}/{calculos.dias}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{toISODate(c.fecha_vencimiento)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                          ${(c.monto_esperado || 0).toLocaleString('es-AR')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500">
                          ${(c.saldoRestante || 0).toLocaleString('es-AR')}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Programado
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>{calculos.dias} Cuotas Generadas</span>
                <span className="font-bold font-mono text-slate-900">
                  Total Liquidación: ARS ${(calculos.montoTotal || 0).toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Route Verification Snippet Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">route</span>
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900">{cobradorInfo.ruta}</div>
                  <div className="text-[11px] text-slate-400">
                    Circuito: {cobradorInfo.zona} • Posición sugerida de visita: Parada 14 (17:40 hs)
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 font-mono">
                Cobrador {cobradorInfo.nombre}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL DE CONFIRMACIÓN DE ALTA */}
      {/* ===================================================================== */}
      {modalConfirmacion && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">verified</span>
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900">Confirmar Emisión de Crédito</h4>
                  <span className="text-xs font-mono text-slate-400">Transacción Inmutable #CR-2026-0904</span>
                </div>
              </div>
              <button
                onClick={() => setModalConfirmacion(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Titular deudor:</span>
                <span className="font-bold text-slate-900">{clienteNombre} ({clienteDni})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Línea comercial:</span>
                <span className="font-bold text-slate-900">
                  {modoComercial === 'cash' ? 'Préstamo en Efectivo' : `Producto: ${productoSeleccionado.nombre}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Desembolso capital:</span>
                <span className="font-mono font-bold text-emerald-600">
                  ARS ${modoComercial === 'cash' ? capitalEfectivo.toLocaleString('es-AR') : productoSeleccionado.precioContado.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Plan de amortización:</span>
                <span className="font-mono font-bold text-slate-900">
                  {calculos.dias} cuotas diarias de ${(calculos.cuotaDiaria || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monto total a recuperar:</span>
                <span className="font-mono font-bold text-slate-900">
                  ARS ${(calculos.montoTotal || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Circuito asignado:</span>
                <span className="font-bold text-slate-900">{cobradorSeleccionado}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-amber-600">info</span>
              <span>Al confirmar se descontará automáticamente el efectivo de la Caja Central Turno Tarde.</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalConfirmacion(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">done_all</span>
                <span>Efectivizar y Asignar a Ruta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE PAGARÉ OFICIAL IMPRIMIBLE */}
      {/* ===================================================================== */}
      {modalPagare && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          {/* Estilos para impresión exclusiva del documento */}
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #documento-pagare-imprimir, #documento-pagare-imprimir * {
                visibility: visible;
              }
              #documento-pagare-imprimir {
                position: fixed;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 15mm 20mm;
                background: white !important;
                color: black !important;
                font-size: 11pt;
                z-index: 999999;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 lg:p-8 space-y-6 my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 no-print">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">description</span>
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900">Pagaré Comercial Oficial</h4>
                  <span className="text-xs text-slate-500 font-mono">Documento Legal Ejecutable — Decreto Ley 5965/63</span>
                </div>
              </div>
              <button
                onClick={() => setModalPagare(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Documento Imprimible */}
            <div id="documento-pagare-imprimir" className="bg-amber-50/30 border-2 border-slate-300 rounded-xl p-6 md:p-8 text-slate-900 space-y-5">
              {/* Membrete y Datos Pagaré */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <h2 className="text-xl font-black tracking-wider uppercase font-sans text-slate-900">CREDIT-ON</h2>
                  <p className="text-[10px] uppercase tracking-widest text-slate-600 font-sans">Servicios Financieros &amp; Venta Financiada</p>
                </div>
                <div className="text-right font-mono text-xs">
                  <div className="font-bold text-sm bg-slate-900 text-white px-2 py-0.5 rounded inline-block">
                    PAGARÉ N° {Math.floor(1000 + Math.random() * 9000)}
                  </div>
                  <div className="mt-1 font-sans text-[11px] text-slate-600">
                    Santiago del Estero, {fechaInicio}
                  </div>
                </div>
              </div>

              {/* Importe Destacado */}
              <div className="bg-white p-3 rounded-lg border border-slate-300 flex justify-between items-center font-sans">
                <span className="text-xs uppercase font-bold text-slate-500">Monto Total del Pagaré:</span>
                <span className="text-lg font-black font-mono text-slate-900">
                  ARS ${(calculos.montoTotal || 0).toLocaleString('es-AR')}
                </span>
              </div>

              {/* Texto Legal */}
              <div className="text-xs leading-relaxed text-justify space-y-3 font-sans">
                <p>
                  Por el presente <strong>PAGARÉ</strong>, me obligo a pagar incondicionalmente a la orden de <strong>CREDIT-ON</strong> o a quien legalmente represente sus derechos, en el domicilio de cobranza convenido o donde se me exija, la cantidad de <strong>PESOS ARGENTINOS {(calculos.montoTotal || 0).toLocaleString('es-AR')}</strong>, en concepto de capital financiado y recargo comercial acordado.
                </p>
                <p>
                  La suma debida será satisfecha en <strong>{calculos.dias} cuotas diarias y consecutivas</strong> de <strong>ARS ${(calculos.cuotaDiaria || 0).toLocaleString('es-AR')}</strong> cada una, devengándose la primera con vencimiento el día <strong>{fechaInicio}</strong> y las subsiguientes los días hábiles sucesivos de cobranza en calle (lunes a sábado, excluyendo domingos y feriados nacionales).
                </p>
                <p className="text-[11px] text-slate-600 italic">
                  Cláusula ejecutiva: La falta de pago o atraso injustificado facultará al acreedor a declarar de plazo vencido todas las cuotas pendientes sin necesidad de interpelación judicial o protesto previo, quedando expedita la acción ejecutiva por el saldo total deudor con más sus intereses y gastos causados.
                </p>
              </div>

              {/* Datos Deudor */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Titular Deudor:</span>
                  <span className="font-bold text-slate-900">{clienteNombre || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">DNI / Documento:</span>
                  <span className="font-bold text-slate-900 font-mono">{clienteDni || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Domicilio de Cobro:</span>
                  <span className="text-slate-800">{clienteDomicilio || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Teléfono / WhatsApp:</span>
                  <span className="text-slate-800 font-mono">{clienteTelefono || '—'}</span>
                </div>
              </div>

              {/* Espacio para Firmas */}
              <div className="pt-8 grid grid-cols-2 gap-8 font-sans">
                <div className="text-center">
                  <div className="border-b border-slate-400 h-10"></div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 block mt-1">
                    Firma del Deudor
                  </span>
                  <span className="text-[11px] font-bold text-slate-800 block">
                    Aclaración: {clienteNombre}
                  </span>
                </div>
                <div className="text-center">
                  <div className="border-b border-slate-400 h-10"></div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 block mt-1">
                    Operador / Cobrador Revisor
                  </span>
                  <span className="text-[11px] font-bold text-slate-800 block">
                    {cobradorInfo.nombre} ({cobradorInfo.zona})
                  </span>
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-3 pt-2 no-print">
              <button
                type="button"
                onClick={() => setModalPagare(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={ejecutarImpresionPagare}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>Imprimir Pagaré A4</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
