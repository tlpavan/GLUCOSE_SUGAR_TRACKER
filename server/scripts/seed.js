
const BASE_URL = process.env.SEED_API_URL || "http://127.0.0.1:5000";

const demoUser = {
  name: "Sweety Demo",
  email: "sweety.demo@example.com",
  password: "SweetyDemo@2026"
};

// These are synthetic readings for demonstration only.
const readings = [
  { date: "2026-11-16", slot: "morning_fasting", valueMgDl: 96 },
  { date: "2026-11-16", slot: "after_breakfast", valueMgDl: 124 },
  { date: "2026-11-16", slot: "after_lunch", valueMgDl: 118 },
  { date: "2026-11-16", slot: "after_dinner", valueMgDl: 110 },

  { date: "2026-11-15", slot: "morning_fasting", valueMgDl: 101 },
  { date: "2026-11-15", slot: "after_breakfast", valueMgDl: 128 },

  { date: "2026-10-15", slot: "morning_fasting", valueMgDl: 99 },
  { date: "2026-10-15", slot: "after_breakfast", valueMgDl: 119 },
  { date: "2026-10-15", slot: "after_lunch", valueMgDl: 130 },
  { date: "2026-10-15", slot: "after_dinner", valueMgDl: 108 },

  { date: "2026-09-15", slot: "morning_fasting", valueMgDl: 94 }
];

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const body = await response.json().catch(() => ({}));

  return { response, body };
}

async function seed() {
  const url = new URL(BASE_URL);

  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Seeding is restricted to a local development API.");
  }

  console.log("Creating demo account...");

  const registration = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(demoUser)
  });

  if (!registration.response.ok && registration.response.status !== 409) {
    throw new Error(
      `Registration failed: ${JSON.stringify(registration.body)}`
    );
  }

  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: demoUser.email,
      password: demoUser.password
    })
  });

  if (!login.response.ok) {
    throw new Error(`Login failed: ${JSON.stringify(login.body)}`);
  }

  const token =
    login.body.token ||
    login.body.accessToken ||
    login.body.data?.token ||
    login.body.data?.accessToken;

  if (!token) {
    throw new Error(
      "Login succeeded but token shape was not recognized. Check auth/routes.js."
    );
  }

  let created = 0;
  let skipped = 0;

  for (const reading of readings) {
    const result = await request("/api/readings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(reading)
    });

    if (result.response.ok) {
      created++;
    } else if (result.response.status === 409) {
      skipped++;
    } else {
      throw new Error(
        `Failed on ${reading.date}/${reading.slot}: ` +
        JSON.stringify(result.body)
      );
    }
  }

  console.log("Demo data ready!");
  console.log(`Created: ${created}`);
  console.log(`Already existing: ${skipped}`);
  console.log(`Email: ${demoUser.email}`);
  console.log(`Password: ${demoUser.password}`);
}

seed().catch(error => {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
});
