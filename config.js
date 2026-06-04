// ============================================
// ANNA40 — CONFIG
// ============================================

const CONFIG = {
  // Google OAuth
  CLIENT_ID: '377470590062-mdfmcs3unpc843cqg3f25qf8m3godgk3.apps.googleusercontent.com',

  // Admin emails (accés complet + xat IA + gestió)
  ADMIN_EMAILS: ['rogerconesa@gmail.com'],

  // Google Sheets — base de dades de metadades
  SPREADSHEET_ID: '1j9z53zI9LDy8lo__A1ZXq8H4MUqQ8kaSR9JYA-WHzIE',
  SHEET_NAME: 'Fotos',
  SHEET_DIA: 'FotosDia',

  // Login per password (usuari de consulta)
  GUEST_PASSWORD: 'AnnaApp40_TOTS',
  SHEETS_API_KEY: 'AIzaSyDlVEyT4r5s1M4aRjKVOFXHsnhCXRiiQOI', // Maps key (cal habilitar Sheets API)

  // Google Drive
  DRIVE_FOLDER_ID: '1h0kMl3ZJqlOPfovzU-B1uIwLaRNMfIEZ',

  // Scopes — drive.readonly permet llegir tots els fitxers (vídeos d'altri)
  SCOPES: [
    'openid', 'profile', 'email',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets'
  ].join(' '),

  // Gemini API (només admin)
  GEMINI_API_KEY: 'AIzaSyCgD8ajmm61cfx-ByJdtoeuOIrxvJQX5rs',
  GEMINI_MODEL: 'gemini-2.0-flash',
  MAPS_API_KEY: 'AIzaSyBe9Kdwf8J3FzT5YDnINMgu0PdzwaAYpFM',

  // Persones i categories
  PERSONES_INICIALS: ['Roger', 'Ramon', 'Jordi'],
  CATEGORIES: [
    { emoji: '🎉', nom: 'Festa' },
    { emoji: '✈️', nom: 'Viatges' },
    { emoji: '🏖️', nom: 'Platja' },
    { emoji: '🍽️', nom: 'Dinar' },
    { emoji: '🎂', nom: 'Aniversari' },
    { emoji: '🌙', nom: 'Sopar' },
    { emoji: '🎄', nom: 'Nadal' },
    { emoji: '⚽', nom: 'Esport' },
    { emoji: '🔵🔴', nom: 'Barça' },
    { emoji: '🔥', nom: 'Barbacoa' },
    { emoji: '🎤', nom: 'Karaoke' },
    { emoji: '🍻', nom: 'Bar' },
  ]
};
