/**
 * Route helpers shared by the API routers
 */

import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

/** Forwards async errors to the Express error middleware */
export const handle =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export const isUuid = (value: unknown): value is string =>
  z.uuid().safeParse(value).success;

/** A UUID query parameter, or null when absent or malformed */
export const uuidParam = (value: unknown): string | null =>
  isUuid(value) ? value : null;
