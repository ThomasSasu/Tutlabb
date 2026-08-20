import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Heart,
  MapPin,
  Menu,
  Monitor,
  Play,
  Search,
  ShieldCheck,
  Star,
  Users,
  X,
} from "lucide-react";
import "./styles.css";
import { oauthProviderEnabled, supabase } from "./supabase";
const API = "/api";
function readStoredUser() {
  try {
    const value = localStorage.getItem("tutlab_user");
    return value ? JSON.parse(value) : null;
  } catch {
    localStorage.removeItem("tutlab_user");
    localStorage.removeItem("tutlab_token");
    return null;
  }
}
async function api(path, options = {}) {
  const token = localStorage.getItem("tutlab_token");
  const res = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json"))
    throw new Error("The Tut Lab API is not available at this address.");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}
const tutors = [
  {
    id: "ama",
    name: "Ama Serwaa",
    course: "Calculus II",
    school: "University of Ghana",
    rating: "4.9",
    reviews: 48,
    price: 45,
    image: "/assets/tutor1.jpg",
    mode: "Online & in person",
    available: "Available today",
  },
  {
    id: "kwame",
    name: "Kwame Mensah",
    course: "Digital Signal Processing",
    school: "KNUST",
    rating: "4.8",
    reviews: 36,
    price: 50,
    image: "/assets/tutor2.jpg",
    mode: "Online",
    available: "Next slot 4:00 PM",
  },
  {
    id: "nana",
    name: "Nana Adjei",
    course: "Organic Chemistry",
    school: "University of Ghana",
    rating: "5.0",
    reviews: 29,
    price: 55,
    image: "/assets/tutoring1.jpg",
    mode: "Online & in person",
    available: "Available today",
  },
];
const courses = [
  ["MATH 201", "Calculus II", "Tutor directory"],
  ["CPEN 304", "Digital Signal Processing", "Tutor directory"],
  ["CHEM 204", "Organic Chemistry", "Tutor directory"],
  ["CS 214", "Data Structures", "Tutor directory"],
];
function Logo() {
  return (
    <button className="brand" onClick={() => (location.hash = "/")}>
      <img src="/assets/logo.png" alt="" />
      <span>Tut Lab</span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.05A10 10 0 0 0 2 12c0 1.64.39 3.19 1.05 4.55l3.34-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.45l3.34 2.62C7.18 7.7 9.39 5.94 12 5.94Z" />
    </svg>
  );
}

function SocialAuth({ onSelect }) {
  return (
    <div className="social-auth">
      <div className="social-auth-grid">
        <button type="button" onClick={() => onSelect("Google")}>
          <GoogleIcon /> <span>Continue with Google</span>
        </button>
      </div>
    </div>
  );
}
function App() {
  const getRoute = () => location.hash.slice(1) || "/";
  const [page, setPage] = useState(getRoute());
  const [menu, setMenu] = useState(false);
  const [marketTutors, setMarketTutors] = useState(tutors);
  const [user, setUser] = useState(readStoredUser);
  useEffect(() => {
    api("/tutors")
      .then((items) => {
        if (Array.isArray(items)) setMarketTutors(items);
      })
      .catch(() => {});
    const h = () => {
      setPage(getRoute());
      setMenu(false);
      scrollTo(0, 0);
    };
    addEventListener("hashchange", h);
    return () => removeEventListener("hashchange", h);
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const syncSession = (session, notify = false) => {
      if (!session?.access_token) return;
      localStorage.setItem("tutlab_token", session.access_token);
      const meta = session.user.user_metadata || {};
      const names = (meta.full_name || meta.name || "").trim().split(/\s+/);
      const oauthUser = {
        id: session.user.id,
        firstName: meta.first_name || names[0] || "Student",
        lastName: meta.last_name || names.slice(1).join(" "),
        email: session.user.email,
        role: "student",
        emailVerified: Boolean(session.user.email_confirmed_at),
      };
      localStorage.setItem("tutlab_user", JSON.stringify(oauthUser));
      setUser(oauthUser);
      if (notify)
        api("/auth/login-notification", {
          method: "POST",
          body: JSON.stringify({ provider: session.user.app_metadata?.provider || "social" }),
        }).catch(() => {});
      if (location.hash.startsWith("#/auth")) {
        const returnTo = localStorage.getItem("tutlab_return_to") || "/";
        localStorage.removeItem("tutlab_return_to");
        location.hash = returnTo;
      }
    };
    supabase.auth.getSession().then(({ data }) => syncSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, session) =>
      syncSession(session, event === "SIGNED_IN"),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  const nav = (p) => (location.hash = p);
  const logout = () => {
    supabase?.auth.signOut();
    localStorage.removeItem("tutlab_token");
    localStorage.removeItem("tutlab_user");
    setUser(null);
    nav("/");
  };
  if (page.startsWith("/auth/"))
    return (
      <AuthPage
        kind={page.split("/")[2]}
        onAuth={(u) => {
          setUser(u);
          const returnTo = localStorage.getItem("tutlab_return_to") || "/";
          localStorage.removeItem("tutlab_return_to");
          nav(returnTo);
        }}
      />
    );
  return (
    <>
      <Header
        page={page}
        nav={nav}
        menu={menu}
        setMenu={setMenu}
        user={user}
        logout={logout}
      />
      <main>
        {page === "/request-tutor" ? (
          <RequestTutor nav={nav} />
        ) : page.startsWith("/tutors/") ? (
          <TutorProfile
            tutor={
              marketTutors.find((t) => t.id === page.split("/")[2]) ||
              marketTutors[0]
            }
            nav={nav}
            user={user}
          />
        ) : page.startsWith("/tutors") ? (
          <TutorsPage nav={nav} items={marketTutors} user={user} />
        ) : page === "/learn" ? (
          <LearnPage nav={nav} />
        ) : page === "/become-a-tutor" ? (
          <BecomeTutor nav={nav} user={user} />
        ) : page === "/admin/tutor-applications" ? (
          <TutorApplicationsAdmin nav={nav} user={user} />
        ) : (
          <Home nav={nav} items={marketTutors} user={user} />
        )}
      </main>
      {page === "/" && <SocialProof />}
      <Footer nav={nav} />
    </>
  );
}
function Header({ page, nav, menu, setMenu, user, logout }) {
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Logo />
        <nav className={menu ? "open" : ""}>
          {[
            ["/tutors", "Find a tutor"],
            ["/request-tutor", "Post a request"],
            ["/learn", "Learn"],
            ["/become-a-tutor", "Become a tutor"],
          ].map(([p, l]) => (
            <button
              className={page === p ? "active" : ""}
              onClick={() => nav(p)}
              key={p}
            >
              {l}
            </button>
          ))}
          <div className="mobile-auth">
            {user ? (
              <button onClick={logout}>Log out</button>
            ) : (
              <>
                <button onClick={() => nav("/auth/login")}>Log in</button>
                <button
                  className="dark-btn"
                  onClick={() => nav("/auth/signup")}
                >
                  Create account
                </button>
              </>
            )}
          </div>
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="user-pill">
                {user.firstName?.[0]}
                {user.lastName?.[0]}
              </span>
              <button className="link-btn" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <button className="link-btn" onClick={() => nav("/auth/login")}>
                Log in
              </button>
              <button className="dark-btn" onClick={() => nav("/auth/signup")}>
                Create account
              </button>
            </>
          )}
        </div>
        <button
          className="mobile-toggle"
          aria-label="Toggle menu"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
function Home({ nav, items = tutors, user }) {
  const [q, setQ] = useState("");
  const search = () =>
    nav("/tutors" + (q ? `?q=${encodeURIComponent(q)}` : ""));
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <ShieldCheck /> Built for university students everywhere
          </div>
          <h1>
            Find the right tutor.
            <br />
            <em>Learn your way.</em>
          </h1>
          <p>
            Connect with verified university tutors for focused online and
            in-person lessons—from a quick concept check to full exam prep.
          </p>
          <div className="hero-search">
            <div className="search-input">
              <Search />
              <input
                aria-label="Course, topic, or tutor"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="Search any course, topic, tutor, or university"
              />
            </div>
            <button onClick={search}>
              Find a tutor <ArrowRight />
            </button>
          </div>
          <div className="hero-alternative">
            <span>or</span>
            <button onClick={() => nav("/request-tutor")}>
              Post your learning request <ArrowRight />
            </button>
          </div>
          <div className="mode-row">
            <span>
              <Monitor /> Online tutoring
            </span>
            <span>
              <MapPin /> In-person tutoring
            </span>
            <span>
              <Check /> Verified tutors
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <img
            src="/assets/x-IgUR1iX0mqM-unsplash.jpg"
            alt="University students learning together"
          />
          <div className="hero-badge">
            <span className="gold-icon">
              <Star fill="currentColor" />
            </span>
            <div>
              <strong>Verified student feedback</strong>
              <small>Published after completed sessions</small>
            </div>
          </div>
          <div className="hero-slot">
            <CalendarDays />
            <div>
              <small>NEXT AVAILABLE</small>
              <strong>Today, 4:00 PM</strong>
            </div>
          </div>
        </div>
      </section>
      <section className="trust-strip">
        <span>Search across universities worldwide</span>
        <b>Africa</b>
        <b>Europe</b>
        <b>Asia</b>
        <b>Americas</b>
        <b>Oceania</b>
      </section>
      <section className="section">
        <Title
          over="POPULAR COURSES"
          title="Get help where it matters most."
          action="Explore all courses"
          onClick={() => nav("/tutors")}
        />
        <div className="course-grid">
          {courses.map((c) => (
            <button
              className="course-card"
              key={c[0]}
              onClick={() => nav("/tutors")}
            >
              <span className="course-icon">
                <BookOpen />
              </span>
              <small>{c[0]}</small>
              <h3>{c[1]}</h3>
              <p>{c[2]}</p>
              <ArrowRight className="corner-arrow" />
            </button>
          ))}
        </div>
      </section>
      <section className="section soft">
        <Title
          over="AVAILABLE TODAY"
          title="Meet tutors ready to help."
          action="View all tutors"
          onClick={() => nav("/tutors")}
        />
        <TutorGrid nav={nav} items={items} user={user} />
      </section>
      <section className="section learn-feature">
        <div className="learn-image">
          <img src="/assets/onlinesection.avif" alt="Tutor teaching online" />
          <button className="play">
            <Play fill="currentColor" />
          </button>
          <span>12 min · Free lesson</span>
        </div>
        <div className="learn-copy">
          <span className="overline">LEARN BEFORE YOU BOOK</span>
          <h2>See how a tutor teaches before your first session.</h2>
          <p>
            Watch free explanations, worked examples, and study guides made by
            verified tutors. Found someone whose style clicks? Book them
            directly.
          </p>
          {[
            [
              "Real teaching samples",
              "Preview a tutor’s approach, not just their profile.",
            ],
            [
              "Course-specific resources",
              "Filter lessons by course and topic.",
            ],
          ].map((x) => (
            <div className="mini-feature" key={x[0]}>
              <Check />
              <span>
                <b>{x[0]}</b>
                <small>{x[1]}</small>
              </span>
            </div>
          ))}
          <button className="dark-btn roomy" onClick={() => nav("/learn")}>
            Browse free lessons <ArrowRight />
          </button>
        </div>
      </section>
      <section className="section how">
        <div className="center-title">
          <span className="overline">HOW IT WORKS</span>
          <h2>From stuck to confident in three steps.</h2>
        </div>
        <div className="steps">
          {[
            [
              "01",
              "Search your course",
              "Tell us what you’re learning and choose online or in person.",
            ],
            [
              "02",
              "Choose your tutor",
              "Compare verified profiles, prices, reviews, and availability.",
            ],
            [
              "03",
              "Book and learn",
              "Pick a time, pay securely, and meet your tutor.",
            ],
          ].map((x) => (
            <div className="step" key={x[0]}>
              <span>{x[0]}</span>
              <h3>{x[1]}</h3>
              <p>{x[2]}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="cta">
        <div>
          <span className="overline">TEACH. EARN. MAKE AN IMPACT.</span>
          <h2>Know a course inside out?</h2>
          <p>
            Turn your knowledge into flexible income and help another student
            move forward.
          </p>
        </div>
        <button className="gold-btn" onClick={() => nav("/become-a-tutor")}>
          Become a tutor <ArrowRight />
        </button>
      </section>
    </>
  );
}
function Title({ over, title, action, onClick }) {
  return (
    <div className="section-title">
      <div>
        <span className="overline">{over}</span>
        <h2>{title}</h2>
      </div>
      <button className="arrow-link" onClick={onClick}>
        {action}
        <ArrowRight />
      </button>
    </div>
  );
}
function TutorGrid({ nav, items = tutors, user }) {
  return (
    <div className="tutor-grid">
      {items.map((t) => (
        <TutorCard key={t.id} tutor={t} nav={nav} user={user} />
      ))}
    </div>
  );
}
function TutorCard({ tutor: t, nav, user }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user)
      api("/favorites")
        .then((ids) => setSaved(ids.includes(t.id)))
        .catch(() => {});
  }, [user, t.id]);
  const toggle = async () => {
    if (!user) {
      nav("/auth/login");
      return;
    }
    setBusy(true);
    try {
      const result = await api("/favorites/" + t.id, { method: "POST" });
      setSaved(result.saved);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="tutor-card">
      <div className="tutor-photo">
        <img src={t.image} alt={t.name} />
        <button
          className={saved ? "saved" : ""}
          disabled={busy}
          aria-label={
            saved ? `Remove ${t.name} from saved tutors` : `Save ${t.name}`
          }
          onClick={toggle}
        >
          <Heart fill={saved ? "currentColor" : "none"} />
        </button>
        <span>{t.available || "View calendar"}</span>
      </div>
      <div className="tutor-info">
        <div className="verified">
          <ShieldCheck /> Verification profile
        </div>
        <h3>{t.name}</h3>
        <p>{t.course}</p>
        <small>{t.school}</small>
        <div className="rating">
          <ShieldCheck />
          <span>Credentials and course approvals are reviewed</span>
        </div>
        <div className="tutor-meta">
          <span>{t.mode}</span>
          <strong>
            GHS {t.price}
            <small>/hr</small>
          </strong>
        </div>
        <button className="outline-btn" onClick={() => nav("/tutors/" + t.id)}>
          View profile <ArrowRight />
        </button>
      </div>
    </article>
  );
}
function TutorsPage({ nav, items = tutors, user }) {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const [q, setQ] = useState(params.get("q") || "");
  const [mode, setMode] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [sort, setSort] = useState("recommended");
  let list = items
    .filter((t) =>
      (t.name + t.course + t.school).toLowerCase().includes(q.toLowerCase()),
    )
    .filter(
      (t) =>
        mode === "all" ||
        (mode === "online"
          ? t.mode.includes("Online")
          : t.mode.includes("person")),
    )
    .filter(
      (t) =>
        availability === "all" || t.available.toLowerCase().includes("today"),
    );
  if (sort === "price-low") list = [...list].sort((a, b) => a.price - b.price);
  if (sort === "price-high") list = [...list].sort((a, b) => b.price - a.price);
  return (
    <section className="page section">
      <span className="overline">TUTOR MARKETPLACE</span>
      <h1>Find your tutor</h1>
      <p className="page-lead">
        Search by course, university, teaching mode, and published availability.
      </p>
      <div className="filterbar">
        <div className="search-input">
          <Search />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search course, university, topic, or tutor"
          />
        </div>
        <label className="select-control">
          <span className="sr-only">Teaching mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="all">Online or in person</option>
            <option value="online">Online</option>
            <option value="person">In person</option>
          </select>
          <ChevronDown />
        </label>
        <label className="select-control">
          <span className="sr-only">Availability</span>
          <select
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <option value="all">Available anytime</option>
            <option value="today">Available today</option>
          </select>
          <ChevronDown />
        </label>
      </div>
      <div className="results-head">
        <span>
          <b>{list.length}</b> tutor profiles found
        </span>
        <label className="select-control compact">
          <select
            aria-label="Sort tutors"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recommended">Recommended</option>
            <option value="price-low">Lowest price</option>
            <option value="price-high">Highest price</option>
          </select>
          <ChevronDown />
        </label>
      </div>
      {list.length ? (
        <TutorGrid nav={nav} items={list} user={user} />
      ) : (
        <div className="empty">
          <Search />
          <h3>No tutor profiles match these filters</h3>
          <p>Clear a filter or search for another course or university.</p>
        </div>
      )}
    </section>
  );
}
function TutorProfile({ tutor, nav, user }) {
  const [course, setCourse] = useState(tutor.course);
  const [mode, setMode] = useState("online");
  const [duration, setDuration] = useState(1);
  const total = Math.round(
    tutor.price * duration * (mode === "person" ? 1.15 : 1),
  );
  return (
    <section className="page section">
      <button className="back" onClick={() => nav("/tutors")}>
        ← Back to tutors
      </button>
      <div className="profile-layout">
        <div className="profile-main">
          <div className="profile-head">
            <img src={tutor.image} alt={tutor.name} />
            <div>
              <div className="verified">
                <ShieldCheck /> Verification profile
              </div>
              <h1>{tutor.name}</h1>
              <p>
                {tutor.school} · {tutor.course}
              </p>
              <div className="rating">
                <ShieldCheck />
                <span>Review history appears after completed sessions</span>
              </div>
            </div>
          </div>
          <div className="profile-body">
            <h2>About {tutor.name.split(" ")[0]}</h2>
            <p>
              I turn difficult university topics into clear, practical steps.
              Sessions are tailored to your course outline and the exact areas
              you want to strengthen.
            </p>
            <h2>Courses I teach</h2>
            <div className="skill-row">
              <span>
                {tutor.course}
                <small>Course verification status shown here</small>
              </span>
              <strong>GHS {tutor.price}/hr</strong>
            </div>
          </div>
        </div>
        <aside className="booking-card">
          <span className="available-dot">
            ● Availability shown from tutor calendar
          </span>
          <h3>Book a session</h3>
          <label>
            Course
            <div className="booking-select">
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              >
                <option>{tutor.course}</option>
                <option>Request another course</option>
              </select>
              <ChevronDown />
            </div>
          </label>
          <label>
            Teaching mode
            <div className="mode-choice">
              <button
                type="button"
                className={mode === "online" ? "selected" : ""}
                onClick={() => setMode("online")}
              >
                <Monitor /> Online
              </button>
              <button
                type="button"
                className={mode === "person" ? "selected" : ""}
                onClick={() => setMode("person")}
              >
                <MapPin /> In person
              </button>
            </div>
          </label>
          <label>
            Duration
            <div className="booking-select">
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value="0.5">30 minutes</option>
                <option value="1">1 hour</option>
                <option value="1.5">1.5 hours</option>
                <option value="2">2 hours</option>
              </select>
              <ChevronDown />
            </div>
          </label>
          <div className="booking-total">
            <span>Estimated session total</span>
            <strong>GHS {total}</strong>
          </div>
          <button
            className="gold-btn wide"
            onClick={() => (user ? nav("/request-tutor") : nav("/auth/login"))}
          >
            Choose a time <ArrowRight />
          </button>
          <small>
            <ShieldCheck /> Final availability and total are confirmed at
            checkout
          </small>
        </aside>
      </div>
    </section>
  );
}
function LearnPage({ nav }) {
  const data = [
    [
      "/assets/onlinesection.avif",
      "Understanding Z-transforms",
      "CPEN 304 · 14 min",
    ],
    ["/assets/saa.avif", "Organic reactions made simple", "CHEM 204 · 11 min"],
    [
      "/assets/tutoring1.jpg",
      "Integration by substitution",
      "MATH 201 · Study guide",
    ],
  ];
  return (
    <section className="page section">
      <span className="overline">FREE LEARNING LIBRARY</span>
      <h1>Learn before you book.</h1>
      <p className="page-lead">
        Course resources published by university tutors after review.
      </p>
      <div className="resource-grid">
        {data.map((r, i) => (
          <article className="resource" key={r[1]}>
            <div>
              <img src={r[0]} alt="" />
              <span>
                <Play fill="currentColor" />
              </span>
            </div>
            <small>
              {r[2]
                .replace("14 min", "Video lesson")
                .replace("11 min", "Video lesson")}
            </small>
            <h3>{r[1]}</h3>
            <p>
              By {tutors[i].name}
              <ShieldCheck />
            </p>
            <button onClick={() => nav("/tutors/" + tutors[i].id)}>
              Book this tutor <ArrowRight />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
function LegacyBecomeTutor({ nav }) {
  return (
    <section className="page apply-page">
      <div className="apply-copy">
        <span className="overline">BECOME A TUT LAB TUTOR</span>
        <h1>
          Teach what you know.
          <br />
          <em>Earn on your terms.</em>
        </h1>
        <p>
          Join a trusted network of university tutors, set your schedule, and
          help students master the courses you’ve already conquered.
        </p>
        {[
          "Set your own online and in-person rates",
          "Get verified for every course you teach",
          "Build your profile with videos and reviews",
        ].map((x) => (
          <span className="apply-check" key={x}>
            <Check />
            {x}
          </span>
        ))}
      </div>
      <div className="apply-card">
        <div className="apply-progress">
          <span className="active">1</span>
          <i />
          <span>2</span>
          <i />
          <span>3</span>
        </div>
        <small>STEP 1 OF 3</small>
        <h2>Start your application</h2>
        <p>First, tell us a little about yourself.</p>
        <div className="two-col">
          <label>
            First name
            <input placeholder="Ama" />
          </label>
          <label>
            Last name
            <input placeholder="Mensah" />
          </label>
        </div>
        <label>
          University email
          <input type="email" placeholder="you@university.edu" />
        </label>
        <label>
          University
          <input
            name="university"
            list="global-universities"
            placeholder="Type any university worldwide"
          />
          <datalist id="global-universities">
            <option value="University of Ghana" />
            <option value="University of Cape Town" />
            <option value="University of Oxford" />
            <option value="Massachusetts Institute of Technology" />
            <option value="National University of Singapore" />
            <option value="University of Melbourne" />
          </datalist>
        </label>
        <button className="dark-btn wide" onClick={() => nav("/auth/signup")}>
          Continue application <ArrowRight />
        </button>
        <small className="form-note">
          You’ll create an account before uploading verification documents.
        </small>
      </div>
    </section>
  );
}
function BecomeTutor({ nav, user }) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [files, setFiles] = useState({ identity: null, academic: null, photo: null });
  const [form, setForm] = useState({
    fullName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "",
    country: "", university: "", qualification: "", course: "", courseCode: "",
    grade: "", experience: "", bio: "", modes: ["online"], rate: "",
    availability: "", demoUrl: "", ageConfirmed: false, accuracyConfirmed: false,
    conductConfirmed: false, documentConsent: false,
  });
  const change = (e) => setForm((current) => ({ ...current, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const toggleMode = (mode) => setForm((current) => ({ ...current, modes: current.modes.includes(mode) ? current.modes.filter((item) => item !== mode) : [...current.modes, mode] }));
  const validate = () => {
    if (step === 0 && (!form.fullName || !form.country || !form.university || !form.qualification || !form.ageConfirmed)) return "Complete every eligibility field and confirm that you are at least 18.";
    if (step === 1 && (!form.course || !form.grade || !files.academic)) return "Add the course, your result, and academic evidence.";
    if (step === 2 && (form.bio.trim().length < 120 || !form.rate || !form.availability || !form.modes.length || !files.photo)) return "Add a profile photo, 120-character teaching statement, rate, availability, and lesson mode.";
    if (step === 3 && (!files.identity || !form.accuracyConfirmed || !form.conductConfirmed || !form.documentConsent)) return "Upload identity evidence and accept all declarations.";
    return "";
  };
  const next = () => { const issue = validate(); if (issue) return setError(issue); setError(""); setStep((value) => Math.min(3, value + 1)); };
  const submit = async () => {
    const issue = validate(); if (issue) return setError(issue);
    if (!user || !supabase) {
      localStorage.setItem("tutlab_return_to", "/become-a-tutor");
      return nav("/auth/login");
    }
    setStatus("submitting"); setError("");
    try {
      const applicationId = crypto.randomUUID();
      const paths = {};
      for (const [kind, file] of Object.entries(files)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${kind} document must be smaller than 10 MB.`);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${user.id}/${applicationId}/${kind}-${safeName}`;
        const bucket = kind === "photo" ? "tutor-photos" : "tutor-verification";
        const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        paths[`${kind}Path`] = path;
        if (kind === "photo") paths.photoUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      }
      const application = { ...form, ...paths, email: user.email, submittedAt: new Date().toISOString(), reviewRubric: ["identity", "academic_evidence", "subject_expertise", "teaching_quality", "professional_conduct"] };
      const { error: insertError } = await supabase.from("tutor_applications").insert({ id: applicationId, user_id: user.id, application, status: "submitted" });
      if (insertError) throw insertError;
      fetch("/.netlify/functions/tutor-application-notify", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("tutlab_token")}` }, body: JSON.stringify({ applicationId }) }).catch(() => {});
      setStatus("done");
    } catch (submissionError) { setError(submissionError.message); setStatus(""); }
  };
  const steps = [
    ["Eligibility", "Tell us who you are and where you studied."],
    ["Course evidence", "Apply only for courses your academic record supports."],
    ["Teaching profile", "Show students how you teach and when you are available."],
    ["Verification", "Provide identity evidence and complete the declarations."],
  ];
  if (!user) return <section className="tutor-apply-gate"><div className="gate-copy"><span className="overline">TUTOR APPLICATION</span><h1>Your application needs a verified account.</h1><p>Continue with Google first so your application, private documents, and review decision stay connected to you securely.</p><div className="gate-points"><span><ShieldCheck/>One account for your application status</span><span><BookOpen/>Private academic and identity evidence</span><span><Check/>Return here automatically after sign-in</span></div></div><div className="gate-card"><GoogleIcon/><h2>Continue securely</h2><p>You will return directly to the tutor application after choosing your Google account.</p><button className="dark-btn wide" onClick={() => { localStorage.setItem("tutlab_return_to", "/become-a-tutor"); nav("/auth/login"); }}>Continue with Google <ArrowRight/></button><small>Google shares your name and email. Your password is never shared with Tut Lab.</small></div></section>;
  if (status === "done") return <section className="application-success"><span><Check /></span><div className="overline">APPLICATION RECEIVED</div><h1>Your review has started.</h1><p>Your documents are stored privately. A reviewer will check identity, academic evidence, course expertise, teaching quality, and professional conduct before any tutor profile is published.</p><div className="review-timeline">{["Submitted", "Identity review", "Academic review", "Teaching assessment", "Decision"].map((item, index) => <div className={index === 0 ? "current" : ""} key={item}><b>{index + 1}</b><span>{item}</span></div>)}</div><button className="dark-btn" onClick={() => nav("/")}>Return home</button></section>;
  return <section className="page tutor-apply-page">
    <aside className="application-guide"><button className="back" onClick={() => nav("/")}>← Back home</button><span className="overline">TUTOR APPLICATION</span><h1>Teach with credibility.</h1><p>Every application is reviewed before a profile can go live. Submission does not guarantee approval.</p><div className="evaluation-list">{[[ShieldCheck, "Identity and age", "A clear government-issued photo ID."], [BookOpen, "Academic evidence", "A transcript or qualification supporting the course."], [Star, "Teaching assessment", "Accuracy, clarity, structure, and student focus."], [Users, "Professional conduct", "Agreement to safety and platform standards."]].map(([Icon, title, text]) => <div key={title}><Icon/><span><b>{title}</b><small>{text}</small></span></div>)}</div></aside>
    <form className="application-form" onSubmit={(e) => e.preventDefault()}>
      <div className="application-progress">{steps.map((item, index) => <React.Fragment key={item[0]}><button type="button" className={index === step ? "active" : index < step ? "complete" : ""} onClick={() => index < step && setStep(index)}>{index < step ? <Check/> : index + 1}</button>{index < steps.length - 1 && <i/>}</React.Fragment>)}</div>
      <small>STEP {step + 1} OF {steps.length}</small><h2>{steps[step][0]}</h2><p>{steps[step][1]}</p>
      {step === 0 && <><label>Legal name<input required name="fullName" value={form.fullName} onChange={change} placeholder="As shown on your ID"/></label><div className="two-col"><label>Country of residence<input required name="country" value={form.country} onChange={change}/></label><label>University or institution<input required name="university" value={form.university} onChange={change}/></label></div><label>Highest qualification or current programme<input required name="qualification" value={form.qualification} onChange={change} placeholder="e.g. BSc Computer Engineering, Year 3"/></label><label className="application-consent"><input type="checkbox" name="ageConfirmed" checked={form.ageConfirmed} onChange={change}/><span>I confirm that I am at least 18 years old.</span></label></>}
      {step === 1 && <><div className="two-col"><label>Course you want to teach<input required name="course" value={form.course} onChange={change} placeholder="e.g. Calculus II"/></label><label>Course code<input name="courseCode" value={form.courseCode} onChange={change} placeholder="e.g. MATH 201"/></label></div><label>Your grade or result in this course<input required name="grade" value={form.grade} onChange={change} placeholder="Use the grading system on your transcript"/></label><label className="file-field">Academic evidence <small>Transcript, certificate, or official result · PDF/JPG/PNG · max 10 MB</small><input required type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFiles({...files, academic: e.target.files[0]})}/><span>{files.academic?.name || "Choose academic document"}</span></label><p className="review-note"><ShieldCheck/> A reviewer checks that the named institution, course, and result match your application.</p></>}
      {step === 2 && <><label className="file-field">Tutor profile photo <small>Clear, recent head-and-shoulders photo · JPG/PNG · max 5 MB</small><input required type="file" accept=".jpg,.jpeg,.png" onChange={(e) => setFiles({...files, photo: e.target.files[0]})}/><span>{files.photo?.name || "Choose profile photo"}</span></label><label>Teaching statement <small>{form.bio.length}/600</small><textarea required maxLength="600" name="bio" value={form.bio} onChange={change} placeholder="Explain how you help students understand difficult concepts, structure lessons, and adapt your teaching."/></label><div className="two-col"><label>Teaching experience<select name="experience" value={form.experience} onChange={change}><option value="">Select</option><option>New tutor</option><option>Less than 1 year</option><option>1–3 years</option><option>3+ years</option></select></label><label>Proposed hourly rate<input required type="number" min="1" name="rate" value={form.rate} onChange={change}/></label></div><fieldset><legend>Lesson modes</legend><div className="application-modes">{["online", "in-person"].map((mode) => <button type="button" className={form.modes.includes(mode) ? "selected" : ""} onClick={() => toggleMode(mode)} key={mode}>{mode === "online" ? <Monitor/> : <MapPin/>}{mode}</button>)}</div></fieldset><label>Weekly availability<input required name="availability" value={form.availability} onChange={change} placeholder="e.g. Mon–Thu after 4 PM GMT"/></label><label>Teaching demonstration link <small>Recommended before interview</small><input type="url" name="demoUrl" value={form.demoUrl} onChange={change} placeholder="Public or unlisted video link"/></label></>}
      {step === 3 && <><label className="file-field">Government-issued photo ID <small>Passport, national ID, or driver's licence · PDF/JPG/PNG · max 10 MB</small><input required type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFiles({...files, identity: e.target.files[0]})}/><span>{files.identity?.name || "Choose identity document"}</span></label>{[["accuracyConfirmed", "The information and documents I provided are accurate and belong to me."], ["conductConfirmed", "I agree to professional conduct, academic integrity, and student-safety standards."], ["documentConsent", "I consent to Tut Lab using these documents only to evaluate and verify my application."]].map(([name, text]) => <label className="application-consent" key={name}><input type="checkbox" name={name} checked={form[name]} onChange={change}/><span>{text}</span></label>)}<div className="decision-note"><ShieldCheck/><span><b>What happens next</b><small>A reviewer may approve, request more information, invite you to a teaching assessment, or decline. Your profile remains unpublished until approval.</small></span></div></>}
      {error && <div className="form-alert error">{error}</div>}
      <div className="application-actions">{step > 0 && <button type="button" className="outline-btn" onClick={() => { setError(""); setStep(step - 1); }}>Back</button>}<button type="button" className="dark-btn" disabled={status === "submitting"} onClick={step === 3 ? submit : next}>{status === "submitting" ? "Submitting securely…" : step === 3 ? "Submit for review" : "Continue"}<ArrowRight/></button></div>
      <small className="form-note">Documents are private and never displayed on your public profile.</small>
    </form>
  </section>;
}

function TutorApplicationsAdmin({ nav, user }) {
  const adminEmail = "sasuthomasansong@gmail.com";
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    if (!supabase || user?.email?.toLowerCase() !== adminEmail) { setLoading(false); return; }
    const { data, error: loadError } = await supabase.from("tutor_applications").select("*").order("created_at", { ascending: false });
    if (loadError) setError(loadError.message); else setApplications(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);
  const openEvidence = async (path, bucket = "tutor-verification") => {
    const { data, error: signError } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    if (signError) return setError(signError.message);
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const review = async (item, status) => {
    const reason = ["rejected", "more_information"].includes(status) ? window.prompt("Enter the reason the applicant will receive:") : "";
    if (["rejected", "more_information"].includes(status) && !reason?.trim()) return;
    setError("");
    if (status === "approved") {
      const a = item.application;
      const { error: tutorError } = await supabase.from("tutors").upsert({ id: item.user_id, user_id: item.user_id, name: a.fullName, course: a.course, school: a.university, price: Number(a.rate), image: a.photoUrl, mode: a.modes.join(" & "), modes: a.modes, available: a.availability, published: true });
      if (tutorError) return setError(tutorError.message);
    }
    const stage = status === "interview_scheduled" ? "interview" : status === "approved" || status === "rejected" ? "complete" : status;
    const { error: reviewError } = await supabase.from("tutor_applications").update({ status, review_stage: stage, reviewer_id: user.id, decision_reason: reason || null, reviewed_at: ["approved", "rejected"].includes(status) ? new Date().toISOString() : null }).eq("id", item.id);
    if (reviewError) setError(reviewError.message); else load();
  };
  if (!user) return <section className="admin-denied"><ShieldCheck/><h1>Admin sign-in required</h1><button className="dark-btn" onClick={() => { localStorage.setItem("tutlab_return_to", "/admin/tutor-applications"); nav("/auth/login"); }}>Continue with Google</button></section>;
  if (user.email?.toLowerCase() !== adminEmail) return <section className="admin-denied"><ShieldCheck/><h1>Restricted review area</h1><p>This page is available only to the designated tutor reviewer.</p><button className="dark-btn" onClick={() => nav("/")}>Return home</button></section>;
  return <section className="admin-applications page"><div className="admin-heading"><div><span className="overline">ADMIN REVIEW</span><h1>Tutor applications</h1><p>Interview and approve applicants before their profiles become public.</p></div><button className="outline-btn" onClick={load}>Refresh</button></div>{error && <div className="form-alert error">{error}</div>}{loading ? <p>Loading applications…</p> : !applications.length ? <div className="empty"><ShieldCheck/><h3>No tutor applications yet</h3></div> : <div className="admin-application-list">{applications.map((item) => { const a = item.application || {}; return <article key={item.id}><div className="applicant-head"><img src={a.photoUrl} alt=""/><div><span className={`status-chip status-${item.status}`}>{String(item.status).replaceAll("_", " ")}</span><h2>{a.fullName}</h2><p>{a.course}{a.courseCode ? ` · ${a.courseCode}` : ""} · {a.university}</p></div></div><div className="applicant-facts"><span><b>Result</b>{a.grade}</span><span><b>Experience</b>{a.experience || "Not stated"}</span><span><b>Rate</b>{a.rate}</span><span><b>Availability</b>{a.availability}</span></div><p className="applicant-bio">{a.bio}</p><div className="evidence-actions"><button onClick={() => openEvidence(a.identityPath)}>View ID</button><button onClick={() => openEvidence(a.academicPath)}>View academic evidence</button>{a.demoUrl && <button onClick={() => window.open(a.demoUrl, "_blank", "noopener,noreferrer")}>Teaching demo</button>}</div><div className="review-actions"><button onClick={() => review(item, "more_information")}>Request information</button><button onClick={() => review(item, "interview_scheduled")}>Schedule interview</button><button className="reject" onClick={() => review(item, "rejected")}>Reject</button><button className="approve" onClick={() => review(item, "approved")}>Approve tutor</button></div></article>; })}</div>}</section>;
}

function AuthPage({ kind, onAuth }) {
  const mode = ["signup", "forgot"].includes(kind) ? kind : "login";
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const socialAuth = async (provider) => {
    setSuccess("");
    setError("");
    if (!supabase)
      return setError("Add your Supabase URL and publishable key to .env first.");
    setLoading(true);
    const providerKey = provider === "Google" ? "google" : "linkedin_oidc";
    if (!(await oauthProviderEnabled(providerKey))) {
      setError(`${provider} sign-in is not enabled in Supabase yet.`);
      setLoading(false);
      return;
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: providerKey,
      options: {
        redirectTo: `${location.origin}/`,
        queryParams:
          provider === "Google"
            ? { prompt: "select_account", access_type: "offline" }
            : undefined,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (mode === "signup" && form.password !== form.confirm)
      return setError("Passwords do not match.");
    setLoading(true);
    try {
      if (mode === "forgot") {
        await api("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: form.email }),
        });
        setSuccess(
          "If an account exists, reset instructions have been created.",
        );
      } else {
        const data = await api("/auth/" + mode, {
          method: "POST",
          body: JSON.stringify(form),
        });
        if (data.confirmationRequired) {
          setSuccess("Check your email to confirm your account, then log in.");
          return;
        }
        localStorage.setItem("tutlab_token", data.token);
        if (data.refreshToken)
          localStorage.setItem("tutlab_refresh_token", data.refreshToken);
        localStorage.setItem("tutlab_user", JSON.stringify(data.user));
        if (mode === "login")
          api("/auth/login-notification", {
            method: "POST",
            body: JSON.stringify({ provider: "password" }),
          }).catch(() => {});
        onAuth(data.user);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const title = mode === "forgot" ? "Account recovery" : "Continue to Tut Lab";
  return (
    <main className={`auth-shell auth-${mode}`}>
      <section className="auth-visual">
        <div className="auth-brand">
          <Logo />
        </div>
        <div className="auth-quote">
          <div className="quote-mark">“</div>
          <blockquote>
            Great tutoring doesn’t give you the answer. It helps you see how to
            find it.
          </blockquote>
          <p>
            Learn with verified tutors who understand your course, your campus,
            and your goals.
          </p>
          <div className="auth-proof">
            <div className="proof-faces">
              {tutors.map((t) => (
                <img key={t.id} src={t.image} alt="" />
              ))}
            </div>
            <span>
              <b>Trusted by students worldwide</b>
              <small>Online and in-person learning</small>
            </span>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-form">
          <button className="back" onClick={() => (location.hash = "/")}>
            ← Back to Tut Lab
          </button>
          <span className="overline">
            {mode === "login"
              ? "STUDENT & TUTOR PORTAL"
              : mode === "signup"
                ? "JOIN TUT LAB"
                : "ACCOUNT RECOVERY"}
          </span>
          <h1>{title}</h1>
          <p>
            {mode === "login" ? (
              <>
                New to Tut Lab?{" "}
                <button onClick={() => (location.hash = "/auth/signup")}>
                  Create an account
                </button>
              </>
            ) : mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button onClick={() => (location.hash = "/auth/login")}>
                  Log in
                </button>
              </>
            ) : (
              "Enter the email linked to your account."
            )}
          </p>
          {mode !== "forgot" && <SocialAuth onSelect={socialAuth} />}
          {mode !== "forgot" && error && <div className="form-alert error social-error">{error}</div>}
          <form onSubmit={submit}>
            {mode === "signup" && (
              <div className="two-col">
                <label>
                  First name
                  <input
                    required
                    name="firstName"
                    value={form.firstName}
                    onChange={change}
                  />
                </label>
                <label>
                  Last name
                  <input
                    required
                    name="lastName"
                    value={form.lastName}
                    onChange={change}
                  />
                </label>
              </div>
            )}
            <label>
              Email address
              <input
                required
                type="email"
                name="email"
                value={form.email}
                onChange={change}
                placeholder="you@university.edu"
              />
            </label>
            {mode === "signup" && (
              <label>
                Phone number
                <input
                  required
                  name="phone"
                  value={form.phone}
                  onChange={change}
                  placeholder="024 000 0000"
                />
              </label>
            )}
            {mode !== "forgot" && (
              <>
                <label className="password-label">
                  <span>
                    Password{" "}
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => (location.hash = "/auth/forgot")}
                      >
                        Forgot password?
                      </button>
                    )}
                  </span>
                  <div className="password-field">
                    <input
                      required
                      minLength="8"
                      type={show ? "text" : "password"}
                      name="password"
                      value={form.password}
                      onChange={change}
                      placeholder="At least 8 characters"
                    />
                    <button type="button" onClick={() => setShow(!show)}>
                      {show ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                </label>
                {mode === "signup" && (
                  <label>
                    Confirm password
                    <input
                      required
                      type={show ? "text" : "password"}
                      name="confirm"
                      value={form.confirm}
                      onChange={change}
                    />
                  </label>
                )}
              </>
            )}
            {error && <div className="form-alert error">{error}</div>}
            {success && <div className="form-alert success">{success}</div>}
            <button className="dark-btn wide submit" disabled={loading}>
              {loading
                ? "Please wait…"
                : mode === "login"
                  ? "Log in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset instructions"}{" "}
              {!loading && <ArrowRight />}
            </button>
          </form>
          <p className="auth-terms">
            By continuing, you agree to Tut Lab’s Terms of Service and Privacy
            Policy.
          </p>
        </div>
      </section>
    </main>
  );
}
function Footer({ nav }) {
  return (
    <footer>
      <div>
        <Logo />
        <p>University tutoring, built around how you learn.</p>
      </div>
      <div>
        <b>Explore</b>
        <button onClick={() => nav("/tutors")}>Find a tutor</button>
        <button onClick={() => nav("/learn")}>Free lessons</button>
      </div>
      <div>
        <b>Tutors</b>
        <button onClick={() => nav("/become-a-tutor")}>Become a tutor</button>
        <button>Verification</button>
      </div>
      <div>
        <b>Support</b>
        <button>Help centre</button>
        <button>Safety</button>
      </div>
      <small>© 2026 Tut Lab. University tutoring, online and in person.</small>
    </footer>
  );
}
function SocialProof() {
  const [open, setOpen] = useState(0);
  const faqs = [
    [
      "Can I search for my exact course?",
      "Yes. Search by course title, code, topic, tutor, or university. If it is not indexed yet, you can enter it for review.",
    ],
    [
      "What does tutor verification mean?",
      "Verification can include identity, university affiliation, academic evidence, and approval for each course a tutor wants to teach. The profile shows completed checks.",
    ],
    [
      "Can lessons be online or in person?",
      "Tutors choose which modes they offer. In-person lessons use tutor-approved public campus locations rather than private home addresses.",
    ],
  ];
  return (
    <>
      <section className="outcomes">
        <div>
          <strong>Built for real university courses.</strong>
          <span>Search by institution, course code, subject, or topic.</span>
        </div>
        <div>
          <b>Course-specific</b>
          <small>approval for subjects tutors teach</small>
        </div>
        <div>
          <b>Flexible</b>
          <small>online and in-person sessions</small>
        </div>
        <div>
          <b>Open catalog</b>
          <small>add a course that is not listed yet</small>
        </div>
      </section>
      <section className="stories section">
        <div className="story-copy">
          <span className="overline">WHY TUT LAB</span>
          <h2>Help that fits the course you are actually taking.</h2>
          <p>
            Course names and syllabuses differ between universities. Tut Lab is
            designed to match students with tutors using the institution, course
            code, and topic—not a generic subject label alone.
          </p>
          <div className="story-rating">
            <ShieldCheck />
            <b>Reviews are accepted only after completed bookings</b>
          </div>
        </div>
        <article className="quote-card">
          <span className="overline">A CLEARER MATCH</span>
          <h3>Choose with useful information.</h3>
          <p>
            Tutor profiles can show approved courses, teaching modes, prices,
            availability, learning resources, and reviews connected to completed
            sessions.
          </p>
          <div className="quote-points">
            <span>
              <Check />
              Course approval status
            </span>
            <span>
              <Check />
              Published availability
            </span>
            <span>
              <Check />
              Session-based reviews
            </span>
          </div>
        </article>
      </section>
      <section className="faq-section">
        <div className="faq-wrap">
          <div>
            <span className="overline">GOOD TO KNOW</span>
            <h2>Clear answers before you book.</h2>
            <p>How search, verification, and lesson modes work.</p>
          </div>
          <div className="faq-list">
            {faqs.map((f, i) => (
              <article className={open === i ? "open" : ""} key={f[0]}>
                <button onClick={() => setOpen(open === i ? -1 : i)}>
                  <span>{f[0]}</span>
                  <b>{open === i ? "−" : "+"}</b>
                </button>
                {open === i && <p>{f[1]}</p>}
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
function RequestTutor({ nav }) {
  const [form, setForm] = useState({
    subject: "",
    university: "",
    level: "",
    location: "",
    mode: "online",
    language: "English",
    budget: "",
    details: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      await api("/tutor-requests", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("");
    }
  };
  if (status === "done")
    return (
      <section className="request-success">
        <span>
          <Check />
        </span>
        <h1>Your learning request is ready.</h1>
        <p>
          It has been saved securely. Relevant tutors can respond once matching
          and notifications are enabled for your account.
        </p>
        <button className="dark-btn" onClick={() => nav("/tutors")}>
          Browse tutors now <ArrowRight />
        </button>
      </section>
    );
  return (
    <section className="request-page">
      <div className="request-intro">
        <button className="back" onClick={() => nav("/")}>
          ← Back home
        </button>
        <span className="overline">LET TUTORS FIND YOU</span>
        <h1>Tell us what you need help with.</h1>
        <p>
          Share the course, your level, preferred lesson format, and budget. Tut
          Lab uses these details to identify suitable tutor profiles.
        </p>
        <div className="request-benefits">
          <span>
            <Search />
            <b>Matched by course and university</b>
          </span>
          <span>
            <ShieldCheck />
            <b>Your contact details stay private</b>
          </span>
          <span>
            <Users />
            <b>Review profiles before you book</b>
          </span>
        </div>
      </div>
      <form className="request-form" onSubmit={submit}>
        <div className="form-heading">
          <span>Learning requirement</span>
          <small>Required fields are marked *</small>
        </div>
        <label>
          Course, subject, or skill *
          <input
            required
            name="subject"
            value={form.subject}
            onChange={change}
            placeholder="e.g. CPEN 304 — Digital Signal Processing"
          />
        </label>
        <div className="two-col">
          <label>
            University
            <input
              name="university"
              value={form.university}
              onChange={change}
              placeholder="Type any university"
            />
          </label>
          <label>
            Academic level
            <select name="level" value={form.level} onChange={change}>
              <option value="">Select level</option>
              <option>Undergraduate</option>
              <option>Postgraduate</option>
              <option>Professional qualification</option>
              <option>Other</option>
            </select>
          </label>
        </div>
        <label>
          What do you need help with? *
          <textarea
            required
            name="details"
            value={form.details}
            onChange={change}
            placeholder="Describe the topics, goals, deadline, or problems you want to work through."
          />
        </label>
        <fieldset>
          <legend>Lesson format *</legend>
          <div className="request-modes">
            {[
              ["online", "Online"],
              ["in-person", "In person"],
              ["either", "Either works"],
            ].map((x) => (
              <label
                className={form.mode === x[0] ? "selected" : ""}
                key={x[0]}
              >
                <input
                  type="radio"
                  name="mode"
                  value={x[0]}
                  checked={form.mode === x[0]}
                  onChange={change}
                />
                {x[0] === "online" ? <Monitor /> : <MapPin />}
                {x[1]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="two-col">
          <label>
            {form.mode === "online" ? "Time zone" : "City or campus"}
            <input
              name="location"
              value={form.location}
              onChange={change}
              placeholder={
                form.mode === "online"
                  ? "e.g. GMT +0"
                  : "e.g. Accra, Legon campus"
              }
            />
          </label>
          <label>
            Preferred language
            <input
              name="language"
              value={form.language}
              onChange={change}
              placeholder="English"
            />
          </label>
        </div>
        <label>
          Budget per hour
          <input
            name="budget"
            type="number"
            min="0"
            value={form.budget}
            onChange={change}
            placeholder="Enter an amount in your local currency"
          />
        </label>
        {error && <div className="form-alert error">{error}</div>}
        <button className="gold-btn wide" disabled={status === "submitting"}>
          {status === "submitting"
            ? "Saving request…"
            : "Post learning request"}
          <ArrowRight />
        </button>
        <small className="privacy-note">
          <ShieldCheck /> Do not include phone numbers, email addresses, or
          payment details.
        </small>
      </form>
    </section>
  );
}
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Tut Lab render error", error, info);
  }
  reset = () => {
    localStorage.removeItem("tutlab_user");
    localStorage.removeItem("tutlab_token");
    localStorage.removeItem("tutlab_refresh_token");
    location.assign("/");
  };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="app-error">
        <Logo />
        <span className="overline">LET'S TRY THAT AGAIN</span>
        <h1>Tut Lab needs a quick refresh.</h1>
        <p>Your saved sign-in session may be outdated. Clear it and reload safely.</p>
        <button className="dark-btn" onClick={this.reset}>Clear session and reload</button>
      </main>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <AppErrorBoundary><App /></AppErrorBoundary>,
);
