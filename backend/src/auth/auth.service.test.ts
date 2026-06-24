import { describe, it, expect, beforeEach } from "vitest";
import {
  registerUser,
  loginUser,
  changePassword,
  deleteAccount,
  EmailAlreadyInUseError,
  EmailNotVerifiedError,
  InvalidPasswordError,
} from "./auth.service";
import { hashPassword, verifyPassword } from "./password";
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
        emailVerifiedAt: null,
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
    async updatePassword(id: string, passwordHash: string) {
      const user = users.find((u) => u.id === id);
      if (user) {
        user.passwordHash = passwordHash;
      }
    },
    async deleteUser(id: string) {
      const i = users.findIndex((u) => u.id === id);
      if (i !== -1) {
        users.splice(i, 1);
      }
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
          emailVerifiedAt: new Date(),
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
          emailVerifiedAt: new Date(),
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

    it("kastar EmailNotVerifiedError när lösenordet stämmer men e-posten inte är verifierad", async () => {
      const seeded = createFakeRepo([
        {
          id: "id-1",
          email: "ny@post.se",
          passwordHash: await hashPassword("hemligt123"),
          role: "user",
          emailVerifiedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await expect(
        loginUser("ny@post.se", "hemligt123", seeded),
      ).rejects.toBeInstanceOf(EmailNotVerifiedError);
    });
  });

  async function seedOneUser(): Promise<UsersRepository> {
    return createFakeRepo([
      {
        id: "id-1",
        email: "kalle@post.se",
        passwordHash: await hashPassword("nuvarande123"),
        role: "user",
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  }

  describe("changePassword", () => {
    it("byter lösenord när nuvarande lösenord stämmer", async () => {
      const seeded = await seedOneUser();

      await changePassword("id-1", "nuvarande123", "nyttlosen456", seeded);

      const user = await seeded.findUserById("id-1");
      expect(await verifyPassword("nyttlosen456", user!.passwordHash)).toBe(
        true,
      );
      expect(await verifyPassword("nuvarande123", user!.passwordHash)).toBe(
        false,
      );
    });

    it("kastar InvalidPasswordError vid fel nuvarande lösenord", async () => {
      const seeded = await seedOneUser();

      await expect(
        changePassword("id-1", "felaktigt", "nyttlosen456", seeded),
      ).rejects.toBeInstanceOf(InvalidPasswordError);

      // Lösenordet ska vara oförändrat.
      const user = await seeded.findUserById("id-1");
      expect(await verifyPassword("nuvarande123", user!.passwordHash)).toBe(
        true,
      );
    });

    it("kastar InvalidPasswordError om användaren saknas", async () => {
      await expect(
        changePassword("saknas", "nuvarande123", "nyttlosen456", repo),
      ).rejects.toBeInstanceOf(InvalidPasswordError);
    });
  });

  describe("deleteAccount", () => {
    it("raderar kontot när lösenordet stämmer", async () => {
      const seeded = await seedOneUser();

      await deleteAccount("id-1", "nuvarande123", seeded);

      expect(await seeded.findUserById("id-1")).toBeNull();
    });

    it("kastar InvalidPasswordError vid fel lösenord och behåller kontot", async () => {
      const seeded = await seedOneUser();

      await expect(
        deleteAccount("id-1", "felaktigt", seeded),
      ).rejects.toBeInstanceOf(InvalidPasswordError);

      expect(await seeded.findUserById("id-1")).not.toBeNull();
    });
  });
});
