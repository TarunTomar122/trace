const BACKEND_URL = 'http://localhost:3005';

async function callStep(step, params) {
  const res = await fetch(`${BACKEND_URL}/api/steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step, ...params }),
  });
  return res.json();
}

async function getState(videoId) {
  const result = await chrome.storage.local.get([`avatar_${videoId}`]);
  return result[`avatar_${videoId}`] || null;
}

async function setState(videoId, state) {
  await chrome.storage.local.set({ [`avatar_${videoId}`]: state });
  chrome.tabs.query({ url: '*://www.youtube.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'state_update', state }).catch(() => {});
    });
  });
}

async function runPipeline(videoId) {
  await setState(videoId, { videoId, status: 'running', step: 1, progress: 0 });

  const steps = [
    { name: 'Transcript', fn: () => callStep('transcript', { videoId }) },
    { name: 'Extract Faces', fn: () => callStep('frames', { videoId }) },
    { name: 'Analyze Speaker', fn: async () => {
      const state = await getState(videoId);
      return callStep('analyze', { videoId, speaker: state?.speaker || 'Speaker' });
    }},
    { name: 'Extract Voice', fn: async () => {
      const state = await getState(videoId);
      return callStep('voice', {
        videoId,
        speaker: state?.speaker || 'Speaker',
        voiceStart: state?.voiceStart || 0,
        voiceEnd: state?.voiceEnd || 0
      });
    }},
    { name: 'Clone Voice', fn: () => callStep('clone', { videoId }) },
    { name: 'Create Avatar', fn: async () => {
      const state = await getState(videoId);
      return callStep('avatar', { videoId, speaker: state?.speaker || 'Speaker', voiceId: state?.voiceId || '', frameIndex: state?.frameIndex || 0 });
    }},
  ];

  for (let i = 0; i < steps.length; i++) {
    const previousState = await getState(videoId) || { videoId };
    await setState(videoId, {
      ...previousState,
      status: 'running',
      step: i + 1,
      progress: Math.round((i / steps.length) * 100),
    });

    try {
      const result = await steps[i].fn();
      console.log(`Step ${i+1} (${steps[i].name}) result:`, JSON.stringify(result).slice(0, 200));

      if (!result?.ok) {
        await setState(videoId, {
          videoId, status: 'error', step: i + 1,
          error: result?.error || `${steps[i].name} failed`
        });
        return;
      }

      const state = await getState(videoId) || { videoId };

      if (result.speakers && result.main_speaker !== undefined) {
        const idx = typeof result.main_speaker === 'number' ? result.main_speaker : 0;
        state.speaker = result.speakers[idx]?.name || result.speakers[0]?.name || 'Speaker';
      }

      if (result.voice_start) state.voiceStart = result.voice_start;
      if (result.voice_end) state.voiceEnd = result.voice_end;
      if (result.voice_id) state.voiceId = result.voice_id;
      if (result.avatar_id) state.avatarId = result.avatar_id;
      if (result.name) state.name = result.name;
      if (result.selected_frame !== undefined) state.frameIndex = result.selected_frame;

      console.log(`State after step ${i+1}:`, JSON.stringify(state).slice(0, 300));
      await setState(videoId, state);
    } catch (err) {
      await setState(videoId, {
        videoId, status: 'error', step: i + 1,
        error: err.message || `${steps[i].name} failed`
      });
      return;
    }
  }

  const state = await getState(videoId);
  console.log('Final state before ready:', JSON.stringify(state));
  await setState(videoId, { ...state, status: 'ready', progress: 100 });
}

async function openSidePanel(tabId, videoId, avatarId, name) {
  console.log('openSidePanel called with:', { videoId, avatarId, name });

  await chrome.storage.local.set({
    active_avatar: { videoId, avatarId, name: name || 'Character' }
  });

  const verify = await chrome.storage.local.get(['active_avatar']);
  console.log('Verified storage after set:', JSON.stringify(verify));

  try {
    await chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true });
    await chrome.sidePanel.open({ tabId });
    return { ok: true, mode: 'sidepanel' };
  } catch (err) {
    console.warn('Sidepanel open failed, falling back to tab:', err);
    const url = `${BACKEND_URL}/call?avatarId=${encodeURIComponent(avatarId || '')}&name=${encodeURIComponent(name || 'Character')}`;
    await chrome.tabs.create({ url });
    return { ok: true, mode: 'tab-fallback' };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Message received:', msg.type, msg);
  if (msg.type === 'start_pipeline') {
    runPipeline(msg.videoId).catch(err => {
      setState(msg.videoId, { videoId: msg.videoId, status: 'error', error: err.message });
    });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'get_state') {
    getState(msg.videoId).then(state => {
      console.log('get_state response:', JSON.stringify(state));
      sendResponse(state);
    });
    return true;
  }

  if (msg.type === 'open_sidepanel') {
    const tabId = msg.tabId || sender.tab?.id || null;
    if (!msg.avatarId) {
      sendResponse({ ok: false, error: 'Missing avatarId' });
      return true;
    }

    if (tabId) {
      openSidePanel(tabId, msg.videoId, msg.avatarId, msg.name)
        .then((result) => sendResponse(result))
        .catch((err) => {
          sendResponse({ ok: false, error: err?.message || 'Failed to open chat' });
        });
      return true;
    }

    const url = `${BACKEND_URL}/call?avatarId=${encodeURIComponent(msg.avatarId)}&name=${encodeURIComponent(msg.name || 'Character')}`;
    chrome.tabs.create({ url })
      .then(() => sendResponse({ ok: true, mode: 'tab-fallback' }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || 'Failed to open chat tab' }));
    return true;
  }

  if (msg.type === 'open_popup') {
    chrome.action.openPopup();
    sendResponse({ ok: true });
    return true;
  }
});
