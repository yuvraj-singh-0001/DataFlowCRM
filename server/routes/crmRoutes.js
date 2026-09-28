const express = require('express');
const router = express.Router();
const multer = require('multer');
const crmController = require('../controllers/crmController');

// Multer memory storage (keeps file in memory buffer for quick parsing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max limit
  fileFilter: (req, file, cb) => {
    const isExcelOrCsv =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/csv' ||
      file.originalname.match(/\.(xlsx|xls|csv)$/i);

    if (isExcelOrCsv) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
    }
  },
});

// Stats
router.get('/stats', crmController.getStats);

// Sample template & Seeding
router.get('/sample-template', crmController.getSampleExcel);
router.post('/seed-sample', crmController.seedSampleData);

// Import & Export
router.post('/import-excel', upload.single('file'), crmController.importExcel);
router.get('/export-excel', crmController.exportExcel);

// Bulk operations
router.post('/bulk-delete', crmController.bulkDeleteLeads);
router.post('/bulk-status', crmController.bulkUpdateStatus);

// CRUD operations
router.get('/', crmController.getLeads);
router.post('/', crmController.createLead);
router.put('/:id', crmController.updateLead);
router.delete('/:id', crmController.deleteLead);

module.exports = router;
