import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { pool } from "../src/db/pool";

afterAll(async () => {
  await pool.end();
});

// ---------- helpers ----------
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function newUser() {
  const email = `u${Date.now()}${Math.floor(Math.random() * 1e6)}@test.dev`;
  const res = await request(app).post("/auth/register").send({ email, password: "password123" });
  return { token: res.body.token as string, email };
}

function addProblem(token: string, body: Record<string, unknown>) {
  return request(app)
    .post("/problems")
    .set(auth(token))
    .send({ difficulty: "medium", ...body });
}

const queueIds = async (token: string) => {
  const res = await request(app).get("/queue/today").set(auth(token));
  return (res.body.cards as { id: number }[]).map((c) => c.id);
};

// ---------- tests ----------
describe("health", () => {
  it("reports the database as connected", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: "connected" });
  });
});

describe("auth", () => {
  it("registers a user and returns a token", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: `reg${Date.now()}@test.dev`, password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
  });

  it("rejects a duplicate email with 409", async () => {
    const { email } = await newUser();
    const res = await request(app).post("/auth/register").send({ email, password: "password123" });
    expect(res.status).toBe(409);
  });

  it("rejects a short password with 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: `short${Date.now()}@test.dev`, password: "123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    const { email } = await newUser();
    const wrongPassword = await request(app).post("/auth/login").send({ email, password: "wrong-password" });
    const unknownEmail = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@test.dev", password: "password123" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it("protects routes: no token and a bad token both give 401", async () => {
    expect((await request(app).get("/queue/today")).status).toBe(401);
    const bad = await request(app).get("/queue/today").set(auth("not-a-real-token"));
    expect(bad.status).toBe(401);
  });
});

describe("problems", () => {
  it("adds a problem, rejects a duplicate, and rejects an unknown pattern", async () => {
    const { token } = await newUser();
    const first = await addProblem(token, { externalId: "1", title: "Two Sum", patterns: ["Arrays and Hashing"] });
    expect(first.status).toBe(201);

    const dup = await addProblem(token, { externalId: "1", title: "Two Sum", patterns: ["Arrays and Hashing"] });
    expect(dup.status).toBe(409);

    const unknown = await addProblem(token, { title: "X", patterns: ["Not A Pattern"] });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toContain("Unknown pattern");
  });

  it("keeps each user's problems private", async () => {
    const a = await newUser();
    const b = await newUser();
    await addProblem(a.token, { title: "Only Mine", patterns: ["Stack"] });
    const list = await request(app).get("/problems").set(auth(b.token));
    expect(list.body).toEqual([]);
  });
});

describe("queue and reviews", () => {
  it("only lists cards that are due", async () => {
    const { token } = await newUser();
    const due = await addProblem(token, { title: "Due now", patterns: ["Stack"], firstReviewInDays: 0 });
    const later = await addProblem(token, { title: "Due later", patterns: ["Stack"], firstReviewInDays: 3 });
    const ids = await queueIds(token);
    expect(ids).toContain(due.body.id);
    expect(ids).not.toContain(later.body.id);
  });

  it("Forgot schedules 1 day, counts a lapse, and removes the card from today's queue", async () => {
    const { token } = await newUser();
    const added = await addProblem(token, { title: "Forget me", patterns: ["Stack"], firstReviewInDays: 0 });

    const review = await request(app)
      .post("/reviews")
      .set(auth(token))
      .send({ userProblemId: added.body.id, rating: 1 });
    expect(review.status).toBe(200);
    expect(review.body).toMatchObject({ intervalDays: 1, lapses: 1, repetitions: 0, ease: 2.3 });

    expect(await queueIds(token)).not.toContain(added.body.id);
  });

  it("rejects an invalid rating with 400", async () => {
    const { token } = await newUser();
    const res = await request(app).post("/reviews").set(auth(token)).send({ userProblemId: 1, rating: 9 });
    expect(res.status).toBe(400);
  });

  it("does not let one user review another user's card", async () => {
    const owner = await newUser();
    const other = await newUser();
    const added = await addProblem(owner.token, { title: "Not yours", patterns: ["Stack"], firstReviewInDays: 0 });
    const res = await request(app)
      .post("/reviews")
      .set(auth(other.token))
      .send({ userProblemId: added.body.id, rating: 3 });
    expect(res.status).toBe(404);
  });

  it("puts the pattern you just forgot first, and stats agree", async () => {
    const { token } = await newUser();
    const a1 = await addProblem(token, { title: "Stack 1", patterns: ["Stack"], firstReviewInDays: 0 });
    const a2 = await addProblem(token, { title: "Stack 2", patterns: ["Stack"], firstReviewInDays: 0 });
    const b1 = await addProblem(token, { title: "Heap 1", patterns: ["Heap"], firstReviewInDays: 0 });
    const b2 = await addProblem(token, { title: "Heap 2", patterns: ["Heap"], firstReviewInDays: 0 });

    await request(app).post("/reviews").set(auth(token)).send({ userProblemId: a1.body.id, rating: 1 });

    // Stack mastery dropped, so the remaining Stack card comes first, then the Heap cards.
    expect(await queueIds(token)).toEqual([a2.body.id, b1.body.id, b2.body.id]);

    const stats = await request(app).get("/stats/patterns").set(auth(token));
    expect(stats.status).toBe(200);
    expect(stats.body[0].name).toBe("Stack"); // weakest first
    expect(stats.body[0].mastery).toBeCloseTo(0.25, 2);
    expect(stats.body[0].recentReviews).toBe(1);
    const heap = stats.body.find((s: { name: string }) => s.name === "Heap");
    expect(heap.mastery).toBe(0.5);
    expect(heap.recentReviews).toBe(0);
  });
});

describe("cards", () => {
  it("returns the saved notes for the owner only", async () => {
    const owner = await newUser();
    const other = await newUser();
    const added = await addProblem(owner.token, {
      title: "With notes",
      patterns: ["Binary Search"],
      approachText: "Halve the range each step.",
      keyInsight: "Watch the loop condition.",
    });

    const mine = await request(app).get(`/cards/${added.body.id}`).set(auth(owner.token));
    expect(mine.status).toBe(200);
    expect(mine.body.notes.keyInsight).toBe("Watch the loop condition.");
    expect(mine.body.patterns).toEqual(["Binary Search"]);

    expect((await request(app).get(`/cards/${added.body.id}`).set(auth(other.token))).status).toBe(404);
    expect((await request(app).get("/cards/abc").set(auth(owner.token))).status).toBe(400);
  });
});

describe("csv import", () => {
  const csv = [
    "title,difficulty,patterns,platform,external_id,url,approach,insight",
    "Valid Parentheses,easy,Stack,leetcode,20,,,",
    "Climbing Stairs,easy,DP 1D,leetcode,70,,,",
    'Merge Intervals,medium,Intervals,leetcode,56,,Sort by start then merge,',
    "Bad Row,medium,Nonexistent Pattern,leetcode,9999,,,",
  ].join("\n");

  it("imports good rows, skips duplicates and reports bad rows", async () => {
    const { token } = await newUser();
    // Valid Parentheses is already in this user's list, so the import should skip it.
    await addProblem(token, { externalId: "20", title: "Valid Parentheses", difficulty: "easy", patterns: ["Stack"] });

    const res = await request(app)
      .post("/import/csv")
      .set(auth(token))
      .set("Content-Type", "text/csv")
      .send(csv);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 4, imported: 2, skipped: 1 });
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].row).toBe(5); // header is row 1
    expect(res.body.errors[0].message).toContain("Unknown pattern");

    const list = await request(app).get("/problems").set(auth(token));
    expect(list.body).toHaveLength(3);
  });

  it("rejects a body that is not CSV text", async () => {
    const { token } = await newUser();
    const res = await request(app).post("/import/csv").set(auth(token)).send({ csv: "x" });
    expect(res.status).toBe(400);
  });

  it("rejects a CSV with missing columns", async () => {
    const { token } = await newUser();
    const res = await request(app)
      .post("/import/csv")
      .set(auth(token))
      .set("Content-Type", "text/csv")
      .send("title,difficulty\nTwo Sum,easy");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("patterns");
  });
});

describe("stats overview", () => {
  const total = (days: { count: number }[]) => days.reduce((s, d) => s + d.count, 0);

  it("summarises cards, due load and recent reviews", async () => {
    const { token } = await newUser();
    const a = await addProblem(token, { title: "Overview A", patterns: ["Stack"], firstReviewInDays: 0 });
    await addProblem(token, { title: "Overview B", patterns: ["Heap"], firstReviewInDays: 3 });

    const before = await request(app).get("/stats/overview").set(auth(token));
    expect(before.status).toBe(200);
    expect(before.body.totalCards).toBe(2);
    expect(before.body.dueNow).toBe(1);
    expect(before.body.days).toHaveLength(14);
    expect(total(before.body.days)).toBe(1); // only the card due in 3 days
    expect(before.body.reviews7d).toBe(0);
    expect(before.body.recallRate30d).toBeNull();

    await request(app).post("/reviews").set(auth(token)).send({ userProblemId: a.body.id, rating: 3 });

    const after = await request(app).get("/stats/overview").set(auth(token));
    expect(after.body.dueNow).toBe(0);
    expect(total(after.body.days)).toBe(2); // the reviewed card is now due in 6 days... or 1, either way inside 14
    expect(after.body.reviews7d).toBe(1);
    expect(after.body.recallRate30d).toBe(1);
  });

  it("requires a token", async () => {
    expect((await request(app).get("/stats/overview")).status).toBe(401);
  });
});
