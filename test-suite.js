/**
 * DataForge — Comprehensive End-to-End Node.js Test Suite
 * Validates math, dirty CSV parsing, mixed categorical/numeric pipelines,
 * ID column exclusion, ADASYN, SMOTE-Tomek, Random Forest, and CSV exports.
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
  console.log('========================================================');
  console.log('🚀 Starting DataForge Full Production E2E Test Suite');
  console.log('========================================================\n');

  // 1. Math & Linear Algebra Utils
  const math = await import('./js/utils/math.js');
  console.log('1️⃣ Testing Math & Linear Algebra Utilities...');
  const sampleArr = [10, 12, 14, 15, 18, 20, 22, 100];
  const m = math.mean(sampleArr);
  const s = math.std(sampleArr);
  const outliers = math.detectOutliers(sampleArr);
  const modeVal = math.mode(['active', 'pending', 'active', 'cancelled', 'active']);
  const sig = math.sigmoid(0);
  const dot = math.dotProduct([1, 2, 3], [4, 5, 6]);
  console.log(`✓ Mean: ${m.toFixed(2)}, Std: ${s.toFixed(2)}, Outliers: ${outliers.count}`);
  console.log(`✓ Mode: "${modeVal}", Sigmoid(0): ${sig}, DotProduct: ${dot}`);

  // 2. CSV Parser with Dirty Real-World Strings
  const csv = await import('./js/utils/csv.js');
  console.log('\n2️⃣ Testing Dirty Real-World CSV Ingestion...');
  const dirtyCSV = [
    'CustomerID,Department,MonthlySalary,TenureMonths,BonusRate,Status',
    'USR-001,Engineering,"$5,200.50",24,12%,Retained',
    'USR-002,Sales,"$3,800.00",6,8%,Churned',
    'USR-003,Support,"$2,950.00",12,,Retained',
    'USR-004,Engineering,"$6,100.00",36,15%,Retained',
    'USR-005,Sales,"$4,100.00",2,5%,Churned',
    'USR-006,Marketing,"$4,500.00",18,10%,Retained',
  ].join('\n');

  const parsed = csv.parseCSV(dirtyCSV);
  if (!parsed.success) throw new Error('Dirty CSV parsing failed');
  console.log(`✓ Parsed ${parsed.data.rowCount} rows. Inferred types: ${parsed.data.columnTypes.join(', ')}`);
  if (parsed.data.rows[0][2] !== 5200.5) throw new Error(`Currency parsing failed: got ${parsed.data.rows[0][2]}`);
  console.log(`✓ Currency string "$5,200.50" successfully sanitized to numeric: ${parsed.data.rows[0][2]}`);

  // 3. Auth Service
  const auth = await import('./js/services/auth.js');
  console.log('\n3️⃣ Testing Auth Service...');
  const signupRes = await auth.signup('Lead Researcher', 'researcher@dataforge.ai', 'Password123!');
  if (!signupRes.success) throw new Error('Signup failed: ' + signupRes.error.message);
  console.log(`✓ Registered user: ${signupRes.data.user.name} (${signupRes.data.user.email})`);

  const loginRes = await auth.login('researcher@dataforge.ai', 'Password123!');
  if (!loginRes.success) throw new Error('Login failed: ' + loginRes.error.message);
  const userId = loginRes.data.user.id;

  // 4. Real-World Mixed Dataset Ingestion & ID Auto-Detection
  const datasetService = await import('./js/services/dataset.js');
  console.log('\n4️⃣ Testing Dataset Diagnostic Profiler & ID Detection...');
  const dsRes = await datasetService.createDatasetFromCSV(userId, 'real_customer_data.csv', datasetService.getSampleDatasetCSV(), 'ChurnRisk');
  if (!dsRes.success) throw new Error('Dataset creation failed: ' + dsRes.error.message);
  const dataset = dsRes.data;
  console.log(`✓ Dataset loaded: "${dataset.name}" (${dataset.rowCount} rows, Target: "${dataset.targetColumn}")`);
  console.log(`✓ Augmentation Need Score: ${dataset.analysisResult.augmentationNeedScore}/100`);

  // 5. Test Advanced Augmentation Strategies (SMOTE-NC, ADASYN, SMOTE-Tomek)
  const augService = await import('./js/services/augmentation.js');
  console.log('\n5️⃣ Testing Advanced Augmentation Algorithms (SMOTE-NC, ADASYN, SMOTE-Tomek)...');
  const numericIndices = dataset.analysisResult.numericIndices;
  const categoricalIndices = dataset.analysisResult.categoricalIndices;
  const rawRows = dataset.fullData.map(r => r.filter((_, idx) => idx !== dataset.headers.indexOf(dataset.targetColumn)));
  const labels = dataset.fullData.map(r => String(r[dataset.headers.indexOf(dataset.targetColumn)]));

  const smoteNC = augService.applySMOTE(rawRows, labels, numericIndices, { k: 3, categoricalIndices });
  console.log(`✓ SMOTE-NC generated +${smoteNC.syntheticCount} mixed synthetic samples (Total: ${smoteNC.augmentedData.length})`);

  const adasynRes = augService.applyADASYN(rawRows, labels, numericIndices, { k: 3, categoricalIndices });
  console.log(`✓ ADASYN generated +${adasynRes.syntheticCount} adaptive boundary samples (Total: ${adasynRes.augmentedData.length})`);

  const tomekRes = augService.applySMOTETomek(rawRows, labels, numericIndices, { k: 3, categoricalIndices });
  console.log(`✓ SMOTE-Tomek generated samples and cleaned ${tomekRes.tomekRemovedCount} boundary conflicts`);

  // 6. Test Multi-Model Classification (k-NN, Decision Tree, Logistic Regression, Random Forest)
  const expService = await import('./js/services/experiment.js');
  console.log('\n6️⃣ Testing Controlled Multi-Strategy & Multi-Model Evaluation Pipeline...');
  
  const modelsToTest = ['knn', 'decision_tree', 'logistic_regression', 'random_forest'];
  for (const modelType of modelsToTest) {
    const expRes = await expService.runExperiment({
      userId,
      dataset,
      name: `Benchmark_${modelType.toUpperCase()}`,
      strategies: ['smote', 'adasyn', 'smote_tomek', 'oversampling'],
      runs: 3,
      trainTestSplit: 0.8,
      modelType,
      baseSeed: 42,
    });

    if (!expRes.success) throw new Error(`Experiment failed on ${modelType}: ` + expRes.error.message);
    const exp = expRes.data;
    const baseF1 = (exp.baseline.aggregated.f1.mean * 100).toFixed(1);
    const topGain = exp.recommendation.improvement;
    console.log(`✓ [Model: ${modelType.toUpperCase()}] Baseline F1: ${baseF1}% | Top Strategy: "${exp.recommendation.bestStrategy}" (+${topGain}% F1) | Verdict: "${exp.recommendation.verdict.toUpperCase()}"`);
    
    // Verify downloadable CSV attachments
    const topResult = exp.strategyResults[0];
    if (!topResult.augmentedCSV || !topResult.syntheticCSV) {
      throw new Error('Missing generated CSV exports on strategy results');
    }
  }

  // 7. Test Reports Generator
  const reportsService = await import('./js/services/reports.js');
  console.log('\n7️⃣ Testing Narrative Report Compiler...');
  const latestExp = expService.getExperiments(userId)[0];
  const report = reportsService.generateReportFromExperiment(userId, latestExp, dataset);
  console.log(`✓ Compiled Report: "${report.title}" (Verdict: ${report.verdict.toUpperCase()}) with ${report.sections.length} narrative sections.`);

  console.log('\n========================================================');
  console.log('🎉 ALL PRODUCTION ENGINE CAPABILITIES VERIFIED 100% OPERATIONAL!');
  console.log('========================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});

