import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import StatsOverview from './components/StatsOverview';
import FilterToolbar from './components/FilterToolbar';
import BulkActionBar from './components/BulkActionBar';
import LeadsTable from './components/LeadsTable';
import ImportExcelModal from './components/ImportExcelModal';
import LeadModal from './components/LeadModal';
import LeadDetailModal from './components/LeadDetailModal';
import { 
  fetchHealth, 
  fetchStats, 
  fetchLeads, 
  deleteLead, 
  bulkDeleteLeads, 
  bulkUpdateStatus, 
  getExportExcelUrl,
  seedSampleData
} from './services/api';

export default function App() {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data & Stats
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [sources, setSources] = useState([]);

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: 'All',
    source: 'All',
    minVal: '',
    maxVal: '',
    startDate: '',
    endDate: '',
  });

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState(null);
  const [leadToView, setLeadToView] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);

  const notify = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Check Health
  const checkHealth = useCallback(async () => {
    try {
      const data = await fetchHealth();
      setIsConnected(data.status === 'online' && data.database === 'connected');
    } catch {
      setIsConnected(false);
    }
  }, []);

  // Load KPI Stats
  const loadStats = useCallback(async () => {
    try {
      const res = await fetchStats();
      if (res.success) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  // Load Leads with Active Filters
  const loadLeads = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await fetchLeads({
        page,
        limit,
        sortBy,
        sortOrder,
        ...filters,
      });

      if (res.success) {
        setLeads(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        if (res.sources && res.sources.length) {
          setSources(res.sources);
        }
      }
    } catch (err) {
      console.error('Failed to load leads:', err);
      notify('Could not connect to CRM backend server', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [page, limit, sortBy, sortOrder, filters]);

  // Initial load
  useEffect(() => {
    checkHealth();
    loadStats();
  }, [checkHealth, loadStats]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Handle Filter Change
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1); // reset to page 1 on filter
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      status: 'All',
      source: 'All',
      minVal: '',
      maxVal: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
    notify('Filters reset to default', 'info');
  };

  // Sorting
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Selection
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const currentPageIds = leads.map((l) => l._id);
    const allSelected = currentPageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
    }
  };

  // Export Filtered Leads to Excel (.xlsx)
  const handleExportFilteredExcel = () => {
    if (total === 0) {
      notify('No matching records to export', 'error');
      return;
    }
    setIsExporting(true);
    const exportUrl = getExportExcelUrl({
      ...filters,
      sortBy,
      sortOrder,
    });
    // Trigger download
    const link = document.createElement('a');
    link.href = exportUrl;
    link.setAttribute('download', `DataFlow_CRM_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setIsExporting(false);
      notify(`Exporting ${total} filtered leads to Excel!`, 'success');
    }, 800);
  };

  // Export Only Selected Rows to Excel (.xlsx)
  const handleExportSelectedExcel = () => {
    if (selectedIds.length === 0) return;
    const exportUrl = getExportExcelUrl({ ids: selectedIds.join(',') });
    const link = document.createElement('a');
    link.href = exportUrl;
    link.setAttribute('download', `DataFlow_CRM_Selected_${selectedIds.length}_Leads.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Exported ${selectedIds.length} selected leads to Excel!`, 'success');
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected leads from MongoDB?`)) {
      return;
    }

    try {
      const res = await bulkDeleteLeads(selectedIds);
      if (res.success) {
        notify(res.message, 'success');
        setSelectedIds([]);
        loadLeads();
        loadStats();
      }
    } catch (err) {
      notify(`Bulk delete error: ${err.message}`, 'error');
    }
  };

  // Bulk Status Update
  const handleBulkUpdateStatus = async (status) => {
    if (selectedIds.length === 0) return;
    try {
      const res = await bulkUpdateStatus(selectedIds, status);
      if (res.success) {
        notify(res.message, 'success');
        loadLeads();
        loadStats();
      }
    } catch (err) {
      notify(`Update error: ${err.message}`, 'error');
    }
  };

  // Single Delete
  const handleDeleteLead = async (id, name) => {
    if (!window.confirm(`Delete lead "${name}"?`)) return;
    try {
      const res = await deleteLead(id);
      if (res.success) {
        notify('Lead deleted successfully', 'success');
        setSelectedIds((prev) => prev.filter((item) => item !== id));
        loadLeads();
        loadStats();
      }
    } catch (err) {
      notify(`Delete failed: ${err.message}`, 'error');
    }
  };

  // Seed sample data
  const handleSeedData = async () => {
    if (!window.confirm('Load 12+ realistic sample CRM leads into MongoDB?')) return;
    try {
      const res = await seedSampleData();
      if (res.success) {
        notify(res.message, 'success');
        loadLeads();
        loadStats();
      }
    } catch (err) {
      notify(`Seed error: ${err.message}`, 'error');
    }
  };

  return (
    <div className="app-container">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Top Navbar */}
      <Navbar
        isConnected={isConnected}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenAddLead={() => {
          setLeadToEdit(null);
          setIsLeadModalOpen(true);
        }}
        onRefresh={() => {
          checkHealth();
          loadLeads();
          loadStats();
          notify('Refreshed data from MongoDB', 'info');
        }}
        isRefreshing={isRefreshing}
        onSeedData={handleSeedData}
      />

      {/* Main Container */}
      <main className="main-wrapper">
        {/* KPI Cards */}
        <StatsOverview stats={stats} />

        {/* Filter & Search Toolbar */}
        <FilterToolbar
          filters={filters}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          sources={sources}
          totalMatched={total}
          onExportFilteredExcel={handleExportFilteredExcel}
          isExporting={isExporting}
        />

        {/* Bulk Action Bar */}
        <BulkActionBar
          selectedCount={selectedIds.length}
          onClearSelection={() => setSelectedIds([])}
          onExportSelected={handleExportSelectedExcel}
          onBulkDelete={handleBulkDelete}
          onBulkUpdateStatus={handleBulkUpdateStatus}
        />

        {/* Dynamic Table */}
        <LeadsTable
          leads={leads}
          total={total}
          page={page}
          limit={limit}
          totalPages={totalPages}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onPageChange={setPage}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onViewLead={(lead) => setLeadToView(lead)}
          onEditLead={(lead) => {
            setLeadToEdit(lead);
            setIsLeadModalOpen(true);
          }}
          onDeleteLead={handleDeleteLead}
          onOpenImport={() => setIsImportOpen(true)}
        />
      </main>

      {/* Modals */}
      <ImportExcelModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => {
          loadLeads();
          loadStats();
        }}
        notify={notify}
      />

      <LeadModal
        isOpen={isLeadModalOpen}
        onClose={() => {
          setIsLeadModalOpen(false);
          setLeadToEdit(null);
        }}
        lead={leadToEdit}
        onSuccess={() => {
          loadLeads();
          loadStats();
        }}
        notify={notify}
      />

      <LeadDetailModal
        isOpen={Boolean(leadToView)}
        onClose={() => setLeadToView(null)}
        lead={leadToView}
        onEdit={(lead) => {
          setLeadToEdit(lead);
          setIsLeadModalOpen(true);
        }}
      />
    </div>
  );
}
