import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ExcelCleaner from './components/ExcelCleaner';
import CrmDatabaseView from './components/CrmDatabaseView';
import { fetchHealth, fetchLeads } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('cleaner'); // 'cleaner' | 'crm'
  const [isConnected, setIsConnected] = useState(false);
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  const notify = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const checkConnection = useCallback(async () => {
    try {
      const data = await fetchHealth();
      setIsConnected(data.server === 'online' && data.database === 'connected');
    } catch {
      setIsConnected(false);
    }
  }, []);

  const refreshTotalCount = useCallback(async () => {
    try {
      const res = await fetchLeads({ limit: 1 });
      if (res.success) {
        setTotalLeadsCount(res.total || 0);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    checkConnection();
    refreshTotalCount();
  }, [checkConnection, refreshTotalCount]);

  return (
    <div className="app-layout">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
        totalLeadsInDb={totalLeadsCount}
      />

      {/* Main Content Area */}
      <main className="main-content-area">
        {activeTab === 'cleaner' && (
          <ExcelCleaner
            notify={notify}
            onRefreshDb={() => {
              checkConnection();
              refreshTotalCount();
            }}
          />
        )}

        {activeTab === 'crm' && (
          <CrmDatabaseView
            notify={notify}
            onRefreshCount={refreshTotalCount}
          />
        )}
      </main>
    </div>
  );
}
