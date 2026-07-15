// Service worker del Visor SCORM.
//
// Intercepta las peticiones a "course/<ruta>" dentro del scope de este
// sitio y las responde con los archivos que la página principal cargó
// en IndexedDB desde el .zip elegido por el usuario. Así el curso puede
// hacer sus fetch()/XHR normales como si estuviera en un servidor real,
// sin que nada salga de este navegador.

const DB_NAME = "scorm-viewer-db";
const STORE = "files";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "path" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getFile(path) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(path);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      })
  );
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const scopeURL = new URL(self.registration.scope);

  if (url.origin !== scopeURL.origin) return;
  if (!url.pathname.startsWith(scopeURL.pathname)) return;

  const relative = url.pathname.slice(scopeURL.pathname.length);
  if (!relative.startsWith("course/")) return;

  const coursePath = decodeURIComponent(relative.slice("course/".length));

  event.respondWith(
    getFile(coursePath).then((record) => {
      if (record) {
        return new Response(record.blob, {
          status: 200,
          headers: { "Content-Type": record.type || "application/octet-stream" },
        });
      }
      return new Response(
        "Archivo no encontrado en el curso cargado: " + coursePath,
        { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    })
  );
});
