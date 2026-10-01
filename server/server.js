require('dotenv').config();
const dns = require('dns');

// Fix for Windows Node.js querySrv ECONNREFUSED with MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  console.warn('DNS server override notice:', e.message);
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crmRoutes = require('./routes/crmRoutes');
const Lead = require('./models/Lead');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dataflow_crm';

console.log('\n======================================================');
console.log('       DATAFLOW CRM BACKEND INITIALIZING');
console.log('======================================================');
console.log(`[*] Configured Port   : ${PORT}`);
console.log(`[*] Connecting to DB  : ${MONGODB_URI}`);
console.log('------------------------------------------------------');

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Simple terminal logger for incoming requests
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '❌' : '✅';
    console.log(`[REQ] ${statusColor} ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const statusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  res.json({
    server: 'online',
    port: PORT,
    database: statusMap[dbState] || 'unknown',
    databaseName: mongoose.connection.name || 'dataflow_crm',
    timestamp: new Date().toISOString(),
  });
});

// Mount CRM API routes
app.use('/api/leads', crmRoutes);

// Frontend static build serving (Production & Live Hosting)
const clientDistPath = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`[*] Client build detected at: ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  // SPA fallback: any non-API GET request serves index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ success: false, message: 'API endpoint not found' });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  // If dist is not yet built (pure local API dev server mode)
  app.get('/', (req, res) => {
    res.json({
      message: 'DataFlow CRM Backend API is running.',
      healthCheck: '/api/health',
      leadsApi: '/api/leads',
    });
  });
}

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[ERROR] Server exception:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Auto-seed default realistic sample data if DB is empty
async function autoSeedIfEmpty() {
  try {
    const count = await Lead.countDocuments();
    if (count === 0) {
      console.log('[DATABASE] 📂 Collection is empty. Auto-seeding default CRM demo leads...');
      const sampleController = require('./controllers/crmController');
      const fakeReq = {};
      const fakeRes = { json: () => {}, status: () => ({ json: () => {} }) };
      await sampleController.seedSampleData(fakeReq, fakeRes);
      console.log('[DATABASE] ✅ Default sample leads seeded successfully into MongoDB!');
    } else {
      console.log(`[DATABASE] 📊 Existing leads found in database: ${count} records`);
    }
  } catch (err) {
    console.warn('[DATABASE] ⚠️ Auto-seed check warning:', err.message);
  }
}

// Database Connection Event Listeners
mongoose.connection.on('connected', () => {
  console.log(`\n======================================================`);
  console.log(` ✅ DATABASE STATUS : CONNECTED TO MONGODB`);
  console.log(` 📂 Database Name   : ${mongoose.connection.name}`);
  console.log(` 🌐 Database Host   : ${mongoose.connection.host}:${mongoose.connection.port}`);
  console.log(` 🚀 Server Port     : http://localhost:${PORT}`);
  console.log(` 📋 Health Check    : http://localhost:${PORT}/api/health`);
  console.log(` 👥 Leads API       : http://localhost:${PORT}/api/leads`);
  console.log(`======================================================\n`);
});

mongoose.connection.on('error', (err) => {
  console.error(`\n❌ [DATABASE ERROR] Connection failed:`, err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn(`\n⚠️ [DATABASE] Disconnected from MongoDB`);
});

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    await autoSeedIfEmpty();
  })
  .catch((err) => {
    console.error(`\n❌ Failed to connect to MongoDB at: ${MONGODB_URI}`);
    console.error(`Reason: ${err.message}`);
    console.log(`\nTip: Make sure MongoDB service is running on your machine.`);
  });

// Start Express Server
const server = app.listen(PORT, () => {
  console.log(`[SERVER] 🚀 Express HTTP server is listening on port ${PORT}`);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n[SERVER] Gracefully shutting down...');
  await mongoose.connection.close();
  server.close(() => {
    console.log('[SERVER] Closed all connections. Goodbye!\n');
    process.exit(0);
  });
});
