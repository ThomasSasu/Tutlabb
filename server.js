const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 8787;
const root = __dirname;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. See .env.example.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors({ origin: process.env.APP_URL || true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(root, "dist")));

const fail = (res, error, status = 500) => { console.error(error); return res.status(status).json({ error: error?.message || String(error) }); };
const camelProfile = (row) => row && ({ id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email, phone: row.phone, role: row.role, emailVerified: row.email_verified, createdAt: row.created_at });
const currentUser = async (req) => {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
};
const requireUser = async (req, res, next) => { req.user = await currentUser(req); return req.user ? next() : res.status(401).json({ error: "Please log in to continue." }); };
const requireAdmin = async (req, res, next) => {
  req.user = await currentUser(req);
  if (!req.user) return res.status(401).json({ error: "Please log in to continue." });
  const { data } = await supabase.from("profiles").select("role").eq("id", req.user.id).single();
  return data?.role === "admin" ? next() : res.status(403).json({ error: "Admin access required." });
};

app.get("/api/health", async (_, res) => {
  const { error } = await supabase.from("courses").select("id", { head: true, count: "exact" });
  res.status(error ? 503 : 200).json({ ok: !error, service: "Tut Lab API", database: error ? "unavailable" : "connected" });
});
app.post("/api/auth/signup", async (req, res) => {
  const { firstName, lastName, email, phone, password } = req.body;
  if (![firstName, lastName, email, phone, password].every((x) => String(x || "").trim())) return res.status(422).json({ error: "All fields are required." });
  if (password.length < 8) return res.status(422).json({ error: "Password must be at least 8 characters." });
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({ email: normalized, password, options: { data: { first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() } } });
  if (error) return fail(res, error, error.status || 400);
  const profile = { id: data.user.id, first_name: firstName.trim(), last_name: lastName.trim(), email: normalized, phone: phone.trim(), role: "student", email_verified: Boolean(data.user.email_confirmed_at) };
  const { data: saved, error: profileError } = await supabase.from("profiles").upsert(profile).select().single();
  if (profileError) return fail(res, profileError);
  res.status(201).json({ token: data.session?.access_token || null, refreshToken: data.session?.refresh_token || null, user: camelProfile(saved), confirmationRequired: !data.session });
});
app.post("/api/auth/login", async (req, res) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email: String(req.body.email || "").trim().toLowerCase(), password: String(req.body.password || "") });
  if (error) return res.status(401).json({ error: "Email or password is incorrect." });
  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
  if (profileError) return fail(res, profileError);
  res.json({ token: data.session.access_token, refreshToken: data.session.refresh_token, user: camelProfile(profile) });
});
app.post("/api/auth/forgot-password", async (req, res) => { await supabase.auth.resetPasswordForEmail(String(req.body.email || "").trim().toLowerCase(), { redirectTo: `${process.env.APP_URL || "http://localhost:5173"}/#/auth/reset` }); res.json({ message: "If the account exists, reset instructions have been sent." }); });
app.get("/api/auth/me", requireUser, async (req, res) => { const { data, error } = await supabase.from("profiles").select("*").eq("id", req.user.id).single(); return error ? fail(res, error) : res.json(camelProfile(data)); });
app.post("/api/auth/logout", (_, res) => res.json({ ok: true }));
app.post("/api/auth/login-notification", requireUser, async (req, res) => {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    return res.json({ sent: false, reason: "Email provider is not configured." });
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  const eventKey = crypto.createHash("sha256").update(token).digest("hex");
  const claimed = await supabase.from("login_notifications").insert({ user_id: req.user.id, event_key: eventKey, provider: String(req.body.provider || "unknown") }).select("id").single();
  if (claimed.error?.code === "23505") return res.json({ sent: false, duplicate: true });
  if (claimed.error) return fail(res, claimed.error);
  const provider = String(req.body.provider || "your account");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": eventKey },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [req.user.email],
      subject: "New sign-in to your Tut Lab account",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#171815"><h2>New sign-in detected</h2><p>Hello,</p><p>Your Tut Lab account was signed in using <strong>${provider.replace(/[<>&"']/g, "")}</strong>.</p><p><strong>Time:</strong> ${new Date().toUTCString()}<br><strong>IP:</strong> ${String(req.ip || "Unknown").replace(/[<>&"']/g, "")}<br><strong>Device:</strong> ${String(req.get("user-agent") || "Unknown").replace(/[<>&"']/g, "").slice(0, 180)}</p><p>If this was you, no action is needed. If not, reset your password immediately.</p><p>— Tut Lab Security</p></div>`,
    }),
  });
  if (!response.ok) {
    await supabase.from("login_notifications").delete().eq("id", claimed.data.id);
    return fail(res, new Error("The sign-in email could not be sent."), 502);
  }
  await supabase.from("login_notifications").update({ sent_at: new Date().toISOString() }).eq("id", claimed.data.id);
  res.json({ sent: true });
});

app.get("/api/courses", async (req, res) => { let query = supabase.from("courses").select("*").order("title"); if (req.query.field) query = query.eq("field", req.query.field); if (req.query.q) query = query.or(`title.ilike.%${req.query.q}%,code.ilike.%${req.query.q}%,field.ilike.%${req.query.q}%`); const { data, error } = await query; return error ? fail(res, error) : res.json(data); });
app.get("/api/courses/:id", async (req, res) => { const { data, error } = await supabase.from("courses").select("*").eq("id", req.params.id).single(); return error ? fail(res, error, 404) : res.json(data); });
app.get("/api/fields", async (_, res) => { const { data, error } = await supabase.from("courses").select("field"); return error ? fail(res, error) : res.json([...new Set(data.map((x) => x.field))].sort()); });
app.get("/api/tutors", async (req, res) => { let query = supabase.from("tutors").select("*").eq("published", true); if (req.query.q) query = query.or(`name.ilike.%${req.query.q}%,course.ilike.%${req.query.q}%,school.ilike.%${req.query.q}%`); if (req.query.mode && req.query.mode !== "all") query = query.contains("modes", [req.query.mode]); const { data, error } = await query.order("created_at"); return error ? fail(res, error) : res.json(data); });
app.get("/api/tutors/:id", async (req, res) => { const { data, error } = await supabase.from("tutors").select("*").eq("id", req.params.id).eq("published", true).single(); return error ? fail(res, error, 404) : res.json(data); });
app.get("/api/favorites", requireUser, async (req, res) => { const { data, error } = await supabase.from("favorites").select("tutor_id").eq("user_id", req.user.id); return error ? fail(res, error) : res.json(data.map((x) => x.tutor_id)); });
app.post("/api/favorites/:tutorId", requireUser, async (req, res) => { const key = { user_id: req.user.id, tutor_id: req.params.tutorId }; const { data } = await supabase.from("favorites").select("user_id").match(key).maybeSingle(); const result = data ? await supabase.from("favorites").delete().match(key) : await supabase.from("favorites").insert(key); return result.error ? fail(res, result.error) : res.json({ saved: !data }); });

app.get("/api/universities", async (req, res) => { let query = supabase.from("universities").select("*").limit(50); if (req.query.q) query = query.or(`name.ilike.%${req.query.q}%,country.ilike.%${req.query.q}%`); const { data, error } = await query; return error ? fail(res, error) : res.json({ items: data, customAllowed: true, query: req.query.q || "" }); });
app.get("/api/catalog/search", async (req, res) => { const term = req.query.q || ""; const [courses, universities] = await Promise.all([supabase.from("courses").select("*").or(`title.ilike.%${term}%,code.ilike.%${term}%,field.ilike.%${term}%`).limit(30), supabase.from("universities").select("*").or(`name.ilike.%${term}%,country.ilike.%${term}%`).limit(30)]); if (courses.error || universities.error) return fail(res, courses.error || universities.error); res.json({ courses: courses.data, universities: universities.data, customEntry: { allowed: true, label: term } }); });
app.post("/api/catalog/requests", async (req, res) => { const { type, name, university, country } = req.body; if (!["course", "university", "programme", "topic"].includes(type) || !String(name || "").trim()) return res.status(422).json({ error: "A valid catalog type and name are required." }); const user = await currentUser(req); const { data, error } = await supabase.from("catalog_requests").insert({ type, name: name.trim(), university: university || null, country: country || null, user_id: user?.id || null }).select().single(); return error ? fail(res, error) : res.status(201).json(data); });
app.post("/api/tutor-requests", async (req, res) => { const { subject, university, level, location, mode, language, budget, details } = req.body; if (!String(subject || "").trim() || !String(details || "").trim()) return res.status(422).json({ error: "Course or subject and learning details are required." }); if (!["online", "in-person", "either"].includes(mode)) return res.status(422).json({ error: "Choose a valid lesson format." }); const user = await currentUser(req); const { data, error } = await supabase.from("tutor_requests").insert({ user_id: user?.id || null, subject: subject.trim(), university: university || null, level: level || null, location: location || null, mode, language: language || "English", budget: budget ? Number(budget) : null, details: details.trim() }).select().single(); return error ? fail(res, error) : res.status(201).json(data); });

app.get("/api/resources", async (req, res) => { let query = supabase.from("resources").select("*").eq("status", "approved"); if (req.query.courseId) query = query.eq("course_id", req.query.courseId); const { data, error } = await query; return error ? fail(res, error) : res.json(data); });
app.post("/api/resources", requireUser, upload.single("file"), async (req, res) => { if (!req.file) return res.status(400).json({ error: "A file is required." }); const objectPath = `${req.user.id}/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-")}`; const uploaded = await supabase.storage.from("resources").upload(objectPath, req.file.buffer, { contentType: req.file.mimetype }); if (uploaded.error) return fail(res, uploaded.error); const { data: publicUrl } = supabase.storage.from("resources").getPublicUrl(objectPath); const { data, error } = await supabase.from("resources").insert({ uploader_id: req.user.id, course_id: req.body.courseId || null, title: req.body.title || req.file.originalname, type: req.body.type || "Study material", url: publicUrl.publicUrl, original_name: req.file.originalname }).select().single(); return error ? fail(res, error) : res.status(201).json(data); });
app.patch("/api/resources/:id/approve", requireAdmin, async (req, res) => { const { data, error } = await supabase.from("resources").update({ status: "approved" }).eq("id", req.params.id).select().single(); return error ? fail(res, error, 404) : res.json(data); });
app.post("/api/tutors/apply", requireUser, async (req, res) => { const gpa = Number(req.body.gpa); if (!gpa || gpa < 3.5) return res.status(422).json({ error: "Tutors must have a GPA of 3.5 or above." }); const { data, error } = await supabase.from("tutor_applications").insert({ user_id: req.user.id, application: req.body, gpa }).select().single(); return error ? fail(res, error) : res.status(201).json(data); });
app.patch("/api/tutors/:id/accept", requireAdmin, async (req, res) => { const { data, error } = await supabase.from("tutor_applications").update({ status: "accepted" }).eq("id", req.params.id).select().single(); return error ? fail(res, error, 404) : res.json(data); });
app.post("/api/sessions", requireUser, async (req, res) => { if (!req.body.zoomLink?.startsWith("https://")) return res.status(422).json({ error: "A valid meeting link is required." }); const { data, error } = await supabase.from("sessions").insert({ owner_id: req.user.id, details: req.body, status: "published" }).select().single(); return error ? fail(res, error) : res.status(201).json(data); });
app.get("/api/sessions", async (_, res) => { const { data, error } = await supabase.from("sessions").select("*").eq("status", "published"); return error ? fail(res, error) : res.json(data); });
app.post("/api/bookings", requireUser, async (req, res) => { const price = Number(req.body.price || 0), people = Math.max(1, Number(req.body.people || 1)); const { data, error } = await supabase.from("bookings").insert({ user_id: req.user.id, details: req.body, price, people, payment_account: process.env.PAYMENT_ACCOUNT || "0204392306", tutor_payout: price * .8 * people, platform_share: price * .2 * people }).select().single(); return error ? fail(res, error) : res.status(201).json(data); });
app.post("/api/bookings/:id/verify-payment", requireUser, async (req, res) => { const { data, error } = await supabase.from("bookings").update({ payment_status: "awaiting_admin_confirmation", payment_reference: req.body.reference || null, payment_proof: req.body.proof || null }).eq("id", req.params.id).eq("user_id", req.user.id).select().single(); return error ? fail(res, error, 404) : res.json({ message: "Payment submitted for admin confirmation.", booking: data }); });
app.patch("/api/bookings/:id/confirm-payment", requireAdmin, async (req, res) => { const { data, error } = await supabase.from("bookings").update({ payment_status: "verified_manually", confirmed_at: new Date().toISOString() }).eq("id", req.params.id).select().single(); return error ? fail(res, error, 404) : res.json(data); });
app.post("/api/bookings/:id/complete", requireAdmin, async (req, res) => { const { data: booking } = await supabase.from("bookings").select("payment_status").eq("id", req.params.id).single(); if (booking?.payment_status !== "verified_manually") return res.status(409).json({ error: "An admin must confirm payment first." }); const { data, error } = await supabase.from("bookings").update({ status: "completed", payout_status: "ready_for_tutor_payout" }).eq("id", req.params.id).select().single(); return error ? fail(res, error) : res.json(data); });

app.use("/api", (_, res) => res.status(404).json({ error: "API route not found." }));
app.use((_, res) => res.sendFile(path.join(root, "dist", "index.html")));
app.listen(PORT, () => console.log(`Tut Lab API running at http://localhost:${PORT}`));
