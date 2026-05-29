// ============================================
// ANNA40 — APP v3
// ============================================

const App = (() => {
  let _photos = [];

  async function loadPhotos() {
    UI.showLoading();
    try {
      _photos = await Sheets.readAll();
      Gallery.updatePhotos(_photos);
      if (typeof MapView !== 'undefined') MapView.updatePhotos(_photos);
    } catch(err) {
      console.error(err);
      UI.showToast('Error carregant: ' + err.message, 'error');
    } finally {
      UI.hideLoading();
    }
  }

  function init() {
    Auth.init(
      async (profile) => {
        const isAdmin = Auth.isAdmin();
        UI.setUser(profile, isAdmin);
        UI.showScreen('screen-app');
        await loadPhotos();
        Gallery.init(_photos);
        if (typeof MapView !== 'undefined') MapView.init();
      },
      () => UI.showScreen('screen-login')
    );

    document.getElementById('btn-google-login').addEventListener('click', () => Auth.login());
    document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());

    // Nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
        const panel = document.getElementById('panel-' + tab.dataset.tab);
        if (panel) panel.classList.remove('hidden');
      });
    });
  }

  return { init, loadPhotos };
})();

window.addEventListener('load', () => setTimeout(App.init, 300));
