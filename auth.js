// ============================================
// ANNA40 — AUTH (Google + Password mode)
// ============================================

const Auth = (() => {
  let _tokenClient      = null;
  let _accessToken      = null;
  let _userProfile      = null;
  let _onLoginCallback  = null;
  let _onLogoutCallback = null;
  let _mode             = null; // 'google' | 'password'

  // ── Inicialització ────────────────────────────
  function init(onLogin, onLogout) {
    _onLoginCallback  = onLogin;
    _onLogoutCallback = onLogout;

    // Restaurar sessió de password
    if (sessionStorage.getItem('anna40_auth') === 'password') {
      _mode = 'password';
      _userProfile = { name: 'Convidada', email: '', picture: '' };
      if (_onLoginCallback) _onLoginCallback(_userProfile);
      return;
    }

    // Restaurar sessió de Google
    if (typeof google === 'undefined' || !google.accounts) {
      setTimeout(() => init(onLogin, onLogout), 200);
      return;
    }
    _initGoogleClient();

    const saved = sessionStorage.getItem('anna40_token');
    if (saved) {
      _accessToken = saved;
      _mode = 'google';
      _loadUserProfile();
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
      sessionStorage.setItem('anna40_auth', 'password');
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
    _accessToken = null;
    _userProfile = null;
    _mode        = null;
    sessionStorage.removeItem('anna40_token');
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
    sessionStorage.setItem('anna40_token', _accessToken);
    sessionStorage.setItem('anna40_auth', 'google');
    _loadUserProfile();
  }

  async function _loadUserProfile() {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': 'Bearer ' + _accessToken }
      });
      if (!res.ok) {
        _accessToken = null;
        sessionStorage.removeItem('anna40_token');
        return;
      }
      _userProfile = await res.json();
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
        sessionStorage.setItem('anna40_token', _accessToken);
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
