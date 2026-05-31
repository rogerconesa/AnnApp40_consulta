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

      const marker = new AdvancedMarkerElement({
        position: { lat: group.lat, lng: group.lng },
        map: _map,
        title: `${group.lloc} (${count})`,
        content: pin,
      });

      marker.addListener('click', () => Gallery.openLightbox(group.photos[0]));
      _markers.push(marker);
      bounds.extend({ lat: group.lat, lng: group.lng });
    });

    if (_markers.length > 0) _map.fitBounds(bounds, 60);
    if (_markers.length === 1) {
      _map.setCenter({ lat: Object.values(byLloc)[0].lat, lng: Object.values(byLloc)[0].lng });
      _map.setZoom(10);
    }
  }

  return { init, updatePhotos };
})();
