/**
 * CREDIT-ON — Catálogo Centralizado y Canónico de Cobradores
 * ==========================================================
 * Fuente única de verdad para la nómina de cobradores base,
 * comisiones, zonas asignadas y teléfonos oficiales de contacto.
 */

export interface CobradorBase {
  id_cobrador: number;
  nombre: string;
  telefono: string;
  porcentaje_comision: number;
  zona: string;
  activo: boolean;
  inicial?: string;
  contrato?: string;
  tarifa?: string;
}

export const COBRADORES_CANONICOS: CobradorBase[] = [
  {
    id_cobrador: 1,
    nombre: 'Ariel Gómez',
    telefono: '+54 9 385 412-3456',
    porcentaje_comision: 8.0,
    zona: 'Zona Centro (Capital)',
    activo: true,
    inicial: 'A',
    contrato: 'Contrato #C-01',
    tarifa: 'Cobrador Senior',
  },
  {
    id_cobrador: 2,
    nombre: 'Carlos Mendilaharzu',
    telefono: '+54 9 385 445-1290',
    porcentaje_comision: 8.0,
    zona: 'Zona Sur (Ejército Arg.)',
    activo: true,
    inicial: 'C',
    contrato: 'Contrato #C-02',
    tarifa: 'Cobrador Senior',
  },
  {
    id_cobrador: 3,
    nombre: 'Álvaro Morales',
    telefono: '+54 9 385 671-0023',
    porcentaje_comision: 8.0,
    zona: 'Zona La Banda (Centro)',
    activo: true,
    inicial: 'Á',
    contrato: 'Contrato #C-03',
    tarifa: 'Cobrador Senior',
  },
  {
    id_cobrador: 4,
    nombre: 'Mauro Sánchez',
    telefono: '+54 9 385 552-8812',
    porcentaje_comision: 8.0,
    zona: 'Zona Norte (Parque Ind.)',
    activo: true,
    inicial: 'M',
    contrato: 'Contrato #C-04',
    tarifa: 'Cobrador Senior',
  },
  {
    id_cobrador: 5,
    nombre: 'Antonela Rossi',
    telefono: '+54 9 385 332-9011',
    porcentaje_comision: 9.0,
    zona: 'Zona Oeste (San Fernando)',
    activo: true,
    inicial: 'An',
    contrato: 'Contrato #C-05',
    tarifa: 'Sub-cobrador',
  },
  {
    id_cobrador: 6,
    nombre: 'Oriana Paz',
    telefono: '+54 9 385 512-9988',
    porcentaje_comision: 7.5,
    zona: 'Zona Belgrano / Cabildo',
    activo: true,
    inicial: 'O',
    contrato: 'Contrato #C-06',
    tarifa: 'Cobrador Senior',
  },
];
