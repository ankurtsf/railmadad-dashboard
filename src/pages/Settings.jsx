import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Edit, Upload, Download, CheckCircle, X, Save } from 'lucide-react'
import { LoadingSpinner, Button, Input, Select, Toast, TabBar } from '../components/ui/index'
import * as XLSX from 'xlsx'

const COMPLAINT_TYPES = [
  'Bed Roll', 'Coach - Cleanliness', 'Coach - Maintenance',
  'Water Availability', 'Security', 'Staff Behaviour', 'Electrical Equipment'
]

const SUB_TYPES = {
  'Bed Roll': ['Non Availability', 'Dirty / Torn', 'Overcharging', 'Others'],
  'Coach - Cleanliness': ['Toilet', 'Coach Interior', 'Cockroach / Rodents', 'Washbasin', 'Others'],
  'Coach - Maintenance': [
    'Window/Door locking problem', 'Tap leaking/Tap not working',
    'Seat Broken/Torn', 'Flush defective', 'Corridor gate defective',
    'Curtain Missing', 'Sliding door defective', 'Soap dispenser broken',
    'Air Lock', 'Jerks/Abnormal Sound', 'Lavatory door broken',
    'Ceiling Leakage', 'Water filling adopter broken',
    'Washbasin drain pipe leakage', 'Watering done/Maintenance issue',
    'Watering done head changed by Running division', 'Others'
  ],
  'Water Availability': ['Toilet', 'Washbasin', 'Others'],
  'Security': ['Others'],
  'Staff Behaviour': ['Others'],
  'Electrical Equipment': ['Others'],
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('rootcause')
  const [rootCauses, setRootCauses] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterSubType, setFilterSubType] = useState('All')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({ category: '', sub_type: '', root_cause: '' })

  const tabs = [{ id: 'rootcause', label: 'Master List — Root Cause' }]

  useEffect(() => { fetchRootCauses() }, [])

  const fetchRootCauses = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('root_causes').select('*').order('category')
      if (!error) setRootCauses(data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 4000)
  }

  const filtered = rootCauses.filter(r => {
    if (filterCategory !== 'All' && r.category !== filterCategory) return false
    if (filterSubType !== 'All' && r.sub_type !== filterSubType) return false
    return true
  })

  const filterSubTypes = ['All', ...new Set(
    rootCauses.filter(r => filterCategory === 'All' || r.category === filterCategory).map(r => r.sub_type)
  )]

  const formSubTypes = form.category ? (SUB_TYPES[form.category] || []) : []

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.category || !form.sub_type || !form.root_cause.trim()) {
      showToast('Please fill all fields', 'error'); return
    }
    const exists = rootCauses.find(r =>
      r.category === form.category && r.sub_type === form.sub_type &&
      r.root_cause.toLowerCase() === form.root_cause.trim().toLowerCase()
    )
    if (exists) { showToast('This root cause already exists!', 'error'); return }
    try {
      const { error } = await supabase.from('root_causes').insert([{
        category: form.category, sub_type: form.sub_type,
        root_cause: form.root_cause.trim(), is_active: true
      }])
      if (!error) {
        showToast('✅ Root cause added!', 'success')
        setForm({ category: form.category, sub_type: form.sub_type, root_cause: '' })
        fetchRootCauses()
      } else showToast(`Error: ${error.message}`, 'error')
    } catch (err) { showToast(`Error: ${err.message}`, 'error') }
  }

  const handleDelete = async (id, rootCause) => {
    if (!confirm(`Delete root cause "${rootCause}"?`)) return
    const { error } = await supabase.from('root_causes').delete().eq('id', id)
    if (!error) { showToast('Deleted!', 'success'); fetchRootCauses() }
  }

  const handleToggleActive = async (id, current) => {
    const { error } = await supabase.from('root_causes').update({ is_active: !current }).eq('id', id)
    if (!error) fetchRootCauses()
  }

  const handleEdit = async (id) => {
    if (!editText.trim()) return
    const { error } = await supabase.from('root_causes').update({ root_cause: editText.trim() }).eq('id', id)
    if (!error) {
      showToast('✅ Updated!', 'success')
      setEditingId(null); setEditText(''); fetchRootCauses()
    }
  }

  const handleExport = () => {
    const data = rootCauses.map(r => ({
      Category: r.category, 'Sub Type': r.sub_type,
      'Root Cause': r.root_cause, Status: r.is_active ? 'Active' : 'Inactive'
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Root Causes')
    XLSX.writeFile(wb, `root_causes_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        const toInsert = []
        rows.forEach(row => {
          const category = String(row['Category'] || row['category'] || '').trim()
          const subType = String(row['Sub Type'] || row['sub_type'] || row['SubType'] || '').trim()
          const rootCause = String(row['Root Cause'] || row['root_cause'] || row['RootCause'] || '').trim()
          if (category && subType && rootCause) toInsert.push({ category, sub_type: subType, root_cause: rootCause, is_active: true })
        })
        if (toInsert.length === 0) { showToast('No valid data found in file', 'error'); return }
        const { error } = await supabase.from('root_causes').insert(toInsert)
        if (!error) { showToast(`✅ Imported ${toInsert.length} root causes!`, 'success'); fetchRootCauses() }
        else showToast(`Error: ${error.message}`, 'error')
      } catch (err) { showToast(`Error: ${err.message}`, 'error') }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = null
  }

  const downloadTemplate = () => {
    const data = [
      { Category: 'Water Availability', 'Sub Type': 'Toilet', 'Root Cause': 'Tank not filled at source station' },
      { Category: 'Water Availability', 'Sub Type': 'Toilet', 'Root Cause': 'Pipe leakage in coach' },
      { Category: 'Bed Roll', 'Sub Type': 'Non Availability', 'Root Cause': 'Stock not loaded at origin' },
      { Category: 'Coach - Cleanliness', 'Sub Type': 'Toilet', 'Root Cause': 'Not cleaned at origin station' },
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Root Causes')
    XLSX.writeFile(wb, 'root_causes_template.xlsx')
  }

  const grouped = {}
  filtered.forEach(r => {
    if (!grouped[r.category]) grouped[r.category] = {}
    if (!grouped[r.category][r.sub_type]) grouped[r.category][r.sub_type] = []
    grouped[r.category][r.sub_type].push(r)
  })

  if (loading) return <LoadingSpinner text="Loading settings..." />

  return (
    <div className="space-y-5">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {/* Header */}
      <div className="bg-gray-700 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-gray-300 text-sm mt-0.5">Manage master data and system configuration</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 pt-4">
          <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {activeTab === 'rootcause' && (
          <div className="p-5 space-y-5">

            {/* Stats + Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-center">
                  <p className="text-xl font-bold text-blue-600">{rootCauses.length}</p>
                  <p className="text-xs text-gray-500">Total Root Causes</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-2 text-center">
                  <p className="text-xl font-bold text-green-600">{rootCauses.filter(r => r.is_active).length}</p>
                  <p className="text-xs text-gray-500">Active</p>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-2 text-center">
                  <p className="text-xl font-bold text-purple-600">{new Set(rootCauses.map(r => r.category)).size}</p>
                  <p className="text-xs text-gray-500">Categories</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" icon={Download} size="sm" onClick={downloadTemplate}>Template</Button>
                <label className="cursor-pointer inline-flex items-center gap-1.5 font-medium border rounded-lg transition-colors px-3 py-1.5 text-xs bg-white hover:bg-gray-50 text-gray-700 border-gray-300">
                  <Upload className="w-4 h-4" />
                  Import Excel
                  <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImport} />
                </label>
                <Button variant="ghost" icon={Download} size="sm" onClick={handleExport}>Export</Button>
              </div>
            </div>

            {/* Add Form */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Add New Root Cause
              </h3>
              <form onSubmit={handleAdd} className="flex items-end gap-3 flex-wrap">
                <div className="flex-none w-48">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value, sub_type: '' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                  >
                    <option value="">Select Category</option>
                    {COMPLAINT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex-none w-48">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Sub Type *</label>
                  <select
                    value={form.sub_type}
                    onChange={e => setForm(p => ({ ...p, sub_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                    disabled={!form.category}
                  >
                    <option value="">Select Sub Type</option>
                    {formSubTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Root Cause *</label>
                  <input
                    type="text"
                    placeholder="Enter root cause description..."
                    value={form.root_cause}
                    onChange={e => setForm(p => ({ ...p, root_cause: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <Button variant="primary" type="submit" icon={Plus}>Add</Button>
              </form>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <select
                value={filterCategory}
                onChange={e => { setFilterCategory(e.target.value); setFilterSubType('All') }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="All">All Categories</option>
                {COMPLAINT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={filterSubType}
                onChange={e => setFilterSubType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {filterSubTypes.map(t => <option key={t} value={t}>{t === 'All' ? 'All Sub Types' : t}</option>)}
              </select>
              <span className="text-sm text-gray-500">{filtered.length} root causes found</span>
            </div>

            {/* Grouped Display */}
            {Object.keys(grouped).length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-gray-400 text-sm mb-1">No root causes found</p>
                <p className="text-gray-300 text-xs">Add your first root cause using the form above</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([category, subTypes]) => (
                  <div key={category} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
                        {category}
                      </h3>
                      <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                        {Object.values(subTypes).flat().length} root causes
                      </span>
                    </div>

                    {Object.entries(subTypes).map(([subType, causes]) => (
                      <div key={subType} className="border-b border-gray-100 last:border-0">
                        <div className="px-5 py-2 bg-blue-50/40 flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                            <span className="text-blue-400">→</span> {subType}
                          </h4>
                          <span className="text-xs text-blue-400">{causes.length} causes</span>
                        </div>
                        <div className="px-5 py-2 space-y-1">
                          {causes.map(rc => (
                            <div key={rc.id} className={`flex items-center gap-3 p-2 rounded-lg group transition-colors ${rc.is_active ? 'hover:bg-gray-50' : 'opacity-50'}`}>
                              {editingId === rc.id ? (
                                <>
                                  <input
                                    type="text"
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                    className="flex-1 border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleEdit(rc.id)
                                      if (e.key === 'Escape') setEditingId(null)
                                    }}
                                  />
                                  <button onClick={() => handleEdit(rc.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${rc.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                                  <span className="flex-1 text-sm text-gray-700">{rc.root_cause}</span>
                                  {!rc.is_active && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>}
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => { setEditingId(rc.id); setEditText(rc.root_cause) }}
                                      className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"
                                      title="Edit"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleToggleActive(rc.id, rc.is_active)}
                                      className={`p-1.5 rounded-lg ${rc.is_active ? 'text-amber-500 hover:bg-amber-50' : 'text-green-500 hover:bg-green-50'}`}
                                      title={rc.is_active ? 'Deactivate' : 'Activate'}
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(rc.id, rc.root_cause)}
                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Format info */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">📋 Excel Import Format:</p>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="px-3 py-1.5 border border-gray-300 text-left font-semibold">Category</th>
                      <th className="px-3 py-1.5 border border-gray-300 text-left font-semibold">Sub Type</th>
                      <th className="px-3 py-1.5 border border-gray-300 text-left font-semibold">Root Cause</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="px-3 py-1.5 border border-gray-300">Water Availability</td>
                      <td className="px-3 py-1.5 border border-gray-300">Toilet</td>
                      <td className="px-3 py-1.5 border border-gray-300">Tank not filled at source station</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-3 py-1.5 border border-gray-300">Bed Roll</td>
                      <td className="px-3 py-1.5 border border-gray-300">Non Availability</td>
                      <td className="px-3 py-1.5 border border-gray-300">Stock not loaded at origin</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button onClick={downloadTemplate} className="mt-2 text-xs text-blue-600 hover:underline">
                Download sample template →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
