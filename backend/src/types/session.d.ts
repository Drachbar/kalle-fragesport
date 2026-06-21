import "express-session";
import type { Role } from "../users/users.types";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    role?: Role;
  }
}
