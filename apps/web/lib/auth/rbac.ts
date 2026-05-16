import { AuthUser, permissionsForRole } from "@/lib/auth/jwt";

export function can(user: AuthUser, permission: string) {
  const permissions = permissionsForRole(user.role);
  return permissions.includes("*") || permissions.includes(permission) || permissions.some((item) => item.endsWith(":*") && permission.startsWith(item.slice(0, -1)));
}

export function requirePermission(user: AuthUser, permission: string) {
  if (!can(user, permission)) {
    throw new Error(`Forbidden: missing ${permission}`);
  }
}
