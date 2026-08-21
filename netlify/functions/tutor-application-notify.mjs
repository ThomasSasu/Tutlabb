const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

export default async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://tmfwkaqtssicezuwgzch.supabase.co";
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const reviewer = process.env.REVIEWER_EMAIL || "ansongsx@gmail.com";
  const from = process.env.EMAIL_FROM;
  if (!url || !secret || !resendKey || !from) return Response.json({ sent: false, error: "Notification service is not configured." }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return Response.json({ error: "Authentication required." }, { status: 401 });
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: secret, Authorization: `Bearer ${token}` } });
  if (!userResponse.ok) return Response.json({ error: "Invalid session." }, { status: 401 });
  const user = await userResponse.json();
  const { applicationId } = await request.json();
  const applicationResponse = await fetch(`${url}/rest/v1/tutor_applications?id=eq.${encodeURIComponent(applicationId)}&user_id=eq.${user.id}&select=*`, { headers: { apikey: secret, Authorization: `Bearer ${secret}` } });
  const rows = await applicationResponse.json();
  const row = rows?.[0];
  if (!row) return Response.json({ error: "Application not found." }, { status: 404 });
  const a = row.application || {};
  const emailResponse = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `tutor-application-${row.id}` }, body: JSON.stringify({ from, to: [reviewer], subject: `Tutor application: ${a.fullName || user.email}`, html: `<div style="font-family:Arial,sans-serif;max-width:620px;color:#171815"><h1>New tutor application</h1><p><strong>${escapeHtml(a.fullName)}</strong> has submitted an application and must be interviewed and approved before teaching.</p><table cellpadding="8" style="border-collapse:collapse"><tr><td><b>Email</b></td><td>${escapeHtml(user.email)}</td></tr><tr><td><b>University</b></td><td>${escapeHtml(a.university)}</td></tr><tr><td><b>Course</b></td><td>${escapeHtml(a.course)} ${escapeHtml(a.courseCode)}</td></tr><tr><td><b>Result</b></td><td>${escapeHtml(a.grade)}</td></tr><tr><td><b>Experience</b></td><td>${escapeHtml(a.experience)}</td></tr></table><p><a href="https://tutlabb.netlify.app/#/admin/tutor-applications" style="display:inline-block;background:#171815;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px">Review application</a></p><p>The applicant remains unpublished until you approve them.</p></div>` }) });
  if (!emailResponse.ok) return Response.json({ sent: false, error: "Email provider rejected the notification." }, { status: 502 });
  return Response.json({ sent: true });
};
