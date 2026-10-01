#!/usr/bin/env node
// End-to-end drive of the Emmere restaurant flow in a real browser:
// landing → /try demo order → sign up → onboarding → every dashboard tab →
// a test order from the Workflow tab's chat appearing live on the orders board.
//
//   BASE_URL=http://localhost:3200 node .claude/skills/run-smartcallai/emmere.mjs
//
// Needs the dev server on the local Supabase stack (dev-local.sh) with
// migrations 0003+ applied, and an LLM key (Gemini or OpenAI).
// Screenshots: $SHOTS_DIR (default <tmp>/emmere-shots). Exits 1 on failure.

import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR ?? join(tmpdir(), "emmere-shots");
mkdirSync(SHOTS, { recursive: true });
let n = 0;
const errors = [];

async function launch() {
  for (const channel of ["chrome", "msedge", undefined]) {
    try {
      return await chromium.launch({ channel, headless: !process.env.HEADED });
    } catch (e) {
      if (channel === undefined) throw e;
    }
  }
}

async function shot(page, name, fullPage = true) {
  const file = join(SHOTS, `${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage });
  console.log(`  shot ${file}`);
}

function watch(page, label) {
  page.on("console", (m) => m.type() === "error" && errors.push(`[${label}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`[${label}] ${e.message}`));
}

/** Send a message in a ChatSimulator and wait for the bot to answer. */
async function chat(page, root, text) {
  const before = await root.locator('[role="log"] > div').count();
  await root.getByLabel("Message").fill(text);
  await root.getByRole("button", { name: "Send", exact: true }).click();
  await page.waitForFunction(
    ([sel, count]) => document.querySelectorAll(sel).length > count + 1 && !document.body.innerText.includes("typing…"),
    [`[role="log"] > div`, before],
    { timeout: 60_000 }
  );
  await page.waitForTimeout(300);
}

const browser = await launch();
let page;
let board;
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["notifications"] });
  page = await ctx.newPage();
  watch(page, "main");

  console.log("landing");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shot(page, "landing");
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watch(mobile, "mobile");
  await mobile.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shot(mobile, "landing-mobile");

  console.log("/try demo");
  await mobile.goto(`${BASE}/try`, { waitUntil: "networkidle" });
  await chat(mobile, mobile.locator("body"), "Oli otya! Mpa menu");
  await mobile.locator('[role="log"] img').first().waitFor({ timeout: 20_000 });
  await shot(mobile, "try-menu", false);
  await mobile.close();

  console.log("sign up + onboarding");
  const email = `owner+${Date.now()}@example.com`;
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(1500);
  // With email confirmation off (local stack) sign-up already signed us in.
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/(onboarding|login)/, { timeout: 30_000 });
  if (new URL(page.url()).pathname === "/login") {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("test-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
  }
  await shot(page, "onboarding");
  await page.getByLabel("Restaurant name").fill("Kisementi Grill");
  // Open around the clock so the test order works at any hour.
  await page.getByLabel("Opens").fill("00:00");
  await page.getByLabel("Closes").fill("00:00");
  await page.getByRole("button", { name: "Create my restaurant" }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });
  await page.waitForSelector("text=Live: new orders appear here automatically", { timeout: 20_000 });
  await shot(page, "orders-empty");

  for (const tab of ["menu", "settings", "workflow", "insights", "inbox"]) {
    console.log(`dashboard/${tab}`);
    await page.goto(`${BASE}/dashboard/${tab}`, { waitUntil: "networkidle" });
    await shot(page, tab);
  }

  console.log("test order → live board");
  board = await ctx.newPage();
  watch(board, "board");
  await board.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await board.waitForSelector("text=Live: new orders appear here automatically", { timeout: 20_000 });

  await page.goto(`${BASE}/dashboard/workflow`, { waitUntil: "networkidle" });
  const panel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "Test your bot" }) });
  await chat(page, panel, "Njagala Classic Rolex bbiri ne soda emu, nja kukima. Ekyo kyokka");
  let confirm = panel.getByRole("button", { name: /Yee, kakasa|Yes, place order/ });
  if (!(await confirm.isVisible())) {
    await chat(page, panel, "Ekyo kyokka, nja kukima");
    confirm = panel.getByRole("button", { name: /Yee, kakasa|Yes, place order/ });
  }
  await confirm.click();
  await page.waitForSelector("text=/Order EM-/", { timeout: 60_000 });
  await shot(page, "workflow-test-order");

  await board.waitForSelector("article >> text=/EM-/", { timeout: 20_000 });
  await shot(board, "orders-live");
  await board.getByRole("button", { name: "Accept" }).first().click();
  await board.waitForTimeout(1500);
  await shot(board, "orders-accepted");

  await page.goto(`${BASE}/dashboard/inbox`, { waitUntil: "networkidle" });
  await shot(page, "inbox-with-chat");
  await page.goto(`${BASE}/dashboard/insights`, { waitUntil: "networkidle" });
  await shot(page, "insights-with-order");
} catch (err) {
  console.error("FAILED:", err.message.split("\n")[0], "at", page?.url());
  if (page) await shot(page, "failure").catch(() => {});
  if (board) await shot(board, "failure-board").catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  const real = errors.filter((e) => !/favicon|Download the React DevTools/.test(e));
  if (real.length) {
    console.log("\nconsole errors:");
    for (const e of real.slice(0, 20)) console.log("  " + e);
  }
}
