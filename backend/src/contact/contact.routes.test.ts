import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import {
  createContactRouter,
  type ContactRouterDeps,
} from "./contact.routes";

function makeDeps(over: Partial<ContactRouterDeps> = {}): ContactRouterDeps {
  return {
    sendContactEmail: vi.fn().mockResolvedValue(undefined),
    recipient: "mottagare@example.com",
    ...over,
  };
}

function makeApp(deps: ContactRouterDeps) {
  const app = express();
  app.use(express.json());
  app.use("/contact", createContactRouter(deps));
  return app;
}

const validBody = {
  name: "Anna Andersson",
  email: "anna@example.com",
  message: "Hej, jag har en fråga!",
};

describe("POST /contact", () => {
  it("skickar mejlet till den konfigurerade mottagaren → 204", async () => {
    const deps = makeDeps();
    const res = await request(makeApp(deps)).post("/contact").send(validBody);

    expect(res.status).toBe(204);
    expect(deps.sendContactEmail).toHaveBeenCalledWith({
      to: "mottagare@example.com",
      fromName: "Anna Andersson",
      fromEmail: "anna@example.com",
      message: "Hej, jag har en fråga!",
    });
  });

  it("trimmar fälten innan mejlet skickas", async () => {
    const deps = makeDeps();
    await request(makeApp(deps))
      .post("/contact")
      .send({ name: "  Anna  ", email: " anna@example.com ", message: " Hej " });

    expect(deps.sendContactEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        fromName: "Anna",
        fromEmail: "anna@example.com",
        message: "Hej",
      }),
    );
  });

  it("svarar tyst 204 utan att skicka när honeypot-fältet är ifyllt", async () => {
    const deps = makeDeps();
    const res = await request(makeApp(deps))
      .post("/contact")
      .send({ ...validBody, website: "spam-bot" });

    expect(res.status).toBe(204);
    expect(deps.sendContactEmail).not.toHaveBeenCalled();
  });

  it("svarar 400 när ett fält saknas", async () => {
    const deps = makeDeps();
    const res = await request(makeApp(deps))
      .post("/contact")
      .send({ name: "Anna", email: "anna@example.com", message: "   " });

    expect(res.status).toBe(400);
    expect(deps.sendContactEmail).not.toHaveBeenCalled();
  });

  it("svarar 400 för en uppenbart ogiltig e-postadress", async () => {
    const deps = makeDeps();
    const res = await request(makeApp(deps))
      .post("/contact")
      .send({ ...validBody, email: "inte-en-epost" });

    expect(res.status).toBe(400);
    expect(deps.sendContactEmail).not.toHaveBeenCalled();
  });

  it("svarar 500 när mejlutskicket misslyckas", async () => {
    const deps = makeDeps({
      sendContactEmail: vi.fn().mockRejectedValue(new Error("smtp nere")),
    });
    const res = await request(makeApp(deps)).post("/contact").send(validBody);

    expect(res.status).toBe(500);
  });
});
