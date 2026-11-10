(() => {
  const status = document.getElementById('offline-status');
  const retry = document.getElementById('offline-retry');
  if (!('serviceWorker' in navigator)) {
    status.textContent = '请使用 Safari 或支持离线的浏览器';
    return;
  }

  const workers = navigator.serviceWorker;

  function waitForControl() {
    if (workers.controller) return Promise.resolve(workers.controller);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        workers.removeEventListener('controllerchange', onControl);
        reject(new Error('Waiting for offline support timed out'));
      }, 25000);
      function onControl() {
        if (!workers.controller) return;
        clearTimeout(timer);
        workers.removeEventListener('controllerchange', onControl);
        resolve(workers.controller);
      }
      workers.addEventListener('controllerchange', onControl);
    });
  }

  function prepareCache(worker) {
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        channel.port1.close();
        reject(new Error('Waiting for offline files timed out'));
      }, 25000);
      channel.port1.onmessage = event => {
        clearTimeout(timer);
        channel.port1.close();
        if (event.data === true) resolve();
        else reject(new Error('Offline files are unavailable'));
      };
      worker.postMessage('mint:prepare-offline', [channel.port2]);
    });
  }

  async function prepareOffline() {
    retry.hidden = true;
    status.textContent = '正在准备离线词表…';
    delete status.dataset.ready;
    try {
      if (!workers.controller) await workers.register(new URL('sw.js', document.baseURI), {updateViaCache:'none'});
      const worker = await waitForControl();
      await prepareCache(worker);
      status.textContent = '已可离线使用';
      status.dataset.ready = 'true';
    } catch {
      status.textContent = '请联网后重新准备';
      retry.hidden = false;
    }
  }

  retry.addEventListener('click', prepareOffline);
  prepareOffline();
})();
