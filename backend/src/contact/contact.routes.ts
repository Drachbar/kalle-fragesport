import { Router } from "express";
import { z } from "zod";
import { createLogger } from "../logging/logger";
import { createContactConfig, type ContactConfig } from "./mailer";

const log = createLogger("contact");

const contactSchema = z.object({
  name: z.string(),
  email: z.string(),
  message: z.string(),
  website: z.string().optional(), // honeypot
});

export type ContactRouterDeps = ContactConfig;

export function createContactRouter(
  deps: ContactRouterDeps = createContactConfig(),
): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ogiltig förfrågan" });
      return;
    }

    // Honeypot: en bot som fyllt i det dolda fältet får ett tyst OK.
    if (parsed.data.website && parsed.data.website.trim() !== "") {
      res.status(204).end();
      return;
    }

    const name = parsed.data.name.trim();
    const email = parsed.data.email.trim();
    const message = parsed.data.message.trim();

    if (!name || !email || !email.includes("@") || !message) {
      res.status(400).json({ error: "Namn, e-post och meddelande krävs" });
      return;
    }

    try {
      await deps.sendContactEmail({
        to: deps.recipient,
        fromName: name,
        fromEmail: email,
        message,
      });
      res.status(204).end();
    } catch (err) {
      log.error("Kunde inte skicka kontaktmeddelande", { err });
      res.status(500).json({ error: "Kunde inte skicka meddelandet" });
    }
  });

  return router;
}
