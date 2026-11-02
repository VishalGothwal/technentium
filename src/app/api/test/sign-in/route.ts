import { NextResponse, type NextRequest } from "next/server";
import { signInWithPassword } from "@/server/auth/flows";
import { testHooksEnabled } from "@/server/test-hooks";

/** E2E-only: sign a seeded account in with email + password (session cookies on the response). 404 unless E2E_TEST_HOOKS=1 outside production. */
export async function POST(req: NextRequest) {
  if (!testHooksEnabled()) return new NextResponse(null, { status: 404 });
  const { email, password } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const res = await signInWithPassword({ email: email ?? "", password: password ?? "" }, { staff: false });
  return NextResponse.json(res, { status: res.ok ? 200 : 401 });
}
