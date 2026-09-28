import React from 'react';
import { 
  Search, 
  Filter, 
  RotateCcw, 
  FileDown, 
  SlidersHorizontal 
} from 'lucide-react';

const STATUS_OPTIONS = ['All', 'New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

export default function FilterToolbar({
  filters,
  onFilterChange,
  onResetFilters,
  sources = [],
  totalMatched = 0,
  onExportFilteredExcel,
  isExporting,
}) {
  const hasActiveFilters = Boolean(
    filters.search ||
    filters.status !== 'All' ||
    filters.source !== 'All' ||
    filters.minVal ||
    filters.maxVal ||
    filters.startDate ||
    filters.endDate
  );

  return (
    <div className="filter-card">
      <div className="filter-header">
        <div className="filter-title-group">
          <Filter size={18} className="text-secondary" />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Data Filters & Query</span>
          <span className="filter-badge">
            {totalMatched} {totalMatched === 1 ? 'record' : 'records'} matching
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {hasActiveFilters && (
            <button 
              className="btn btn-outline btn-sm" 
              onClick={onResetFilters}
              title="Reset all filters to default"
            >
              <RotateCcw size={13} />
              <span>Reset Filters</span>
            </button>
          )}

          <button 
            className="btn btn-success btn-sm"
            onClick={onExportFilteredExcel}
            disabled={totalMatched === 0 || isExporting}
            title="Download current filtered data as Excel (.xlsx)"
          >
            <FileDown size={15} className={isExporting ? 'spinner' : ''} />
            <span>{isExporting ? 'Exporting...' : 'Export Filtered Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Quick Status Pills */}
      <div>
        <div className="filter-label" style={{ marginBottom: '0.45rem' }}>Quick Filter by Pipeline Stage</div>
        <div className="status-pills">
          {STATUS_OPTIONS.map((status) => {
            const isActive = filters.status === status;
            return (
              <button
                key={status}
                type="button"
                className={`status-pill ${isActive ? 'active' : ''}`}
                onClick={() => onFilterChange('status', status)}
              >
                <span>{status}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="filter-row">
        {/* Global Search */}
        <div className="filter-group" style={{ gridColumn: 'span 2' }}>
          <label className="filter-label">Search Keywords</label>
          <div className="search-input-wrapper">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by name, email, company, phone, city..."
              value={filters.search}
              onChange={(e) => onFilterChange('search', e.target.value)}
            />
          </div>
        </div>

        {/* Lead Source */}
        <div className="filter-group">
          <label className="filter-label">Lead Source</label>
          <select
            className="form-select"
            value={filters.source}
            onChange={(e) => onFilterChange('source', e.target.value)}
          >
            <option value="All">All Sources</option>
            {sources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        </div>

        {/* Min Deal Value */}
        <div className="filter-group">
          <label className="filter-label">Min Value ($)</label>
          <input
            type="number"
            className="form-input"
            placeholder="e.g. 10000"
            min="0"
            value={filters.minVal}
            onChange={(e) => onFilterChange('minVal', e.target.value)}
          />
        </div>

        {/* Max Deal Value */}
        <div className="filter-group">
          <label className="filter-label">Max Value ($)</label>
          <input
            type="number"
            className="form-input"
            placeholder="e.g. 150000"
            min="0"
            value={filters.maxVal}
            onChange={(e) => onFilterChange('maxVal', e.target.value)}
          />
        </div>

        {/* Date From */}
        <div className="filter-group">
          <label className="filter-label">Created From</label>
          <input
            type="date"
            className="form-input"
            value={filters.startDate}
            onChange={(e) => onFilterChange('startDate', e.target.value)}
          />
        </div>

        {/* Date To */}
        <div className="filter-group">
          <label className="filter-label">Created To</label>
          <input
            type="date"
            className="form-input"
            value={filters.endDate}
            onChange={(e) => onFilterChange('endDate', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
