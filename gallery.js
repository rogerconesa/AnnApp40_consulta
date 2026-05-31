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
    persona:   '',
    categoria: '',
    lloc:      '',
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

  // ── Populate filter selects ───────────────────
  function _populateFilters() {
    const persones = [...new Set(_allPhotos.flatMap(p => p.persones))].filter(Boolean).sort();
    const llocs    = [...new Set(_allPhotos.map(p => p.lloc).filter(Boolean))].sort();
    const cats     = [...new Set(_allPhotos.flatMap(p => p.categoria))].filter(Boolean).sort();

    _setOptions('filter-persona',   persones, '👤 Persona',    _filters.persona);
    _setOptions('filter-lloc',      llocs,    '📍 Lloc',       _filters.lloc);
    _setOptions('filter-categoria', cats,     '🏷️ Categoria', _filters.categoria);
  }

  function _setOptions(id, items, placeholder, current) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(it => {
      const opt = document.createElement('option');
      opt.value = it;
      opt.textContent = it;
      if (it === current) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function _bindFilterEvents() {
    document.getElementById('filter-persona')?.addEventListener('change', e => { _filters.persona = e.target.value; apply(); });
    document.getElementById('filter-lloc')?.addEventListener('change', e => { _filters.lloc = e.target.value; apply(); });
    document.getElementById('filter-categoria')?.addEventListener('change', e => { _filters.categoria = e.target.value; apply(); });
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
      _filters.persona   = '';
      _filters.lloc      = '';
      _filters.categoria = '';
      document.getElementById('filter-persona').value   = '';
      document.getElementById('filter-lloc').value      = '';
      document.getElementById('filter-categoria').value = '';
      _resetIA();
      _initYearSlider();
      apply();
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
    const label = document.getElementById('year-slider-values');
    const track = document.getElementById('year-slider-track-active');
    if (!label || _filters.yearMin === null) return;
    if (_filters.yearMin === _filters.yearMax) label.textContent = `${_filters.yearMin}`;
    else label.textContent = `${_filters.yearMin}–${_filters.yearMax}`;

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

    _setIAStatus('loading', 'La IA està buscant entre les fotos...');
    document.getElementById('ia-send').disabled = true;
    document.getElementById('ia-clear').classList.remove('hidden');

    try {
      const ids = await _queryGemini(query);
      _iaFilteredIds = ids;
      apply();
      const count = _filteredPhotos.length;
      _setIAResponse(`✨ He trobat ${count} foto${count !== 1 ? 's' : ''} relacionades amb la teva pregunta.`);
    } catch(err) {
      console.error(err);
      _setIAStatus('', '');
      _setIAResponse('No he pogut processar la cerca. Provo cerca per text...');
      _iaFilteredIds = _simpleTextSearch(query).map(p => p.fileId);
      apply();
    } finally {
      document.getElementById('ia-send').disabled = false;
      _setIAStatus('', '');
    }
  }

  function _simpleTextSearch(query) {
    const q = query.toLowerCase();
    return _allPhotos.filter(p => {
      const searchable = [p.any, p.lloc, p.notes, ...p.persones, ...p.categoria, p.pujatNom].join(' ').toLowerCase();
      return searchable.includes(q);
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
      if (_filters.persona   && !p.persones.includes(_filters.persona))    return false;
      if (_filters.lloc      && p.lloc !== _filters.lloc)                  return false;
      if (_filters.categoria && !p.categoria.includes(_filters.categoria)) return false;
      if (_filters.yearMin !== null && _filters.yearMax !== null) {
        const any = parseInt(p.any);
        if (!isNaN(any)) {
          if (any < _filters.yearMin || any > _filters.yearMax) return false;
        }
      }
      return true;
    });

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
          <div class="gallery-overlay-lloc">${photo.lloc || (isVideo ? 'Vídeo' : '')}</div>
        </div>
      `;
      div.addEventListener('click', () => openLightbox(photo));
      grid.appendChild(div);
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

  return { init, updatePhotos, apply, openLightbox, closeLightbox, getFiltered: () => _filteredPhotos, getAllPhotos: () => _allPhotos };
})();
