import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { EJSON } from 'bson';

async function backupLocalDB() {
  const localURI = 'mongodb://localhost:27017/syncdoc';
  const backupDir = path.resolve('backups', `syncdoc-backup-${Date.now()}`);

  console.log(`Starting backup of local MongoDB at: ${localURI}...`);
  console.log(`Target backup directory: ${backupDir}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  try {
    const conn = await mongoose.connect(localURI);
    const db = conn.connection.db;

    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`, collections.map(c => c.name));

    const backupSummary = {
      timestamp: new Date().toISOString(),
      database: 'syncdoc',
      backupDir,
      collections: {}
    };

    for (const collInfo of collections) {
      const collName = collInfo.name;
      const docs = await db.collection(collName).find({}).toArray();
      
      const filePath = path.join(backupDir, `${collName}.ejson`);
      const serializedData = EJSON.stringify(docs, null, 2);
      fs.writeFileSync(filePath, serializedData, 'utf-8');

      backupSummary.collections[collName] = docs.length;
      console.log(`  ✓ Exported ${docs.length} documents from collection '${collName}' to ${filePath}`);
    }

    const summaryPath = path.join(backupDir, 'backup-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(backupSummary, null, 2), 'utf-8');

    console.log('\n--- BACKUP COMPLETED SUCCESSFULLY ---');
    console.log(`Backup Location: ${backupDir}`);
    console.log(`Database: syncdoc`);
    console.log(`Collections & Counts:`, backupSummary.collections);

    await mongoose.connection.close();
    return backupSummary;
  } catch (err) {
    console.error('❌ Backup Failed:', err);
    process.exit(1);
  }
}

backupLocalDB();

