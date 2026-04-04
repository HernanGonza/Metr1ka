// Cache simple en memoria — se limpia al recargar la página
// TTL por defecto: 60 segundos

const store = new Map()

export function cacheGet(key) {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { store.delete(key); return null }
  return entry.data
}

export function cacheSet(key, data, ttlMs = 60_000) {
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export function cacheDelete(key) {
  store.delete(key)
}

export function cacheClear(prefix) {
  if (!prefix) { store.clear(); return }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}