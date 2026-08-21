import { createClient } from "@supabase/supabase-js";

const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const clean = (value, max) => String(value || "").trim().slice(0, max);

export default async (request) => {
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://tmfwkaqtssicezuwgzch.supabase.co";
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return reply({ error: "The resource submission service is not configured." }, 503);
  const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Please sign in as an approved tutor." }, 401);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth?.user?.id) return reply({ error: "Your sign-in session has expired." }, 401);

  const { data: tutor } = await db
    .from("tutors")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("published", true)
    .maybeSingle();
  if (!tutor) return reply({ error: "Only approved tutors can publish paid learning resources." }, 403);

  const input = await request.json().catch(() => ({}));
  const title = clean(input.title, 120);
  const course = clean(input.course, 100);
  const institution = clean(input.institution, 120);
  const examYear = clean(input.examYear, 20);
  const description = clean(input.description, 800);
  const questionPath = clean(input.questionPath, 500);
  const videoUrl = clean(input.videoUrl, 1000);
  const price = Math.round(Number(input.price) * 100) / 100;
  let parsedVideo;
  try { parsedVideo = new URL(videoUrl); } catch { parsedVideo = null; }
  if (!title || !course || description.length < 40 || !questionPath)
    return reply({ error: "Add a title, course, question file, and a description of at least 40 characters." }, 422);
  if (!parsedVideo || parsedVideo.protocol !== "https:")
    return reply({ error: "Add a valid HTTPS explanation-video link." }, 422);
  if (!Number.isFinite(price) || price < 1 || price > 500)
    return reply({ error: "Choose a price between GHS 1 and GHS 500." }, 422);
  if (input.rightsConfirmed !== true)
    return reply({ error: "Confirm that you are permitted to share this question and explanation." }, 422);
  if (!questionPath.startsWith(`${auth.user.id}/`) || questionPath.includes(".."))
    return reply({ error: "The uploaded question file is invalid." }, 422);

  const { data: resource, error: resourceError } = await db
    .from("paid_resources")
    .insert({ tutor_id: tutor.id, title, course, institution: institution || null, exam_year: examYear || null, description, price, currency: "GHS", status: "published", rights_confirmed: true })
    .select("id")
    .single();
  if (resourceError) return reply({ error: "The resource could not be published." }, 500);
  const { error: assetError } = await db
    .from("paid_resource_assets")
    .insert({ resource_id: resource.id, question_path: questionPath, video_url: parsedVideo.toString() });
  if (assetError) {
    await db.from("paid_resources").delete().eq("id", resource.id);
    return reply({ error: "The private resource details could not be saved." }, 500);
  }
  return reply({ id: resource.id, published: true }, 201);
};
