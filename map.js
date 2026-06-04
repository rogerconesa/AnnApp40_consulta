// ============================================
// ANNA40 — MAP v3 — AdvancedMarkerElement
// ============================================

const MapView = (() => {
  let _map         = null;
  let _markers     = [];
  let _photos      = [];
  let _initialized = false;

  function init() {
    if (_initialized) return;
    if (typeof google === 'undefined' || !google.maps) {
      setTimeout(init, 500);
      return;
    }
    _initMap();
  }

  function updatePhotos(photos) {
    _photos = photos;
    if (_initialized) _renderMarkers();
  }

  async function _initMap() {
    const container = document.getElementById('map-container');
    if (!container) return;

    const { Map } = await google.maps.importLibrary('maps');

    const isDark = document.documentElement.dataset.theme === 'dark';

    _map = new Map(container, {
      center: { lat: 41.3851, lng: 2.1734 },
      zoom: 6,
      mapId: 'annapp40_map',
      colorScheme: isDark ? 'DARK' : 'LIGHT',
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    _initialized = true;
    _renderMarkers();

    // Escoltar canvis de tema per actualitzar el mapa
    const observer = new MutationObserver(() => {
      const nowDark = document.documentElement.dataset.theme === 'dark';
      if (_map && _map.setOptions) {
        _map.setOptions({ colorScheme: nowDark ? 'DARK' : 'LIGHT' });
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  async function _renderMarkers() {
    if (!_map) return;

    // Netejar markers anteriors
    _markers.forEach(m => { m.map = null; });
    _markers = [];

    const _parseCoord = (v) => {
      const n = parseFloat(String(v || '').replace(',', '.'));
      return isNaN(n) ? null : n;
    };

    const withCoords = _photos.filter(p => {
      if (p.tipus === 'video') return false;
      const lat = _parseCoord(p.lat);
      const lng = _parseCoord(p.lng);
      return lat !== null && lng !== null &&
             lat >= -90 && lat <= 90 &&
             lng >= -180 && lng <= 180 &&
             !(lat === 0 && lng === 0);
    });

    const noCoords = document.getElementById('map-no-coords');
    if (withCoords.length === 0) {
      if (noCoords) noCoords.classList.remove('hidden');
      return;
    }
    if (noCoords) noCoords.classList.add('hidden');

    const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

    // Agrupar per coordenada
    const byLloc = {};
    withCoords.forEach(p => {
      const lat = _parseCoord(p.lat);
      const lng = _parseCoord(p.lng);
      const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
      if (!byLloc[key]) byLloc[key] = { lat, lng, lloc: p.lloc, photos: [] };
      byLloc[key].photos.push(p);
    });

    const bounds = new google.maps.LatLngBounds();

    Object.values(byLloc).forEach(group => {
      const count    = group.photos.length;
      const size     = count === 1 ? 18 : count < 5 ? 24 : 30;
      const bg       = count === 1 ? '#0a84ff' : count < 5 ? '#34c759' : '#ff9500';

      const pin = document.createElement('div');
      pin.style.cssText = [
        `width:${size}px`, `height:${size}px`,
        `background:${bg}`, 'color:#fff',
        'border-radius:50%', 'border:2px solid rgba(255,255,255,0.95)',
        'display:flex', 'align-items:center', 'justify-content:center',
        `font-size:${count === 1 ? 0 : count < 10 ? 11 : 9}px`, 'font-weight:700',
        "font-family:-apple-system,sans-serif",
        'box-shadow:0 1px 4px rgba(0,0,0,0.4)', 'cursor:pointer',
        'transition:transform 0.15s ease',
      ].join(';');
      pin.textContent = count > 1 ? String(count) : '';
      pin.onmouseenter = () => pin.style.transform = 'scale(1.25)';
      pin.onmouseleave = () => pin.style.transform = 'scale(1)';

      // Log per depurar
      console.log(`📍 Marker: ${group.lloc} → lat:${group.lat}, lng:${group.lng}`);

      const marker = new AdvancedMarkerElement({
        position: { lat: group.lat, lng: group.lng },
        map: _map,
        title: `${group.lloc}: lat=${group.lat.toFixed(4)}, lng=${group.lng.toFixed(4)}`,
        content: pin,
      });

      // Clic al marker: 1 foto → lightbox directe | múltiples → carrussel del cluster
      marker.addListener('gmp-click', () => {
        if (group.photos.length === 1) {
          Gallery.openLightbox(group.photos[0]);
        } else {
          _openClusterCarousel(group);
        }
      });
      _markers.push(marker);
      bounds.extend({ lat: group.lat, lng: group.lng });
    });

    if (_markers.length > 0) _map.fitBounds(bounds, 60);
    if (_markers.length === 1) {
      _map.setCenter({ lat: Object.values(byLloc)[0].lat, lng: Object.values(byLloc)[0].lng });
      _map.setZoom(10);
    }
  }

  function _openClusterCarousel(group) {
    let existing = document.getElementById('map-cluster-modal');
    if (existing) existing.remove();

    let idx = 0;
    const photos = group.photos.filter(p => p.tipus !== 'video');
    if (photos.length === 0) return;

    const modal = document.createElement('div');
    modal.id = 'map-cluster-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;flex-direction:column;padding:1rem';
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Afegir al DOM PRIMER, després render (getElementById necessita estar al DOM)
    document.body.appendChild(modal);

    const render = () => {
      const p = photos[idx];
      modal.innerHTML = `
        <div style="position:relative;max-width:500px;width:100%;background:var(--bg2);border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.5)">
          <button id="cmc-close" style="position:absolute;top:10px;right:12px;background:rgba(0,0,0,0.5);border:none;color:#fff;border-radius:50%;width:32px;height:32px;font-size:1.1rem;cursor:pointer;z-index:10">✕</button>
          <img src="${p.url}" style="width:100%;max-height:55dvh;object-fit:contain;background:#000;display:block" loading="lazy" />
          <div style="padding:12px 16px">
            <div style="font-weight:700;font-size:0.95rem">${p.lloc || ''}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">${p.any || ''} · ${p.persones.join(', ') || ''}</div>
            ${p.categoria?.length ? `<div style="font-size:0.72rem;color:var(--accent);margin-top:2px">${p.categoria.join(' · ')}</div>` : ''}
          </div>
          ${photos.length > 1 ? `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px 12px;gap:8px">
            <button id="cmc-prev" style="flex:1;padding:7px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--text);cursor:pointer;font-family:var(--font);font-size:0.85rem" ${idx === 0 ? 'disabled' : ''}>‹ Anterior</button>
            <span style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${idx + 1} / ${photos.length}</span>
            <button id="cmc-next" style="flex:1;padding:7px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--text);cursor:pointer;font-family:var(--font);font-size:0.85rem" ${idx === photos.length - 1 ? 'disabled' : ''}>Següent ›</button>
          </div>` : ''}
        </div>
      `;
      document.getElementById('cmc-close').onclick = () => modal.remove();
      document.getElementById('cmc-prev')?.addEventListener('click', () => { if (idx > 0) { idx--; render(); } });
      document.getElementById('cmc-next')?.addEventListener('click', () => { if (idx < photos.length - 1) { idx++; render(); } });
    };
    render();
  }

  function _buildPopup() { return ''; }

  return { init, updatePhotos };
})();
