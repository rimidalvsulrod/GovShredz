import "server-only";
import { z } from "zod";

export const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return bad("Invalid request");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid request");
  return parsed.data;
}

/** Wraps a route handler so unexpected errors become a clean JSON 500. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      console.error(e);
      return bad("Something went wrong. Please try again.", 500);
    }
  };
}

export const num = (v: unknown) => (v == null ? 0 : Number(v));

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Username: 3–20 letters, numbers or _");
