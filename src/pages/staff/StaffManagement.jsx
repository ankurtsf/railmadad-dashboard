import React, { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Users, Upload, Plus, Search, Filter, X, Eye, Edit, Trash2,
  Phone, Building, Train, AlertTriangle, CheckCircle, Loader2,
  Download, BarChart2, ChevronDown, ChevronUp
} from 'lucide-react'
import {
  LoadingSpinner, Modal, Button, Input, Select, Card, Toast, Badge, TabBar
} from '../../components/ui/index'
import * as XLSX from 'xlsx'

const STAFF_TYPES = ['EHK', 'OBHS', 'ACCA', 'SSE', 'Electrical', 'Mechanical']

const STAFF_TYPE_COLORS = {
  'EHK': 'bg-blue-100 text-blue-700',
  'OBHS': 'bg-green-100 text-green-700',
  'ACCA': 'bg-purple-100 text-purple-700',
  'SSE': 'bg-amber-100 text-amber-700',
  'Electrical': 'bg-teal-100 text-teal-700',
  'Mechanical': 'bg-rose-100 text-rose-700',
}

export default function StaffManagement() {
  const [activeTab, setActiveTab] = useState('directory')
  const [deployments, setDeployments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterDate, setFilterDate] = useState('')
  const [filterTrain, setFilterTrain] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [showLogsModal, setShowLogsModal] = useState(false)
  const fileInputRef = useRef(null)

  // Form state
  const [form, setForm] = useState({
    train_no: '', deployment_date: new Date().toISOString().split('T')[0],
    staff_name: '', staff_type: 'EHK', mobile: '', contract: '',
    poi_number: '', prs_coach_no: '', zone_division_depot: '',
    is_supervisor: false, is_blacklisted: false, source: 'manual'
  })

  useEffect(() => { fetchDeployments() }, [])

  const fetchDeployments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('staff_deployments')
        .select('*')
        .order('deployment_date', { ascending: false })
      if (!error) setDeployments(data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 5000)
  }

  // Staff summary cards
  const summary = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const todayDeps = deployments.filter(d => d.deployment_date === today)
    const counts = {}
    STAFF_TYPES.forEach(t => {
      counts[t] = {
        total: deployments.filter(d => d.staff_type === t).length,
        today: todayDeps.filter(d => d.staff_type === t).length,
        trains: new Set(deployments.filter(d => d.staff_type === t).map(d => d.train_no)).size
      }
    })
    return counts
  }, [deployments])

  // Filtered deployments
  const filtered = useMemo(() => {
    return deployments.filter(d => {
      const s = search.toLowerCase()
      if (s && !String(d.staff_name).toLowerCase().includes(s) &&
        !String(d.train_no).toLowerCase().includes(s) &&
        !String(d.mobile).toLowerCase().includes(s)) return false
      if (filterType !== 'All' && d.staff_type !== filterType) return false
      if (filterDate && d.deployment_date !== filterDate) return false
      if (filterTrain && !String(d.train_no).includes(filterTrain)) return false
      return true
    })
  }, [deployments, search, filterType, filterDate, filterTrain])

  // Coverage gaps - trains with missing staff types
  const coverageGaps = useMemo(() => {
    const trainMap = {}
    deployments.forEach(d => {
      if (!trainMap[d.train_no]) trainMap[d.train_no] = { train: d.train_no, date: d.deployment_date, types: new Set() }
      trainMap[d.train_no].types.add(d.staff_type)
    })
    return Object.values(trainMap).map(t => ({
      ...t,
      missing: STAFF_TYPES.filter(s => !t.types.has(s))
    })).filter(t => t.missing.length > 0)
  }, [deployments])

  // Handle PDF upload with Tesseract OCR
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsUploading(true)
    setUploadResult(null)

    try {
      // Load Tesseract
      if (!window.Tesseract) {
        await new Promise((res, rej) => {
          const s = document.createElement('script')
          s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js'
          s.onload = res
          s.onerror = rej
          document.head.appendChild(s)
        })
      }

      // Load pdf2image via PDF.js
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
          s.onload = res
          s.onerror = rej
          document.head.appendChild(s)
        })
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }

      // Read PDF
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let fullText = ''

      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const scale = 3.0
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')

        // Enhance contrast
        await page.render({ canvasContext: ctx, viewport }).promise

        // Boost contrast for light grey text
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
          const enhanced = avg < 200 ? Math.max(0, avg - 60) : 255
          data[i] = data[i + 1] = data[i + 2] = enhanced
        }
        ctx.putImageData(imageData, 0, 0)

        // OCR
        const { data: { text } } = await window.Tesseract.recognize(canvas, 'eng', {
          logger: () => {}
        })
        fullText += '\n' + text
      }

      // Parse the OCR text
      const parsed = parseStaffPdfText(fullText, file.name)
      setUploadResult({ text: fullText.substring(0, 500), ...parsed })

      if (parsed.records.length > 0) {
        const { error } = await supabase.from('staff_deployments').insert(parsed.records)
        if (!error) {
          showToast(`✅ Added ${parsed.records.length} staff records for Train ${parsed.trainNo}`, 'success')
          fetchDeployments()
        } else {
          showToast(`Error saving: ${error.message}`, 'error')
        }
      } else {
        showToast('No staff records found in PDF', 'error')
      }

    } catch (err) {
      console.error(err)
      showToast(`Error processing PDF: ${err.message}`, 'error')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Parse OCR text from staff PDF
  const parseStaffPdfText = (text, filename) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const records = []

    // Extract train number from title
    const trainMatch = text.match(/Train Details\s+(\d{4,5})/i) ||
      text.match(/train no[.\s]+(\d{4,5})/i) ||
      filename.match(/(\d{4,5})/)
    const trainNo = trainMatch ? trainMatch[1] : 'Unknown'

    // Extract date
    const dateMatch = text.match(/Start Date\s+(\d{2}-\d{2}-\d{4})/i) ||
      text.match(/Date:\s+(\d{2}\/\d{2}\/\d{4})/i)
    let deployDate = new Date().toISOString().split('T')[0]
    if (dateMatch) {
      const parts = dateMatch[1].split(/[-\/]/)
      if (parts.length === 3) {
        deployDate = parts[2].length === 4
          ? `${parts[2]}-${parts[1]}-${parts[0]}`
          : `20${parts[2]}-${parts[1]}-${parts[0]}`
      }
    }

    // Parse EHK Supervisor
    const ehkSection = text.match(/EHK Supervisor[\s\S]*?(?=OBHS|Linen|Electrical|Mechanical|$)/i)?.[0] || ''
    const ehkLines = ehkSection.split('\n').filter(l => l.trim())
    ehkLines.forEach(line => {
      const mobileMatch = line.match(/\b\d{10}\b/)
      if (mobileMatch && !line.toLowerCase().includes('mobile') && !line.toLowerCase().includes('supervisor name')) {
        const nameParts = line.split(/\s{2,}|\t/)
        const name = nameParts[0]?.trim()
        if (name && name.length > 2 && /[a-zA-Z]/.test(name)) {
          records.push({
            train_no: trainNo, deployment_date: deployDate,
            staff_name: name, staff_type: 'EHK',
            mobile: mobileMatch[0], is_supervisor: true, source: 'pdf',
            contract: '', poi_number: '', prs_coach_no: null, zone_division_depot: ''
          })
        }
      }
    })

    // Parse OBHS Janitors
    const obhsSection = text.match(/OBHS[\s\S]*?(?=Electrical|Linen|Mechanical|$)/i)?.[0] || ''
    const janitorMatches = [...obhsSection.matchAll(/(\d+)\s+([A-Z][A-Z\s]+\d*)\s+(\d{10})/g)]
    janitorMatches.forEach(match => {
      records.push({
        train_no: trainNo, deployment_date: deployDate,
        staff_name: match[2].trim(), staff_type: 'OBHS',
        mobile: match[3], is_supervisor: false, source: 'pdf',
        contract: '', poi_number: '', prs_coach_no: null, zone_division_depot: ''
      })
    })

    // Parse Linen Staff (ACCA) with coach numbers
    const linenSection = text.match(/Linen Staff[\s\S]*?(?=Mechanical|Electrical Escorting|$)/i)?.[0] || ''
    const linenMatches = [...linenSection.matchAll(/(\d+)\s+(A\d+|B\d+|H\d+|M\d+|S\d+)\s+([A-Z][A-Z\s\/]+\d*)\s+(\d{10})/g)]
    linenMatches.forEach(match => {
      records.push({
        train_no: trainNo, deployment_date: deployDate,
        staff_name: match[3].trim(), staff_type: 'ACCA',
        mobile: match[4], prs_coach_no: match[2],
        is_supervisor: false, source: 'pdf',
        contract: '', poi_number: '', zone_division_depot: ''
      })
    })

    // Parse Electrical Staff
    const elecSection = text.match(/Electrical[\s\S]*?(?=Linen|Mechanical|$)/i)?.[0] || ''
    const elecMatches = [...elecSection.matchAll(/(\d+)\s+([A-Z][A-Z\s]+)\s+(\d{10})/g)]
    elecMatches.forEach(match => {
      records.push({
        train_no: trainNo, deployment_date: deployDate,
        staff_name: match[2].trim(), staff_type: 'Electrical',
        mobile: match[3], is_supervisor: false, source: 'pdf',
        contract: '', poi_number: '', prs_coach_no: null, zone_division_depot: ''
      })
    })

    return { records, trainNo, deployDate }
  }

  // Handle manual form submit
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!form.train_no || !form.staff_name || !form.deployment_date) {
      showToast('Please fill all required fields', 'error')
      return
    }
    try {
      const { error } = await supabase.from('staff_deployments').insert([form])
      if (!error) {
        showToast('✅ Staff record added!', 'success')
        setShowAddModal(false)
        setForm({
          train_no: '', deployment_date: new Date().toISOString().split('T')[0],
          staff_name: '', staff_type: 'EHK', mobile: '', contract: '',
          poi_number: '', prs_coach_no: '', zone_division_depot: '',
          is_supervisor: false, is_blacklisted: false, source: 'manual'
        })
        fetchDeployments()
      } else {
        showToast(`Error: ${error.message}`, 'error')
      }
    } catch (err) { showToast(`Error: ${err.message}`, 'error') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this staff record?')) return
    const { error } = await supabase.from('staff_deployments').delete().eq('id', id)
    if (!error) { showToast('Record deleted', 'success'); fetchDeployments() }
  }

  const handleExport = () => {
    const data = filtered.map(d => ({
      'Train No': d.train_no,
      'Date': d.deployment_date,
      'Staff Name': d.staff_name,
      'Staff Type': d.staff_type,
      'Mobile': d.mobile,
      'Coach No': d.prs_coach_no || '',
      'Contract': d.contract || '',
      'POI Number': d.poi_number || '',
      'Zone/Div/Depot': d.zone_division_depot || '',
      'Supervisor': d.is_supervisor ? 'Yes' : 'No',
      'Blacklisted': d.is_blacklisted ? 'Yes' : 'No',
      'Source': d.source || '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Staff')
    XLSX.writeFile(wb, `staff_deployments_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const tabs = [
    { id: 'directory', label: 'Staff Directory' },
    { id: 'upload', label: 'Upload PDF' },
    { id: 'gaps', label: `Coverage Gaps (${coverageGaps.length})` },
    { id: 'history', label: 'History' },
  ]

  if (loading) return <LoadingSpinner text="Loading staff data..." />

  return (
    <div className="space-y-5">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {/* Header */}
      <div className="bg-blue-700 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Staff Management</h1>
            <p className="text-blue-200 text-sm mt-0.5">Manage EHK, OBHS, ACCA & SSE staff assignments</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/10 rounded-lg px-4 py-2 text-center">
              <p className="text-2xl font-bold">{deployments.length}</p>
              <p className="text-blue-200 text-xs">Total Records</p>
            </div>
            <div className="bg-white/10 rounded-lg px-4 py-2 text-center">
              <p className="text-2xl font-bold">{new Set(deployments.map(d => d.train_no)).size}</p>
              <p className="text-blue-200 text-xs">Trains</p>
            </div>
            <Button icon={Plus} variant="secondary" onClick={() => setShowAddModal(true)}>Add Staff</Button>
            <Button icon={Download} variant="secondary" onClick={handleExport}>Export</Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAFF_TYPES.map(type => (
          <div key={type} className="bg-white rounded-xl border border-gray-200 p-4">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${STAFF_TYPE_COLORS[type]}`}>{type}</span>
            <p className="text-2xl font-bold text-gray-800 mt-2">{summary[type]?.total || 0}</p>
            <p className="text-xs text-gray-500">{summary[type]?.trains || 0} trains</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 pt-4">
          <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {/* Staff Directory Tab */}
        {activeTab === 'directory' && (
          <div className="p-5">
            {/* Search & Filter */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, train, mobile..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                options={['All', ...STAFF_TYPES].map(t => ({ value: t, label: t }))}
              />
              <Input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                placeholder="Filter by date"
              />
              <Input
                placeholder="Train no..."
                value={filterTrain}
                onChange={e => setFilterTrain(e.target.value)}
              />
              <Button variant="ghost" icon={X} onClick={() => { setSearch(''); setFilterType('All'); setFilterDate(''); setFilterTrain('') }}>Clear</Button>
            </div>

            {/* Staff Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    {['Staff Name', 'Type', 'Mobile', 'Train', 'Date', 'Coach', 'Contract', 'Source', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">No staff records found</td></tr>
                  ) : filtered.slice(0, 100).map((d, i) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-blue-600">{d.staff_name?.[0]}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{d.staff_name}</p>
                            {d.is_supervisor && <span className="text-xs text-amber-600 font-medium">Supervisor</span>}
                            {d.is_blacklisted && <span className="text-xs text-red-600 font-medium">⚠ Blacklisted</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STAFF_TYPE_COLORS[d.staff_type] || 'bg-gray-100 text-gray-700'}`}>
                          {d.staff_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{d.mobile || '-'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-800">{d.train_no}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{d.deployment_date}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{d.prs_coach_no || '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">{d.contract || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.source === 'pdf' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {d.source || 'manual'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(d.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 100 && (
                <p className="text-center text-sm text-gray-400 py-3">Showing 100 of {filtered.length} records. Use filters to narrow down.</p>
              )}
            </div>
          </div>
        )}

        {/* Upload PDF Tab */}
        {activeTab === 'upload' && (
          <div className="p-5">
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer"
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                  <p className="font-semibold text-blue-600">Processing PDF with OCR...</p>
                  <p className="text-sm text-gray-500">This may take 30-60 seconds per page</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <Upload className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Upload Staff Deployment PDF</p>
                    <p className="text-sm text-gray-500 mt-1">One PDF per train — OCR extracts data automatically</p>
                  </div>
                  <Button variant="primary" icon={Upload}>Choose PDF File</Button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={isUploading} />
            </div>

            {uploadResult && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="font-semibold text-green-800">PDF Processed!</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                    <p className="text-2xl font-bold text-green-600">{uploadResult.records?.length || 0}</p>
                    <p className="text-xs text-gray-500">Records Added</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                    <p className="text-xl font-bold text-blue-600">{uploadResult.trainNo}</p>
                    <p className="text-xs text-gray-500">Train No</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                    <p className="text-xl font-bold text-purple-600">{uploadResult.deployDate}</p>
                    <p className="text-xs text-gray-500">Date</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">📋 PDF Format Requirements:</p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• Upload Staff Deployment Report PDF (one per train)</li>
                <li>• System auto-extracts: Train info, EHK, OBHS, ACCA (Linen), Electrical staff</li>
                <li>• ACCA staff are mapped to their PRS Coach Numbers</li>
                <li>• After upload, edit any incorrectly read data manually</li>
              </ul>
            </div>
          </div>
        )}

        {/* Coverage Gaps Tab */}
        {activeTab === 'gaps' && (
          <div className="p-5">
            {coverageGaps.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No coverage gaps found!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-amber-600 font-medium">⚠ {coverageGaps.length} trains have missing staff types</p>
                {coverageGaps.map((gap, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Train className="w-4 h-4 text-amber-600" />
                        <span className="font-bold text-gray-800">Train {gap.train}</span>
                        <span className="text-xs text-gray-500">{gap.date}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-red-600 font-semibold mb-2">Missing Staff Types:</p>
                      <div className="flex flex-wrap gap-2">
                        {gap.missing.map(type => (
                          <span key={type} className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">{type}</span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-green-600 font-semibold mb-1">Assigned:</p>
                      <div className="flex flex-wrap gap-2">
                        {[...gap.types].map(type => (
                          <span key={type} className={`px-2 py-0.5 rounded-full text-xs font-bold ${STAFF_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'}`}>{type}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="p-5">
            <p className="text-sm text-gray-500 mb-4">Complete staff deployment history — all dates</p>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['Date', 'Train', 'Staff Name', 'Type', 'Mobile', 'Coach', 'Source'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deployments.map((d, i) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-600">{d.deployment_date}</td>
                      <td className="px-4 py-2 text-xs font-bold text-gray-800">{d.train_no}</td>
                      <td className="px-4 py-2 text-xs text-gray-700">{d.staff_name}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STAFF_TYPE_COLORS[d.staff_type] || 'bg-gray-100 text-gray-700'}`}>{d.staff_type}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">{d.mobile || '-'}</td>
                      <td className="px-4 py-2 text-xs text-gray-600">{d.prs_coach_no || '-'}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${d.source === 'pdf' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{d.source}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Staff Record" size="lg">
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Train Number *" placeholder="e.g. 12565" value={form.train_no} onChange={e => setForm(p => ({ ...p, train_no: e.target.value }))} required />
            <Input label="Deployment Date *" type="date" value={form.deployment_date} onChange={e => setForm(p => ({ ...p, deployment_date: e.target.value }))} required />
            <Input label="Staff Name *" placeholder="Full name" value={form.staff_name} onChange={e => setForm(p => ({ ...p, staff_name: e.target.value }))} required />
            <Select label="Staff Type *" value={form.staff_type} onChange={e => setForm(p => ({ ...p, staff_type: e.target.value }))} options={STAFF_TYPES.map(t => ({ value: t, label: t }))} />
            <Input label="Mobile" placeholder="10-digit mobile" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} />
            <Input label="PRS Coach No" placeholder="e.g. A1, B2 (for ACCA)" value={form.prs_coach_no} onChange={e => setForm(p => ({ ...p, prs_coach_no: e.target.value }))} />
            <Input label="Contract" placeholder="Contract details" value={form.contract} onChange={e => setForm(p => ({ ...p, contract: e.target.value }))} />
            <Input label="POI Number" placeholder="POI number" value={form.poi_number} onChange={e => setForm(p => ({ ...p, poi_number: e.target.value }))} />
            <Input label="Zone/Division/Depot" placeholder="e.g. ECR/SPJ/DBG" value={form.zone_division_depot} onChange={e => setForm(p => ({ ...p, zone_division_depot: e.target.value }))} />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_supervisor} onChange={e => setForm(p => ({ ...p, is_supervisor: e.target.checked }))} className="rounded" />
              <span className="text-sm text-gray-700">Is Supervisor</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_blacklisted} onChange={e => setForm(p => ({ ...p, is_blacklisted: e.target.checked }))} className="rounded" />
              <span className="text-sm text-red-600">Blacklisted</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" icon={Plus}>Add Staff</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
