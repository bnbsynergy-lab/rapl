/* RAPL account layer: email sign-in, server-tracked builds, Unlimited + AppSumo access.
   Talks to Supabase project "Rapl". The publishable key below is safe to be public;
   all access rules are enforced in the database. */
(function () {
  "use strict";

  var SUPABASE_URL = "https://wtfjrokinshncpdutanr.supabase.co";
  var SUPABASE_KEY = "sb_publishable_EI0_Qau0N53s0eBI0_DUsw_c6cY5XzU";
  var WHATSAPP_URL = "https://whatsapp.com/channel/0029Vb9TN1LFXUuWuo3via1M";
  var INTENT_KEY = "rapl-pending-intent";

  if (!window.supabase || !window.supabase.createClient) {
    console.error("RAPL: Supabase library failed to load.");
    return;
  }

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" }
  });

  var state = { session: null, status: null };

  /* ---------- styles (match the app's emerald / plum / gold look) ---------- */
  var css = [
    ".rapl-ov{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;",
    "background:rgb(5 6 8/72%);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:Arial,Helvetica,sans-serif}",
    ".rapl-card{width:100%;max-width:420px;color:#fff8e8;border:1px solid rgb(232 184 88/24%);border-radius:20px;padding:26px 22px 22px;",
    "background:radial-gradient(circle at 85% 5%,rgb(100 28 112/42%),transparent 42%),linear-gradient(145deg,rgb(16 63 48/96%),rgb(24 11 30/98%));",
    "box-shadow:0 30px 90px rgb(0 0 0/45%),inset 0 1px 0 rgb(255 255 255/8%);position:relative}",
    ".rapl-card h3{margin:0 0 6px;font:26px Georgia,serif;color:#fff8e8}",
    ".rapl-card p{margin:0 0 14px;color:#cbbecf;font-size:15px;line-height:1.45}",
    ".rapl-eyebrow{color:#e8b858;font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px}",
    ".rapl-card label{display:block;font-size:12px;color:#f7dda0;letter-spacing:.06em;text-transform:uppercase;margin:12px 0 6px}",
    ".rapl-card input{width:100%;box-sizing:border-box;min-height:46px;border-radius:9px;border:1px solid rgb(232 184 88/30%);",
    "background:rgb(3 13 11/45%);color:#fff8e8;padding:11px 14px;font-size:16px;outline:none}",
    ".rapl-card input:focus{border-color:#e8b858}",
    ".rapl-btn{display:flex;width:100%;align-items:center;justify-content:center;min-height:46px;margin-top:16px;border-radius:9px;",
    "border:1px solid #f6d987;color:#241128;background:linear-gradient(135deg,#f7dda0,#e8b858);font-weight:750;font-size:15px;cursor:pointer;text-decoration:none}",
    ".rapl-btn[disabled]{opacity:.6;cursor:wait}",
    ".rapl-link{background:none;border:0;color:#f7dda0;text-decoration:underline;cursor:pointer;font-size:14px;padding:6px 0;margin-top:10px}",
    ".rapl-x{position:absolute;top:12px;right:14px;background:none;border:0;color:#cbbecf;font-size:24px;cursor:pointer;line-height:1}",
    ".rapl-msg{margin-top:12px;font-size:14px;color:#f7dda0}",
    ".rapl-err{margin-top:12px;font-size:14px;color:#ff9c8f}",
    ".rapl-badge{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:9000;display:flex;gap:8px;align-items:center;max-width:calc(100vw - 20px);",
    "padding:7px 12px;border-radius:999px;border:1px solid rgb(232 184 88/30%);background:rgb(10 12 14/78%);color:#f7dda0;",
    "font:12px Arial,Helvetica,sans-serif;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}",
    ".rapl-badge b{color:#e8b858}.rapl-badge button{background:none;border:0;color:#cbbecf;text-decoration:underline;cursor:pointer;font-size:12px;padding:0}",
    ".rapl-badge span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
  ].join("");
  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- helpers ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function modal(build) {
    return new Promise(function (resolve) {
      var done = false;
      var ov = el("div", { class: "rapl-ov", role: "dialog", "aria-modal": "true" });
      var card = el("div", { class: "rapl-card" });
      function close(v) {
        if (done) return; done = true;
        ov.remove(); document.removeEventListener("keydown", onKey); resolve(v);
      }
      function onKey(e) { if (e.key === "Escape") close(null); }
      card.appendChild(el("button", { class: "rapl-x", "aria-label": "Close", text: "×", onclick: function () { close(null); } }));
      build(card, close);
      ov.appendChild(card);
      ov.addEventListener("click", function (e) { if (e.target === ov) close(null); });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(ov);
      var first = card.querySelector("input"); if (first) setTimeout(function () { first.focus(); }, 50);
    });
  }
  function setIntent(v) { try { v ? localStorage.setItem(INTENT_KEY, v) : localStorage.removeItem(INTENT_KEY); } catch (e) {} }
  function getIntent() { try { return localStorage.getItem(INTENT_KEY); } catch (e) { return null; } }
  function cleanRedirect() { return location.origin + location.pathname; }

  /* ---------- sign-in (email link or 6-digit code) ---------- */
  function signInModal(opts) {
    opts = opts || {};
    return modal(function (card, close) {
      var emailIn = el("input", { type: "email", autocomplete: "email", inputmode: "email", placeholder: "you@example.com" });
      var msg = el("div");
      var btn = el("button", { class: "rapl-btn", text: "Email me a sign-in code" });
      var step1 = el("div", null, [
        el("div", { class: "rapl-eyebrow", text: opts.eyebrow || "SAVE YOUR AI EMPLOYEES" }),
        el("h3", { text: opts.title || "Sign in to RAPL" }),
        el("p", { text: opts.body || "Enter your email and we’ll send you a sign-in code. No password needed." }),
        el("label", { text: "Email" }), emailIn, btn, msg
      ]);
      card.appendChild(step1);

      function showCodeStep(email) {
        var codeIn = el("input", { type: "text", inputmode: "numeric", autocomplete: "one-time-code", placeholder: "6-digit code", maxlength: "10" });
        var vBtn = el("button", { class: "rapl-btn", text: "Sign in" });
        var vMsg = el("div");
        var step2 = el("div", null, [
          el("div", { class: "rapl-eyebrow", text: "CHECK YOUR EMAIL" }),
          el("h3", { text: "Enter your code" }),
          el("p", { text: "We sent a code to " + email + ". Type it below, or tap the link in that email. Check spam if you don’t see it." }),
          el("label", { text: "Code" }), codeIn, vBtn, vMsg,
          el("button", { class: "rapl-link", text: "Use a different email", onclick: function () { step2.remove(); card.appendChild(step1); } })
        ]);
        step1.remove(); card.appendChild(step2);
        setTimeout(function () { codeIn.focus(); }, 50);
        async function verify() {
          var token = (codeIn.value || "").replace(/\D/g, "");
          if (token.length < 6) { vMsg.className = "rapl-err"; vMsg.textContent = "Enter the code from your email."; return; }
          vBtn.disabled = true; vMsg.className = "rapl-msg"; vMsg.textContent = "Checking…";
          var r = await sb.auth.verifyOtp({ email: email, token: token, type: "email" });
          vBtn.disabled = false;
          if (r.error) { vMsg.className = "rapl-err"; vMsg.textContent = "That code didn’t work or expired. Request a new one."; return; }
          state.session = r.data.session; setIntent(null);
          await refresh();
          close(true);
        }
        vBtn.addEventListener("click", verify);
        codeIn.addEventListener("keydown", function (e) { if (e.key === "Enter") verify(); });
      }

      async function send() {
        var email = (emailIn.value || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = "rapl-err"; msg.textContent = "Enter a valid email address."; return; }
        btn.disabled = true; msg.className = "rapl-msg"; msg.textContent = "Sending…";
        if (opts.intent) setIntent(opts.intent);
        var r = await sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true, emailRedirectTo: cleanRedirect() } });
        btn.disabled = false;
        if (r.error) {
          msg.className = "rapl-err";
          msg.textContent = /rate|seconds/i.test(r.error.message)
            ? "Please wait a minute before requesting another code."
            : "We couldn’t send the email right now. Try again in a minute, or contact support@bnbsynergy.com.";
          return;
        }
        showCodeStep(email);
      }
      btn.addEventListener("click", send);
      emailIn.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
    });
  }

  async function ensureSignedIn(opts) {
    if (state.session) return true;
    var s = (await sb.auth.getSession()).data.session;
    if (s) { state.session = s; return true; }
    var ok = await signInModal(opts);
    return !!ok;
  }

  /* ---------- account status ---------- */
  async function refresh() {
    if (!state.session) { state.status = null; renderBadge(); return null; }
    var r = await sb.rpc("rapl_status");
    if (r.error) { console.error("RAPL status", r.error); return state.status; }
    state.status = r.data; renderBadge();
    return state.status;
  }

  var badge = null;
  function renderBadge() {
    if (!document.body) return;
    if (!state.session || !state.status) { if (badge) { badge.remove(); badge = null; } return; }
    var st = state.status;
    var plan = st.unlimited ? "Unlimited" : Math.max(0, st.free_limit - st.free_used) + " of " + st.free_limit + " free builds left";
    if (!badge) { badge = el("div", { class: "rapl-badge" }); document.body.appendChild(badge); }
    badge.innerHTML = "";
    badge.appendChild(el("span", { text: st.email }));
    badge.appendChild(el("b", { text: plan }));
    badge.appendChild(el("button", { text: "Sign out", onclick: async function () { await sb.auth.signOut(); state.session = null; state.status = null; renderBadge(); } }));
  }

  /* ---------- builds ---------- */
  // Returns {allowed, unlimited, free_used} or null if the person closed sign-in.
  async function useBuild() {
    var ok = await ensureSignedIn({
      eyebrow: "ALMOST THERE",
      title: "Where should we save your employee?",
      body: "Enter your email to unlock your 3 free builds. We’ll send a quick sign-in code — no password.",
      intent: "build"
    });
    if (!ok) return null;
    var r = await sb.rpc("rapl_use_build");
    if (r.error) throw new Error("We couldn’t reach RAPL right now. Check your connection and try again.");
    await refresh();
    return r.data;
  }

  /* ---------- checkout links carry the account so payments unlock the right person ---------- */
  function checkoutUrl(url) {
    try {
      var u = new URL(url);
      var s = state.session;
      if (s && s.user) {
        u.searchParams.set("client_reference_id", s.user.id);
        if (s.user.email) u.searchParams.set("prefilled_email", s.user.email);
      }
      return u.toString();
    } catch (e) { return url; }
  }

  /* ---------- AppSumo redemption ---------- */
  function codeFromUrl() {
    try { return new URL(location.href).searchParams.get("code") || ""; } catch (e) { return ""; }
  }
  async function openRedeem(prefill) {
    var ok = await ensureSignedIn({
      eyebrow: "APPSUMO MEMBERS",
      title: "Redeem your AppSumo code",
      body: "First, enter the email you want your lifetime RAPL Unlimited access on. We’ll send a sign-in code.",
      intent: "redeem"
    });
    if (!ok) return false;
    var result = await modal(function (card, close) {
      var nameIn = el("input", { type: "text", autocomplete: "name", placeholder: "Your name" });
      var codeIn = el("input", { type: "text", autocapitalize: "characters", placeholder: "RAPL-XXXX-XXXX-XXXX", value: prefill || codeFromUrl() || "" });
      var btn = el("button", { class: "rapl-btn", text: "Unlock Lifetime Unlimited" });
      var msg = el("div");
      card.appendChild(el("div", null, [
        el("div", { class: "rapl-eyebrow", text: "APPSUMO LIFETIME DEAL" }),
        el("h3", { text: "Redeem your code" }),
        el("p", { text: "Signed in as " + ((state.session && state.session.user && state.session.user.email) || "you") + ". Your code unlocks unlimited builds on this account, forever." }),
        el("label", { text: "Name" }), nameIn,
        el("label", { text: "AppSumo code" }), codeIn, btn, msg
      ]));
      async function go() {
        var code = (codeIn.value || "").trim();
        if (!code) { msg.className = "rapl-err"; msg.textContent = "Enter your AppSumo code."; return; }
        btn.disabled = true; msg.className = "rapl-msg"; msg.textContent = "Checking your code…";
        var r = await sb.rpc("rapl_redeem_code", { p_code: code, p_name: nameIn.value || null });
        btn.disabled = false;
        if (r.error) { msg.className = "rapl-err"; msg.textContent = "Something went wrong. Try again, or email support@bnbsynergy.com."; return; }
        if (!r.data.ok) { msg.className = "rapl-err"; msg.textContent = r.data.error; return; }
        await refresh();
        card.innerHTML = "";
        card.appendChild(el("div", null, [
          el("div", { class: "rapl-eyebrow", text: "WELCOME TO RAPL" }),
          el("h3", { text: "You’re Unlimited. 👑" }),
          el("p", { text: "Lifetime unlimited builds are now on your account. Join the RAPL WhatsApp channel for new drops and build tips." }),
          el("a", { class: "rapl-btn", href: WHATSAPP_URL, target: "_blank", rel: "noreferrer", text: "Join RAPL on WhatsApp" }),
          el("button", { class: "rapl-link", text: "Start building", onclick: function () { close(true); } })
        ]));
      }
      btn.addEventListener("click", go);
      codeIn.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    });
    setIntent(null);
    if (location.hash === "#redeem") history.replaceState(null, "", location.pathname + location.search);
    return !!(state.status && state.status.unlimited) || !!result;
  }

  /* ---------- boot ---------- */
  sb.auth.onAuthStateChange(function (_event, session) {
    state.session = session;
    setTimeout(refresh, 0);
  });

  async function boot() {
    state.session = (await sb.auth.getSession()).data.session;
    await refresh();
    var wantsRedeem = location.hash === "#redeem" || /[?&]redeem\b/.test(location.search) || getIntent() === "redeem";
    if (wantsRedeem) openRedeem();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.RAPL = {
    useBuild: useBuild,
    refresh: refresh,
    openRedeem: openRedeem,
    checkoutUrl: checkoutUrl,
    signIn: ensureSignedIn,
    status: function () { return state.status; }
  };
})();
