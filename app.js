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
        const isAdmin      = Auth.isAdmin();
        const isPassword   = Auth.isPasswordMode();
        UI.setUser(profile, isAdmin);
        UI.showScreen('screen-app');
        await loadPhotos();
        Gallery.init(_photos);
        if (!isPassword) initAdmin();
        initDia();

        // Botó editar: visible si NO és mode password
        const editBtn = document.getElementById('lightbox-edit');
        if (editBtn) {
          editBtn.style.display = isPassword ? 'none' : '';
          editBtn.title = isAdmin ? 'Editar foto (admin)' : 'Editar foto';
        }
      },
      () => UI.showScreen('screen-login')
    );

    document.getElementById('btn-google-login').addEventListener('click', () => Auth.login());
    document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());

    // Login per password
    const btnPwd = document.getElementById('btn-password-login');
    const inputPwd = document.getElementById('input-password');
    const pwdError = document.getElementById('password-error');
    const doPasswordLogin = () => {
      const ok = Auth.loginWithPassword(inputPwd?.value || '');
      if (!ok) {
        pwdError?.classList.remove('hidden');
        inputPwd?.focus();
        inputPwd?.select();
      } else {
        pwdError?.classList.add('hidden');
      }
    };
    btnPwd?.addEventListener('click', doPasswordLogin);
    inputPwd?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doPasswordLogin(); });

    // Nav tabs
    document.querySelectorAll('#bottom-nav .nav-tab').forEach(tab => {
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
        if (tab.dataset.tab === 'dia') {
          loadDia();
          startDiaAutoRefresh();
        } else {
          stopDiaAutoRefresh();
        }
      });
    });

    // View toggle (graella / carrussel)
    document.getElementById('view-grid')?.addEventListener('click', () => Gallery.setView('grid'));
    document.getElementById('view-carousel')?.addEventListener('click', () => Gallery.setView('carousel'));

    // ── Scroll-hide bottom nav (estil app nativa) ──
    let _lastScrollY = 0;
    const bottomNav  = document.getElementById('bottom-nav');
    const filterBar  = document.querySelector('.filters-bar');
    window.addEventListener('scroll', () => {
      const cur = window.scrollY;
      if (cur > _lastScrollY + 8) {
        bottomNav?.classList.add('hidden-nav');
        filterBar?.classList.add('hidden-nav');
      } else if (cur < _lastScrollY - 8) {
        bottomNav?.classList.remove('hidden-nav');
        filterBar?.classList.remove('hidden-nav');
      }
      _lastScrollY = cur;
    }, { passive: true });

    // ── Token refresh automàtic per 401 ──────────
    async function _apiWithRetry(fn) {
      try { return await fn(); }
      catch(err) {
        if (err?.message?.includes('401') && Auth.refreshToken) {
          try { await Auth.refreshToken(); return await fn(); }
          catch(e) { throw err; }
        }
        throw err;
      }
    }

    // ── Autoplay de fotos ────────────────────────
    let _autoplayTimer   = null;
    let _autoplayPhotos  = [];
    let _autoplayIdx     = 0;
    const AUTOPLAY_DELAY = 3500;

    function startAutoplay(photos) {
      stopAutoplay();
      if (!photos || photos.length === 0) return;
      _autoplayPhotos = [...photos].sort(() => Math.random() - 0.5);
      _autoplayIdx    = 0;
      Gallery.openLightbox(_autoplayPhotos[0]);
      _autoplayTimer  = setInterval(() => {
        _autoplayIdx = (_autoplayIdx + 1) % _autoplayPhotos.length;
        Gallery.openLightbox(_autoplayPhotos[_autoplayIdx]);
      }, AUTOPLAY_DELAY);
    }
    function stopAutoplay() {
      if (_autoplayTimer) { clearInterval(_autoplayTimer); _autoplayTimer = null; }
    }
    document.getElementById('lightbox-close')?.addEventListener('click', stopAutoplay);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') stopAutoplay(); });
    document.getElementById('btn-autoplay')?.addEventListener('click', () => {
      startAutoplay(Gallery.getFiltered ? Gallery.getFiltered() : []);
    });

    // ── Botó regal ────────────────────────────────
    const regalBtn     = document.getElementById('btn-regal');
    const regalOverlay = document.getElementById('regal-overlay');
    const regalClose   = document.getElementById('regal-close');

    regalBtn?.addEventListener('click', () => {
      regalBtn.classList.add('open');
      // Reset a fase 1 cada cop que s'obre
      document.getElementById('regal-surprise')?.classList.add('hidden');
      document.getElementById('regal-reveal-btn-wrap')?.classList.remove('hidden');
      regalOverlay?.classList.remove('hidden');
    });

    // Revelació fase 2
    document.getElementById('regal-reveal-btn')?.addEventListener('click', () => {
      document.getElementById('regal-reveal-btn-wrap')?.classList.add('hidden');
      document.getElementById('regal-surprise')?.classList.remove('hidden');
    });
    const closeRegal = () => {
      regalOverlay?.classList.add('hidden');
      setTimeout(() => regalBtn?.classList.remove('open'), 600); // reprèn animació
    };
    regalClose?.addEventListener('click', closeRegal);
    regalOverlay?.addEventListener('click', (e) => { if (e.target === regalOverlay) closeRegal(); });

    // Botó sort al costat d'autoplay (mòbil) — eliminat, sort és al costat del slider

    // Detectar scroll final de la fila de filtres (treure degradat)
    const filterRow = document.querySelector('.filters-row-main');
    if (filterRow) {
      const checkScroll = () => {
        const atEnd = filterRow.scrollLeft + filterRow.clientWidth >= filterRow.scrollWidth - 8;
        filterRow.classList.toggle('at-end', atEnd);
      };
      filterRow.addEventListener('scroll', checkScroll, { passive: true });
      setTimeout(checkScroll, 300);
    }
    const sortModes = [
      { key: 'year-asc',  label: 'Any ↑' },
      { key: 'year-desc', label: 'Any ↓' },
      { key: 'alpha-asc', label: 'A → Z' },
      { key: 'alpha-desc',label: 'Z → A' },
    ];
    let _sortIdx = 0;
    const sortBtn   = document.getElementById('btn-sort');
    const sortLabel = document.getElementById('sort-label');
    if (sortBtn) {
      if (sortLabel) sortLabel.textContent = sortModes[0].label;
      sortBtn.addEventListener('click', () => {
        _sortIdx = (_sortIdx + 1) % sortModes.length;
        if (sortLabel) sortLabel.textContent = sortModes[_sortIdx].label;
        sortBtn.classList.toggle('active', _sortIdx > 0);
        Gallery.setSort(sortModes[_sortIdx].key);
      });
    }

    // Toggle tema clar/fosc — light per defecte
    // Esborrem valor antic de localStorage si era dark (tema anterior per defecte)
    const savedTheme = localStorage.getItem('anna40_theme');
    const theme = savedTheme || 'light';
    document.documentElement.dataset.theme = theme;
    _updateThemeIcon(theme);

    document.getElementById('btn-theme')?.addEventListener('click', () => {
      const isDark = document.documentElement.dataset.theme === 'dark';
      const next   = isDark ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('anna40_theme', next);
      _updateThemeIcon(next);
    });

    function _updateThemeIcon(theme) {
      document.getElementById('theme-icon-sun')?.classList.toggle('hidden', theme === 'light');
      document.getElementById('theme-icon-moon')?.classList.toggle('hidden', theme === 'dark');
    }

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

  let _videosAll  = [];
  let _videosList = [];

  function renderVideos() {
    const grid  = document.getElementById('videos-grid');
    const empty = document.getElementById('videos-empty');
    const count = document.getElementById('videos-count');
    if (!grid) return;

    _videosAll = _photos.filter(p => p.tipus === 'video');

    // Omplir filtre de categories
    const filtCat = document.getElementById('videos-filter-cat');
    if (filtCat) {
      const cats = [...new Set(_videosAll.flatMap(v => v.categoria))].filter(Boolean).sort();
      const prev = filtCat.value;
      filtCat.innerHTML = '<option value="">🏷️ Totes les categories</option>';
      cats.forEach(c => {
        const o = document.createElement('option');
        o.value = c; o.textContent = c;
        if (c === prev) o.selected = true;
        filtCat.appendChild(o);
      });
      filtCat.onchange = renderVideos;
    }

    const selectedCat = filtCat?.value || '';
    _videosList = selectedCat
      ? _videosAll.filter(v => v.categoria.includes(selectedCat))
      : _videosAll;

    if (count) count.textContent = `${_videosList.length} vídeo${_videosList.length !== 1 ? 's' : ''}`;

    // Botó reproduir tots
    const playAll = document.getElementById('videos-play-all');
    if (playAll) {
      playAll.style.display = _videosList.length > 1 ? '' : 'none';
      playAll.onclick = () => _openVideoPlayer(0, true);
    }

    grid.innerHTML = '';
    document.getElementById('videos-carousel')?.classList.add('hidden');
    grid.classList.remove('hidden');

    if (_videosList.length === 0) {
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    // Graella de miniatures amb thumbnails reals del Drive
    _videosList.forEach((video, idx) => {
      const thumbUrl = `https://drive.google.com/thumbnail?id=${video.fileId}&sz=w400`;
      const card = document.createElement('div');
      card.className = 'video-card';
      card.innerHTML = `
        <div class="video-card-thumb" style="background:#000">
          <img src="${thumbUrl}" style="width:100%;height:100%;object-fit:cover;display:block"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            loading="lazy" />
          <div class="video-card-play" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,0.6);align-items:center;justify-content:center;font-size:2rem">🎬</div>
          <div class="video-card-play-icon">▶</div>
        </div>
        <div class="video-card-info">
          <div class="video-card-author">${video.persones.join(', ') || video.pujatNom || 'Felicitació'}</div>
          <div class="video-card-meta">${video.categoria.join(' · ') || 'Sense categoria'}</div>
          ${video.notes ? `<div class="video-card-notes">"${video.notes}"</div>` : ''}
        </div>
      `;
      card.addEventListener('click', () => _openVideoPlayer(idx, false));
      grid.appendChild(card);
    });
  }

  let _autoAdvanceTimer = null;

  function _openVideoPlayer(startIdx, shuffle) {
    let list = [..._videosList];
    if (shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    let idx = shuffle ? 0 : startIdx;
    if (_autoAdvanceTimer) clearInterval(_autoAdvanceTimer);

    const overlay = document.getElementById('videos-carousel');
    overlay.classList.remove('hidden');
    document.getElementById('videos-grid').classList.add('hidden');

    const render = () => {
      if (_autoAdvanceTimer) clearInterval(_autoAdvanceTimer);
      const video = list[idx];
      const previewUrl = `https://www.googleapis.com/drive/v3/files/${video.fileId}?alt=media`;
      const thumbUrl   = `https://drive.google.com/thumbnail?id=${video.fileId}&sz=w800`;

      overlay.innerHTML = `
        <div class="vplayer">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:0.75rem">
            <button class="vplayer-close" id="vplayer-close">← Tornar</button>
            ${shuffle && list.length > 1 ? `<span style="font-size:0.78rem;color:var(--text-muted)">Reproducció automàtica en 45s</span>` : ''}
          </div>
          <div class="vplayer-frame" id="vplayer-frame-${idx}">
            <div class="vplayer-cover" id="vplayer-cover-${idx}">
              <div class="vplayer-cover-thumb" style="background-image:url('${thumbUrl}')"></div>
              <div class="vplayer-cover-icon">
                <div class="vplayer-loading-ring"></div>
                <span id="vplayer-pct-${idx}">▶</span>
              </div>
            </div>
          </div>
          <div class="vplayer-info">
            <div class="vplayer-author">${video.persones.join(', ') || video.pujatNom || 'Felicitació'}</div>
            ${video.categoria.length ? `<div class="vplayer-cat">${video.categoria.join(' · ')}</div>` : ''}
            ${video.notes ? `<div class="vplayer-notes">"${video.notes}"</div>` : ''}
          </div>
          ${list.length > 1 ? `
          <div class="vplayer-nav">
            <button id="vplayer-prev" class="videos-nav-btn" ${idx === 0 ? 'disabled' : ''}>‹ Anterior</button>
            <span class="videos-counter">${idx + 1} / ${list.length}</span>
            <button id="vplayer-next" class="videos-nav-btn">Següent ›</button>
          </div>` : ''}
        </div>
      `;

      document.getElementById('vplayer-close').onclick = () => {
        if (_autoAdvanceTimer) clearInterval(_autoAdvanceTimer);
        // Alliberar blob URL de memòria
        const vid = overlay.querySelector('video');
        if (vid?.src?.startsWith('blob:')) URL.revokeObjectURL(vid.src);
        overlay.classList.add('hidden');
        overlay.innerHTML = '';
        document.getElementById('videos-grid').classList.remove('hidden');
      };

      const goNext = () => {
        if (idx < list.length - 1) { idx++; render(); }
        else if (shuffle) { idx = 0; render(); }
      };

      document.getElementById('vplayer-prev')?.addEventListener('click', () => { if (idx > 0) { idx--; render(); } });
      document.getElementById('vplayer-next')?.addEventListener('click', goNext);
      if (shuffle && list.length > 1) {
        _autoAdvanceTimer = setInterval(goNext, 45000);
      }

      // ── Fetch vídeo com blob → <video> natiu (sense iframe Drive) ──
      const frame  = document.getElementById(`vplayer-frame-${idx}`);
      const cover  = document.getElementById(`vplayer-cover-${idx}`);
      const pctEl  = document.getElementById(`vplayer-pct-${idx}`);
      const token  = Auth.getToken();
      const apiUrl = `https://www.googleapis.com/drive/v3/files/${video.fileId}?alt=media`;

      (async () => {
        try {
          const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
          const res = await fetch(apiUrl, { headers });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const contentLength = +res.headers.get('Content-Length') || 0;
          const reader = res.body.getReader();
          const chunks = [];
          let received = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            if (contentLength && pctEl) {
              pctEl.textContent = Math.round(received / contentLength * 100) + '%';
            }
          }
          const blob    = new Blob(chunks, { type: res.headers.get('Content-Type') || 'video/mp4' });
          const blobUrl = URL.createObjectURL(blob);
          const videoEl = document.createElement('video');
          videoEl.src         = blobUrl;
          videoEl.controls    = true;
          videoEl.autoplay    = true;
          videoEl.playsInline = true;
          videoEl.style.cssText = 'width:100%;height:100%;border-radius:12px;display:block;background:#000';
          frame?.appendChild(videoEl);
          // Amagar coberta
          if (cover) { cover.style.opacity = '0'; cover.style.pointerEvents = 'none'; }
          setTimeout(() => cover?.remove(), 600);
        } catch(err) {
          if (pctEl) pctEl.textContent = '⚠️ Error';
          console.error('Error carregant vídeo:', err);
        }
      })();

      document.getElementById('vplayer-prev')?.addEventListener('click', () => { if (idx > 0) { idx--; render(); } });
      document.getElementById('vplayer-next')?.addEventListener('click', goNext);

      // Auto-avanç en mode continu (45s per vídeo)
      if (shuffle && list.length > 1) {
        _autoAdvanceTimer = setInterval(goNext, 45000);
      }
    };
    render();
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

  // ══════════════════════════════════════════
  // FOTOS DEL DIA (temps real)
  // ══════════════════════════════════════════
  let _diaRefreshTimer = null;
  let _diaAutoOn       = true;
  let _diaLastIds      = '';

  function initDia() {
    document.getElementById('dia-reload')?.addEventListener('click', () => loadDia(true));
    document.getElementById('dia-autorefresh')?.addEventListener('click', function() {
      _diaAutoOn = !_diaAutoOn;
      this.classList.toggle('active', _diaAutoOn);
      this.textContent = _diaAutoOn ? '🔄 Auto' : '⏸ Pausat';
      if (_diaAutoOn) startDiaAutoRefresh(); else stopDiaAutoRefresh();
    });
  }

  function startDiaAutoRefresh() {
    stopDiaAutoRefresh();
    if (!_diaAutoOn) return;
    _diaRefreshTimer = setInterval(() => loadDia(false), 15000); // cada 15s
  }
  function stopDiaAutoRefresh() {
    if (_diaRefreshTimer) { clearInterval(_diaRefreshTimer); _diaRefreshTimer = null; }
  }

  async function loadDia(showLoading) {
    const grid    = document.getElementById('dia-grid');
    const loading = document.getElementById('dia-loading');
    const empty   = document.getElementById('dia-empty');
    const count   = document.getElementById('dia-count');
    if (!grid) return;

    if (showLoading) { loading.classList.remove('hidden'); empty.classList.add('hidden'); }

    try {
      const dia = await Sheets.readDia();
      loading.classList.add('hidden');

      if (count) count.textContent = `${dia.length} element${dia.length !== 1 ? 's' : ''}`;

      if (dia.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');

      // Ordenar per data descendent (més recents primer)
      dia.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

      // Si no hi ha canvis, no re-renderitzar (evita parpelleig)
      const ids = dia.map(d => d.fileId).join(',');
      if (ids === _diaLastIds) return;
      _diaLastIds = ids;

      grid.innerHTML = '';
      dia.forEach(item => {
        const isVideo = item.tipus === 'video';
        const card = document.createElement('div');
        card.className = 'dia-card' + (isVideo ? ' dia-card-video' : '');
        if (isVideo) {
          card.innerHTML = `
            <div class="dia-card-media dia-card-vid">
              <iframe src="https://drive.google.com/file/d/${item.fileId}/preview"
                allow="autoplay" allowfullscreen style="width:100%;height:100%;border:0"></iframe>
            </div>
            <div class="dia-card-foot">${item.pujatNom || 'Anònim'}</div>`;
        } else {
          card.innerHTML = `
            <div class="dia-card-media">
              <img src="${item.url}" alt="" loading="lazy" />
            </div>
            <div class="dia-card-foot">${item.pujatNom || 'Anònim'}</div>`;
          card.querySelector('img').addEventListener('click', () => {
            if (typeof Gallery !== 'undefined') Gallery.openLightbox(item);
          });
        }
        grid.appendChild(card);
      });
    } catch(err) {
      loading.classList.add('hidden');
      console.error('Error carregant fotos del dia:', err);
      if (showLoading) UI.showToast('Error carregant fotos del dia', 'error');
    }
  }

  return { init, loadPhotos };
})();

window.addEventListener('load', () => setTimeout(App.init, 300));
