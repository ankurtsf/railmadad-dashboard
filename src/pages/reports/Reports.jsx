import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Download, FileSpreadsheet, Filter, CheckSquare, Square, RefreshCw } from 'lucide-react'
import { LoadingSpinner, Button, Input, Select, Card, Toast } from '../../components/ui/index'
import * as XLSX from 'xlsx'

const REPORT_TYPES = [
  { id: 'complaints', label: 'Complaints Report', icon: '📋', description: 'All complaint records with filters' },
  { id: 'staff', label: 'Staff Deployment Report', icon: '👥', description: 'Staff deployment history' },
  { id: 'trainwise', label: 'Train-wise Report', icon: '🚆', description: 'Complaint summary per train' },
  { id: 'zonewise', label: 'Zone-wise Report', icon: '🗺️', description: 'Complaint summary per zone' },
  { id: 'categorywise', label: 'Category-wise Report', icon: '📊', description: 'Complaint summary per category' },
  { id: 'staffperformance', label: 'Staff Performance Report', icon: '⭐', description: 'Staff-wise complaint analysis' },
  { id: 'monthly', label: 'Monthly Analysis Report', icon: '📅', description: 'Month-on-month complaint trend' },
  { id: 'sla', label: 'SLA Compliance Report', icon: '⏱️', description: 'SLA breach and compliance analysis' },
]

const COMPLAINT_FIELDS = [
  { key: 'complaint_ref_no', label: 'Ref No', default: true },
  { key: 'created_on', label: 'Created On', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'complaint_mode', label: 'Mode', default: true },
  { key: 'train_no', label: 'Train No', default: true },
  { key: 'train_name', label: 'Train Name', default: false },
  { key: 'primary_depot', label: 'Depot', default: true },
  { key: 'comp_type_name', label: 'Complaint Type', default: true },
  { key: 'sub_type_name', label: 'Sub Type', default: true },
  { key: 'coach_type', label: 'Coach Type', default: false },
  { key: 'physical_coach_no', label: 'Physical Coach No', default: false },
  { key: 'zone_code', label: 'Zone', default: true },
  { key: 'div_code', label: 'Division', default: true },
  { key: 'own_zone_code', label: 'Own Zone', default: false },
  { key: 'own_div_code', label: 'Own Division', default: false },
  { key: 'next_station', label: 'Next Station', default: true },
  { key: 'rating', label: 'Rating', default: true },
  { key: 'sla', label: 'SLA', default: true },
  { key: 'diff', label: 'Resolution Time', default: true },
  { key: 'forwarded', label: 'Forwarded', default: false },
  { key: 'complaint_desc', label: 'Description', default: false },
  { key: 'remarks', label: 'Remarks', default: false },
  { key: 'feedback_remark', label: 'Feedback', default: false },
  { key: 'coach_owning_railway', label: 'Coach Owning Railway', default: false },
  { key: 'prev_watering_station', label: 'Prev Watering Station', default: false },
  { key: 'next_watering_station', label: 'Next Watering Station', default: false },
  { key: 'user_mobile', label: 'Staff Mobile', default: false },
]

const STAFF_FIELDS = [
  { key: 'train_no', label: 'Train No', default: true },
  { key: 'deployment_date', label: 'Date', default: true },
  { key: 'staff_name', label: 'Staff Name', default: true },
  { key: 'staff_type', label: 'Staff Type', default: true },
  { key: 'mobile', label: 'Mobile', default: true },
  { key: 'prs_coach_no', label: 'Coach No', default: true },
  { key: 'contract', label: 'Contract', default: false },
  { key: 'poi_number', label: 'POI Number', default: false },
  { key: 'zone_division_depot', label: 'Zone/Div/Depot', default: false },
  { key: 'is_supervisor', label: 'Is Supervisor', default: false },
  { key: 'is_blacklisted', label: 'Blacklisted', default: false },
  { key: 'source', label: 'Source', default: false },
]

const MODE_LABELS = { T: 'Train', H: 'Helpline', A: 'App', R: 'Railmadad App', S: 'Social Media' }

export default function Reports() {
  const [complaints, setComplaints] = useState([])
  const [staffDeployments, setStaffDeployments] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedReport, setSelectedReport] = useState('complaints')
  const [selectedFields, setSelectedFields] = useState(COMPLAINT_FIELDS.filter(f => f.default).map(f => f.key))
  const [filters, setFilters] = useState({
    dateFrom: '', dateTo: '', zone: 'All', division: 'All',
    depot: 'All', category: 'All', status: 'All', train: 'All'
  })
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [preview, setPreview] = useState([])

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [{ data: comp }, { data: staff }] = await Promise.all([
        supabase.from('complaints').select('*').order('created_on', { ascending: false }),
        supabase.from('staff_deployments').select('*').order('deployment_date', { ascending: false })
      ])
      setComplaints(comp || [])
      setStaffDeployments(staff || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 5000)
  }

  // Filter options
  const zones = ['All', ...new Set(complaints.map(c => c.zone_code).filter(Boolean))]
  const divisions = ['All', ...new Set(complaints.map(c => c.div_code).filter(Boolean))]
  const depots = ['All', ...new Set(complaints.map(c => c.primary_depot).filter(Boolean))]
  const categories = ['All', ...new Set(complaints.map(c => c.comp_type_name).filter(Boolean))]
  const trains = ['All', ...new Set(complaints.map(c => c.train_no).filter(Boolean))]

  // Apply complaint filters
  const filteredComplaints = useMemo(() => {
    return complaints.filter(c => {
      if (filters.dateFrom && c.created_on && new Date(c.created_on) < new Date(filters.dateFrom)) return false
      if (filters.dateTo && c.created_on && new Date(c.created_on) > new Date(filters.dateTo)) return false
      if (filters.zone !== 'All' && c.zone_code !== filters.zone) return false
      if (filters.division !== 'All' && c.div_code !== filters.division) return false
      if (filters.depot !== 'All' && c.primary_depot !== filters.depot) return false
      if (filters.category !== 'All' && c.comp_type_name !== filters.category) return false
      if (filters.status !== 'All' && c.status !== filters.status) return false
      if (filters.train !== 'All' && c.train_no !== filters.train) return false
      return true
    })
  }, [complaints, filters])

  // Get current fields based on report type
  const currentFields = selectedReport === 'staff' ? STAFF_FIELDS : COMPLAINT_FIELDS

  // Update selected fields when report type changes
  const handleReportTypeChange = (type) => {
    setSelectedReport(type)
    const fields = type === 'staff' ? STAFF_FIELDS : COMPLAINT_FIELDS
    setSelectedFields(fields.filter(f => f.default).map(f => f.key))
    setPreview([])
  }

  const toggleField = (key) => {
    setSelectedFields(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const selectAll = () => setSelectedFields(currentFields.map(f => f.key))
  const selectDefault = () => setSelectedFields(currentFields.filter(f => f.default).map(f => f.key))
  const clearAll = () => setSelectedFields([])

  // Generate report data based on type
  const generateReportData = () => {
    const fields = currentFields.filter(f => selectedFields.includes(f.key))

    switch (selectedReport) {
      case 'complaints':
        return filteredComplaints.map(c => {
          const row = {}
          fields.forEach(f => {
            let val = c[f.key]
            if (f.key === 'complaint_mode') val = MODE_LABELS[val] || val
            if (f.key === 'created_on' && val) val = new Date(val).toLocaleString('en-IN')
            row[f.label] = val || ''
          })
          return row
        })

      case 'staff':
        return staffDeployments.map(d => {
          const row = {}
          fields.forEach(f => {
            let val = d[f.key]
            if (typeof val === 'boolean') val = val ? 'Yes' : 'No'
            row[f.label] = val || ''
          })
          return row
        })

      case 'trainwise': {
        const map = {}
        filteredComplaints.forEach(c => {
          const train = c.train_no || 'Unknown'
          if (!map[train]) map[train] = { Train: train, Total: 0, Resolved: 0, Open: 0, 'Avg Resolution (hrs)': 0, resTimes: [] }
          map[train].Total++
          if (c.status === 'Closed') map[train].Resolved++
          else map[train].Open++
          if (c.diff) {
            const match = String(c.diff).match(/(\d+):(\d+)/)
            if (match) map[train].resTimes.push(parseInt(match[1]) + parseInt(match[2]) / 60)
          }
        })
        return Object.values(map).map(t => ({
          ...t,
          'Avg Resolution (hrs)': t.resTimes.length > 0 ? (t.resTimes.reduce((a, b) => a + b, 0) / t.resTimes.length).toFixed(1) : 'N/A',
          'Resolution Rate': t.Total > 0 ? `${Math.round(t.Resolved / t.Total * 100)}%` : '0%',
          resTimes: undefined
        })).sort((a, b) => b.Total - a.Total)
      }

      case 'zonewise': {
        const map = {}
        filteredComplaints.forEach(c => {
          const zone = c.zone_code || 'Unknown'
          if (!map[zone]) map[zone] = { Zone: zone, Total: 0, Resolved: 0, Open: 0 }
          map[zone].Total++
          if (c.status === 'Closed') map[zone].Resolved++
          else map[zone].Open++
        })
        return Object.values(map).map(z => ({
          ...z,
          'Resolution Rate': z.Total > 0 ? `${Math.round(z.Resolved / z.Total * 100)}%` : '0%'
        })).sort((a, b) => b.Total - a.Total)
      }

      case 'categorywise': {
        const map = {}
        filteredComplaints.forEach(c => {
          const cat = c.comp_type_name || 'Unknown'
          const sub = c.sub_type_name || 'Others'
          const key = `${cat}|||${sub}`
          if (!map[key]) map[key] = { Category: cat, 'Sub Type': sub, Total: 0, Resolved: 0, Open: 0 }
          map[key].Total++
          if (c.status === 'Closed') map[key].Resolved++
          else map[key].Open++
        })
        return Object.values(map).sort((a, b) => b.Total - a.Total)
      }

      case 'staffperformance': {
        const map = {}
        filteredComplaints.forEach(c => {
          if (c.remarks) {
            const ehkMatch = c.remarks.match(/EHK[-\s]+([A-Za-z\s]+)/i)
            const accaMatch = c.remarks.match(/ACCA[-\s]+([A-Za-z\s]+)/i)
            const staffName = (ehkMatch?.[1] || accaMatch?.[1] || '').trim()
            if (staffName && staffName.length > 2) {
              if (!map[staffName]) map[staffName] = { 'Staff Name': staffName, Total: 0, Resolved: 0, Unresolved: 0 }
              map[staffName].Total++
              if (c.status === 'Closed') map[staffName].Resolved++
              else map[staffName].Unresolved++
            }
          }
        })
        return Object.values(map).sort((a, b) => b.Total - a.Total)
      }

      case 'monthly': {
        const map = {}
        filteredComplaints.forEach(c => {
          if (!c.created_on) return
          const month = new Date(c.created_on).toISOString().substring(0, 7)
          if (!map[month]) map[month] = { Month: month, Total: 0, Resolved: 0, Open: 0 }
          map[month].Total++
          if (c.status === 'Closed') map[month].Resolved++
          else map[month].Open++
        })
        return Object.values(map).sort((a, b) => a.Month.localeCompare(b.Month)).map(m => ({
          ...m,
          'Resolution Rate': m.Total > 0 ? `${Math.round(m.Resolved / m.Total * 100)}%` : '0%'
        }))
      }

      case 'sla': {
        const slaGroups = {}
        filteredComplaints.forEach(c => {
          const sla = c.sla || 'No SLA'
          if (!slaGroups[sla]) slaGroups[sla] = { 'SLA Type': sla, Total: 0, Resolved: 0, Breached: 0 }
          slaGroups[sla].Total++
          if (c.status === 'Closed') slaGroups[sla].Resolved++
          else slaGroups[sla].Breached++
        })
        return Object.values(slaGroups).map(s => ({
          ...s,
          'Compliance Rate': s.Total > 0 ? `${Math.round(s.Resolved / s.Total * 100)}%` : '0%'
        }))
      }

      default:
        return []
    }
  }

  const handlePreview = () => {
    setGenerating(true)
    try {
      const data = generateReportData()
      setPreview(data.slice(0, 10))
      showToast(`Preview generated — ${data.length} records`, 'success')
    } catch (err) {
      showToast(`Error generating preview: ${err.message}`, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = () => {
    setGenerating(true)
    try {
      const data = generateReportData()
      if (data.length === 0) { showToast('No data to export', 'error'); return }

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Report')
      const filename = `${selectedReport}_report_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, filename)
      showToast(`✅ Exported ${data.length} records to ${filename}`, 'success')
    } catch (err) {
      showToast(`Export failed: ${err.message}`, 'error')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <LoadingSpinner text="Loading reports..." />

  return (
    <div className="space-y-5">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {/* Header */}
      <div className="bg-indigo-700 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Reports</h1>
            <p className="text-indigo-200 text-sm mt-0.5">Generate and download customized reports</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
              <p className="text-xl font-bold">{filteredComplaints.length}</p>
              <p className="text-indigo-200 text-xs">Records</p>
            </div>
            <Button icon={RefreshCw} variant="secondary" onClick={fetchData}>Refresh</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left Panel — Report Type & Fields */}
        <div className="lg:col-span-1 space-y-4">
          {/* Report Type Selection */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-800 text-sm">Report Type</h3>
            </div>
            <div className="p-2">
              {REPORT_TYPES.map(report => (
                <button
                  key={report.id}
                  onClick={() => handleReportTypeChange(report.id)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors mb-1 ${
                    selectedReport === report.id ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">{report.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{report.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{report.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Field Selection (only for complaints and staff reports) */}
          {(selectedReport === 'complaints' || selectedReport === 'staff') && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 text-sm">Select Fields</h3>
                <div className="flex gap-1">
                  <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-800">All</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={selectDefault} className="text-xs text-blue-600 hover:text-blue-800">Default</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700">None</button>
                </div>
              </div>
              <div className="p-3 max-h-80 overflow-y-auto">
                {currentFields.map(field => (
                  <label key={field.key} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded px-1">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.key)}
                      onChange={() => toggleField(field.key)}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-sm text-gray-700">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel — Filters & Preview */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-800 text-sm">Filters & Search</h3>
              </div>
              <button onClick={() => setFilters({ dateFrom: '', dateTo: '', zone: 'All', division: 'All', depot: 'All', category: 'All', status: 'All', train: 'All' })} className="text-xs text-blue-600">Clear All</button>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input label="From Date" type="date" value={filters.dateFrom} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))} />
              <Input label="To Date" type="date" value={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))} />
              <Select label="Zone" value={filters.zone} onChange={e => setFilters(p => ({ ...p, zone: e.target.value }))} options={zones.map(z => ({ value: z, label: z }))} />
              <Select label="Division" value={filters.division} onChange={e => setFilters(p => ({ ...p, division: e.target.value }))} options={divisions.map(d => ({ value: d, label: d }))} />
              <Select label="Depot" value={filters.depot} onChange={e => setFilters(p => ({ ...p, depot: e.target.value }))} options={depots.map(d => ({ value: d, label: d }))} />
              <Select label="Category" value={filters.category} onChange={e => setFilters(p => ({ ...p, category: e.target.value }))} options={categories.map(c => ({ value: c, label: c }))} />
              <Select label="Status" value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} options={['All', 'Closed', 'Open', 'Registered'].map(s => ({ value: s, label: s }))} />
              <Select label="Train" value={filters.train} onChange={e => setFilters(p => ({ ...p, train: e.target.value }))} options={trains.map(t => ({ value: t, label: t }))} />
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {REPORT_TYPES.find(r => r.id === selectedReport)?.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {filteredComplaints.length} records match current filters
                {selectedReport === 'complaints' || selectedReport === 'staff' ? ` • ${selectedFields.length} fields selected` : ''}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" icon={FileSpreadsheet} onClick={handlePreview} disabled={generating}>
                Preview (10 rows)
              </Button>
              <Button variant="primary" icon={Download} onClick={handleExport} disabled={generating}>
                {generating ? 'Generating...' : 'Download Excel'}
              </Button>
            </div>
          </div>

          {/* Preview Table */}
          {preview.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 text-sm">Preview (First 10 rows)</h3>
                <span className="text-xs text-gray-500">Full data will be in downloaded file</span>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {Object.keys(preview[0]).filter(k => k !== 'resTimes').map(key => (
                        <th key={key} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 whitespace-nowrap">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {Object.entries(row).filter(([k]) => k !== 'resTimes').map(([key, val]) => (
                          <td key={key} className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                            {String(val || '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quick Reports */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-800 text-sm">Quick Reports</h3>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Today's Complaints", filter: () => { const t = new Date().toISOString().split('T')[0]; setFilters(p => ({ ...p, dateFrom: t, dateTo: t })); setSelectedReport('complaints') } },
                { label: 'This Month', filter: () => { const now = new Date(); const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; setFilters(p => ({ ...p, dateFrom: from, dateTo: new Date().toISOString().split('T')[0] })); setSelectedReport('monthly') } },
                { label: 'Open Complaints', filter: () => { setFilters(p => ({ ...p, status: 'Open', dateFrom: '', dateTo: '' })); setSelectedReport('complaints') } },
                { label: 'SLA Breaches', filter: () => { setFilters(p => ({ ...p, dateFrom: '', dateTo: '' })); setSelectedReport('sla') } },
              ].map((qr, i) => (
                <button
                  key={i}
                  onClick={() => { qr.filter(); setPreview([]) }}
                  className="p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg text-left transition-colors"
                >
                  <p className="text-sm font-medium text-indigo-700">{qr.label}</p>
                  <p className="text-xs text-indigo-400 mt-0.5">Click to configure →</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
