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

    _map = new Map(container, {
      center: { lat: 41.3851, lng: 2.1734 },
      zoom: 6,
      mapId: 'annapp40_map',
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    _initialized = true;
    _renderMarkers();
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
      const size     = count === 1 ? 30 : count < 5 ? 36 : 44;
      const bg       = count === 1 ? '#0a84ff' : count < 5 ? '#5ac8fa' : '#ffd60a';
      const color    = count < 5 ? '#fff' : '#000';

      const pin = document.createElement('div');
      pin.style.cssText = [
        `width:${size}px`, `height:${size}px`,
        `background:${bg}`, `color:${color}`,
        'border-radius:50%', 'border:2px solid #fff',
        'display:flex', 'align-items:center', 'justify-content:center',
        `font-size:${count < 10 ? 13 : 11}px`, 'font-weight:700',
        "font-family:-apple-system,sans-serif",
        'box-shadow:0 2px 8px rgba(0,0,0,0.35)', 'cursor:pointer',
      ].join(';');
      pin.textContent = count > 1 ? String(count) : '📍';

      // Log per depurar
      console.log(`📍 Marker: ${group.lloc} → lat:${group.lat}, lng:${group.lng}`);

      const marker = new AdvancedMarkerElement({
        position: { lat: group.lat, lng: group.lng },
        map: _map,
        title: `${group.lloc}: lat=${group.lat.toFixed(4)}, lng=${group.lng.toFixed(4)}`,
        content: pin,
      });

      // Popup personalitzat amb miniatura
      const infoWindow = new google.maps.InfoWindow({
        content: _buildPopup(group),
        pixelOffset: new google.maps.Size(0, -10),
      });

      let _openInfo = null;
      marker.addListener('click', () => {
        if (_openInfo) _openInfo.close();
        _openInfo = infoWindow;
        infoWindow.open({ map: _map, anchor: marker });
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

  function _buildPopup(group) {
    const photo = group.photos[0];
    const more  = group.photos.length > 1 ? `<div style="font-size:11px;color:#666;margin-top:4px">+${group.photos.length - 1} foto${group.photos.length > 2 ? 's' : ''} més</div>` : '';
    const thumb = photo.url ? `<img src="${photo.url}" style="width:160px;height:120px;object-fit:cover;border-radius:8px;display:block;cursor:pointer" id="map-popup-img" />` : `<div style="width:160px;height:120px;background:#eee;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:2rem">🖼️</div>`;

    const html = `
      <div style="font-family:-apple-system,sans-serif;padding:2px;min-width:160px">
        <div id="map-popup-thumb" style="cursor:pointer">${thumb}</div>
        <div style="margin-top:8px">
          <div style="font-weight:600;font-size:13px;color:#111">${group.lloc}</div>
          <div style="font-size:12px;color:#888;margin-top:1px">${photo.any || ''}${photo.any && group.photos.length > 1 ? ' · ' : ''}${group.photos.length > 1 ? group.photos.length + ' fotos' : ''}</div>
          ${more}
        </div>
      </div>`;
    return html;
  }

  // Listener global per al clic al popup (delegació d'events)
  document.addEventListener('click', (e) => {
    if (e.target.id === 'map-popup-img' || e.target.id === 'map-popup-thumb' || e.target.closest('#map-popup-thumb')) {
      // Trobar el grup corresponent i obrir lightbox
      const img = e.target.closest('#map-popup-thumb')?.querySelector('img');
      if (!img) return;
      const src = img.src;
      // Buscar la foto per URL
      const allPhotos = Gallery.getFiltered ? Gallery.getFiltered() : [];
      const photo = allPhotos.find(p => p.url === src);
      if (photo) Gallery.openLightbox(photo);
    }
  });

  return { init, updatePhotos };
})();
