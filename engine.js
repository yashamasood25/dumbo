/* Dumbo engine — pure logic, no DOM. Works in browser (window.Engine) and Node (module.exports). */
(function (root) {
  const DAY = 86400000;

  function inRange(d, from, to) {
    const t = d.getTime();
    return t >= new Date(from + "T00:00:00").getTime() && t <= new Date(to + "T23:59:59").getTime();
  }

  // Spend already logged on this card in these categories since `start`
  function spentSince(logs, cardId, cats, start) {
    return logs
      .filter(l => l.cardId === cardId && cats.includes(l.cat) && l.ts >= start.getTime())
      .reduce((s, l) => s + l.amount, 0);
  }

  // Earn units (points or % cash) for spending `amount` on `card` in `cat`, honoring caps & rotating bonuses.
  // Returns { units, rate (effective per $), note, bonusNote }
  function earn(card, cat, amount, date, logs) {
    date = date || new Date();
    logs = logs || [];
    let rate = card.rates[cat];
    let fallback = rate;
    let cap = null, capUsed = 0, note = (card.notes && card.notes[cat]) || "", bonusNote = "";

    const rot = (card.rotating || []).find(r => r.rates[cat] && inRange(date, r.from, r.to));
    if (rot && rot.rates[cat] > rate) {
      fallback = rate;
      rate = rot.rates[cat];
      cap = rot.cap;
      const cats = Object.keys(rot.rates);
      capUsed = spentSince(logs, card.id, cats, new Date(rot.from + "T00:00:00"));
      bonusNote = rot.note;
    } else {
      const c = (card.caps || []).find(c => c.cats.includes(cat));
      if (c) {
        cap = c.limit;
        fallback = c.fallback;
        const start = new Date(date.getFullYear(), 0, 1);
        capUsed = spentSince(logs, card.id, c.cats, start);
      }
    }

    const amt = amount > 0 ? amount : 100; // rate-only view uses $100 as basis
    let units, headline = rate;
    if (cap !== null) {
      const room = Math.max(0, cap - capUsed);
      const atBonus = Math.min(amt, room);
      units = atBonus * rate + (amt - atBonus) * fallback;
      if (room < amt) {
        note = (room === 0 ? "Bonus cap reached. " : "Partly over the bonus cap. ") + note;
        headline = Math.round((units / amt) * 100) / 100;
        if (room === 0) bonusNote = "";
      }
    } else {
      units = amt * rate;
    }
    return { units, rate: units / amt, headline, note: note.trim(), bonusNote };
  }

  // Dollar value of earned units
  function dollars(card, units, pointValueCents) {
    const cents = card.type === "pts" ? pointValueCents : 1;
    return (units * cents) / 100;
  }

  function rank(cards, cat, amount, opts) {
    const { date, logs, pointValue } = Object.assign({ pointValue: 1 }, opts || {});
    return cards
      .map(card => {
        const e = earn(card, cat, amount, date, logs);
        return { card, ...e, value: dollars(card, e.units, pointValue) };
      })
      .sort((a, b) => b.value - a.value || (a.bonusNote ? 1 : 0) - (b.bonusNote ? 1 : 0));
  }

  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function nextClose(closeDay, now) {
    now = now || new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let y = today.getFullYear(), m = today.getMonth();
    let d = new Date(y, m, Math.min(closeDay, daysInMonth(y, m)));
    if (d < today) {
      m += 1; if (m > 11) { m = 0; y += 1; }
      d = new Date(y, m, Math.min(closeDay, daysInMonth(y, m)));
    }
    return { date: d, days: Math.round((d - today) / DAY) };
  }

  function utilization(w) {
    if (!w.limit || w.limit <= 0 || w.balance == null) return null;
    return w.balance / w.limit;
  }

  // Amount to pay so reported utilization lands under 10%
  function payToTen(w) {
    const u = utilization(w);
    if (u === null || u < 0.1) return 0;
    return Math.ceil(w.balance - w.limit * 0.09);
  }

  function goalProgress(w, logs, now) {
    const g = w.goal;
    if (!g || !g.target) return null;
    now = now || new Date();
    const logged = logs.filter(l => l.cardId === w.id && l.ts >= g.start).reduce((s, l) => s + l.amount, 0);
    const spent = (g.prior || 0) + logged;
    const deadline = new Date(g.deadline + "T23:59:59");
    const daysLeft = Math.max(0, Math.ceil((deadline - now) / DAY));
    const total = Math.max(1, Math.ceil((deadline - g.start) / DAY));
    const elapsed = 1 - daysLeft / total;
    const remaining = Math.max(0, g.target - spent);
    const behind = remaining > 0 && spent / g.target < elapsed;
    return { spent, remaining, daysLeft, pct: Math.min(1, spent / g.target), behind, done: remaining === 0, expired: daysLeft === 0 && remaining > 0 };
  }

  // Monthly .ics reminder 3 days before statement close
  function ics(cardName, closeDay) {
    const bymd = closeDay - 3 >= 1 ? closeDay - 3 : closeDay - 4;
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
    const start = `${now.getFullYear()}${pad(now.getMonth() + 1)}01`;
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dumbo//EN", "BEGIN:VEVENT",
      `UID:dumbo-${cardName.replace(/\W/g, "")}-${Date.now()}@dumbo`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `RRULE:FREQ=MONTHLY;BYMONTHDAY=${bymd}`,
      `SUMMARY:Dumbo: ${cardName} closes in 3 days`,
      "DESCRIPTION:Pay down the balance before the statement closes so a lower utilization gets reported. Open Dumbo to see how much.",
      "BEGIN:VALARM", "TRIGGER:PT9H", "ACTION:DISPLAY", `DESCRIPTION:${cardName} closes in 3 days`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
  }

  const Engine = { earn, dollars, rank, nextClose, utilization, payToTen, goalProgress, ics };
  if (typeof module !== "undefined") module.exports = Engine; else root.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
