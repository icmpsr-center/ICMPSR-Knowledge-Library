import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const auth = req.headers.get("Authorization");
  const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!auth?.startsWith("Bearer ") || !apiKey) return json({ error: "Authentication required" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, apiKey, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userError } = await supabase.auth.getUser(auth.slice(7));
  if (userError || !userData.user) return json({ error: "Invalid session" }, 401);
  let input: { url?: string };
  try { input = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!input.url) return json({ error: "Google Drive URL is required" }, 400);
  let source: URL;
  try { source = new URL(input.url); } catch { return json({ error: "Invalid URL" }, 400); }
  if (!["drive.google.com", "docs.google.com"].includes(source.hostname)) return json({ error: "Only Google Drive and Google Docs links are accepted" }, 400);
  const fileMatch = source.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const docsMatch = source.pathname.match(/\/(document|presentation)\/d\/([a-zA-Z0-9_-]+)/);
  const id = fileMatch?.[1] || docsMatch?.[2] || source.searchParams.get("id") || "";
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(id)) return json({ error: "Could not identify Google Drive file ID" }, 400);
  const kind = docsMatch?.[1];
  const candidates = kind === "document" ? [`https://docs.google.com/document/d/${id}/export?format=docx`] : kind === "presentation" ? [`https://docs.google.com/presentation/d/${id}/export/pptx`] : [`https://drive.google.com/uc?export=download&id=${id}`, `https://drive.usercontent.google.com/download?id=${id}&export=download&authuser=0&confirm=t`];
  let upstream: Response | null = null;
  for (const candidate of candidates) { const res = await fetch(candidate, { redirect: "follow" }); const type = res.headers.get("content-type") || ""; if (res.ok && !type.includes("text/html")) { upstream = res; break; } }
  if (!upstream) return json({ error: "The item is not publicly downloadable. Set General access to Anyone with the link - Viewer. Google Docs and Slides export as DOCX/PPTX." }, 422);
  const len = Number(upstream.headers.get("content-length") || 0);
  if (len > 50 * 1024 * 1024) return json({ error: "File exceeds the 50 MB import limit" }, 413);
  const defaultName = kind === "document" ? "google-doc.docx" : kind === "presentation" ? "google-slides.pptx" : `drive-${id}`;
  return new Response(upstream.body, { status: 200, headers: { ...cors, "Content-Type": upstream.headers.get("content-type") || "application/octet-stream", "Content-Disposition": upstream.headers.get("content-disposition") || `attachment; filename="${defaultName}"`, "X-Drive-File-Id": id, "Cache-Control": "no-store" } });
});
