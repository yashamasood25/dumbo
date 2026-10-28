/* Dumbo — app shell. Vanilla JS, no build step. All user data stays in localStorage on the device. */
(function () {
  "use strict";

  // ---- Config: paste your keys here ----
  const POSTHOG_KEY = "";          // e.g. "phc_xxx" from posthog.com → Project settings (free tier)
  const POSTHOG_HOST = "https://us.i.posthog.com";
  const FEEDBACK_URL = "";         // e.g. a Tally / Google Form link

  const CARDS = window.DUMBO_CARDS;
  const CATS = window.DUMBO_CATEGORIES;
  const E = window.Engine;
  const byId = Object.fromEntries(CARDS.map(c => [c.id, c]));
  const STORE = "dumbo.v1";

  // ---------- state ----------
  const fresh = () => ({ v: 1, wallet: [], usual: null, logs: [], pointValue: 1, flags: {}, createdAt: Date.now() });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(STORE) || "null") || {}); } catch (e) { S = fresh(); }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} };

  const ui = {
    view: S.wallet.length ? "pay" : "intro",
    sel: new Set(S.wallet.map(w => w.id)),
    search: "",
    cat: null,
    amount: "",
    editing: false
  };

  const walletCards = () => S.wallet.map(w => byId[w.id]).filter(Boolean);
  const W = id => S.wallet.find(w => w.id === id);

  // ---------- analytics (anonymous, no card details) ----------
  const queue = [];
  let ph = null;
  function track(event, props) {
    if (!POSTHOG_KEY) return;
    if (ph) ph.capture(event, props || {}); else queue.push([event, props]);
  }
  if (POSTHOG_KEY) {
    const s = document.createElement("script");
    s.src = POSTHOG_HOST.replace(".i.", "-assets.i.") + "/static/array.js";
    s.async = true;
    s.onload = () => {
      if (!window.posthog || !window.posthog.init) return;
      window.posthog.init(POSTHOG_KEY, { api_host: POSTHOG_HOST, autocapture: false, capture_pageview: true, persistence: "localStorage", person_profiles: "identified_only" });
      ph = window.posthog;
      queue.splice(0).forEach(([e, p]) => ph.capture(e, p || {}));
    };
    document.head.appendChild(s);
  }

  // ---------- helpers ----------
  const $ = (sel, el) => (el || document).querySelector(sel);
  const app = $("#app");
  const money = v => (Math.abs(v) >= 100 ? "$" + Math.round(v).toLocaleString() : "$" + v.toFixed(2));
  const whole = v => "$" + Math.round(v).toLocaleString();
  const rateLabel = (card, r) => card.unit === "x" ? `${+r.toFixed(2)}x` : `${+r.toFixed(2)}%`;
  const shortDate = d => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let deferredInstall = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; });

  const ICON = {
    dining: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3 4-3 7h3"/>',
    groceries: '<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>',
    gas: '<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M5 10h10M15 8l3 2v7a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
    flights: '<path d="M10.5 13.5 3 11l1.5-1.5 8 .5 4-4.5a2.1 2.1 0 0 1 3 3L15 13l.5 8L14 22.5 11.5 15 8 18.5V21l-1.5 1.5-1-3.5-3.5-1L3.5 16H6z"/>',
    hotels: '<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="2"/>',
    amazon: '<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
    online: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
    other: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>'
  };
  const svg = (inner, sw) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 1.5}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const tick = svg('<path d="m5 12 5 5 9-10"/>', 2.4);
  const info = svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/>', 1.8);
  const gear = `<button class="icon-btn" data-act="settings" aria-label="Settings">${svg('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>', 1.6)}</button>`;

  const mini = c => `<span class="mini" aria-hidden="true" style="background:${c.bg};color:${c.fg}"><span class="iss">${c.issuer === "American Express" ? "AMEX" : c.issuer}</span><span class="bot"><span class="n">${c.name.replace(/ Card$/, "")}</span><span class="chp"></span></span></span>`;

  function activeRotating(card) {
    const now = new Date();
    return (card.rotating || []).find(r => now >= new Date(r.from + "T00:00:00") && now <= new Date(r.to + "T23:59:59"));
  }

  function topRates(card) {
    const rot = activeRotating(card);
    if (rot) {
      const [cat, r] = Object.entries(rot.rates).sort((a, b) => b[1] - a[1])[0];
      return { text: `${rateLabel(card, r)} ${CATS.find(c => c.id === cat).label.toLowerCase()} this quarter`, gold: true };
    }
    const bonus = CATS.filter(c => c.id !== "other" && card.rates[c.id] > card.rates.other)
      .sort((a, b) => card.rates[b.id] - card.rates[a.id]).slice(0, 2)
      .map(c => `${rateLabel(card, card.rates[c.id])} ${c.label.toLowerCase()}`);
    if (!bonus.length) return { text: `${rateLabel(card, card.rates.other)} everything` };
    if (bonus.length === 1 && card.rates.other > 1) bonus.push(`${rateLabel(card, card.rates.other)} everything`);
    return { text: bonus.join(" · ") };
  }

  function bestFor(card) {
    const vals = CATS.filter(c => c.id !== "other").map(c => ({ c, r: card.rates[c.id] }));
    const max = Math.max(...vals.map(v => v.r));
    if (max <= card.rates.other) return "Same great rate on everything";
    const tops = vals.filter(v => v.r === max).slice(0, 2).map(v => v.c.label.toLowerCase());
    return "Best for " + tops.join(" & ");
  }

  // ---------- views ----------
  function vIntro() {
    const iosTip = isIOS() && !isStandalone()
      ? `<p class="ios-tip">On iPhone? <button class="link" data-act="install">Add Dumbo to your Home Screen first</button> so your wallet lives in the app.</p>` : "";
    return `
      <section class="intro">
        <div>
          <span class="wordmark">dumbo</span>
          <h1 class="display">Stop paying with the <em>wrong</em> card.</h1>
          <ul class="bullets">
            <li>Tells you which card to tap, wherever you pay</li>
            <li>Shows what your usual card is costing you</li>
            <li>Reminds you to pay before your statement closes</li>
          </ul>
          <section class="receipt" aria-label="Example">
            <div class="r head"><span>DINNER · 2 PEOPLE</span><span>$80.00</span></div>
            <div class="rule"></div>
            <div class="r"><span>Your usual card · 2%</span><span>$1.60</span></div>
            <div class="r" style="font-weight:500"><span>Best card in your wallet · 7%</span><span>$5.60</span></div>
            <div class="rule"></div>
            <div class="r total"><span>EXTRA YOU EARN</span><span style="color:#1E7A4C">+$4.00</span></div>
          </section>
        </div>
        <div class="stack" style="gap:16px">
          <div class="promise"><span>NO LOGIN</span><span>·</span><span>NO BANK LINK</span><span>·</span><span>STAYS ON YOUR PHONE</span></div>
          ${iosTip}
          <button class="btn btn-primary" data-act="start">Build my wallet</button>
        </div>
      </section>`;
  }

  function vPick() {
    const q = ui.search.trim().toLowerCase();
    const list = CARDS.filter(c => !q || (c.issuer + " " + c.name).toLowerCase().includes(q));
    const issuers = [...new Set(list.map(c => c.issuer))];
    const groups = issuers.map(iss => `
      <p class="issuer-name">${iss}</p>
      ${list.filter(c => c.issuer === iss).map(c => {
        const on = ui.sel.has(c.id), t = topRates(c);
        return `<button class="row-btn" data-pick="${c.id}" aria-pressed="${on}">${mini(c)}<span class="txt"><span class="nm">${c.name}</span><span class="sub ${t.gold ? "gold" : ""}">${t.text}</span></span><span class="check ${on ? "on" : ""}">${on ? tick : ""}</span></button>`;
      }).join("")}`).join("") || `<p class="muted" style="margin-top:24px">No match yet. Dumbo supports ${CARDS.length} popular U.S. cards today, with more coming.</p>`;
    const n = ui.sel.size;
    return `
      <div class="step-row">${ui.editing ? `<button class="link" data-act="back-wallet">← Wallet</button>` : `<span class="mono-label">STEP 1 OF 3</span>`}<span class="mono-label gold">${n} SELECTED</span></div>
      <h1 class="display" style="font-size:36px;margin-top:12px">${ui.editing ? "Edit your <em>cards</em>" : "Which cards do you <em>carry?</em>"}</h1>
      <label class="search">${svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', 1.6)}<input type="search" placeholder="Search your card" aria-label="Search your card" value="${ui.search}" data-input="search" autocomplete="off"></label>
      ${groups}
      <div class="sticky-cta"><div><button class="btn btn-primary" data-act="picked" ${n ? "" : "disabled"}>${ui.editing ? "Save" : n ? `Continue with ${n} card${n === 1 ? "" : "s"}` : "Pick at least one card"}</button></div></div>`;
  }

  function vUsual() {
    return `
      <span class="mono-label">STEP 2 OF 3</span>
      <h1 class="display" style="font-size:36px;margin-top:12px">Which one do you tap <em>without thinking?</em></h1>
      <p class="muted" style="margin:12px 0 0">Dumbo shows what that habit costs you, every time.</p>
      <div class="choice-list">
        ${walletCards().map(c => { const on = S.usual === c.id; return `<button class="row-btn" data-usual="${c.id}" aria-pressed="${on}">${mini(c)}<span class="txt"><span class="nm">${c.name}</span><span class="sub">${c.issuer}</span></span><span class="check ${on ? "on" : ""}">${on ? tick : ""}</span></button>`; }).join("")}
      </div>
      <div class="sticky-cta"><div><button class="btn btn-primary" data-act="usual-done" ${S.usual ? "" : "disabled"}>Continue</button></div></div>`;
  }

  function vDetails() {
    return `
      <div class="step-row"><span class="mono-label">STEP 3 OF 3</span><button class="link" data-act="finish">Skip</button></div>
      <h1 class="display" style="font-size:36px;margin-top:12px">Want a reminder <em>before</em> your bill?</h1>
      <p class="muted" style="margin:12px 0 0">Add a card's limit, balance and statement date. Dumbo tells you when to pay it down to protect your credit score. Optional, you can do it later.</p>
      <div class="choice-list">
        ${walletCards().map(c => { const w = W(c.id), done = w.limit && w.closeDay; return `<button class="row-btn" data-edit="${c.id}">${mini(c)}<span class="txt"><span class="nm">${c.name}</span><span class="sub ${done ? "" : ""}" style="${done ? "color:var(--gain)" : ""}">${done ? "✓ Details added" : "Add details"}</span></span><span class="muted">›</span></button>`; }).join("")}
      </div>
      <div class="sticky-cta"><div><button class="btn btn-primary" data-act="finish">Done, take me in</button></div></div>`;
  }

  function vPay() {
    const live = walletCards().some(activeRotating);
    const cats = CATS.map(c => `<button class="cat ${ui.cat === c.id ? "on" : ""}" data-cat="${c.id}" aria-pressed="${ui.cat === c.id}">${svg(ICON[c.id])}${c.id === "other" ? "Other" : c.label}</button>`).join("");
    const today = new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }).toUpperCase().replace(",", "");
    return `
      <div class="topbar"><span class="wordmark">dumbo</span>${gear}</div>
      <p class="mono-label gold">${today}${live ? " · Q4 BONUSES LIVE" : ""}</p>
      <h1 class="display ask">Where are you paying?</h1>
      <div class="cats">${cats}</div>
      <label class="amount"><span class="lbl">AMOUNT</span><input inputmode="decimal" placeholder="$0.00" value="${ui.amount ? "$" + ui.amount : ""}" data-input="amount" aria-label="Amount"></label>
      <div id="result">${ui.cat ? vResult() : `<p class="hint">Pick where you're paying. Add an amount to see real dollars.</p>`}</div>`;
  }

  function vResult() {
    const amt = parseFloat(ui.amount) || 0;
    const per = amt ? "" : " per $100";
    const ranked = E.rank(walletCards(), ui.cat, amt, { logs: S.logs, pointValue: S.pointValue });
    if (!ranked.length) return "";
    const best = ranked[0];
    const usual = ranked.find(r => r.card.id === S.usual);
    const cat = CATS.find(c => c.id === ui.cat);
    let boxes = "";

    // 1. What your usual card costs you (ledger)
    if (usual && usual.card.id !== best.card.id && best.value - usual.value > 0.004) {
      const lost = best.value - usual.value;
      boxes += `
        <section class="box first" aria-label="What your usual card costs you">
          <div class="ledger-row dash"><span>${best.card.name}</span><span class="mono gain">+${money(best.value)}</span></div>
          <div class="ledger-row solid"><span>${usual.card.name}<span class="tag">USUAL</span></span><span class="mono">+${money(usual.value)}</span></div>
          <div class="ledger-total"><span>Left on the table${per}</span><span class="mono loss">−${money(lost)}</span></div>
          <p class="small">${amt ? `Once a week, that's ${whole(lost * 52)} a year.` : "Add an amount to see real dollars."}</p>
        </section>`;
    } else if (usual) {
      boxes += `<section class="box good first">✓ Your usual card is already the best pick here. Tap away.</section>`;
    }

    // 2. Utilization guard on the best card
    const bw = W(best.card.id);
    if (bw && bw.limit && bw.balance != null && bw.closeDay) {
      const after = (bw.balance + amt) / bw.limit;
      const close = E.nextClose(bw.closeDay);
      if (after >= 0.3 && close.days <= 10) {
        const alt = ranked.slice(1).find(r => { const w = W(r.card.id); return !w || !w.limit || ((w.balance || 0) + amt) / w.limit < 0.3; });
        const pay = Math.ceil(bw.balance + amt - bw.limit * 0.09);
        boxes += `<section class="box warn">Your ${best.card.name} balance is getting high, and its statement is ${close.days === 0 ? "today" : "in " + close.days + " day" + (close.days === 1 ? "" : "s")}. Pay <b>${whole(pay)}</b> before ${shortDate(close.date)} to protect your credit score${alt ? `, or use <b>${alt.card.name}</b> and earn ${money(best.value - alt.value)} less` : ""}.</section>`;
      }
    }

    // 3. Bonus goal nudge
    const chasing = S.wallet
      .map(w => ({ w, g: E.goalProgress(w, S.logs) }))
      .filter(x => x.g && !x.g.done && !x.g.expired && x.w.id !== best.card.id)
      .sort((a, b) => (b.g.behind - a.g.behind) || (a.g.daysLeft - b.g.daysLeft))[0];
    if (chasing) {
      const r = ranked.find(r => r.card.id === chasing.w.id);
      const cost = best.value - r.value;
      boxes += `
        <section class="box plain" aria-label="Bonus goal">
          <div class="ledger-row" style="padding:0;font-size:13px"><span>${r.card.name} bonus</span><span class="mono muted">${whole(chasing.g.spent)} / ${whole(chasing.w.goal.target)}</span></div>
          <div class="bar thin"><i style="width:${chasing.g.pct * 100}%;background:var(--gold)"></i></div>
          <p style="margin:0;font-size:13px;color:var(--muted)">${chasing.g.behind ? "Behind pace" : "On track"}, ${chasing.g.daysLeft} days left. Using it here costs ${cost > 0.004 ? money(cost) + per : "you nothing"}. <button class="text-link" data-log="${r.card.id}">Use it instead</button></p>
        </section>`;
    }

    const notes = (best.bonusNote ? `<p class="note gold">${info}<span>${best.bonusNote}</span></p>` : "") +
                  (best.note ? `<p class="note">${info}<span>${best.note}</span></p>` : "");
    const runners = ranked.slice(1, 4).map(r => `<div class="runner">${mini(r.card)}<span class="n">${r.card.name}</span><span class="v">${rateLabel(r.card, r.headline)} · ${money(r.value)}</span></div>`).join("");
    const rl = rateLabel(best.card, best.headline);
    const ptsNote = best.card.type === "pts" ? ` · ${Math.round(best.units).toLocaleString()} pts` : "";

    return `
      <div class="result">
        <p class="mono-label">BEST CARD · ${cat.label.toUpperCase()}</p>
        <div class="hero" style="background:${best.card.bg};color:${best.card.fg}">
          <div class="row"><span class="iss">${best.card.issuer}</span><span class="rate">${rl.slice(0, -1)}<small>${rl.slice(-1)}</small></span></div>
          <div class="row end"><span class="nm">${best.card.name}</span><span class="chp"></span></div>
        </div>
        <div class="earn"><span class="big">+${money(best.value)}</span><span class="sub">back ${amt ? "on " + money(amt) : "per $100"}${ptsNote}</span></div>
        ${notes}
        ${boxes}
        <div class="used-row">
          <button class="btn btn-primary" data-log="${best.card.id}"><span>I used ${best.card.name}</span></button>
          <button class="btn btn-ghost" data-act="used-other" aria-label="I used a different card">···</button>
        </div>
        ${runners ? `<div class="runners"><p class="mono-label" style="margin-bottom:6px">NEXT BEST</p>${runners}</div>` : ""}
      </div>`;
  }

  function vWallet() {
    const now = new Date();
    const month = S.logs.filter(l => { const d = new Date(l.ts); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    const extra = month.reduce((s, l) => s + Math.max(0, l.value - (l.usualValue || 0)), 0);

    const todos = S.wallet.map(w => {
      if (!w.limit || w.balance == null || !w.closeDay) return null;
      const c = E.nextClose(w.closeDay); const pay = E.payToTen(w);
      if (!(pay > 0 && c.days <= 7)) return null;
      const by = new Date(c.date); if (c.days > 0) by.setDate(by.getDate() - 1);
      return `
        <section class="todo">
          <p class="t">To do ${c.days <= 1 ? "today" : "this week"}</p>
          <p class="b">Pay <b>${whole(pay)}</b> on your <b>${byId[w.id].name}</b> before <b>${shortDate(by)}</b>.</p>
          <p class="why">Your balance is high right now. Paying it down before your statement date helps protect your credit score.</p>
          <div class="acts"><button class="pill pill-gold" data-paid="${w.id}">Done, I paid</button><button class="pill pill-outline" data-remind="${w.id}">Remind me later</button></div>
        </section>`;
    }).join("");

    const cards = S.wallet.map(w => {
      const card = byId[w.id]; if (!card) return "";
      const u = E.utilization(w);
      const usualTag = S.usual === w.id ? `<span class="usual-tag">USUAL</span>` : "";
      if (u === null) {
        return `<article class="wcard empty">${mini(card)}<div class="wtop" style="flex:1"><div class="txt"><div class="nm">${card.name}${usualTag}</div><div class="sub">Add your limit to get payment reminders</div></div></div><button class="pill-sm" data-edit="${w.id}">Add</button></article>`;
      }
      const st = u < 0.1 ? ["ok", "Looking good", "var(--gain)"] : u < 0.3 ? ["mid", "Getting high", "var(--gold-hi)"] : ["bad", "Pay down", "var(--loss)"];
      const g = E.goalProgress(w, S.logs);
      const goal = g ? `
        <div class="goal">
          <p>${g.done ? "✓ Welcome bonus unlocked." : g.expired ? "The bonus deadline has passed." : `Spend <b>${whole(g.remaining)} more</b> by <b>${new Date(w.goal.deadline + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</b> to unlock your welcome bonus.`}</p>
          <div class="bar"><i style="width:${g.pct * 100}%;background:var(--gold)"></i></div>
        </div>` : "";
      return `
        <article class="wcard">
          <div class="wtop">${mini(card)}<div class="txt"><div class="nm">${card.name}${usualTag}</div><div class="sub">${bestFor(card)}</div></div><span class="status ${st[0]}">${st[1]}</span></div>
          <div class="bar"><i style="width:${Math.min(100, u * 100)}%;background:${st[2]}"></i></div>
          <p class="used">${whole(w.balance)} used of ${whole(w.limit)}</p>
          ${goal}
          <div class="acts"><button class="pill-sm" data-edit="${w.id}">Edit</button>${w.closeDay ? `<button class="pill-sm" data-remind="${w.id}">Add reminder</button>` : ""}</div>
        </article>`;
    }).join("");

    return `
      <div class="topbar"><span class="wordmark">Wallet</span>${gear}</div>
      <section class="hello">
        <p class="muted" style="font-size:15px">This month, Dumbo helped you earn</p>
        <p class="big">+${money(extra)}</p>
        <p class="muted" style="font-size:14px;margin-top:8px">${month.length ? "extra, compared to your usual card." : "Tap “I used it” on the Pay tab and this starts adding up."}</p>
      </section>
      ${todos}
      <h2 class="h2"><span>Your cards</span><button class="link" data-act="edit-cards">+ Add / remove</button></h2>
      ${cards}
      ${foot()}`;
  }

  const foot = () => `<div class="foot">Rates verified ${window.DUMBO_VERIFIED}. Not financial advice.<br>Not affiliated with any card issuer.${FEEDBACK_URL ? `<br><button data-act="feedback">Send feedback</button>` : ""}</div>`;

  // ---------- sheets ----------
  function openSheet(html) {
    $("#sheet-root").innerHTML = `<div class="scrim" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
  }
  const closeSheet = () => { $("#sheet-root").innerHTML = ""; };

  function sheetEdit(id) {
    const w = W(id), card = byId[id], g = w.goal || {};
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    openSheet(`
      <h3>${card.name}</h3>
      <p class="lead">Saved only on this phone.</p>
      <div class="field-row">
        <div class="field"><label for="f-limit">Credit limit</label><input id="f-limit" inputmode="decimal" name="limit" placeholder="$5,000" value="${w.limit ?? ""}"></div>
        <div class="field"><label for="f-bal">Current balance</label><input id="f-bal" inputmode="decimal" name="balance" placeholder="$0" value="${w.balance ?? ""}"></div>
      </div>
      <div class="field"><label for="f-close">Statement date (on your statement, not the due date)</label>
        <select id="f-close" name="closeDay"><option value="">Choose a day of the month</option>${days.map(d => `<option ${w.closeDay === d ? "selected" : ""}>${d}</option>`).join("")}</select></div>
      <div class="divider"></div>
      <h4>Welcome bonus goal <span>optional</span></h4>
      <div class="field-row">
        <div class="field"><label for="f-target">Spend required</label><input id="f-target" inputmode="decimal" name="target" placeholder="$4,000" value="${g.target ?? ""}"></div>
        <div class="field"><label for="f-prior">Already spent</label><input id="f-prior" inputmode="decimal" name="prior" placeholder="$0" value="${g.prior ?? ""}"></div>
      </div>
      <div class="field"><label for="f-dead">Deadline</label><input id="f-dead" type="date" name="deadline" value="${g.deadline ?? ""}"></div>
      <div class="stack" style="margin-top:22px">
        <button class="btn btn-primary" data-act="save-edit" data-id="${id}">Save</button>
        <button class="btn btn-text danger" data-act="remove-card" data-id="${id}">Remove card from wallet</button>
      </div>`);
  }

  function saveEdit(id) {
    const sh = $(".sheet");
    const val = n => { const v = parseFloat(String(sh.querySelector(`[name=${n}]`).value).replace(/[$,]/g, "")); return isNaN(v) ? null : v; };
    const w = W(id);
    w.limit = val("limit"); w.balance = val("balance");
    const cd = parseInt(sh.querySelector("[name=closeDay]").value, 10); w.closeDay = isNaN(cd) ? null : cd;
    const target = val("target"), deadline = sh.querySelector("[name=deadline]").value;
    if (target && deadline) {
      const prev = w.goal;
      w.goal = { target, deadline, prior: val("prior") || 0, start: prev && prev.target === target ? prev.start : Date.now() };
    } else w.goal = null;
    save(); closeSheet(); render();
    track("card_details_saved", { has_limit: !!w.limit, has_close: !!w.closeDay, has_goal: !!w.goal });
    toast("Saved");
  }

  function sheetSettings() {
    const pv = S.pointValue;
    openSheet(`
      <h3>Settings</h3>
      <div class="field"><label>What's a point worth to you?</label>
        <div class="seg">${[1, 1.5, 2].map(v => `<button class="${pv === v ? "on" : ""}" data-pv="${v}">${v}¢</button>`).join("")}</div>
        <p class="lead" style="font-size:12.5px;margin-top:8px">1¢ is the cash-out value. People who redeem for travel often get 1.5–2¢. Cash-back cards always count as 1¢.</p>
      </div>
      <div class="field"><label for="f-usual">Card you tap without thinking</label>
        <select id="f-usual" data-input="usual">${walletCards().map(c => `<option value="${c.id}" ${S.usual === c.id ? "selected" : ""}>${c.name}</option>`).join("")}</select></div>
      <div style="margin-top:12px">
        <button class="menu-item" data-act="edit-cards"><span>Add or remove cards</span><span class="muted">›</span></button>
        ${!isStandalone() ? `<button class="menu-item" data-act="install"><span>Add Dumbo to Home Screen</span><span class="muted">›</span></button>` : ""}
        ${FEEDBACK_URL ? `<button class="menu-item" data-act="feedback"><span>Send feedback</span><span class="muted">›</span></button>` : ""}
        <button class="menu-item" data-act="about"><span>How Dumbo works</span><span class="muted">›</span></button>
        <button class="menu-item danger" data-act="reset"><span>Erase everything</span><span></span></button>
      </div>`);
  }

  function sheetAbout() {
    openSheet(`
      <h3>How Dumbo works</h3>
      <div class="stack lead" style="gap:12px;margin-top:10px">
        <p style="margin:0">Dumbo compares your cards using each bank's published rewards rates (checked ${window.DUMBO_VERIFIED}), bonus limits, and this quarter's rotating bonuses.</p>
        <p style="margin:0">Your cards, balances and purchases are saved only on this phone. No account, no bank connection.</p>
        <p style="margin:0">Banks usually report your balance to the credit bureaus on your statement date. Paying it down before then can help your credit score.</p>
        <p style="margin:0">Rates change, so double-check with your bank before big purchases. Dumbo isn't financial advice and isn't affiliated with any bank.</p>
      </div>
      <button class="btn btn-ghost" style="margin-top:18px" data-act="close-sheet">Got it</button>`);
  }

  function sheetReset() {
    openSheet(`
      <h3>Erase everything?</h3>
      <p class="lead">Your cards, balances and purchase history will be removed from this phone. This can't be undone.</p>
      <div class="confirm-row"><button class="btn btn-ghost" data-act="close-sheet">Cancel</button><button class="btn btn-primary" style="background:var(--loss)" data-act="reset-yes">Erase</button></div>`);
  }

  function sheetInstall() {
    S.flags.installShown = true; save(); track("install_prompt_shown");
    openSheet(`
      <h3>Put Dumbo on your Home Screen</h3>
      <p class="lead">It opens full-screen like an app, one tap from checkout.</p>
      ${isIOS() ? `
        <div class="install-steps">
          <div><b>1</b>Tap the Share button <span class="muted">(square with an arrow)</span> in Safari</div>
          <div><b>2</b>Choose <span class="gold">Add to Home Screen</span></div>
          <div><b>3</b>Open Dumbo from your Home Screen</div>
        </div>
        <p class="lead" style="font-size:12.5px">iPhone keeps Home Screen apps separate from Safari, so set up your wallet inside the installed app.</p>
        <button class="btn btn-ghost" style="margin-top:12px" data-act="close-sheet">Got it</button>`
      : deferredInstall ? `<button class="btn btn-primary" style="margin-top:20px" data-act="do-install">Install Dumbo</button>`
      : `<div class="install-steps"><div><b>1</b>Open your browser menu (⋮)</div><div><b>2</b>Tap <span class="gold">Install app</span> or <span class="gold">Add to Home screen</span></div></div>
         <button class="btn btn-ghost" data-act="close-sheet">Got it</button>`}`);
  }

  function sheetUsedOther() {
    const amt = parseFloat(ui.amount) || 0;
    const ranked = E.rank(walletCards(), ui.cat, amt, { logs: S.logs, pointValue: S.pointValue });
    openSheet(`
      <h3>Which card did you use?</h3>
      <div class="choice-list" style="margin-top:8px">
        ${ranked.map(r => `<button class="row-btn" data-log="${r.card.id}">${mini(r.card)}<span class="txt"><span class="nm">${r.card.name}</span><span class="sub">${rateLabel(r.card, r.headline)} · ${money(r.value)}${amt ? "" : " per $100"}</span></span></button>`).join("")}
      </div>`);
  }

  function sheetPaid(id) {
    const w = W(id), card = byId[id], pay = E.payToTen(w);
    openSheet(`
      <h3>Nice. What's the balance now?</h3>
      <p class="lead">${card.name} · was ${whole(w.balance)}${pay ? `. Paying ${whole(pay)} gets it to a healthy level.` : ""}</p>
      <div class="field"><label for="f-nb">New balance</label><input id="f-nb" inputmode="decimal" name="nb" value="${pay ? Math.max(0, Math.round(w.balance - pay)) : 0}"></div>
      <button class="btn btn-primary" style="margin-top:18px" data-act="save-paid" data-id="${id}">Update</button>`);
  }

  // ---------- actions ----------
  function logPurchase(cardId) {
    const amt = parseFloat(ui.amount) || 0;
    if (!amt) {
      closeSheet();
      const inp = $("[data-input=amount]"); if (inp) { inp.focus(); inp.closest(".amount").classList.add("err"); }
      toast("Add the amount first");
      return;
    }
    const ranked = E.rank(walletCards(), ui.cat, amt, { logs: S.logs, pointValue: S.pointValue });
    const used = ranked.find(r => r.card.id === cardId);
    const usual = ranked.find(r => r.card.id === S.usual);
    const entry = { id: Date.now(), ts: Date.now(), cardId, cat: ui.cat, amount: amt, value: used.value, usualValue: usual ? usual.value : used.value, bestValue: ranked[0].value };
    S.logs.push(entry);
    const w = W(cardId); const prevBal = w.balance;
    if (w.balance != null) w.balance = Math.round((w.balance + amt) * 100) / 100;
    save();
    track("purchase_logged", { cat: ui.cat, followed_best: cardId === ranked[0].card.id, bucket: amt < 25 ? "<25" : amt < 100 ? "25-100" : amt < 500 ? "100-500" : "500+" });
    closeSheet();
    ui.cat = null; ui.amount = "";
    render(); window.scrollTo(0, 0);
    toast(`Logged ${money(amt)} on ${used.card.name} · +${money(used.value)}`, () => {
      S.logs = S.logs.filter(l => l.id !== entry.id); w.balance = prevBal; save(); render();
    });
    if (!S.flags.installShown && !isStandalone() && S.logs.length === 1) setTimeout(sheetInstall, 1400);
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  let toastTimer;
  function toast(msg, undo) {
    const t = $("#toast");
    t.innerHTML = `<span>${msg}</span>${undo ? `<button>Undo</button>` : ""}`;
    t.hidden = false;
    if (undo) t.querySelector("button").onclick = () => { undo(); t.hidden = true; };
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, undo ? 5000 : 2200);
  }

  function go(view) { ui.view = view; render(); window.scrollTo(0, 0); }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act],[data-pick],[data-usual],[data-cat],[data-log],[data-edit],[data-remind],[data-paid],[data-pv],[data-tab]");
    if (!el) return;
    const d = el.dataset;

    if (d.tab) return go(d.tab);
    if (d.pick) { ui.sel.has(d.pick) ? ui.sel.delete(d.pick) : ui.sel.add(d.pick); const y = window.scrollY; render(); window.scrollTo(0, y); return; }
    if (d.usual) { S.usual = d.usual; save(); return render(); }
    if (d.cat) {
      ui.cat = ui.cat === d.cat ? null : d.cat;
      if (ui.cat) track("recommendation_viewed", { cat: ui.cat, has_amount: !!parseFloat(ui.amount) });
      render();
      const r = $("#result .result"); if (r) setTimeout(() => r.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      return;
    }
    if (d.log) return logPurchase(d.log);
    if (d.edit) return sheetEdit(d.edit);
    if (d.remind) {
      const w = W(d.remind); download(`dumbo-${w.id}-reminder.ics`, E.ics(byId[w.id].name, w.closeDay), "text/calendar");
      track("reminder_added"); return toast("Open the file to add a monthly reminder to your calendar");
    }
    if (d.paid) return sheetPaid(d.paid);
    if (d.pv) { S.pointValue = parseFloat(d.pv); save(); render(); return sheetSettings(); }

    switch (d.act) {
      case "start": track("onboarding_started"); return go("pick");
      case "picked": {
        const keep = S.wallet.filter(w => ui.sel.has(w.id));
        ui.sel.forEach(id => { if (!keep.find(w => w.id === id)) keep.push({ id, limit: null, balance: null, closeDay: null, goal: null }); });
        S.wallet = keep;
        if (!ui.sel.has(S.usual)) S.usual = null;
        save();
        if (ui.editing) { ui.editing = false; if (!S.usual) { S.usual = S.wallet[0].id; save(); } return go("wallet"); }
        if (S.wallet.length === 1) { S.usual = S.wallet[0].id; save(); return go("details"); }
        return go("usual");
      }
      case "usual-done": return go("details");
      case "finish":
        if (!S.flags.onboarded) { S.flags.onboarded = true; save(); track("onboarding_completed", { cards: S.wallet.length, details: S.wallet.filter(w => w.limit).length }); }
        return go("pay");
      case "settings": return sheetSettings();
      case "close-sheet": return closeSheet();
      case "save-edit": return saveEdit(d.id);
      case "remove-card":
        S.wallet = S.wallet.filter(w => w.id !== d.id); ui.sel.delete(d.id);
        if (S.usual === d.id) S.usual = S.wallet[0] ? S.wallet[0].id : null;
        save(); closeSheet(); if (!S.wallet.length) ui.view = "intro"; return render();
      case "edit-cards": closeSheet(); ui.editing = true; ui.search = ""; ui.sel = new Set(S.wallet.map(w => w.id)); return go("pick");
      case "back-wallet": ui.editing = false; return go("wallet");
      case "used-other": return sheetUsedOther();
      case "save-paid": {
        const v = parseFloat(String($(".sheet [name=nb]").value).replace(/[$,]/g, ""));
        W(d.id).balance = isNaN(v) ? 0 : v; save(); closeSheet(); render(); track("paid_down"); return toast("Balance updated");
      }
      case "install": closeSheet(); return sheetInstall();
      case "do-install":
        if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.then(c => track("install_choice", { outcome: c.outcome })); deferredInstall = null; }
        return closeSheet();
      case "feedback": track("feedback_opened"); window.open(FEEDBACK_URL, "_blank"); return;
      case "about": return sheetAbout();
      case "reset": return sheetReset();
      case "reset-yes": try { localStorage.removeItem(STORE); } catch (e) {} location.reload(); return;
    }
  });

  document.addEventListener("input", e => {
    const k = e.target.dataset.input;
    if (k === "search") { ui.search = e.target.value; const pos = e.target.selectionStart; render(); const s = $("[data-input=search]"); s.focus(); s.setSelectionRange(pos, pos); }
    if (k === "amount") {
      const raw = e.target.value.replace(/[^\d.]/g, "");
      ui.amount = raw;
      e.target.value = raw ? "$" + raw : "";
      e.target.closest(".amount").classList.remove("err");
      const r = $("#result"); if (r && ui.cat) r.innerHTML = vResult();
    }
  });
  document.addEventListener("change", e => {
    if (e.target.dataset.input === "usual") { S.usual = e.target.value; save(); render(); }
  });

  // ---------- render ----------
  function render() {
    const views = { intro: vIntro, pick: vPick, usual: vUsual, details: vDetails, pay: vPay, wallet: vWallet };
    app.innerHTML = (views[ui.view] || vPay)();
    const tabs = $("#tabs");
    tabs.hidden = !(ui.view === "pay" || ui.view === "wallet");
    tabs.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.tab === ui.view));
  }

  render();
  track("app_opened", { standalone: isStandalone(), returning: S.wallet.length > 0 });

  // Splash: show briefly on launch, then fade out
  const splash = $("#splash");
  if (splash) setTimeout(() => { splash.classList.add("out"); setTimeout(() => splash.remove(), 600); }, 1400);

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
