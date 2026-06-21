import { describe, it, expect, beforeEach } from "vitest";
import {
  registerUser,
  loginUser,
  EmailAlreadyInUseError,
} from "./auth.service";
import { hashPassword } from "./password";
import type { UsersRepository } from "../users/users.repository";
import type { NewUser, User } from "../users/users.types";

/** Enkel in-memory-repository för tester (ingen databas). */
function createFakeRepo(initial: User[] = []): UsersRepository {
  const users = [...initial];
  return {
    async createUser({ email, passwordHash, role = "user" }: NewUser) {
      const user: User = {
        id: `id-${users.length + 1}`,
        email: email.toLowerCase(),
        passwordHash,
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.push(user);
      return user;
    },
    async findUserByEmail(email: string) {
      return users.find((u) => u.email === email.toLowerCase()) ?? null;
    },
    async findUserById(id: string) {
      return users.find((u) => u.id === id) ?? null;
    },
  };
}

describe("auth.service", () => {
  let repo: UsersRepository;

  beforeEach(() => {
    repo = createFakeRepo();
  });

  describe("registerUser", () => {
    it("skapar en användare med roll 'user' och hashat lösenord", async () => {
      const user = await registerUser("Ny@Post.se", "hemligt123", repo);

      expect(user.email).toBe("ny@post.se");
      expect(user.role).toBe("user");
      expect(user.passwordHash).not.toBe("hemligt123");
    });

    it("kastar EmailAlreadyInUseError om e-posten redan finns", async () => {
      await registerUser("dubbel@post.se", "hemligt123", repo);

      await expect(
        registerUser("Dubbel@post.se", "annat123", repo),
      ).rejects.toBeInstanceOf(EmailAlreadyInUseError);
    });
  });

  describe("loginUser", () => {
    it("returnerar användaren vid korrekt lösenord", async () => {
      const seeded = createFakeRepo([
        {
          id: "id-1",
          email: "kalle@post.se",
          passwordHash: await hashPassword("hemligt123"),
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const user = await loginUser("kalle@post.se", "hemligt123", seeded);

      expect(user?.id).toBe("id-1");
      expect(user?.role).toBe("admin");
    });

    it("returnerar null vid fel lösenord", async () => {
      const seeded = createFakeRepo([
        {
          id: "id-1",
          email: "kalle@post.se",
          passwordHash: await hashPassword("hemligt123"),
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await expect(
        loginUser("kalle@post.se", "fel", seeded),
      ).resolves.toBeNull();
    });

    it("returnerar null om användaren inte finns", async () => {
      await expect(
        loginUser("finns-inte@post.se", "hemligt123", repo),
      ).resolves.toBeNull();
    });
  });
});
