// ============================================
// ANNA40 — SHEETS (read only majoritàriament)
// ============================================

const Sheets = (() => {
  const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

  function _headers() {
    const token = Auth.getToken();
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }

  // URL per llegir: amb token → OAuth; sense → API key (full públic)
  function _readUrl(range) {
    const base = `${BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
    return Auth.getToken() ? base : base + `&key=${CONFIG.SHEETS_API_KEY}`;
  }

  // Parseja coordenades robustament (punt o coma decimal)
  function _parseCoord(val) {
    if (!val && val !== 0) return null;
    const str = String(val).trim().replace(',', '.');
    const n   = parseFloat(str);
    return isNaN(n) ? null : n;
  }

  async function readAll(_isRetry) {
    const range    = `'${CONFIG.SHEET_NAME}'!A2:O`;
    const endpoint = _readUrl(range);
    const res = await fetch(endpoint, { headers: _headers() });
    if (res.status === 401 && !_isRetry) {
      await Auth.refreshToken();
      return readAll(true);
    }
    if (!res.ok) throw new Error('Error llegint Sheets (' + res.status + ')');
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

  async function updateRowByFileId(fileId, data) {
    const range    = `'${CONFIG.SHEET_NAME}'!A:O`;
    const endpoint = `${BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
    const res  = await fetch(endpoint, { headers: _headers() });
    if (!res.ok) throw new Error('Error llegint Sheets');
    const json = await res.json();
    const rows = json.values || [];
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][1] === fileId) { rowIndex = i + 1; break; }
    }
    if (rowIndex === -1) throw new Error('Fila no trobada');

    const put = async (range, values) => {
      const ep = `${BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
      await fetch(ep, { method: 'PUT', headers: _headers(), body: JSON.stringify({ values }) });
    };

    await put(`'${CONFIG.SHEET_NAME}'!D${rowIndex}:H${rowIndex}`, [[
      data.any || '', data.lloc || '',
      Array.isArray(data.persones)  ? data.persones.join(', ')  : '',
      Array.isArray(data.categoria) ? data.categoria.join(', ') : '',
      data.notes || '',
    ]]);

    if (data.lat !== undefined) {
      await put(`'${CONFIG.SHEET_NAME}'!L${rowIndex}:M${rowIndex}`, [[data.lat || '', data.lng || '']]);
    }
    if (data.preferida !== undefined) {
      await put(`'${CONFIG.SHEET_NAME}'!O${rowIndex}`, [[data.preferida ? 'true' : 'false']]);
    }
  }

  async function deleteRowByFileId(fileId) {
    const range    = `'${CONFIG.SHEET_NAME}'!A:O`;
    const endpoint = `${BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
    const res  = await fetch(endpoint, { headers: _headers() });
    if (!res.ok) throw new Error('Error llegint Sheets');
    const data = await res.json();
    const rows = data.values || [];
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][1] === fileId) { rowIndex = i; break; }
    }
    if (rowIndex === -1) throw new Error('Fila no trobada');

    const metaRes = await fetch(`${BASE}/${CONFIG.SPREADSHEET_ID}`, { headers: _headers() });
    const meta    = await metaRes.json();
    const sheet   = meta.sheets.find(s => s.properties.title === CONFIG.SHEET_NAME);
    const sheetId = sheet.properties.sheetId;

    await fetch(`${BASE}/${CONFIG.SPREADSHEET_ID}:batchUpdate`, {
      method: 'POST', headers: _headers(),
      body: JSON.stringify({ requests: [{ deleteDimension: {
        range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 }
      }}]})
    });
  }

  async function deleteFile(fileId) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + Auth.getToken() },
    });
    if (!res.ok && res.status !== 204) throw new Error('Error eliminant fitxer: ' + res.status);
  }

  async function readDia() {
    const sheetName = CONFIG.SHEET_DIA || 'FotosDia';
    // Llegir des de A1 per no perdre la fila 1 si no hi ha capçalera
    const range     = `'${sheetName}'!A1:O`;
    const endpoint  = _readUrl(range);
    const res = await fetch(endpoint, { headers: _headers() });
    if (!res.ok) {
      if (res.status === 400) return [];
      throw new Error('Error llegint Fotos del dia');
    }
    const data = await res.json();
    return (data.values || []).map(r => ({
      id:         r[0]  || '',
      fileId:     r[1]  || '',
      url:        r[2]  || '',
      any:        r[3]  || '',
      lloc:       r[4]  || '',
      persones:   r[5]  ? String(r[5]).split(', ') : [],
      categoria:  r[6]  ? String(r[6]).split(', ') : [],
      notes:      r[7]  || '',
      pujatNom:   r[8]  || '',
      pujatEmail: r[9]  || '',
      data:       r[10] || '',
      lat:        _parseCoord(r[11]),
      lng:        _parseCoord(r[12]),
      tipus:      r[13] || 'foto',
      preferida:  r[14] === 'true',
    })).filter(r => r.fileId && r.fileId.length > 10 && r.fileId !== 'fileId');
  }

  return { readAll, updateRowByFileId, deleteRowByFileId, deleteFile, readDia };
})();
