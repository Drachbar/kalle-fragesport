import nodemailer from "nodemailer";
import { createLogger } from "../logging/logger";

const log = createLogger("contact-mailer");

/** Ett kontaktmeddelande som ska skickas vidare som e-post. */
export interface ContactEmail {
  to: string;
  fromName: string;
  fromEmail: string;
  message: string;
}

export type SendContactEmail = (email: ContactEmail) => Promise<void>;

/** Deps som kontaktroutern behöver: hur mejl skickas och till vem. */
export interface ContactConfig {
  sendContactEmail: SendContactEmail;
  recipient: string;
}

/** Loggar i stället för att skicka – används lokalt/när SMTP saknas. */
const noopSender: SendContactEmail = async (email) => {
  log.info("SMTP inte konfigurerat – kontaktmeddelande loggas endast", {
    to: email.to,
    fromName: email.fromName,
    fromEmail: email.fromEmail,
    message: email.message,
  });
};

/**
 * Bygger kontaktkonfigurationen från miljövariabler. Utan SMTP_HOST loggas
 * meddelandena i stället för att skickas, så att utveckling fungerar utan en
 * riktig mejlserver. Mottagaren styrs av CONTACT_TO (faller tillbaka på
 * SMTP_FROM om den inte är satt).
 */
export function createContactConfig(): ContactConfig {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM ?? "";
  const recipient = process.env.CONTACT_TO ?? from;

  if (!host) {
    return { sendContactEmail: noopSender, recipient };
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const sendContactEmail: SendContactEmail = async (email) => {
    await transport.sendMail({
      from,
      to: email.to,
      replyTo: email.fromEmail,
      subject: `Kontaktformulär från Kalle Frågesport: ${email.fromName}`,
      text:
        `Avsändare: ${email.fromName}\n` +
        `E-post: ${email.fromEmail}\n\n` +
        `Meddelande:\n${email.message}`,
    });
  };

  return { sendContactEmail, recipient };
}
