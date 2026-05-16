import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { permissionsForRole, signSession } from "@/lib/auth/jwt";
import { findUserByEmail, publicUser } from "@/lib/auth/users";
import { badRequest, json } from "@/lib/http";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest("Valid email and password are required.");
  const user = await findUserByEmail(body.data.email);
  if (!user) return json({ error: "Invalid credentials" }, 401);
  const passwordOk = await bcrypt.compare(body.data.password, user.passwordHash);
  if (!passwordOk) return json({ error: "Invalid credentials" }, 401);
  const safeUser = publicUser(user);

  return json({
    token: signSession(safeUser),
    user: { ...safeUser, permissions: permissionsForRole(safeUser.role), sessionId: uuidv4() },
    expiresIn: 3600
  });
}
