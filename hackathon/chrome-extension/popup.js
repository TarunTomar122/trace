const STEPS = ['Extract transcript', 'Extract faces', 'Analyze speaker', 'Extract voice clip', 'Clone voice', 'Create avatar'];
let currentVideoId = null;
let currentState = null;

async function getCurrentTabVideoId() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        try {
          const url = new URL(tabs[0].url);
          resolve(url.searchParams.get('v'));
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}

function updateUI(state) {
  currentState = state;
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  const statusDetail = document.getElementById('status-detail');
  const progressFill = document.getElementById('progress-fill');
  const chatBtn = document.getElementById('chat-btn');
  const retryBtn = document.getElementById('retry-btn');
  const steps = document.querySelectorAll('.step');

  if (!state) {
    statusText.textContent = 'Click "Create Avatar" on any YouTube video';
    statusDetail.textContent = '';
    progressFill.style.width = '0%';
    chatBtn.classList.remove('visible');
    retryBtn.classList.remove('visible');
    steps.forEach(s => s.className = 'step');
    return;
  }

  if (state.status === 'running') {
    statusEl.className = 'status running';
    statusText.textContent = `Step ${state.step}/6: ${STEPS[state.step - 1] || 'Processing...'}`;
    statusDetail.textContent = 'This may take a few minutes...';
    progressFill.style.width = `${state.progress || 0}%`;
    chatBtn.classList.remove('visible');
    retryBtn.classList.remove('visible');
    steps.forEach(s => {
      const n = parseInt(s.dataset.step);
      s.className = n < state.step ? 'step done' : n === state.step ? 'step active' : 'step';
    });
  } else if (state.status === 'ready') {
    statusEl.className = 'status ready';
    statusText.textContent = `Avatar ready: ${state.name || 'Character'}`;
    statusDetail.textContent = 'Click below to start chatting';
    progressFill.style.width = '100%';
    chatBtn.classList.add('visible');
    chatBtn.textContent = `Chat with ${state.name || 'Character'}`;
    retryBtn.classList.remove('visible');
    steps.forEach(s => s.className = 'step done');
  } else if (state.status === 'error') {
    statusEl.className = 'status error';
    statusText.textContent = `Failed at step ${state.step}`;
    statusDetail.textContent = state.error || 'Unknown error';
    progressFill.style.width = '0%';
    chatBtn.classList.remove('visible');
    retryBtn.classList.add('visible');
    steps.forEach(s => {
      const n = parseInt(s.dataset.step);
      s.className = n < state.step ? 'step done' : n === state.step ? 'step active' : 'step';
    });
  }
}

document.getElementById('chat-btn').addEventListener('click', () => {
  if (!currentState) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.runtime.sendMessage({
        type: 'open_sidepanel',
        tabId: tabs[0].id,
        videoId: currentState.videoId,
        avatarId: currentState.avatarId,
        name: currentState.name || 'Character'
      });
    }
  });
});

document.getElementById('retry-btn').addEventListener('click', () => {
  if (currentState?.videoId) {
    chrome.runtime.sendMessage({ type: 'start_pipeline', videoId: currentState.videoId });
    window.close();
  }
});

// Poll for updates
async function init() {
  currentVideoId = await getCurrentTabVideoId();
  if (!currentVideoId) {
    document.getElementById('no-video').style.display = 'block';
    document.getElementById('status-container').style.display = 'none';
    return;
  }

  chrome.runtime.sendMessage({ type: 'get_state', videoId: currentVideoId }, (response) => {
    updateUI(response);
  });

  // Store videoId for sidepanel
  chrome.storage.local.set({ sidepanel_params: { videoId: currentVideoId } });

  setInterval(() => {
    chrome.runtime.sendMessage({ type: 'get_state', videoId: currentVideoId }, (response) => {
      updateUI(response);
    });
  }, 2000);
}

init();
