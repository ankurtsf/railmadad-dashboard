import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Download, Eye, ChevronLeft, ChevronRight, Filter, X, Train } from 'lucide-react'
import { LoadingSpinner, StatusBadge, ModeBadge, Badge, Modal, Button, Select, Input } from '../../components/ui/index'
import * as XLSX from 'xlsx'

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100]

export default function ViewComplaints({ userRole }) {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    status: 'All', type: 'All', depot: 'All',
    zone: 'All', division: 'All', mode: 'All',
    rating: 'All', sla: 'All', dateFrom: '', dateTo: ''
  })
  const [page, setPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [exportFields, setExportFields] = useState(null)
  const [showExportModal, setShowExportModal] = useState(false)

  // Passenger coach number state
  const [coachEdits, setCoachEdits] = useState({}) // { complaintId: { letter: 'A', number: '1' } }
  const [savingCoach, setSavingCoach] = useState({}) // { complaintId: true/false }

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  const NUMBERS = Array.from({ length: 20 }, (_, i) => String(i + 1))

  const getCoachEdit = (c) => {
    if (coachEdits[c.id]) return coachEdits[c.id]
    // Parse existing passenger_coach_no
    const existing = c.passenger_coach_no || ''
    const match = existing.match(/^([A-Z]+)(\d+)$/)
    return {
      letter: match ? match[1] : '',
      number: match ? match[2] : ''
    }
  }

  const handleSaveCoach = async (complaintId) => {
    const edit = coachEdits[complaintId]
    if (!edit || !edit.letter || !edit.number) return
    const coachNo = `${edit.letter}${edit.number}`
    setSavingCoach(p => ({ ...p, [complaintId]: true }))
    try {
      const { error } = await supabase
        .from('complaints')
        .update({ passenger_coach_no: coachNo })
        .eq('id', complaintId)
      if (!error) {
        setComplaints(prev => prev.map(c => c.id === complaintId ? { ...c, passenger_coach_no: coachNo } : c))
        setCoachEdits(p => { const n = { ...p }; delete n[complaintId]; return n })
      }
    } catch (err) { console.error(err) }
    finally { setSavingCoach(p => ({ ...p, [complaintId]: false })) }
  }

  useEffect(() => { fetchComplaints() }, [])

  const fetchComplaints = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('created_on', { ascending: false })
      if (!error) setComplaints(data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // Filter options from data
  const options = useMemo(() => ({
    statuses: ['All', ...new Set(complaints.map(c => c.status).filter(Boolean))],
    types: ['All', ...new Set(complaints.map(c => c.comp_type_name).filter(Boolean))],
    depots: ['All', ...new Set(complaints.map(c => c.primary_depot).filter(Boolean))],
    zones: ['All', ...new Set(complaints.map(c => c.zone_code).filter(Boolean))],
    divisions: ['All', ...new Set(complaints.map(c => c.div_code).filter(Boolean))],
    modes: ['All', 'T', 'H', 'A', 'R', 'S'],
    ratings: ['All', ...new Set(complaints.map(c => c.rating).filter(Boolean))],
    slas: ['All', ...new Set(complaints.map(c => c.sla).filter(Boolean))],
  }), [complaints])

  // Filtered data
  const filtered = useMemo(() => {
    return complaints.filter(c => {
      const s = search.toLowerCase()
      if (s && !String(c.complaint_ref_no).toLowerCase().includes(s) &&
        !String(c.train_no).toLowerCase().includes(s) &&
        !String(c.comp_type_name).toLowerCase().includes(s) &&
        !String(c.next_station).toLowerCase().includes(s) &&
        !String(c.train_name).toLowerCase().includes(s)) return false
      if (filters.status !== 'All' && c.status !== filters.status) return false
      if (filters.type !== 'All' && c.comp_type_name !== filters.type) return false
      if (filters.depot !== 'All' && c.primary_depot !== filters.depot) return false
      if (filters.zone !== 'All' && c.zone_code !== filters.zone) return false
      if (filters.division !== 'All' && c.div_code !== filters.division) return false
      if (filters.mode !== 'All' && c.complaint_mode !== filters.mode) return false
      if (filters.rating !== 'All' && c.rating !== filters.rating) return false
      if (filters.sla !== 'All' && c.sla !== filters.sla) return false
      if (filters.dateFrom && c.created_on && new Date(c.created_on) < new Date(filters.dateFrom)) return false
      if (filters.dateTo && c.created_on && new Date(c.created_on) > new Date(filters.dateTo)) return false
      return true
    })
  }, [complaints, search, filters])

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  const updateFilter = (key, value) => {
    setFilters(p => ({ ...p, [key]: value }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({ status: 'All', type: 'All', depot: 'All', zone: 'All', division: 'All', mode: 'All', rating: 'All', sla: 'All', dateFrom: '', dateTo: '' })
    setSearch('')
    setPage(1)
  }

  // All available export fields
  const allExportFields = [
    { key: 'complaint_ref_no', label: 'Ref No' },
    { key: 'created_on', label: 'Created On' },
    { key: 'status', label: 'Status' },
    { key: 'complaint_mode', label: 'Mode' },
    { key: 'train_no', label: 'Train No' },
    { key: 'train_name', label: 'Train Name' },
    { key: 'primary_depot', label: 'Depot' },
    { key: 'comp_type_name', label: 'Complaint Type' },
    { key: 'sub_type_name', label: 'Sub Type' },
    { key: 'coach_type', label: 'Coach Type' },
    { key: 'physical_coach_no', label: 'Physical Coach No' },
    { key: 'zone_code', label: 'Zone' },
    { key: 'div_code', label: 'Division' },
    { key: 'own_zone_code', label: 'Own Zone' },
    { key: 'next_station', label: 'Next Station' },
    { key: 'rating', label: 'Rating' },
    { key: 'sla', label: 'SLA' },
    { key: 'diff', label: 'Resolution Time' },
    { key: 'forwarded', label: 'Forwarded' },
    { key: 'complaint_desc', label: 'Description' },
    { key: 'remarks', label: 'Remarks' },
    { key: 'feedback_remark', label: 'Feedback' },
    { key: 'coach_owning_railway', label: 'Coach Owning Railway' },
    { key: 'prev_watering_station', label: 'Prev Watering Station' },
    { key: 'next_watering_station', label: 'Next Watering Station' },
  ]

  const [selectedExportFields, setSelectedExportFields] = useState(
    allExportFields.map(f => f.key)
  )

  const handleExport = () => {
    const fields = allExportFields.filter(f => selectedExportFields.includes(f.key))
    const data = filtered.map(c => {
      const row = {}
      fields.forEach(f => { row[f.label] = c[f.key] || '' })
      return row
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Complaints')
    XLSX.writeFile(wb, `complaints_${new Date().toISOString().split('T')[0]}.xlsx`)
    setShowExportModal(false)
  }

  const formatDate = (d) => {
    if (!d) return '-'
    return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const modeLabel = { T: 'Train', H: 'Helpline', A: 'App', R: 'Railmadad', S: 'Social' }

  if (loading) return <LoadingSpinner text="Loading complaints..." />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-blue-700 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">View Complaints</h1>
            <p className="text-blue-200 text-sm mt-0.5">View, manage and track all registered complaints</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-lg px-4 py-2 text-center">
              <p className="text-2xl font-bold">{filtered.length}</p>
              <p className="text-blue-200 text-xs">Total</p>
            </div>
            <div className="bg-white/10 rounded-lg px-4 py-2 text-center">
              <p className="text-2xl font-bold">{filtered.filter(c => c.status !== 'Closed').length}</p>
              <p className="text-blue-200 text-xs">Open</p>
            </div>
            <Button icon={Download} variant="secondary" onClick={() => setShowExportModal(true)}>
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ref no, train, type, station..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button
            icon={Filter}
            variant={showFilters ? 'primary' : 'secondary'}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
          <Button variant="ghost" onClick={clearFilters} icon={X}>Clear</Button>
          <Select
            value={itemsPerPage}
            onChange={e => { setItemsPerPage(Number(e.target.value)); setPage(1) }}
            options={ITEMS_PER_PAGE_OPTIONS.map(n => ({ value: n, label: `${n} per page` }))}
          />
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-3 border-t border-gray-100">
            <Select label="Status" value={filters.status} onChange={e => updateFilter('status', e.target.value)} options={options.statuses.map(s => ({ value: s, label: s }))} />
            <Select label="Type" value={filters.type} onChange={e => updateFilter('type', e.target.value)} options={options.types.map(s => ({ value: s, label: s }))} />
            <Select label="Depot" value={filters.depot} onChange={e => updateFilter('depot', e.target.value)} options={options.depots.map(s => ({ value: s, label: s }))} />
            <Select label="Zone" value={filters.zone} onChange={e => updateFilter('zone', e.target.value)} options={options.zones.map(s => ({ value: s, label: s }))} />
            <Select label="Division" value={filters.division} onChange={e => updateFilter('division', e.target.value)} options={options.divisions.map(s => ({ value: s, label: s }))} />
            <Select label="Mode" value={filters.mode} onChange={e => updateFilter('mode', e.target.value)} options={options.modes.map(s => ({ value: s, label: s === 'All' ? 'All Modes' : modeLabel[s] || s }))} />
            <Select label="Rating" value={filters.rating} onChange={e => updateFilter('rating', e.target.value)} options={options.ratings.map(s => ({ value: s, label: s }))} />
            <Select label="SLA" value={filters.sla} onChange={e => updateFilter('sla', e.target.value)} options={options.slas.map(s => ({ value: s, label: s }))} />
            <Input label="From Date" type="date" value={filters.dateFrom} onChange={e => updateFilter('dateFrom', e.target.value)} />
            <Input label="To Date" type="date" value={filters.dateTo} onChange={e => updateFilter('dateTo', e.target.value)} />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {['Sr.', 'Ref No', 'Created On', 'Status', 'Mode', 'Train', 'Coach', 'Complaint Type', 'Sub Type', 'Zone', 'Div', 'Next Station', 'Journey Start Date', 'Passenger Coach', 'Rating', 'SLA', 'Res. Time', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={18} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No complaints found matching your filters
                  </td>
                </tr>
              ) : paginated.map((c, i) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 text-xs text-gray-400">{(page - 1) * itemsPerPage + i + 1}</td>
                  <td className="px-3 py-3 text-xs font-mono text-blue-600 whitespace-nowrap">{c.complaint_ref_no}</td>
                  <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(c.created_on)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.status === 'Closed' ? 'bg-green-100 text-green-700' :
                      c.status === 'Open' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.complaint_mode === 'T' ? 'bg-blue-100 text-blue-700' :
                      c.complaint_mode === 'H' ? 'bg-green-100 text-green-700' :
                      c.complaint_mode === 'A' ? 'bg-purple-100 text-purple-700' :
                      c.complaint_mode === 'R' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-teal-100 text-teal-700'
                    }`}>
                      {modeLabel[c.complaint_mode] || c.complaint_mode || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs font-bold text-gray-800 whitespace-nowrap">
                    <div>{c.train_no}</div>
                    <div className="text-gray-400 font-normal text-[10px]">{c.primary_depot}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600">
                    <div>{c.coach_type || '-'}</div>
                    <div className="text-gray-400 text-[10px]">{c.physical_coach_no || ''}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-700 whitespace-nowrap">{c.comp_type_name || '-'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{c.sub_type_name || '-'}</td>
                  <td className="px-3 py-3 text-xs text-gray-600">{c.zone_code || '-'}</td>
                  <td className="px-3 py-3 text-xs text-gray-600">{c.div_code || '-'}</td>
                  <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{c.next_station || '-'}</td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap">
                    {c.suggested_journey_start_date ? (
                      <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {new Date(c.suggested_journey_start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  {/* Passenger Coach Number */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {(() => {
                      const edit = getCoachEdit(c)
                      const hasChange = coachEdits[c.id] !== undefined
                      return (
                        <div className="flex items-center gap-1">
                          <select
                            value={edit.letter}
                            onChange={e => setCoachEdits(p => ({ ...p, [c.id]: { ...getCoachEdit(c), letter: e.target.value } }))}
                            className="border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-12"
                          >
                            <option value="">-</option>
                            {LETTERS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                          <select
                            value={edit.number}
                            onChange={e => setCoachEdits(p => ({ ...p, [c.id]: { ...getCoachEdit(c), number: e.target.value } }))}
                            className="border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-12"
                          >
                            <option value="">-</option>
                            {NUMBERS.map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          {hasChange && (
                            <button
                              onClick={() => handleSaveCoach(c.id)}
                              disabled={savingCoach[c.id]}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-0.5 rounded font-medium disabled:opacity-50"
                            >
                              {savingCoach[c.id] ? '...' : 'Save'}
                            </button>
                          )}
                          {!hasChange && c.passenger_coach_no && (
                            <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded font-bold">{c.passenger_coach_no}</span>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-3 py-3">
                    {c.rating && c.rating !== 'Not Rated' && c.rating !== '' ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.rating === 'Excellent' ? 'bg-green-100 text-green-700' :
                        c.rating === 'Satisfactory' ? 'bg-blue-100 text-blue-700' :
                        c.rating === 'Unsatisfactory' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{c.rating}</span>
                    ) : <span className="text-gray-300 text-xs">-</span>}
                  </td>
                  <td className="px-3 py-3">
                    {c.sla && c.sla !== 'No' ? (
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-medium">{c.sla}</span>
                    ) : <span className="text-gray-300 text-xs">-</span>}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{c.diff || '-'}</td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => setSelectedComplaint(c)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {Math.min((page - 1) * itemsPerPage + 1, filtered.length)}–{Math.min(page * itemsPerPage, filtered.length)} of {filtered.length} complaints
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) pageNum = i + 1
                else if (page <= 3) pageNum = i + 1
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
                else pageNum = page - 2 + i
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Complaint Detail Modal */}
      <Modal isOpen={!!selectedComplaint} onClose={() => setSelectedComplaint(null)} title={`Complaint ${selectedComplaint?.complaint_ref_no}`} size="lg">
        {selectedComplaint && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Ref No', selectedComplaint.complaint_ref_no],
                ['Created On', formatDate(selectedComplaint.created_on)],
                ['Status', selectedComplaint.status],
                ['Mode', modeLabel[selectedComplaint.complaint_mode] || selectedComplaint.complaint_mode],
                ['Train No', selectedComplaint.train_no],
                ['Train Name', selectedComplaint.train_name],
                ['Depot', selectedComplaint.primary_depot],
                ['Coach Type', selectedComplaint.coach_type],
                ['Physical Coach', selectedComplaint.physical_coach_no || 'Not entered'],
                ['Complaint Type', selectedComplaint.comp_type_name],
                ['Sub Type', selectedComplaint.sub_type_name],
                ['Zone', selectedComplaint.zone_code],
                ['Division', selectedComplaint.div_code],
                ['Own Zone', selectedComplaint.own_zone_code],
                ['Next Station', selectedComplaint.next_station],
                ['Rating', selectedComplaint.rating],
                ['SLA', selectedComplaint.sla],
                ['Resolution Time', selectedComplaint.diff],
                ['Forwarded', selectedComplaint.forwarded],
                ['Coach Owning Railway', selectedComplaint.coach_owning_railway],
                ['Prev Watering Station', selectedComplaint.prev_watering_station],
                ['Next Watering Station', selectedComplaint.next_watering_station],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-gray-800">{value || '-'}</p>
                </div>
              ))}
            </div>
            {selectedComplaint.complaint_desc && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Complaint Description</p>
                <p className="text-sm text-gray-700">{selectedComplaint.complaint_desc}</p>
              </div>
            )}
            {selectedComplaint.remarks && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-500 mb-1">Resolution Remarks</p>
                <p className="text-sm text-gray-700">{selectedComplaint.remarks}</p>
              </div>
            )}
            {selectedComplaint.feedback_remark && (
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-500 mb-1">Passenger Feedback</p>
                <p className="text-sm text-gray-700">{selectedComplaint.feedback_remark}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Export Modal */}
      <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title="Export Complaints" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Select fields to include in the export:</p>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {allExportFields.map(f => (
              <label key={f.key} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedExportFields.includes(f.key)}
                  onChange={e => {
                    if (e.target.checked) setSelectedExportFields(p => [...p, f.key])
                    else setSelectedExportFields(p => p.filter(k => k !== f.key))
                  }}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">{f.label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{filtered.length} records will be exported</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowExportModal(false)}>Cancel</Button>
              <Button variant="primary" icon={Download} onClick={handleExport}>Download Excel</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
