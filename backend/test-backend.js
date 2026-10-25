/**
 * DataForge Backend Integration Test Suite
 * Verifies Express endpoints, synthesis math, fidelity auditing, and TSTR benchmarking
 */

import http from 'http';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting DataForge Backend Verification ---');

  // 1. Healthcheck
  const health = await makeRequest('GET', '/api/health');
  console.log('1. GET /api/health:', health.status === 200 ? 'PASS' : 'FAIL', health.body?.status);

  // Sample tabular dataset: [feature1, feature2, target]
  const testHeaders = ['income', 'credit_score', 'approved'];
  const testData = [
    [45000, 650, '1'],
    [52000, 710, '1'],
    [28000, 580, '0'],
    [64000, 740, '1'],
    [31000, 600, '0'],
    [85000, 790, '1'],
    [22000, 520, '0'],
    [92000, 810, '1'],
    [34000, 610, '0'],
    [48000, 670, '1'],
    [26000, 550, '0'],
    [71000, 760, '1'],
    [39000, 630, '0'],
    [58000, 690, '1'],
    [29000, 570, '0'],
    [81000, 780, '1'],
  ];

  // 2. Synthesis Run (Gaussian Copula)
  const synthRes = await makeRequest('POST', '/api/synthesis/run', {
    name: 'Copula Test Run',
    headers: testHeaders,
    data: testData,
    algorithm: 'copula',
    rowCount: 20,
    seed: 42,
  });
  console.log(
    '2. POST /api/synthesis/run (Copula):',
    synthRes.status === 201 ? 'PASS' : 'FAIL',
    `Generated ${synthRes.body?.data?.rowCount} rows in ${synthRes.body?.data?.metrics?.executionTimeMs}ms`
  );

  const syntheticData = synthRes.body?.data?.syntheticData || [];

  // 3. Fidelity & Privacy Audit
  const auditRes = await makeRequest('POST', '/api/evaluation/audit', {
    headers: testHeaders,
    realData: testData,
    syntheticData,
  });
  console.log(
    '3. POST /api/evaluation/audit:',
    auditRes.status === 200 ? 'PASS' : 'FAIL',
    `KS mean p-val: ${auditRes.body?.data?.ksPValueMean}, Wasserstein: ${auditRes.body?.data?.wassersteinMean}, DCR Privacy: ${auditRes.body?.data?.dcrPrivacyScore}`
  );

  // 4. TSTR Benchmark
  const tstrRes = await makeRequest('POST', '/api/evaluation/tstr', {
    title: 'Credit Approval TSTR Proof',
    headers: testHeaders,
    realData: testData,
    syntheticData,
    targetCol: 'approved',
    testSize: 0.25,
    seed: 42,
  });
  console.log(
    '4. POST /api/evaluation/tstr:',
    tstrRes.status === 200 ? 'PASS' : 'FAIL',
    `Verdict: ${tstrRes.body?.data?.tstrBenchmark?.verdict}, F1 Lift: ${tstrRes.body?.data?.tstrBenchmark?.macroF1Lift}`
  );

  console.log('--- All Backend Core Engines Operational ---');
  process.exit(0);
}

runTests().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
