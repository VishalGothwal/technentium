import path from "node:path";
import { config } from "dotenv";

// Point every module at the test database before anything imports the Prisma client.
config({ path: path.resolve(import.meta.dirname, "../../.env.test"), override: true });
(process.env as Record<string, string>).NODE_ENV = "test";
