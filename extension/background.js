// Runs fetches on the extension's own behalf, which is exempt from page-level
// CORS restrictions for hosts listed in manifest.json's host_permissions.
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || message.type !== "fetch-law") return false;

  fetch(message.url, { headers: { "Accept": "text/html" } })
    .then(function (resp) {
      return resp.text().then(function (text) {
        sendResponse({ ok: resp.ok, status: resp.status, text: text });
      });
    })
    .catch(function (err) {
      sendResponse({ ok: false, error: err.message });
    });

  return true; // keep sendResponse valid across the async fetch
});
