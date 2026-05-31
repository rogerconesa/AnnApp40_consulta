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
        initAdmin();
        // Mapa: s'inicialitza lazy quan l'usuari obre la pestanya
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
        if (tab.dataset.tab === 'mapa') {
          MapView.init();
          MapView.updatePhotos(_photos);
        }
        if (tab.dataset.tab === 'admin') {
          loadAdmin();
        }
      });
    });
  }

  // ══════════════════════════════════════════
  // ADMIN PANEL
  // ══════════════════════════════════════════
  let _adminPhotos   = [];
  let _adminFiltered = [];
  let _adminCurrent  = null;

  async function initAdmin() {
    // Event delegation al grid — un sol listener per a tots els items
    const adminGrid = document.getElementById('admin-grid');
    console.log('initAdmin: admin-grid trobat?', !!adminGrid);
    adminGrid?.addEventListener('click', (e) => {
      // Buscar el .admin-item que té data-idx
      let el = e.target;
      while (el && el !== adminGrid) {
        if (el.dataset && el.dataset.idx !== undefined) {
          const idx = parseInt(el.dataset.idx);
          if (!isNaN(idx) && _adminFiltered[idx]) {
            openAdminModal(_adminFiltered[idx]);
          }
          return;
        }
        el = el.parentElement;
      }
    });
    document.getElementById('btn-admin-reload')?.addEventListener('click', loadAdmin);
    document.getElementById('admin-modal-close')?.addEventListener('click', closeAdminModal);
    document.getElementById('admin-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('admin-modal-overlay')) closeAdminModal();
    });
    document.getElementById('admin-modal-save')?.addEventListener('click', saveAdmin);
    document.getElementById('admin-modal-delete')?.addEventListener('click', deleteAdmin);
    document.getElementById('admin-modal-add-persona')?.addEventListener('click', () => {
      const input = document.getElementById('admin-modal-input-persona');
      const nom   = input.value.trim();
      if (!nom) return;
      adminAddChip(document.getElementById('admin-modal-chips-persones'), nom, true);
      input.value = '';
    });
    document.getElementById('admin-modal-input-persona')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('admin-modal-add-persona').click(); }
    });
    document.getElementById('admin-modal-preferida')?.addEventListener('click', function() {
      this.classList.toggle('active');
      this.textContent = this.classList.contains('active') ? '⭐ Foto preferida' : '☆ Marcar com a preferida';
    });
    document.getElementById('admin-filter-persona')?.addEventListener('change', renderAdminGrid);
    document.getElementById('admin-filter-qui')?.addEventListener('change', renderAdminGrid);
  }

  async function loadAdmin() {
    const grid = document.getElementById('admin-grid');
    const loading = document.getElementById('admin-loading');
    const empty   = document.getElementById('admin-empty');
    grid.innerHTML = '';
    loading.classList.remove('hidden');
    empty.classList.add('hidden');

    try {
      _adminPhotos = await Sheets.readAll();
      loading.classList.add('hidden');

      // Omplir filtres
      const persones = [...new Set(_adminPhotos.flatMap(p => p.persones))].filter(Boolean).sort();
      const autors   = [...new Set(_adminPhotos.map(p => p.pujatNom).filter(Boolean))].sort();
      const filtPers = document.getElementById('admin-filter-persona');
      const filtQui  = document.getElementById('admin-filter-qui');
      const prevPers = filtPers.value;
      const prevQui  = filtQui.value;

      filtPers.innerHTML = '<option value="">👤 Totes les persones</option>';
      persones.forEach(p => { const o = document.createElement('option'); o.value = p; o.textContent = p; if(p===prevPers) o.selected=true; filtPers.appendChild(o); });

      filtQui.innerHTML = '<option value="">📤 Tots els col·laboradors</option>';
      autors.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; if(a===prevQui) o.selected=true; filtQui.appendChild(o); });

      renderAdminGrid();
    } catch(err) {
      loading.classList.add('hidden');
      UI.showToast('Error: ' + err.message, 'error');
    }
  }

  function renderAdminGrid() {
    const grid    = document.getElementById('admin-grid');
    const empty   = document.getElementById('admin-empty');
    const count   = document.getElementById('admin-count');
    const filtPers = document.getElementById('admin-filter-persona').value;
    const filtQui  = document.getElementById('admin-filter-qui').value;

    const filtered = _adminPhotos.filter(p => {
      if (filtPers && !p.persones.includes(filtPers)) return false;
      if (filtQui  && p.pujatNom !== filtQui) return false;
      return true;
    });

    grid.innerHTML = '';
    count.textContent = `${filtered.length} element${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    filtered.forEach(photo => {
      const isVideo = photo.tipus === 'video';
      const div = document.createElement('div');
      div.className = 'admin-item' + (isVideo ? ' admin-video' : '');
      div.innerHTML = `
        ${isVideo
          ? '<div class="admin-video-thumb">🎬</div>'
          : `<img class="admin-item-img" src="${photo.url}" alt="" loading="lazy" />`}
        ${photo.preferida ? '<div class="admin-item-star">⭐</div>' : ''}
        <div class="admin-item-overlay">✏️ Editar</div>
        <div class="admin-item-info">
          <div class="admin-item-lloc">${photo.lloc || (isVideo ? 'Vídeo' : '—')}</div>
          <div class="admin-item-meta">${photo.any || ''} · ${photo.pujatNom || ''}</div>
        </div>
      `;
      div.addEventListener('click', () => openAdminModal(photo));
      grid.appendChild(div);
    });
  }

  function openAdminModal(photo) {
    try {
    _adminCurrent = photo;
    const isVideo = photo.tipus === 'video';

    const img = document.getElementById('admin-modal-img');
    const vid = document.getElementById('admin-modal-video');
    if (isVideo) { img.style.display = 'none'; vid.style.display = 'flex'; }
    else { img.src = photo.url; img.style.display = 'block'; vid.style.display = 'none'; }

    document.getElementById('admin-modal-author').textContent =
      `Pujat per ${photo.pujatNom || '?'} · ${photo.pujatEmail || ''}`;

    // Anys
    const anyEl = document.getElementById('admin-modal-any');
    anyEl.innerHTML = '<option value="">Any...</option>';
    for (let y = new Date().getFullYear(); y >= 1985; y--) {
      const o = document.createElement('option');
      o.value = y; o.textContent = y;
      if (String(y) === String(photo.any)) o.selected = true;
      anyEl.appendChild(o);
    }

    document.getElementById('admin-modal-lloc').value  = photo.lloc || '';
    document.getElementById('admin-modal-lat').value   = photo.lat  || '';
    document.getElementById('admin-modal-lng').value   = photo.lng  || '';
    document.getElementById('admin-modal-notes').value = photo.notes || '';

    // Camps foto/video
    document.getElementById('admin-lloc-group').style.display = isVideo ? 'none' : '';
    document.getElementById('admin-cat-group').style.display  = isVideo ? 'none' : '';
    document.getElementById('admin-preferida-group').style.display = isVideo ? 'none' : '';

    // Categories
    const catContainer = document.getElementById('admin-modal-chips-categoria');
    catContainer.innerHTML = '';
    const cats = ['Vallvis','Happy Family','ICR','Wiki-Wiki','Menéndez','DMS','Senes','Aran',
                  'Festa','Aniversari','Viatges','Platja','Barbacoa'];
    cats.forEach(c => adminAddChip(catContainer, c, (photo.categoria||[]).includes(c)));

    // Persones
    const persContainer = document.getElementById('admin-modal-chips-persones');
    persContainer.innerHTML = '';
    const allPers = [...new Set([...(['Roger','Ramon','Jordi']), ...(photo.persones||[])])];
    allPers.forEach(p => adminAddChip(persContainer, p, (photo.persones||[]).includes(p)));

    // Preferida
    const prefBtn = document.getElementById('admin-modal-preferida');
    prefBtn.classList.toggle('active', !!photo.preferida);
    prefBtn.textContent = photo.preferida ? '⭐ Foto preferida' : '☆ Marcar com a preferida';

    document.getElementById('admin-modal-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    } catch(err) {
      console.error('openAdminModal error:', err);
      UI.showToast('Error obrint editor: ' + err.message, 'error');
    }
  }

  function closeAdminModal() {
    document.getElementById('admin-modal-overlay').classList.add('hidden');
    document.body.style.overflow = '';
    _adminCurrent = null;
  }

  function adminAddChip(container, nom, selected) {
    if ([...container.querySelectorAll('.chip')].some(c => c.dataset.value === nom)) return;
    const btn = document.createElement('button');
    btn.className = 'chip' + (selected ? ' selected' : '');
    btn.dataset.value = nom; btn.textContent = nom;
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
    container.appendChild(btn);
  }

  async function saveAdmin() {
    if (!_adminCurrent) return;
    const isVideo   = _adminCurrent.tipus === 'video';
    const any       = document.getElementById('admin-modal-any').value;
    const lloc      = document.getElementById('admin-modal-lloc').value.trim();
    const lat       = document.getElementById('admin-modal-lat').value;
    const lng       = document.getElementById('admin-modal-lng').value;
    const notes     = document.getElementById('admin-modal-notes').value.trim();
    const categoria = isVideo ? _adminCurrent.categoria : [...document.querySelectorAll('#admin-modal-chips-categoria .chip.selected')].map(c => c.dataset.value);
    const persones  = [...document.querySelectorAll('#admin-modal-chips-persones .chip.selected')].map(c => c.dataset.value);
    const prefBtn   = document.getElementById('admin-modal-preferida');
    const preferida = prefBtn.classList.contains('active');

    const btn = document.getElementById('admin-modal-save');
    btn.disabled = true; btn.textContent = 'Guardant...';

    try {
      await Sheets.updateRowByFileId(_adminCurrent.fileId, {
        any, lloc, notes, categoria, persones, preferida,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
      });
      UI.showToast('Canvis guardats!', 'success');
      closeAdminModal();
      loadAdmin();
      // Recarregar galeria
      _photos = await Sheets.readAll();
      Gallery.updatePhotos(_photos);
    } catch(err) {
      UI.showToast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar canvis';
    }
  }

  async function deleteAdmin() {
    if (!_adminCurrent) return;
    if (!confirm(`Eliminar "${_adminCurrent.lloc || _adminCurrent.fileId}"? Aquesta acció no es pot desfer.`)) return;
    try {
      await Sheets.deleteFile(_adminCurrent.fileId);
      await Sheets.deleteRowByFileId(_adminCurrent.fileId);
      UI.showToast('Eliminat correctament', 'success');
      closeAdminModal();
      loadAdmin();
      _photos = await Sheets.readAll();
      Gallery.updatePhotos(_photos);
    } catch(err) {
      UI.showToast('Error eliminant: ' + err.message, 'error');
    }
  }

  return { init, loadPhotos };
})();

window.addEventListener('load', () => setTimeout(App.init, 300));
