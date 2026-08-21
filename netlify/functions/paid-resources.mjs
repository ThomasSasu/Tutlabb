import { createClient } from "@supabase/supabase-js";

const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export default async (request) => {
  if (request.method !== "GET") return reply({ error: "Method not allowed." }, 405);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://tmfwkaqtssicezuwgzch.supabase.co";
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!secret) return reply({ error: "Netlify Functions cannot see SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY." }, 503);
  const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: resources, error } = await db
    .from("paid_resources")
    .select("id,tutor_id,title,course,institution,exam_year,description,price,currency,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) return reply({ error: "Run the paid past-questions database setup first." }, 500);

  const tutorIds = [...new Set((resources || []).map((item) => item.tutor_id))];
  const { data: tutorRows } = tutorIds.length
    ? await db.from("tutors").select("id,name,school,image").in("id", tutorIds)
    : { data: [] };
  const tutorMap = new Map((tutorRows || []).map((tutor) => [tutor.id, tutor]));

  let purchasedIds = new Set();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token) {
    const { data: auth } = await db.auth.getUser(token);
    if (auth?.user?.id) {
      const { data: purchases } = await db
        .from("resource_purchases")
        .select("resource_id")
        .eq("buyer_id", auth.user.id)
        .eq("payment_status", "paid");
      purchasedIds = new Set((purchases || []).map((purchase) => purchase.resource_id));
    }
  }

  return reply({
    items: (resources || []).map((item) => ({
      ...item,
      tutor: tutorMap.get(item.tutor_id) || null,
      purchased: purchasedIds.has(item.id),
    })),
  });
};
