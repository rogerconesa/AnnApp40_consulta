// ============================================
// ANNA40 — CHAT (Gemini IA)
// Només per admin
// ============================================

const Chat = (() => {
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

  let _photos    = [];
  let _history   = [];
  let _container = null;

  function init(photos) {
    _photos    = photos;
    _history   = [];
    _container = document.getElementById('chat-messages');
    _renderWelcome();

    document.getElementById('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    document.getElementById('chat-send').addEventListener('click', sendMessage);
  }

  function updatePhotos(photos) { _photos = photos; }

  function _renderWelcome() {
    _addMessage('ia', `Hola! Soc el teu assistent per trobar fotos. Pots preguntar-me coses com:\n\n• "Mostra'm fotos amb el Roger a la platja"\n• "Quines fotos hi ha de l'any 2022?"\n• "Fotos de Nadal amb la família"\n• "Quan vam anar a Viatges el 2023?"`);
  }

  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text  = input.value.trim();
    if (!text) return;

    input.value = '';
    _addMessage('user', text);
    _setLoading(true);

    try {
      // Construir context amb totes les fotos
      const photosContext = _photos.map((p, i) =>
        `[${i}] Any:${p.any} | Lloc:${p.lloc} | Persones:${p.persones.join(',')} | Categoria:${p.categoria.join(',')} | Notes:${p.notes} | ID:${p.fileId}`
      ).join('\n');

      const systemPrompt = `Ets un assistent que ajuda a trobar fotos d'un grup d'amics. 
Tens accés a ${_photos.length} fotos amb els seus tags.

FOTOS DISPONIBLES:
${photosContext}

Quan l'usuari faci una cerca:
1. Identifica quines fotos coincideixen amb la seva consulta
2. Respon de manera natural i amigable en català
3. Llista els índexs de les fotos trobades en format JSON al final: {"found": [0, 3, 7]}
4. Si no trobes res, digues-ho amablement

Sempre acaba la resposta amb el JSON {"found": [...]} amb els índexs de les fotos trobades, o {"found": []} si no n'hi ha.`;

      const contents = [
        ..._history,
        { role: 'user', parts: [{ text: systemPrompt + '\n\nConsulta: ' + text }] }
      ];

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { temperature: 0.3, maxOutputTokens: 1000 } })
      });

      if (!res.ok) throw new Error('Error Gemini: ' + res.status);
      const data     = await res.json();
      const respText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No he pogut processar la resposta.';

      // Extreure índexs de fotos trobades
      const jsonMatch = respText.match(/\{"found":\s*\[([^\]]*)\]\}/);
      let foundIndexes = [];
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          foundIndexes = parsed.found || [];
        } catch(e) {}
      }

      // Missatge net (sense JSON)
      const cleanText = respText.replace(/\{"found":\s*\[[^\]]*\]\}/g, '').trim();
      _addMessage('ia', cleanText, foundIndexes.map(i => _photos[i]).filter(Boolean));

      // Guardar historial (simplificat)
      _history.push({ role: 'user',  parts: [{ text }] });
      _history.push({ role: 'model', parts: [{ text: respText }] });
      if (_history.length > 10) _history = _history.slice(-10); // màx 5 torns

    } catch (err) {
      console.error('Error chat:', err);
      _addMessage('ia', 'Hi ha hagut un error. Torna-ho a intentar.');
    } finally {
      _setLoading(false);
    }
  }

  function _addMessage(role, text, photos = []) {
    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = text.replace(/\n/g, '<br>');
    div.appendChild(bubble);

    // Miniatures de fotos trobades
    if (photos.length > 0) {
      const grid = document.createElement('div');
      grid.className = 'chat-photo-grid';
      photos.slice(0, 6).forEach(photo => {
        const img = document.createElement('img');
        img.src       = photo.url;
        img.className = 'chat-photo-thumb';
        img.title     = `${photo.any} · ${photo.lloc}`;
        img.addEventListener('click', () => {
          if (typeof Gallery !== 'undefined') Gallery.openLightbox(photo);
        });
        grid.appendChild(img);
      });
      if (photos.length > 6) {
        const more = document.createElement('div');
        more.className   = 'chat-photo-more';
        more.textContent = `+${photos.length - 6} més`;
        grid.appendChild(more);
      }
      div.appendChild(grid);
    }

    _container.appendChild(div);
    _container.scrollTop = _container.scrollHeight;
  }

  function _setLoading(loading) {
    const btn   = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');
    btn.disabled   = loading;
    input.disabled = loading;
    btn.textContent = loading ? '...' : '➤';

    if (loading) {
      const div = document.createElement('div');
      div.className = 'chat-msg chat-msg-ia';
      div.id        = 'chat-loading';
      div.innerHTML = '<div class="chat-bubble chat-loading"><span></span><span></span><span></span></div>';
      _container.appendChild(div);
      _container.scrollTop = _container.scrollHeight;
    } else {
      const l = document.getElementById('chat-loading');
      if (l) l.remove();
    }
  }

  function clearHistory() {
    _history   = [];
    _container.innerHTML = '';
    _renderWelcome();
  }

  return { init, updatePhotos, sendMessage, clearHistory };
})();
