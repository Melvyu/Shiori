// Tiny IndexedDB wrapper. Everything stays on this device.
const NAME = 'shiori', VER = 1;
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('books')) d.createObjectStore('books', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('content')) d.createObjectStore('content');
      if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');
      if (!d.objectStoreNames.contains('marks')) d.createObjectStore('marks', { keyPath: 'id' }).createIndex('book', 'book');
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
    };
    r.onsuccess = () => { const d = r.result; d.onversionchange = () => d.close(); res(d); };
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('Database blocked'));
  });
  return dbp;
}
function run(store, mode, fn) {
  return open().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, mode); const s = t.objectStore(store);
    let out; const r = fn(s);
    if (r && typeof r === 'object' && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted'));
  }));
}
export const db = {
  get: (s, k) => run(s, 'readonly', st => st.get(k)),
  put: (s, v, k) => run(s, 'readwrite', st => k === undefined ? st.put(v) : st.put(v, k)),
  del: (s, k) => run(s, 'readwrite', st => st.delete(k)),
  all: s => run(s, 'readonly', st => st.getAll()),
  keys: s => run(s, 'readonly', st => st.getAllKeys()),
  byBook: id => run('marks', 'readonly', st => st.index('book').getAll(id)),
  putMany: (s, list) => run(s, 'readwrite', st => { list.forEach(([v, k]) => k === undefined ? st.put(v) : st.put(v, k)); }),
  delMany: (s, keys) => run(s, 'readwrite', st => { keys.forEach(k => st.delete(k)); }),
};
