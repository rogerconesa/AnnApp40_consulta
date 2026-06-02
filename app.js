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
        if (tab.dataset.tab === 'videos') {
          renderVideos();
        }
      });
    });

    // View toggle (graella / carrussel)
    document.getElementById('view-grid')?.addEventListener('click', () => Gallery.setView('grid'));
    document.getElementById('view-carousel')?.addEventListener('click', () => Gallery.setView('carousel'));

    // Botó editar del lightbox
    document.getElementById('lightbox-edit')?.addEventListener('click', () => {
      const photo = Gallery.getCurrentLightboxPhoto();
      if (photo) { Gallery.closeLightbox(); setTimeout(() => openAdminModal(photo), 100); }
    });
  }

  // ══════════════════════════════════════════
  // EDITOR DE FOTOS (modal reutilitzat)
  // ══════════════════════════════════════════
  let _adminCurrent  = null;

  function initAdmin() {
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
  }

  // ══════════════════════════════════════════
  // VÍDEOS — carrussel autoplay
  // ══════════════════════════════════════════
  let _videoIdx = 0;

  let _videosMode = 'carousel'; // 'carousel' | 'continu'
  let _videosList = [];

  function renderVideos() {
    const carousel = document.getElementById('videos-carousel');
    const empty    = document.getElementById('videos-empty');
    const count    = document.getElementById('videos-count');

    _videosList = _photos.filter(p => p.tipus === 'video');
    count.textContent = `${_videosList.length} vídeo${_videosList.length !== 1 ? 's' : ''}`;

    if (_videosList.length === 0) {
      carousel.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    // Toggle de vista
    let toolbar = document.getElementById('videos-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'videos-toolbar';
      toolbar.className = 'videos-toolbar';
      carousel.parentElement.insertBefore(toolbar, carousel);
    }
    toolbar.innerHTML = `
      <button id="vmode-carousel" class="vmode-btn ${_videosMode === 'carousel' ? 'active' : ''}">🎬 Un a un</button>
      <button id="vmode-continu" class="vmode-btn ${_videosMode === 'continu' ? 'active' : ''}">📜 Tots seguits</button>
    `;
    document.getElementById('vmode-carousel').onclick = () => { _videosMode = 'carousel'; _drawVideos(); };
    document.getElementById('vmode-continu').onclick  = () => { _videosMode = 'continu';  _drawVideos(); };

    _drawVideos();
  }

  function _videoSlideHtml(video) {
    // Reproductor natiu HTML5 amb la URL pública del Drive.
    // Si falla, cau automàticament a l'iframe del Drive.
    const directUrl  = `https://drive.google.com/uc?export=download&id=${video.fileId}`;
    const previewUrl = `https://drive.google.com/file/d/${video.fileId}/preview`;
    return `
      <div class="video-frame">
        <video class="video-native" controls playsinline preload="metadata" data-preview="${previewUrl}">
          <source src="${directUrl}" type="video/mp4" />
        </video>
      </div>
      <div class="video-info">
        <div class="video-info-author">${video.persones.join(', ') || video.pujatNom || 'Felicitació'}</div>
        ${video.categoria.length ? `<div class="video-info-cat">${video.categoria.join(' · ')}</div>` : ''}
        ${video.notes ? `<div class="video-info-notes">"${video.notes}"</div>` : ''}
      </div>`;
  }

  function _bindVideoFallback() {
    document.querySelectorAll('.video-native').forEach(vid => {
      if (vid.dataset.bound) return;
      vid.dataset.bound = '1';
      const src = vid.querySelector('source');
      if (src) src.addEventListener('error', () => _fallbackToIframe(vid));
      vid.addEventListener('error', () => _fallbackToIframe(vid));
      let loaded = false;
      vid.addEventListener('loadedmetadata', () => { loaded = true; });
      setTimeout(() => { if (!loaded && vid.readyState === 0) _fallbackToIframe(vid); }, 4500);
    });
  }

  function _fallbackToIframe(vid) {
    const frame = vid.closest('.video-frame');
    if (!frame || frame.dataset.fellback) return;
    frame.dataset.fellback = '1';
    frame.innerHTML = `<iframe src="${vid.dataset.preview}" allow="autoplay" allowfullscreen
      style="width:100%;height:100%;border:0;border-radius:12px"></iframe>`;
  }

  function _drawVideos() {
    const carousel = document.getElementById('videos-carousel');
    carousel.innerHTML = '';
    document.getElementById('vmode-carousel')?.classList.toggle('active', _videosMode === 'carousel');
    document.getElementById('vmode-continu')?.classList.toggle('active', _videosMode === 'continu');

    if (_videosMode === 'continu') {
      // Llista vertical: tots els vídeos seguits
      carousel.classList.add('videos-continu');
      const list = document.createElement('div');
      list.className = 'videos-list';
      _videosList.forEach(video => {
        const slide = document.createElement('div');
        slide.className = 'video-slide-continu';
        slide.innerHTML = _videoSlideHtml(video);
        list.appendChild(slide);
      });
      carousel.appendChild(list);
      _bindVideoFallback();
      return;
    }

    // Mode carrussel: un a un
    carousel.classList.remove('videos-continu');
    _videoIdx = 0;

    const track = document.createElement('div');
    track.className = 'videos-track';
    track.id = 'videos-track';

    _videosList.forEach(video => {
      const slide = document.createElement('div');
      slide.className = 'video-slide';
      slide.innerHTML = _videoSlideHtml(video);
      track.appendChild(slide);
    });
    carousel.appendChild(track);

    if (_videosList.length > 1) {
      const nav = document.createElement('div');
      nav.className = 'videos-nav';
      nav.innerHTML = `
        <button id="video-prev" class="videos-nav-btn">‹ Anterior</button>
        <span id="video-counter" class="videos-counter">1 / ${_videosList.length}</span>
        <button id="video-next" class="videos-nav-btn">Següent ›</button>
      `;
      carousel.appendChild(nav);

      const update = () => {
        track.style.transform = `translateX(-${_videoIdx * 100}%)`;
        document.getElementById('video-counter').textContent = `${_videoIdx + 1} / ${_videosList.length}`;
      };
      document.getElementById('video-prev').onclick = () => { if (_videoIdx > 0) { _videoIdx--; update(); } };
      document.getElementById('video-next').onclick = () => { if (_videoIdx < _videosList.length - 1) { _videoIdx++; update(); } };
    }
    _bindVideoFallback();
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
    initAdminLlocInput();
    } catch(err) {
      console.error('openAdminModal error:', err);
      UI.showToast('Error obrint editor: ' + err.message, 'error');
    }
  }

  function closeAdminModal() {
    document.getElementById('admin-modal-overlay').classList.add('hidden');
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

  // ── Autocomplete del lloc al modal d'edició ──
  let _adminLlocBound = false;
  function initAdminLlocInput() {
    if (_adminLlocBound) return;
    _adminLlocBound = true;

    const input    = document.getElementById('admin-modal-lloc');
    const dropdown = document.getElementById('admin-places-dropdown');
    if (!input || !dropdown) return;

    let _debounce = null;
    input.addEventListener('input', () => {
      clearTimeout(_debounce);
      const val = input.value.trim();
      document.getElementById('admin-modal-lat').value = '';
      document.getElementById('admin-modal-lng').value = '';
      if (val.length < 2) { dropdown.classList.add('hidden'); return; }
      _debounce = setTimeout(async () => {
        const suggestions = await Geocoder.autocomplete(val);
        dropdown.innerHTML = '';
        if (suggestions.length === 0) {
          const div = document.createElement('div');
          div.className = 'places-option places-option-geocode';
          div.textContent = `Usar "${val}"`;
          div.addEventListener('mousedown', async (e) => {
            e.preventDefault();
            dropdown.classList.add('hidden');
            const c = await Geocoder.geocode(val);
            if (c) {
              document.getElementById('admin-modal-lat').value = c.lat;
              document.getElementById('admin-modal-lng').value = c.lng;
              UI.showToast('Ubicació trobada ✓', 'success');
            }
          });
          dropdown.appendChild(div);
          dropdown.classList.remove('hidden');
          return;
        }
        dropdown.classList.remove('hidden');
        suggestions.forEach(s => {
          const div = document.createElement('div');
          div.className = 'places-option';
          div.textContent = s.text;
          div.addEventListener('mousedown', async (e) => {
            e.preventDefault();
            input.value = s.mainText;
            dropdown.classList.add('hidden');
            const c = await Geocoder.geocodeByPlaceId(s.placeId) || await Geocoder.geocode(s.mainText);
            if (c) {
              document.getElementById('admin-modal-lat').value = c.lat;
              document.getElementById('admin-modal-lng').value = c.lng;
              UI.showToast('Ubicació trobada ✓', 'success');
            }
          });
          dropdown.appendChild(div);
        });
      }, 400);
    });

    input.addEventListener('blur', () => {
      setTimeout(async () => {
        dropdown.classList.add('hidden');
        const val = input.value.trim();
        const lat = document.getElementById('admin-modal-lat').value;
        if (val && !lat) {
          const c = await Geocoder.geocode(val);
          if (c) {
            document.getElementById('admin-modal-lat').value = c.lat;
            document.getElementById('admin-modal-lng').value = c.lng;
          }
        }
      }, 250);
    });
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
      // Geocodificar si hi ha lloc però no coordenades
      let finalLat = lat ? parseFloat(lat) : null;
      let finalLng = lng ? parseFloat(lng) : null;
      if (!isVideo && lloc && (finalLat === null || finalLng === null)) {
        const c = await Geocoder.geocode(lloc);
        if (c) { finalLat = c.lat; finalLng = c.lng; }
      }
      await Sheets.updateRowByFileId(_adminCurrent.fileId, {
        any, lloc, notes, categoria, persones, preferida,
        lat: finalLat,
        lng: finalLng,
      });
      UI.showToast('Canvis guardats!', 'success');
      closeAdminModal();
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
      _photos = await Sheets.readAll();
      Gallery.updatePhotos(_photos);
    } catch(err) {
      UI.showToast('Error eliminant: ' + err.message, 'error');
    }
  }

  return { init, loadPhotos };
})();

window.addEventListener('load', () => setTimeout(App.init, 300));
