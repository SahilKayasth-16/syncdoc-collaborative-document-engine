import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { EJSON } from 'bson';

dotenv.config();

async function migrateLocalToRealDB() {
  const realURI = process.env.MONGO_URI;
  if (!realURI) {
    console.error('❌ MONGO_URI missing in process.env');
    process.exit(1);
  }

  // Locate latest backup directory
  const backupsBase = path.resolve('backups');
  if (!fs.existsSync(backupsBase)) {
    console.error('❌ No backups directory found at:', backupsBase);
    process.exit(1);
  }

  const dirs = fs.readdirSync(backupsBase)
    .filter(d => d.startsWith('syncdoc-backup-'))
    .sort()
    .reverse();

  if (dirs.length === 0) {
    console.error('❌ No backup folders found inside:', backupsBase);
    process.exit(1);
  }

  const latestBackupDir = path.join(backupsBase, dirs[0]);
  console.log(`Using latest backup directory: ${latestBackupDir}`);

  const summaryPath = path.join(latestBackupDir, 'backup-summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.error('❌ Missing backup-summary.json at:', summaryPath);
    process.exit(1);
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  console.log('Backup summary loaded:', summary.collections);

  console.log('\nConnecting to Real MongoDB Database...');
  try {
    const conn = await mongoose.connect(realURI);
    const db = conn.connection.db;
    console.log('✓ Connected to Real MongoDB database successfully.');

    for (const [collName, count] of Object.entries(summary.collections)) {
      const ejsonPath = path.join(latestBackupDir, `${collName}.ejson`);
      if (!fs.existsSync(ejsonPath)) {
        console.error(`❌ Missing ${collName}.ejson file at:`, ejsonPath);
        process.exit(1);
      }

      console.log(`\nMigrating collection '${collName}' (${count} documents)...`);
      const rawContent = fs.readFileSync(ejsonPath, 'utf-8');
      const docs = EJSON.parse(rawContent);

      if (!Array.isArray(docs) || docs.length === 0) {
        console.log(`  No documents to import for collection '${collName}'.`);
        continue;
      }

      const collection = db.collection(collName);

      const ops = docs.map(doc => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true
        }
      }));

      const result = await collection.bulkWrite(ops);
      console.log(`  ✓ Collection '${collName}' migration complete:`);
      console.log(`    - Inserted: ${result.upsertedCount}`);
      console.log(`    - Modified: ${result.modifiedCount}`);
      console.log(`    - Matched: ${result.matchedCount}`);
    }

    console.log('\n--- MIGRATION TO REAL MONGODB COMPLETE ---');
    await mongoose.connection.close();
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrateLocalToRealDB();

