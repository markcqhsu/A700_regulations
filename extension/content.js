// Bridges the page's window.postMessage protocol to the extension's
// background service worker, since the page itself has no access to
// chrome.runtime (content scripts run in an isolated world but share the
// page's DOM/window, so postMessage is the handoff point).
window.addEventListener("message", function (event) {
  if (event.source !== window) return;
  var data = event.data;
  if (!data || data.source !== "hc-regulation-app" || data.type !== "fetch-law-request") return;

  chrome.runtime.sendMessage({ type: "fetch-law", url: data.url }, function (response) {
    window.postMessage({
      source: "hc-regulation-extension",
      type: "fetch-law-response",
      requestId: data.requestId,
      ok: !!(response && response.ok),
      text: response && response.text,
      error: response && response.error
    }, "*");
  });
});

// Lets the page detect the extension's presence without guessing/timing out.
window.postMessage({ source: "hc-regulation-extension", type: "ready" }, "*");
