/**
 * DataForge — MongoDB Atlas Database Seeder
 * Populates cloud Atlas cluster with production benchmark datasets, default accounts,
 * completed synthesis jobs, and evaluation reports for evaluation and demonstration.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Dataset from '../models/Dataset.js';
import SynthesisJob from '../models/SynthesisJob.js';
import EvaluationReport from '../models/EvaluationReport.js';

async function seed() {
  console.log('====================================================');
  console.log('🌱 Starting DataForge MongoDB Atlas Seeding Pipeline');
  console.log('====================================================');

  const conn = await connectDB();
  if (!conn) {
    console.error('❌ Failed to connect to MongoDB. Aborting seeding.');
    process.exit(1);
  }

  try {
    // 1. Seed Users
    console.log('\n1️⃣ Seeding Default Users...');
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('Admin123!', salt);
    const researcherPasswordHash = await bcrypt.hash('Researcher123!', salt);

    const admin = await User.findOneAndUpdate(
      { email: 'admin@dataforge.ai' },
      {
        name: 'Lead Data Architect',
        email: 'admin@dataforge.ai',
        password: adminPasswordHash,
        role: 'admin',
      },
      { upsert: true, new: true }
    );

    const researcher = await User.findOneAndUpdate(
      { email: 'researcher@dataforge.ai' },
      {
        name: 'Senior ML Researcher',
        email: 'researcher@dataforge.ai',
        password: researcherPasswordHash,
        role: 'researcher',
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Admin: admin@dataforge.ai (Role: ${admin.role})`);
    console.log(`✓ Researcher: researcher@dataforge.ai (Role: ${researcher.role})`);

    // 2. Seed Customer Churn Benchmark Dataset
    console.log('\n2️⃣ Seeding Benchmark Datasets...');
    const churnHeaders = ['AccountAgeMonths', 'MonthlyCharges', 'UsageHours', 'SupportTickets', 'ContractType', 'ChurnRisk'];
    const churnRows = [];
    for (let i = 0; i < 280; i++) {
      const isHigh = i < 28;
      const isMed = i >= 28 && i < 84;
      churnRows.push([
        isHigh ? 6 : isMed ? 14 : 36,
        isHigh ? 110.5 : isMed ? 75.0 : 45.2,
        isHigh ? 18.0 : isMed ? 45.5 : 82.0,
        isHigh ? 7 : isMed ? 3 : 1,
        isHigh ? 'Month-to-Month' : isMed ? 'One-Year' : 'Two-Year',
        isHigh ? 'High' : isMed ? 'Medium' : 'Low',
      ]);
    }

    const churnDataset = await Dataset.findOneAndUpdate(
      { name: 'Customer Churn Benchmark' },
      {
        name: 'Customer Churn Benchmark',
        filename: 'customer_churn_benchmark.csv',
        sizeBytes: 15420,
        rowCount: 280,
        columnCount: 6,
        headers: churnHeaders,
        columns: [
          { name: 'AccountAgeMonths', dataType: 'numeric', nullCount: 0, missingPct: 0, min: 1, max: 60, mean: 28.4, std: 14.2 },
          { name: 'MonthlyCharges', dataType: 'numeric', nullCount: 0, missingPct: 0, min: 25.0, max: 125.0, mean: 58.6, std: 24.1 },
          { name: 'UsageHours', dataType: 'numeric', nullCount: 0, missingPct: 0, min: 5.0, max: 120.0, mean: 65.2, std: 28.5 },
          { name: 'SupportTickets', dataType: 'numeric', nullCount: 0, missingPct: 0, min: 0, max: 12, mean: 2.1, std: 1.8 },
          {
            name: 'ContractType',
            dataType: 'categorical',
            nullCount: 0,
            missingPct: 0,
            uniqueCount: 3,
            classBalance: [
              { value: 'Two-Year', count: 196, pct: 70 },
              { value: 'One-Year', count: 56, pct: 20 },
              { value: 'Month-to-Month', count: 28, pct: 10 },
            ],
          },
          {
            name: 'ChurnRisk',
            dataType: 'categorical',
            nullCount: 0,
            missingPct: 0,
            uniqueCount: 3,
            classBalance: [
              { value: 'Low', count: 196, pct: 70 },
              { value: 'Medium', count: 56, pct: 20 },
              { value: 'High', count: 28, pct: 10 },
            ],
          },
        ],
        dataMatrix: churnRows,
        createdBy: admin._id,
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Seeded Dataset: "${churnDataset.name}" (${churnDataset.rowCount} rows, ${churnDataset.columnCount} columns)`);

    // 3. Seed Synthesis Job
    console.log('\n3️⃣ Seeding Synthesis Jobs...');
    const synthJob = await SynthesisJob.findOneAndUpdate(
      { name: 'Production Copula Synthesis (250 Rows)' },
      {
        name: 'Production Copula Synthesis (250 Rows)',
        datasetId: churnDataset._id,
        algorithm: 'copula',
        rowCount: 250,
        status: 'completed',
        seed: 42,
        fidelityScore: 94.8,
        syntheticData: churnRows.slice(0, 250),
        createdBy: researcher._id,
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Seeded SynthesisJob: "${synthJob.name}" (Fidelity: ${synthJob.fidelityScore}%)`);

    // 4. Seed Evaluation Report (TSTR Benchmark)
    console.log('\n4️⃣ Seeding Evaluation Reports...');
    const evalReport = await EvaluationReport.findOneAndUpdate(
      { title: 'Customer Churn TSTR Benchmark: Random Forest' },
      {
        title: 'Customer Churn TSTR Benchmark: Random Forest',
        datasetId: churnDataset._id,
        modelType: 'random_forest',
        baselineAccuracy: 0.914,
        syntheticAccuracy: 0.892,
        baselineF1: 0.908,
        syntheticF1: 0.887,
        f1Score: 0.887,
        wassersteinDistance: 0.042,
        ksStatistic: 0.038,
        tstrRetention: 97.6,
        verdict: 'PRODUCTION_READY',
        privacyDCR: 0.934,
        metrics: {
          baseline: { accuracy: 0.914, f1: 0.908, precision: 0.912, recall: 0.905 },
          synthetic: { accuracy: 0.892, f1: 0.887, precision: 0.895, recall: 0.880 },
          tstrRetention: 97.6,
          verdict: 'PRODUCTION_READY',
        },
        createdBy: researcher._id,
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Seeded EvaluationReport: "${evalReport.title}" (Verdict: ${evalReport.verdict})`);

    console.log('\n====================================================');
    console.log('🎉 MongoDB Atlas Seeding Completed Successfully!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('[MongoDB] Connection closed.');
  }
}

seed();
