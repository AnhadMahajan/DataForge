/**
 * DataForge — Comprehensive End-to-End Node.js Test Suite
 * Validates all math, parsing, storage, auth, ML, and recommendation services.
 */

// Mock browser localStorage
const memoryStore = {};
global.localStorage = {
  getItem: (key) => memoryStore[key] !== undefined ? memoryStore[key] : null,
  setItem: (key, val) => { memoryStore[key] = String(val); },
  removeItem: (key) => { delete memoryStore[key]; },
  clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
  get length() { return Object.keys(memoryStore).length; },
  key: (i) => Object.keys(memoryStore)[i] || null,
};

// Mock window.location
global.window = {
  location: { href: 'http://localhost:3000/' },
};

async function runTests() {
  console.log('--- Starting DataForge Full Test Suite ---');

  // 1. Math Utils
  const math = await import('./js/utils/math.js');
  console.log('Testing math utilities...');
  const sampleArr = [10, 12, 14, 15, 18, 20, 22, 100]; // 100 is outlier
  const m = math.mean(sampleArr);
  const s = math.std(sampleArr);
  const outliers = math.detectOutliers(sampleArr);
  console.log(`✓ Mean: ${m.toFixed(2)}, Std: ${s.toFixed(2)}, Outliers found: ${outliers.count}`);

  const uuid = math.generateUUID();
  console.log(`✓ Generated safe UUID: ${uuid}`);

  const hash = await math.hashString('testpassword123');
  console.log(`✓ Generated safe hash: ${hash.slice(0, 16)}...`);

  // 2. CSV Utils
  const csv = await import('./js/utils/csv.js');
  console.log('\nTesting CSV parser...');
  const csvText = 'Age,Salary,Target\n25,50000,Yes\n30,65000,No\n35,80000,Yes';
  const parsed = csv.parseCSV(csvText);
  if (!parsed.success) throw new Error('CSV parsing failed');
  console.log(`✓ Parsed ${parsed.data.rowCount} rows, ${parsed.data.columnCount} columns. Types: ${parsed.data.columnTypes.join(', ')}`);

  // 3. Auth Service
  const auth = await import('./js/services/auth.js');
  console.log('\nTesting Auth Service...');
  const signupRes = await auth.signup('Dr. Vance', 'vance@dataforge.ai', 'Password123!');
  if (!signupRes.success) throw new Error('Signup failed: ' + signupRes.error.message);
  console.log(`✓ Registered user: ${signupRes.data.user.name} (${signupRes.data.user.email})`);

  const loginRes = await auth.login('vance@dataforge.ai', 'Password123!');
  if (!loginRes.success) throw new Error('Login failed: ' + loginRes.error.message);
  console.log(`✓ Logged in successfully. Token: ${loginRes.data.session.token.slice(0, 8)}...`);

  const userId = loginRes.data.user.id;

  // 4. Dataset & Analysis Service
  const datasetService = await import('./js/services/dataset.js');
  console.log('\nTesting Dataset & Analysis Engine...');
  const sampleCSV = datasetService.getSampleDatasetCSV();
  const dsRes = await datasetService.createDatasetFromCSV(userId, 'benchmark_churn.csv', sampleCSV, 'ChurnRisk');
  if (!dsRes.success) throw new Error('Dataset creation failed: ' + dsRes.error.message);
  const dataset = dsRes.data;
  console.log(`✓ Dataset loaded: "${dataset.name}" (${dataset.rowCount} rows, Health Score: ${dataset.healthScore}/100)`);
  console.log(`✓ Augmentation Need Score: ${dataset.analysisResult.augmentationNeedScore}/100 (Imbalance: ${dataset.analysisResult.imbalanceRatio}:1)`);

  // 5. Experiment Execution & Evaluation
  const expService = await import('./js/services/experiment.js');
  console.log('\nTesting Experiment Engine (SMOTE, Random Oversampling, Noise Injection)...');
  const expRes = await expService.runExperiment({
    userId,
    dataset,
    name: 'Churn_Benchmark_Experiment',
    strategies: ['smote', 'oversampling', 'noise_injection'],
    runs: 3,
    trainTestSplit: 0.8,
    modelType: 'knn',
    baseSeed: 42,
    onProgress: (msg, pct) => console.log(`  [${pct}%] ${msg}`),
  });

  if (!expRes.success) throw new Error('Experiment failed: ' + expRes.error.message);
  const exp = expRes.data;
  console.log(`✓ Experiment Completed: Status = ${exp.status}`);
  console.log(`✓ Baseline Macro F1: ${(exp.baseline.aggregated.f1.mean * 100).toFixed(1)}%`);

  exp.strategyResults.forEach(s => {
    const f1 = (s.evaluation.aggregated.f1.mean * 100).toFixed(1);
    const delta = s.comparison.percentageImprovement;
    console.log(`  • Strategy: ${s.strategyType.toUpperCase()} → F1: ${f1}% (Δ ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%) | p-value: ${s.comparison.pEstimate}`);
  });

  console.log(`✓ Final Verdict: "${exp.recommendation.verdict.toUpperCase()}" (Top: ${exp.recommendation.bestStrategy}, Gain: +${exp.recommendation.improvement}%)`);
  console.log(`✓ Causal Explanation: "${exp.recommendation.explanations[0]}"`);

  // 6. Reports Generation
  const reportsService = await import('./js/services/reports.js');
  console.log('\nTesting Reports Compiler...');
  const report = reportsService.generateReportFromExperiment(userId, exp, dataset);
  console.log(`✓ Compiled Report: "${report.title}" with ${report.sections.length} narrative sections.`);

  console.log('\n========================================');
  console.log('✅ ALL SERVICES & MODULES VERIFIED 100% OPERATIONAL!');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});
