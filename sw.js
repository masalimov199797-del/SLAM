/* SLAM service worker: работа без связи + push-уведомления */
const VERSION = "slam-v1";
const SHELL = ["./", "index.html", "config.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/maskable-512.png"];
const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const RUNTIME = [FB + "firebase-app.js", FB + "firebase-auth.js", FB + "firebase-firestore.js", FB + "firebase-messaging.js"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    await Promise.all(RUNTIME.map(u => c.add(new Request(u, { mode: "cors" })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Запросы к базе и авторизации не кешируем
  if (/googleapis\.com$/.test(url.hostname) && !url.hostname.startsWith("fonts.")) return;
  if (url.hostname.endsWith("firebaseio.com")) return;

  // Страница: сначала сеть, без связи — из кеша
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put("index.html", cp)); return r; })
      .catch(() => caches.match("index.html")));
    return;
  }
  // Своё приложение (config.js, иконки): сеть с запасом из кеша
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req)));
    return;
  }
  // Библиотеки Firebase и шрифты: из кеша, при отсутствии — из сети с сохранением
  if (url.hostname === "www.gstatic.com" || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === "opaque") { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
      return r;
    })));
  }
});

/* ===== Push-уведомления ===== */
importScripts("config.js");
const CFG = self.SLAM_CONFIG || {};
if (CFG.firebase && CFG.firebase.apiKey && CFG.vapidKey) {
  try {
    importScripts(FB + "firebase-app-compat.js", FB + "firebase-messaging-compat.js");
    firebase.initializeApp(CFG.firebase);
    // Сообщения с полем notification показываются автоматически. Здесь — только переход по нажатию.
    firebase.messaging();
  } catch (e) { /* без push приложение работает как обычно */ }
}

self.addEventListener("notificationclick", (e) => {
  const data = (e.notification && e.notification.data) || {};
  const fcm = data.FCM_MSG && data.FCM_MSG.data;
  const reportId = (fcm && fcm.reportId) || data.reportId;
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (all.length) { await all[0].focus(); if (reportId) all[0].postMessage({ type: "open-report", reportId }); return; }
    await self.clients.openWindow("./" + (reportId ? "#report-" + reportId : ""));
  })());
});
