import type { Role } from "../db/schema";

export interface SeedAccount {
  username: string;
  displayName: string;
  password: string;
  role: Role;
}

/**
 * Accounts created on first boot. There is deliberately no registration flow:
 * the only way to add a user is to edit this list and re-seed.
 *
 * Defaults are intentionally simple for a local study group. Override the
 * admin password with ADMIN_PASSWORD before the first production boot.
 */
export function seedAccounts(): SeedAccount[] {
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "admin";

  return [
    ...Array.from({ length: 5 }, (_, i) => {
      const n = i + 1;
      return {
        username: `user${n}`,
        displayName: `User ${n}`,
        password: `test${n}`,
        role: "user" as const,
      };
    }),
    {
      username: "admin",
      displayName: "Administrator",
      password: adminPassword,
      role: "admin" as const,
    },
  ];
}
