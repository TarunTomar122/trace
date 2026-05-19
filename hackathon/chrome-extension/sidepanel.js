const BACKEND_URL = 'http://localhost:3005';

async function init() {
  const loading = document.getElementById('loading');

  chrome.storage.local.get(null, async (allStorage) => {
    console.log('ALL storage keys:', Object.keys(allStorage));
    console.log('active_avatar:', allStorage.active_avatar);

    for (const key in allStorage) {
      if (key.startsWith('avatar_')) {
        console.log(`Found ${key}:`, JSON.stringify(allStorage[key]));
      }
    }

    let info = allStorage.active_avatar;

    if (!info?.avatarId) {
      for (const key in allStorage) {
        if (key.startsWith('avatar_') && allStorage[key]?.avatarId) {
          info = allStorage[key];
          console.log('Fallback found avatar from:', key, info);
          break;
        }
      }
    }

    if (!info?.avatarId) {
      loading.innerHTML = `
        <div style="text-align:center;padding:40px;color:#666;font-family:-apple-system,sans-serif;">
          <p style="font-size:16px;margin-bottom:8px;">No avatar found</p>
          <p style="font-size:12px;color:#999;">Storage keys: ${Object.keys(allStorage).join(', ') || 'none'}</p>
          <p style="font-size:12px;color:#999;margin-top:4px;">active_avatar: ${JSON.stringify(allStorage.active_avatar || 'null')}</p>
        </div>
      `;
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.src = `${BACKEND_URL}/call?avatarId=${encodeURIComponent(info.avatarId)}&name=${encodeURIComponent(info.name || 'Character')}`;
    iframe.onload = () => { if (loading) loading.remove(); };
    document.body.appendChild(iframe);
  });
}

init();
