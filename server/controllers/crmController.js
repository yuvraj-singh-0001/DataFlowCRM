const Lead = require('../models/Lead');
const xlsx = require('xlsx');

// Helper to normalize and map headers
function normalizeHeader(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapRowToLead(row) {
  const lead = {
    name: '',
    email: '',
    phone: '',
    company: '',
    status: 'New',
    value: 0,
    source: 'Excel Import',
    city: '',
    country: '',
    notes: '',
    assignedTo: 'Sales Team',
  };

  const statusMap = {
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Qualified',
    proposal: 'Proposal',
    won: 'Won',
    closedwon: 'Won',
    lost: 'Lost',
    closedlost: 'Lost',
  };

  const customFields = {};

  for (const [key, rawVal] of Object.entries(row)) {
    const val = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
    const normKey = normalizeHeader(key);

    if (['name', 'fullname', 'leadname', 'customer', 'client', 'contact', 'person'].includes(normKey)) {
      lead.name = val;
    } else if (['email', 'mail', 'emailaddress'].includes(normKey)) {
      lead.email = val.toLowerCase();
    } else if (['phone', 'mobile', 'tel', 'telephone', 'phonenumber', 'contactnumber'].includes(normKey)) {
      lead.phone = val;
    } else if (['company', 'organization', 'org', 'business', 'companyname'].includes(normKey)) {
      lead.company = val;
    } else if (['status', 'stage', 'leadstatus'].includes(normKey)) {
      const matched = statusMap[normKey.replace(/[^a-z]/g, '')] || statusMap[val.toLowerCase().replace(/[^a-z]/g, '')];
      lead.status = matched || 'New';
    } else if (['value', 'amount', 'dealvalue', 'revenue', 'dealamount', 'price', 'budget'].includes(normKey)) {
      const num = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
      lead.value = isNaN(num) ? 0 : Math.max(0, num);
    } else if (['source', 'leadsource', 'channel'].includes(normKey)) {
      lead.source = val || 'Excel Import';
    } else if (['city', 'location', 'town'].includes(normKey)) {
      lead.city = val;
    } else if (['country', 'nation'].includes(normKey)) {
      lead.country = val;
    } else if (['assignedto', 'owner', 'rep', 'salesrep'].includes(normKey)) {
      lead.assignedTo = val || 'Sales Team';
    } else if (['notes', 'note', 'remark', 'remarks', 'comments', 'comment', 'description'].includes(normKey)) {
      lead.notes = val;
    } else {
      if (val) {
        customFields[key] = val;
      }
    }
  }

  if (Object.keys(customFields).length > 0) {
    lead.customFields = customFields;
  }

  return lead;
}

// Build query filter object
function buildFilter(query) {
  const filter = {};

  // Global search
  if (query.search && query.search.trim()) {
    const s = query.search.trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { phone: { $regex: s, $options: 'i' } },
      { company: { $regex: s, $options: 'i' } },
      { city: { $regex: s, $options: 'i' } },
      { notes: { $regex: s, $options: 'i' } },
    ];
  }

  // Status filter (single or comma-separated)
  if (query.status && query.status !== 'All') {
    const statuses = query.status.split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      filter.status = statuses[0];
    } else if (statuses.length > 1) {
      filter.status = { $in: statuses };
    }
  }

  // Source filter
  if (query.source && query.source !== 'All') {
    filter.source = query.source;
  }

  // Value range
  if (query.minVal !== undefined && query.minVal !== '') {
    filter.value = filter.value || {};
    filter.value.$gte = Number(query.minVal);
  }
  if (query.maxVal !== undefined && query.maxVal !== '') {
    filter.value = filter.value || {};
    filter.value.$lte = Number(query.maxVal);
  }

  // Date range
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) {
      filter.createdAt.$gte = new Date(query.startDate);
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // Filter by explicit IDs (e.g. selected rows export)
  if (query.ids) {
    const idList = query.ids.split(',').map((id) => id.trim()).filter(Boolean);
    if (idList.length > 0) {
      filter._id = { $in: idList };
    }
  }

  return filter;
}

// 1. GET Leads (with pagination, filters, sorting)
exports.getLeads = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sortOptions = { [sortBy]: sortOrder };

    const filter = buildFilter(req.query);

    const [total, leads, sources] = await Promise.all([
      Lead.countDocuments(filter),
      Lead.find(filter).sort(sortOptions).skip(skip).limit(limit).lean(),
      Lead.distinct('source'),
    ]);

    res.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      count: leads.length,
      sources,
      data: leads,
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. GET CRM Stats / Dashboard KPIs
exports.getStats = async (req, res) => {
  try {
    const totalLeads = await Lead.countDocuments();
    const wonLeads = await Lead.countDocuments({ status: 'Won' });
    const wonTotalValue = await Lead.aggregate([
      { $match: { status: 'Won' } },
      { $group: { _id: null, total: { $sum: '$value' } } },
    ]);
    const pipelineTotalValue = await Lead.aggregate([
      { $group: { _id: null, total: { $sum: '$value' } } },
    ]);

    const statusBreakdown = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalValue: { $sum: '$value' } } },
    ]);

    const sourceBreakdown = await Lead.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]);

    const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0.0';

    res.json({
      success: true,
      stats: {
        totalLeads,
        wonLeads,
        wonRevenue: wonTotalValue[0]?.total || 0,
        pipelineValue: pipelineTotalValue[0]?.total || 0,
        conversionRate: `${conversionRate}%`,
        statusBreakdown,
        sourceBreakdown,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Create Lead
exports.createLead = async (req, res) => {
  try {
    const lead = new Lead(req.body);
    await lead.save();
    res.status(201).json({ success: true, data: lead, message: 'Lead created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// 4. Update Lead
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    res.json({ success: true, data: lead, message: 'Lead updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// 5. Delete Lead
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Bulk Delete Leads
exports.bulkDeleteLeads = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of IDs' });
    }
    const result = await Lead.deleteMany({ _id: { $in: ids } });
    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} records`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Bulk Update Status
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !ids.length || !status) {
      return res.status(400).json({ success: false, message: 'IDs and valid status are required' });
    }
    const result = await Lead.updateMany({ _id: { $in: ids } }, { $set: { status } });
    res.json({
      success: true,
      message: `Updated status to "${status}" for ${result.modifiedCount} records`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 8. Import Excel / CSV
exports.importExcel = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel or CSV file' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ success: false, message: 'Excel workbook contains no sheets' });
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found in uploaded sheet' });
    }

    const validLeads = [];
    const skippedRows = [];

    rawRows.forEach((row, index) => {
      const mapped = mapRowToLead(row);
      if (mapped.name && mapped.name.trim()) {
        validLeads.push(mapped);
      } else {
        skippedRows.push({ rowNumber: index + 2, reason: 'Missing Name' });
      }
    });

    if (validLeads.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid leads found. Please ensure at least one column has customer or lead names.',
      });
    }

    const inserted = await Lead.insertMany(validLeads);

    res.json({
      success: true,
      message: `Successfully imported ${inserted.length} leads from Excel`,
      importedCount: inserted.length,
      skippedCount: skippedRows.length,
      skippedRows,
      preview: inserted.slice(0, 5),
    });
  } catch (error) {
    console.error('Error importing Excel:', error);
    res.status(500).json({ success: false, message: `Import failed: ${error.message}` });
  }
};

// 9. Export Excel (Filtered or Selected)
exports.exportExcel = async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const leads = await Lead.find(filter).sort({ createdAt: -1 }).lean();

    if (!leads || leads.length === 0) {
      return res.status(404).json({ success: false, message: 'No data matches the selected filters to export' });
    }

    // Format rows for Excel export
    const excelData = leads.map((lead, index) => ({
      'S.No': index + 1,
      Name: lead.name || '',
      Email: lead.email || '',
      Phone: lead.phone || '',
      Company: lead.company || '',
      Status: lead.status || 'New',
      'Deal Value ($)': lead.value || 0,
      Source: lead.source || '',
      City: lead.city || '',
      Country: lead.country || '',
      'Assigned To': lead.assignedTo || '',
      Notes: lead.notes || '',
      'Created Date': lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-GB') : '',
    }));

    const worksheet = xlsx.utils.json_to_sheet(excelData);

    // Auto calculate column widths
    const colWidths = [
      { wch: 6 },  // S.No
      { wch: 22 }, // Name
      { wch: 28 }, // Email
      { wch: 16 }, // Phone
      { wch: 24 }, // Company
      { wch: 14 }, // Status
      { wch: 14 }, // Deal Value
      { wch: 16 }, // Source
      { wch: 16 }, // City
      { wch: 14 }, // Country
      { wch: 16 }, // Assigned To
      { wch: 30 }, // Notes
      { wch: 14 }, // Created Date
    ];
    worksheet['!cols'] = colWidths;

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Filtered Leads');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const nowStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="DataFlow_CRM_Export_${nowStr}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting Excel:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 10. Download Sample Excel Template
exports.getSampleExcel = async (req, res) => {
  try {
    const sampleData = [
      {
        'Full Name': 'Aarav Sharma',
        Email: 'aarav.sharma@example.com',
        Phone: '+91 9876543210',
        Company: 'Apex Tech Solutions',
        Status: 'Qualified',
        'Deal Value': 45000,
        Source: 'Website',
        City: 'Mumbai',
        Country: 'India',
        Notes: 'Interested in enterprise cloud CRM migration',
      },
      {
        'Full Name': 'Priya Patel',
        Email: 'priya.patel@innovate.co',
        Phone: '+91 9812345678',
        Company: 'Innovate AI Labs',
        Status: 'Proposal',
        'Deal Value': 92000,
        Source: 'Referral',
        City: 'Bengaluru',
        Country: 'India',
        Notes: 'Demo completed, awaiting budget approval',
      },
      {
        'Full Name': 'Michael Vance',
        Email: 'michael.v@globalcorp.net',
        Phone: '+1 415 555 0192',
        Company: 'Global Matrix Corp',
        Status: 'Won',
        'Deal Value': 125000,
        Source: 'LinkedIn',
        City: 'San Francisco',
        Country: 'USA',
        Notes: 'Contract signed for 2-year enterprise license',
      },
      {
        'Full Name': 'Sneha Rao',
        Email: 'sneha.rao@fintechpulse.in',
        Phone: '+91 9988776655',
        Company: 'FinTech Pulse',
        Status: 'New',
        'Deal Value': 28000,
        Source: 'Cold Call',
        City: 'Hyderabad',
        Country: 'India',
        Notes: 'Requested product brochure and security compliance sheet',
      },
      {
        'Full Name': 'David Miller',
        Email: 'david.m@cyberdefense.org',
        Phone: '+44 20 7946 0912',
        Company: 'Cyber Defense UK',
        Status: 'Contacted',
        'Deal Value': 60000,
        Source: 'Trade Show',
        City: 'London',
        Country: 'UK',
        Notes: 'Met at London Tech Expo 2026',
      },
    ];

    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 28 },
      { wch: 18 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 40 },
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Sample Leads');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="DataFlow_CRM_Sample_Template.xlsx"');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating sample template:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 11. Seed Sample Data into MongoDB
exports.seedSampleData = async (req, res) => {
  try {
    const defaultLeads = [
      {
        name: 'Aarav Sharma',
        email: 'aarav.sharma@apextech.com',
        phone: '+91 98765 43210',
        company: 'Apex Tech Solutions',
        status: 'Won',
        value: 85000,
        source: 'Website',
        city: 'Mumbai',
        country: 'India',
        assignedTo: 'Vikram Mehta',
        notes: 'Signed 3-year enterprise software contract.',
      },
      {
        name: 'Priya Patel',
        email: 'priya.p@innovatelabs.io',
        phone: '+91 98123 45678',
        company: 'Innovate AI Labs',
        status: 'Proposal',
        value: 120000,
        source: 'Referral',
        city: 'Bengaluru',
        country: 'India',
        assignedTo: 'Neha Gupta',
        notes: 'Proposal submitted for AI data pipeline integration.',
      },
      {
        name: 'Marcus Vance',
        email: 'marcus.vance@vanguardlogistics.com',
        phone: '+1 415 555 2410',
        company: 'Vanguard Logistics',
        status: 'Qualified',
        value: 65000,
        source: 'LinkedIn',
        city: 'San Francisco',
        country: 'USA',
        assignedTo: 'Vikram Mehta',
        notes: 'Needs automated tracking & invoice management.',
      },
      {
        name: 'Sneha Rao',
        email: 'sneha.rao@finpulse.co',
        phone: '+91 99887 76655',
        company: 'FinPulse Systems',
        status: 'Contacted',
        value: 34000,
        source: 'Cold Call',
        city: 'Hyderabad',
        country: 'India',
        assignedTo: 'Rahul Verma',
        notes: 'Follow up scheduled for Thursday 3 PM.',
      },
      {
        name: 'Elena Rostova',
        email: 'elena@novasoft.de',
        phone: '+49 30 901820',
        company: 'NovaSoft GmbH',
        status: 'Won',
        value: 150000,
        source: 'Website',
        city: 'Berlin',
        country: 'Germany',
        assignedTo: 'Neha Gupta',
        notes: 'Direct client, paid initial 50% deposit.',
      },
      {
        name: 'Karan Singhania',
        email: 'karan@singhaniagroup.in',
        phone: '+91 98334 11223',
        company: 'Singhania Retail Corp',
        status: 'New',
        value: 48000,
        source: 'Excel Import',
        city: 'Delhi',
        country: 'India',
        assignedTo: 'Unassigned',
        notes: 'Imported from Retail Trade Expo list.',
      },
      {
        name: 'David Miller',
        email: 'david.m@cyberguard.co.uk',
        phone: '+44 20 7946 0912',
        company: 'CyberGuard UK',
        status: 'Proposal',
        value: 95000,
        source: 'Referral',
        city: 'London',
        country: 'UK',
        assignedTo: 'Vikram Mehta',
        notes: 'Requested security audit report before signing.',
      },
      {
        name: 'Ananya Deshmukh',
        email: 'ananya@cloudnative.tech',
        phone: '+91 97654 32190',
        company: 'CloudNative Pune',
        status: 'Qualified',
        value: 72000,
        source: 'Website',
        city: 'Pune',
        country: 'India',
        assignedTo: 'Rahul Verma',
        notes: 'Evaluating our API latency & uptime SLAs.',
      },
      {
        name: 'Robert Chen',
        email: 'rchen@pacifictrading.sg',
        phone: '+65 6789 0123',
        company: 'Pacific Trading Pte',
        status: 'Lost',
        value: 50000,
        source: 'Cold Call',
        city: 'Singapore',
        country: 'Singapore',
        assignedTo: 'Neha Gupta',
        notes: 'Postponed project to next fiscal year.',
      },
      {
        name: 'Fatima Al-Mansoor',
        email: 'fatima@gulfventures.ae',
        phone: '+971 4 312 8899',
        company: 'Gulf Ventures LLC',
        status: 'Won',
        value: 210000,
        source: 'LinkedIn',
        city: 'Dubai',
        country: 'UAE',
        assignedTo: 'Vikram Mehta',
        notes: 'Strategic expansion partner in MENA region.',
      },
      {
        name: 'Rajesh Verma',
        email: 'rajesh.v@krishiexports.com',
        phone: '+91 98210 99887',
        company: 'Krishi Agro Exports',
        status: 'New',
        value: 38000,
        source: 'Excel Import',
        city: 'Ahmedabad',
        country: 'India',
        assignedTo: 'Unassigned',
        notes: 'Interested in export-import shipment tracking.',
      },
      {
        name: 'Sarah Jenkins',
        email: 'sjenkins@bluehorizon.ca',
        phone: '+1 604 555 7821',
        company: 'Blue Horizon Media',
        status: 'Contacted',
        value: 42000,
        source: 'Referral',
        city: 'Vancouver',
        country: 'Canada',
        assignedTo: 'Rahul Verma',
        notes: 'Introductory call completed, sending case studies.',
      },
    ];

    await Lead.deleteMany({});
    const inserted = await Lead.insertMany(defaultLeads);

    res.json({
      success: true,
      message: `Database populated with ${inserted.length} sample leads!`,
      count: inserted.length,
    });
  } catch (error) {
    console.error('Error seeding data:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
