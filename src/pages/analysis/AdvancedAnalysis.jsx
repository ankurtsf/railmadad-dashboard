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
  { id: 'trainwise', label: 'Train-wise Analysis', icon: Train },
  { id: 'timemapping', label: 'Time Mapping', icon: Clock },
  { id: 'comparative', label: 'Comparative Analysis', icon: Calendar },
]

export default function AdvancedAnalysis() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [filters, setFilters] = useState({
    dateFrom: '', dateTo: '', depot: 'All', zone: 'All', train: 'All'
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

  // Apply filters
  const filtered = useMemo(() => {
    return complaints.filter(c => {
      if (filters.dateFrom && c.created_on && new Date(c.created_on) < new Date(filters.dateFrom)) return false
      if (filters.dateTo && c.created_on && new Date(c.created_on) > new Date(filters.dateTo)) return false
      if (filters.depot !== 'All' && c.primary_depot !== filters.depot) return false
      if (filters.zone !== 'All' && c.zone_code !== filters.zone) return false
      if (filters.train !== 'All' && c.train_no !== filters.train) return false
      return true
    })
  }, [complaints, filters])

  // Filter options
  const depots = ['All', ...new Set(complaints.map(c => c.primary_depot).filter(Boolean))]
  const zones = ['All', ...new Set(complaints.map(c => c.zone_code).filter(Boolean))]
  const trains = ['All', ...new Set(complaints.map(c => c.train_no).filter(Boolean))]

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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Input label="Start Date" type="date" value={filters.dateFrom} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))} />
          <Input label="End Date" type="date" value={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))} />
          <Select label="Depot" value={filters.depot} onChange={e => setFilters(p => ({ ...p, depot: e.target.value }))} options={depots.map(d => ({ value: d, label: d }))} />
          <Select label="Zone" value={filters.zone} onChange={e => setFilters(p => ({ ...p, zone: e.target.value }))} options={zones.map(z => ({ value: z, label: z }))} />
          <Select label="Train" value={filters.train} onChange={e => setFilters(p => ({ ...p, train: e.target.value }))} options={trains.map(t => ({ value: t, label: t }))} />
        </div>
        <div className="flex justify-end mt-3">
          <Button variant="ghost" onClick={() => setFilters({ dateFrom: '', dateTo: '', depot: 'All', zone: 'All', train: 'All' })}>Clear Filters</Button>
        </div>
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
          {activeTab === 'watering' && <CategoryAnalysis keyword="water" title="Water Complaints" color="#0ea5e9" />}

          {/* Train-wise Analysis */}
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
