import { getDatabase, persistDatabase, queryRows } from "../../src/server/db";
import { RateLimiterStore } from "../../src/server/rateLimiter";

async function runConcurrencyStressTests() {
  console.log("=== Running Rate Limiter Concurrency & Stress Verification Suite ===");

  const db = await getDatabase();

  // Reset rate limits table before tests
  db.run("DELETE FROM rate_limits;");
  persistDatabase();

  // ---------------------------------------------------------------------------
  // Acceptance Test A & D: Concurrent requests in one process produce the exact expected count with NO lost increments
  // ---------------------------------------------------------------------------
  console.log("\n[TEST A & D] Testing high-concurrency burst in one process (100 parallel hits)...");
  const testKey = `stress-concurrency-${Date.now()}`;
  const totalConcurrentHits = 100;
  const maxLimit = 200; // High enough to track all hits
  const decaySeconds = 60;

  // Fire all 100 hits concurrently via Promise.all
  const promises: Promise<any>[] = [];
  for (let i = 0; i < totalConcurrentHits; i++) {
    promises.push(RateLimiterStore.hit(testKey, maxLimit, decaySeconds));
  }

  const results = await Promise.all(promises);

  // Read actual count recorded in database
  const rows = queryRows(db, "SELECT hits, reset_at FROM rate_limits WHERE key = ?", [testKey]) as any[];
  if (!rows || rows.length === 0) {
    throw new Error("No rate limit record found in database for stress test key!");
  }

  const actualRecordedHits = rows[0].hits;
  console.log(`  -> Sent ${totalConcurrentHits} concurrent hits. Database recorded: ${actualRecordedHits} hits.`);

  if (actualRecordedHits !== totalConcurrentHits) {
    throw new Error(`Concurrency race condition detected! Expected ${totalConcurrentHits} hits, but found ${actualRecordedHits} (lost ${totalConcurrentHits - actualRecordedHits} increments)`);
  }

  // Verify that remaining counts are strictly decreasing and all 100 hits got distinct remaining values
  const remainingValues = results.map(r => r.remaining);
  const uniqueRemaining = new Set(remainingValues);
  if (uniqueRemaining.size !== totalConcurrentHits) {
    throw new Error(`Expected ${totalConcurrentHits} unique remaining values, but got ${uniqueRemaining.size}! Overwriting detected.`);
  }

  console.log("  PASS: 100 concurrent requests produced exactly 100 distinct increments with zero lost writes.");

  // ---------------------------------------------------------------------------
  // Acceptance Test C: The limiter returns 429 consistently at the configured threshold
  // ---------------------------------------------------------------------------
  console.log("\n[TEST C] Testing consistent threshold enforcement under concurrent arrival...");
  const thresholdKey = `threshold-test-${Date.now()}`;
  const configuredThreshold = 10;
  const burstSize = 25; // 25 hits attempting limit of 10

  const burstPromises: Promise<any>[] = [];
  for (let i = 0; i < burstSize; i++) {
    burstPromises.push(RateLimiterStore.hit(thresholdKey, configuredThreshold, decaySeconds));
  }

  const burstResults = await Promise.all(burstPromises);
  const allowedCount = burstResults.filter(r => r.allowed).length;
  const blockedCount = burstResults.filter(r => !r.allowed).length;

  console.log(`  -> Burst size ${burstSize} against limit ${configuredThreshold}: ${allowedCount} allowed, ${blockedCount} blocked.`);

  if (allowedCount !== configuredThreshold) {
    throw new Error(`Expected exactly ${configuredThreshold} allowed requests, but ${allowedCount} were allowed!`);
  }

  if (blockedCount !== burstSize - configuredThreshold) {
    throw new Error(`Expected exactly ${burstSize - configuredThreshold} blocked requests, but ${blockedCount} were blocked!`);
  }

  console.log("  PASS: Rate limiter consistently permits exactly the configured threshold and blocks all excess requests.");

  // ---------------------------------------------------------------------------
  // Acceptance Test B: Multi-worker distributed claims are rejected as unsupported dev behavior
  // ---------------------------------------------------------------------------
  console.log("\n[TEST B] Testing multi-worker distributed clustering assertion...");

  if (RateLimiterStore.isDistributedSupported() !== false) {
    throw new Error("RateLimiterStore falsely claimed distributed support when using in-memory sql.js!");
  }

  let errorThrown = false;
  try {
    RateLimiterStore.assertSingleProcessOnly("worker-cluster-node-2");
  } catch (err: any) {
    errorThrown = true;
    console.log(`  -> Rejection message verified: ${err.message}`);
  }

  if (!errorThrown) {
    throw new Error("Multi-worker cluster was not explicitly rejected as unsupported development-only behavior!");
  }

  console.log("  PASS: Multi-worker distributed clustering is explicitly marked unsupported and rejected.");

  console.log("\n================================================================================");
  console.log("🎉 ALL ACCEPTANCE CRITERIA (A, B, C, D) PASSED WITH 100% CONCURRENCY SAFETY!");
  console.log("================================================================================");
}

runConcurrencyStressTests().catch(err => {
  console.error("CONCURRENCY STRESS TEST FAILED:", err);
  process.exit(1);
});
