// Sandbox "check the payment" demo — exercises the money rail against Xendit's TEST environment using
// the test key in .env.development. It: (1) creates a MANAGED PH operator sub-account, (2) creates a
// 2.5% commission Split Rule to the Master, (3) tries to open a guest QR Ph checkout ON that sub-account
// with the split attached. Prints Xendit's real responses at each step. TEST ONLY, no real money.
// Gated behind --confirm. Usage:  node scripts/xendit-rail-demo.mjs --confirm
import { readFileSync } from "node:fs";

const API = "https://api.xendit.co";

if (!process.argv.includes("--confirm")) {
  console.error("Refusing without --confirm (creates test data in your Xendit sandbox).");
  process.exit(1);
}

// Read the test key + master id from .env.development (no dotenv dep).
const env = Object.fromEntries(
  readFileSync(new URL("../.env.development", import.meta.url), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const KEY = env.XENDIT_SECRET_KEY;
const MASTER = env.XENDIT_MASTER_ACCOUNT_ID;
if (!KEY?.startsWith("xnd_")) {
  console.error("No XENDIT_SECRET_KEY in .env.development");
  process.exit(1);
}
console.log(`key: ${KEY.slice(0, 10)}…  master: ${MASTER ?? "(unset)"}\n`);

const auth = "Basic " + Buffer.from(`${KEY}:`).toString("base64");
async function call(label, method, path, { body, headers } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: auth, "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  console.log(`── ${label} → HTTP ${res.status}`);
  console.log(JSON.stringify(json, null, 2).split("\n").slice(0, 24).join("\n"));
  console.log("");
  return { ok: res.ok, json };
}

const stamp = Date.now();

// 1. Create the operator sub-account.
const sub = await call("1. create MANAGED sub-account", "POST", "/v2/accounts", {
  body: {
    email: `demo+${stamp}@tuloysanjuan.com`,
    type: "MANAGED",
    public_profile: { business_name: "Demo Seaside Transient" },
  },
});
const subId = sub.json?.id;

// 2. Create the 2.5% commission split rule to the Master (flat peso on a sample ₱4,000 stay = ₱100).
const rule = await call("2. create Split Rule (2.5% commission to Master)", "POST", "/split_rules", {
  body: {
    name: `Tuloy commission ${stamp}`,
    description: "Tuloy booking commission",
    routes: [
      {
        flat_amount: 100,
        currency: "PHP",
        destination_account_id: MASTER,
        reference_id: `commission-${stamp}`,
      },
    ],
  },
});
const ruleId = rule.json?.id;

// 3. Try to open a guest QR Ph checkout on the sub-account with the split attached. A brand-new MANAGED
// sub-account is not yet verified/LIVE (KYC is live-only), so this may be rejected — that itself is the
// real answer about what the sandbox allows before an operator is live.
if (subId) {
  const sess = await call("3. open guest QR Ph checkout on the sub-account (+ split)", "POST", "/sessions", {
    headers: { "for-user-id": subId, "with-split-rule": ruleId ?? "" },
    body: {
      reference_id: `booking-${stamp}`,
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount: 2031.86, // grossed-up ₱2,000 deposit for QR Ph's fee
      currency: "PHP",
      country: "PH",
      capture_method: "AUTOMATIC",
      payment_methods: ["QRPH"],
      success_return_url: "https://tuloysanjuan.com/pay/done",
      cancel_return_url: "https://tuloysanjuan.com/pay/cancel",
    },
  });
  console.log("CHECKOUT_URL=" + (sess.json?.payment_link_url ?? "(none)"));
}

console.log("done.");
