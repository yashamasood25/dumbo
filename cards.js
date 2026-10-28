/* Dumbo card database — rates verified October 2026.
 * rates: earn per $1 by category. type "pts" values scale with the user's point value; "cash" is always 1¢ per unit.
 * caps: bonus rate applies up to `limit` spend per `period`, then `fallback`. Categories listed share one cap.
 * rotating: time-boxed quarterly bonuses (activation required), cap shared across listed categories.
 * Update this file when issuers change rates — nothing else needs to change.
 */
window.DUMBO_VERIFIED = "Oct 2026";

window.DUMBO_CATEGORIES = [
  { id: "dining",    label: "Dining",    icon: "🍜" },
  { id: "groceries", label: "Groceries", icon: "🛒" },
  { id: "gas",       label: "Gas",       icon: "⛽" },
  { id: "flights",   label: "Flights",   icon: "✈️" },
  { id: "hotels",    label: "Hotels",    icon: "🏨" },
  { id: "amazon",    label: "Amazon",    icon: "📦" },
  { id: "online",    label: "Online",    icon: "🛍️" },
  { id: "other",     label: "Anything else", icon: "💳" }
];

const R = (base, over) => Object.assign(
  { dining: base, groceries: base, gas: base, flights: base, hotels: base, amazon: base, online: base, other: base },
  over || {}
);

window.DUMBO_CARDS = [
  { id: "csp", name: "Sapphire Preferred", issuer: "Chase", type: "pts", unit: "x",
    bg: "linear-gradient(135deg,#1b2a4a,#0e1a33 60%,#24365e)", fg: "#e9eef8",
    rates: R(1, { dining: 3, gas: 3, flights: 2, hotels: 2 }),
    notes: { groceries: "3x only on online grocery orders", flights: "5x if booked via Chase Travel", hotels: "5x if booked via Chase Travel" } },

  { id: "csr", name: "Sapphire Reserve", issuer: "Chase", type: "pts", unit: "x",
    bg: "linear-gradient(135deg,#2a2d33,#14161a 60%,#3a3f47)", fg: "#eceef2",
    rates: R(1, { dining: 3, flights: 4, hotels: 4 }),
    notes: { flights: "Booked direct. 8x via Chase Travel", hotels: "Booked direct. 8x via Chase Travel" } },

  { id: "cfu", name: "Freedom Unlimited", issuer: "Chase", type: "cash", unit: "%",
    bg: "linear-gradient(135deg,#3d7fc4,#22578f)", fg: "#ffffff",
    rates: R(1.5, { dining: 3 }),
    notes: { other: "3% at drugstores" } },

  { id: "cff", name: "Freedom Flex", issuer: "Chase", type: "cash", unit: "%",
    bg: "linear-gradient(135deg,#1f6f78,#124249)", fg: "#ffffff",
    rates: R(1, { dining: 3 }),
    rotating: [{ from: "2026-10-01", to: "2026-12-31", rates: { dining: 7, groceries: 5 }, cap: 1500,
                 note: "Q4 bonus. Activate in the Chase app by Dec 14" }] },

  { id: "gold", name: "Gold Card", issuer: "Amex", type: "pts", unit: "x",
    bg: "linear-gradient(135deg,#c9a45c,#8a6a2e 55%,#d8b978)", fg: "#1c1408",
    rates: R(1, { dining: 4, groceries: 4, flights: 3 }),
    caps: [{ cats: ["dining"], limit: 50000, period: "year", fallback: 1 },
           { cats: ["groceries"], limit: 25000, period: "year", fallback: 1 }],
    notes: { groceries: "U.S. supermarkets only. Not Walmart, Target or Costco", flights: "Booked direct or via Amex Travel", hotels: "5x on prepaid hotels via Amex Travel" } },

  { id: "plat", name: "Platinum Card", issuer: "Amex", type: "pts", unit: "x",
    bg: "linear-gradient(135deg,#d9dce1,#9aa0a8 55%,#e7e9ec)", fg: "#16181c",
    rates: R(1, { flights: 5 }),
    caps: [{ cats: ["flights"], limit: 500000, period: "year", fallback: 1 }],
    notes: { flights: "Booked direct or via Amex Travel", hotels: "5x on prepaid hotels via Amex Travel" } },

  { id: "bcp", name: "Blue Cash Preferred", issuer: "Amex", type: "cash", unit: "%",
    bg: "linear-gradient(135deg,#2c5fd6,#173a8c)", fg: "#ffffff",
    rates: R(1, { groceries: 6, gas: 3 }),
    caps: [{ cats: ["groceries"], limit: 6000, period: "year", fallback: 1 }],
    notes: { groceries: "U.S. supermarkets, first $6k/yr", other: "6% on select streaming, 3% on transit" } },

  { id: "bce", name: "Blue Cash Everyday", issuer: "Amex", type: "cash", unit: "%",
    bg: "linear-gradient(135deg,#6fa8e8,#3a74bd)", fg: "#ffffff",
    rates: R(1, { groceries: 3, gas: 3, online: 3, amazon: 3 }),
    caps: [{ cats: ["groceries"], limit: 6000, period: "year", fallback: 1 },
           { cats: ["gas"], limit: 6000, period: "year", fallback: 1 },
           { cats: ["online", "amazon"], limit: 6000, period: "year", fallback: 1 }],
    notes: { online: "U.S. online retail, first $6k/yr", amazon: "Counts as U.S. online retail" } },

  { id: "dc", name: "Double Cash", issuer: "Citi", type: "cash", unit: "%",
    bg: "linear-gradient(135deg,#3f5a63,#1f3238)", fg: "#ffffff", rates: R(2) },

  { id: "strata", name: "Strata Premier", issuer: "Citi", type: "pts", unit: "x",
    bg: "linear-gradient(135deg,#2b2350,#151030 60%,#3b3170)", fg: "#ecebff",
    rates: R(1, { dining: 3, groceries: 3, gas: 3, flights: 3, hotels: 3 }),
    notes: { hotels: "10x via Citi Travel" } },

  { id: "vx", name: "Venture X", issuer: "Capital One", type: "pts", unit: "x",
    bg: "linear-gradient(135deg,#1a1d24,#07080b 60%,#2a2f3a)", fg: "#f0f0f0",
    rates: R(2), notes: { hotels: "10x via Capital One Travel", flights: "5x via Capital One Travel" } },

  { id: "venture", name: "Venture", issuer: "Capital One", type: "pts", unit: "x",
    bg: "linear-gradient(135deg,#1c3557,#0f1f36)", fg: "#ffffff",
    rates: R(2), notes: { hotels: "5x via Capital One Travel" } },

  { id: "savor", name: "Savor", issuer: "Capital One", type: "cash", unit: "%",
    bg: "linear-gradient(135deg,#7a2e2a,#4a1714 60%,#9a4a3c)", fg: "#fff3ee",
    rates: R(1, { dining: 3, groceries: 3 }),
    notes: { groceries: "Excludes Walmart & Target", other: "3% on entertainment & streaming" } },

  { id: "qs", name: "Quicksilver", issuer: "Capital One", type: "cash", unit: "%",
    bg: "linear-gradient(135deg,#8c9096,#55595f)", fg: "#ffffff", rates: R(1.5) },

  { id: "ac", name: "Active Cash", issuer: "Wells Fargo", type: "cash", unit: "%",
    bg: "linear-gradient(135deg,#b3202a,#6e1016)", fg: "#ffffff", rates: R(2) },

  { id: "auto", name: "Autograph", issuer: "Wells Fargo", type: "cash", unit: "%",
    bg: "linear-gradient(135deg,#2a1f2d,#120c14 60%,#3c2c40)", fg: "#f3eaf5",
    rates: R(1, { dining: 3, gas: 3, flights: 3, hotels: 3 }),
    notes: { other: "3x on transit, streaming & phone plans" } },

  { id: "disc", name: "Discover it Cash Back", issuer: "Discover", type: "cash", unit: "%",
    bg: "linear-gradient(135deg,#e8772e,#b14f12)", fg: "#ffffff",
    rates: R(1),
    rotating: [{ from: "2026-10-01", to: "2026-12-31", rates: { dining: 5 }, cap: 1500,
                 note: "Q4 bonus (also entertainment & utilities). Activate first" }] },

  { id: "apple", name: "Apple Card", issuer: "Apple", type: "cash", unit: "%",
    bg: "linear-gradient(135deg,#f4f4f6,#d3d5da)", fg: "#1a1a1d",
    rates: R(2), notes: { other: "2% with Apple Pay, 1% with the physical card" } },

  { id: "prime", name: "Prime Visa", issuer: "Chase", type: "cash", unit: "%",
    bg: "linear-gradient(135deg,#1e3a44,#0d2129)", fg: "#e8f6fa",
    rates: R(1, { dining: 2, gas: 2, amazon: 5 }),
    notes: { amazon: "Requires Prime membership", groceries: "5% at Whole Foods & Amazon Fresh" } },

  { id: "biltp", name: "Bilt Palladium", issuer: "Bilt", type: "pts", unit: "x",
    bg: "linear-gradient(135deg,#55585e,#2b2d31 60%,#6c7077)", fg: "#f4f4f4",
    rates: R(2), notes: { other: "Rent/mortgage earning has its own rules" } }
];
