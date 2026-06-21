import type { Request, Response, NextFunction } from "express";

/** Kräver att en användare är inloggad, annars 401. */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Inte inloggad" });
    return;
  }
  next();
}

/** Kräver att den inloggade användaren har rollen 'admin', annars 401/403. */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Inte inloggad" });
    return;
  }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "Kräver admin-behörighet" });
    return;
  }
  next();
}
