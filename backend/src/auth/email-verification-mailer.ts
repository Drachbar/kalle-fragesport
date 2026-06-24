import nodemailer from "nodemailer";
import { createLogger } from "../logging/logger";

const log = createLogger("email-verification");

export type SendVerificationEmail = (
  email: string,
  token: string,
) => Promise<void>;

export interface EmailVerificationConfig {
  sendVerificationEmail: SendVerificationEmail;
}

function getAppPublicUrl(): string {
  const url = process.env.APP_PUBLIC_URL;
  if (url) {
    return url.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_PUBLIC_URL måste sättas i produktion");
  }
  return "http://localhost:4200";
}

function buildVerificationUrl(token: string): string {
  const url = new URL("/verify-email", getAppPublicUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

export function createEmailVerificationConfig(): EmailVerificationConfig {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM ?? "";

  if (!host) {
    return {
      sendVerificationEmail: async (email, token) => {
        log.info("SMTP inte konfigurerat – verifieringslänk loggas endast", {
          email,
          verificationUrl: buildVerificationUrl(token),
        });
      },
    };
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

  return {
    sendVerificationEmail: async (email, token) => {
      const verificationUrl = buildVerificationUrl(token);
      await transport.sendMail({
        from,
        to: email,
        subject: "Verifiera din e-postadress för Kalle Frågesport",
        text:
          "Hej!\n\n" +
          "Klicka på länken för att aktivera ditt konto:\n" +
          `${verificationUrl}\n\n` +
          "Länken gäller i 24 timmar.",
      });
    },
  };
}
