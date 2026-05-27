// Deterministic mock helper: derive extra building fields from name hash so the
// same building always shows the same horario/encargado/lat/lng/mail/teléfono.
export interface BuildingExtras {
  horario: string | null;
  encargado: string;
  telefono: string;
  lat: string;
  lng: string;
  mail: string | null;
  observaciones: string | null;
}

export function buildingExtras(name: string): BuildingExtras {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const horarios = [
    'de 8 a 12 Hs',
    '8 a 13',
    'Lu, Mi y Vi de 7 a 11 Hs',
    'Solo Martes de 8 a 12 Hs',
    'Hasta las 12',
    '12 Hs',
    null,
  ];
  const encargados = [
    'Silvana',
    'Sergio',
    'Victor',
    'Pablo',
    'Daniel',
    'Rogelio',
    'Evelyn',
    'Monica',
    'Marcelo',
    'Cesar Limpieza',
    'Juan Carlos',
    'SEGURIDAD',
  ];
  const enc = encargados[h % encargados.length];
  const tel = `11${(40000000 + (h % 50000000)).toString().slice(0, 8)}`;
  const lat = (-34.5 - ((h % 1000) / 10000)).toFixed(3);
  const lng = (-58.4 - ((h % 1000) / 10000)).toFixed(3);
  const mail =
    enc === 'SEGURIDAD'
      ? null
      : `adm.${enc.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
  return {
    horario: horarios[h % horarios.length],
    encargado: enc,
    telefono: tel,
    lat,
    lng,
    mail,
    observaciones: h % 3 === 0 ? null : 'No Existen Observaciones',
  };
}
