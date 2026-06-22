import type { Request, Response, NextFunction } from "express";
import { createLogger, type Logger } from "./logger";

/**
 * Express-middleware som loggar varje HTTP-förfrågan: metod och sökväg när den
 * kommer in, samt statuskod och svarstid när den är klar.
 */
export function createRequestLogger(
  logger: Logger = createLogger("http"),
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const start = Date.now();
    logger.debug("Inkommande förfrågan", {
      method: req.method,
      url: req.originalUrl,
    });

    res.on("finish", () => {
      logger.info("Förfrågan klar", {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
    });

    next();
  };
}
