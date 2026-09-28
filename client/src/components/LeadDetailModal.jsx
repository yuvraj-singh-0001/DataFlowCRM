import React from 'react';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Building2, 
  MapPin, 
  DollarSign, 
  Tag, 
  Calendar, 
  Edit2, 
  FileText 
} from 'lucide-react';

export default function LeadDetailModal({ isOpen, onClose, lead, onEdit }) {
  if (!isOpen || !lead) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <User size={20} style={{ color: '#6366f1' }} />
            <span>Lead Profile: {lead.name}</span>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Top Card */}
          <div style={{ padding: '1rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {lead.name}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {lead.company || 'Individual / Freelance'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>
                ${(lead.value || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Deal Pipeline Value</div>
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              <Mail size={16} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Email Address</div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>{lead.email || '—'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              <Phone size={16} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Phone Number</div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>{lead.phone || '—'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              <MapPin size={16} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Location</div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                  {[lead.city, lead.country].filter(Boolean).join(', ') || 'Global'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              <Tag size={16} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Stage / Status</div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#818cf8' }}>{lead.status}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              <Building2 size={16} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Acquisition Channel</div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>{lead.source || 'Excel Import'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Created Date</div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                  {lead.createdAt ? new Date(lead.createdAt).toLocaleString() : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              <FileText size={15} />
              <span>Notes & Engagement History</span>
            </div>
            <div style={{ padding: '0.85rem', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', minHeight: '80px', fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
              {lead.notes || 'No notes added yet for this contact.'}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onClose();
              onEdit(lead);
            }}
          >
            <Edit2 size={14} />
            <span>Edit Information</span>
          </button>
        </div>
      </div>
    </div>
  );
}
