/**
 * Load Test: concurrent student attendance submissions
 * Usage: node load-test.js [sessionId] [count]
 *
 * If no sessionId is provided, creates a test session in the SQLite DB first.
 */

const http = require('http');
const path = require('path');

const TOTAL_REQUESTS = parseInt(process.argv[3]) || 200;
const API_URL = 'http://localhost:5000/api/attendance/submit';

/**
 * Create a test session directly in SQLite (for load testing without login)
 */
function createTestSession() {
  const Database = require(path.join(__dirname, 'server', 'node_modules', 'better-sqlite3'));
  const dbPath = path.join(__dirname, 'server', 'data', 'attendance.db');
  const db = new Database(dbPath);
  const sessionId = require('crypto').randomUUID();
  const teacherId = 'load-test-teacher';
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

  // Ensure test teacher exists
  db.prepare(`INSERT OR IGNORE INTO teachers (id, email, name, created_at)
    VALUES (?, ?, ?, ?)`).run(teacherId, 'loadtest@test.edu', 'Load Test Teacher', now.toISOString());

  // Create session
  db.prepare(`INSERT INTO sessions (id, teacher_id, session_type, subject_name, year,
    section_or_group, created_at, expires_at, is_active, attendee_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`).run(
    sessionId, teacherId, 'lecture', 'Load Test', 3, 'A',
    now.toISOString(), expiresAt.toISOString()
  );

  db.close();
  return sessionId;
}

let SESSION_ID = process.argv[2];
if (!SESSION_ID || SESSION_ID === 'auto') {
  SESSION_ID = createTestSession();
  console.log(`Created test session: ${SESSION_ID}`);
}

function makeRequest(i) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      sessionId: SESSION_ID,
      studentName: `Test Student ${i}`,
      email: `student${i}@university.edu`,
      macAddress: `AA:BB:CC:DD:${String(Math.floor(i / 256)).padStart(2, '0')}:${String(i % 256).padStart(2, '0')}`,
      latitude: 36.7525 + (Math.random() - 0.5) * 0.001,
      longitude: 3.0420 + (Math.random() - 0.5) * 0.001,
    });

    const start = process.hrtime.bigint();

    const req = http.request(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-Forwarded-For': `10.${Math.floor(i / 256)}.${i % 256}.${(i % 200) + 1}`,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = { raw: body }; }
        resolve({
          index: i,
          status: res.statusCode,
          time: elapsed,
          success: parsed.success || false,
          message: parsed.message || parsed.error || body.substring(0, 80),
        });
      });
    });

    req.on('error', (err) => {
      const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
      resolve({
        index: i,
        status: 0,
        time: elapsed,
        success: false,
        message: err.message,
      });
    });

    req.write(data);
    req.end();
  });
}

async function runLoadTest() {
  console.log('='.repeat(60));
  console.log(`  LOAD TEST: ${TOTAL_REQUESTS} concurrent attendance submissions`);
  console.log(`  Session:   ${SESSION_ID}`);
  console.log(`  Target:    ${API_URL}`);
  console.log('='.repeat(60));

  // Warm up with 1 request
  console.log('\n[Warm-up] Sending 1 request...');
  const warmup = await makeRequest(0);
  console.log(`  Status: ${warmup.status} | ${warmup.time.toFixed(1)}ms | ${warmup.message}`);

  // Fire all requests concurrently
  console.log(`\n[Load Test] Firing ${TOTAL_REQUESTS} requests simultaneously...`);
  const globalStart = process.hrtime.bigint();

  const promises = [];
  for (let i = 1; i <= TOTAL_REQUESTS; i++) {
    promises.push(makeRequest(i));
  }

  const results = await Promise.all(promises);
  const totalTime = Number(process.hrtime.bigint() - globalStart) / 1e6;

  // Analyze results
  const successful = results.filter(r => r.status === 200);
  const failed = results.filter(r => r.status !== 200);
  const rateLimited = results.filter(r => r.status === 429);
  const times = results.map(r => r.time).sort((a, b) => a - b);

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = times[Math.floor(times.length * 0.50)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  const min = times[0];
  const max = times[times.length - 1];

  console.log('\n' + '='.repeat(60));
  console.log('  RESULTS');
  console.log('='.repeat(60));
  console.log(`  Total Requests:     ${TOTAL_REQUESTS}`);
  console.log(`  Wall-clock Time:    ${totalTime.toFixed(0)}ms`);
  console.log(`  Throughput:         ${(TOTAL_REQUESTS / (totalTime / 1000)).toFixed(1)} req/s`);
  console.log();
  console.log(`  Successful (2xx):   ${successful.length} (${(successful.length / TOTAL_REQUESTS * 100).toFixed(1)}%)`);
  console.log(`  Rate Limited (429): ${rateLimited.length}`);
  console.log(`  Other Errors:       ${failed.length - rateLimited.length}`);
  console.log();
  console.log('  Response Times:');
  console.log(`    Min:    ${min.toFixed(1)}ms`);
  console.log(`    Avg:    ${avg.toFixed(1)}ms`);
  console.log(`    P50:    ${p50.toFixed(1)}ms`);
  console.log(`    P95:    ${p95.toFixed(1)}ms`);
  console.log(`    P99:    ${p99.toFixed(1)}ms`);
  console.log(`    Max:    ${max.toFixed(1)}ms`);

  // Status code breakdown
  const statusCodes = {};
  results.forEach(r => {
    statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
  });
  console.log('\n  Status Code Breakdown:');
  for (const [code, count] of Object.entries(statusCodes).sort()) {
    console.log(`    ${code}: ${count}`);
  }

  // Show sample errors if any
  if (failed.length > 0) {
    console.log('\n  Sample Errors (first 5):');
    failed.slice(0, 5).forEach(r => {
      console.log(`    [${r.status}] Student ${r.index}: ${r.message}`);
    });
  }

  // Response time histogram
  const buckets = [10, 25, 50, 100, 250, 500, 1000, 2000, 5000];
  console.log('\n  Response Time Distribution:');
  let prev = 0;
  for (const bucket of buckets) {
    const count = times.filter(t => t > prev && t <= bucket).length;
    const bar = '#'.repeat(Math.ceil(count / TOTAL_REQUESTS * 50));
    if (count > 0) {
      console.log(`    ${String(prev).padStart(5)}ms - ${String(bucket).padStart(5)}ms: ${String(count).padStart(4)} ${bar}`);
    }
    prev = bucket;
  }
  const overflow = times.filter(t => t > buckets[buckets.length - 1]).length;
  if (overflow > 0) {
    console.log(`    ${String(buckets[buckets.length - 1]).padStart(5)}ms+:        ${String(overflow).padStart(4)} ${'#'.repeat(Math.ceil(overflow / TOTAL_REQUESTS * 50))}`);
  }

  console.log('\n' + '='.repeat(60));
}

runLoadTest().catch(console.error);
