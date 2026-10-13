type LocalDocumentPayload = {
  path: string;
  data?: Record<string, unknown>;
  hash?: string;
};

type LocalSnapshotPayload = { document?: LocalDocumentPayload };

function transformValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(transformValue);
  if (!value || typeof value !== "object") return value;

  const object = value as Record<string, unknown>;
  const name = (value as { constructor?: { name?: string } }).constructor?.name || "";
  if (name === "NumericIncrementTransform") {
    return { __localdb_transform__: "increment", value: object.operand };
  }
  if (name === "ArrayUnionTransform") {
    return { __localdb_transform__: "array_union", values: object.elements };
  }
  if (name === "ArrayRemoveTransform") {
    return { __localdb_transform__: "array_remove", values: object.elements };
  }
  if (name === "DeleteTransform") return { __localdb_transform__: "delete" };
  if (name === "ServerTimestampTransform") {
    return { __localdb_transform__: "server_timestamp" };
  }
  if (value instanceof Date) return value.toISOString();
  return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, transformValue(item)]));
}

function encodePath(path: string): string {
  return encodeURIComponent(path);
}

// Trace passes firebase-admin FieldPath objects (e.g. FieldPath.documentId())
// into where()/orderBy(). They stringify to '__name__', so normalise here.
function normalizeField(field: unknown): string {
  return typeof field === "string" ? field : String(field);
}

export class LocalDocumentSnapshot {
  readonly id: string;
  readonly exists: boolean;
  readonly ref: LocalDocumentReference;
  private readonly payload: LocalDocumentPayload;

  constructor(ref: LocalDocumentReference, payload?: LocalDocumentPayload) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = Boolean(payload);
    this.payload = payload || { path: ref.path };
  }

  data(): Record<string, unknown> | undefined {
    return this.payload.data;
  }
}

export class LocalQuerySnapshot {
  readonly docs: LocalDocumentSnapshot[];

  constructor(docs: LocalDocumentSnapshot[]) {
    this.docs = docs;
  }

  get empty(): boolean {
    return this.docs.length === 0;
  }

  get size(): number {
    return this.docs.length;
  }

  forEach(callback: (doc: LocalDocumentSnapshot) => void): void {
    this.docs.forEach(callback);
  }
}

type QueryFilter = { field: string; op: string; value: unknown };
type QueryOrder = { field: string; direction: string };

export class LocalDocumentReference {
  readonly id: string;

  constructor(private readonly client: LocalFirestore, readonly path: string) {
    this.id = path.split("/").at(-1) || "";
  }

  collection(collectionId: string): LocalCollectionReference {
    return new LocalCollectionReference(this.client, `${this.path}/${collectionId}`);
  }

  async get(): Promise<LocalDocumentSnapshot> {
    const response = await this.client.request(`/documents/${encodePath(this.path)}`);
    if (response.status === 404) return new LocalDocumentSnapshot(this);
    if (!response.ok) throw new Error(`LocalDB read failed (${response.status})`);
    return new LocalDocumentSnapshot(this, await response.json().then((body: LocalSnapshotPayload) => body.document));
  }

  async set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<void> {
    await this.client.write(`/documents/${encodePath(this.path)}`, {
      method: "PUT",
      body: { data: transformValue(data), merge: Boolean(options?.merge) },
    });
  }

  async create(data: Record<string, unknown>): Promise<void> {
    await this.client.write(`/documents/${encodePath(this.path)}`, {
      method: "PUT",
      body: { data: transformValue(data), create: true },
    });
  }

  async update(data: Record<string, unknown>): Promise<void> {
    await this.set(data, { merge: true });
  }

  async delete(): Promise<void> {
    await this.client.write(`/documents/${encodePath(this.path)}`, { method: "DELETE" });
  }
}

export class LocalQuery {
  constructor(
    protected readonly client: LocalFirestore,
    readonly collectionPath: string,
    protected readonly filters: QueryFilter[] = [],
    protected readonly orders: QueryOrder[] = [],
    protected readonly limitCount?: number,
    protected readonly selected?: string[],
    protected readonly group = false,
  ) {}

  where(field: string, op: string, value: unknown): LocalQuery {
    return new LocalQuery(this.client, this.collectionPath, [...this.filters, { field: normalizeField(field), op, value: transformValue(value) }], this.orders, this.limitCount, this.selected, this.group);
  }

  orderBy(field: string, direction = "ASCENDING"): LocalQuery {
    return new LocalQuery(this.client, this.collectionPath, this.filters, [...this.orders, { field: normalizeField(field), direction }], this.limitCount, this.selected, this.group);
  }

  limit(count: number): LocalQuery {
    return new LocalQuery(this.client, this.collectionPath, this.filters, this.orders, count, this.selected, this.group);
  }

  // Firestore's admin SDK takes `select('a', 'b')`; callers written against it
  // (daily-archive, daily-editions) must not send a bare string to /query.
  select(...fields: Array<string | string[]>): LocalQuery {
    return new LocalQuery(this.client, this.collectionPath, this.filters, this.orders, this.limitCount, fields.flat(), this.group);
  }

  async get(): Promise<LocalQuerySnapshot> {
    const response = await this.client.request("/query", {
      method: "POST",
      body: {
        collection: this.collectionPath,
        collection_group: this.group,
        filters: this.filters,
        orders: this.orders,
        limit: this.limitCount,
        select: this.selected,
      },
    });
    if (!response.ok) {
      let message = `LocalDB query failed (${response.status})`;
      try {
        const errorBody = await response.json() as { error?: string };
        if (errorBody.error) message = errorBody.error;
      } catch {}
      throw new Error(message);
    }
    const body = await response.json() as { documents?: LocalDocumentPayload[] };
    return new LocalQuerySnapshot((body.documents || []).map((document) => new LocalDocumentSnapshot(
      new LocalDocumentReference(this.client, document.path),
      document,
    )));
  }

  stream(): Promise<LocalQuerySnapshot> {
    return this.get();
  }
}

export class LocalCollectionReference extends LocalQuery {
  document(documentId: string): LocalDocumentReference {
    return new LocalDocumentReference(this.client, `${this.collectionPath}/${documentId}`);
  }

  doc(documentId: string): LocalDocumentReference {
    return this.document(documentId);
  }

  async add(data: Record<string, unknown>): Promise<{ id: string; path: string }> {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    const ref = this.document(id);
    await ref.set(data);
    return ref;
  }
}

type LocalOperation = {
  op: "set" | "update" | "create" | "delete";
  path: string;
  data?: Record<string, unknown>;
  merge?: boolean;
};

export class LocalWriteBatch {
  private readonly operations: LocalOperation[] = [];

  constructor(private readonly client: LocalFirestore) {}

  set(ref: LocalDocumentReference, data: Record<string, unknown>, options?: { merge?: boolean }): this {
    this.operations.push({ op: "set", path: ref.path, data: transformValue(data) as Record<string, unknown>, merge: Boolean(options?.merge) });
    return this;
  }

  update(ref: LocalDocumentReference, data: Record<string, unknown>): this {
    this.operations.push({ op: "update", path: ref.path, data: transformValue(data) as Record<string, unknown>, merge: true });
    return this;
  }

  create(ref: LocalDocumentReference, data: Record<string, unknown>): this {
    this.operations.push({ op: "create", path: ref.path, data: transformValue(data) as Record<string, unknown> });
    return this;
  }

  delete(ref: LocalDocumentReference): this {
    this.operations.push({ op: "delete", path: ref.path });
    return this;
  }

  async commit(): Promise<void> {
    await this.client.write("/documents:batchWrite", { method: "POST", body: { operations: this.operations } });
  }
}

export class LocalTransaction {
  private readonly reads = new Map<string, string | null>();
  private readonly operations: LocalOperation[] = [];

  constructor(private readonly client: LocalFirestore) {}

  async get(ref: LocalDocumentReference): Promise<LocalDocumentSnapshot> {
    const snapshot = await ref.get();
    this.reads.set(ref.path, snapshot.exists ? ((snapshot as unknown as { payload?: { hash?: string } }).payload?.hash || null) : null);
    return snapshot;
  }

  set(ref: LocalDocumentReference, data: Record<string, unknown>, options?: { merge?: boolean }): this {
    this.operations.push({ op: "set", path: ref.path, data: transformValue(data) as Record<string, unknown>, merge: Boolean(options?.merge) });
    return this;
  }

  update(ref: LocalDocumentReference, data: Record<string, unknown>): this {
    this.operations.push({ op: "update", path: ref.path, data: transformValue(data) as Record<string, unknown>, merge: true });
    return this;
  }

  create(ref: LocalDocumentReference, data: Record<string, unknown>): this {
    this.operations.push({ op: "create", path: ref.path, data: transformValue(data) as Record<string, unknown> });
    return this;
  }

  delete(ref: LocalDocumentReference): this {
    this.operations.push({ op: "delete", path: ref.path });
    return this;
  }

  async commit(): Promise<void> {
    await this.client.write("/transactions:commit", {
      method: "POST",
      body: { reads: Object.fromEntries(this.reads), operations: this.operations },
    });
  }
}

export class LocalFirestore {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  collection(collectionPath: string): LocalCollectionReference {
    return new LocalCollectionReference(this, collectionPath);
  }

  collectionGroup(collectionId: string): LocalQuery {
    return new LocalQuery(this, collectionId, [], [], undefined, undefined, true);
  }

  private async batchGet(
    refs: LocalDocumentReference[],
    select?: string[],
  ): Promise<LocalDocumentSnapshot[]> {
    const documents = new Map<string, LocalDocumentPayload>();
    const chunkSize = select ? 500 : 100;
    for (let start = 0; start < refs.length; start += chunkSize) {
      const chunk = refs.slice(start, start + chunkSize);
      const response = await this.request("/documents:batchGet", {
        method: "POST",
        body: { paths: chunk.map((ref) => ref.path), ...(select ? { select } : {}) },
      });
      if (!response.ok) throw new Error(`LocalDB batch read failed (${response.status})`);
      const payload = await response.json() as { documents?: LocalDocumentPayload[] };
      for (const document of payload.documents || []) documents.set(document.path, document);
    }
    return refs.map((ref) => new LocalDocumentSnapshot(ref, documents.get(ref.path)));
  }

  async getAll(...refs: LocalDocumentReference[]): Promise<LocalDocumentSnapshot[]> {
    return this.batchGet(refs);
  }

  async getAllSelected(refs: LocalDocumentReference[], select: string[]): Promise<LocalDocumentSnapshot[]> {
    return this.batchGet(refs, select);
  }

  batch(): LocalWriteBatch {
    return new LocalWriteBatch(this);
  }

  async runTransaction<T>(callback: (transaction: LocalTransaction) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const transaction = new LocalTransaction(this);
      try {
        const result = await callback(transaction);
        await transaction.commit();
        return result;
      } catch (error) {
        lastError = error;
        if (!(error instanceof Error) || !error.message.includes("transaction conflict")) throw error;
      }
    }
    throw lastError;
  }

  async request(path: string, init: { method?: string; body?: unknown } = {}): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: init.method || "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    return response;
  }

  async write(path: string, init: { method: string; body?: unknown }): Promise<void> {
    const response = await this.request(path, init);
    if (response.ok) return;
    let message = `LocalDB request failed (${response.status})`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
}

export type FirestoreLike = {
  collection: (collectionPath: string) => LocalCollectionReference;
  collectionGroup: (collectionId: string) => LocalQuery;
  getAll: (...refs: LocalDocumentReference[]) => Promise<LocalDocumentSnapshot[]>;
  batch: () => LocalWriteBatch;
  runTransaction: <T>(callback: (transaction: LocalTransaction) => Promise<T>) => Promise<T>;
};

export function localFirestoreFromEnv(): LocalFirestore | null {
  const baseUrl = process.env.LOCALDB_URL?.trim().replace(/\/+$/, "");
  const token = process.env.LOCALDB_API_TOKEN?.trim();
  return baseUrl && token ? new LocalFirestore(baseUrl, token) : null;
}
