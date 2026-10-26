/**
 * DataForge — Storage Service
 * localStorage abstraction layer with namespacing, CRUD, and size management.
 * All other services use this — no direct localStorage access elsewhere.
 */

const PREFIX = 'dataforge_';
const SCHEMA_VERSION_KEY = PREFIX + 'schema_version';
const CURRENT_SCHEMA_VERSION = 1;
const STORAGE_WARNING_BYTES = 4 * 1024 * 1024; // 4MB warning threshold

// ---- Core Operations ----

/**
 * Get a value from storage by key.
 * Returns null if key doesn't exist or parsing fails.
 */
export function get(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[Storage] Failed to read key "${key}":`, e);
    return null;
  }
}

/**
 * Set a value in storage.
 * Returns { success, error? }
 */
export function set(key, value) {
  try {
    const json = JSON.stringify(value);

    // Check storage usage before writing
    const usage = getStorageUsage();
    if (usage.usedBytes + json.length > STORAGE_WARNING_BYTES) {
      console.warn(`[Storage] Approaching storage limit. Used: ${(usage.usedBytes / 1024 / 1024).toFixed(2)}MB`);
    }

    localStorage.setItem(PREFIX + key, json);

    // Verify write
    const readBack = localStorage.getItem(PREFIX + key);
    if (readBack === null) {
      return { success: false, error: { code: 'WRITE_FAILED', message: 'Data was not stored correctly.' } };
    }

    return { success: true };
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      return {
        success: false,
        error: {
          code: 'STORAGE_FULL',
          message: 'Storage is full. Clear old experiments or datasets in Settings to free space.',
        },
      };
    }
    return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
  }
}

/**
 * Remove a key from storage.
 */
export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
    return { success: true };
  } catch (e) {
    return { success: false, error: { code: 'REMOVE_ERROR', message: e.message } };
  }
}

/**
 * Check if a key exists.
 */
export function has(key) {
  return localStorage.getItem(PREFIX + key) !== null;
}

// ---- Collection Operations ----

/**
 * Get a collection (array) from storage.
 * Returns empty array if key doesn't exist.
 */
export function getCollection(key) {
  return get(key) || [];
}

/**
 * Add an item to a collection.
 */
export function addToCollection(key, item) {
  const collection = getCollection(key);
  collection.push(item);
  return set(key, collection);
}

/**
 * Update an item in a collection by ID.
 */
export function updateInCollection(key, id, updates) {
  const collection = getCollection(key);
  const index = collection.findIndex(item => item.id === id);
  if (index === -1) {
    return { success: false, error: { code: 'NOT_FOUND', message: `Item with id "${id}" not found.` } };
  }
  collection[index] = { ...collection[index], ...updates };
  return set(key, collection);
}

/**
 * Remove an item from a collection by ID.
 */
export function removeFromCollection(key, id) {
  const collection = getCollection(key);
  const filtered = collection.filter(item => item.id !== id);
  if (filtered.length === collection.length) {
    return { success: false, error: { code: 'NOT_FOUND', message: `Item with id "${id}" not found.` } };
  }
  return set(key, filtered);
}

/**
 * Find an item in a collection by ID.
 */
export function findInCollection(key, id) {
  const collection = getCollection(key);
  return collection.find(item => item.id === id) || null;
}

// ---- Storage Management ----

/**
 * Get current storage usage stats.
 */
export function getStorageUsage() {
  let usedBytes = 0;
  let dataForgeBytes = 0;
  let keyCount = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    const size = (key.length + (value ? value.length : 0)) * 2; // UTF-16 = 2 bytes per char
    usedBytes += size;
    if (key.startsWith(PREFIX)) {
      dataForgeBytes += size;
      keyCount++;
    }
  }

  return {
    usedBytes,
    dataForgeBytes,
    keyCount,
    usedMB: (usedBytes / (1024 * 1024)).toFixed(2),
    dataforgeMB: (dataForgeBytes / (1024 * 1024)).toFixed(2),
    isNearLimit: dataForgeBytes > STORAGE_WARNING_BYTES,
  };
}

/**
 * Export all DataForge data as a JSON object.
 */
export function exportAll() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(PREFIX)) {
      const shortKey = key.slice(PREFIX.length);
      try {
        data[shortKey] = JSON.parse(localStorage.getItem(key));
      } catch {
        data[shortKey] = localStorage.getItem(key);
      }
    }
  }
  return data;
}

/**
 * Import data from a previously exported JSON object.
 * Overwrites existing data for matching keys.
 */
export function importAll(data) {
  try {
    for (const [key, value] of Object.entries(data)) {
      const result = set(key, value);
      if (!result.success) {
        return { success: false, error: result.error };
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: { code: 'IMPORT_ERROR', message: e.message } };
  }
}

/**
 * Clear all DataForge data from storage.
 */
export function clearAll() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
  return { success: true };
}

// ---- Schema Migration ----

/**
 * Run schema migrations if needed.
 * Call this once on app startup.
 */
export function migrate() {
  const currentVersion = get('schema_version') || 0;

  if (currentVersion >= CURRENT_SCHEMA_VERSION) return;

  // Migration v0 → v1: initial schema, no transforms needed
  if (currentVersion < 1) {
    // Future migrations go here
  }

  set('schema_version', CURRENT_SCHEMA_VERSION);
}
