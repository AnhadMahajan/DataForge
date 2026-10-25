/**
 * DataForge — MongoDB Connection Manager
 * Architecture: MVC Config Layer
 */

import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/dataforge';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    console.log(`[MongoDB] Active Database: ${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error(`[MongoDB] Connection Warning: ${err.message}`);
    console.warn(`[MongoDB] Please ensure MongoDB is running locally or set MONGO_URI in .env to a MongoDB Atlas cluster URI.`);
    return null;
  }
}

// Graceful connection disconnect on process termination
process.on('SIGINT', async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('[MongoDB] Connection closed through process termination.');
  }
  process.exit(0);
});
