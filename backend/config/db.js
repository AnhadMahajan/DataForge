/**
 * DataForge — MongoDB Connection Manager
 * Architecture: MVC Config Layer
 */

import mongoose from 'mongoose';
import dns from 'dns';

// Fix for Windows Node.js querySrv ECONNREFUSED with MongoDB Atlas
if (process.platform === 'win32') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (dnsErr) {
    // Fallback to default resolver if custom DNS set fails
  }
}

let cachedConn = null;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (cachedConn) {
    return cachedConn;
  }

  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/dataforge';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    cachedConn = conn;

    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    console.log(`[MongoDB] Active Database: ${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error(`[MongoDB] Connection Warning: ${err.message}`);
    if (err.message.includes('whitelist') || err.message.includes('whitelisted')) {
      console.warn(`[MongoDB Atlas] IP Whitelist Error: Please add 0.0.0.0/0 to your MongoDB Atlas Network Access.`);
    } else {
      console.warn(`[MongoDB] Please ensure MongoDB Atlas cluster is reachable or verify MONGO_URI in .env.`);
    }
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
