import { createClient } from "@supabase/supabase-js";

const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export default async (request) => {
  if (request.method !== "GET") return reply({ error: "Method not allowed." }, 405);
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return reply({ error: "The resource access service is not configured." }, 503);
  const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Please sign in to open this resource." }, 401);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  const user = auth?.user;
  if (authError || !user?.id) return reply({ error: "Your sign-in session has expired." }, 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  const { data: resource } = await db.from("paid_resources").select("*").eq("id", id).eq("status", "published").maybeSingle();
  if (!resource) return reply({ error: "Resource not found." }, 404);
  const [{ data: tutor }, { data: purchase }] = await Promise.all([
    db.from("tutors").select("user_id,name,school").eq("id", resource.tutor_id).maybeSingle(),
    db.from("resource_purchases").select("id").eq("resource_id", resource.id).eq("buyer_id", user.id).eq("payment_status", "paid").maybeSingle(),
  ]);
  const reviewer = String(user.email || "").toLowerCase() === String(process.env.REVIEWER_EMAIL || "ansongsx@gmail.com").toLowerCase();
  if (!purchase && tutor?.user_id !== user.id && !reviewer)
    return reply({ error: "Purchase this resource before opening it." }, 403);
  const { data: asset } = await db.from("paid_resource_assets").select("question_path,video_url").eq("resource_id", resource.id).maybeSingle();
  if (!asset) return reply({ error: "The resource files are unavailable." }, 404);
  const { data: signed, error: signedError } = await db.storage.from("past-questions").createSignedUrl(asset.question_path, 3600);
  if (signedError) return reply({ error: "The question file could not be opened." }, 500);
  return reply({ resource: { ...resource, tutor: tutor ? { name: tutor.name, school: tutor.school } : null }, videoUrl: asset.video_url, questionUrl: signed.signedUrl, expiresIn: 3600 });
};
