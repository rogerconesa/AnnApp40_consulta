// ============================================
// ANNA40 — GALLERY
// Galeria amb filtres i lightbox
// ============================================

const Gallery = (() => {
  let _allPhotos      = [];
  let _filteredPhotos = [];
  let _lightboxPhoto  = null;

  function init(photos) {
    _allPhotos      = photos;
    _filteredPhotos = photos;
    _renderFilters();
    _renderGallery();
    _initLightbox();
  }

  function updatePhotos(photos) {
    _allPhotos      = photos;
    _filteredPhotos = photos;
    _renderFilters();
    _renderGallery();
  }

  // ── Filtres ───────────────────────────────────
  function _renderFilters() {
    // Anys únics
    const anys = [...new Set(_allPhotos.map(p => p.any).filter(Boolean))].sort().reverse();
    const anysSel = document.getElementById('filter-any');
    anysSel.innerHTML = '<option value="">Tots els anys</option>' +
      anys.map(a => `<option value="${a}">${a}</option>`).join('');

    // Persones úniques
    const persones = [...new Set(_allPhotos.flatMap(p => p.persones))].filter(Boolean).sort();
    const personesSel = document.getElementById('filter-persona');
    personesSel.innerHTML = '<option value="">Totes les persones</option>' +
      persones.map(p => `<option value="${p}">${p}</option>`).join('');

    // Categories
    const cats = [...new Set(_allPhotos.flatMap(p => p.categoria))].filter(Boolean).sort();
    const catsSel = document.getElementById('filter-categoria');
    catsSel.innerHTML = '<option value="">Totes les categories</option>' +
      cats.map(c => `<option value="${c}">${c}</option>`).join('');

    // Llocs únics
    const llocs = [...new Set(_allPhotos.map(p => p.lloc).filter(Boolean))].sort();
    const llocsSel = document.getElementById('filter-lloc');
    llocsSel.innerHTML = '<option value="">Tots els llocs</option>' +
      llocs.map(l => `<option value="${l}">${l}</option>`).join('');
  }

  function applyFilters() {
    const any       = document.getElementById('filter-any').value;
    const persona   = document.getElementById('filter-persona').value;
    const categoria = document.getElementById('filter-categoria').value;
    const lloc      = document.getElementById('filter-lloc').value;
    const text      = document.getElementById('filter-text').value.toLowerCase().trim();

    _filteredPhotos = _allPhotos.filter(p => {
      if (any       && p.any !== any)                              return false;
      if (persona   && !p.persones.includes(persona))             return false;
      if (categoria && !p.categoria.includes(categoria))          return false;
      if (lloc      && p.lloc !== lloc)                           return false;
      if (text) {
        const searchable = [p.any, p.lloc, p.notes, ...p.persones, ...p.categoria].join(' ').toLowerCase();
        if (!searchable.includes(text)) return false;
      }
      return true;
    });

    _renderGallery();
    if (typeof Chat !== 'undefined') Chat.updatePhotos(_filteredPhotos);
  }

  function resetFilters() {
    document.getElementById('filter-any').value       = '';
    document.getElementById('filter-persona').value   = '';
    document.getElementById('filter-categoria').value = '';
    document.getElementById('filter-lloc').value      = '';
    document.getElementById('filter-text').value      = '';
    _filteredPhotos = _allPhotos;
    _renderGallery();
  }

  // ── Galeria ───────────────────────────────────
  function _renderGallery() {
    const grid  = document.getElementById('gallery-grid');
    const count = document.getElementById('gallery-count');
    const empty = document.getElementById('gallery-empty');

    grid.innerHTML = '';
    count.textContent = `${_filteredPhotos.length} foto${_filteredPhotos.length !== 1 ? 's' : ''}`;

    if (_filteredPhotos.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    _filteredPhotos.forEach((photo, idx) => {
      const div = document.createElement('div');
      div.className = 'gallery-item';
      div.innerHTML = `
        <div class="gallery-img-wrap">
          <img src="${photo.url}" alt="${photo.lloc}" loading="lazy" />
          <div class="gallery-overlay">
            <div class="gallery-overlay-tags">
              ${photo.categoria.slice(0,2).map(c => `<span class="otag">${c}</span>`).join('')}
            </div>
          </div>
        </div>
        <div class="gallery-info">
          <span class="gallery-any">${photo.any}</span>
          <span class="gallery-lloc">${photo.lloc}</span>
          <div class="gallery-persones">${photo.persones.join(' · ')}</div>
        </div>
      `;
      div.addEventListener('click', () => openLightbox(photo));
      grid.appendChild(div);
    });
  }

  // ── Lightbox ──────────────────────────────────
  function _initLightbox() {
    document.getElementById('lightbox-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('lightbox-overlay')) closeLightbox();
    });
    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    document.getElementById('lightbox-prev').addEventListener('click', _prevPhoto);
    document.getElementById('lightbox-next').addEventListener('click', _nextPhoto);

    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('lightbox-overlay').classList.contains('hidden')) {
        if (e.key === 'Escape')    closeLightbox();
        if (e.key === 'ArrowLeft') _prevPhoto();
        if (e.key === 'ArrowRight')_nextPhoto();
      }
    });
  }

  function openLightbox(photo) {
    _lightboxPhoto = photo;
    const idx = _filteredPhotos.findIndex(p => p.fileId === photo.fileId);

    document.getElementById('lightbox-img').src         = photo.url;
    document.getElementById('lightbox-any').textContent  = photo.any;
    document.getElementById('lightbox-lloc').textContent = photo.lloc;
    document.getElementById('lightbox-persones').textContent = photo.persones.join(' · ');
    document.getElementById('lightbox-cats').innerHTML   = photo.categoria.map(c => `<span class="otag">${c}</span>`).join('');
    document.getElementById('lightbox-notes').textContent= photo.notes || '';
    document.getElementById('lightbox-notes').style.display = photo.notes ? 'block' : 'none';
    document.getElementById('lightbox-pujat').textContent= photo.pujatNom ? `Pujat per ${photo.pujatNom}` : '';

    // Botons admin
    const adminActions = document.getElementById('lightbox-admin-actions');
    if (adminActions) adminActions.style.display = Auth.isAdmin() ? 'flex' : 'none';

    document.getElementById('lightbox-prev').style.display = idx > 0 ? 'flex' : 'none';
    document.getElementById('lightbox-next').style.display = idx < _filteredPhotos.length - 1 ? 'flex' : 'none';

    document.getElementById('lightbox-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    document.getElementById('lightbox-overlay').classList.add('hidden');
    document.body.style.overflow = '';
    _lightboxPhoto = null;
  }

  function _prevPhoto() {
    const idx = _filteredPhotos.findIndex(p => p.fileId === _lightboxPhoto?.fileId);
    if (idx > 0) openLightbox(_filteredPhotos[idx - 1]);
  }

  function _nextPhoto() {
    const idx = _filteredPhotos.findIndex(p => p.fileId === _lightboxPhoto?.fileId);
    if (idx < _filteredPhotos.length - 1) openLightbox(_filteredPhotos[idx + 1]);
  }

  function getCurrentPhoto() { return _lightboxPhoto; }
  function getAllPhotos()     { return _allPhotos; }

  // ── Filtrar per llista concreta (des del xat) ─
  function filterByPhotos(photos, label) {
    const indicator = document.getElementById('chat-mode-indicator');
    if (!photos) {
      // Reset a tots
      _filteredPhotos = _allPhotos;
      if (indicator) indicator.style.display = 'none';
    } else {
      _filteredPhotos = photos;
      if (indicator) { indicator.style.display = 'inline'; }
    }
    _renderGallery();
  }

  return { init, updatePhotos, applyFilters, resetFilters, openLightbox, closeLightbox, getCurrentPhoto, getAllPhotos, filterByPhotos };
})();
