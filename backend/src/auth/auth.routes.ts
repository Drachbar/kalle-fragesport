import { Router } from "express";
import { z } from "zod";
import {
  registerUser as defaultRegisterUser,
  loginUser as defaultLoginUser,
  EmailAlreadyInUseError,
} from "./auth.service";
import { usersRepository } from "../users/users.repository";

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export interface AuthRouterDeps {
  registerUser: typeof defaultRegisterUser;
  loginUser: typeof defaultLoginUser;
  findUserById: typeof usersRepository.findUserById;
}

const defaultDeps: AuthRouterDeps = {
  registerUser: defaultRegisterUser,
  loginUser: defaultLoginUser,
  findUserById: (id) => usersRepository.findUserById(id),
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
      res.status(201).json({ id: user.id, email: user.email, role: user.role });
    } catch (err) {
      if (err instanceof EmailAlreadyInUseError) {
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
      // Generiskt fel för att inte avslöja om e-posten finns.
      res.status(401).json({ error: "Fel e-post eller lösenord" });
      return;
    }

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

  return router;
}
