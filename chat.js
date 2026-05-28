// ============================================
// ANNA40 — CHAT integrat (Gemini IA)
// ============================================

const Chat = (() => {
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

  let _photos   = [];
  let _history  = [];
  let _isAdmin  = false;
  let _isOpen   = false;

  function init(photos, isAdmin) {
    _photos  = photos;
    _isAdmin = isAdmin;

    const input   = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const clearBtn= document.getElementById('chat-clear');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _handleInput(); }
    });
    sendBtn.addEventListener('click', _handleInput);
    clearBtn.addEventListener('click', clearChat);

    // Obrir xat en focus
    input.addEventListener('focus', () => _openChat());
  }

  function updatePhotos(photos) { _photos = photos; }

  // ── Gestionar input: cerca simple o xat IA ──
  async function _handleInput() {
    const input = document.getElementById('chat-input');
    const text  = input.value.trim();
    if (!text) return;

    input.value = '';
    _openChat();
    _addMessage('user', text);

    // Si és admin → usar Gemini IA
    // Si no → cerca per text simple
    if (_isAdmin) {
      await _queryGemini(text);
    } else {
      _simpleSearch(text);
    }
  }

  // ── Cerca simple (usuaris no-admin) ──────────
  function _simpleSearch(text) {
    const q = text.toLowerCase();
    const found = _photos.filter(p => {
      const searchable = [p.any, p.lloc, p.notes, ...p.persones, ...p.categoria].join(' ').toLowerCase();
      return searchable.includes(q);
    });

    const msg = found.length > 0
      ? `He trobat ${found.length} foto${found.length !== 1 ? 's' : ''} relacionades amb "${text}".`
      : `No he trobat fotos relacionades amb "${text}". Prova amb altres paraules.`;

    _addMessage('ia', msg);
    Gallery.filterByPhotos(found.length > 0 ? found : null, text);
    _setStatus(found.length > 0 ? `${found.length} fotos trobades` : '');
  }

  // ── Gemini IA (admin) ─────────────────────────
  async function _queryGemini(text) {
    _setLoading(true);

    try {
      const photosCtx = _photos.map((p, i) =>
        `[${i}] Any:${p.any}|Lloc:${p.lloc}|Persones:${p.persones.join(',')}|Cat:${p.categoria.join(',')}|Notes:${p.notes}`
      ).join('\n');

      const prompt = `Ets un assistent que ajuda a trobar fotos d'un grup d'amics d'en Roger per sorprendre l'Anna pel seu 40è aniversari.
Tens ${_photos.length} fotos amb tags.

FOTOS:
${photosCtx}

Consulta: "${text}"

Respon en català de manera breu i amigable (1-2 frases).
Identifica les fotos que coincideixen.
Acaba SEMPRE amb: {"found":[índexs]}
Si no en trobes: {"found":[]}`;

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
        })
      });

      if (!res.ok) throw new Error('Error Gemini ' + res.status);
      const data     = await res.json();
      const respText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Extreure índexs
      const jsonMatch = respText.match(/\{"found":\s*\[([^\]]*)\]\}/);
      let found = [];
      if (jsonMatch) {
        try { found = JSON.parse(jsonMatch[0]).found || []; } catch(e) {}
      }

      const cleanText = respText.replace(/\{"found":\s*\[[^\]]*\]\}/g, '').trim();
      _addMessage('ia', cleanText || (found.length > 0 ? `He trobat ${found.length} fotos.` : 'No he trobat res.'));

      const foundPhotos = found.map(i => _photos[i]).filter(Boolean);
      Gallery.filterByPhotos(foundPhotos.length > 0 ? foundPhotos : null, text);
      _setStatus(foundPhotos.length > 0 ? `${foundPhotos.length} fotos trobades per IA` : '');

    } catch (err) {
      console.error('Chat error:', err);
      _addMessage('ia', 'Hi ha hagut un error. Provo una cerca simple...');
      _simpleSearch(text);
    } finally {
      _setLoading(false);
    }
  }

  // ── UI helpers ────────────────────────────────
  function _openChat() {
    if (_isOpen) return;
    _isOpen = true;
    document.getElementById('chat-messages-inline').classList.add('open');
  }

  function clearChat() {
    _history = [];
    _isOpen  = false;
    document.getElementById('chat-messages-inline').innerHTML = '';
    document.getElementById('chat-messages-inline').classList.remove('open');
    document.getElementById('chat-status').textContent = '';
    Gallery.filterByPhotos(null, '');
    _setStatus('');
  }

  function _addMessage(role, text) {
    const container = document.getElementById('chat-messages-inline');
    const div       = document.createElement('div');
    div.className   = `chat-msg chat-msg-${role}`;
    const bubble    = document.createElement('div');
    bubble.className= 'chat-bubble';
    bubble.innerHTML= text.replace(/\n/g, '<br>');
    div.appendChild(bubble);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function _setLoading(on) {
    const btn   = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');
    btn.disabled   = on;
    input.disabled = on;
    btn.textContent= on ? '…' : '➤';

    const status = document.getElementById('chat-status');
    if (on) {
      status.innerHTML = '<span class="chat-loading"><span></span><span></span><span></span></span> Buscant...';
    } else {
      status.innerHTML = '';
    }
  }

  function _setStatus(text) {
    const indicator = document.getElementById('chat-mode-indicator');
    if (indicator) indicator.style.display = text ? 'inline' : 'none';
    if (indicator) indicator.textContent = text ? `🤖 ${text}` : '';
  }

  return { init, updatePhotos, clearChat };
})();
