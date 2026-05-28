// ============================================
// ANNA40 — DRIVE
// ============================================

const Drive = (() => {
  const BASE_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const META_URL = 'https://www.googleapis.com/drive/v3/files';

  async function uploadFile(file, onProgress) {
    const token    = Auth.getToken();
    const metadata = { name: file.name, parents: [CONFIG.DRIVE_FOLDER_ID] };
    const form     = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
        else reject(new Error('Error pujant fitxer: ' + xhr.status));
      });
      xhr.addEventListener('error', () => reject(new Error('Error de xarxa')));
      xhr.open('POST', BASE_URL);
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.send(form);
    });
  }

  async function makePublic(fileId) {
    await fetch(`${META_URL}/${fileId}/permissions`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Auth.getToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  }

  async function deleteFile(fileId) {
    const res = await fetch(`${META_URL}/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + Auth.getToken() },
    });
    if (!res.ok && res.status !== 204) throw new Error('Error eliminant fitxer: ' + res.status);
  }

  function getThumbnailUrl(fileId) { return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`; }
  function getViewUrl(fileId)      { return `https://drive.google.com/file/d/${fileId}/view`; }

  return { uploadFile, makePublic, deleteFile, getThumbnailUrl, getViewUrl };
})();
