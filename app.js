// ============================================
// ANNA40 — APP
// ============================================

const App = (() => {
  let _photos = [];

  async function loadPhotos() {
    UI.showLoading();
    try {
      _photos = await Sheets.readAll();
      Gallery.updatePhotos(_photos);
      if (Auth.isAdmin() && typeof Chat !== 'undefined') Chat.updatePhotos(_photos);
    } catch (err) {
      UI.showToast('Error carregant fotos: ' + err.message, 'error');
    } finally {
      UI.hideLoading();
    }
  }

  function init() {
    Auth.init(
      async (profile) => {
        UI.setUser(profile, Auth.isAdmin());
        UI.showScreen('screen-app');
        await loadPhotos();

        if (Auth.isAdmin()) {
          Gallery.init(_photos);
          Chat.init(_photos);
          Admin.initUpload();
        } else {
          Gallery.init(_photos);
        }
      },
      () => {
        UI.showScreen('screen-login');
      }
    );

    // Login
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

    // Filtres galeria
    ['filter-any', 'filter-persona', 'filter-categoria', 'filter-lloc'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => Gallery.applyFilters());
    });
    document.getElementById('filter-text')?.addEventListener('input', () => Gallery.applyFilters());
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => Gallery.resetFilters());

    // Lightbox admin actions
    document.getElementById('lightbox-btn-edit')?.addEventListener('click', () => {
      const photo = Gallery.getCurrentPhoto();
      if (photo) Admin.openEditModal(photo);
    });
  }

  return { init, loadPhotos, getPhotos: () => _photos };
})();

window.addEventListener('load', () => setTimeout(App.init, 300));
