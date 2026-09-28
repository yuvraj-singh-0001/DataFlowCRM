const API_BASE = 'http://localhost:5000/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/leads/stats`);
  return res.json();
}

export async function fetchLeads(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'All') {
      query.append(key, value);
    }
  });

  const res = await fetch(`${API_BASE}/leads?${query.toString()}`);
  return res.json();
}

export async function createLead(data) {
  const res = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateLead(id, data) {
  const res = await fetch(`${API_BASE}/leads/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteLead(id) {
  const res = await fetch(`${API_BASE}/leads/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function bulkDeleteLeads(ids) {
  const res = await fetch(`${API_BASE}/leads/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return res.json();
}

export async function bulkUpdateStatus(ids, status) {
  const res = await fetch(`${API_BASE}/leads/bulk-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status }),
  });
  return res.json();
}

export async function importExcelFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/leads/import-excel`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export function getExportExcelUrl(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'All') {
      query.append(key, value);
    }
  });
  return `${API_BASE}/leads/export-excel?${query.toString()}`;
}

export function getSampleExcelUrl() {
  return `${API_BASE}/leads/sample-template`;
}

export async function seedSampleData() {
  const res = await fetch(`${API_BASE}/leads/seed-sample`, {
    method: 'POST',
  });
  return res.json();
}
