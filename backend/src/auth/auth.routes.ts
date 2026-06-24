import { Router } from "express";
import { z } from "zod";
import {
  registerUser as defaultRegisterUser,
  loginUser as defaultLoginUser,
  changePassword as defaultChangePassword,
  deleteAccount as defaultDeleteAccount,
  EmailAlreadyInUseError,
  InvalidPasswordError,
} from "./auth.service";
import { requireAuth } from "./middleware";
import { DbSessionStore } from "./session-store";
import { usersRepository } from "../users/users.repository";
import { createLogger } from "../logging/logger";

const log = createLogger("auth");

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

export interface AuthRouterDeps {
  registerUser: typeof defaultRegisterUser;
  loginUser: typeof defaultLoginUser;
  findUserById: typeof usersRepository.findUserById;
  changePassword: (
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  deleteAccount: (userId: string, password: string) => Promise<void>;
  /** Raderar användarens sessioner; med exceptSid behålls den nuvarande. */
  destroyUserSessions: (userId: string, exceptSid?: string) => Promise<void>;
}

const defaultDeps: AuthRouterDeps = {
  registerUser: defaultRegisterUser,
  loginUser: defaultLoginUser,
  findUserById: (id) => usersRepository.findUserById(id),
  changePassword: (userId, currentPassword, newPassword) =>
    defaultChangePassword(userId, currentPassword, newPassword),
  deleteAccount: (userId, password) => defaultDeleteAccount(userId, password),
  destroyUserSessions: (userId, exceptSid) =>
    new DbSessionStore().destroyAllForUser(userId, exceptSid),
};

export function createAuthRouter(deps: AuthRouterDeps = defaultDeps): Router {
  const router = Router();

  router.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ogiltiga uppgifter" });
      return;
    }

    try {
      const user = await deps.registerUser(
        parsed.data.email,
        parsed.data.password,
      );
      log.info("Ny användare registrerad", { userId: user.id, email: user.email });
      res.status(201).json({ id: user.id, email: user.email, role: user.role });
    } catch (err) {
      if (err instanceof EmailAlreadyInUseError) {
        log.warn("Registrering avvisad: e-post upptagen", {
          email: parsed.data.email,
        });
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ogiltiga uppgifter" });
      return;
    }

    const user = await deps.loginUser(parsed.data.email, parsed.data.password);
    if (!user) {
      log.warn("Misslyckad inloggning", { email: parsed.data.email });
      // Generiskt fel för att inte avslöja om e-posten finns.
      res.status(401).json({ error: "Fel e-post eller lösenord" });
      return;
    }
    log.info("Lyckad inloggning", { userId: user.id, role: user.role });

    // Mot session fixation: ny session-id vid inloggning.
    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ error: "Kunde inte skapa session" });
        return;
      }
      req.session.userId = user.id;
      req.session.role = user.role;
      res.status(200).json({ id: user.id, email: user.email, role: user.role });
    });
  });

  router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ error: "Kunde inte logga ut" });
        return;
      }
      res.clearCookie("connect.sid");
      res.status(204).end();
    });
  });

  // Aktuell inloggad användare – låter frontend återställa auth-state efter
  // sidladdning (cookien är httpOnly och kan inte läsas i JS).
  router.get("/me", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ error: "Inte inloggad" });
      return;
    }

    const user = await deps.findUserById(userId);
    if (!user) {
      // Sessionen pekar på en borttagen användare – städa upp.
      req.session.destroy(() => undefined);
      res.status(401).json({ error: "Inte inloggad" });
      return;
    }

    res.json({ id: user.id, email: user.email, role: user.role });
  });

  // Byt lösenord. Kräver inloggning + korrekt nuvarande lösenord.
  router.put("/me/password", requireAuth, async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ogiltiga uppgifter" });
      return;
    }

    try {
      await deps.changePassword(
        req.session.userId!,
        parsed.data.currentPassword,
        parsed.data.newPassword,
      );
    } catch (err) {
      if (err instanceof InvalidPasswordError) {
        res.status(403).json({ error: "Fel nuvarande lösenord" });
        return;
      }
      throw err;
    }

    // Logga ut alla andra enheter, men behåll den nuvarande sessionen.
    await deps.destroyUserSessions(req.session.userId!, req.sessionID);
    log.info("Lösenord ändrat", { userId: req.session.userId });
    res.status(204).end();
  });

  // Logga ut från alla enheter (inklusive den nuvarande).
  router.post("/logout-all", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    // Rensa övriga sessioner i databasen ...
    await deps.destroyUserSessions(userId, req.sessionID);
    // ... och avsluta den nuvarande på rätt sätt (rör cookie + minne).
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ error: "Kunde inte logga ut" });
        return;
      }
      res.clearCookie("connect.sid");
      log.info("Utloggad från alla enheter", { userId });
      res.status(204).end();
    });
  });

  // Radera kontot. Kräver inloggning + korrekt lösenord. Loggar ut efteråt.
  router.delete("/me", requireAuth, async (req, res) => {
    const parsed = deleteAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ogiltiga uppgifter" });
      return;
    }

    const userId = req.session.userId!;
    try {
      await deps.deleteAccount(userId, parsed.data.password);
    } catch (err) {
      if (err instanceof InvalidPasswordError) {
        res.status(403).json({ error: "Fel lösenord" });
        return;
      }
      throw err;
    }

    log.info("Konto raderat", { userId });
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ error: "Kontot raderades men utloggning misslyckades" });
        return;
      }
      res.clearCookie("connect.sid");
      res.status(204).end();
    });
  });

  return router;
}
