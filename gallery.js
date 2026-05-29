// ============================================
// ANNA40 — GALLERY v3
// Cerca, filtres pills, slider anys, destacades, lightbox
// ============================================

const Gallery = (() => {
  let _allPhotos      = [];
  let _filteredPhotos = [];
  let _lightboxPhoto  = null;

  // Filtres actius
  let _filters = {
    persona:   null,
    categoria: null,
    lloc:      null,
    text:      '',
    yearMin:   null,
    yearMax:   null,
  };

  function init(photos) {
    _allPhotos = photos;
    _initYearSlider();
    _initSearch();
    _initLightbox();
    apply();
  }

  function updatePhotos(photos) {
    _allPhotos = photos;
    _initYearSlider();
    apply();
  }

  // ── Slider d'anys ─────────────────────────────
  function _initYearSlider() {
    const anys = [...new Set(_allPhotos.map(p => parseInt(p.any)).filter(a => !isNaN(a)))].sort();
    if (anys.length === 0) {
      _filters.yearMin = null;
      _filters.yearMax = null;
      return;
    }
    const min = anys[0];
    const max = anys[anys.length - 1];
    const minSlider = document.getElementById('year-min');
    const maxSlider = document.getElementById('year-max');

    minSlider.min = min; minSlider.max = max; minSlider.value = min;
    maxSlider.min = min; maxSlider.max = max; maxSlider.value = max;

    _filters.yearMin = min;
    _filters.yearMax = max;
    _updateYearDisplay();

    minSlider.oninput = () => {
      let v = parseInt(minSlider.value);
      if (v > parseInt(maxSlider.value)) v = parseInt(maxSlider.value);
      minSlider.value = v;
      _filters.yearMin = v;
      _updateYearDisplay();
      apply();
    };
    maxSlider.oninput = () => {
      let v = parseInt(maxSlider.value);
      if (v < parseInt(minSlider.value)) v = parseInt(minSlider.value);
      maxSlider.value = v;
      _filters.yearMax = v;
      _updateYearDisplay();
      apply();
    };
  }

  function _updateYearDisplay() {
    const label = document.getElementById('year-slider-values');
    const track = document.getElementById('year-slider-track-active');
    if (!label || _filters.yearMin === null) return;
    if (_filters.yearMin === _filters.yearMax) label.textContent = `${_filters.yearMin}`;
    else label.textContent = `${_filters.yearMin} – ${_filters.yearMax}`;

    const min = parseInt(document.getElementById('year-min').min);
    const max = parseInt(document.getElementById('year-min').max);
    const range = max - min || 1;
    const leftPct  = ((_filters.yearMin - min) / range) * 100;
    const rightPct = ((_filters.yearMax - min) / range) * 100;
    track.style.left  = leftPct + '%';
    track.style.width = (rightPct - leftPct) + '%';
  }

  // ── Cerca amb autocomplete ───────────────────
  function _initSearch() {
    const input    = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    const sugDiv   = document.getElementById('search-suggestions');

    input.addEventListener('input', () => {
      const val = input.value.trim();
      clearBtn.classList.toggle('active', val.length > 0);
      _filters.text = val;
      apply();
      if (val.length >= 1) _showSuggestions(val);
      else sugDiv.classList.add('hidden');
    });

    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 1) _showSuggestions(input.value.trim());
    });

    input.addEventListener('blur', () => {
      setTimeout(() => sugDiv.classList.add('hidden'), 200);
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      _filters.text = '';
      clearBtn.classList.remove('active');
      sugDiv.classList.add('hidden');
      apply();
    });
  }

  function _showSuggestions(query) {
    const q = query.toLowerCase();
    const sugDiv = document.getElementById('search-suggestions');

    // Recopilar tots els tags úniques
    const persones  = [...new Set(_allPhotos.flatMap(p => p.persones))].filter(Boolean);
    const llocs     = [...new Set(_allPhotos.map(p => p.lloc).filter(Boolean))];
    const cats      = [...new Set(_allPhotos.flatMap(p => p.categoria))].filter(Boolean);

    const matches = [];
    persones.forEach(p => { if (p.toLowerCase().includes(q)) matches.push({ value: p, type: 'persona', icon: '👤' }); });
    llocs.forEach(l    => { if (l.toLowerCase().includes(q)) matches.push({ value: l, type: 'lloc',    icon: '📍' }); });
    cats.forEach(c     => { if (c.toLowerCase().includes(q)) matches.push({ value: c, type: 'categoria', icon: '🏷️' }); });

    if (matches.length === 0) { sugDiv.classList.add('hidden'); return; }

    sugDiv.innerHTML = '';
    matches.slice(0, 10).forEach(m => {
      const div = document.createElement('div');
      div.className = 'search-suggestion';
      div.innerHTML = `<span>${m.icon}</span><span style="flex:1">${m.value}</span><span class="search-suggestion-type">${m.type}</span>`;
      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
        addFilter(m.type, m.value);
        document.getElementById('search-input').value = '';
        document.getElementById('search-clear').classList.remove('active');
        _filters.text = '';
        sugDiv.classList.add('hidden');
        apply();
      });
      sugDiv.appendChild(div);
    });
    sugDiv.classList.remove('hidden');
  }

  // ── Filtres actius (pills) ───────────────────
  function addFilter(type, value) {
    _filters[type] = value;
  }

  function removeFilter(type) {
    _filters[type] = null;
    apply();
  }

  function _renderActiveFilters() {
    const container = document.getElementById('active-filters');
    container.innerHTML = '';
    const types = [
      { key: 'persona',   label: '👤' },
      { key: 'lloc',      label: '📍' },
      { key: 'categoria', label: '🏷️' },
    ];
    let hasAny = false;
    types.forEach(({ key, label }) => {
      if (_filters[key]) {
        hasAny = true;
        const pill = document.createElement('button');
        pill.className = 'filter-pill active';
        pill.innerHTML = `<span>${label}</span> <span>${_filters[key]}</span> <span class="filter-pill-x">✕</span>`;
        pill.addEventListener('click', () => removeFilter(key));
        container.appendChild(pill);
      }
    });
    container.style.display = hasAny ? 'flex' : 'none';
  }

  // ── Apply filters ─────────────────────────────
  function apply() {
    _filteredPhotos = _allPhotos.filter(p => {
      if (_filters.persona   && !p.persones.includes(_filters.persona))   return false;
      if (_filters.lloc      && p.lloc !== _filters.lloc)                return false;
      if (_filters.categoria && !p.categoria.includes(_filters.categoria)) return false;
      if (_filters.yearMin !== null && _filters.yearMax !== null) {
        const any = parseInt(p.any);
        if (!isNaN(any)) {
          if (any < _filters.yearMin || any > _filters.yearMax) return false;
        }
      }
      if (_filters.text) {
        const t = _filters.text.toLowerCase();
        const searchable = [p.any, p.lloc, p.notes, ...p.persones, ...p.categoria].join(' ').toLowerCase();
        if (!searchable.includes(t)) return false;
      }
      return true;
    });

    _renderActiveFilters();
    _renderGallery();
    _renderPreferides();
    if (typeof MapView !== 'undefined') MapView.updatePhotos(_filteredPhotos);
  }

  // ── Render galeria ───────────────────────────
  function _renderGallery() {
    const grid  = document.getElementById('gallery-grid');
    const count = document.getElementById('gallery-count');
    const empty = document.getElementById('gallery-empty');

    grid.innerHTML = '';
    count.textContent = `${_filteredPhotos.length} foto${_filteredPhotos.length !== 1 ? 's' : ''}`;

    if (_filteredPhotos.length === 0) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    // Ordre: primer preferides, després per any descendent
    const ordered = [..._filteredPhotos].sort((a, b) => {
      if (a.preferida && !b.preferida) return -1;
      if (!a.preferida && b.preferida) return 1;
      return parseInt(b.any || 0) - parseInt(a.any || 0);
    });

    ordered.forEach(photo => {
      const isVideo = photo.tipus === 'video';
      const div = document.createElement('div');
      div.className = 'gallery-item';
      div.innerHTML = `
        ${isVideo ? `<div class="gallery-video-thumb">🎬</div>` : `<img src="${photo.url}" alt="${photo.lloc}" loading="lazy" />`}
        ${photo.preferida ? '<div class="gallery-item-preferida">⭐</div>' : ''}
        ${isVideo ? '<div class="gallery-item-video-badge">🎬 VÍDEO</div>' : ''}
        <div class="gallery-overlay">
          <div class="gallery-overlay-any">${photo.any || ''}</div>
          <div class="gallery-overlay-lloc">${photo.lloc || (isVideo ? 'Vídeo de felicitació' : '')}</div>
        </div>
      `;
      div.addEventListener('click', () => openLightbox(photo));
      grid.appendChild(div);
    });
  }

  // ── Render preferides ────────────────────────
  function _renderPreferides() {
    const section = document.getElementById('preferides-section');
    const scroll  = document.getElementById('preferides-scroll');
    const prefs   = _filteredPhotos.filter(p => p.preferida && p.tipus !== 'video');

    if (prefs.length === 0) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');

    scroll.innerHTML = '';
    prefs.forEach(photo => {
      const card = document.createElement('div');
      card.className = 'preferida-card';
      card.innerHTML = `
        <img src="${photo.url}" alt="${photo.lloc}" loading="lazy" />
        <div class="preferida-card-badge">⭐</div>
      `;
      card.addEventListener('click', () => openLightbox(photo));
      scroll.appendChild(card);
    });
  }

  // ── Lightbox ─────────────────────────────────
  function _initLightbox() {
    document.getElementById('lightbox-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('lightbox-overlay')) closeLightbox();
    });
    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    document.getElementById('lightbox-prev').addEventListener('click', _prevPhoto);
    document.getElementById('lightbox-next').addEventListener('click', _nextPhoto);

    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('lightbox-overlay').classList.contains('hidden')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') _prevPhoto();
        if (e.key === 'ArrowRight') _nextPhoto();
      }
    });
  }

  function openLightbox(photo) {
    _lightboxPhoto = photo;
    const isVideo = photo.tipus === 'video';

    const img = document.getElementById('lightbox-img');
    const vid = document.getElementById('lightbox-video-thumb');
    if (isVideo) {
      img.style.display = 'none';
      vid.classList.remove('hidden');
      document.getElementById('lightbox-video-link').href = `https://drive.google.com/file/d/${photo.fileId}/view`;
    } else {
      img.style.display = '';
      img.src = photo.url;
      vid.classList.add('hidden');
    }

    document.getElementById('lightbox-any').textContent  = photo.any || '';
    document.getElementById('lightbox-lloc').textContent = photo.lloc || (isVideo ? 'Vídeo de felicitació' : '');
    document.getElementById('lightbox-persones').textContent = photo.persones.join(' · ');
    document.getElementById('lightbox-cats').innerHTML = photo.categoria.map(c => `<span class="otag">${c}</span>`).join('');
    document.getElementById('lightbox-notes').textContent = photo.notes || '';
    document.getElementById('lightbox-notes').style.display = photo.notes ? 'block' : 'none';
    document.getElementById('lightbox-pujat').textContent = photo.pujatNom ? `Pujat per ${photo.pujatNom}` : '';
    document.getElementById('lightbox-preferida').classList.toggle('hidden', !photo.preferida);

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
  function getAllPhotos()    { return _allPhotos; }
  function getFiltered()     { return _filteredPhotos; }

  return { init, updatePhotos, apply, addFilter, removeFilter, openLightbox, closeLightbox, getCurrentPhoto, getAllPhotos, getFiltered };
})();
