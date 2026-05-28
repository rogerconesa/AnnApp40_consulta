// ============================================
// ANNA40 — ADMIN
// Gestió de fotos (només admin)
// ============================================

const Admin = (() => {

  // ── Editar foto des del lightbox ──────────────
  function openEditModal(photo) {
    document.getElementById('edit-modal-overlay').classList.remove('hidden');
    document.getElementById('edit-any').value   = photo.any;
    document.getElementById('edit-lloc').value  = photo.lloc;
    document.getElementById('edit-notes').value = photo.notes || '';

    // Categories
    document.querySelectorAll('#edit-chips-categoria .chip').forEach(chip => {
      chip.classList.toggle('selected', photo.categoria.includes(chip.dataset.value));
    });

    // Persones
    const container = document.getElementById('edit-chips-persones');
    container.innerHTML = '';
    const all = [...new Set([...CONFIG.PERSONES_INICIALS, ...photo.persones, ...Gallery.getAllPhotos().flatMap(p => p.persones)])];
    all.forEach(nom => _addPersonaChip(container, nom, photo.persones.includes(nom)));

    document.getElementById('edit-btn-save').onclick   = () => saveEdit(photo.fileId);
    document.getElementById('edit-btn-delete').onclick = () => deletePhoto(photo.fileId);
  }

  function closeEditModal() {
    document.getElementById('edit-modal-overlay').classList.add('hidden');
  }

  async function saveEdit(fileId) {
    const any       = document.getElementById('edit-any').value.trim();
    const lloc      = document.getElementById('edit-lloc').value.trim();
    const notes     = document.getElementById('edit-notes').value.trim();
    const categoria = [...document.querySelectorAll('#edit-chips-categoria .chip.selected')].map(c => c.dataset.value);
    const persones  = [...document.querySelectorAll('#edit-chips-persones .chip.selected')].map(c => c.dataset.value);

    if (!any || !lloc || categoria.length === 0 || persones.length === 0) {
      alert('Any, lloc, categoria i persones són obligatoris');
      return;
    }

    const btn = document.getElementById('edit-btn-save');
    btn.disabled    = true;
    btn.textContent = 'Guardant...';

    try {
      await Sheets.updateRowByFileId(fileId, { any, lloc, notes, categoria, persones });
      closeEditModal();
      Gallery.closeLightbox();
      await App.loadPhotos();
      UI.showToast('Canvis guardats!', 'success');
    } catch (err) {
      UI.showToast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Guardar canvis';
    }
  }

  async function deletePhoto(fileId) {
    if (!confirm('Segur que vols eliminar aquesta foto? S\'eliminarà del Drive i dels registres.')) return;
    try {
      await Drive.deleteFile(fileId);
      await Sheets.deleteRowByFileId(fileId);
      closeEditModal();
      Gallery.closeLightbox();
      await App.loadPhotos();
      UI.showToast('Foto eliminada', 'success');
    } catch (err) {
      UI.showToast('Error eliminant: ' + err.message, 'error');
    }
  }

  // ── Pujar foto nova (admin) ───────────────────
  function initUpload() {
    const dropZone  = document.getElementById('admin-drop-zone');
    const fileInput = document.getElementById('admin-file-input');

    if (!dropZone) return;

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      handleFiles(Array.from(e.dataTransfer.files));
    });
    fileInput.addEventListener('change', () => handleFiles(Array.from(fileInput.files)));

    document.getElementById('admin-btn-upload').addEventListener('click', uploadPhotos);

    // Chips categoria upload
    document.querySelectorAll('#admin-chips-categoria .chip').forEach(c => {
      c.addEventListener('click', () => c.classList.toggle('selected'));
    });

    // Afegir persona upload
    document.getElementById('admin-btn-add-persona').addEventListener('click', () => {
      const input = document.getElementById('admin-input-persona');
      const nom   = input.value.trim();
      if (!nom) return;
      _addPersonaChip(document.getElementById('admin-chips-persones'), nom, true);
      input.value = '';
    });

    // Chips persona upload (inicials)
    CONFIG.PERSONES_INICIALS.forEach(nom => {
      _addPersonaChip(document.getElementById('admin-chips-persones'), nom, false);
    });

    // Chips edit categoria
    document.querySelectorAll('#edit-chips-categoria .chip').forEach(c => {
      c.addEventListener('click', () => c.classList.toggle('selected'));
    });

    // Afegir persona edit
    document.getElementById('edit-btn-add-persona').addEventListener('click', () => {
      const input = document.getElementById('edit-input-persona');
      const nom   = input.value.trim();
      if (!nom) return;
      _addPersonaChip(document.getElementById('edit-chips-persones'), nom, true);
      input.value = '';
    });

    document.getElementById('edit-modal-close').addEventListener('click', closeEditModal);
    document.getElementById('edit-modal-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('edit-modal-overlay')) closeEditModal();
    });
  }

  let _uploadFiles = [];

  function handleFiles(files) {
    _uploadFiles = files.filter(f => f.type.startsWith('image/'));
    const preview = document.getElementById('admin-preview');
    preview.innerHTML = '';
    _uploadFiles.forEach(f => {
      const img = document.createElement('img');
      img.src       = URL.createObjectURL(f);
      img.className = 'admin-preview-img';
      preview.appendChild(img);
    });
    document.getElementById('admin-upload-form').classList.remove('hidden');
  }

  async function uploadPhotos() {
    if (_uploadFiles.length === 0) return;

    const any       = document.getElementById('admin-any').value.trim();
    const lloc      = document.getElementById('admin-lloc').value.trim();
    const notes     = document.getElementById('admin-notes').value.trim();
    const categoria = [...document.querySelectorAll('#admin-chips-categoria .chip.selected')].map(c => c.dataset.value);
    const persones  = [...document.querySelectorAll('#admin-chips-persones .chip.selected')].map(c => c.dataset.value);

    if (!any || !lloc || categoria.length === 0 || persones.length === 0) {
      UI.showToast('Any, lloc, categoria i persones són obligatoris', 'error');
      return;
    }

    const btn = document.getElementById('admin-btn-upload');
    btn.disabled    = true;
    btn.textContent = 'Pujant...';

    const profile = Auth.getProfile();
    let uploaded  = 0;

    for (let i = 0; i < _uploadFiles.length; i++) {
      try {
        const file      = _uploadFiles[i];
        const driveFile = await Drive.uploadFile(file);
        await Drive.makePublic(driveFile.id);
        await Sheets.appendRow({
          id: driveFile.id + '_' + Date.now(),
          fileId: driveFile.id,
          url:    Drive.getThumbnailUrl(driveFile.id),
          any, lloc, persones, categoria, notes,
          pujatNom:   profile?.name  || '',
          pujatEmail: profile?.email || '',
        });
        uploaded++;
      } catch (err) {
        console.error('Error pujant:', err);
      }
    }

    btn.disabled    = false;
    btn.textContent = 'Pujar fotos';
    _uploadFiles    = [];
    document.getElementById('admin-preview').innerHTML = '';
    document.getElementById('admin-upload-form').classList.add('hidden');
    document.getElementById('admin-drop-zone').classList.remove('hidden');

    await App.loadPhotos();
    UI.showToast(`${uploaded} foto${uploaded !== 1 ? 's' : ''} pujada${uploaded !== 1 ? 's' : ''} correctament!`, 'success');

    // Tornar a galeria
    document.querySelector('.nav-tab[data-tab="galeria"]').click();
  }

  function _addPersonaChip(container, nom, selected) {
    if ([...container.querySelectorAll('.chip')].some(c => c.dataset.value === nom)) return;
    const btn = document.createElement('button');
    btn.className    = 'chip' + (selected ? ' selected' : '');
    btn.dataset.value= nom;
    btn.textContent  = nom;
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
    container.appendChild(btn);
  }

  return { openEditModal, closeEditModal, saveEdit, deletePhoto, initUpload };
})();
