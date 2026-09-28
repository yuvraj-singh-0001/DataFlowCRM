# 🚀 DataFlow CRM

Full-stack modern CRM application built with **React**, **Node.js / Express**, and **MongoDB**, featuring **Excel (.xlsx, .csv) Import, Dynamic Filtering, and Filtered Excel Export**.

---

## 🌟 Key Features

1. **Excel & CSV Import**:
   - Drag-and-drop or select `.xlsx`, `.xls`, or `.csv` files.
   - Real-time client-side preview of rows before saving.
   - Intelligent column synonym matching (`Name`, `Email`, `Phone`, `Company`, `Status`, `Deal Value`, `City`, `Source`).
   - Stores directly into **MongoDB**.

2. **Advanced Multi-Criteria Filtering**:
   - Global search by Contact Name, Email, Phone, Company, or Notes.
   - Quick pipeline filter pills: `All`, `New`, `Contacted`, `Qualified`, `Proposal`, `Won`, `Lost`.
   - Lead acquisition channel filter (Website, Referral, LinkedIn, Cold Call, Excel Import).
   - Deal Value range slider / inputs (`Min $` to `Max $`).
   - Date range selector (`Created From` - `Created To`).

3. **Excel Filtered Export & Download**:
   - **Export Filtered Excel (.xlsx)**: Instantly downloads only the data matching your active filters.
   - **Export Selected Rows**: Select specific rows with checkboxes and download only those rows.
   - Styled Excel headers and automatic column width sizing.

4. **Live MongoDB Integration & KPIs**:
   - Total Leads count.
   - Total Pipeline Value ($).
   - Closed Won Revenue ($).
   - Conversion Rate (%).
   - Auto-seeding with realistic demo leads on initial run.

---

## 📁 Project Structure

```
DataFlow CRM/
├── client/                     # Frontend (React + Vite + Modern CSS)
│   ├── src/
│   │   ├── components/         # Navbar, Table, Filters, KPI Cards, Modals
│   │   ├── services/api.js     # API communication layer
│   │   ├── App.jsx             # Main dashboard logic
│   │   └── index.css           # Modern design tokens & styles
│   └── package.json
│
├── server/                     # Backend (Node.js + Express + MongoDB)
│   ├── models/Lead.js          # Mongoose schema for CRM Leads
│   ├── controllers/crmController.js # Excel import/export & CRUD logic
│   ├── routes/crmRoutes.js     # Express API routes & Multer upload
│   ├── .env                    # PORT & MONGODB_URI configuration
│   ├── server.js               # Main Express entry point
│   └── package.json
│
└── package.json                # Root package manager scripts
```

---

## ⚡ How to Run

### 1. Start Backend Server
```powershell
cd server
npm start
```
> Server runs on: `http://localhost:5000` (Connected to local MongoDB `mongodb://127.0.0.1:27017/dataflow_crm`)

### 2. Start Frontend Client
```powershell
cd client
npm run dev
```
> Client runs on: `http://localhost:5173`
