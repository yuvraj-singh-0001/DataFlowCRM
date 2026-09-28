require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crmRoutes = require('./routes/crmRoutes');
const Lead = require('./models/Lead');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dataflow_crm';

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Mount CRM API routes
app.use('/api/leads', crmRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
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
      console.log('Database empty. Seeding initial CRM sample data...');
      const sampleController = require('./controllers/crmController');
      // Call seed internally
      const fakeReq = {};
      const fakeRes = { json: () => {}, status: () => ({ json: () => {} }) };
      await sampleController.seedSampleData(fakeReq, fakeRes);
      console.log('Initial sample CRM data seeded successfully!');
    }
  } catch (err) {
    console.warn('Auto-seed check warning:', err.message);
  }
}

// Connect to MongoDB & Start Server
mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log(`Connected to MongoDB successfully at: ${MONGODB_URI}`);
    await autoSeedIfEmpty();
    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(` DataFlow CRM Backend is live on port ${PORT}`);
      console.log(` API Endpoint: http://localhost:${PORT}/api/leads`);
      console.log(` Health Check: http://localhost:${PORT}/api/health`);
      console.log(`===============================================`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
