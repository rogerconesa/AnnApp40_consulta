// ============================================
// ANNA40 — SHEETS (read only majoritàriament)
// ============================================

const Sheets = (() => {
  const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

  function _headers() {
    return {
      'Authorization': 'Bearer ' + Auth.getToken(),
      'Content-Type':  'application/json',
    };
  }

  // Parseja coordenades robustament (punt o coma decimal)
  function _parseCoord(val) {
    if (!val && val !== 0) return null;
    const str = String(val).trim().replace(',', '.');
    const n   = parseFloat(str);
    return isNaN(n) ? null : n;
  }

  async function readAll() {
    const range    = `'${CONFIG.SHEET_NAME}'!A2:O`;
    const endpoint = `${BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
    const res = await fetch(endpoint, { headers: _headers() });
    if (!res.ok) throw new Error('Error llegint Sheets');
    const data = await res.json();
    const rows = data.values || [];
    return rows.map(r => {
      const lat = _parseCoord(r[11]);
      const lng = _parseCoord(r[12]);
      if (lat !== null && lng !== null) {
        console.log(`📍 ${r[4] || '?'}: lat=${lat}, lng=${lng}`);
      }
      return {
        id:         r[0]  || '',
        fileId:     r[1]  || '',
        url:        r[2]  || '',
        any:        r[3]  || '',
        lloc:       r[4]  || '',
        persones:   r[5]  ? r[5].split(', ') : [],
        categoria:  r[6]  ? r[6].split(', ') : [],
        notes:      r[7]  || '',
        pujatNom:   r[8]  || '',
        pujatEmail: r[9]  || '',
        data:       r[10] || '',
        lat,
        lng,
        tipus:      r[13] || 'foto',
        preferida:  r[14] === 'true',
      };
    });
  }

  return { readAll };
})();
