import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

// Layout
import Layout from './components/layout/Layout'

// Pages
import Dashboard from './pages/dashboard/Dashboard'
import AddComplaint from './pages/complaints/AddComplaint'
import ViewComplaints from './pages/complaints/ViewComplaints'
import StaffManagement from './pages/staff/StaffManagement'
import RunningTrains from './pages/trains/RunningTrains'
import AdvancedAnalysis from './pages/analysis/AdvancedAnalysis'
import Reports from './pages/reports/Reports'
import UserManagement from './pages/UserManagement'
import Settings from './pages/Settings'

// Temporary mock session - remove when login is fixed
const mockSession = {
  user: {
    id: '4c273820-120c-4d06-bed2-01a8e1c4ee0d',
    email: 'manish.bajaj7@gmail.com'
  }
}
const mockUserRole = 'admin'

export default function App() {
  return (
    <Router>
      <Layout session={mockSession} userRole={mockUserRole}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard userRole={mockUserRole} />} />
          <Route path="/add-complaint" element={<AddComplaint />} />
          <Route path="/complaints" element={<ViewComplaints userRole={mockUserRole} />} />
          <Route path="/staff" element={<StaffManagement />} />
          <Route path="/trains" element={<RunningTrains userRole={mockUserRole} />} />
          <Route path="/analysis" element={<AdvancedAnalysis userRole={mockUserRole} />} />
          <Route path="/reports" element={<Reports userRole={mockUserRole} />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </Router>
  )
}
