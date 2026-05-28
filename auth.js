// ============================================
// ANNA40 — AUTH
// ============================================

const Auth = (() => {
  let _tokenClient     = null;
  let _accessToken     = null;
  let _userProfile     = null;
  let _onLoginCallback = null;
  let _onLogoutCallback= null;

  function init(onLogin, onLogout) {
    _onLoginCallback  = onLogin;
    _onLogoutCallback = onLogout;

    if (typeof google === 'undefined' || !google.accounts) {
      setTimeout(() => init(onLogin, onLogout), 200);
      return;
    }

    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope:     CONFIG.SCOPES,
      callback:  _handleTokenResponse,
    });

    const saved = sessionStorage.getItem('anna40_token');
    if (saved) {
      _accessToken = saved;
      _loadUserProfile();
    }
  }

  function login() {
    _tokenClient.requestAccessToken({});
  }

  function logout() {
    if (_accessToken) google.accounts.oauth2.revoke(_accessToken, () => {});
    _accessToken  = null;
    _userProfile  = null;
    sessionStorage.removeItem('anna40_token');
    if (_onLogoutCallback) _onLogoutCallback();
  }

  function _handleTokenResponse(resp) {
    if (resp.error || !resp.access_token) {
      console.error('Auth error:', resp.error);
      return;
    }
    _accessToken = resp.access_token;
    sessionStorage.setItem('anna40_token', _accessToken);
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
    } catch (err) {
      console.error('Error carregant perfil:', err);
    }
  }

  function isAdmin() {
    return _userProfile && CONFIG.ADMIN_EMAILS.includes(_userProfile.email);
  }

  function getToken()   { return _accessToken; }
  function getProfile() { return _userProfile; }
  function isLoggedIn() { return !!_accessToken; }

  return { init, login, logout, getToken, getProfile, isLoggedIn, isAdmin };
})();
