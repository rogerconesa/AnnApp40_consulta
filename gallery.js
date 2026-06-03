// ============================================
// ANNA40 — GALLERY v4
// Selectors clàssics + xat IA Gemini
// ============================================

const Gallery = (() => {
  let _allPhotos      = [];
  let _filteredPhotos = [];
  let _lightboxPhoto  = null;
  let _iaFilteredIds  = null; // ids filtrats per la IA

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
    _bindIA();
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
    document.querySelectorAll('.filter-icon-btn').forEach(btn => {
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
      _resetIA();
      _initYearSlider();
      _populateFilters();
      apply();
    });

    // Tancar persiana clicant fora
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.filters-bar')) _closeDrawer();
    }, true);
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

  // ── Xat IA Gemini ─────────────────────────────
  function _bindIA() {
    const input = document.getElementById('ia-input');
    const send  = document.getElementById('ia-send');
    const clear = document.getElementById('ia-clear');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); _handleIA(); }
    });
    send.addEventListener('click', _handleIA);
    clear.addEventListener('click', _resetIA);
  }

  async function _handleIA() {
    const input = document.getElementById('ia-input');
    const query = input.value.trim();
    if (!query) return;

    _setIAStatus('loading', 'Buscant entre les fotos...');
    document.getElementById('ia-send').disabled = true;
    document.getElementById('ia-clear').classList.remove('hidden');

    try {
      const ids = await _queryGemini(query);
      _iaFilteredIds = ids;
      apply();
      const count = _filteredPhotos.length;
      if (count > 0) {
        _setIAResponse(`✨ He trobat ${count} foto${count !== 1 ? 's' : ''} relacionades amb la teva cerca.`);
      } else {
        // Gemini no ha trobat res → provar cerca per text
        _fallbackTextSearch(query);
      }
    } catch(err) {
      console.warn('Cerca IA no disponible, usant cerca per text:', err);
      _fallbackTextSearch(query);
    } finally {
      document.getElementById('ia-send').disabled = false;
      _setIAStatus('', '');
    }
  }

  function _fallbackTextSearch(query) {
    const results = _simpleTextSearch(query);
    _iaFilteredIds = results.map(p => p.fileId);
    apply();
    const count = results.length;
    if (count > 0) {
      _setIAResponse(`🔎 He trobat ${count} foto${count !== 1 ? 's' : ''} que coincideixen amb "${query}".`);
    } else {
      _iaFilteredIds = null;
      apply();
      _setIAResponse(`No he trobat fotos amb "${query}". Prova amb els filtres de dalt (persona, lloc, categoria) per afinar la cerca.`);
    }
  }

  function _simpleTextSearch(query) {
    // Paraules buides a ignorar
    const stop = new Set(['busca','buscar','fotos','foto','video','videos','vídeo','vídeos',
      'de','del','la','el','les','els','amb','en','a','i','o','un','una','que','on','quan',
      'mostra','ensenya','vull','veure','totes','tots','les','algun','alguna']);

    const words = query.toLowerCase()
      .replace(/[?¿!¡.,;:]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stop.has(w));

    if (words.length === 0) return [];

    return _allPhotos.filter(p => {
      const searchable = [p.any, p.lloc, p.notes, ...p.persones, ...p.categoria, p.pujatNom]
        .join(' ').toLowerCase();
      // Coincideix si TOTES les paraules clau hi són (o almenys una si només n'hi ha una)
      return words.some(w => searchable.includes(w));
    });
  }

  async function _queryGemini(query) {
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

    const ctx = _allPhotos.map((p, i) =>
      `[${i}|${p.fileId}] Tipus:${p.tipus} Any:${p.any} Lloc:${p.lloc} Persones:${p.persones.join(',')} Cat:${p.categoria.join(',')} Notes:${p.notes} Preferida:${p.preferida}`
    ).join('\n');

    const prompt = `Ets un assistent que ajuda a trobar fotos i vídeos d'un grup d'amics. Tens accés a ${_allPhotos.length} elements amb metadades.

ELEMENTS:
${ctx}

Consulta de l'usuari: "${query}"

Identifica TOTS els fileId que coincideixen amb la consulta. Respon NOMÉS amb el JSON, sense cap text addicional:
{"ids": ["fileId1", "fileId2", ...]}

Si no en trobes: {"ids": []}`;

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
      })
    });

    if (!res.ok) throw new Error('Gemini error ' + res.status);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const match = text.match(/\{[\s\S]*?"ids"\s*:\s*\[([\s\S]*?)\]\}/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]);
      return parsed.ids || [];
    } catch(e) {
      return [];
    }
  }

  function _setIAStatus(type, text) {
    const status = document.getElementById('ia-status');
    if (!text) { status.classList.add('hidden'); return; }
    status.classList.remove('hidden');
    if (type === 'loading') {
      status.innerHTML = `<span class="ia-loading-dot"></span><span class="ia-loading-dot"></span><span class="ia-loading-dot"></span> ${text}`;
    } else {
      status.textContent = text;
    }
  }

  function _setIAResponse(text) {
    const resp = document.getElementById('ia-response');
    if (!text) { resp.classList.add('hidden'); return; }
    resp.classList.remove('hidden');
    resp.textContent = text;
  }

  function _resetIA() {
    _iaFilteredIds = null;
    document.getElementById('ia-input').value = '';
    document.getElementById('ia-clear').classList.add('hidden');
    _setIAStatus('', '');
    _setIAResponse('');
    apply();
  }

  // ── Apply filters ─────────────────────────────
  function apply() {
    _filteredPhotos = _allPhotos.filter(p => {
      if (_iaFilteredIds !== null && !_iaFilteredIds.includes(p.fileId)) return false;
      if (_filters.persona.length   && !_filters.persona.some(f => p.persones.includes(f)))    return false;
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

    const ordered = [..._filteredPhotos].sort((a, b) => {
      if (a.preferida && !b.preferida) return -1;
      if (!a.preferida && b.preferida) return 1;
      return parseInt(b.any || 0) - parseInt(a.any || 0);
    });

    ordered.forEach(photo => {
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
          ${isVideo ? '<div class="gallery-card-vidbadge">🎬 VÍDEO</div>' : ''}
        </div>
        <div class="gallery-card-info">
          <div class="gallery-card-lloc">${photo.lloc || (isVideo ? 'Vídeo de felicitació' : '—')}</div>
          <div class="gallery-card-meta">${photo.any || ''}${photo.persones.length ? ' · ' + photo.persones.slice(0,2).join(', ') : ''}</div>
        </div>
      `;
      card.addEventListener('click', () => openLightbox(photo));
      grid.appendChild(card);
    });
  }

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

  return { init, updatePhotos, apply, openLightbox, closeLightbox, setView, getFiltered: () => _filteredPhotos, getAllPhotos: () => _allPhotos, getCurrentLightboxPhoto: () => _lightboxPhoto };
})();
