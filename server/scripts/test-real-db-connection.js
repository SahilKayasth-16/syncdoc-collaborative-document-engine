import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function testRealDBConnection() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI is missing in process.env');
    process.exit(1);
  }

  console.log('Connecting to Real MongoDB database...');

  try {
    const conn = await mongoose.connect(uri);
    console.log('✓ Connected to Real MongoDB successfully!');

    const db = conn.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('\nExisting collections in Real MongoDB:');
    if (collections.length === 0) {
      console.log('  (Database is currently empty - 0 collections)');
    } else {
      for (const collInfo of collections) {
        const count = await db.collection(collInfo.name).countDocuments();
        console.log(`  - ${collInfo.name}: ${count} documents`);
      }
    }

    await mongoose.connection.close();
    console.log('\nReal MongoDB Connection Verification Passed!');
  } catch (err) {
    console.error('❌ Failed to connect to Real MongoDB:', err.message);
    process.exit(1);
  }
}

testRealDBConnection();

