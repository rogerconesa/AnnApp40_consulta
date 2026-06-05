// ============================================
// ANNA40 — AUTH (Google + Password mode)
// ============================================

const Auth = (() => {
  let _tokenClient      = null;
  let _accessToken      = null;
  let _userProfile      = null;
  let _onLoginCallback  = null;
  let _onLogoutCallback = null;
  let _mode             = null;
  let _refreshTimer     = null;

  // ── Inicialització ────────────────────────────
  function init(onLogin, onLogout) {
    _onLoginCallback  = onLogin;
    _onLogoutCallback = onLogout;

    // Mode password
    if (localStorage.getItem('anna40_auth') === 'password' || sessionStorage.getItem('anna40_auth') === 'password') {
      _mode = 'password';
      _userProfile = { name: 'Convidada', email: '', picture: '' };
      if (_onLoginCallback) _onLoginCallback(_userProfile);
      return;
    }

    // Esperar Google script
    if (typeof google === 'undefined' || !google.accounts) {
      setTimeout(() => init(onLogin, onLogout), 200);
      return;
    }
    _initGoogleClient();

    // Token guardat (localStorage sobreviu a refresh)
    const saved        = localStorage.getItem('anna40_token') || sessionStorage.getItem('anna40_token');
    const savedProfile = (() => { try { return JSON.parse(localStorage.getItem('anna40_profile') || 'null'); } catch { return null; } })();

    if (saved) {
      _accessToken = saved;
      _mode = 'google';

      if (savedProfile) {
        _userProfile = savedProfile;
        // Mostrar app IMMEDIATAMENT amb el perfil guardat (optimista)
        // Si el token ha caducat, el retry del Sheets gestionarà el 401
        if (_onLoginCallback) _onLoginCallback(_userProfile);
        // Refrescar token en segon pla (silenciós, sense bloquejar)
        refreshToken().catch(() => {
          // Si falla el silent refresh (p.ex. scope nou), seguim amb el token existent
          // Les crides a l'API reintentaran si reben 401
          console.info('Silent refresh no disponible, seguint amb token existent');
        });
      } else {
        // Sense perfil en caché → esperar el refresh (primera vegada)
        refreshToken().then(() => _loadUserProfile()).catch(() => _loadUserProfile());
      }
    }
  }

  function _initGoogleClient() {
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope:     CONFIG.SCOPES,
      callback:  _handleTokenResponse,
    });
  }

  // ── Login per Google ──────────────────────────
  function login() {
    if (!_tokenClient && typeof google !== 'undefined') _initGoogleClient();
    _tokenClient?.requestAccessToken({});
  }

  // ── Login per password ────────────────────────
  function loginWithPassword(pwd) {
    if (pwd === CONFIG.GUEST_PASSWORD) {
      _mode = 'password';
      localStorage.setItem('anna40_auth', 'password'); sessionStorage.setItem('anna40_auth', 'password');
      _userProfile = { name: 'Convidada', email: '', picture: '' };
      if (_onLoginCallback) _onLoginCallback(_userProfile);
      return true;
    }
    return false;
  }

  // ── Logout ────────────────────────────────────
  function logout() {
    if (_mode === 'google' && _accessToken) {
      google.accounts.oauth2.revoke(_accessToken, () => {});
    }
    if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
    _accessToken = null;
    _userProfile = null;
    _mode        = null;
    localStorage.removeItem('anna40_token'); sessionStorage.removeItem('anna40_token');
    localStorage.removeItem('anna40_profile');
    localStorage.removeItem('anna40_auth');
    sessionStorage.removeItem('anna40_auth');
    if (_onLogoutCallback) _onLogoutCallback();
  }

  function _handleTokenResponse(resp) {
    if (resp.error || !resp.access_token) {
      console.error('Auth error:', resp.error);
      return;
    }
    _accessToken = resp.access_token;
    _mode        = 'google';
    localStorage.setItem('anna40_token', _accessToken); sessionStorage.setItem('anna40_token', _accessToken);
    sessionStorage.setItem('anna40_auth', 'google');
    _loadUserProfile();

    // Renovar el token automàticament cada 50 minuts (expira als 60m)
    if (_refreshTimer) clearInterval(_refreshTimer);
    _refreshTimer = setInterval(() => {
      refreshToken().catch(err => console.warn('Silent refresh failed:', err));
    }, 50 * 60 * 1000);
  }

  async function _loadUserProfile() {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': 'Bearer ' + _accessToken }
      });
      if (!res.ok) {
        _accessToken = null;
        localStorage.removeItem('anna40_token'); sessionStorage.removeItem('anna40_token');
        return;
      }
      _userProfile = await res.json();
      localStorage.setItem('anna40_profile', JSON.stringify(_userProfile));
      if (_onLoginCallback) _onLoginCallback(_userProfile);
    } catch(err) {
      console.error('Error perfil:', err);
    }
  }

  // ── Token refresh (per 401) ───────────────────
  function refreshToken() {
    if (_mode !== 'google') return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (!_tokenClient) { reject(new Error('No token client')); return; }
      const orig = _tokenClient.callback;
      _tokenClient.callback = (resp) => {
        _tokenClient.callback = orig;
        if (resp.error || !resp.access_token) { reject(new Error(resp.error)); return; }
        _accessToken = resp.access_token;
        localStorage.setItem('anna40_token', _accessToken); sessionStorage.setItem('anna40_token', _accessToken);
        resolve(_accessToken);
      };
      _tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  // ── Getters ───────────────────────────────────
  function getToken()       { return _accessToken; }
  function getProfile()     { return _userProfile; }
  function isLoggedIn()     { return !!_mode; }
  function isAdmin()        { return _mode === 'google' && _userProfile && CONFIG.ADMIN_EMAILS?.includes(_userProfile.email); }
  function isPasswordMode() { return _mode === 'password'; }
  function getMode()        { return _mode; }

  return { init, login, loginWithPassword, logout, getToken, getProfile, isLoggedIn, isAdmin, isPasswordMode, getMode, refreshToken };
})();
