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

  async function readAll() {
    const range    = `'${CONFIG.SHEET_NAME}'!A2:O`;
    const endpoint = `${BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
    const res = await fetch(endpoint, { headers: _headers() });
    if (!res.ok) throw new Error('Error llegint Sheets');
    const data = await res.json();
    const rows = data.values || [];
    return rows.map(r => ({
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
      lat:        r[11] ? parseFloat(r[11]) : null,
      lng:        r[12] ? parseFloat(r[12]) : null,
      tipus:      r[13] || 'foto',
      preferida:  r[14] === 'true',
    }));
  }

  return { readAll };
})();
