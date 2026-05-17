import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Train, Plus, Search, Edit, Trash2, Eye, MapPin,
  Calendar, Clock, CheckCircle, AlertTriangle, Download,
  ChevronRight, Star, Droplets, Wrench, X, Upload
} from 'lucide-react'
import { LoadingSpinner, Modal, Button, Input, Select, Card, Toast, TabBar, Badge } from '../../components/ui/index'
import * as XLSX from 'xlsx'

const FREQUENCIES = ['Daily', 'Weekly', 'Bi-weekly', 'Tri-weekly']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function RunningTrains({ userRole }) {
  const [trains, setTrains] = useState([])
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterDepot, setFilterDepot] = useState('All')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedTrain, setSelectedTrain] = useState(null)
  const [showStationsModal, setShowStationsModal] = useState(false)
  const [activeTab, setActiveTab] = useState('list')
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [saving, setSaving] = useState(false)

  // Add Train Form
  const [form, setForm] = useState({
    train_no: '', train_name: '', from_station: '', to_station: '',
    zone: '', division: '', depot: '', frequency: 'Daily',
    operating_days: [], departure_time: '', arrival_time: '',
    journey_duration_days: 1, is_active: true, is_priority: false
  })

  // Station form
  const [stationForm, setStationForm] = useState({
    station_code: '', station_name: '', sequence_no: '',
    arrival_time: '', departure_time: '', stoppage_minutes: 0,
    is_watering_station: false, is_maintenance_station: false,
    is_source: false, is_destination: false
  })

  useEffect(() => { fetchTrains() }, [])

  const fetchTrains = async () => {
    setLoading(true)
    try {
      const { data: trainsData } = await supabase.from('trains').select('*').order('train_no')
      const { data: stationsData } = await supabase.from('train_stations').select('*').order('sequence_no')
      setTrains(trainsData || [])
      setStations(stationsData || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 5000)
  }

  const filtered = useMemo(() => {
    return trains.filter(t => {
      const s = search.toLowerCase()
      if (s && !String(t.train_no).includes(s) && !String(t.train_name).toLowerCase().includes(s) && !String(t.depot).toLowerCase().includes(s)) return false
      if (filterStatus !== 'All' && (filterStatus === 'Active' ? !t.is_active : t.is_active)) return false
      if (filterDepot !== 'All' && t.depot !== filterDepot) return false
      return true
    })
  }, [trains, search, filterStatus, filterDepot])

  const depots = ['All', ...new Set(trains.map(t => t.depot).filter(Boolean))]

  const getTrainStations = (trainId) => stations.filter(s => s.train_id === trainId).sort((a, b) => a.sequence_no - b.sequence_no)

  const handleAddTrain = async (e) => {
    e.preventDefault()
    if (!form.train_no || !form.train_name) { showToast('Train number and name required', 'error'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('trains').insert([form])
      if (!error) {
        showToast('✅ Train added successfully!', 'success')
        setShowAddModal(false)
        resetForm()
        fetchTrains()
      } else showToast(`Error: ${error.message}`, 'error')
    } catch (err) { showToast(`Error: ${err.message}`, 'error') }
    finally { setSaving(false) }
  }

  const handleDeleteTrain = async (id) => {
    if (!confirm('Delete this train and all its station data?')) return
    const { error } = await supabase.from('trains').delete().eq('id', id)
    if (!error) { showToast('Train deleted', 'success'); fetchTrains() }
  }

  const handleToggleActive = async (train) => {
    const { error } = await supabase.from('trains').update({ is_active: !train.is_active }).eq('id', train.id)
    if (!error) fetchTrains()
  }

  // Handle Excel upload for station data
  const handleStationExcelUpload = async (e, trainId) => {
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

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const workbook = window.XLSX.read(evt.target.result, { type: 'array' })
        let allRecords = []

        // Process each sheet
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

          // Find train number from title row
          let targetTrainId = trainId
          const titleRow = rows[0]
          if (titleRow && titleRow[0]) {
            const titleMatch = String(titleRow[0]).match(/\b(\d{4,5})\b/)
            if (titleMatch) {
              // Find matching train in DB
              const matchingTrain = trains.find(t => t.train_no === titleMatch[1])
              if (matchingTrain) targetTrainId = matchingTrain.id
            }
          }

          // Parse stations - 2 rows per station
          let seqNo = 1
          let i = 2 // Skip title and header rows
          while (i < rows.length) {
            const row1 = rows[i]
            const row2 = rows[i + 1]
            if (!row1) { i += 2; continue }

            const srNo = row1[0]
            if (!srNo || isNaN(Number(srNo))) { i++; continue }

            const stationName = String(row1[1] || '').trim()
            const arrTime = row1[3]
            const halt = String(row1[4] || '').trim()
            const isWatering = String(row1[6] || '').toLowerCase().includes('y') || String(row1[6] || '') === '1'
            const isMaintenance = String(row1[7] || '').toLowerCase().includes('y') || String(row1[7] || '') === '1'

            const stationCode = row2 ? String(row2[1] || '').trim().replace(/\s.*/, '') : ''
            const depTime = row2 ? row2[3] : null

            // Format times
            const formatTime = (t) => {
              if (!t) return null
              if (typeof t === 'object' && t instanceof Date) {
                return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`
              }
              if (typeof t === 'string') {
                const match = t.match(/(\d{1,2}):(\d{2})/)
                return match ? `${match[1].padStart(2,'0')}:${match[2]}` : null
              }
              return null
            }

            // Parse halt minutes
            const haltMatch = halt.match(/(\d+)/)
            const stoppageMinutes = haltMatch ? parseInt(haltMatch[1]) : 0

            const isSource = String(arrTime).toUpperCase() === 'SRC'
            const isDest = String(depTime || '').toUpperCase() === 'DSTN'

            if (stationCode && stationName) {
              allRecords.push({
                train_id: targetTrainId,
                station_code: stationCode.substring(0, 10),
                station_name: stationName.substring(0, 100),
                sequence_no: seqNo++,
                arrival_time: isSource ? null : formatTime(arrTime),
                departure_time: isDest ? null : formatTime(depTime),
                stoppage_minutes: stoppageMinutes,
                is_watering_station: isWatering,
                is_maintenance_station: isMaintenance,
                is_source: isSource,
                is_destination: isDest,
              })
            }
            i += 2
          }
        }

        if (allRecords.length > 0) {
          // Delete existing stations for this train first
          await supabase.from('train_stations').delete().eq('train_id', trainId)
          // Insert new stations
          const { error } = await supabase.from('train_stations').insert(allRecords)
          if (!error) {
            showToast(`✅ Added ${allRecords.length} stations successfully!`, 'success')
            fetchTrains()
          } else {
            showToast(`Error: ${error.message}`, 'error')
          }
        } else {
          showToast('No station data found in file', 'error')
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = null
  }

  const handleAddStation = async (e) => {
    e.preventDefault()
    if (!stationForm.station_code || !selectedTrain) return
    const { error } = await supabase.from('train_stations').insert([{
      ...stationForm, train_id: selectedTrain.id,
      sequence_no: parseInt(stationForm.sequence_no) || getTrainStations(selectedTrain.id).length + 1,
      stoppage_minutes: parseInt(stationForm.stoppage_minutes) || 0
    }])
    if (!error) {
      showToast('✅ Station added!', 'success')
      setStationForm({ station_code: '', station_name: '', sequence_no: '', arrival_time: '', departure_time: '', stoppage_minutes: 0, is_watering_station: false, is_maintenance_station: false, is_source: false, is_destination: false })
      fetchTrains()
    } else showToast(`Error: ${error.message}`, 'error')
  }

  const handleDeleteStation = async (id, stationName) => {
    if (!confirm(`Are you sure you want to delete station "${stationName}"?`)) return
    const { error } = await supabase.from('train_stations').delete().eq('id', id)
    if (!error) { showToast('Station removed', 'success'); fetchTrains() }
    else showToast(`Error: ${error.message}`, 'error')
  }

  const handleCreateJourneys = async () => {
    const today = new Date().toISOString().split('T')[0]
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'short' })
    let created = 0
    for (const train of trains.filter(t => t.is_active && t.operating_days?.includes(dayName))) {
      const { error } = await supabase.from('journeys').upsert({
        train_id: train.id, train_no: train.train_no, journey_date: today,
        status: 'active'
      }, { onConflict: 'train_id,journey_date' })
      if (!error) created++
    }
    showToast(`✅ Created ${created} journey instances for today`, 'success')
  }

  const handleExport = () => {
    const data = trains.map(t => ({
      'Train No': t.train_no, 'Train Name': t.train_name,
      'From': t.from_station, 'To': t.to_station,
      'Zone': t.zone, 'Division': t.division, 'Depot': t.depot,
      'Frequency': t.frequency, 'Operating Days': t.operating_days?.join(', '),
      'Departure': t.departure_time, 'Arrival': t.arrival_time,
      'Duration (days)': t.journey_duration_days,
      'Status': t.is_active ? 'Active' : 'Inactive',
      'Priority': t.is_priority ? 'Yes' : 'No',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Trains')
    XLSX.writeFile(wb, `running_trains_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const resetForm = () => setForm({
    train_no: '', train_name: '', from_station: '', to_station: '',
    zone: '', division: '', depot: '', frequency: 'Daily',
    operating_days: [], departure_time: '', arrival_time: '',
    journey_duration_days: 1, is_active: true, is_priority: false
  })

  const toggleDay = (day) => {
    setForm(p => ({
      ...p,
      operating_days: p.operating_days.includes(day)
        ? p.operating_days.filter(d => d !== day)
        : [...p.operating_days, day]
    }))
  }

  const tabs = [
    { id: 'list', label: 'Trains Directory' },
    { id: 'journeys', label: 'Today\'s Journeys' },
  ]

  // Stats
  const activeCount = trains.filter(t => t.is_active).length
  const priorityCount = trains.filter(t => t.is_priority).length
  const totalWatering = stations.filter(s => s.is_watering_station).length
  const totalMaintenance = stations.filter(s => s.is_maintenance_station).length

  if (loading) return <LoadingSpinner text="Loading trains..." />

  return (
    <div className="space-y-5">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      {/* Header */}
      <div className="bg-green-700 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Running Trains</h1>
            <p className="text-green-200 text-sm mt-0.5">Manage primary train configurations, routes and schedules</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
              <p className="text-xl font-bold">{trains.length}</p>
              <p className="text-green-200 text-xs">Total</p>
            </div>
            <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
              <p className="text-xl font-bold">{activeCount}</p>
              <p className="text-green-200 text-xs">Active</p>
            </div>
            <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
              <p className="text-xl font-bold">{totalWatering}</p>
              <p className="text-green-200 text-xs">Watering Pts</p>
            </div>
            <Button icon={Plus} variant="secondary" onClick={() => setShowAddModal(true)}>Add Train</Button>
            <Button icon={Calendar} variant="secondary" onClick={handleCreateJourneys}>Create Today's Journeys</Button>
            <Button icon={Download} variant="secondary" onClick={handleExport}>Export</Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Trains', value: activeCount, icon: Train, color: 'text-green-600 bg-green-50' },
          { label: 'Priority Trains', value: priorityCount, icon: Star, color: 'text-amber-600 bg-amber-50' },
          { label: 'Watering Points', value: totalWatering, icon: Droplets, color: 'text-blue-600 bg-blue-50' },
          { label: 'Maintenance Points', value: totalMaintenance, icon: Wrench, color: 'text-purple-600 bg-purple-50' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`p-3 rounded-lg ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by train number, name, depot..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <Select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            options={['All', 'Active', 'Inactive'].map(s => ({ value: s, label: s }))}
          />
          <Select
            value={filterDepot}
            onChange={e => setFilterDepot(e.target.value)}
            options={depots.map(d => ({ value: d, label: d }))}
          />
          <Button variant="ghost" icon={X} onClick={() => { setSearch(''); setFilterStatus('All'); setFilterDepot('All') }}>Clear</Button>
        </div>
      </div>

      {/* Trains List */}
      {trains.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Train className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Trains Added Yet</h3>
          <p className="text-gray-500 text-sm mb-4">Add your primary trains to start managing routes and schedules</p>
          <Button icon={Plus} variant="primary" onClick={() => setShowAddModal(true)}>Add First Train</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(train => {
            const trainStations = getTrainStations(train.id)
            const wateringStations = trainStations.filter(s => s.is_watering_station)
            const maintenanceStations = trainStations.filter(s => s.is_maintenance_station)

            return (
              <div key={train.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${train.is_active ? 'bg-green-50' : 'bg-gray-100'}`}>
                        <Train className={`w-5 h-5 ${train.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-800">{train.train_no} — {train.train_name}</h3>
                          {train.is_active ? (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">Active</span>
                          ) : (
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium">Inactive</span>
                          )}
                          {train.is_priority && (
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">⭐ Priority</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{train.from_station} → {train.to_station}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{train.frequency}</span>
                          {train.departure_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Dep: {train.departure_time}</span>}
                          {train.depot && <span className="flex items-center gap-1"><Building className="w-3 h-3" />{train.depot}</span>}
                        </div>
                        {train.operating_days?.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            {DAYS.map(day => (
                              <span key={day} className={`w-7 h-5 flex items-center justify-center text-xs rounded font-medium ${train.operating_days.includes(day) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                {day[0]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right text-xs text-gray-500 mr-2">
                        <p>{trainStations.length} stations</p>
                        <p className="text-blue-600">{wateringStations.length} watering</p>
                        <p className="text-purple-600">{maintenanceStations.length} maintenance</p>
                      </div>
                      <button
                        onClick={() => { setSelectedTrain(train); setShowStationsModal(true) }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Manage Stations"
                      >
                        <MapPin className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(train)}
                        className={`p-2 rounded-lg transition-colors ${train.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                        title="Toggle Active"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTrain(train.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Route visualization */}
                  {trainStations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-1 overflow-x-auto pb-1">
                        {trainStations.map((s, i) => (
                          <React.Fragment key={s.id}>
                            <div className="flex flex-col items-center flex-shrink-0">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                s.is_source || s.is_destination ? 'bg-green-600 text-white' :
                                s.is_watering_station && s.is_maintenance_station ? 'bg-purple-600 text-white' :
                                s.is_watering_station ? 'bg-blue-500 text-white' :
                                s.is_maintenance_station ? 'bg-orange-500 text-white' :
                                'bg-gray-200 text-gray-600'
                              }`}>
                                {s.is_watering_station ? '💧' : s.is_maintenance_station ? '🔧' : s.station_code[0]}
                              </div>
                              <span className="text-[9px] text-gray-500 mt-0.5 whitespace-nowrap">{s.station_code}</span>
                              {s.departure_time && <span className="text-[8px] text-gray-400">{s.departure_time}</span>}
                            </div>
                            {i < trainStations.length - 1 && (
                              <div className="w-6 h-0.5 bg-gray-200 flex-shrink-0" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                        <span className="flex items-center gap-1">🟢 Source/Dest</span>
                        <span className="flex items-center gap-1">💧 Watering</span>
                        <span className="flex items-center gap-1">🔧 Maintenance</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Train Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); resetForm() }} title="Add New Train" size="lg">
        <form onSubmit={handleAddTrain} className="space-y-5">
          {/* Step 1: Basic Info */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-3 text-sm">Basic Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Train Number * (5 digits)" placeholder="e.g. 12565" value={form.train_no} onChange={e => setForm(p => ({ ...p, train_no: e.target.value }))} required />
              <Input label="Train Name *" placeholder="e.g. Bihar Sampark Kranti Express" value={form.train_name} onChange={e => setForm(p => ({ ...p, train_name: e.target.value }))} required />
              <Input label="Source Station/Depot *" placeholder="e.g. DBG" value={form.from_station} onChange={e => setForm(p => ({ ...p, from_station: e.target.value }))} />
              <Input label="Destination Station/Depot *" placeholder="e.g. NDLS" value={form.to_station} onChange={e => setForm(p => ({ ...p, to_station: e.target.value }))} />
              <Input label="Zone" placeholder="e.g. ECR" value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} />
              <Input label="Division" placeholder="e.g. SPJ" value={form.division} onChange={e => setForm(p => ({ ...p, division: e.target.value }))} />
              <Input label="Home Depot" placeholder="e.g. DBG" value={form.depot} onChange={e => setForm(p => ({ ...p, depot: e.target.value }))} />
              <Select label="Frequency" value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))} options={FREQUENCIES.map(f => ({ value: f, label: f }))} />
              <Input label="Departure Time" type="time" value={form.departure_time} onChange={e => setForm(p => ({ ...p, departure_time: e.target.value }))} />
              <Input label="Arrival Time" type="time" value={form.arrival_time} onChange={e => setForm(p => ({ ...p, arrival_time: e.target.value }))} />
              <Input label="Journey Duration (days)" type="number" min="1" max="7" value={form.journey_duration_days} onChange={e => setForm(p => ({ ...p, journey_duration_days: parseInt(e.target.value) }))} />
            </div>
          </div>

          {/* Operating Days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Operating Days</label>
            <div className="flex gap-2">
              {DAYS.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    form.operating_days.includes(day)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Flags */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="rounded" />
              <span className="text-sm text-gray-700">Train is active and operational</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_priority} onChange={e => setForm(p => ({ ...p, is_priority: e.target.checked }))} className="rounded" />
              <span className="text-sm text-amber-600">⭐ Priority Train</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => { setShowAddModal(false); resetForm() }}>Cancel</Button>
            <Button variant="success" type="submit" disabled={saving} icon={Plus}>{saving ? 'Saving...' : 'Add Train'}</Button>
          </div>
        </form>
      </Modal>

      {/* Manage Stations Modal */}
      <Modal isOpen={showStationsModal} onClose={() => setShowStationsModal(false)} title={`Manage Stations — Train ${selectedTrain?.train_no}`} size="xl">
        {selectedTrain && (
          <div className="space-y-5">
            {/* Existing stations */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-3 text-sm">Route Stations ({getTrainStations(selectedTrain.id).length})</h4>
              {getTrainStations(selectedTrain.id).length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6 bg-gray-50 rounded-lg">No stations added yet</p>
              ) : (
                <div className="overflow-x-auto max-h-64">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {['Seq', 'Code', 'Station Name', 'Arrival', 'Departure', 'Stop', 'Water', 'Maint', ''].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {getTrainStations(selectedTrain.id).map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs text-gray-600">{s.sequence_no}</td>
                          <td className="px-3 py-2 text-xs font-bold text-gray-800">{s.station_code}</td>
                          <td className="px-3 py-2 text-xs text-gray-700">{s.station_name}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{s.arrival_time || '-'}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{s.departure_time || '-'}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{s.stoppage_minutes}m</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={async () => {
                                const { error } = await supabase.from('train_stations').update({ is_watering_station: !s.is_watering_station }).eq('id', s.id)
                                if (!error) { showToast('Updated!', 'success'); fetchTrains() }
                              }}
                              className={`text-lg transition-opacity ${s.is_watering_station ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                              title="Toggle Watering Station"
                            >💧</button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={async () => {
                                const { error } = await supabase.from('train_stations').update({ is_maintenance_station: !s.is_maintenance_station }).eq('id', s.id)
                                if (!error) { showToast('Updated!', 'success'); fetchTrains() }
                              }}
                              className={`text-lg transition-opacity ${s.is_maintenance_station ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                              title="Toggle Maintenance Station"
                            >🔧</button>
                          </td>
                          <td className="px-3 py-2">
                            <button onClick={() => handleDeleteStation(s.id, s.station_name)} className="text-red-400 hover:text-red-600">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Excel Upload */}
            <div className="border-t border-gray-100 pt-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-800 text-sm">Upload Stations from Excel</h4>
                <label className="cursor-pointer bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Excel
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={e => handleStationExcelUpload(e, selectedTrain.id)}
                  />
                </label>
              </div>
              <p className="text-xs text-gray-400">Upload Train_Status.xlsx format — existing stations will be replaced</p>
            </div>

            {/* Add station form */}
            <div className="border-t border-gray-100 pt-4">
              <h4 className="font-semibold text-gray-800 mb-3 text-sm">Add Station Manually</h4>
              <form onSubmit={handleAddStation} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <Input label="Seq No" type="number" placeholder="1" value={stationForm.sequence_no} onChange={e => setStationForm(p => ({ ...p, sequence_no: e.target.value }))} />
                  <Input label="Station Code *" placeholder="e.g. DBG" value={stationForm.station_code} onChange={e => setStationForm(p => ({ ...p, station_code: e.target.value.toUpperCase() }))} required />
                  <Input label="Station Name *" placeholder="e.g. Darbhanga" value={stationForm.station_name} onChange={e => setStationForm(p => ({ ...p, station_name: e.target.value }))} required />
                  <Input label="Arrival Time" type="time" value={stationForm.arrival_time} onChange={e => setStationForm(p => ({ ...p, arrival_time: e.target.value }))} />
                  <Input label="Departure Time" type="time" value={stationForm.departure_time} onChange={e => setStationForm(p => ({ ...p, departure_time: e.target.value }))} />
                  <Input label="Stoppage (mins)" type="number" min="0" value={stationForm.stoppage_minutes} onChange={e => setStationForm(p => ({ ...p, stoppage_minutes: e.target.value }))} />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={stationForm.is_source} onChange={e => setStationForm(p => ({ ...p, is_source: e.target.checked }))} className="rounded" />
                    <span className="text-sm text-gray-700">Source Station</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={stationForm.is_destination} onChange={e => setStationForm(p => ({ ...p, is_destination: e.target.checked }))} className="rounded" />
                    <span className="text-sm text-gray-700">Destination Station</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={stationForm.is_watering_station} onChange={e => setStationForm(p => ({ ...p, is_watering_station: e.target.checked }))} className="rounded" />
                    <span className="text-sm text-blue-600">💧 Watering Station</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={stationForm.is_maintenance_station} onChange={e => setStationForm(p => ({ ...p, is_maintenance_station: e.target.checked }))} className="rounded" />
                    <span className="text-sm text-orange-600">🔧 Maintenance Station</span>
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button variant="primary" type="submit" icon={Plus}>Add Station</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
