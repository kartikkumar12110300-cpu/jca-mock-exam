import type { Role } from "../db/schema";

/** The minimum identity a data-layer function needs to authorize a read. */
export interface Viewer {
  id: string;
  role: Role;
}

export function canReadUser(viewer: Viewer, ownerId: string): boolean {
  return viewer.id === ownerId || viewer.role === "admin";
}
