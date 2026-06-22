import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../auth/middleware";
import {
  openAiKeysRepository,
  type OpenAiKeysRepository,
} from "../users/openai-keys.repository";
import { encryptSecret } from "../security/crypto";
import { createLogger } from "../logging/logger";

const log = createLogger("settings");

const apiKeySchema = z.object({
  // OpenAI-nycklar börjar med "sk-". Endast format-koll, inget testanrop.
  apiKey: z
    .string()
    .trim()
    .min(1)
    .refine((value) => value.startsWith("sk-"), {
      message: "Ogiltig OpenAI-nyckel",
    }),
});

export interface SettingsRouterDeps {
  keysRepo: Pick<
    OpenAiKeysRepository,
    "setKey" | "getEncryptedKey" | "deleteKey"
  >;
  encrypt: (plaintext: string) => string;
  isEnvKeyPresent: () => boolean;
}

const defaultDeps: SettingsRouterDeps = {
  keysRepo: openAiKeysRepository,
  encrypt: (plaintext) => encryptSecret(plaintext),
  isEnvKeyPresent: () => Boolean(process.env.OPENAI_API_KEY),
};

export function createSettingsRouter(
  deps: SettingsRouterDeps = defaultDeps,
): Router {
  const { keysRepo, encrypt, isEnvKeyPresent } = deps;
  const router = Router();

  // Status: om en delad env-nyckel finns och om den inloggade adminen har en
  // egen sparad nyckel. Själva nyckeln returneras aldrig.
  router.get("/openai-key", requireAdmin, async (req, res) => {
    const userId = req.session.userId as string;
    const stored = await keysRepo.getEncryptedKey(userId);
    res.json({
      envKeyPresent: isEnvKeyPresent(),
      userKeySet: stored !== null,
    });
  });

  // Spara/uppdatera adminens egna OpenAI-nyckel (krypterad).
  router.put("/openai-key", requireAdmin, async (req, res) => {
    const parsed = apiKeySchema.safeParse(req.body);
    if (!parsed.success) {
      const userId = req.session.userId as string;
      log.warn("Avvisar nyckel: ogiltigt format", { userId });
      res.status(400).json({ error: "Ogiltig OpenAI-nyckel" });
      return;
    }

    const userId = req.session.userId as string;
    await keysRepo.setKey(userId, encrypt(parsed.data.apiKey));
    log.info("OpenAI-nyckel sparad för användare", {
      userId,
      keySuffix: parsed.data.apiKey.slice(-4),
    });
    res.status(204).end();
  });

  // Ta bort adminens egna nyckel.
  router.delete("/openai-key", requireAdmin, async (req, res) => {
    const userId = req.session.userId as string;
    await keysRepo.deleteKey(userId);
    log.info("OpenAI-nyckel borttagen för användare", { userId });
    res.status(204).end();
  });

  return router;
}
