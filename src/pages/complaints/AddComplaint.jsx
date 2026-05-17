import React, { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Upload, FileSpreadsheet, Plus, X, CheckCircle,
  AlertTriangle, Loader2, Download, Train, FileText
} from 'lucide-react'
import { Button, Input, Select, Card, Modal, Toast, Badge } from '../../components/ui/index'

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

const COMPLAINT_MODES = [
  { value: 'T', label: 'Train' },
  { value: 'H', label: 'Helpline' },
  { value: 'A', label: 'App' },
  { value: 'R', label: 'Railmadad App' },
  { value: 'S', label: 'Social Media' },
]

const RATINGS = ['Excellent', 'Satisfactory', 'Neutral', 'Unsatisfactory', 'Not Rated']
const SLA_OPTIONS = ['SLA 1', 'SLA 2', 'No']
const STATUSES = ['Open', 'Closed', 'Pending']

export default function AddComplaint() {
  const [activeTab, setActiveTab] = useState('bulk')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [showForm, setShowForm] = useState(false)
  const fileInputRef = useRef(null)

  // Calculate suggested journey start date
  // Logic: complaint train_no + next_station + created_on time → match against train_stations schedule
  const calculateJourneyStartDate = (complaint, trainStationsMap) => {
    try {
      const trainNo = String(complaint.train_no || '').trim()
      const nextStation = String(complaint.next_station || '').trim().toUpperCase()
      const complaintTime = complaint.created_on ? new Date(complaint.created_on) : null

      if (!trainNo || !nextStation || !complaintTime) return null

      // Get stations for this train
      const stations = trainStationsMap[trainNo]
      if (!stations || stations.length === 0) return null

      // Find the next_station in the route
      const matchStation = stations.find(s =>
        s.station_code?.toUpperCase() === nextStation ||
        s.station_name?.toUpperCase().includes(nextStation) ||
        nextStation.includes(s.station_code?.toUpperCase())
      )

      if (!matchStation) return null

      // Get the arrival time at this station
      const arrivalTime = matchStation.arrival_time // e.g. "02:35"
      if (!arrivalTime) return null

      const [arrHour, arrMin] = arrivalTime.split(':').map(Number)
      const dayOffset = matchStation.sequence_no <= 1 ? 0 : (matchStation.day_offset || 1)

      // Calculate journey start date
      // complaint date - dayOffset = journey start date
      const complaintDate = new Date(complaintTime)
      const journeyStartDate = new Date(complaintDate)
      journeyStartDate.setDate(journeyStartDate.getDate() - dayOffset)

      // Verify: complaint time should be close to station arrival time
      const complaintHour = complaintDate.getHours()
      const complaintMin = complaintDate.getMinutes()
      const timeDiffMins = Math.abs((complaintHour * 60 + complaintMin) - (arrHour * 60 + arrMin))

      // If time difference > 3 hours, less confident but still return
      if (timeDiffMins > 180) return null

      return journeyStartDate.toISOString().split('T')[0]
    } catch (e) {
      return null
    }
  }

  // Manual form state
  const [form, setForm] = useState({
    complaint_ref_no: '', created_on: '', status: 'Open',
    complaint_mode: 'T', train_no: '', primary_depot: '',
    train_name: '', coach_type: '', physical_coach_no: '',
    pnr_uts_no: '', comp_type_name: '', sub_type_name: '',
    complaint_desc: '', remarks: '', feedback_remark: '',
    zone_code: '', div_code: '', own_zone_code: '', own_div_code: '',
    next_station: '', rating: 'Not Rated', sla: 'No',
    forwarded: 0, coach_owning_railway: '',
    prev_watering_station: '', next_watering_station: '',
    user_mobile: '', diff: ''
  })

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 5000)
  }

  // Parse Excel date
  const parseDate = (raw) => {
    if (!raw) return null
    const str = String(raw).trim()
    if (!isNaN(Number(raw)) && Number(raw) > 40000) {
      const d = new Date(Math.round((Number(raw) - 25569) * 86400 * 1000))
      return d.toISOString()
    }
    const match = str.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})\s*(\d{1,2})?:?(\d{2})?/)
    if (match) {
      const [, d, m, y, h = '12', min = '00'] = match
      const year = y.length === 2 ? '20' + y : y
      return new Date(`${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min}:00`).toISOString()
    }
    return null
  }

  const parseResTime = (val) => {
    if (!val || String(val) === 'null') return null
    const match = String(val).match(/(\d+):(\d+)/)
    return match ? String(val) : null
  }

  // Handle Excel upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!window.XLSX) {
      await new Promise(res => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
        s.onload = res
        document.head.appendChild(s)
      })
    }

    setIsUploading(true)
    setUploadResult(null)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const workbook = window.XLSX.read(evt.target.result, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawArray = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

        if (!rawArray || rawArray.length === 0) throw new Error('File is empty')

        // Find header row
        let headerRowIdx = -1
        let colMap = {}
        const keyHeaders = ['complaintrefno', 'refno', 'createdon', 'comptypename']

        for (let i = 0; i < Math.min(20, rawArray.length); i++) {
          const row = rawArray[i]
          if (!row || !Array.isArray(row)) continue
          const cleanRow = row.map(c => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim())
          const matchCount = keyHeaders.filter(kh => cleanRow.includes(kh)).length
          if (matchCount >= 2) {
            headerRowIdx = i
            cleanRow.forEach((val, idx) => { if (val) colMap[val] = idx })
            break
          }
        }

        if (headerRowIdx === -1) throw new Error('Headers not found. Check file format.')

        // Add aliases for camelCase headers from the Excel file
        const addAlias = (original, alias) => {
          if (colMap[original] !== undefined && colMap[alias] === undefined) {
            colMap[alias] = colMap[original]
          }
        }
        addAlias('trainstation', 'trainno')
        addAlias('comptypename', 'comptypename')
        addAlias('subtypename', 'subtypename')
        addAlias('trainnameforreport', 'trainnameforreport')
        addAlias('primarydepot', 'primarydepot')
        addAlias('zonecode', 'zonecode')
        addAlias('divcode', 'divcode')
        addAlias('ownzonecode', 'ownzonecode')
        addAlias('owndivcode', 'owndivcode')
        addAlias('deptcode', 'deptcode')
        addAlias('nextstation', 'nextstation')
        addAlias('contactid', 'contactid')
        addAlias('usermobile', 'usermobile')
        addAlias('userid', 'userid')
        addAlias('pnrutsno', 'pnrutsno')
        addAlias('coachtype', 'coachtype')
        addAlias('coachno', 'coachno')
        addAlias('physicalcoachno', 'physicalcoachno')
        addAlias('feedbackremark', 'feedbackremark')
        addAlias('complaintdesc', 'complaintdesc')
        addAlias('complaintmode', 'complaintmode')
        addAlias('channeltype', 'channeltype')
        addAlias('avgcdiff', 'avgcdiff')
        addAlias('finalstatus', 'finalstatus')
        addAlias('modifiedon', 'modifiedon')
        addAlias('coachowningrailway', 'coachowningrailway')
        addAlias('previouswateringstation', 'previouswateringstation')
        addAlias('nextwateringstation', 'nextwateringstation')

        const get = (row, key) => {
          const idx = colMap[key]
          return idx !== undefined ? row[idx] : null
        }

        // Fetch train stations for journey mapping
        const { data: trainStationsData } = await supabase
          .from('train_stations')
          .select('train_id, station_code, station_name, sequence_no, arrival_time, trains(train_no)')

        // Build train stations map: trainNo -> stations[]
        const trainStationsMap = {}
        ;(trainStationsData || []).forEach(s => {
          const trainNo = s.trains?.train_no
          if (!trainNo) return
          if (!trainStationsMap[trainNo]) trainStationsMap[trainNo] = []
          trainStationsMap[trainNo].push({
            ...s,
            day_offset: s.sequence_no > 10 ? 1 : 0 // rough estimate
          })
        })

        // Fetch existing ref nos to avoid duplicates
        const { data: existing } = await supabase
          .from('complaints')
          .select('complaint_ref_no')

        const existingSet = new Set((existing || []).map(r => r.complaint_ref_no))

        const toInsert = []
        let skipped = 0
        let errors = 0

        for (let i = headerRowIdx + 1; i < rawArray.length; i++) {
          const row = rawArray[i]
          if (!row || row.length === 0) continue

          try {
            const rawRefNo = get(row, 'complaintrefno') || get(row, 'refno')
            if (!rawRefNo) continue
            const refNo = String(rawRefNo).trim()
            const createdOn = get(row, 'createdon')
            if (!refNo || !createdOn) continue

            if (existingSet.has(refNo)) { skipped++; continue }

            const parsedDate = parseDate(createdOn)
            if (!parsedDate) continue

            const modifiedOn = get(row, 'modifiedon')
            const rawCat = String(get(row, 'comptypename') || 'Uncategorized').trim()
            const rawSubCat = String(get(row, 'subtypename') || '').trim()
            const rawDesc = String(get(row, 'complaintdesc') || '').substring(0, 500)

            // Train number — trainStation column contains the train number
            const trainStation = get(row, 'trainstation')
            const trainReportName = get(row, 'trainnameforreport')
            const trainNo = String(trainStation || '').trim() || 'Unknown'

            // Clean null strings
            const clean = (val) => {
              const s = String(val || '').trim()
              return (s === 'null' || s === '' || s === 'undefined') ? null : s
            }

            toInsert.push({
              complaint_ref_no: refNo,
              created_on: parsedDate,
              modified_on: modifiedOn ? parseDate(modifiedOn) : null,
              final_status: clean(get(row, 'finalstatus')),
              status: clean(get(row, 'status')) || 'Unknown',
              diff: clean(get(row, 'diff')),
              avgc_diff: clean(get(row, 'avgcdiff')),
              complaint_mode: clean(get(row, 'complaintmode')),
              channel_type: clean(get(row, 'channeltype')),
              train_no: trainNo,
              primary_depot: clean(get(row, 'primarydepot')),
              train_name: clean(trainReportName),
              coach_type: clean(get(row, 'coachtype')),
              coach_no: clean(get(row, 'coachno')),
              physical_coach_no: clean(get(row, 'physicalcoachno')),
              pnr_uts_no: clean(get(row, 'pnrutsno')),
              comp_type_name: rawCat,
              sub_type_name: clean(rawSubCat),
              complaint_desc: rawDesc || null,
              remarks: String(get(row, 'remarks') || '').substring(0, 500) || null,
              feedback_remark: clean(get(row, 'feedbackremark')),
              zone_code: clean(get(row, 'zonecode')),
              div_code: clean(get(row, 'divcode')),
              own_zone_code: clean(get(row, 'ownzonecode')),
              own_div_code: clean(get(row, 'owndivcode')),
              dept_code: clean(get(row, 'deptcode')),
              next_station: clean(get(row, 'nextstation')),
              contact_id: clean(get(row, 'contactid')),
              user_mobile: clean(get(row, 'usermobile')),
              user_id: clean(get(row, 'userid')),
              rating: clean(get(row, 'rating')) || 'Not Rated',
              sla: clean(get(row, 'sla')) || 'No',
              forwarded: parseInt(get(row, 'forwarded') || 0) || 0,
              commodity: clean(get(row, 'commodity')),
              coach_owning_railway: clean(get(row, 'coachowningrailway')),
              prev_watering_station: clean(get(row, 'previouswateringstation')),
              next_watering_station: clean(get(row, 'nextwateringstation')),
              suggested_journey_start_date: null, // will calculate below
            })

            // Calculate journey start date
            const lastRecord = toInsert[toInsert.length - 1]
            const journeyDate = calculateJourneyStartDate(lastRecord, trainStationsMap)
            if (journeyDate) lastRecord.suggested_journey_start_date = journeyDate

            existingSet.add(refNo)
          } catch (rowErr) {
            errors++
          }
        }

        // Batch insert in chunks of 100
        let inserted = 0
        const chunkSize = 100
        const insertErrors = []
        for (let i = 0; i < toInsert.length; i += chunkSize) {
          const chunk = toInsert.slice(i, i + chunkSize)
          const { error } = await supabase.from('complaints').insert(chunk)
          if (!error) {
            inserted += chunk.length
          } else {
            console.error('Insert error:', error)
            insertErrors.push(error.message)
            errors += chunk.length
          }
        }

        if (insertErrors.length > 0) {
          console.error('All insert errors:', insertErrors)
        }

        setUploadResult({
          success: true,
          inserted,
          skipped,
          errors,
          total: rawArray.length - headerRowIdx - 1
        })
        showToast(`✅ Successfully uploaded ${inserted} complaints!`, 'success')

      } catch (err) {
        setUploadResult({ success: false, error: err.message })
        showToast(`❌ Upload failed: ${err.message}`, 'error')
      } finally {
        setIsUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Handle manual form submit
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!form.complaint_ref_no || !form.train_no || !form.comp_type_name) {
      showToast('Please fill all required fields', 'error')
      return
    }

    try {
      const { error } = await supabase.from('complaints').insert([{
        ...form,
        created_on: form.created_on ? new Date(form.created_on).toISOString() : new Date().toISOString(),
        forwarded: parseInt(form.forwarded) || 0,
      }])

      if (error) {
        if (error.code === '23505') showToast('Complaint reference number already exists!', 'error')
        else showToast(`Error: ${error.message}`, 'error')
      } else {
        showToast('✅ Complaint added successfully!', 'success')
        setForm({
          complaint_ref_no: '', created_on: '', status: 'Open',
          complaint_mode: 'T', train_no: '', primary_depot: '',
          train_name: '', coach_type: '', physical_coach_no: '',
          pnr_uts_no: '', comp_type_name: '', sub_type_name: '',
          complaint_desc: '', remarks: '', feedback_remark: '',
          zone_code: '', div_code: '', own_zone_code: '', own_div_code: '',
          next_station: '', rating: 'Not Rated', sla: 'No',
          forwarded: 0, coach_owning_railway: '',
          prev_watering_station: '', next_watering_station: '',
          user_mobile: '', diff: ''
        })
        setShowForm(false)
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error')
    }
  }

  const updateForm = (key, value) => setForm(p => ({ ...p, [key]: value }))

  return (
    <div className="space-y-6">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {/* Header */}
      <div className="bg-blue-700 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Add New Complaint</h1>
            <p className="text-blue-200 text-sm mt-0.5">Register new railway complaints with detailed information</p>
          </div>
          <Button
            icon={Plus}
            variant="secondary"
            onClick={() => setShowForm(true)}
          >
            Add Manually
          </Button>
        </div>
      </div>

      {/* Bulk Upload Section */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Bulk Import from Excel</h3>
              <p className="text-sm text-gray-500">Upload daily complaints Excel file — duplicates are automatically removed</p>
            </div>
          </div>

          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer"
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                <p className="font-semibold text-blue-600">Processing file...</p>
                <p className="text-sm text-gray-500">Please wait, this may take a moment</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                  <Upload className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-700">Click to upload or drag & drop</p>
                  <p className="text-sm text-gray-500 mt-1">Supports .xlsx and .csv files</p>
                </div>
                <Button variant="primary" icon={Upload}>
                  Choose File
                </Button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className={`mt-4 p-4 rounded-xl border ${uploadResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {uploadResult.success ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="font-semibold text-green-800">Upload Successful!</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                      <p className="text-2xl font-bold text-green-600">{uploadResult.inserted}</p>
                      <p className="text-xs text-gray-500 mt-0.5">New Records Added</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                      <p className="text-2xl font-bold text-amber-600">{uploadResult.skipped}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Duplicates Skipped</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                      <p className="text-2xl font-bold text-red-600">{uploadResult.errors}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Errors</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <p className="font-semibold text-red-800">Upload Failed: {uploadResult.error}</p>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-sm font-semibold text-gray-700 mb-2">📋 File Format Requirements:</p>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>• File must have headers: <code className="bg-gray-200 px-1 rounded text-xs">complaintRefNo, createdOn, compTypeName</code></li>
              <li>• Duplicate complaints (same <code className="bg-gray-200 px-1 rounded text-xs">complaintRefNo</code>) are automatically skipped</li>
              <li>• Supports both daily and bulk historical uploads</li>
              <li>• Date format: DD-MM-YY or DD/MM/YYYY</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Manual Add Complaint Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add New Complaint" size="xl">
        <form onSubmit={handleManualSubmit} className="space-y-6">

          {/* Train Information */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Train className="w-4 h-4 text-blue-600" />
              <h4 className="font-semibold text-gray-800">Train Information</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Input label="Train Number *" placeholder="e.g. 12565" value={form.train_no} onChange={e => updateForm('train_no', e.target.value)} required />
              <Input label="Train Name" placeholder="Express Train" value={form.train_name} onChange={e => updateForm('train_name', e.target.value)} />
              <Input label="Primary Depot" placeholder="e.g. DBG" value={form.primary_depot} onChange={e => updateForm('primary_depot', e.target.value)} />
              <Input label="Coach Type" placeholder="e.g. SL, 3A, 1A" value={form.coach_type} onChange={e => updateForm('coach_type', e.target.value)} />
              <Input label="Physical Coach Number *" placeholder="e.g. A1, B2, H1" value={form.physical_coach_no} onChange={e => updateForm('physical_coach_no', e.target.value)} />
              <Input label="PNR/UTS Number" placeholder="e.g. 1234567890" value={form.pnr_uts_no} onChange={e => updateForm('pnr_uts_no', e.target.value)} />
            </div>
          </div>

          {/* Complaint Details */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-blue-600" />
              <h4 className="font-semibold text-gray-800">Complaint Details</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Input label="Complaint Ref No *" placeholder="e.g. 2026051500001" value={form.complaint_ref_no} onChange={e => updateForm('complaint_ref_no', e.target.value)} required />
              <Input label="Created On *" type="datetime-local" value={form.created_on} onChange={e => updateForm('created_on', e.target.value)} required />
              <Select
                label="Complaint Mode"
                value={form.complaint_mode}
                onChange={e => updateForm('complaint_mode', e.target.value)}
                options={COMPLAINT_MODES}
              />
              <Select
                label="Complaint Type *"
                value={form.comp_type_name}
                onChange={e => { updateForm('comp_type_name', e.target.value); updateForm('sub_type_name', '') }}
                options={[{ value: '', label: 'Select Type' }, ...COMPLAINT_TYPES.map(t => ({ value: t, label: t }))]}
              />
              <Select
                label="Sub Type *"
                value={form.sub_type_name}
                onChange={e => updateForm('sub_type_name', e.target.value)}
                options={[{ value: '', label: 'Select Sub Type' }, ...(SUB_TYPES[form.comp_type_name] || []).map(t => ({ value: t, label: t }))]}
              />
              <Select
                label="Status"
                value={form.status}
                onChange={e => updateForm('status', e.target.value)}
                options={STATUSES.map(s => ({ value: s, label: s }))}
              />
              <Select
                label="Rating"
                value={form.rating}
                onChange={e => updateForm('rating', e.target.value)}
                options={RATINGS.map(r => ({ value: r, label: r }))}
              />
              <Select
                label="SLA"
                value={form.sla}
                onChange={e => updateForm('sla', e.target.value)}
                options={SLA_OPTIONS.map(s => ({ value: s, label: s }))}
              />
              <Input
                label="Forwarded (times)"
                type="number"
                min="0"
                value={form.forwarded}
                onChange={e => updateForm('forwarded', e.target.value)}
              />
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Complaint Description</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe the complaint..."
                  value={form.complaint_desc}
                  onChange={e => updateForm('complaint_desc', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Remarks</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Resolution remarks..."
                  value={form.remarks}
                  onChange={e => updateForm('remarks', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passenger Feedback</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Passenger feedback..."
                  value={form.feedback_remark}
                  onChange={e => updateForm('feedback_remark', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Geography */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Geography</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input label="Zone Code" placeholder="e.g. EC" value={form.zone_code} onChange={e => updateForm('zone_code', e.target.value)} />
              <Input label="Division Code" placeholder="e.g. SPJ" value={form.div_code} onChange={e => updateForm('div_code', e.target.value)} />
              <Input label="Own Zone Code" placeholder="e.g. EC" value={form.own_zone_code} onChange={e => updateForm('own_zone_code', e.target.value)} />
              <Input label="Own Division Code" placeholder="e.g. SPJ" value={form.own_div_code} onChange={e => updateForm('own_div_code', e.target.value)} />
              <Input label="Next Station" placeholder="e.g. CNB" value={form.next_station} onChange={e => updateForm('next_station', e.target.value)} />
              <Input label="Coach Owning Railway" placeholder="e.g. EC, NR" value={form.coach_owning_railway} onChange={e => updateForm('coach_owning_railway', e.target.value)} />
              <Input label="Previous Watering Station" placeholder="e.g. CNB" value={form.prev_watering_station} onChange={e => updateForm('prev_watering_station', e.target.value)} />
              <Input label="Next Watering Station" placeholder="e.g. GKP" value={form.next_watering_station} onChange={e => updateForm('next_watering_station', e.target.value)} />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="primary" type="submit" icon={Plus}>Add Complaint</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
