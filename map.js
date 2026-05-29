// ============================================
// ANNA40 — MAP v2
// Mapa amb clusters dins la galeria
// ============================================

const MapView = (() => {
  let _map      = null;
  let _markers  = [];
  let _photos   = [];
  let _initialized = false;

  function init() {
    if (_initialized) return;
    if (typeof google === 'undefined' || !google.maps) {
      setTimeout(init, 500);
      return;
    }
    _initMap();
    _initialized = true;
  }

  function updatePhotos(photos) {
    _photos = photos;
    if (_initialized) _renderMarkers();
  }

  function _initMap() {
    const container = document.getElementById('map-container');
    if (!container) return;

    _map = new google.maps.Map(container, {
      center: { lat: 41.3851, lng: 2.1734 },
      zoom: 6,
      styles: _darkMapStyle(),
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    _renderMarkers();
  }

  function _renderMarkers() {
    if (!_map) return;
    _markers.forEach(m => m.setMap(null));
    _markers = [];

    const withCoords = _photos.filter(p => p.lat && p.lng && p.tipus !== 'video');
    const section    = document.getElementById('map-section');
    const noCoords   = document.getElementById('map-no-coords');

    if (withCoords.length === 0) {
      if (section) section.classList.add('hidden');
      return;
    }
    if (section)  section.classList.remove('hidden');
    if (noCoords) noCoords.classList.add('hidden');

    // Agrupar per coordenada arrodonida (cluster simple)
    const byLloc = {};
    withCoords.forEach(p => {
      const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
      if (!byLloc[key]) byLloc[key] = { lat: p.lat, lng: p.lng, lloc: p.lloc, photos: [] };
      byLloc[key].photos.push(p);
    });

    const bounds = new google.maps.LatLngBounds();
    Object.values(byLloc).forEach(group => {
      const count = group.photos.length;
      const marker = new google.maps.Marker({
        position: { lat: group.lat, lng: group.lng },
        map: _map,
        title: `${group.lloc} (${count})`,
        icon: _clusterIcon(count),
      });
      marker.addListener('click', () => {
        if (group.photos.length === 1) Gallery.openLightbox(group.photos[0]);
        else {
          // Mostrar primera foto del grup, l'usuari pot navegar
          Gallery.openLightbox(group.photos[0]);
        }
      });
      _markers.push(marker);
      bounds.extend({ lat: group.lat, lng: group.lng });
    });

    if (_markers.length > 0) _map.fitBounds(bounds, 80);
    if (_markers.length === 1) _map.setZoom(Math.min(_map.getZoom(), 10));
  }

  function _clusterIcon(count) {
    const size  = count === 1 ? 30 : count < 5 ? 36 : 44;
    const color = count === 1 ? '#0a84ff' : count < 5 ? '#5ac8fa' : '#ffd60a';
    const fontColor = count < 5 ? '#fff' : '#000';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2-2}" fill="${color}" opacity="0.95" stroke="#fff" stroke-width="2"/>
      <text x="${size/2}" y="${size/2+4}" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="${count < 10 ? 13 : 11}" font-weight="700" fill="${fontColor}">${count}</text>
    </svg>`;
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(size, size),
      anchor: new google.maps.Point(size/2, size/2),
    };
  }

  function _darkMapStyle() {
    return [
      { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#7a7a7a' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
      { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#999' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1828' }] },
      { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a6478' }] },
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#0a84ff' }] },
    ];
  }

  return { init, updatePhotos };
})();
