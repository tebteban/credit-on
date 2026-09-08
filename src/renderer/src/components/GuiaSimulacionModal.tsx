import React, { useState } from 'react';

interface GuiaSimulacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavegar: (vista: string) => void;
}

interface PasoSimulacion {
  numero: number;
  titulo: string;
  subtitulo: string;
  icono: string;
  vistaDestino: string;
  botonTexto: string;
  descripcion: string;
  accionesRecomendadas: string[];
  tips: string[];
}

const PASOS_GUIA: PasoSimulacion[] = [
  {
    numero: 1,
    titulo: 'Preparación, Datos en Blanco y Simulación Rápida',
    subtitulo: 'Acondicionamiento del sistema para pruebas reales o con datos limpios',
    icono: 'tune',
    vistaDestino: 'stock',
    botonTexto: 'Ir a Gestión de Stock',
    descripcion:
      'Puedes comenzar con el sistema completamente en blanco o con datos demo precargados. Cada módulo cuenta con herramientas de edición, vaciado y carga masiva desde Excel.',
    accionesRecomendadas: [
      'Ve a "Gestión de Stock": haz clic en "Vaciar" si deseas ver el inventario en cero, o en "Demo" para restaurar productos modelo.',
      'Descarga la "Plantilla Ejemplo" en Excel/CSV y súbela con el botón "Subir Excel" para cargar varios productos de una sola vez.',
      'En "Rendimiento de Cobradores": puedes agregar cobradores con "+ Nuevo Cobrador", vaciarlos o cargar tu nómina vía Excel.',
      'Atajo de 1 Clic: en "Rendimiento de Cobradores" tienes el botón violeta "⚡ Simular Rendimiento Hoy", que genera una jornada activa completa para probar todo el ecosistema al instante.',
    ],
    tips: [
      'Las plantillas CSV son 100% compatibles con Excel, Google Sheets y LibreOffice (codificadas con UTF-8 BOM).',
      'Todos los datos se guardan permanentemente en tu equipo y se conservan intactos al cerrar y reabrir la aplicación.',
    ],
  },
  {
    numero: 2,
    titulo: 'Originación y Alta de Operaciones',
    subtitulo: 'Creación de créditos en efectivo y ventas de productos con cronograma lunes a sábado',
    icono: 'add_card',
    vistaDestino: 'alta',
    botonTexto: 'Ir a Alta de Operaciones',
    descripcion:
      'Simula la colocación de un nuevo crédito o la venta financiada de un electrodoméstico o moto de tu inventario físico.',
    accionesRecomendadas: [
      'Selecciona el tipo de operación: "Efectivo" o "Producto". El formulario de cliente titular inicia completamente en blanco listo para escribir.',
      'Si eliges "Producto", selecciona un bien de tu inventario (se descontará del depósito central y pasará automáticamente a mercadería en calle con su serie).',
      'Ingresa los datos del cliente (nombre, DNI, domicilio de cobranza) y selecciona al cobrador asignado a la zona según el circuito.',
      'Configura el capital o anticipo, recargo financiero y cantidad de cuotas.',
      'Revisa la previsualización del cronograma: el motor de calendario saltea automáticamente los domingos y feriados nacionales.',
      'Confirma el alta para asentar la operación en la cartera viva.',
    ],
    tips: [
      'Al confirmar una venta de producto, el bien queda vinculado a la operación con su modelo y número de serie para trazabilidad prendaria.',
    ],
  },
  {
    numero: 3,
    titulo: 'Gestión de Stock, Lotes y Bienes en Riesgo',
    subtitulo: 'Control físico de depósito, compra de lotes y seguimiento de artículos prendados',
    icono: 'inventory_2',
    vistaDestino: 'stock',
    botonTexto: 'Ir a Gestión de Stock',
    descripcion:
      'Administra el depósito central de mercaderías, ingresa lotes de compra a proveedores y monitorea los bienes entregados a clientes que presentan mora.',
    accionesRecomendadas: [
      'En el panel "Ingresar Lote de Compra", ingresa la descripción del bien, unidades, costo y financiación base: el sistema calcula en vivo el retorno porcentual (+XX%).',
      'Presiona "Ingresar Lote al Galpón" para sumar automáticamente el stock físico a tu inventario persistente.',
      'Observa la tarjeta interactiva "Bienes en Riesgo": muestra el total de electrodomésticos y motos en poder de clientes con cuotas vencidas.',
      'Haz clic en "Ver quién los tiene →" para abrir el modal interactivo con el titular, DNI, teléfono, domicilio de retiro y cuotas impagas.',
      'Presiona "Cargar en Protocolo de Retiro →" en cualquier ficha para autocompletar el formulario de recupero y devolver el bien a stock con 1 solo clic.',
    ],
    tips: [
      'El protocolo de recupero extingue el saldo en mora del cliente y reingresa inmediatamente la unidad devuelta al depósito receptor (+1 unidad en stock).',
    ],
  },
  {
    numero: 4,
    titulo: 'Monitoreo en Tiempo Real de Cartera',
    subtitulo: 'Supervisión de clientes, semáforo inteligente de mora y contacto por WhatsApp',
    icono: 'people',
    vistaDestino: 'clientes',
    botonTexto: 'Ir a Monitoreo de Clientes',
    descripcion:
      'Centro de control de todos los clientes activos. Supervisa el cumplimiento de cuotas y el semáforo inteligente de mora en vivo.',
    accionesRecomendadas: [
      'Filtra por cobrador asignado, tipo de crédito (efectivo/producto) o estado de atraso en el menú superior.',
      'Observa las etiquetas de mora: "Al día" (verde), "Alerta" (amarillo), "Mora Crítica" (rojo) y "Evaluar Retiro" (bordó).',
      'Haz clic en cualquier cliente para ver el desglose de cuotas, montos pendientes y vencimientos.',
      'Prueba registrar un "Cobro Manual" directo o marcar una "Visita Infructuosa" (ej. local cerrado, ausente).',
      'Utiliza el botón de WhatsApp para abrir el mensaje de cobranza automático con formato limpio, prolijo y sin caracteres extraños.',
    ],
    tips: [
      'Cualquier cobro registrado en la calle o en la terminal móvil impacta en esta pantalla en tiempo real sin necesidad de recargar.',
    ],
  },
  {
    numero: 5,
    titulo: 'Hoja de Ruta Diaria Imprimible',
    subtitulo: 'Planificación de recorridos de cobranza, clientes del día y planillas para la calle',
    icono: 'print',
    vistaDestino: 'hoja',
    botonTexto: 'Ir a Hoja de Ruta',
    descripcion:
      'Genera las planillas impresas físicas que cada cobrador lleva en su recorrido diario por los barrios de Santiago del Estero y La Banda.',
    accionesRecomendadas: [
      'Selecciona el cobrador en el selector superior (o elige "TODOS LOS COBRADORES" para un consolidado general).',
      'La fecha se autocompleta con el día de hoy, pero puedes seleccionar cualquier jornada de trabajo.',
      'Verifica la lista de paradas: incluye orden de visita, N° de operación, titular, domicilio exacto, teléfono, cuota exigible y atraso.',
      'Si el cliente ya abonó hoy, la columna "Cobrado Hoy ($)" reflejará el pago imputado en tiempo real.',
      'Haz clic en "Imprimir Hoja de Ruta / Guardar PDF" para obtener la planilla en tamaño A4 lista para el portapapeles del cobrador, con espacio en blanco para su firma manuscrita.',
    ],
    tips: [
      'La hoja de ruta se sincroniza en vivo con la cartera de operaciones y la nómina oficial de cobradores.',
    ],
  },
  {
    numero: 6,
    titulo: 'Cobranza Móvil en Calle (Terminal PWA)',
    subtitulo: 'Simulador táctil en modo claro de la aplicación utilizada por los cobradores en ruta',
    icono: 'smartphone',
    vistaDestino: 'pwa',
    botonTexto: 'Abrir Terminal PWA Cobrador',
    descripcion:
      'Esta vista reproduce fielmente la experiencia del cobrador en su teléfono celular, con diseño claro de alto contraste optimizado para la luz del sol en la calle.',
    accionesRecomendadas: [
      'Selecciona al cobrador activo en el selector superior (Ariel, Álvaro, Carlos, etc.) para ver su hoja de ruta táctil.',
      'Visualiza los clientes pendientes de visita ordenados geográficamente por su recorrido.',
      'Toca en "Cobrar" para abrir el teclado numérico táctil (Keypad Modal) e ingresa un pago total o parcial: el sistema calcula las cuotas equivalentes.',
      'Prueba registrar una visita sin cobro mediante el botón de "No Pago" indicando el motivo correspondiente (ej. negocio cerrado).',
      'Simula pérdida de señal (modo offline) para verificar que las transacciones se guardan en el teléfono y se sincronizan al recuperar señal.',
    ],
    tips: [
      'Cada cobrador solo tiene acceso a su propia hoja de ruta asignada, protegiendo la confidencialidad de la cartera general.',
    ],
  },
  {
    numero: 7,
    titulo: 'Rendimiento y Comisiones de Cobradores',
    subtitulo: 'Control de efectividad diaria, metas operativas y liquidación de comisiones',
    icono: 'badge',
    vistaDestino: 'cobradores',
    botonTexto: 'Ir a Rendimiento de Cobradores',
    descripcion:
      'Módulo para medir la productividad del equipo de cobranzas y verificar el cumplimiento de los objetivos diarios de recaudación.',
    accionesRecomendadas: [
      'Haz clic en el botón superior "⚡ Simular Rendimiento Hoy" para cargar una jornada de operaciones y cobranzas realistas en toda la nómina.',
      'Revisa los KPIs globales: Exigible Hoy, Total Cobrado y % de Efectividad Global del negocio.',
      'Analiza la barra de progreso de cada cobrador: verde (óptimo ≥ 90%), amarillo (atención ≥ 80%) o rojo (bajo rendimiento).',
      'Haz clic sobre cualquier cobrador para desplegar el desglose de su comisión pactada y cobros del día.',
      'Si necesitas dar de alta o ajustar comisiones, utiliza "+ Nuevo Cobrador" o importa una lista desde Excel.',
    ],
    tips: [
      'La nómina canónica incluye a los cobradores oficiales asignados a Zona Centro, Zona Sur, La Banda, Zona Norte, Oeste y Belgrano.',
    ],
  },
  {
    numero: 8,
    titulo: 'Rendición Diaria, Arqueo y Cierre Definitivo',
    subtitulo: 'Rendición de recaudación de cobradores, balance de tesorería y acta de cierre',
    icono: 'point_of_sale',
    vistaDestino: 'cierre',
    botonTexto: 'Ir a Cierre de Caja',
    descripcion:
      'Al finalizar la jornada, se concilia el dinero físico entregado por cada cobrador contra las cobranzas registradas en el sistema.',
    accionesRecomendadas: [
      'Selecciona al cobrador que está rindiendo (ej. Ariel, Álvaro o Carlos): el sistema cargará automáticamente el total cobrado registrado hoy en su circuito (o $0 si no tuvo cobros).',
      'En el campo "Efectivo Rendido", ingresa la suma de dinero físico entregada en mano por el cobrador: el sistema calcula al instante la comisión a liquidar y la diferencia de caja.',
      'Agrega observaciones de la rendición si corresponde (el campo inicia limpio por defecto).',
      'Presiona "Guardar Borrador" para una revisión previa o "Cierre Definitivo" para asentar el arqueo: el cobrador quedará bloqueado con candado y distintivo verde de cerrado.',
      'Haz clic en "Generar Acta PDF" para imprimir o exportar el comprobante legal de cierre en hoja A4 con espacios en blanco para firmas manuscritas físicas.',
    ],
    tips: [
      'El cierre definitivo previene modificaciones posteriores y deja un registro inalterable para auditoría contable.',
    ],
  },
  {
    numero: 9,
    titulo: 'Dashboard Patrimonial y Auditoría Integral',
    subtitulo: 'Visión 360° del patrimonio neto operativo, liquidez, mercadería en calle y retorno',
    icono: 'query_stats',
    vistaDestino: 'patrimonio',
    botonTexto: 'Ir a Dashboard Patrimonial',
    descripcion:
      'Cuadro de mando integral para la toma de decisiones gerenciales, valuación del patrimonio y control de solvencia en tiempo real.',
    accionesRecomendadas: [
      'Examina la tarjeta de Patrimonio Neto Operativo Valuado, con diseño armónico integrado y desglose directo de Cartera Activa + Stock en Depósito + Liquidez en Caja.',
      'Revisa la tasa global de retorno de colocaciones, el índice de mora y la efectividad de recaudación del día.',
      'Verifica la distribución de cartera entre préstamos en efectivo y ventas financiadas de productos.',
      'Comprueba que todos los importes y cálculos se expresan en moneda nacional clara sin duplicación de signos monetarios.',
      'Utiliza el botón de exportación para generar el informe ejecutivo en PDF o Excel para socios y directivos.',
    ],
    tips: [
      'El dashboard se alimenta de forma reactiva de todas las transacciones de calle, altas de crédito y arqueos de caja en tiempo real.',
    ],
  },
];

export const GuiaSimulacionModal: React.FC<GuiaSimulacionModalProps> = ({
  isOpen,
  onClose,
  onNavegar,
}) => {
  const [pasoActivo, setPasoActivo] = useState(1);

  if (!isOpen) return null;

  const paso = PASOS_GUIA.find((p) => p.numero === pasoActivo) || PASOS_GUIA[0];

  const handleIrVista = () => {
    onNavegar(paso.vistaDestino);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header con gradiente elegante */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 sm:p-7 flex items-center justify-between relative overflow-hidden flex-shrink-0">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 opacity-10 pointer-events-none">
            <span className="material-symbols-outlined text-[180px]">flag</span>
          </div>

          <div className="space-y-1 z-10">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-md">
                Modo Demostración &amp; Pruebas
              </span>
              <span className="text-xs text-emerald-300 font-medium">Guía Interactiva Paso a Paso</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span className="material-symbols-outlined text-emerald-400 text-[26px]">play_circle</span>
              Simulador Completo de Operaciones Credit-On
            </h2>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Sigue esta guía paso a paso para poner a prueba cada funcionalidad: desde dejar en blanco los datos
              o cargar planillas de Excel, hasta la originación, cobranza en calle y arqueo final.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition z-10 flex-shrink-0"
            title="Cerrar guía"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Barra de progreso de pasos horizontal */}
        <div className="bg-slate-100/80 border-b border-slate-200 p-2 sm:p-3 overflow-x-auto flex items-center gap-1.5 flex-shrink-0">
          {PASOS_GUIA.map((p) => {
            const isActivo = p.numero === pasoActivo;
            return (
              <button
                key={p.numero}
                type="button"
                onClick={() => setPasoActivo(p.numero)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActivo
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white hover:bg-slate-200/70 text-slate-600 border border-slate-200/80'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                    isActivo ? 'bg-white text-emerald-700' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {p.numero}
                </span>
                <span className="truncate max-w-[120px] sm:max-w-[150px]">{p.titulo}</span>
              </button>
            );
          })}
        </div>

        {/* Contenido principal del paso */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-800">
          {/* Título y descripción del paso activo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
                <span className="material-symbols-outlined text-[28px]">{paso.icono}</span>
              </div>
              <div>
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                  Paso {paso.numero} de {PASOS_GUIA.length}
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900">{paso.titulo}</h3>
                <p className="text-xs text-slate-500">{paso.subtitulo}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleIrVista}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 self-start sm:self-auto flex-shrink-0"
            >
              <span>{paso.botonTexto}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs sm:text-sm text-slate-700 leading-relaxed">
            {paso.descripcion}
          </div>

          {/* Acciones recomendadas */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[18px]">checklist</span>
              Acciones Recomendadas para Probar en Este Paso
            </h4>
            <div className="space-y-2">
              {paso.accionesRecomendadas.map((accion, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 hover:border-slate-300 transition"
                >
                  <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{accion}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tips y Notas Clave */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">lightbulb</span>
              Consejos de Manipulación y Prueba
            </h4>
            <div className="space-y-2">
              {paso.tips.map((tip, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-amber-50/70 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2.5"
                >
                  <span className="material-symbols-outlined text-amber-600 text-[16px] mt-0.5">check</span>
                  <span className="leading-relaxed">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer con controles de navegación previa / siguiente */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-5 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            disabled={pasoActivo === 1}
            onClick={() => setPasoActivo((prev) => Math.max(1, prev - 1))}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            <span>Paso Anterior</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleIrVista}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>{paso.botonTexto}</span>
              <span className="material-symbols-outlined text-[15px]">open_in_new</span>
            </button>

            {pasoActivo < PASOS_GUIA.length ? (
              <button
                type="button"
                onClick={() => setPasoActivo((prev) => Math.min(PASOS_GUIA.length, prev + 1))}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <span>Siguiente Paso</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>Finalizar Guía</span>
                <span className="material-symbols-outlined text-[16px]">check</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
