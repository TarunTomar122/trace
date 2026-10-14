// In-memory stand-in for the Firestore surface Trace uses (admin SDK and
// LocalDB), so tests never reach a real database. Values come back the way
// LocalDB returns them: Dates and server timestamps as ISO strings.

function stored(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stored);
  if (!value || typeof value !== 'object') return value;
  const name = value.constructor?.name || '';
  if (name === 'ServerTimestampTransform') return new Date().toISOString();
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, stored(item)]));
}

function isDeleteTransform(value) {
  return Boolean(value && typeof value === 'object' && value.constructor?.name === 'DeleteTransform');
}

class MemorySnapshot {
  constructor(ref, data) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = data !== undefined;
    this._data = data;
  }

  data() {
    return this._data === undefined ? undefined : structuredClone(this._data);
  }
}

class MemoryDocRef {
  constructor(db, path) {
    this.db = db;
    this.path = path;
    this.id = path.split('/').at(-1);
  }

  collection(id) {
    return new MemoryCollection(this.db, `${this.path}/${id}`);
  }

  async get() {
    await Promise.resolve();
    return new MemorySnapshot(this, this.db.docs.get(this.path));
  }

  async set(data, options) {
    await Promise.resolve();
    this.db.write(this.path, data, options);
  }

  async create(data) {
    await Promise.resolve();
    if (this.db.docs.has(this.path)) throw new Error(`document already exists: ${this.path}`);
    this.db.write(this.path, data);
  }

  async update(data) {
    await this.set(data, { merge: true });
  }

  async delete() {
    await Promise.resolve();
    this.db.remove(this.path);
  }
}

class MemoryQuery {
  constructor(db, path, filters = [], limitCount) {
    this.db = db;
    this.path = path;
    this.filters = filters;
    this.limitCount = limitCount;
  }

  where(field, op, value) {
    if (op !== '==') throw new Error(`memory firestore only supports ==, got ${op}`);
    return new MemoryQuery(this.db, this.path, [...this.filters, { field: String(field), value }], this.limitCount);
  }

  limit(count) {
    return new MemoryQuery(this.db, this.path, this.filters, count);
  }

  async get() {
    await Promise.resolve();
    const prefix = `${this.path}/`;
    const docs = [];
    for (const [path, data] of this.db.docs) {
      if (!path.startsWith(prefix) || path.slice(prefix.length).includes('/')) continue;
      if (!this.filters.every(({ field, value }) => data[field] === value)) continue;
      docs.push(new MemorySnapshot(new MemoryDocRef(this.db, path), data));
      if (this.limitCount && docs.length >= this.limitCount) break;
    }
    return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn) => docs.forEach(fn) };
  }
}

class MemoryCollection extends MemoryQuery {
  doc(id) {
    return new MemoryDocRef(this.db, `${this.path}/${id}`);
  }
}

export class MemoryFirestore {
  constructor() {
    this.reset();
  }

  reset() {
    this.docs = new Map();
    this.versions = new Map();
  }

  collection(path) {
    return new MemoryCollection(this, path);
  }

  write(path, data, options) {
    const base = options?.merge ? { ...(this.docs.get(path) || {}) } : {};
    for (const [key, value] of Object.entries(data)) {
      if (isDeleteTransform(value)) delete base[key];
      else base[key] = stored(value);
    }
    this.docs.set(path, base);
    this.versions.set(path, (this.versions.get(path) || 0) + 1);
  }

  remove(path) {
    this.docs.delete(path);
    this.versions.set(path, (this.versions.get(path) || 0) + 1);
  }

  // Optimistic like LocalDB: reads are versioned, and a commit whose reads
  // changed underneath it retries the whole callback.
  async runTransaction(callback) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reads = new Map();
      const operations = [];
      const transaction = {
        get: async (ref) => {
          const snapshot = await ref.get();
          reads.set(ref.path, this.versions.get(ref.path) || 0);
          return snapshot;
        },
        set: (ref, data, options) => { operations.push(() => this.write(ref.path, data, options)); return transaction; },
        update: (ref, data) => { operations.push(() => this.write(ref.path, data, { merge: true })); return transaction; },
        create: (ref, data) => {
          operations.push(() => {
            if (this.docs.has(ref.path)) throw new Error(`document already exists: ${ref.path}`);
            this.write(ref.path, data);
          });
          return transaction;
        },
        delete: (ref) => { operations.push(() => this.remove(ref.path)); return transaction; },
      };
      const result = await callback(transaction);
      const conflict = [...reads].some(([path, version]) => (this.versions.get(path) || 0) !== version);
      if (conflict) continue;
      for (const operation of operations) operation();
      return result;
    }
    throw new Error('transaction conflict');
  }

  /** Every document in a root collection, for assertions. */
  all(collection) {
    const prefix = `${collection}/`;
    return [...this.docs]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([path, data]) => ({ id: path.slice(prefix.length), data: structuredClone(data) }));
  }
}
