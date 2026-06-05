// ============================================
// ANNA40 — GALLERY v4
// Gallery — fotos i navegació
// ============================================

const Gallery = (() => {
  let _allPhotos      = [];
  let _filteredPhotos = [];
  let _lightboxPhoto  = null;

  let _filters = {
    persona:   [],   // multi-select
    categoria: [],   // multi-select
    lloc:      '',   // single
    qui:       '',   // single
    yearMin:   null,
    yearMax:   null,
  };

  function init(photos) {
    _allPhotos = photos;
    _initYearSlider();
    _populateFilters();
    _bindFilterEvents();
    _initLightbox();
    apply();
  }

  function updatePhotos(photos) {
    _allPhotos = photos;
    _initYearSlider();
    _populateFilters();
    apply();
  }

  const MULTI_KEYS   = new Set(['persona', 'categoria']);
  const SINGLE_KEYS  = new Set(['lloc', 'qui']);

  function _populateFilters() {
    const persones = [...new Set(_allPhotos.flatMap(p => p.persones))].filter(Boolean).sort();
    const llocs    = [...new Set(_allPhotos.map(p => p.lloc).filter(Boolean))].sort();
    const cats     = [...new Set(_allPhotos.flatMap(p => p.categoria))].filter(Boolean).sort();
    const autors   = [...new Set(_allPhotos.map(p => p.pujatNom).filter(Boolean))].sort();

    _renderDrawerOpts('persona',   persones);
    _renderDrawerOpts('lloc',      llocs);
    _renderDrawerOpts('categoria', cats);
    _renderDrawerOpts('qui',       autors);
    _updateFilterLabels();
  }

  function _isSelected(key, item) {
    return MULTI_KEYS.has(key) ? _filters[key].includes(item) : _filters[key] === item;
  }

  function _toggleFilter(key, item) {
    if (MULTI_KEYS.has(key)) {
      const arr = _filters[key];
      const idx = arr.indexOf(item);
      if (idx === -1) arr.push(item); else arr.splice(idx, 1);
    } else {
      _filters[key] = (_filters[key] === item) ? '' : item;
      if (SINGLE_KEYS.has(key)) _closeDrawer();
    }
    _populateFilters();
    apply();
  }

  function _renderDrawerOpts(key, items, searchVal) {
    const container = document.getElementById(`filter-${key}-opts`);
    if (!container) return;
    const query = (searchVal || document.getElementById(`filter-${key}-search`)?.value || '').toLowerCase();
    const filtered = items.filter(i => !query || i.toLowerCase().includes(query));
    container.innerHTML = '';

    // Botó "Tots/Netejar"
    const isEmpty = MULTI_KEYS.has(key) ? _filters[key].length === 0 : !_filters[key];
    const allBtn = document.createElement('button');
    allBtn.className = 'drawer-opt' + (isEmpty ? ' selected' : '');
    allBtn.textContent = 'Tots';
    allBtn.onclick = () => {
      if (MULTI_KEYS.has(key)) _filters[key] = []; else _filters[key] = '';
      _populateFilters(); apply();
    };
    container.appendChild(allBtn);

    filtered.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'drawer-opt' + (_isSelected(key, item) ? ' selected' : '');
      btn.textContent = item;
      btn.onclick = () => _toggleFilter(key, item);
      container.appendChild(btn);
    });
  }

  function _updateFilterLabels() {
    const defaults = { persona: 'Persona', lloc: 'Lloc', categoria: 'Categoria', qui: 'Qui' };
    Object.keys(defaults).forEach(key => {
      const lbl = document.getElementById(`flabel-${key}`);
      const btn = lbl?.closest('.filter-icon-btn');
      if (!lbl) return;

      let txt, active;
      if (MULTI_KEYS.has(key)) {
        const arr = _filters[key];
        active = arr.length > 0;
        txt = arr.length === 0 ? defaults[key]
            : arr.length === 1 ? arr[0]
            : `${arr[0]} +${arr.length - 1}`;
      } else {
        active = !!_filters[key];
        txt = _filters[key] || defaults[key];
      }
      lbl.textContent = txt;
      btn?.classList.toggle('active', active);
      const chevron = btn?.querySelector('.chevron');
      if (chevron) chevron.style.transform = active ? 'rotate(180deg)' : '';
    });
  }

  let _activeDrawerFilter = null;

  function _closeDrawer() {
    _activeDrawerFilter = null;
    const drawer = document.getElementById('filter-drawer');
    if (drawer) drawer.classList.add('hidden');
    drawer?.querySelectorAll('.filter-drawer-section').forEach(s => s.classList.remove('visible'));
  }

  function _bindFilterEvents() {
    document.querySelectorAll('.filter-pill[data-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.filter;
        const drawer = document.getElementById('filter-drawer');
        const allSections = drawer?.querySelectorAll('.filter-drawer-section');
        if (_activeDrawerFilter === key) { _closeDrawer(); return; }
        _activeDrawerFilter = key;
        drawer.classList.remove('hidden');
        allSections?.forEach((s, i) => {
          const keys = ['persona','lloc','categoria','qui','year'];
          s.classList.toggle('visible', keys[i] === key);
        });
        document.getElementById(`filter-${key}-search`)?.focus();
      });
    });

    // Cerca en temps real
    const allItemsFn = {
      persona:   () => [...new Set(_allPhotos.flatMap(p => p.persones))].filter(Boolean).sort(),
      lloc:      () => [...new Set(_allPhotos.map(p => p.lloc).filter(Boolean))].sort(),
      categoria: () => [...new Set(_allPhotos.flatMap(p => p.categoria))].filter(Boolean).sort(),
      qui:       () => [...new Set(_allPhotos.map(p => p.pujatNom).filter(Boolean))].sort(),
    };
    ['persona','lloc','categoria','qui'].forEach(key => {
      const s = document.getElementById(`filter-${key}-search`);
      s?.addEventListener('input', () => _renderDrawerOpts(key, allItemsFn[key](), s.value));
    });

    // Reset total
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
      _filters.persona   = [];
      _filters.categoria = [];
      _filters.lloc      = '';
      _filters.qui       = '';
      ['persona','lloc','categoria','qui'].forEach(k => {
        const s = document.getElementById(`filter-${k}-search`); if (s) s.value = '';
      });
      _closeDrawer();
      _initYearSlider();
      _populateFilters();
      apply();
    });

    // Tancar persiana clicant fora (bubble, no capture)
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#filter-drawer') && !e.target.closest('.filter-pill[data-filter]')) {
        _closeDrawer();
      }
    });
  }

  // ── Slider d'anys ─────────────────────────────
  function _initYearSlider() {
    const anys = [...new Set(_allPhotos.map(p => parseInt(p.any)).filter(a => !isNaN(a)))].sort();
    if (anys.length === 0) {
      _filters.yearMin = null;
      _filters.yearMax = null;
      const lbl = document.getElementById('year-slider-values');
      if (lbl) lbl.textContent = '—';
      return;
    }
    const min = anys[0];
    const max = anys[anys.length - 1];
    const minSlider = document.getElementById('year-min');
    const maxSlider = document.getElementById('year-max');
    if (!minSlider || !maxSlider) return;

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
    const label  = document.getElementById('year-slider-values');
    const label2 = document.getElementById('year-range-label');
    const track  = document.getElementById('year-slider-track-active');
    const txt    = _filters.yearMin === null ? '—' :
                   _filters.yearMin === _filters.yearMax ? `${_filters.yearMin}` :
                   `${_filters.yearMin} – ${_filters.yearMax}`;
    if (label)  label.textContent  = txt;
    if (label2) label2.textContent = txt;

    const min = parseInt(document.getElementById('year-min').min);
    const max = parseInt(document.getElementById('year-min').max);
    const range = max - min || 1;
    const leftPct  = ((_filters.yearMin - min) / range) * 100;
    const rightPct = ((_filters.yearMax - min) / range) * 100;
    if (track) {
      track.style.left  = leftPct + '%';
      track.style.width = (rightPct - leftPct) + '%';
    }
  }


  // ── Apply filters ─────────────────────────────
  function apply() {
    _filteredPhotos = _allPhotos.filter(p => {
      if (_filters.persona.length   && !_filters.persona.every(f => p.persones.includes(f)))   return false;
      if (_filters.categoria.length && !_filters.categoria.some(f => p.categoria.includes(f))) return false;
      if (_filters.lloc  && p.lloc !== _filters.lloc)      return false;
      if (_filters.qui   && p.pujatNom !== _filters.qui)   return false;
      if (_filters.yearMin !== null && _filters.yearMax !== null) {
        const any = parseInt(p.any);
        if (!isNaN(any) && (any < _filters.yearMin || any > _filters.yearMax)) return false;
      }
      return true;
    });

    _renderGallery();
    _renderCarousels();
    _renderPreferides();
    if (typeof MapView !== 'undefined') MapView.updatePhotos(_filteredPhotos);
  }

  // ── Ordre ─────────────────────────────────────
  let _sortMode = 'year-asc';

  function _sortPhotos(arr) {
    return [...arr].sort((a, b) => {
      switch (_sortMode) {
        case 'year-asc':   return (parseInt(a.any) || 9999) - (parseInt(b.any) || 9999);
        case 'year-desc':  return (parseInt(b.any) || 0)    - (parseInt(a.any) || 0);
        case 'alpha-asc':  return (a.lloc || '').localeCompare(b.lloc || '', 'ca');
        case 'alpha-desc': return (b.lloc || '').localeCompare(a.lloc || '', 'ca');
        default:           return 0;
      }
    });
  }

  // ── Vista (graella / carrussel) ──────────────
  let _viewMode = 'grid';

  function setView(mode) {
    _viewMode = mode;
    document.getElementById('view-grid')?.classList.toggle('active', mode === 'grid');
    document.getElementById('view-carousel')?.classList.toggle('active', mode === 'carousel');
    document.getElementById('view-grid-container')?.classList.toggle('hidden', mode !== 'grid');
    document.getElementById('view-carousel-container')?.classList.toggle('hidden', mode !== 'carousel');
    if (mode === 'carousel') _renderCarousels();
  }

  // ── Carrussels per categoria ─────────────────
  function _renderCarousels() {
    const wrap = document.getElementById('carousels-wrap');
    if (!wrap) return;
    if (_viewMode !== 'carousel') return;

    wrap.innerHTML = '';

    // Només fotos (no vídeos)
    const fotos = _filteredPhotos.filter(p => p.tipus !== 'video');

    // Agrupar per categoria
    const byCat = {};
    fotos.forEach(p => {
      const cats = p.categoria.length ? p.categoria : ['Sense categoria'];
      cats.forEach(cat => {
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push(p);
      });
    });

    const cats = Object.keys(byCat).sort();
    if (cats.length === 0) {
      wrap.innerHTML = '<div class="gallery-empty">Cap foto per mostrar.</div>';
      return;
    }

    cats.forEach(cat => {
      const section = document.createElement('div');
      section.className = 'carousel-section';
      section.innerHTML = `
        <div class="carousel-cat-title">${cat} <span class="carousel-cat-count">${byCat[cat].length}</span></div>
        <div class="carousel-scroll"></div>
      `;
      const scroll = section.querySelector('.carousel-scroll');
      byCat[cat].forEach(photo => {
        const card = document.createElement('div');
        card.className = 'carousel-card';
        card.innerHTML = `
          <img src="${photo.url}" alt="${photo.lloc}" loading="lazy" />
          ${photo.preferida ? '<div class="carousel-card-star">⭐</div>' : ''}
          <div class="carousel-card-cap">
            <div class="carousel-card-lloc">${photo.lloc || ''}</div>
            <div class="carousel-card-any">${photo.any || ''}</div>
          </div>
        `;
        card.addEventListener('click', () => openLightbox(photo));
        scroll.appendChild(card);
      });
      wrap.appendChild(section);
    });
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

    const all = _sortPhotos(_filteredPhotos.filter(p => p.tipus !== 'video'));

    all.forEach(photo => {
      const isVideo = photo.tipus === 'video';
      const fid = photo.fileId;
      const card = document.createElement('div');
      card.className = 'gallery-card' + (isVideo ? ' gallery-card-video' : '');
      const thumb = isVideo
        ? `<div class="gallery-card-thumb gallery-card-vid">🎬</div>`
        : `<img class="gallery-card-thumb" src="${photo.url}" alt="${photo.lloc}" loading="lazy" />`;
      card.innerHTML = `
        <div class="gallery-card-imgwrap">
          ${thumb}
          ${photo.preferida ? '<div class="gallery-card-star">⭐</div>' : ''}
        </div>
        <div class="gallery-card-info">
          <div class="gallery-card-lloc">${photo.lloc || '—'}</div>
          <div class="gallery-card-meta">${photo.any || ''}${photo.persones.length ? ' · ' + photo.persones.slice(0,2).join(', ') : ''}</div>
          ${photo.categoria.length ? `<div class="gallery-card-cat">${photo.categoria[0]}</div>` : ''}
        </div>
      `;
      card.addEventListener('click', () => openLightbox(photo));
      grid.appendChild(card);
    });
  }

  function _renderPreferides() {
    const section = document.getElementById('preferides-section');
    const scroll  = document.getElementById('preferides-scroll');
    const prefs = [..._filteredPhotos.filter(p => p.preferida && p.tipus !== 'video')]
      .sort((a, b) => (parseInt(a.any) || 9999) - (parseInt(b.any) || 9999));

    if (prefs.length === 0) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');

    scroll.innerHTML = '';
    _highlightedPhotos = prefs;
    prefs.forEach(photo => {
      const card = document.createElement('div');
      card.className = 'preferida-card';
      card.innerHTML = `
        <img src="${photo.url}" alt="${photo.lloc}" loading="lazy" />
        <div class="preferida-card-badge">⭐</div>
      `;
      card.addEventListener('click', () => openLightbox(photo, 'highlights'));
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

    // Swipe al lightbox — bloquejar navegació del browser i distingir pinch de swipe
    // IMPORTANT: no bloquejar taps sobre botons (✕, ✏️, ‹, ›)
    let _lbStartX = 0, _lbStartY = 0, _lbIsPinch = false, _lbOnButton = false;
    const lbOverlay = document.getElementById('lightbox-overlay');

    lbOverlay?.addEventListener('touchstart', e => {
      _lbIsPinch  = e.touches.length > 1;
      _lbOnButton = !!e.target.closest('button, a');
      if (!_lbIsPinch) {
        _lbStartX = e.touches[0].clientX;
        _lbStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    lbOverlay?.addEventListener('touchmove', e => {
      if (_lbIsPinch || _lbOnButton) return; // no interferir amb botons ni pinch
      const dx = e.touches[0].clientX - _lbStartX;
      const dy = e.touches[0].clientY - _lbStartY;
      if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();
    }, { passive: false });

    lbOverlay?.addEventListener('touchend', e => {
      if (_lbIsPinch || _lbOnButton || e.changedTouches.length > 1) return;
      const dx = e.changedTouches[0].clientX - _lbStartX;
      const dy = e.changedTouches[0].clientY - _lbStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 2) {
        if (dx < 0) _nextPhoto();
        else         _prevPhoto();
      }
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('lightbox-overlay').classList.contains('hidden')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') _prevPhoto();
        if (e.key === 'ArrowRight') _nextPhoto();
      }
    });
  }

  // Context del lightbox: llista de fotos per navegar
  let _lightboxContext = 'all';
  let _highlightedPhotos = [];

  function _getContextPhotos() {
    return _lightboxContext === 'highlights' ? _highlightedPhotos : _filteredPhotos;
  }

  function openLightbox(photo, context) {
    _lightboxPhoto   = photo;
    _lightboxContext = context || 'all';
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
    const list = _getContextPhotos();
    const idx  = list.findIndex(p => p.fileId === _lightboxPhoto?.fileId);
    if (idx > 0) openLightbox(list[idx - 1], _lightboxContext);
  }

  function _nextPhoto() {
    const list = _getContextPhotos();
    const idx  = list.findIndex(p => p.fileId === _lightboxPhoto?.fileId);
    if (idx < list.length - 1) openLightbox(list[idx + 1], _lightboxContext);
  }

  return { init, updatePhotos, apply, openLightbox, closeLightbox, setView, setSort: (mode) => { _sortMode = mode; apply(); }, getFiltered: () => _filteredPhotos, getAllPhotos: () => _allPhotos, getCurrentLightboxPhoto: () => _lightboxPhoto };
})();
