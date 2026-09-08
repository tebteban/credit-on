/**
 * CREDIT-ON — Utilidades de Productos e Inferencias Visuales
 * ===========================================================
 */

export const inferirIconoProducto = (nombre: string): string => {
  const n = (nombre || '').toLowerCase();
  if (n.includes('tv') || n.includes('smart') || n.includes('tele') || n.includes('pantalla')) return 'tv';
  if (n.includes('helad') || n.includes('freezer') || n.includes('frio') || n.includes('refrigerador')) return 'kitchen';
  if (n.includes('moto') || n.includes('scooter') || n.includes('ciclomotor')) return 'two_wheeler';
  if (n.includes('bici') || n.includes('mountain')) return 'pedal_bike';
  if (n.includes('sommier') || n.includes('cama') || n.includes('colchon') || n.includes('respaldo')) return 'bed';
  if (n.includes('celu') || n.includes('smartphone') || n.includes('moto g') || n.includes('samsung') || n.includes('iphone') || n.includes('tel')) return 'smartphone';
  if (n.includes('vent') || n.includes('turbina')) return 'mode_fan';
  if (n.includes('lava') || n.includes('secarropa')) return 'local_laundry_service';
  if (n.includes('aire') || n.includes('split') || n.includes('clima') || n.includes('acondicionador')) return 'ac_unit';
  if (n.includes('horno') || n.includes('cocina') || n.includes('microonda') || n.includes('anafe')) return 'microwave';
  if (n.includes('audio') || n.includes('parlante') || n.includes('sound') || n.includes('equipo')) return 'speaker';
  if (n.includes('compu') || n.includes('notebook') || n.includes('laptop') || n.includes('pc')) return 'laptop_mac';
  return 'inventory_2';
};
