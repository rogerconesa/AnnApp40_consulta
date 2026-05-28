// ============================================
// ANNA40 — UI
// ============================================

const UI = (() => {
  let _toastTimer = null;

  function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className   = 'toast' + (type ? ' ' + type : '');
    t.classList.remove('hidden');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function setUser(profile, isAdmin) {
    document.getElementById('user-avatar').src      = profile.picture || '';
    document.getElementById('user-name').textContent = profile.name || profile.email;

    // Mostrar pestanya admin si és admin
    const adminTab = document.getElementById('tab-btn-admin');
    const chatTab  = document.getElementById('tab-btn-chat');
    if (adminTab) adminTab.style.display = isAdmin ? 'flex' : 'none';
    if (chatTab)  chatTab.style.display  = isAdmin ? 'flex' : 'none';
  }

  function showLoading(msg = 'Carregant fotos...') {
    document.getElementById('loading-overlay').classList.remove('hidden');
    document.getElementById('loading-text').textContent = msg;
  }

  function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
  }

  return { showToast, showScreen, setUser, showLoading, hideLoading };
})();
