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
      Chat.updatePhotos(_photos);
    } catch (err) {
      UI.showToast('Error carregant fotos: ' + err.message, 'error');
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

        // Inicialitzar mòduls
        Gallery.init(_photos);
        Chat.init(_photos, isAdmin);
        if (isAdmin) Admin.initUpload();
      },
      () => UI.showScreen('screen-login')
    );

    // Login / logout
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
        // Mostrar/ocultar chat bar només a galeria
        const chatBar = document.getElementById('chat-bar');
        if (chatBar) chatBar.style.display = tab.dataset.tab === 'galeria' ? 'flex' : 'none';
      });
    });

    // Filtres galeria
    ['filter-any','filter-persona','filter-categoria','filter-lloc'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        Chat.clearChat();
        Gallery.applyFilters();
      });
    });
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
      Chat.clearChat();
      Gallery.resetFilters();
    });

    // Lightbox admin
    document.getElementById('lightbox-btn-edit')?.addEventListener('click', () => {
      const photo = Gallery.getCurrentPhoto();
      if (photo) Admin.openEditModal(photo);
    });
  }

  return { init, loadPhotos, getPhotos: () => _photos };
})();

window.addEventListener('load', () => setTimeout(App.init, 300));
