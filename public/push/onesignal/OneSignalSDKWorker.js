// OneSignal service worker (Web SDK v16).
// Placed under /push/onesignal/ with a dedicated scope so it never collides
// with the PWA/Workbox service worker at '/' (a shared scope reload-loops the app).
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
