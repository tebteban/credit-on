/**
 * CREDIT-ON — Utilidad de Importación / Exportación Excel y CSV
 * =============================================================
 * Soporta de forma nativa:
 * - Archivos Excel (.xlsx, .xls) vía librería xlsx
 * - Archivos CSV y TXT delimitados con punto y coma (;), coma (,), tabulaciones (\t) o pipes (|)
 * - Detección y limpieza de BOM UTF-8
 * - Normalización de tildes/acentos (depósito -> deposito, categoría -> categoria)
 * - Limpieza de formatos de moneda latina ($ 150.000, 150.000,00, etc.)
 */
import * as XLSX from 'xlsx';

export type TipoPlantilla = 'productos' | 'cobradores' | 'clientes';

export interface PlantillaDefinicion {
  nombreArchivo: string;
  cabeceras: string[];
  ejemplos: string[][];
  descripcion: string;
}

export const PLANTILLAS: Record<TipoPlantilla, PlantillaDefinicion> = {
  productos: {
    nombreArchivo: 'Plantilla_Productos_Stock_CreditOn.csv',
    cabeceras: ['Nombre', 'Categoria', 'Costo', 'Stock Deposito', 'Stock Calle'],
    ejemplos: [
      ['Smart TV 43" Noblex FHD', 'Electrodomésticos', '220000', '10', '15'],
      ['Heladera con Freezer Gafa 280L', 'Electrodomésticos', '340000', '5', '8'],
      ['Sommier 2 Plazas Piero', 'Muebles & Colchonería', '185000', '12', '20'],
      ['Celular Moto G54 256GB 5G', 'Telefonía Celular', '195000', '15', '25'],
      ['Moto Brava Nevada 110cc', 'Motos / Rodados', '850000', '3', '2'],
      ['Ventilador Turbo 20" Liliana', 'Electrodomésticos', '48000', '30', '10']
    ],
    descripcion: 'Listado de bienes para catálogo e inventario físico y en calle'
  },
  cobradores: {
    nombreArchivo: 'Plantilla_Cobradores_CreditOn.csv',
    cabeceras: ['Nombre', 'Telefono', 'Porcentaje Comision'],
    ejemplos: [
      ['Carlos Mendilaharzu', '+54 9 381 445-1290', '8'],
      ['Mauro Sánchez', '+54 9 381 552-8812', '8'],
      ['Juan Pérez', '+54 9 381 671-0023', '7.5'],
      ['Lucas Albarracín', '+54 9 381 332-9011', '9']
    ],
    descripcion: 'Nómina de cobradores de campo y porcentaje de comisión'
  },
  clientes: {
    nombreArchivo: 'Plantilla_Clientes_Cartera_CreditOn.csv',
    cabeceras: [
      'Nombre',
      'DNI',
      'Telefono',
      'Direccion',
      'Monto Financiado',
      'Cantidad Cuotas',
      'Valor Cuota',
      'Cuotas Pagadas',
      'Cuotas Vencidas',
      'Tipo',
      'Cobrador'
    ],
    ejemplos: [
      ['PÉREZ JUAN CARLOS', '28456123', '385-4123456', 'Av. Belgrano 1420 - Centro', '100000', '26', '5000', '2', '0', 'EFECTIVO', 'Ariel Gómez'],
      ['GÓMEZ MARÍA LAURA', '33445566', '385-6112233', 'Roca Sur 245 - B° Cabildo', '80000', '26', '4000', '0', '0', 'EFECTIVO', 'Ariel Gómez'],
      ['RODRÍGUEZ HUGO O.', '25667788', '385-4889900', 'Av. Colón Sur 3100 - B° Ej. Argentino', '350000', '42', '12000', '4', '0', 'PRODUCTO', 'Ariel Gómez'],
      ['BENÍTEZ CLAUDIO A.', '29887112', '385-4771234', 'Calle 12 N° 450 - B° Mishqui Mayu', '60000', '26', '3000', '0', '0', 'EFECTIVO', 'Carlos Mendilaharzu']
    ],
    descripcion: 'Padrón de clientes con operaciones de crédito vigentes y avance de cuotas'
  }
};

/**
 * Normaliza cualquier clave o encabezado eliminando acentos/tildes,
 * espacios, mayúsculas y símbolos extraños para matching tolerante.
 * Ejemplos:
 * "Stock Depósito" -> "stock_deposito"
 * "Costo Unitario ($)" -> "costo_unitario"
 * "Costo_ARS" -> "costo_ars"
 */
export function normalizarClave(texto: string): string {
  if (!texto) return '';
  return texto
    .toString()
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina tildes
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Parsea y limpia números en formatos habituales de Argentina/Excel
 * (por ejemplo: "$ 150.000", "150.000,50", "150000", "150,000.00", etc.)
 */
export function limpiarNumero(valor: any): number {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return isNaN(valor) ? 0 : valor;

  let str = valor.toString().trim();
  // Quitar símbolos de moneda y caracteres no numéricos excepto punto, coma y signo menos
  str = str.replace(/[$ARSusd\s]/gi, '');
  if (!str) return 0;

  const ultimoPunto = str.lastIndexOf('.');
  const ultimaComa = str.lastIndexOf(',');

  if (ultimoPunto !== -1 && ultimaComa !== -1) {
    if (ultimaComa > ultimoPunto) {
      // Formato argentino/español: 150.000,50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglosajón: 150,000.50
      str = str.replace(/,/g, '');
    }
  } else if (ultimaComa !== -1) {
    // Solo tiene coma: ej "150000,50" o separador de miles "150,000"
    const partes = str.split(',');
    if (partes.length === 2 && partes[1].length <= 2) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (ultimoPunto !== -1) {
    // Solo tiene punto: ej "150.000" o "150000.50"
    const partes = str.split('.');
    if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3)) {
      // Separador de miles "150.000" o "1.500.000"
      str = str.replace(/\./g, '');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Obtiene un valor de un objeto fila buscando de manera inteligente entre varios alias posibles.
 */
export function obtenerValor(fila: Record<string, any>, posiblesClaves: string[]): string {
  const claves = Object.keys(fila);
  if (!claves.length) return '';

  const mapa: Record<string, string> = {};
  for (const c of claves) {
    mapa[normalizarClave(c)] = c;
  }

  // 1. Coincidencia exacta normalizada
  for (const pc of posiblesClaves) {
    const pcNorm = normalizarClave(pc);
    if (mapa[pcNorm] !== undefined) {
      const val = fila[mapa[pcNorm]];
      if (val !== undefined && val !== null && val !== '') return val.toString().trim();
    }
  }

  // 2. Coincidencia por subcadena / contenida
  for (const pc of posiblesClaves) {
    const pcNorm = normalizarClave(pc);
    for (const [kNorm, kOriginal] of Object.entries(mapa)) {
      if (kNorm.includes(pcNorm) || pcNorm.includes(kNorm)) {
        const val = fila[kOriginal];
        if (val !== undefined && val !== null && val !== '') return val.toString().trim();
      }
    }
  }

  return '';
}

/**
 * Obtiene un número limpio de una fila usando lista de alias.
 */
export function obtenerNumero(fila: Record<string, any>, posiblesClaves: string[]): number {
  const val = obtenerValor(fila, posiblesClaves);
  return limpiarNumero(val);
}

/**
 * Genera y descarga en el navegador una plantilla CSV compatible con Excel
 */
export function descargarPlantillaCSV(tipo: TipoPlantilla): void {
  const p = PLANTILLAS[tipo];
  if (!p) return;

  const filas = [
    p.cabeceras.join(';'),
    ...p.ejemplos.map(fila => fila.map(campo => `"${campo.replace(/"/g, '""')}"`).join(';'))
  ];

  // \uFEFF = UTF-8 BOM para que Excel respete acentos y caracteres latinos
  const contenido = '\uFEFF' + filas.join('\r\n');
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.setAttribute('href', url);
  enlace.setAttribute('download', p.nombreArchivo);
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

/**
 * Parsea un archivo subido por el usuario.
 * Soporta de manera nativa:
 * - Archivos Excel binarios (.xlsx, .xls)
 * - Archivos CSV / TXT con autodetección de delimitadores (; , \t |)
 */
export async function parsearCSV(archivo: File): Promise<Record<string, string>[]> {
  const nombre = archivo.name.toLowerCase();

  // 1. Si es archivo Excel nativo (.xlsx / .xls)
  if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) {
    const buffer = await archivo.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    if (!workbook.SheetNames.length) {
      throw new Error('El archivo Excel no contiene hojas de cálculo.');
    }
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const datosJson = XLSX.utils.sheet_to_json<Record<string, any>>(hoja, {
      raw: false,
      defval: ''
    });

    if (!datosJson || datosJson.length === 0) {
      throw new Error('La hoja de cálculo de Excel está vacía.');
    }

    return datosJson.map((fila) => {
      const filaLimpia: Record<string, string> = {};
      for (const [k, v] of Object.entries(fila)) {
        filaLimpia[k.trim()] = v !== null && v !== undefined ? v.toString().trim() : '';
      }
      return filaLimpia;
    });
  }

  // 2. Si es archivo de texto / CSV (.csv / .txt)
  const texto = await archivo.text();
  const lineas = texto
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lineas.length < 2) {
    throw new Error('El archivo no contiene suficientes filas (se requiere encabezado y al menos 1 fila de datos).');
  }

  // Detectar delimitador de la primera línea: ; vs , vs \t vs |
  const primeraLinea = lineas[0].replace(/^\uFEFF/, '');
  const cantPuntoYComa = (primeraLinea.match(/;/g) || []).length;
  const cantComa = (primeraLinea.match(/,/g) || []).length;
  const cantTab = (primeraLinea.match(/\t/g) || []).length;
  const cantPipe = (primeraLinea.match(/\|/g) || []).length;

  let delimitador = ';';
  const max = Math.max(cantPuntoYComa, cantComa, cantTab, cantPipe);
  if (max > 0) {
    if (cantPuntoYComa === max) delimitador = ';';
    else if (cantComa === max) delimitador = ',';
    else if (cantTab === max) delimitador = '\t';
    else if (cantPipe === max) delimitador = '|';
  }

  // Parser simple de línea con soporte de comillas
  const parsearFila = (linea: string): string[] => {
    const campos: string[] = [];
    let enComillas = false;
    let actual = '';

    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') {
        if (enComillas && linea[i + 1] === '"') {
          actual += '"';
          i++; // saltar comilla escapada
        } else {
          enComillas = !enComillas;
        }
      } else if (c === delimitador && !enComillas) {
        campos.push(actual.trim());
        actual = '';
      } else {
        actual += c;
      }
    }
    campos.push(actual.trim());
    return campos;
  };

  const cabeceras = parsearFila(primeraLinea).map(c => c.replace(/^"|"$/g, '').trim());
  const resultados: Record<string, string>[] = [];

  for (let i = 1; i < lineas.length; i++) {
    const valores = parsearFila(lineas[i]);
    if (valores.every(v => v === '' || v === '""')) continue; // Fila vacía

    const obj: Record<string, string> = {};
    cabeceras.forEach((cab, idx) => {
      const val = (valores[idx] || '').replace(/^"|"$/g, '').trim();
      obj[cab] = val;
    });
    resultados.push(obj);
  }

  return resultados;
}
