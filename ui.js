// ============================================
// ANNA40 — UI
// ============================================

const UI = (() => {
  let _toastTimer = null;

  function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (type ? ' ' + type : '');
    t.classList.remove('hidden');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function setUser(profile, isAdmin) {
    const avatar = document.getElementById('user-avatar');
    const name   = document.getElementById('user-name');
    if (avatar) {
      if (profile.picture) {
        avatar.src = profile.picture;
        avatar.style.background = '';
        avatar.style.padding = '';
      } else {
        // Icona persona per defecte (mode password)
        avatar.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230a84ff' stroke-width='1.8'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M4 20c0-4 3.6-7 8-7s8 3 8 7'/%3E%3C/svg%3E";
        avatar.style.background = 'var(--bg3)';
        avatar.style.padding = '4px';
      }
    }
    if (name) name.textContent = profile.name || profile.email;
    const adminTab = document.getElementById('tab-btn-admin');
    if (adminTab) adminTab.style.display = isAdmin ? 'flex' : 'none';
  }

  function showLoading(msg = 'Carregant records...') {
    document.getElementById('loading-overlay').classList.remove('hidden');
    document.getElementById('loading-text').textContent = msg;
  }

  function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
  }

  return { showToast, showScreen, setUser, showLoading, hideLoading };
})();
