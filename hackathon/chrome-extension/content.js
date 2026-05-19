(function() {
  'use strict';

  const BACKEND_URL = 'http://localhost:3005';

  function getVideoId() {
    return new URL(window.location.href).searchParams.get('v');
  }

  function createButton() {
    const videoId = getVideoId();
    if (!videoId) return;

    if (document.getElementById('yt-avatar-btn')) return;

    const menu = document.querySelector('#top-level-buttons-computed');
    if (!menu) return;

    const btn = document.createElement('button');
    btn.id = 'yt-avatar-btn';
    btn.className = 'yt-avatar-btn';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="8" r="4"/>
        <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      </svg>
      <span class="yt-avatar-btn-text">Create Avatar</span>
    `;

    btn.addEventListener('click', async () => {
      const state = await chrome.runtime.sendMessage({ type: 'get_state', videoId });

      if (state?.status === 'ready') {
        chrome.runtime.sendMessage({ type: 'open_sidepanel', videoId, avatarId: state.avatarId, name: state.name || 'Character' });
        return;
      }

      if (state?.status === 'running') {
        chrome.runtime.sendMessage({ type: 'open_popup' });
        return;
      }

      btn.disabled = true;
      btn.querySelector('.yt-avatar-btn-text').textContent = 'Starting...';

      chrome.runtime.sendMessage({ type: 'start_pipeline', videoId }, (response) => {
        if (response?.ok) {
          btn.querySelector('.yt-avatar-btn-text').textContent = 'Processing...';
          chrome.runtime.sendMessage({ type: 'open_popup' });
        } else {
          btn.disabled = false;
          btn.querySelector('.yt-avatar-btn-text').textContent = 'Create Avatar';
          alert(response?.error || 'Failed to start pipeline');
        }
      });
    });

    menu.appendChild(btn);
  }

  function updateButtonState(state) {
    const btn = document.getElementById('yt-avatar-btn');
    if (!btn) return;

    const text = btn.querySelector('.yt-avatar-btn-text');
    if (!text) return;

    if (state?.status === 'ready') {
      btn.disabled = false;
      text.textContent = `Chat with ${state.name}`;
      btn.classList.add('yt-avatar-btn-ready');
    } else if (state?.status === 'running') {
      btn.disabled = true;
      text.textContent = state.step ? `Step ${state.step}/6...` : 'Processing...';
      btn.classList.remove('yt-avatar-btn-ready');
    } else {
      btn.disabled = false;
      text.textContent = 'Create Avatar';
      btn.classList.remove('yt-avatar-btn-ready');
    }
  }

  // Watch for URL changes (SPA navigation)
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(createButton, 1000);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initial creation
  setTimeout(createButton, 2000);

  // Listen for state updates from background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'state_update') {
      updateButtonState(msg.state);
    }
    sendResponse({ ok: true });
  });
})();
