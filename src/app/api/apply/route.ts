import { forwardToBackend } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return forwardToBackend(req, "/api/apply");
}

export async function POST(req: Request) {
  return forwardToBackend(req, "/api/apply");
}

export async function OPTIONS(req: Request) {
  return forwardToBackend(req, "/api/apply");
}
