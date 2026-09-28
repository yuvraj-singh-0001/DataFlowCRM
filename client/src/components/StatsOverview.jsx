import React from 'react';
import { Users, DollarSign, Award, TrendingUp } from 'lucide-react';

export default function StatsOverview({ stats }) {
  if (!stats) return null;

  const cards = [
    {
      label: 'Total Leads in CRM',
      value: stats.totalLeads?.toLocaleString() || '0',
      subtext: 'Stored securely in MongoDB',
      icon: Users,
      accent: '#6366f1',
      lightAccent: 'rgba(99, 102, 241, 0.15)',
    },
    {
      label: 'Total Pipeline Value',
      value: `$${(stats.pipelineValue || 0).toLocaleString()}`,
      subtext: 'Across all active deals & stages',
      icon: DollarSign,
      accent: '#0ea5e9',
      lightAccent: 'rgba(14, 165, 233, 0.15)',
    },
    {
      label: 'Closed / Won Deals',
      value: `$${(stats.wonRevenue || 0).toLocaleString()}`,
      subtext: `${stats.wonLeads || 0} Deals Won successfully`,
      icon: Award,
      accent: '#10b981',
      lightAccent: 'rgba(16, 185, 129, 0.15)',
    },
    {
      label: 'Lead Conversion Rate',
      value: stats.conversionRate || '0.0%',
      subtext: 'Won vs. Total pipeline ratio',
      icon: TrendingUp,
      accent: '#f59e0b',
      lightAccent: 'rgba(245, 158, 11, 0.15)',
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map((card, i) => {
        const IconComponent = card.icon;
        return (
          <div 
            key={i} 
            className="stat-card"
            style={{ 
              '--accent-color': card.accent, 
              '--accent-light': card.lightAccent 
            }}
          >
            <div className="stat-info">
              <span className="stat-label">{card.label}</span>
              <span className="stat-val">{card.value}</span>
              <span className="stat-subtext">{card.subtext}</span>
            </div>
            <div className="stat-icon-wrapper">
              <IconComponent size={24} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
