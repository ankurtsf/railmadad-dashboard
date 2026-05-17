import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Settings as SettingsIcon, Database, Shield, Bell, Info, RefreshCw, Trash2, AlertTriangle } from 'lucide-react'
import { Button, Toast, Card } from '../components/ui/index'

export default function Settings() {
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [showWipeModal, setShowWipeModal] = useState(false)
  const [wiping, setWiping] = useState(false)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 5000)
  }

  const handleWipeComplaints = async () => {
    if (!confirm('⚠️ This will DELETE ALL complaints data. Are you absolutely sure?')) return
    setWiping(true)
    const { error } = await supabase.from('complaints').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (!error) showToast('✅ All complaints data wiped', 'success')
    else showToast(`Error: ${error.message}`, 'error')
    setWiping(false)
    setShowWipeModal(false)
  }

  const handleWipeStaff = async () => {
    if (!confirm('⚠️ This will DELETE ALL staff deployment data. Are you sure?')) return
    const { error } = await supabase.from('staff_deployments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (!error) showToast('✅ Staff deployment data wiped', 'success')
    else showToast(`Error: ${error.message}`, 'error')
  }

  return (
    <div className="space-y-5">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      <div className="bg-gray-700 rounded-xl p-5 text-white">
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-gray-300 text-sm mt-0.5">System configuration and data management</p>
      </div>

      {/* System Info */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-800 text-sm">System Information</h3>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          {[
            { label: 'Application', value: 'RailMadad Complaint Management System' },
            { label: 'Version', value: '1.0.0' },
            { label: 'Database', value: 'Supabase (PostgreSQL)' },
            { label: 'Frontend', value: 'React + Vite + TailwindCSS' },
            { label: 'OCR Engine', value: 'Tesseract.js (Local)' },
            { label: 'Export Format', value: 'Excel (.xlsx)' },
          ].map((item, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
              <p className="text-sm font-medium text-gray-800">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Database Management */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-800 text-sm">Database Management</h3>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-medium text-gray-800 text-sm">Complaints Data</p>
              <p className="text-xs text-gray-500 mt-0.5">All complaint records uploaded via Excel</p>
            </div>
            <Button variant="danger" icon={Trash2} size="sm" onClick={handleWipeComplaints} disabled={wiping}>
              Wipe All Complaints
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-medium text-gray-800 text-sm">Staff Deployment Data</p>
              <p className="text-xs text-gray-500 mt-0.5">All staff deployment records from PDFs and manual entry</p>
            </div>
            <Button variant="danger" icon={Trash2} size="sm" onClick={handleWipeStaff}>
              Wipe Staff Data
            </Button>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-800 text-sm">Security & Access</h3>
        </div>
        <div className="p-5 space-y-3">
          {[
            { label: 'Authentication', value: 'Supabase Auth (Email + Password)', status: 'Active' },
            { label: 'Row Level Security', value: 'Disabled (re-enable after login fix)', status: 'Warning' },
            { label: 'Admin Access', value: 'Full CRUD operations', status: 'Active' },
            { label: 'Reporter Access', value: 'View & Download only', status: 'Active' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-500">{item.value}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                item.status === 'Active' ? 'bg-green-100 text-green-700' :
                item.status === 'Warning' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>{item.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Items */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-amber-800">Pending Setup Items</h3>
        </div>
        <ul className="space-y-2 text-sm text-amber-700">
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            Fix login authentication (password reset issue)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            Re-enable Row Level Security after login is fixed
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            Upload train master data and station routes
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold">4</span>
            Upload staff deployment PDFs for running trains
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold">5</span>
            UI/Design polish (planned for final phase)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold">6</span>
            Deploy to Vercel with new build
          </li>
        </ul>
      </div>
    </div>
  )
}
