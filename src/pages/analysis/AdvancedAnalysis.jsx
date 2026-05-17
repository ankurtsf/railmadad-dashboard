import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Download, Filter, RefreshCw, TrendingUp, Clock, Droplets, Train, BarChart2, Calendar } from 'lucide-react'
import { LoadingSpinner, Select, Input, Button, TabBar, Card } from '../../components/ui/index'
import * as XLSX from 'xlsx'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#f43f5e', '#6366f1', '#ec4899', '#14b8a6']

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart2 },
  { id: 'cleaning', label: 'Cleaning Analysis', icon: TrendingUp },
  { id: 'bedroll', label: 'Bedroll Analysis', icon: TrendingUp },
  { id: 'maintenance', label: 'Maintenance Analysis', icon: TrendingUp },
  { id: 'watering', label: 'Watering Analysis', icon: Droplets },
  { id: 'subtype', label: 'Sub-type Analysis', icon: Filter },
  { id: 'trainwise', label: 'Train-wise Analysis', icon: Train },
  { id: 'timemapping', label: 'Time Mapping', icon: Clock },
  { id: 'comparative', label: 'Comparative Analysis', icon: Calendar },
]

// Multi-select dropdown component
function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef(null)

  // Close on outside click
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isAll = value.length === 0
  const toggle = (opt) => {
    if (opt === '__all__') { onChange([]); return }
    const next = value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]
    onChange(next)
  }

  const displayText = isAll ? 'All' : value.length === 1 ? value[0] : `${value.length} selected`

  return (
    <div className="relative" ref={ref}>
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full border rounded-lg px-3 py-2 text-xs text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white transition-colors
          ${!isAll ? 'border-purple-400 bg-purple-50' : 'border-gray-300'}`}
      >
        <span className={`truncate ${!isAll ? 'text-purple-700 font-medium' : 'text-gray-600'}`}>{displayText}</span>
        <span className="text-gray-400 ml-1">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          <div
            onClick={() => toggle('__all__')}
            className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100
              ${isAll ? 'text-purple-700 font-semibold bg-purple-50' : 'text-gray-600'}`}
          >
            <input type="checkbox" checked={isAll} readOnly className="rounded" />
            All
          </div>
          {options.map(opt => (
            <div
              key={opt}
              onClick={() => toggle(opt)}
              className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 flex items-center gap-2
                ${value.includes(opt) ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-600'}`}
            >
              <input type="checkbox" checked={value.includes(opt)} readOnly className="rounded" />
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdvancedAnalysis() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    dateFrom: '', dateTo: '',
    depot: [], zone: [], ownZone: [],
    division: [], ownDivision: [],
    train: [], status: [],
    mode: [], category: [], subtype: [],
    rating: [], sla: [],
    nextStation: [], coachType: [],
    forwarded: [], coachOwningRailway: []
  })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('complaints').select('*').order('created_on', { ascending: false })
      setComplaints(data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const clearFilters = () => setFilters({
    dateFrom: '', dateTo: '',
    depot: [], zone: [], ownZone: [],
    division: [], ownDivision: [],
    train: [], status: [],
    mode: [], category: [], subtype: [],
    rating: [], sla: [],
    nextStation: [], coachType: [],
    forwarded: [], coachOwningRailway: []
  })

  const setFilter = (key, val) => setFilters(p => ({ ...p, [key]: val }))

  // Active filter count
  const activeFilterCount = Object.entries(filters).filter(([k, v]) =>
    Array.isArray(v) ? v.length > 0 : v !== ''
  ).length

  // Apply filters
  const filtered = useMemo(() => {
    return complaints.filter(c => {
      if (filters.dateFrom && c.created_on && new Date(c.created_on) < new Date(filters.dateFrom)) return false
      if (filters.dateTo && c.created_on && new Date(c.created_on) > new Date(filters.dateTo + 'T23:59:59')) return false
      if (filters.depot.length > 0 && !filters.depot.includes(c.primary_depot)) return false
      if (filters.zone.length > 0 && !filters.zone.includes(c.zone_code)) return false
      if (filters.ownZone.length > 0 && !filters.ownZone.includes(c.own_zone_code)) return false
      if (filters.division.length > 0 && !filters.division.includes(c.div_code)) return false
      if (filters.ownDivision.length > 0 && !filters.ownDivision.includes(c.own_div_code)) return false
      if (filters.train.length > 0 && !filters.train.includes(c.train_no)) return false
      if (filters.status.length > 0 && !filters.status.includes(c.status)) return false
      if (filters.mode.length > 0 && !filters.mode.includes(c.complaint_mode)) return false
      if (filters.category.length > 0 && !filters.category.includes(c.comp_type_name)) return false
      if (filters.subtype.length > 0 && !filters.subtype.includes(c.sub_type_name)) return false
      if (filters.rating.length > 0 && !filters.rating.includes(c.rating)) return false
      if (filters.sla.length > 0 && !filters.sla.includes(c.sla)) return false
      if (filters.nextStation.length > 0 && !filters.nextStation.includes(c.next_station)) return false
      if (filters.coachType.length > 0 && !filters.coachType.includes(c.coach_type)) return false
      if (filters.forwarded.length > 0) {
        if (filters.forwarded.includes('Yes') && filters.forwarded.includes('No')) {} // both = no filter
        else if (filters.forwarded.includes('Yes') && (!c.forwarded || c.forwarded === 0)) return false
        else if (filters.forwarded.includes('No') && c.forwarded > 0) return false
      }
      if (filters.coachOwningRailway.length > 0 && !filters.coachOwningRailway.includes(c.coach_owning_railway)) return false
      return true
    })
  }, [complaints, filters])

  // Filter options from data
  const opts = useMemo(() => ({
    depots: [...new Set(complaints.map(c => c.primary_depot).filter(Boolean))],
    zones: [...new Set(complaints.map(c => c.zone_code).filter(Boolean))],
    ownZones: [...new Set(complaints.map(c => c.own_zone_code).filter(Boolean))],
    divisions: [...new Set(complaints.map(c => c.div_code).filter(Boolean))],
    ownDivisions: [...new Set(complaints.map(c => c.own_div_code).filter(Boolean))],
    trains: [...new Set(complaints.map(c => c.train_no).filter(Boolean))],
    statuses: [...new Set(complaints.map(c => c.status).filter(Boolean))],
    modes: [...new Set(complaints.map(c => c.complaint_mode).filter(Boolean))],
    categories: [...new Set(complaints.map(c => c.comp_type_name).filter(Boolean))],
    subtypes: [...new Set(complaints.map(c => c.sub_type_name).filter(Boolean))],
    ratings: [...new Set(complaints.map(c => c.rating).filter(Boolean))],
    slas: [...new Set(complaints.map(c => c.sla).filter(Boolean))],
    nextStations: [...new Set(complaints.map(c => c.next_station).filter(Boolean))],
    coachTypes: [...new Set(complaints.map(c => c.coach_type).filter(Boolean))],
    coachOwningRailways: [...new Set(complaints.map(c => c.coach_owning_railway).filter(Boolean))],
  }), [complaints])

  // Overview aggregations
  const overview = useMemo(() => {
    const byCategory = {}
    const byZone = {}
    const byMode = {}
    const byMonth = {}

    filtered.forEach(c => {
      // By category
      const cat = c.comp_type_name || 'Unknown'
      byCategory[cat] = (byCategory[cat] || 0) + 1

      // By zone
      const zone = c.zone_code || 'Unknown'
      byZone[zone] = (byZone[zone] || 0) + 1

      // By mode
      const mode = c.complaint_mode || 'Unknown'
      byMode[mode] = (byMode[mode] || 0) + 1

      // By month
      if (c.created_on) {
        const month = new Date(c.created_on).toISOString().substring(0, 7)
        byMonth[month] = (byMonth[month] || 0) + 1
      }
    })

    return {
      byCategory: Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      byZone: Object.entries(byZone).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      byMode: Object.entries(byMode).map(([name, value]) => ({ name, value })),
      byMonth: Object.entries(byMonth).map(([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month)),
    }
  }, [filtered])

  // Category-specific analysis helper
  const getCategoryData = (keyword) => {
    const catComplaints = filtered.filter(c => String(c.comp_type_name).toLowerCase().includes(keyword))

    const bySubType = {}
    const byTrain = {}
    const byDepot = {}
    const byHour = {}

    catComplaints.forEach(c => {
      const sub = c.sub_type_name || 'Others'
      bySubType[sub] = (bySubType[sub] || 0) + 1

      const train = c.train_no || 'Unknown'
      byTrain[train] = (byTrain[train] || 0) + 1

      const depot = c.primary_depot || 'Unknown'
      byDepot[depot] = (byDepot[depot] || 0) + 1

      if (c.created_on) {
        const h = new Date(c.created_on).getHours()
        byHour[h] = (byHour[h] || 0) + 1
      }
    })

    const total = catComplaints.length
    const resolved = catComplaints.filter(c => c.status === 'Closed').length
    const open = total - resolved

    return {
      total, resolved, open,
      bySubType: Object.entries(bySubType).map(([name, value]) => ({ name, value, pct: total > 0 ? Math.round(value / total * 100) : 0 })).sort((a, b) => b.value - a.value),
      byTrain: Object.entries(byTrain).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
      byDepot: Object.entries(byDepot).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      byHour: Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, '0')}:00`, value: byHour[h] || 0 })),
      complaints: catComplaints
    }
  }

  // Train-wise analysis
  const trainwise = useMemo(() => {
    const map = {}
    filtered.forEach(c => {
      const train = c.train_no || 'Unknown'
      if (!map[train]) map[train] = { train, total: 0, resolved: 0, open: 0, categories: {} }
      map[train].total++
      if (c.status === 'Closed') map[train].resolved++
      else map[train].open++
      const cat = c.comp_type_name || 'Unknown'
      map[train].categories[cat] = (map[train].categories[cat] || 0) + 1
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filtered])

  // Time mapping
  const timeMapping = useMemo(() => {
    const hourMap = {}
    const shiftMap = { '00-04': 0, '04-08': 0, '08-12': 0, '12-16': 0, '16-20': 0, '20-24': 0 }

    filtered.forEach(c => {
      if (!c.created_on) return
      const h = new Date(c.created_on).getHours()
      hourMap[h] = (hourMap[h] || 0) + 1

      const shift = Math.floor(h / 4) * 4
      const key = `${String(shift).padStart(2, '0')}-${String(shift + 4).padStart(2, '0')}`
      if (key in shiftMap) shiftMap[key]++
    })

    const peakHours = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      value: hourMap[h] || 0,
      pct: filtered.length > 0 ? Math.round((hourMap[h] || 0) / filtered.length * 100) : 0
    })).sort((a, b) => b.value - a.value)

    const shifts = Object.entries(shiftMap).map(([shift, value]) => ({
      shift, value,
      pct: filtered.length > 0 ? Math.round(value / filtered.length * 100) : 0
    }))

    return { peakHours, shifts }
  }, [filtered])

  // Comparative analysis
  const comparative = useMemo(() => {
    const months = [...new Set(filtered.map(c => c.created_on ? new Date(c.created_on).toISOString().substring(0, 7) : null).filter(Boolean))].sort()
    const categories = [...new Set(filtered.map(c => c.comp_type_name).filter(Boolean))]

    return months.map(month => {
      const row = { month, total: 0 }
      const monthComplaints = filtered.filter(c => c.created_on && new Date(c.created_on).toISOString().substring(0, 7) === month)
      row.total = monthComplaints.length
      categories.forEach(cat => {
        row[cat] = monthComplaints.filter(c => c.comp_type_name === cat).length
      })
      return row
    })
  }, [filtered])

  const handleExport = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Analysis')
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const CategoryAnalysis = ({ keyword, title, color }) => {
    const data = getCategoryData(keyword)
    const [subTab, setSubTab] = useState('category')

    return (
      <div className="space-y-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: `Total ${title}`, value: data.total, color: 'text-blue-600 bg-blue-50' },
            { label: 'Resolved', value: data.resolved, color: 'text-green-600 bg-green-50' },
            { label: 'Open', value: data.open, color: 'text-amber-600 bg-amber-50' },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className={`p-3 rounded-lg ${card.color}`}>
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                <p className="text-xs text-gray-500">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Sub-type breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">Category-wise Breakdown</h3>
              <Button variant="ghost" icon={Download} size="sm" onClick={() => handleExport(data.bySubType, `${keyword}_subtype`)}>Export</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    {['Category', 'Total', 'Affected Trains', 'Percentage'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.bySubType.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{row.name}</td>
                      <td className="px-4 py-3">
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">{row.value}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Set(data.complaints.filter(c => c.sub_type_name === row.name).map(c => c.train_no)).size}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${row.pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 w-10">{row.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Train-wise breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Top Trains — {title}</h3>
            {data.byTrain.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.byTrain} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Complaints" fill={color} radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Peak Hours */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Peak Hours for {title}</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {data.byHour.filter(h => h.value > 0).slice(0, 5).map((h, i) => (
              <div key={i} className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">#{i + 1} Peak</p>
                <p className="text-lg font-bold text-gray-800">{h.hour}</p>
                <p className="text-xs text-orange-600">{h.value} complaints</p>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.byHour.filter(h => h.value > 0)} margin={{ bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" dy={10} axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" name="Complaints" fill={color} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  if (loading) return <LoadingSpinner text="Loading analysis data..." />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-purple-700 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Advanced Analysis</h1>
            <p className="text-purple-200 text-sm mt-0.5">Comprehensive insights and train-wise complaint analysis</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
              <p className="text-xl font-bold">{filtered.length}</p>
              <p className="text-purple-200 text-xs">Records</p>
            </div>
            <Button icon={RefreshCw} variant="secondary" onClick={fetchData}>Refresh</Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700"
          >
            <Filter className="w-4 h-4 text-purple-500" />
            Filters & Search
            {activeFilterCount > 0 && (
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">{activeFilterCount} active</span>
            )}
            <span className="text-gray-400 text-xs">{showFilters ? '▲' : '▼'}</span>
          </button>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-purple-600 hover:text-purple-800 font-medium">Clear All</button>
          )}
        </div>

        {/* Always visible */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <Input label="Start Date" type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} />
          <Input label="End Date" type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} />
          <MultiSelect label="Train No" options={opts.trains} value={filters.train} onChange={v => setFilter('train', v)} />
          <MultiSelect label="Category" options={opts.categories} value={filters.category} onChange={v => setFilter('category', v)} />
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-3 border-t border-gray-100">
            <MultiSelect label="Status" options={opts.statuses} value={filters.status} onChange={v => setFilter('status', v)} />
            <MultiSelect label="Complaint Mode" options={['T','H','A','R','S']} value={filters.mode} onChange={v => setFilter('mode', v)} />
            <MultiSelect label="Sub-type" options={opts.subtypes} value={filters.subtype} onChange={v => setFilter('subtype', v)} />
            <MultiSelect label="Zone" options={opts.zones} value={filters.zone} onChange={v => setFilter('zone', v)} />
            <MultiSelect label="Own Zone" options={opts.ownZones} value={filters.ownZone} onChange={v => setFilter('ownZone', v)} />
            <MultiSelect label="Division" options={opts.divisions} value={filters.division} onChange={v => setFilter('division', v)} />
            <MultiSelect label="Own Division" options={opts.ownDivisions} value={filters.ownDivision} onChange={v => setFilter('ownDivision', v)} />
            <MultiSelect label="Depot" options={opts.depots} value={filters.depot} onChange={v => setFilter('depot', v)} />
            <MultiSelect label="Rating" options={opts.ratings} value={filters.rating} onChange={v => setFilter('rating', v)} />
            <MultiSelect label="SLA" options={opts.slas} value={filters.sla} onChange={v => setFilter('sla', v)} />
            <MultiSelect label="Next Station" options={opts.nextStations} value={filters.nextStation} onChange={v => setFilter('nextStation', v)} />
            <MultiSelect label="Coach Type" options={opts.coachTypes} value={filters.coachType} onChange={v => setFilter('coachType', v)} />
            <MultiSelect label="Forwarded" options={['Yes','No']} value={filters.forwarded} onChange={v => setFilter('forwarded', v)} />
            <MultiSelect label="Coach Owning Railway" options={opts.coachOwningRailways} value={filters.coachOwningRailway} onChange={v => setFilter('coachOwningRailway', v)} />
          </div>
        )}

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
            {Object.entries(filters).map(([key, val]) => {
              if (Array.isArray(val) && val.length > 0) {
                return val.map(v => (
                  <span key={`${key}-${v}`} className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    {v}
                    <button onClick={() => setFilter(key, filters[key].filter(f => f !== v))} className="hover:text-purple-900">×</button>
                  </span>
                ))
              }
              if (val && !Array.isArray(val)) {
                return (
                  <span key={key} className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    {key}: {val}
                    <button onClick={() => setFilter(key, '')} className="hover:text-purple-900">×</button>
                  </span>
                )
              }
              return null
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 pt-4 border-b border-gray-100">
          <div className="flex gap-1 overflow-x-auto pb-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5
                  ${activeTab === tab.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Category Distribution */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-800 text-sm mb-4">Complaints by Category</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={overview.byCategory} layout="vertical" margin={{ left: 80, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" name="Complaints" radius={[0, 4, 4, 0]} barSize={20}>
                        {overview.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Zone Distribution */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-800 text-sm mb-4">Complaints by Zone</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={overview.byZone} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {overview.byZone.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Month on Month */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 text-sm">Month on Month Trend</h3>
                  <Button variant="ghost" icon={Download} size="sm" onClick={() => handleExport(overview.byMonth, 'mom_trend')}>Export</Button>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={overview.byMonth} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" dy={10} axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Complaints" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Complaint Mode */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 text-sm mb-4">Complaint Mode Distribution</h3>
                <div className="grid grid-cols-5 gap-3">
                  {overview.byMode.map((m, i) => {
                    const modeNames = { T: 'Train', H: 'Helpline', A: 'App', R: 'Railmadad App', S: 'Social Media' }
                    return (
                      <div key={i} className="bg-white rounded-lg p-4 text-center border border-gray-200">
                        <p className="text-2xl font-bold text-gray-800">{m.value}</p>
                        <p className="text-xs text-gray-500 mt-1">{modeNames[m.name] || m.name}</p>
                        <p className="text-xs font-medium text-blue-600 mt-1">
                          {filtered.length > 0 ? Math.round(m.value / filtered.length * 100) : 0}%
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cleaning' && <CategoryAnalysis keyword="clean" title="Cleaning Complaints" color="#3b82f6" />}
          {activeTab === 'bedroll' && <CategoryAnalysis keyword="bed" title="Bedroll Complaints" color="#8b5cf6" />}
          {activeTab === 'maintenance' && <CategoryAnalysis keyword="maintenance" title="Maintenance Complaints" color="#f59e0b" />}
          {activeTab === 'watering' && (() => {
            // Water complaints only
            const waterComplaints = filtered.filter(c =>
              String(c.comp_type_name).toLowerCase().includes('water')
            )
            const total = waterComplaints.length
            const open = waterComplaints.filter(c => c.status !== 'Closed').length
            const resolved = total - open

            // 1. Watering Station Performance (prev_watering_station)
            const stationMap = {}
            waterComplaints.forEach(c => {
              const stn = c.prev_watering_station || 'Unknown'
              if (!stationMap[stn]) stationMap[stn] = { station: stn, complaints: 0, trains: new Set(), zones: new Set() }
              stationMap[stn].complaints++
              if (c.train_no) stationMap[stn].trains.add(c.train_no)
              if (c.zone_code) stationMap[stn].zones.add(c.zone_code)
            })
            const stationPerformance = Object.values(stationMap)
              .map(s => ({
                ...s,
                trains: s.trains.size,
                zones: s.zones.size,
                performance: s.complaints <= 2 ? 'Good' : s.complaints <= 5 ? 'Average' : 'Poor'
              }))
              .sort((a, b) => b.complaints - a.complaints)

            // 2. Train-wise watering problems
            const trainWaterMap = {}
            waterComplaints.forEach(c => {
              const train = c.train_no || 'Unknown'
              if (!trainWaterMap[train]) trainWaterMap[train] = { train, total: 0, stations: {} }
              trainWaterMap[train].total++
              const stn = c.prev_watering_station || 'Unknown'
              trainWaterMap[train].stations[stn] = (trainWaterMap[train].stations[stn] || 0) + 1
            })
            const trainWaterData = Object.values(trainWaterMap)
              .sort((a, b) => b.total - a.total)
              .slice(0, 10)
              .map(t => ({ name: t.train, value: t.total }))

            // 3. Time-based water complaints
            const hourMap = {}
            waterComplaints.forEach(c => {
              if (!c.created_on) return
              const h = new Date(c.created_on).getHours()
              hourMap[h] = (hourMap[h] || 0) + 1
            })
            const timeData = Array.from({ length: 24 }, (_, h) => ({
              hour: `${String(h).padStart(2, '0')}:00`,
              complaints: hourMap[h] || 0
            })).filter(h => h.complaints > 0)

            // 4. Zone-wise watering issues
            const zoneMap = {}
            waterComplaints.forEach(c => {
              const zone = c.zone_code || 'Unknown'
              zoneMap[zone] = (zoneMap[zone] || 0) + 1
            })
            const zoneData = Object.entries(zoneMap)
              .map(([name, value]) => ({ name, value }))
              .sort((a, b) => b.value - a.value)

            return (
              <div className="space-y-5">
                {/* KPI Cards */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Total Water Complaints', value: total, color: 'text-blue-600 bg-blue-50' },
                    { label: 'Open Issues', value: open, color: 'text-amber-600 bg-amber-50' },
                    { label: 'Watering Stations Flagged', value: stationPerformance.filter(s => s.station !== 'Unknown').length, color: 'text-red-600 bg-red-50' },
                  ].map((card, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${card.color}`}><Droplets className="w-5 h-5" /></div>
                      <div>
                        <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                        <p className="text-xs text-gray-500">{card.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 1. Watering Station Performance Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">Watering Station Performance</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Based on Previous Watering Station in water complaints — high complaints = station failed to fill water properly</p>
                    </div>
                    <Button variant="ghost" icon={Download} size="sm" onClick={() => handleExport(stationPerformance.map(s => ({ Station: s.station, Complaints: s.complaints, 'Affected Trains': s.trains, 'Affected Zones': s.zones, Performance: s.performance })), 'watering_station_performance')}>Export</Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Previous Watering Station', 'Water Complaints', 'Affected Trains', 'Affected Zones', 'Performance', 'Visual'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {stationPerformance.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-bold text-gray-800">
                              <span className="flex items-center gap-1.5">
                                <Droplets className="w-3.5 h-3.5 text-blue-400" />
                                {row.station}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">{row.complaints}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{row.trains}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{row.zones}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                row.performance === 'Good' ? 'bg-green-100 text-green-700' :
                                row.performance === 'Average' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>{row.performance}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="w-32 bg-gray-100 rounded-full h-2">
                                <div className="h-2 rounded-full" style={{
                                  width: `${Math.min(100, (row.complaints / (stationPerformance[0]?.complaints || 1)) * 100)}%`,
                                  background: row.performance === 'Poor' ? '#ef4444' : row.performance === 'Average' ? '#f59e0b' : '#10b981'
                                }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* 2. Train-wise Water Problems */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800 text-sm">Top Trains — Water Complaints</h3>
                      <Button variant="ghost" icon={Download} size="sm" onClick={() => handleExport(trainWaterData, 'train_water')}>Export</Button>
                    </div>
                    {trainWaterData.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">No data</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={trainWaterData} layout="vertical" margin={{ left: 40, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="value" name="Water Complaints" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* 3. Zone-wise Watering Issues */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800 text-sm">Zone-wise Water Complaints</h3>
                      <Button variant="ghost" icon={Download} size="sm" onClick={() => handleExport(zoneData, 'zone_water')}>Export</Button>
                    </div>
                    {zoneData.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">No data</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie data={zoneData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {zoneData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* 4. Time-based Analysis */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">Time-based Water Complaint Distribution</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Identifies when water runs out — helps schedule watering frequency</p>
                    </div>
                    <Button variant="ghost" icon={Download} size="sm" onClick={() => handleExport(timeData, 'water_time')}>Export</Button>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={timeData} margin={{ bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" dy={10} axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="complaints" name="Water Complaints" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Train-wise Watering Station Breakdown Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">Train-wise × Watering Station Breakdown</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Which train had water complaint after which watering station</p>
                    </div>
                    <Button variant="ghost" icon={Download} size="sm" onClick={() => handleExport(
                      Object.values(trainWaterMap).map(t => ({ Train: t.train, Total: t.total, ...t.stations })),
                      'train_watering_breakdown'
                    )}>Export</Button>
                  </div>
                  <div className="overflow-x-auto max-h-80">
                    <table className="min-w-full border-collapse">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">Train</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase border-b border-gray-200">Total</th>
                          {[...new Set(waterComplaints.map(c => c.prev_watering_station).filter(Boolean))].map(stn => (
                            <th key={stn} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 whitespace-nowrap">{stn}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {Object.values(trainWaterMap).sort((a, b) => b.total - a.total).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-bold text-gray-800">{row.train}</td>
                            <td className="px-4 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{row.total}</span></td>
                            {[...new Set(waterComplaints.map(c => c.prev_watering_station).filter(Boolean))].map(stn => (
                              <td key={stn} className="px-4 py-3 text-sm text-gray-600">{row.stations[stn] || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          })()}

          {activeTab === 'subtype' && (() => {
            // Build sub-type data
            const subtypeMap = {}
            filtered.forEach(c => {
              const cat = c.comp_type_name || 'Unknown'
              const sub = c.sub_type_name || 'Others'
              const key = `${cat}|||${sub}`
              if (!subtypeMap[key]) subtypeMap[key] = {
                category: cat, subtype: sub,
                total: 0, resolved: 0, open: 0, trains: new Set(), months: {}
              }
              subtypeMap[key].total++
              if (c.status === 'Closed') subtypeMap[key].resolved++
              else subtypeMap[key].open++
              if (c.train_no) subtypeMap[key].trains.add(c.train_no)
              if (c.created_on) {
                const month = new Date(c.created_on).toISOString().substring(0, 7)
                subtypeMap[key].months[month] = (subtypeMap[key].months[month] || 0) + 1
              }
            })

            const subtypeData = Object.values(subtypeMap).map(s => ({
              ...s,
              trains: s.trains.size,
              resolutionRate: s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0
            })).sort((a, b) => b.total - a.total)

            // Category-wise sub-type bar chart data
            const categories = [...new Set(filtered.map(c => c.comp_type_name).filter(Boolean))]
            const subtypes = [...new Set(filtered.map(c => c.sub_type_name).filter(Boolean))]

            const categorySubtypeData = categories.map(cat => {
              const row = { category: cat.length > 15 ? cat.substring(0, 15) + '...' : cat }
              subtypes.forEach(sub => {
                row[sub] = filtered.filter(c => c.comp_type_name === cat && c.sub_type_name === sub).length
              })
              return row
            })

            // Train-wise sub-type data
            const trainSubtypeMap = {}
            filtered.forEach(c => {
              const train = c.train_no || 'Unknown'
              if (!trainSubtypeMap[train]) trainSubtypeMap[train] = { train, total: 0 }
              trainSubtypeMap[train].total++
              const sub = c.sub_type_name || 'Others'
              trainSubtypeMap[train][sub] = (trainSubtypeMap[train][sub] || 0) + 1
            })
            const trainSubtypeData = Object.values(trainSubtypeMap).sort((a, b) => b.total - a.total)

            // Month-on-Month sub-type trend
            const months = [...new Set(filtered.map(c => c.created_on ? new Date(c.created_on).toISOString().substring(0, 7) : null).filter(Boolean))].sort()
            const topSubtypes = subtypeData.slice(0, 5).map(s => s.subtype)
            const momSubtypeData = months.map(month => {
              const row = { month }
              topSubtypes.forEach(sub => {
                row[sub] = filtered.filter(c =>
                  c.sub_type_name === sub &&
                  c.created_on &&
                  new Date(c.created_on).toISOString().substring(0, 7) === month
                ).length
              })
              return row
            })

            return (
              <div className="space-y-5">
                {/* KPI Cards */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Total Sub-types', value: new Set(filtered.map(c => c.sub_type_name).filter(Boolean)).size, color: 'text-blue-600 bg-blue-50' },
                    { label: 'Most Common Sub-type', value: subtypeData[0]?.subtype?.substring(0, 20) || 'N/A', color: 'text-amber-600 bg-amber-50' },
                    { label: 'Highest Volume', value: subtypeData[0]?.total || 0, color: 'text-red-600 bg-red-50' },
                  ].map((card, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${card.color}`}><Filter className="w-5 h-5" /></div>
                      <div>
                        <p className="text-xl font-bold text-gray-800 truncate">{card.value}</p>
                        <p className="text-xs text-gray-500">{card.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 1. Sub-type wise complaint count table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 text-sm">Sub-type wise Complaint Breakdown</h3>
                    <Button variant="ghost" icon={Download} size="sm"
                      onClick={() => handleExport(subtypeData.map(s => ({
                        Category: s.category, 'Sub-type': s.subtype,
                        Total: s.total, Resolved: s.resolved, Open: s.open,
                        'Resolution Rate': `${s.resolutionRate}%`, 'Affected Trains': s.trains
                      })), 'subtype_analysis')}>Export</Button>
                  </div>
                  <div className="overflow-x-auto max-h-80">
                    <table className="min-w-full border-collapse">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {['Category', 'Sub-type', 'Total', 'Resolved', 'Open', 'Resolution Rate', 'Affected Trains', 'Visual'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {subtypeData.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-xs text-gray-500">{row.category}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-800">{row.subtype}</td>
                            <td className="px-4 py-3">
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{row.total}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">{row.resolved}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">{row.open}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${row.resolutionRate}%` }} />
                                </div>
                                <span className="text-xs text-gray-600">{row.resolutionRate}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{row.trains}</td>
                            <td className="px-4 py-3">
                              <div className="w-24 bg-gray-100 rounded-full h-2">
                                <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.round((row.total / (subtypeData[0]?.total || 1)) * 100)}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Category-wise Sub-type Bar Chart */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-800 text-sm mb-4">Category-wise Sub-type Distribution</h3>
                  {categorySubtypeData.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">No data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={categorySubtypeData} margin={{ bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" dy={10} axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        {subtypes.slice(0, 8).map((sub, i) => (
                          <Bar key={sub} dataKey={sub} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === subtypes.slice(0, 8).length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* 3. Month-on-Month Sub-type Trend */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">Month-on-Month Sub-type Trend</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Top 5 sub-types by volume</p>
                    </div>
                    <Button variant="ghost" icon={Download} size="sm" onClick={() => handleExport(momSubtypeData, 'subtype_mom')}>Export</Button>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={momSubtypeData} margin={{ bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" dy={10} axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      {topSubtypes.map((sub, i) => (
                        <Line key={sub} type="monotone" dataKey={sub} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 4. Train-wise Sub-type Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 text-sm">Train-wise Sub-type Breakdown</h3>
                    <Button variant="ghost" icon={Download} size="sm"
                      onClick={() => handleExport(trainSubtypeData.map(t => ({ Train: t.train, Total: t.total, ...t })), 'train_subtype')}>Export</Button>
                  </div>
                  <div className="overflow-x-auto max-h-80">
                    <table className="min-w-full border-collapse">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">Train</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase border-b border-gray-200">Total</th>
                          {subtypes.slice(0, 8).map(sub => (
                            <th key={sub} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 whitespace-nowrap max-w-[100px] truncate">{sub}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {trainSubtypeData.slice(0, 20).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-bold text-gray-800">{row.train}</td>
                            <td className="px-4 py-3">
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{row.total}</span>
                            </td>
                            {subtypes.slice(0, 8).map(sub => (
                              <td key={sub} className="px-4 py-3 text-sm text-gray-600">{row[sub] || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          })()}

          {activeTab === 'trainwise' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="ghost" icon={Download} size="sm" onClick={() => handleExport(trainwise.map(t => ({ Train: t.train, Total: t.total, Resolved: t.resolved, Open: t.open, ...t.categories })), 'trainwise')}>Export</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">Train</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">Resolved</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">Open</th>
                      {[...new Set(filtered.map(c => c.comp_type_name).filter(Boolean))].map(cat => (
                        <th key={cat} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 whitespace-nowrap">{cat}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trainwise.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-bold text-gray-800">{row.train}</td>
                        <td className="px-4 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{row.total}</span></td>
                        <td className="px-4 py-3"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">{row.resolved}</span></td>
                        <td className="px-4 py-3"><span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">{row.open}</span></td>
                        {[...new Set(filtered.map(c => c.comp_type_name).filter(Boolean))].map(cat => (
                          <td key={cat} className="px-4 py-3 text-sm text-gray-600">{row.categories[cat] || '-'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Time Mapping */}
          {activeTab === 'timemapping' && (
            <div className="space-y-5">
              {/* Peak Hours */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 text-sm mb-4">Peak Hours Analysis</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  {timeMapping.peakHours.filter(h => h.value > 0).slice(0, 5).map((h, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">#{i + 1} Peak</p>
                      <p className="text-lg font-bold text-gray-800">{h.hour}</p>
                      <p className="text-xs text-blue-600">{h.value} ({h.pct}%)</p>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={timeMapping.peakHours} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" dy={10} axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Complaints" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Hourly vs Resolution Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 text-sm">Complaint Hours vs Resolution Time</h3>
                  <Button variant="ghost" icon={Download} size="sm" onClick={() => handleExport(timeMapping.peakHours, 'time_mapping')}>Export</Button>
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {['Time Range', 'Complaints', 'Percentage', 'Visual Distribution', 'Priority'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {timeMapping.peakHours.filter(h => h.value > 0).map((h, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-800">{h.hour} - {String(parseInt(h.hour) + 1).padStart(2, '0')}:00</td>
                          <td className="px-4 py-3"><span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">{h.value}</span></td>
                          <td className="px-4 py-3 text-sm text-gray-600">{h.pct}%</td>
                          <td className="px-4 py-3">
                            <div className="w-32 bg-gray-100 rounded-full h-2">
                              <div className="h-2 rounded-full" style={{ width: `${h.pct}%`, background: h.pct > 15 ? '#ef4444' : h.pct > 8 ? '#f59e0b' : '#10b981' }} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${h.pct > 15 ? 'bg-red-100 text-red-700' : h.pct > 8 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                              {h.pct > 15 ? 'High Priority' : h.pct > 8 ? 'Medium' : 'Low'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4-hour shifts */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 text-sm mb-4">4-Hour Shift Distribution</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={timeMapping.shifts} margin={{ bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="shift" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Complaints" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Comparative Analysis */}
          {activeTab === 'comparative' && (
            <div className="space-y-5">
              <div className="flex justify-end">
                <Button variant="ghost" icon={Download} size="sm" onClick={() => handleExport(comparative, 'comparative')}>Export</Button>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 text-sm mb-4">Month-wise Category Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={comparative} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" dy={10} axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    {[...new Set(filtered.map(c => c.comp_type_name).filter(Boolean))].map((cat, i) => (
                      <Line key={cat} type="monotone" dataKey={cat} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Comparative Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800 text-sm">Month-wise Detailed Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">Month</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase border-b border-gray-200">Total</th>
                        {[...new Set(filtered.map(c => c.comp_type_name).filter(Boolean))].map(cat => (
                          <th key={cat} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 whitespace-nowrap">{cat}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {comparative.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-bold text-gray-800">{row.month}</td>
                          <td className="px-4 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{row.total}</span></td>
                          {[...new Set(filtered.map(c => c.comp_type_name).filter(Boolean))].map(cat => (
                            <td key={cat} className="px-4 py-3 text-sm text-gray-600">{row[cat] || '-'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
