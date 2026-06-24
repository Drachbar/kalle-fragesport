export type Role = "user" | "admin";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUser {
  email: string;
  passwordHash: string;
  role?: Role;
}
