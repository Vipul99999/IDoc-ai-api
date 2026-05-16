import { promises as fs } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { DATA_ROOT } from "@/lib/config";
import { AuthUser } from "@/lib/auth/jwt";
import { getPostgresPool, isPostgresEnabled } from "@/lib/storage/postgres";

export type StoredAuthUser = AuthUser & {
  passwordHash: string;
  status: "active" | "invited" | "disabled";
  createdAt: string;
  oauthProvider?: "google";
  oauthSubject?: string;
  avatarUrl?: string;
  lastLoginAt?: string;
};

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000002";
const USERS_PATH = path.join(DATA_ROOT, "settings", "users.json");

async function defaultOwner(): Promise<StoredAuthUser> {
  return {
    id: DEMO_USER_ID,
    organizationId: DEMO_ORG_ID,
    email: "owner@intellidoc.local",
    name: "Demo Owner",
    role: "owner",
    passwordHash: await bcrypt.hash("password", 10),
    status: "active",
    createdAt: new Date().toISOString()
  };
}

async function readLocalUsers() {
  await fs.mkdir(path.dirname(USERS_PATH), { recursive: true });
  try {
    return JSON.parse(await fs.readFile(USERS_PATH, "utf8")) as StoredAuthUser[];
  } catch {
    const users = [await defaultOwner()];
    await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2));
    return users;
  }
}

async function writeLocalUsers(users: StoredAuthUser[]) {
  await fs.mkdir(path.dirname(USERS_PATH), { recursive: true });
  await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2));
}

async function ensurePostgresOwner() {
  const db = getPostgresPool();
  if (!db) return;
  const passwordHash = await bcrypt.hash("password", 10);
  await db.query(
    `
    INSERT INTO users (id, organization_id, email, name, role, password_hash, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'active')
    ON CONFLICT (email) DO NOTHING
    `,
    [DEMO_USER_ID, DEMO_ORG_ID, "owner@intellidoc.local", "Demo Owner", "owner", passwordHash]
  );
}

function rowToUser(row: Record<string, string>): StoredAuthUser {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    name: row.name,
    role: row.role as AuthUser["role"],
    passwordHash: row.password_hash ?? "",
    status: row.status as StoredAuthUser["status"],
    createdAt: new Date(row.created_at).toISOString(),
    oauthProvider: row.oauth_provider === "google" ? "google" : undefined,
    oauthSubject: row.oauth_subject ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : undefined
  };
}

function defaultOAuthRole(): AuthUser["role"] {
  const configured = process.env.GOOGLE_DEFAULT_ROLE as AuthUser["role"] | undefined;
  if (configured && ["owner", "admin", "analyst", "viewer"].includes(configured)) return configured;
  return process.env.NODE_ENV === "production" ? "viewer" : "owner";
}

export async function findUserByEmail(email: string) {
  const normalized = email.toLowerCase();
  if (isPostgresEnabled()) {
    await ensurePostgresOwner();
    const db = getPostgresPool();
    const result = await db?.query("SELECT * FROM users WHERE lower(email) = $1 AND status = 'active' LIMIT 1", [normalized]);
    return result?.rows[0] ? rowToUser(result.rows[0]) : null;
  }
  const users = await readLocalUsers();
  return users.find((user) => user.email.toLowerCase() === normalized && user.status === "active") ?? null;
}

export async function listAuthUsers() {
  if (isPostgresEnabled()) {
    await ensurePostgresOwner();
    const db = getPostgresPool();
    const result = await db?.query("SELECT * FROM users ORDER BY created_at DESC");
    return result?.rows.map(rowToUser) ?? [];
  }
  return readLocalUsers();
}

export async function createAuthUser(input: {
  organizationId?: string;
  email: string;
  name: string;
  role: AuthUser["role"];
  password?: string;
}) {
  const now = new Date().toISOString();
  const user: StoredAuthUser = {
    id: uuidv4(),
    organizationId: input.organizationId ?? DEMO_ORG_ID,
    email: input.email.toLowerCase(),
    name: input.name,
    role: input.role,
    passwordHash: await bcrypt.hash(input.password ?? uuidv4(), 10),
    status: "active",
    createdAt: now
  };

  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    await db?.query(
      `
      INSERT INTO users (id, organization_id, email, name, role, password_hash, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [user.id, user.organizationId, user.email, user.name, user.role, user.passwordHash, user.status, user.createdAt]
    );
    return user;
  }

  const users = await readLocalUsers();
  users.push(user);
  await writeLocalUsers(users);
  return user;
}

export async function upsertOAuthUser(input: {
  provider: "google";
  providerSubject: string;
  email: string;
  name: string;
  avatarUrl?: string;
}) {
  const email = input.email.toLowerCase();
  const now = new Date().toISOString();
  const existing = await findUserByEmail(email);

  if (isPostgresEnabled()) {
    const db = getPostgresPool();
    if (existing) {
      const result = await db?.query(
        `
        UPDATE users
        SET name = $2,
            oauth_provider = $3,
            oauth_subject = $4,
            avatar_url = $5,
            last_login_at = $6
        WHERE id = $1
        RETURNING *
        `,
        [existing.id, input.name || existing.name, input.provider, input.providerSubject, input.avatarUrl ?? null, now]
      );
      return result?.rows[0] ? rowToUser(result.rows[0]) : existing;
    }

    const user: StoredAuthUser = {
      id: uuidv4(),
      organizationId: DEMO_ORG_ID,
      email,
      name: input.name || email.split("@")[0],
      role: defaultOAuthRole(),
      passwordHash: "",
      status: "active",
      createdAt: now,
      oauthProvider: input.provider,
      oauthSubject: input.providerSubject,
      avatarUrl: input.avatarUrl,
      lastLoginAt: now
    };
    const result = await db?.query(
      `
      INSERT INTO users (id, organization_id, email, name, role, password_hash, status, created_at, oauth_provider, oauth_subject, avatar_url, last_login_at)
      VALUES ($1, $2, $3, $4, $5, '', 'active', $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [user.id, user.organizationId, user.email, user.name, user.role, user.createdAt, user.oauthProvider, user.oauthSubject, user.avatarUrl ?? null, user.lastLoginAt]
    );
    return result?.rows[0] ? rowToUser(result.rows[0]) : user;
  }

  const users = await readLocalUsers();
  const existingIndex = users.findIndex((user) => user.email.toLowerCase() === email);
  if (existingIndex >= 0) {
    users[existingIndex] = {
      ...users[existingIndex],
      name: input.name || users[existingIndex].name,
      oauthProvider: input.provider,
      oauthSubject: input.providerSubject,
      avatarUrl: input.avatarUrl,
      lastLoginAt: now
    };
    await writeLocalUsers(users);
    return users[existingIndex];
  }

  const user: StoredAuthUser = {
    id: uuidv4(),
    organizationId: DEMO_ORG_ID,
    email,
    name: input.name || email.split("@")[0],
    role: defaultOAuthRole(),
    passwordHash: "",
    status: "active",
    createdAt: now,
    oauthProvider: input.provider,
    oauthSubject: input.providerSubject,
    avatarUrl: input.avatarUrl,
    lastLoginAt: now
  };
  users.push(user);
  await writeLocalUsers(users);
  return user;
}

export function publicUser(user: StoredAuthUser) {
  const { passwordHash, ...safe } = user;
  void passwordHash;
  return safe;
}
