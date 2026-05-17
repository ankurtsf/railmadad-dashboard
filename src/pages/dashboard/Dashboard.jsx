import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  AlertTriangle, CheckCircle, Clock, TrendingUp, Users,
  Train, MapPin, Star, Filter, RefreshCw, Calendar,
  ArrowUp, ArrowDown, Minus, FileText, Zap, Target
} from 'lucide-react'
import { StatCard, LoadingSpinner, FilterBar, Select, Badge } from '../../components/ui/index'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#f43f5e', '#6366f1']

const COMPLAINT_MODE_MAP = {
  'T': 'Train', 'H': 'Helpline', 'A': 'App', 'R': 'Railmadad App', 'S': 'Social Media'
}

export default function Dashboard() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    zone: 'All', division: 'All', category: 'All',
    dateRange: 'this_month'
  })
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    fetchComplaints()
  }, [])

  const fetchComplaints = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('created_on', { ascending: false })
      if (!error) {
        setComplaints(data || [])
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Date helpers
  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth()
  const fyStart = thisMonth >= 3
    ? new Date(thisYear, 3, 1)
    : new Date(thisYear - 1, 3, 1)

  const filtered = useMemo(() => {
    return complaints.filter(c => {
      if (filters.zone !== 'All' && c.zone_code !== filters.zone) return false
      if (filters.division !== 'All' && c.div_code !== filters.division) return false
      if (filters.category !== 'All' && c.comp_type_name !== filters.category) return false
      return true
    })
  }, [complaints, filters])

  // KPI calculations
  const kpis = useMemo(() => {
    const total = filtered.length
    const resolved = filtered.filter(c => String(c.status).toLowerCase() === 'closed').length
    const open = filtered.filter(c => String(c.status).toLowerCase() !== 'closed').length
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0
    const forwarded = filtered.filter(c => c.forwarded > 0).length
    const forwarded1x = filtered.filter(c => c.forwarded === 1).length
    const forwarded2x = filtered.filter(c => c.forwarded === 2).length
    const forwarded3x = filtered.filter(c => c.forwarded >= 3).length

    // Resolution times
    const resTimes = filtered
      .filter(c => c.diff && c.diff !== 'null')
      .map(c => {
        const match = String(c.diff).match(/(\d+):(\d+)/)
        return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0
      }).filter(t => t > 0)

    const avgResTime = resTimes.length > 0
      ? Math.round(resTimes.reduce((a, b) => a + b, 0) / resTimes.length)
      : 0
    const maxResTime = resTimes.length > 0 ? Math.max(...resTimes) : 0

    const formatMins = (mins) => {
      if (mins === 0) return 'N/A'
      const h = Math.floor(mins / 60)
      const m = mins % 60
      return h > 0 ? `${h}h ${m}m` : `${m}m`
    }

    // SLA
    const slaBreached = filtered.filter(c =>
      c.sla && String(c.sla).toLowerCase().includes('sla')
    ).length
    const slaBreachRate = total > 0 ? Math.round((slaBreached / total) * 100) : 0

    // First time resolution (not forwarded)
    const firstTimeResolved = filtered.filter(c =>
      String(c.status).toLowerCase() === 'closed' && (!c.forwarded || c.forwarded === 0)
    ).length
    const firstTimeResRate = resolved > 0 ? Math.round((firstTimeResolved / resolved) * 100) : 0

    // Ratings
    const rated = filtered.filter(c => c.rating && c.rating !== 'Not Rated' && c.rating !== '')
    const satisfied = rated.filter(c =>
      String(c.rating).toLowerCase().includes('excellent') ||
      String(c.rating).toLowerCase().includes('satisfactory')
    ).length
    const satisfactionRate = rated.length > 0 ? Math.round((satisfied / rated.length) * 100) : 0

    // This FY
    const fyComplaints = complaints.filter(c => c.created_on && new Date(c.created_on) >= fyStart).length

    // This month
    const monthComplaints = complaints.filter(c => {
      if (!c.created_on) return false
      const d = new Date(c.created_on)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    }).length

    // Today
    const todayComplaints = complaints.filter(c => {
      if (!c.created_on) return false
      const d = new Date(c.created_on)
      return d.toDateString() === now.toDateString()
    }).length

    return {
      total, resolved, open, resolutionRate,
      forwarded, forwarded1x, forwarded2x, forwarded3x,
      avgResTime: formatMins(avgResTime),
      maxResTime: formatMins(maxResTime),
      slaBreachRate, firstTimeResRate, satisfactionRate,
      fyComplaints, monthComplaints, todayComplaints
    }
  }, [filtered, complaints])

  // Month on Month data
  const momData = useMemo(() => {
    const map = {}
    filtered.forEach(c => {
      if (!c.created_on) return
      const month = new Date(c.created_on).toISOString().substring(0, 7)
      if (!map[month]) map[month] = { month, total: 0, resolved: 0, open: 0 }
      map[month].total++
      if (String(c.status).toLowerCase() === 'closed') map[month].resolved++
      else map[month].open++
    })
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
  }, [filtered])

  // Category wise MOM
  const categoryMomData = useMemo(() => {
    const cats = [...new Set(filtered.map(c => c.comp_type_name).filter(Boolean))]
    const months = [...new Set(filtered.map(c => c.created_on ? new Date(c.created_on).toISOString().substring(0, 7) : null).filter(Boolean))].sort().slice(-6)
    return months.map(month => {
      const row = { month }
      cats.forEach(cat => {
        row[cat] = filtered.filter(c =>
          c.comp_type_name === cat &&
          c.created_on &&
          new Date(c.created_on).toISOString().substring(0, 7) === month
        ).length
      })
      return row
    })
  }, [filtered])

  // Category distribution
  const categoryData = useMemo(() => {
    const map = {}
    filtered.forEach(c => {
      const cat = c.comp_type_name || 'Unknown'
      map[cat] = (map[cat] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  // Train wise data
  const trainData = useMemo(() => {
    const map = {}
    filtered.forEach(c => {
      const train = c.train_no || 'Unknown'
      if (!map[train]) map[train] = { train, total: 0 }
      map[train].total++
      const cat = c.comp_type_name || 'Unknown'
      map[train][cat] = (map[train][cat] || 0) + 1
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10)
  }, [filtered])

  // Peak hours
  const peakHoursData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, '0')}:00`, count: 0 }))
    filtered.forEach(c => {
      if (!c.created_on) return
      const h = new Date(c.created_on).getHours()
      hours[h].count++
    })
    return hours.filter(h => h.count > 0).sort((a, b) => b.count - a.count)
  }, [filtered])

  // Zone wise
  const zoneData = useMemo(() => {
    const map = {}
    filtered.forEach(c => {
      const zone = c.zone_code || 'Unknown'
      map[zone] = (map[zone] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  // Filter options
  const zones = ['All', ...new Set(complaints.map(c => c.zone_code).filter(Boolean))]
  const divisions = ['All', ...new Set(complaints.map(c => c.div_code).filter(Boolean))]
  const categories = ['All', ...new Set(complaints.map(c => c.comp_type_name).filter(Boolean))]

  // Forwarded breakdown
  const forwardedData = [
    { name: 'Forwarded 1x', value: kpis.forwarded1x },
    { name: 'Forwarded 2x', value: kpis.forwarded2x },
    { name: 'Forwarded 3x+', value: kpis.forwarded3x },
  ].filter(d => d.value > 0)

  if (loading) return <LoadingSpinner text="Loading dashboard..." />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-700 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Dashboard</h1>
            <p className="text-blue-200 text-sm mt-0.5">RailMadad Complaint Management — All India Overview</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <p className="text-blue-200">Last updated</p>
              <p className="font-medium">{lastUpdated?.toLocaleTimeString('en-IN')}</p>
            </div>
            <button onClick={fetchComplaints} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Total complaints summary */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{kpis.fyComplaints.toLocaleString()}</p>
            <p className="text-blue-200 text-xs mt-0.5">This Financial Year</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{kpis.monthComplaints.toLocaleString()}</p>
            <p className="text-blue-200 text-xs mt-0.5">This Month</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{kpis.todayComplaints.toLocaleString()}</p>
            <p className="text-blue-200 text-xs mt-0.5">Today</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <FilterBar onClear={() => setFilters({ zone: 'All', division: 'All', category: 'All', dateRange: 'this_month' })}>
        <Select
          label="Zone"
          value={filters.zone}
          onChange={e => setFilters(p => ({ ...p, zone: e.target.value }))}
          options={zones.map(z => ({ value: z, label: z }))}
        />
        <Select
          label="Division"
          value={filters.division}
          onChange={e => setFilters(p => ({ ...p, division: e.target.value }))}
          options={divisions.map(d => ({ value: d, label: d }))}
        />
        <Select
          label="Category"
          value={filters.category}
          onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}
          options={categories.map(c => ({ value: c, label: c }))}
        />
      </FilterBar>

      {complaints.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Data Available</h3>
          <p className="text-gray-500 text-sm">Upload complaints data to see the dashboard analytics</p>
        </div>
      ) : (
        <>
          {/* KPI Cards Row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Complaints" value={kpis.total.toLocaleString()} icon={FileText} color="blue" subtitle="In selected filters" />
            <StatCard title="Resolved" value={`${kpis.resolved.toLocaleString()} (${kpis.resolutionRate}%)`} icon={CheckCircle} color="green" subtitle="Closed complaints" />
            <StatCard title="Open" value={kpis.open.toLocaleString()} icon={AlertTriangle} color="amber" subtitle="Pending resolution" />
            <StatCard title="Resolution Rate" value={`${kpis.resolutionRate}%`} icon={TrendingUp} color="indigo" subtitle="Of total complaints" />
          </div>

          {/* KPI Cards Row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Avg Resolution Time" value={kpis.avgResTime} icon={Clock} color="purple" subtitle="Average closure time" />
            <StatCard title="Max Resolution Time" value={kpis.maxResTime} icon={Clock} color="rose" subtitle="Longest case" />
            <StatCard title="SLA Breach Rate" value={`${kpis.slaBreachRate}%`} icon={Zap} color="red" subtitle="Breached SLA" />
            <StatCard title="First Time Resolution" value={`${kpis.firstTimeResRate}%`} icon={Target} color="teal" subtitle="Resolved without forward" />
          </div>

          {/* KPI Cards Row 3 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Forwarded Complaints" value={kpis.forwarded.toLocaleString()} icon={ArrowUp} color="amber" subtitle={`1x:${kpis.forwarded1x} 2x:${kpis.forwarded2x} 3x+:${kpis.forwarded3x}`} />
            <StatCard title="Satisfaction Rate" value={`${kpis.satisfactionRate}%`} icon={Star} color="green" subtitle="Positive feedback" />
            <StatCard title="Peak Hour" value={peakHoursData[0]?.hour || 'N/A'} icon={Clock} color="blue" subtitle={`${peakHoursData[0]?.count || 0} complaints`} />
            <StatCard title="Top Zone" value={zoneData[0]?.name || 'N/A'} icon={MapPin} color="purple" subtitle={`${zoneData[0]?.value || 0} complaints`} />
          </div>

          {/* Month on Month Bar Chart + Category Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm">Total Complaints — Month on Month</h3>
              {momData.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={momData} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" dy={10} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                    <Legend />
                    <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="open" name="Open" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Category wise MOM Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 text-sm">Category-wise Month on Month</h3>
              </div>
              <div className="overflow-x-auto max-h-[320px]">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Month</th>
                      {[...new Set(filtered.map(c => c.comp_type_name).filter(Boolean))].slice(0, 4).map(cat => (
                        <th key={cat} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{cat}</th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {momData.slice(-6).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{row.month}</td>
                        {[...new Set(filtered.map(c => c.comp_type_name).filter(Boolean))].slice(0, 4).map(cat => (
                          <td key={cat} className="px-4 py-3 text-sm text-gray-600">
                            {filtered.filter(c => c.comp_type_name === cat && c.created_on && new Date(c.created_on).toISOString().substring(0, 7) === row.month).length || '-'}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-sm font-bold text-blue-600">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Rating Pie + Rating MOM Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm">Rating Distribution</h3>
              {(() => {
                const ratingMap = {}
                filtered.forEach(c => {
                  const r = c.rating || 'Not Rated'
                  ratingMap[r] = (ratingMap[r] || 0) + 1
                })
                const ratingData = Object.entries(ratingMap).map(([name, value]) => ({ name, value }))
                return ratingData.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">No rating data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={ratingData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}>
                        {ratingData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )
              })()}
            </div>

            {/* Zone wise Pie */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm">Zone-wise Distribution</h3>
              {zoneData.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No zone data</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={zoneData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}>
                      {zoneData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Train wise bar chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4 text-sm">Top 10 Trains — Complaint Volume</h3>
            {trainData.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No train data</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trainData} layout="vertical" margin={{ left: 60, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="train" type="category" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} dx={-5} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                  <Bar dataKey="total" name="Total Complaints" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Peak Hours + Forwarded */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Peak Hours */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm">Peak Complaint Hours</h3>
              {peakHoursData.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No data</p>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {peakHoursData.slice(0, 10).map((h, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-gray-500 w-12">{h.hour}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-5 rounded-full flex items-center justify-end pr-2"
                          style={{
                            width: `${Math.round((h.count / peakHoursData[0].count) * 100)}%`,
                            background: i < 3 ? '#ef4444' : i < 6 ? '#f59e0b' : '#10b981'
                          }}
                        >
                          <span className="text-white text-xs font-bold">{h.count}</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">
                        {Math.round((h.count / filtered.length) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Forwarded Analysis */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm">Forwarded Complaints Analysis</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Forwarded 1x', value: kpis.forwarded1x, color: 'bg-amber-100 text-amber-700' },
                    { label: 'Forwarded 2x', value: kpis.forwarded2x, color: 'bg-orange-100 text-orange-700' },
                    { label: 'Forwarded 3x+', value: kpis.forwarded3x, color: 'bg-red-100 text-red-700' },
                  ].map((item, i) => (
                    <div key={i} className={`${item.color} rounded-lg p-3 text-center`}>
                      <p className="text-xl font-bold">{item.value}</p>
                      <p className="text-xs mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
                {forwardedData.length > 0 && (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={forwardedData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                        {forwardedData.map((_, i) => <Cell key={i} fill={['#f59e0b', '#f97316', '#ef4444'][i]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Complaint Mode Distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4 text-sm">Complaint Mode Distribution</h3>
            {(() => {
              const modeMap = {}
              filtered.forEach(c => {
                const mode = COMPLAINT_MODE_MAP[c.complaint_mode] || c.complaint_mode || 'Unknown'
                modeMap[mode] = (modeMap[mode] || 0) + 1
              })
              const modeData = Object.entries(modeMap).map(([name, value]) => ({ name, value }))
              return (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  {modeData.map((m, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                      <p className="text-2xl font-bold text-gray-800">{m.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{m.name}</p>
                      <p className="text-xs font-medium text-blue-600 mt-1">
                        {Math.round((m.value / filtered.length) * 100)}%
                      </p>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </>
      )}
    </div>
  )
}
