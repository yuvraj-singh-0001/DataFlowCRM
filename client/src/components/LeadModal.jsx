import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save } from 'lucide-react';
import { createLead, updateLead } from '../services/api';

const STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

export default function LeadModal({ isOpen, onClose, lead, onSuccess, notify }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    status: 'New',
    value: '',
    source: 'Website',
    city: '',
    country: '',
    assignedTo: 'Sales Team',
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        company: lead.company || '',
        status: lead.status || 'New',
        value: lead.value !== undefined ? String(lead.value) : '',
        source: lead.source || 'Website',
        city: lead.city || '',
        country: lead.country || '',
        assignedTo: lead.assignedTo || 'Sales Team',
        notes: lead.notes || '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        status: 'New',
        value: '',
        source: 'Website',
        city: '',
        country: '',
        assignedTo: 'Sales Team',
        notes: '',
      });
    }
  }, [lead, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      notify('Please provide the lead/customer name', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        ...formData,
        value: formData.value ? Number(formData.value) : 0,
      };

      let res;
      if (lead && lead._id) {
        res = await updateLead(lead._id, payload);
      } else {
        res = await createLead(payload);
      }

      if (res.success) {
        notify(res.message || 'Saved successfully!', 'success');
        onSuccess();
        onClose();
      } else {
        notify(res.message || 'Operation failed', 'error');
      }
    } catch (err) {
      notify(`Error: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <UserPlus size={20} style={{ color: '#6366f1' }} />
            <span>{lead ? 'Edit CRM Lead' : 'Create New Lead'}</span>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Aarav Sharma"
                  className="form-input"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="name@company.com"
                  className="form-input"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  placeholder="+91 98765 43210"
                  className="form-input"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="form-label">Company Name</label>
                <input
                  type="text"
                  name="company"
                  placeholder="e.g. Apex Tech Ltd"
                  className="form-input"
                  value={formData.company}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="form-label">Pipeline Stage</label>
                <select
                  name="status"
                  className="form-select"
                  value={formData.status}
                  onChange={handleChange}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Deal Value ($)</label>
                <input
                  type="number"
                  name="value"
                  placeholder="e.g. 50000"
                  min="0"
                  className="form-input"
                  value={formData.value}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="form-label">Lead Source</label>
                <input
                  type="text"
                  name="source"
                  placeholder="Website, Referral, LinkedIn..."
                  className="form-input"
                  value={formData.source}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="form-label">City</label>
                <input
                  type="text"
                  name="city"
                  placeholder="Mumbai, New York..."
                  className="form-input"
                  value={formData.city}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="form-label">Country</label>
                <input
                  type="text"
                  name="country"
                  placeholder="India, USA..."
                  className="form-input"
                  value={formData.country}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="form-label">Assigned Representative</label>
                <input
                  type="text"
                  name="assignedTo"
                  placeholder="e.g. Vikram Mehta"
                  className="form-input"
                  value={formData.assignedTo}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group-full">
                <label className="form-label">Notes & Requirements</label>
                <textarea
                  name="notes"
                  className="form-textarea"
                  placeholder="Client requirements, discussion points, timeline..."
                  value={formData.notes}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              <Save size={15} />
              <span>{isSaving ? 'Saving...' : lead ? 'Update Lead' : 'Create Lead'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
