// Imported first by seed.ts. Same precedence as Next.js: .env.local (where the Supabase keys live locally)
// wins over .env. Missing files are skipped, so on Vercel the project env vars are used unchanged.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
