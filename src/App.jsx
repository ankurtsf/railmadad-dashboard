import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine, LabelList, ComposedChart
} from 'recharts';
import {
  LayoutDashboard, TrainFront, Clock, MessageSquareWarning,
  Sparkles, Menu, X, AlertTriangle, Upload, Calendar, Trash2,
  FileSpreadsheet, Bug, Map as LucideMap, Filter, ChevronDown, Loader2,
  Target, Moon, Sun, Download, TrendingUp, LogOut, Lock, Mail,
  Eye, EyeOff, FileText, FileBarChart, BedDouble, Droplets, Wrench, Activity, BookOpen, ThumbsDown, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://npfuxifktdmxmzprfcxm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZnV4aWZrdGRteG16cHJmY3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MjMwMDMsImV4cCI6MjA5NDE5OTAwM30.cCheIUxTAQWyoVyIwOLRd5usiyFI-q2GIn3A9NPFL78';

const COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981', '#f43f5e', '#a855f7', '#ec4899', '#14b8a6'];

const initialRawDatabase = { records: [] };

const STOP_WORDS = new Set([
  'and', 'the', 'was', 'for', 'that', 'with', 'from', 'this', 'have', 'not',
  'are', 'but', 'has', 'had', 'been', 'very', 'they', 'will', 'coach', 'train',
  'seat', 'berth', 'number', 'passenger', 'is', 'it', 'to', 'in', 'of', 'on',
  'ai', 'generated', 'complaint', 'description', 'user', 'input'
]);

// ──────────────────────────────────────────────────────────────────
// FORMATTERS & HELPERS
// ──────────────────────────────────────────────────────────────────
const formatHumanDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const formatChartDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
};

const formatTime = (mins) => {
  if (!mins && mins !== 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const formatCategory = (cat) => {
  if (!cat) return '—';
  return cat.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
};

const cleanFeedbackText = (desc, feedback) => {
  let d = String(desc || '').replace(/AI Generated Complaint Description:?\s*/i, '').trim();
  let f = String(feedback || '').replace(/Complaint User Input:?\s*/i, '').trim();
  let combined = d;
  if (f) combined += ` (User: ${f})`;
  return combined || '—';
};

const parseRawDate = (raw) => {
  if (!raw) return null;
  const str = String(raw).trim();
  if (/^\d+\.\d+$/.test(str) && str.length > 10) return null;

  let hour = 12;
  let dateStr = '';
  let monthStr = '';

  if (!isNaN(Number(raw)) && typeof raw === 'number' && raw > 40000 && raw < 70000) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    hour = d.getUTCHours();
    dateStr = d.toISOString().split('T')[0];
    monthStr = d.toISOString().substring(0, 7);
  } else {
    const match = str.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!match) return null;
    let part1 = match[1], part2 = match[2], part3 = match[3];
    let year, month, day;
    if (part1.length === 4) { year = part1; month = part2; day = part3; }
    else if (part3.length === 4) { year = part3; month = part2; day = part1; }
    else { year = '20' + part3; month = part2; day = part1; }
    month = month.padStart(2, '0');
    day = day.padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
    monthStr = `${year}-${month}`;
    if (match[4]) hour = parseInt(match[4], 10);
  }

  const bucketStart = Math.floor(hour / 2) * 2;
  const shift2 = `${String(bucketStart).padStart(2, '0')}:00 - ${String(bucketStart + 2).padStart(2, '0')}:00`;
  return { date: dateStr, month: monthStr, hour, shift2 };
};

const parseResolutionTime = (val) => {
  if (!val || String(val) === 'null') return 0;
  const match = String(val).match(/(\d+):(\d+)/);
  if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  return 0;
};

const getWeekKey = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
};

const getHeatmapColor = (val, max, type) => {
  if (!val) return { bg: 'transparent', text: 'inherit' };
  const intensity = Math.max(0.1, val / max);
  const isDark = intensity > 0.55;
  if (type === 'blue') return { bg: `rgba(59, 130, 246, ${intensity})`, text: isDark ? '#ffffff' : 'inherit' };
  return { bg: `rgba(239, 68, 68, ${intensity})`, text: isDark ? '#ffffff' : 'inherit' };
};

// ──────────────────────────────────────────────────────────────────
// COMPONENTS
// ──────────────────────────────────────────────────────────────────
const navItemsList = [
  { id: 'executive', label: 'Executive Overview', icon: LayoutDashboard },
  { id: 'operations', label: 'Operations & Time', icon: Clock },
  { id: 'trends', label: 'Trends Over Time', icon: TrendingUp },
  { id: 'assets', label: 'Root Cause & Assets', icon: Target },
  { id: 'sentiment', label: 'Passenger Sentiment', icon: MessageSquareWarning },
  { id: 'dictionary', label: 'Data Dictionary', icon: BookOpen },
];

const MetricCard = ({ title, value, todayValue, icon: Icon, accent, sparkColor, sparklineData, dataKey, onTodayClick, infoText, isCritical, extraIcon }) => (
  <div className={`relative bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border ${isCritical ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/20' : 'border-slate-100 dark:border-slate-800'} flex flex-col justify-between overflow-hidden transition-colors h-32`}>
    <div className="relative z-10 flex justify-between items-start mb-1">
      <div className="flex items-center">
        <p className={`text-[11px] font-bold uppercase tracking-wider ${isCritical ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>{title}</p>
        {infoText && (
          <div className="relative group ml-1.5 flex items-center justify-center">
            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black cursor-help ${isCritical ? 'bg-rose-200 text-rose-700 dark:bg-rose-900 dark:text-rose-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>i</div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-center leading-tight">
              {infoText}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
            </div>
          </div>
        )}
      </div>
      <div className={`p-2 rounded-lg ${accent}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
    </div>
    <div className="relative z-10 flex items-center">
        <h3 className={`text-3xl font-black ${isCritical ? 'text-rose-800 dark:text-rose-300' : 'text-slate-900 dark:text-white'} flex items-center`}>
          {value}
          {extraIcon && <span className="ml-2">{extraIcon}</span>}
        </h3>
    </div>
    {todayValue !== undefined && onTodayClick && (
      <div className="relative z-10 flex items-center mt-auto pt-2">
          <button 
             onClick={onTodayClick} 
             title="Click to filter by Today"
             className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
          >
             Today: {todayValue}
          </button>
      </div>
    )}
    {sparklineData && sparklineData.length > 0 && (
      <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30 pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparklineData}>
            <Line type="monotone" dataKey={dataKey} stroke={sparkColor} strokeWidth={3} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

const Card = ({ title, icon: Icon, children, className = '' }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors ${className}`}>
    {title && (
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-wide">{title}</h3>
        {Icon && <Icon className="text-slate-300 dark:text-slate-600 w-5 h-5" />}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const ExpandableText = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  if (!text || text === '—') return <span className="text-slate-500">—</span>;
  const isLong = text.length > 120;
  return (
    <div>
      <span className={`text-slate-600 dark:text-slate-300 ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
        {text}
      </span>
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1 hover:underline">
          {expanded ? 'Show Less' : 'Read More...'}
        </button>
      )}
    </div>
  );
};

const MultiSelectDropdown = ({ label, options, selected, onChange, activeId, setActiveId, id }) => {
  const isOpen = activeId === id;
  const toggleOption = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter(o => o !== opt));
    else onChange([...selected, opt]);
  };
  const displayText = selected.length === 0 || selected.length === options.length 
      ? 'All Selected' : selected.length === 1 ? selected[0] : `${selected.length} Selected`;

  return (
    <div className="relative flex flex-col">
      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{label}</span>
      <button 
         onClick={() => setActiveId(isOpen ? null : id)}
         className="flex items-center justify-between text-sm border border-slate-200 dark:border-slate-700 rounded p-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none hover:border-indigo-400"
      >
         <span className="truncate max-w-[120px]">{displayText}</span>
         <ChevronDown className="w-3 h-3 ml-1 text-slate-400" />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setActiveId(null)}></div>
          <div className="absolute top-full left-0 mt-1 w-56 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 p-2 flex flex-col custom-scrollbar">
             <div className="flex justify-between mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                <button onClick={() => onChange([...options])} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Select All</button>
                <button onClick={() => onChange([])} className="text-xs font-bold text-slate-500 hover:underline">Clear</button>
             </div>
             {options.map(o => (
                <label key={String(o)} className="flex items-start py-1.5 px-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded cursor-pointer">
                  <input 
                     type="checkbox" 
                     checked={selected.includes(o)} 
                     onChange={() => toggleOption(o)}
                     className="mt-0.5 mr-2 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200 leading-tight">{formatCategory(String(o))}</span>
                </label>
             ))}
          </div>
        </>
      )}
    </div>
  );
};

const ScatterTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-lg">
        <p className="font-bold text-slate-800 dark:text-white mb-1">Train: {data.train || 'Unknown'} | Ref: {data.name}</p>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{formatCategory(data.categoryName || data.category)}</p>
        <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-1">{formatTime(data.time)} to resolve</p>
      </div>
    );
  }
  return null;
};

// ──────────────────────────────────────────────────────────────────
// LOGIN COMPONENT
// ──────────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin, supabaseClient }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('signin');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin();
      } else {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('Check your email to confirm your account, then sign in.');
        setMode('signin');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 mb-4">
            <TrainFront className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">RailMadad Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">SEE Division Engine</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-7">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-full p-1 mb-6">
            <button type="button" onClick={() => { setMode('signin'); setError(''); setInfo(''); }} className={`flex-1 py-2 text-sm font-bold rounded-full transition-all ${mode === 'signin' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}>Sign In</button>
            <button type="button" onClick={() => { setMode('signup'); setError(''); setInfo(''); }} className={`flex-1 py-2 text-sm font-bold rounded-full transition-all ${mode === 'signup' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}>Sign Up</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="you@railway.gov.in" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type={showPassword ? 'text' : 'password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium p-3 rounded-lg">{error}</div>}
            {info && <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-medium p-3 rounded-lg">{info}</div>}

            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-5">Secured by Supabase Auth.</p>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// MAIN APP
// ──────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [supabaseClient, setSupabaseClient] = useState(null);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('railmadad_theme') || 'light';
  });

  const [activeTab, setActiveTab] = useState('executive');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState('Initializing...');
  const [dbData, setDbData] = useState(initialRawDatabase);
  const [toastMessage, setToastMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [trendsGranularity, setTrendsGranularity] = useState('day'); 
  const [datePreset, setDatePreset] = useState('Custom');

  const [filters, setFilters] = useState({
    fromDate: '', toDate: '',
    timeBucket: [], train: [], coachType: [], zone: [], location: [],
    category: [], sla: [], rating: [], status: []
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('railmadad_theme', theme);
  }, [theme]);

  const handleSignOut = async () => {
    if (supabaseClient) await supabaseClient.auth.signOut();
    setDbData(initialRawDatabase);
  };

  const showToast = (msg) => {
    setToastMessage(String(msg));
    setTimeout(() => setToastMessage(''), 5000);
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key === 'fromDate' || key === 'toDate') setDatePreset('Custom');
  };
  
  const getLatestDateStr = useCallback(() => {
    if (!dbData.records || dbData.records.length === 0) return new Date().toISOString().split('T')[0];
    const sorted = [...dbData.records].map(r => r.date).sort();
    return sorted[sorted.length - 1];
  }, [dbData.records]);

  const handleDatePreset = useCallback((preset) => {
    setDatePreset(preset);
    const latestStr = getLatestDateStr();
    const latestObj = new Date(latestStr);
    const format = (d) => d.toISOString().split('T')[0];
    
    if (preset === 'Today') {
      setFilters(prev => ({ ...prev, fromDate: latestStr, toDate: latestStr }));
    } else if (preset === 'This Week') {
      const lastWeek = new Date(latestObj);
      lastWeek.setDate(latestObj.getDate() - 7);
      setFilters(prev => ({ ...prev, fromDate: format(lastWeek), toDate: latestStr }));
    } else if (preset === 'This Month') {
      const firstDay = new Date(latestObj.getFullYear(), latestObj.getMonth(), 1);
      setFilters(prev => ({ ...prev, fromDate: format(firstDay), toDate: latestStr }));
    } else if (preset === 'Overall') {
      setFilters(prev => ({ ...prev, fromDate: '', toDate: '' }));
    }
  }, [getLatestDateStr]);

  const applyDashboardData = (dataObj, syncMessage) => {
    setDbData(dataObj);
    setLastSync(syncMessage);
    if (dataObj.records && dataObj.records.length > 0) {
      const sortedDates = [...dataObj.records].map((r) => r.date).sort();
      const latest = sortedDates[sortedDates.length - 1];
      const firstDay = new Date(new Date(latest).getFullYear(), new Date(latest).getMonth(), 1).toISOString().split('T')[0];
      setFilters((prev) => ({ ...prev, fromDate: firstDay, toDate: latest }));
      setDatePreset('This Month');
    }
  };

  const loadLocalFallback = useCallback(() => {
    try {
      const localDataStr = localStorage.getItem('railmadad_local_sync');
      if (localDataStr) {
        const localData = JSON.parse(localDataStr);
        applyDashboardData(localData, 'Loaded from Local Cache');
      } else setLastSync('Empty');
    } catch { setLastSync('Local cache error'); }
    setIsLoading(false);
  }, []);

  const fetchCloudData = useCallback(async (client) => {
    try {
      const { data, error } = await client.from('railmadad_sync').select('*').eq('id', 1).single();
      if (error) { loadLocalFallback(); return; }
      if (data && data.json_data && data.json_data.records) {
        applyDashboardData(data.json_data, new Date(data.last_updated || Date.now()).toLocaleTimeString());
        localStorage.setItem('railmadad_local_sync', JSON.stringify(data.json_data));
      } else loadLocalFallback();
    } catch { loadLocalFallback(); } 
    finally { setIsLoading(false); }
  }, [loadLocalFallback]);

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        if (!window.XLSX) {
          await new Promise((res) => { const script = document.createElement('script'); script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; script.onload = res; document.head.appendChild(script); });
        }
        if (!window.supabase) {
          await new Promise((res) => { const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'; script.onload = res; document.head.appendChild(script); });
        }
        if (!window.jspdf) {
          await new Promise((res) => { const script = document.createElement('script'); script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'; script.onload = res; document.head.appendChild(script); });
        }
        if (!window.jspdf || !window.jspdf.jsPDF.API.autoTable) {
          await new Promise((res) => { const script = document.createElement('script'); script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'; script.onload = res; document.head.appendChild(script); });
        }
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        setSupabaseClient(client);
        client.auth.getSession().then(({ data }) => { setSession(data.session); setAuthChecked(true); });
        client.auth.onAuthStateChange((_event, s) => { setSession(s); });
      } catch (err) {
        console.error("Dependency loading failed", err);
        loadLocalFallback(); setAuthChecked(true);
      }
    };
    loadDependencies();
  }, [loadLocalFallback]);

  useEffect(() => {
    if (session && supabaseClient) fetchCloudData(supabaseClient);
  }, [session, supabaseClient, fetchCloudData]);

  // ── CORE AGGREGATOR
  const aggregated = useMemo(() => {
    const rawRecords = dbData.records || [];

    const opt = {
      buckets: new Set(), trains: new Set(), coaches: new Set(),
      zones: new Set(), locations: new Set(), cats: new Set(),
      slas: new Set(), ratings: new Set(), statuses: new Set()
    };

    rawRecords.forEach((r) => {
      if (r.shift2) opt.buckets.add(r.shift2);
      if (r.train && r.train !== 'Unknown') opt.trains.add(r.train);
      if (r.coachType && r.coachType !== 'Unknown') opt.coaches.add(r.coachType);
      if (r.ownZone && r.ownZone !== 'Unknown') opt.zones.add(r.ownZone);
      if (r.zone && r.zone !== 'Unknown') opt.zones.add(r.zone);
      if (r.nextStation && r.nextStation !== 'Unknown') opt.locations.add(r.nextStation);
      if (r.category && r.category !== 'Uncategorized') opt.cats.add(r.category);
      if (r.sla && r.sla !== 'Unknown') opt.slas.add(r.sla);
      if (r.rating) opt.ratings.add(r.rating);
      if (r.status) opt.statuses.add(r.status);
    });

    const validRecords = rawRecords.filter((r) => {
      if (filters.fromDate && r.date < filters.fromDate) return false;
      if (filters.toDate && r.date > filters.toDate) return false;
      if (filters.timeBucket.length > 0 && !filters.timeBucket.includes(r.shift2)) return false;
      if (filters.train.length > 0 && !filters.train.includes(r.train)) return false;
      if (filters.coachType.length > 0 && !filters.coachType.includes(r.coachType)) return false;
      if (filters.zone.length > 0 && !filters.zone.includes(r.zone) && !filters.zone.includes(r.ownZone)) return false;
      if (filters.location.length > 0 && !filters.location.includes(r.nextStation)) return false;
      if (filters.category.length > 0 && !filters.category.includes(r.category)) return false;
      if (filters.sla.length > 0 && !filters.sla.includes(r.sla)) return false;
      if (filters.status.length > 0 && !filters.status.includes(r.status)) return false;
      if (filters.rating.length > 0 && !filters.rating.includes(r.rating)) return false;
      return true;
    });

    const targetToday = filters.toDate || (rawRecords.length ? rawRecords.sort((a,b)=>a.date.localeCompare(b.date))[rawRecords.length-1].date : '');
    const kpis = { total: validRecords.length, bedroll: 0, clean: 0, water: 0, maint: 0 };
    const kpisToday = { total: 0, bedroll: 0, clean: 0, water: 0, maint: 0 };
    
    const dailySparkMap = new Map();
    const trainCatMap = new Map();
    const zoneDivMap = new Map();
    const shiftCatMap = new Map();
    const catResMap = new Map();
    const wateringMap = new Map();
    const pestDefectTable = [];
    const coachCatMap = new Map();
    const quickCloseMap = {
      '< 15m': { name: '< 15m', Satisfactory: 0, Neutral: 0, Unsatisfactory: 0 },
      '15-60m': { name: '15-60m', Satisfactory: 0, Neutral: 0, Unsatisfactory: 0 },
      '> 60m': { name: '> 60m', Satisfactory: 0, Neutral: 0, Unsatisfactory: 0 }
    };
    const wordMap = new Map();
    const unsatTable = [];
    const uniqueCats = new Set();
    const uniqueDivs = new Set();
    const scatterData = [];

    const dailyMap = new Map();
    const weeklyMap = new Map();
    const monthlyMap = new Map();
    const catTrendMap = { day: new Map(), week: new Map(), month: new Map() };
    const slaTrendMap = { day: new Map(), week: new Map(), month: new Map() };
    
    let maxZoneDivValue = 0;
    let maxTrainCatValue = 0;
    let maxShiftVal = 0;
    
    let totalResTime = 0;
    let resolvedCount = 0;
    let openCount = 0;
    let slaBreachCount = 0;
    let totalRated = 0;
    let totalUnsat = 0;

    validRecords.forEach((r) => {
      const catLow = String(r.category).toLowerCase();
      const isToday = r.date === targetToday;

      if (!dailySparkMap.has(r.date)) dailySparkMap.set(r.date, { date: r.date, total: 0, bedroll: 0, clean: 0, water: 0, maint: 0 });
      const sparkObj = dailySparkMap.get(r.date);
      sparkObj.total++;
      if (isToday) kpisToday.total++;

      if (catLow.includes('bedroll') || catLow.includes('bed roll') || catLow.includes('linen')) { kpis.bedroll++; sparkObj.bedroll++; if(isToday) kpisToday.bedroll++; }
      if (catLow.includes('clean') || catLow.includes('dirt')) { kpis.clean++; sparkObj.clean++; if(isToday) kpisToday.clean++; }
      if (catLow.includes('water') || catLow.includes('plumb')) { kpis.water++; sparkObj.water++; if(isToday) kpisToday.water++; }
      if (catLow.includes('maintain') || catLow.includes('coach') || catLow.includes('equip')) { kpis.maint++; sparkObj.maint++; if(isToday) kpisToday.maint++; }

      uniqueCats.add(String(r.category));

      if (!trainCatMap.has(r.train)) trainCatMap.set(r.train, { train: r.train, Total: 0 });
      const tObj = trainCatMap.get(r.train);
      tObj.Total++; 
      tObj[r.category] = (tObj[r.category] || 0) + 1;
      if (tObj[r.category] > maxTrainCatValue) maxTrainCatValue = tObj[r.category];

      uniqueDivs.add(String(r.div));
      if (!zoneDivMap.has(r.ownZone)) zoneDivMap.set(r.ownZone, { zone: r.ownZone, Total: 0 });
      const zObj = zoneDivMap.get(r.ownZone);
      zObj.Total++; 
      zObj[r.div] = (zObj[r.div] || 0) + 1;
      if (zObj[r.div] > maxZoneDivValue) maxZoneDivValue = zObj[r.div];

      if (!shiftCatMap.has(r.shift2)) shiftCatMap.set(r.shift2, { shift: r.shift2, Total: 0 });
      const sObj = shiftCatMap.get(r.shift2);
      sObj.Total++; 
      sObj[r.category] = (sObj[r.category] || 0) + 1;
      if (sObj[r.category] > maxShiftVal) maxShiftVal = sObj[r.category];

      if (r.status && !r.status.toLowerCase().includes('clos') && !r.status.toLowerCase().includes('resolv')) {
         openCount++;
      }

      if (r.resTimeMins >= 0 && r.status.toLowerCase().includes('clos')) {
        scatterData.push({ category: r.category, time: r.resTimeMins, name: r.id, train: r.train });
        if (!catResMap.has(r.category)) catResMap.set(r.category, { category: r.category, sum: 0, count: 0 });
        const cr = catResMap.get(r.category);
        cr.sum += r.resTimeMins; cr.count++;
        
        totalResTime += r.resTimeMins;
        resolvedCount++;
        if (r.resTimeMins > 30) slaBreachCount++;

        const rateStr = String(r.rating).toLowerCase();
        const rateCat = rateStr.includes('unsatisfactory') ? 'Unsatisfactory' : (rateStr.includes('satisfactory') ? 'Satisfactory' : 'Neutral');
        if (r.resTimeMins < 15) quickCloseMap['< 15m'][rateCat]++;
        else if (r.resTimeMins <= 60) quickCloseMap['15-60m'][rateCat]++;
        else quickCloseMap['> 60m'][rateCat]++;
      }

      if (r.rating && !r.rating.toLowerCase().includes('not rated')) {
         totalRated++;
         if (r.rating.toLowerCase().includes('unsatisfactory')) totalUnsat++;
      }

      if (catLow.includes('water') && r.nextStation && r.nextStation !== 'Unknown') {
        wateringMap.set(r.nextStation, (wateringMap.get(r.nextStation) || 0) + 1);
      }

      const subLow = String(r.subType).toLowerCase();
      if (r.isPest || subLow.includes('window') || subLow.includes('door') || subLow.includes('panel')) {
        pestDefectTable.push(r);
      }

      const cType = String(r.coachType) || 'Unknown';
      if (!coachCatMap.has(cType)) coachCatMap.set(cType, { coachType: cType, Total: 0 });
      const cObj = coachCatMap.get(cType);
      cObj.Total++; cObj[r.category] = (cObj[r.category] || 0) + 1;

      if (String(r.rating).toLowerCase().includes('unsatisfactory')) unsatTable.push(r);

      const combinedText = (String(r.desc) + ' ' + String(r.feedbackRemark)).toLowerCase();
      const words = combinedText.replace(/[^a-z]/g, ' ').split(/\s+/);
      words.forEach((w) => {
        if (w.length > 3 && !STOP_WORDS.has(w)) wordMap.set(w, (wordMap.get(w) || 0) + 1);
      });

      const dKey = r.date;
      const wKey = getWeekKey(r.date);
      const mKey = r.month;
      dailyMap.set(dKey, (dailyMap.get(dKey) || 0) + 1);
      weeklyMap.set(wKey, (weeklyMap.get(wKey) || 0) + 1);
      monthlyMap.set(mKey, (monthlyMap.get(mKey) || 0) + 1);

      const keys = { day: dKey, week: wKey, month: mKey };
      ['day', 'week', 'month'].forEach((g) => {
        const key = keys[g];
        if (!catTrendMap[g].has(key)) catTrendMap[g].set(key, { date: key });
        const ctObj = catTrendMap[g].get(key);
        ctObj[r.category] = (ctObj[r.category] || 0) + 1;

        if (!slaTrendMap[g].has(key)) slaTrendMap[g].set(key, { date: key, OnTime: 0, Breached: 0 });
        const slaObj = slaTrendMap[g].get(key);
        if (r.resTimeMins > 30) slaObj.Breached++;
        else slaObj.OnTime++;
      });
    });
    
    // WoW Calc (relative to targetToday or latest record)
    let current7DaysVol = 0;
    let previous7DaysVol = 0;
    if (rawRecords.length > 0) {
      const baseDateObj = targetToday ? new Date(targetToday) : new Date(rawRecords.sort((a,b)=>a.date.localeCompare(b.date))[rawRecords.length-1].date);
      const current7Start = new Date(baseDateObj);
      current7Start.setDate(current7Start.getDate() - 6);
      const prev7End = new Date(current7Start);
      prev7End.setDate(prev7End.getDate() - 1);
      const prev7Start = new Date(prev7End);
      prev7Start.setDate(prev7Start.getDate() - 6);

      const fCurrent7Start = current7Start.toISOString().split('T')[0];
      const fToDate = baseDateObj.toISOString().split('T')[0];
      const fPrev7Start = prev7Start.toISOString().split('T')[0];
      const fPrev7End = prev7End.toISOString().split('T')[0];

      rawRecords.forEach(r => {
        let matchOther = true;
        if (filters.timeBucket.length > 0 && !filters.timeBucket.includes(r.shift2)) matchOther = false;
        if (filters.train.length > 0 && !filters.train.includes(r.train)) matchOther = false;
        if (filters.coachType.length > 0 && !filters.coachType.includes(r.coachType)) matchOther = false;
        if (filters.zone.length > 0 && !filters.zone.includes(r.zone) && !filters.zone.includes(r.ownZone)) matchOther = false;
        if (filters.location.length > 0 && !filters.location.includes(r.nextStation)) matchOther = false;
        if (filters.category.length > 0 && !filters.category.includes(r.category)) matchOther = false;
        
        if (matchOther) {
           if (r.date >= fCurrent7Start && r.date <= fToDate) current7DaysVol++;
           if (r.date >= fPrev7Start && r.date <= fPrev7End) previous7DaysVol++;
        }
      });
    }

    const uniqueCatsArray = Array.from(uniqueCats).sort();
    const uniqueDivsArray = Array.from(uniqueDivs).sort();
    
    const trainMatrix = Array.from(trainCatMap.values()).sort((a, b) => b.Total - a.Total);
    const zoneDivMatrix = Array.from(zoneDivMap.values()).sort((a, b) => b.Total - a.Total);
    const sparklineArray = Array.from(dailySparkMap.values()).sort((a,b) => a.date.localeCompare(b.date));
    const shiftHeatmap = Array.from(shiftCatMap.values()).sort((a, b) => String(a.shift).localeCompare(String(b.shift)));
    
    const finalScatterData = scatterData.map(d => {
      const catIdx = uniqueCatsArray.indexOf(d.category);
      const jitter = (Math.random() - 0.5) * 0.5;
      return { ...d, categoryIndex: catIdx + jitter, categoryName: d.category };
    });
    
    const resSpeedBar = Array.from(catResMap.values())
      .map((c) => ({ category: String(c.category), avgMins: Math.round(c.sum / c.count) }))
      .sort((a, b) => b.avgMins - a.avgMins); 
      
    const wateringList = Array.from(wateringMap.entries())
      .map(([station, count]) => ({ station: String(station), count }))
      .sort((a, b) => b.count - a.count).slice(0, 15);
    const coachMatrix = Array.from(coachCatMap.values()).sort((a, b) => b.Total - a.Total);
    
    const quickCloseData = [quickCloseMap['< 15m'], quickCloseMap['15-60m'], quickCloseMap['> 60m']].map(bucket => {
      const total = bucket.Satisfactory + bucket.Neutral + bucket.Unsatisfactory;
      return {
        name: bucket.name,
        Satisfactory: total ? Number(((bucket.Satisfactory / total) * 100).toFixed(1)) : 0,
        Neutral: total ? Number(((bucket.Neutral / total) * 100).toFixed(1)) : 0,
        Unsatisfactory: total ? Number(((bucket.Unsatisfactory / total) * 100).toFixed(1)) : 0,
      };
    });

    const wordCloud = Array.from(wordMap.entries())
      .map(([text, value]) => ({ text: String(text), value }))
      .sort((a, b) => b.value - a.value).slice(0, 40)
      .map((w) => ({ ...w, fontSize: Math.max(12, Math.min(48, w.value * 1.5)) }));

    const topCats = Array.from(catResMap.keys()).slice(0, 5);

    const dailyTrendRaw = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ key: date, count }))
      .sort((a, b) => a.key.localeCompare(b.key));
      
    const dailyTrend = dailyTrendRaw.map((day, i, arr) => {
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - 6); j <= i; j++) { sum += arr[j].count; count++; }
      return { ...day, movingAvg: Math.round(sum / count) };
    });

    const weeklyTrend = Array.from(weeklyMap.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => a.key.localeCompare(b.key));
    const monthlyTrend = Array.from(monthlyMap.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => a.key.localeCompare(b.key));

    const categoryTrend = {
      day: Array.from(catTrendMap.day.values()).sort((a, b) => a.date.localeCompare(b.date)),
      week: Array.from(catTrendMap.week.values()).sort((a, b) => a.date.localeCompare(b.date)),
      month: Array.from(catTrendMap.month.values()).sort((a, b) => a.date.localeCompare(b.date)),
    };

    const calcCompliance = (item) => ({
      ...item,
      Compliance: (item.OnTime + item.Breached) > 0 ? Math.round((item.OnTime / (item.OnTime + item.Breached)) * 100) : 0
    });

    const slaTrend = {
      day: Array.from(slaTrendMap.day.values()).sort((a, b) => a.date.localeCompare(b.date)).map(calcCompliance),
      week: Array.from(slaTrendMap.week.values()).sort((a, b) => a.date.localeCompare(b.date)).map(calcCompliance),
      month: Array.from(slaTrendMap.month.values()).sort((a, b) => a.date.localeCompare(b.date)).map(calcCompliance),
    };
    
    // Derived Global KPIs for Headers
    const globalKpis = {
       avgResTime: resolvedCount > 0 ? formatTime(Math.round(totalResTime / resolvedCount)) : '—',
       slaBreachRate: validRecords.length > 0 ? ((slaBreachCount / validRecords.length) * 100).toFixed(1) : 0,
       worstShift: shiftHeatmap.length > 0 ? shiftHeatmap.sort((a,b)=>b.Total - a.Total)[0].shift : '—',
       openTickets: openCount,
       wowChange: previous7DaysVol > 0 ? (((current7DaysVol - previous7DaysVol) / previous7DaysVol) * 100).toFixed(1) : 0,
       peakComplaintDay: dailyTrendRaw.length > 0 ? dailyTrendRaw.sort((a,b)=>b.count - a.count)[0] : null,
       avgSlaCompliance: validRecords.length > 0 ? (((validRecords.length - slaBreachCount) / validRecords.length) * 100).toFixed(1) : 0,
       criticalPests: pestDefectTable.filter(r => r.isPest).length,
       topBottleneckStation: wateringList.length > 0 ? wateringList[0].station : '—',
       worstCoachClass: coachMatrix.length > 0 ? coachMatrix[0].coachType : '—',
       fakeCloseRate: quickCloseData[0].Unsatisfactory || 0,
       overallUnsat: totalRated > 0 ? ((totalUnsat / totalRated) * 100).toFixed(1) : 0,
       topGrievance: wordCloud.length > 0 ? wordCloud[0].text : '—'
    };

    return {
      kpis, kpisToday, sparklineArray, maxZoneDivValue, maxTrainCatValue, maxShiftVal, options: opt,
      trainMatrix, zoneDivMatrix, uniqueDivsArray, shiftHeatmap, scatterData: finalScatterData, resSpeedBar,
      wateringList, pestDefectTable, coachMatrix, unsatTable, quickCloseData, wordCloud,
      uniqueCatsArray, validRecords, globalKpis,
      dailyTrend, weeklyTrend, monthlyTrend, categoryTrend, topCats, slaTrend
    };
  }, [dbData, filters]);

  const {
    kpis, kpisToday, sparklineArray, maxZoneDivValue, maxTrainCatValue, maxShiftVal, options, trainMatrix, zoneDivMatrix, uniqueDivsArray, shiftHeatmap, scatterData, resSpeedBar,
    wateringList, pestDefectTable, coachMatrix, unsatTable, quickCloseData, wordCloud,
    uniqueCatsArray, validRecords, globalKpis,
    dailyTrend, weeklyTrend, monthlyTrend, categoryTrend, topCats, slaTrend
  } = aggregated;

  // ── FILE UPLOAD
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target.result;
        const workbook = window.XLSX.read(buffer, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawArray = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawArray || rawArray.length === 0) throw new Error('File is empty.');

        let headerRowIdx = -1;
        let colMap = {};
        const keyHeaders = ['complaintrefno', 'refno', 'createdon', 'comptypename'];

        for (let i = 0; i < Math.min(100, rawArray.length); i++) {
          const row = rawArray[i];
          if (!row || !Array.isArray(row)) continue;
          const cleanRow = row.map((c) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim());
          const matchCount = keyHeaders.filter((kh) => cleanRow.includes(kh)).length;
          if (matchCount >= 2) {
            headerRowIdx = i;
            cleanRow.forEach((val, colIdx) => { if (val) colMap[val] = colIdx; });
            break;
          }
        }

        if (headerRowIdx === -1) {
          showToast('Standard headers not found. Check if this is a Raw Data file.');
          setIsUploading(false); e.target.value = null; return;
        }

        const getValue = (row, key) => {
          const idx = colMap[key];
          return (idx !== undefined && row[idx] !== undefined) ? row[idx] : null;
        };

        const idMap = new Map();
        const baseRecords = dbData.records || [];
        baseRecords.forEach((r) => idMap.set(String(r.id), r));

        let newRecordsAdded = 0;

        for (let i = headerRowIdx + 1; i < rawArray.length; i++) {
          const row = rawArray[i];
          if (!row || row.length === 0) continue;

          try {
            const refNo = getValue(row, 'complaintrefno') || getValue(row, 'refno');
            const createdOn = getValue(row, 'createdon');
            if (!refNo || !createdOn) continue;

            const recordId = String(refNo).trim();
            if (idMap.has(recordId)) continue;

            const parsedObj = parseRawDate(createdOn);
            if (!parsedObj) continue;

            const rawCat = getValue(row, 'comptypename') || 'Uncategorized';
            const rawSubCat = getValue(row, 'subtypename') || '';
            const rawDesc = getValue(row, 'complaintdesc') || '';

            const isPest = rawSubCat.toLowerCase().includes('cockroach') || rawSubCat.toLowerCase().includes('rodent') ||
              rawSubCat.toLowerCase().includes('rat') || rawSubCat.toLowerCase().includes('pest') ||
              rawDesc.toLowerCase().includes('cockroach') || rawDesc.toLowerCase().includes('rodent');

            const trainStation = getValue(row, 'trainstation');
            const trainReportName = getValue(row, 'trainnameforreport');
            const rawTrain = String(trainStation || '') + ' ' + String(trainReportName || '');
            const matchTrain = rawTrain.match(/\b\d{4,5}\b/);
            const trainNo = matchTrain ? matchTrain[0] : (trainStation ? String(trainStation) : 'Unknown');

            idMap.set(recordId, {
              id: recordId,
              date: parsedObj.date, month: parsedObj.month, hour: parsedObj.hour, shift2: parsedObj.shift2,
              category: String(rawCat).trim(),
              subType: String(rawSubCat).trim(),
              isPest,
              train: trainNo,
              nextStation: String(getValue(row, 'nextstation') || 'Unknown').trim(),
              rating: String(getValue(row, 'rating') || 'Not Rated').trim(),
              status: String(getValue(row, 'status') || getValue(row, 'finalstatus') || 'Unknown').trim(),
              zone: String(getValue(row, 'zonecode') || 'Unknown').trim(),
              ownZone: String(getValue(row, 'ownzonecode') || getValue(row, 'coachowningrailway') || 'Unknown').trim(),
              div: String(getValue(row, 'divcode') || 'Unknown').trim(),
              coachType: String(getValue(row, 'coachtype') || 'Unknown').trim(),
              coachNo: String(getValue(row, 'coachno') || getValue(row, 'physicalcoachno') || 'Unknown').trim(),
              sla: String(getValue(row, 'sla') || 'Unknown').trim(),
              resTimeMins: parseResolutionTime(getValue(row, 'diff') || getValue(row, 'avgcdiff')),
              desc: String(rawDesc).substring(0, 200),
              remarks: String(getValue(row, 'remarks') || '').substring(0, 200),
              feedbackRemark: String(getValue(row, 'feedbackremark') || '').substring(0, 200)
            });
            newRecordsAdded++;
          } catch (rowErr) { console.warn('Row skipped', rowErr); }
        }

        if (newRecordsAdded > 0) {
          const newData = { records: Array.from(idMap.values()) };
          applyDashboardData(newData, 'Saved to Cache');
          localStorage.setItem('railmadad_local_sync', JSON.stringify(newData));
          showToast(`Appended ${newRecordsAdded} new records.`);

          if (supabaseClient) {
            try {
              const { error } = await supabaseClient.from('railmadad_sync').upsert(
                { id: 1, json_data: newData, last_updated: new Date().toISOString() },
                { onConflict: 'id' }
              );
              if (!error) setLastSync(new Date().toLocaleTimeString() + ' (Cloud Synced)');
            } catch { console.warn('Cloud save issue'); }
          }
        } else {
          showToast('No new records detected.');
        }
      } catch (err) {
        console.error(err);
        showToast('Error processing file format.');
      }
      setIsUploading(false);
      e.target.value = null;
    };
    reader.readAsArrayBuffer(file);
  };

  const executeHardReset = async () => {
    setShowResetModal(false);
    showToast('Wiping database...');
    applyDashboardData(initialRawDatabase, 'Wiped Clean');
    localStorage.removeItem('railmadad_local_sync');
    if (supabaseClient) {
      try {
        await supabaseClient.from('railmadad_sync').upsert(
          { id: 1, json_data: initialRawDatabase, last_updated: new Date().toISOString() },
          { onConflict: 'id' }
        );
      } catch { /* no-op */ }
    }
  };

  // ── EXPORT FUNCTIONS
  const buildExportRows = () => {
    return validRecords.map((r) => ({
      'Ref No': r.id, Date: r.date, Hour: r.hour, 'Time Bucket': r.shift2,
      Train: r.train, 'Coach Type': r.coachType, 'Coach No': r.coachNo,
      Zone: r.zone, 'Own Zone': r.ownZone, Division: r.div,
      Category: r.category, 'Sub Type': r.subType,
      'Next Station': r.nextStation, Status: r.status, SLA: r.sla, Rating: r.rating,
      'Resolution (mins)': r.resTimeMins, Description: r.desc, Remarks: r.remarks,
      'Feedback Remark': r.feedbackRemark
    }));
  };

  const exportCSV = () => {
    setShowExportMenu(false);
    if (!validRecords.length) { showToast('Nothing to export.'); return; }
    const rows = buildExportRows();
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((h) => {
        const v = row[h] === null || row[h] === undefined ? '' : String(row[h]);
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `railmadad_export_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${rows.length} rows as CSV.`);
  };

  const exportExcel = () => {
    setShowExportMenu(false);
    if (!validRecords.length) { showToast('Nothing to export.'); return; }
    const rows = buildExportRows();
    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Records');
    window.XLSX.writeFile(wb, `railmadad_export_${todayStr}.xlsx`);
    showToast(`Exported ${rows.length} rows as Excel.`);
  };

  const exportPDF = () => {
    setShowExportMenu(false);
    if (!validRecords.length) { showToast('Nothing to export.'); return; }
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('RailMadad Dashboard — Filtered Export', 14, 14);
    doc.setFontSize(9);
    doc.text(`Generated: ${formatHumanDate(todayStr)}  |  Rows: ${validRecords.length}`, 14, 20);
    doc.text(`Date Range: ${formatHumanDate(filters.fromDate)} → ${formatHumanDate(filters.toDate)}`, 14, 25);

    const headers = ['Ref No', 'Date', 'Train', 'Category', 'Coach', 'Status', 'SLA', 'Rating'];
    const body = validRecords.slice(0, 1000).map((r) => [
      r.id, formatHumanDate(r.date), r.train, formatCategory(r.category), `${r.coachType}-${r.coachNo}`, r.status, r.sla, r.rating
    ]);
    doc.autoTable({
      head: [headers], body, startY: 30,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });
    doc.save(`railmadad_export_${todayStr}.pdf`);
    showToast(`Exported ${Math.min(1000, validRecords.length)} rows as PDF.`);
  };

  // ──────────────────────────────────────────────────────────────────
  // RENDER GATES
  // ──────────────────────────────────────────────────────────────────
  if (!authChecked || !supabaseClient) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onLogin={() => { /* auth listener will handle */ }} supabaseClient={supabaseClient} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <p className="text-slate-600 dark:text-slate-300 font-bold text-lg animate-pulse tracking-wide uppercase">
            Booting Railway Dashboard...
          </p>
        </div>
      </div>
    );
  }

  const baseTrendData = trendsGranularity === 'day' ? dailyTrend : trendsGranularity === 'week' ? weeklyTrend : monthlyTrend;

  const trendData = baseTrendData.map((d, i, arr) => {
    const prev = arr[i - 1]?.count ?? -1;
    const next = arr[i + 1]?.count ?? -1;
    const isPeak = d.count > prev && d.count >= next && d.count > 0;
    return { ...d, peakLabel: isPeak ? d.count : '' };
  });

  const granularityLabel = trendsGranularity === 'day' ? 'Daily' : trendsGranularity.charAt(0).toUpperCase() + trendsGranularity.slice(1) + 'ly';
  const currentCategoryTrend = categoryTrend[trendsGranularity] || [];
  const categoryTrendChartData = currentCategoryTrend.map((row) => {
    const obj = { date: row.date };
    topCats.forEach((c) => { obj[String(c)] = row[c] || 0; });
    return obj;
  });

  const currentSlaTrend = slaTrend[trendsGranularity] || [];
  const axisStyle = { fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#64748b' };
  const gridStroke = theme === 'dark' ? '#1e293b' : '#f1f5f9';
  const maxWateringVal = wateringList.length > 0 ? Math.max(...wateringList.map(w => w.count)) : 1;
  const maxAvgMins = resSpeedBar.length > 0 ? Math.max(...resSpeedBar.map(d => d.avgMins)) : 1;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row font-sans text-slate-900 dark:text-slate-100 relative transition-colors">
      
      {/* Global CSS Inject for Custom Scrollbars */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; }
      `}</style>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-800 dark:bg-slate-700 text-white px-5 py-3 rounded-xl shadow-2xl z-50 flex items-center border border-slate-700 dark:border-slate-600 animate-slide-up">
          <Sparkles className="w-4 h-4 mr-2 text-indigo-400" />
          <span className="font-medium text-sm leading-snug max-w-sm">{toastMessage}</span>
        </div>
      )}

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl max-w-sm w-full border border-slate-100 dark:border-slate-800">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Wipe Database?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Permanently delete all raw data locally and in cloud.
            </p>
            <div className="flex space-x-3">
              <button onClick={() => setShowResetModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button onClick={executeHardReset} className="flex-1 py-2.5 rounded-lg bg-rose-600 text-white font-semibold text-sm hover:bg-rose-700 shadow-sm shadow-rose-200">
                Yes, Wipe Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className={`fixed md:sticky top-0 left-0 z-40 w-64 h-screen transition-transform transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm flex flex-col`}>
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-br from-indigo-700 to-indigo-800">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center">
              <TrainFront className="w-5 h-5 mr-2" /> RailMadad
            </h1>
            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-1">SEE Division Engine</p>
          </div>
          <button className="md:hidden text-white" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <label className="flex items-center justify-center w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 cursor-pointer transition-colors active:scale-95">
            {isUploading ? (
              <span className="animate-pulse flex items-center text-sm font-bold">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning...
              </span>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                <span className="text-sm font-bold">Append Raw Export</span>
                <input type="file" accept=".csv, .xlsx" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
              </>
            )}
          </label>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 text-center font-medium italic">
            Status: {lastSync}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-2">Modules</p>
          {navItemsList.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 shadow-sm border border-indigo-100 dark:border-indigo-900'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center justify-center w-full py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center w-full py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </button>
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center justify-center w-full py-2 text-[11px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Wipe Entire System
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col max-w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        <header className="md:hidden bg-indigo-700 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
          <h1 className="text-lg font-bold flex items-center"><TrainFront className="w-5 h-5 mr-2" /> RM Dashboard</h1>
          <button onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
        </header>

        {/* HEADER + FILTERS */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-20 sticky top-0 shadow-sm">
          <div className="px-4 md:px-8 py-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
              {navItemsList.find((i) => i.id === activeTab)?.label}
            </h2>
            <div className="flex items-center space-x-2">
              {/* Export Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center text-sm font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" /> Export
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)}></div>
                    <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-30">
                      <button onClick={exportCSV} className="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <FileText className="w-4 h-4 mr-2 text-slate-400" /> CSV
                      </button>
                      <button onClick={exportExcel} className="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" /> Excel
                      </button>
                      <button onClick={exportPDF} className="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <FileBarChart className="w-4 h-4 mr-2 text-rose-500" /> PDF
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center text-sm font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
              >
                <Filter className="w-4 h-4 mr-2" /> Filters
                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="px-4 md:px-8 py-4 bg-slate-50 dark:bg-slate-900/60 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 border-b border-slate-200 dark:border-slate-800 relative z-30">
              
              <div className="col-span-2 flex items-end">
                <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-1 border border-slate-300 dark:border-slate-700 w-full justify-between shadow-inner">
                  {['Today', 'This Week', 'This Month', 'Overall'].map(preset => (
                    <button
                      key={preset}
                      onClick={() => handleDatePreset(preset)}
                      className={`flex-1 px-2 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition-all truncate ${
                        datePreset === preset
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col relative">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">From Date</span>
                <div className="relative">
                  <div className="text-sm border border-slate-200 dark:border-slate-700 rounded p-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-between pointer-events-none">
                     <span className="truncate">{formatHumanDate(filters.fromDate)}</span>
                     <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </div>
                  <input type="date" value={filters.fromDate} onChange={(e) => updateFilter('fromDate', e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </div>
              </div>
              <div className="flex flex-col relative">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">To Date</span>
                <div className="relative">
                  <div className="text-sm border border-slate-200 dark:border-slate-700 rounded p-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-between pointer-events-none">
                     <span className="truncate">{formatHumanDate(filters.toDate)}</span>
                     <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </div>
                  <input type="date" value={filters.toDate} onChange={(e) => updateFilter('toDate', e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </div>
              </div>
              
              {[
                { lbl: 'Time Bucket', key: 'timeBucket', src: 'buckets' },
                { lbl: 'Train', key: 'train', src: 'trains' },
                { lbl: 'Coach Type', key: 'coachType', src: 'coaches' },
                { lbl: 'Zone', key: 'zone', src: 'zones' },
                { lbl: 'Location', key: 'location', src: 'locations' },
                { lbl: 'Category', key: 'category', src: 'cats' },
                { lbl: 'SLA', key: 'sla', src: 'slas' },
                { lbl: 'Rating', key: 'rating', src: 'ratings' },
                { lbl: 'Status', key: 'status', src: 'statuses' },
              ].map((f) => (
                <MultiSelectDropdown 
                   key={f.key} 
                   id={f.key}
                   activeId={activeDropdown}
                   setActiveId={setActiveDropdown}
                   label={f.lbl} 
                   options={Array.from(options[f.src] || []).sort()} 
                   selected={filters[f.key]} 
                   onChange={(val) => updateFilter(f.key, val)} 
                />
              ))}
            </div>
          )}
        </div>

        {/* MAIN CONTENT */}
        <div className="p-4 md:p-8 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
          {dbData.records.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-16 mt-10 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center max-w-2xl mx-auto shadow-sm">
              <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-950/40 rounded-full flex items-center justify-center mb-6">
                <FileSpreadsheet className="w-12 h-12 text-indigo-400" />
              </div>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Dashboard Empty</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-md leading-relaxed font-medium">
                Upload your Raw CSV/Excel from the sidebar to populate the analytics modules.
              </p>
            </div>
          ) : kpis.total === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-12 mt-10 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center max-w-2xl mx-auto shadow-sm">
              <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">No Match Found</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">Adjust your filters to see results.</p>
            </div>
          ) : (
            <>
              {/* TAB 1: EXECUTIVE OVERVIEW */}
              {activeTab === 'executive' && (
                <div className="space-y-8 animate-fade-in">
                  
                  {/* KPI TILES */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
                    <MetricCard title="Total Volume" value={kpis.total} todayValue={kpisToday.total} icon={Activity} accent="bg-indigo-600" sparkColor="#4f46e5" sparklineData={sparklineArray} dataKey="total" onTodayClick={() => handleDatePreset('Today')} />
                    <MetricCard title="Bedroll" value={kpis.bedroll} todayValue={kpisToday.bedroll} icon={BedDouble} accent="bg-purple-600" sparkColor="#9333ea" sparklineData={sparklineArray} dataKey="bedroll" onTodayClick={() => handleDatePreset('Today')} />
                    <MetricCard title="Cleanliness" value={kpis.clean} todayValue={kpisToday.clean} icon={Sparkles} accent="bg-emerald-600" sparkColor="#10b981" sparklineData={sparklineArray} dataKey="clean" onTodayClick={() => handleDatePreset('Today')} />
                    <MetricCard title="Watering" value={kpis.water} todayValue={kpisToday.water} icon={Droplets} accent="bg-sky-600" sparkColor="#0284c7" sparklineData={sparklineArray} dataKey="water" onTodayClick={() => handleDatePreset('Today')} />
                    <MetricCard title="Maintenance" value={kpis.maint} todayValue={kpisToday.maint} icon={Wrench} accent="bg-amber-600" sparkColor="#d97706" sparklineData={sparklineArray} dataKey="maint" onTodayClick={() => handleDatePreset('Today')} />
                  </div>

                  {/* VISUAL 1: MAJOR COMPLAINT GIVING TRAINS MATRIX */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                      <h3 className="text-base font-bold text-slate-800 dark:text-white">Major Complaint Giving Trains</h3>
                    </div>
                    <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                      <table className="min-w-full text-left border-collapse text-sm">
                        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10 shadow-sm">
                          <tr className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-widest">
                            <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Train</th>
                            {uniqueCatsArray.map((c) => (
                              <th key={String(c)} className="p-4 font-bold border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">{formatCategory(c)}</th>
                            ))}
                            <th className="p-4 font-black border-b border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white">Total</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                          {trainMatrix.slice(0, 50).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                              <td className="p-4 font-bold flex items-center text-slate-900 dark:text-white whitespace-nowrap">
                                <TrainFront className="w-4 h-4 mr-2 text-indigo-400" />{row.train || '—'}
                              </td>
                              {uniqueCatsArray.map((c) => {
                                const val = row[c] || 0;
                                const { bg, text } = getHeatmapColor(val, maxTrainCatValue, 'red');
                                return (
                                  <td key={String(c)} style={{ backgroundColor: bg, color: text }} className="p-4 font-medium transition-colors">
                                    {val || '—'}
                                  </td>
                                );
                              })}
                              <td className="p-4 font-black text-indigo-600 dark:text-indigo-400">{row.Total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* VISUAL 2: MODERN SAAS HEATMAP (FOREIGN ZONES VS DIVISION) */}
                  <Card title="Foreign Zone Impact Matrix (Owning Zone vs. Current Division)">
                    <div className="overflow-x-auto custom-scrollbar pb-2">
                      <table className="min-w-full text-left border-separate border-spacing-1.5 text-sm">
                        <thead>
                          <tr className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-widest">
                            <th className="p-2 font-bold whitespace-nowrap">Owning Zone</th>
                            {uniqueDivsArray.map((div) => (
                              <th key={String(div)} className="p-2 font-bold text-center whitespace-nowrap">{div}</th>
                            ))}
                            <th className="p-2 font-black text-center text-slate-800 dark:text-white">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {zoneDivMatrix.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="group">
                              <td className="p-2 font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap flex items-center">
                                <LucideMap className="w-4 h-4 mr-2 text-indigo-400" />
                                {row.zone || '—'}
                              </td>
                              {uniqueDivsArray.map((div) => {
                                const val = row[div] || 0;
                                const colorConfig = getHeatmapColor(val, maxZoneDivValue, 'red');

                                return (
                                  <td key={String(div)} className="p-0">
                                    <div 
                                      className={`h-9 flex items-center justify-center rounded-lg font-medium text-xs transition-transform duration-200 group-hover:scale-[1.02] cursor-default ${val > 0 ? 'shadow-sm ring-1 ring-black/5 dark:ring-white/5' : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600'}`}
                                      style={val > 0 ? { backgroundColor: colorConfig.bg, color: colorConfig.text } : {}}
                                      title={`${row.zone} in ${div}: ${val} complaints`}
                                    >
                                      {val || '—'}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="p-2 text-center">
                                <span className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 font-black text-indigo-600 dark:text-indigo-400 text-xs shadow-sm">
                                  {row.Total}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                </div>
              )}

              {/* TAB 2: OPERATIONS */}
              {activeTab === 'operations' && (
                <div className="space-y-8 animate-fade-in">
                  
                  {/* KPI TILES FOR TAB 2 */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <MetricCard title="Avg Resolution Time" value={globalKpis.avgResTime} icon={Clock} accent="bg-blue-600" />
                    <MetricCard title="SLA Breach Rate" value={`${globalKpis.slaBreachRate}%`} icon={AlertTriangle} accent="bg-rose-600" infoText="Percentage of tickets in this time range taking > 30 minutes to resolve." />
                    <MetricCard title="Worst Shift" value={globalKpis.worstShift} icon={Moon} accent="bg-purple-600" />
                    <MetricCard title="Pending / Open" value={globalKpis.openTickets} icon={Target} accent="bg-amber-600" />
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                      <h3 className="text-base font-bold text-slate-800 dark:text-white">2-Hourly Shift Heatmap</h3>
                    </div>
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="min-w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                            <th className="p-4 font-bold">Time Bucket</th>
                            {uniqueCatsArray.slice(0, 6).map((c) => <th key={String(c)} className="p-4 font-bold">{formatCategory(c)}</th>)}
                            <th className="p-4 font-bold text-slate-800 dark:text-white">Total</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                          {shiftHeatmap.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                              <td className="p-4 font-bold text-slate-800 dark:text-white flex items-center">
                                <Clock className="w-4 h-4 mr-2 text-slate-400" />{row.shift || '—'}
                              </td>
                              {uniqueCatsArray.slice(0, 6).map((c) => {
                                const val = row[c] || 0;
                                const { bg, text } = getHeatmapColor(val, maxShiftVal, 'red');
                                return (
                                  <td key={String(c)} style={{ backgroundColor: bg, color: text }} className="p-4 font-medium transition-colors">
                                    {val || '—'}
                                  </td>
                                );
                              })}
                              <td className="p-4 font-black text-indigo-600 dark:text-indigo-400">{row.Total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card title="SLA & Resolution Efficiency">
                      <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                            <XAxis 
                              type="number" 
                              dataKey="categoryIndex" 
                              allowDuplicatedCategory={false} 
                              domain={[-0.5, uniqueCatsArray.length - 0.5]}
                              ticks={uniqueCatsArray.map((_, i) => i)}
                              tickFormatter={(val) => {
                                const cat = uniqueCatsArray[Math.round(val)];
                                return cat ? formatCategory(cat) : '';
                              }}
                              tick={{ ...axisStyle, angle: -45, textAnchor: 'end' }} 
                              tickLine={false} 
                              axisLine={false} 
                              height={60} 
                            />
                            <YAxis type="number" dataKey="time" tick={axisStyle} tickFormatter={(v) => `${v}m`} tickLine={false} axisLine={false} />
                            <ZAxis type="category" dataKey="name" />
                            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                            <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: '30m Target', fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }} />
                            <Scatter name="Complaints" data={scatterData}>
                              {scatterData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.time > 30 ? '#ef4444' : '#10b981'} opacity={0.6} />
                              ))}
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card title="Avg Resolution Speed by Category">
                      <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={resSpeedBar} layout="vertical" margin={{ left: 80, right: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={axisStyle} />
                            <YAxis dataKey="category" type="category" tickFormatter={formatCategory} axisLine={false} tickLine={false} tick={axisStyle} dx={-10} />
                            <Tooltip cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }} formatter={(val) => formatTime(val)} labelFormatter={formatCategory} />
                            <Bar dataKey="avgMins" name="Avg Mins" radius={[0, 4, 4, 0]} barSize={20}>
                              {resSpeedBar.map((entry, index) => {
                                const { bg } = getHeatmapColor(entry.avgMins, maxAvgMins, 'red');
                                return <Cell key={`cell-${index}`} fill={bg} />;
                              })}
                              <LabelList dataKey="avgMins" position="right" style={{ fontSize: '11px', fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} formatter={(val) => formatTime(val)} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* TAB 3: TRENDS */}
              {activeTab === 'trends' && (
                <div className="space-y-8 animate-fade-in">
                  
                  {/* KPI TILES FOR TAB 3 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                    <MetricCard 
                      title="WoW Volume Change" 
                      value={Math.abs(globalKpis.wowChange) + '%'} 
                      icon={TrendingUp} 
                      accent={globalKpis.wowChange <= 0 ? 'bg-emerald-600' : 'bg-rose-600'} 
                      extraIcon={globalKpis.wowChange <= 0 ? <ArrowDownRight className="w-6 h-6 text-emerald-500" /> : <ArrowUpRight className="w-6 h-6 text-rose-500" />}
                      infoText="Total complaint volume of the last 7 days compared against the preceding 7 days."
                    />
                    <MetricCard 
                      title="Peak Complaint Day" 
                      value={globalKpis.peakComplaintDay ? globalKpis.peakComplaintDay.count : '0'} 
                      todayValue={globalKpis.peakComplaintDay ? formatHumanDate(globalKpis.peakComplaintDay.key) : '—'}
                      icon={Activity} 
                      accent="bg-indigo-600" 
                    />
                    <MetricCard title="Avg SLA Compliance" value={`${globalKpis.avgSlaCompliance}%`} icon={CheckCircle} accent="bg-emerald-600" />
                  </div>

                  <Card title={`Complaint Volume Trend (${granularityLabel})`} icon={TrendingUp}>
                    <div className="h-[360px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={trendData} margin={{ top: 25, right: 20, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                          <XAxis dataKey="key" tickFormatter={(val) => trendsGranularity === 'day' ? formatChartDate(val) : val} tick={axisStyle} tickLine={false} axisLine={false} />
                          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                          <Tooltip labelFormatter={(val) => trendsGranularity === 'day' ? formatHumanDate(val) : val} />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#trendGrad)" name="Complaints">
                            <LabelList dataKey="peakLabel" position="top" offset={10} fill={theme === 'dark' ? '#a5b4fc' : '#4f46e5'} fontSize={12} fontWeight="bold" />
                          </Area>
                          {trendsGranularity === 'day' && <Line type="monotone" dataKey="movingAvg" stroke="#f59e0b" strokeWidth={2} dot={false} name="7-Day Moving Avg" />}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card title={`Top 5 Categories Trend (${granularityLabel})`} icon={BarChart}>
                    <div className="h-[360px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={categoryTrendChartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                          <XAxis dataKey="date" tickFormatter={(val) => trendsGranularity === 'day' ? formatChartDate(val) : val} tick={axisStyle} tickLine={false} axisLine={false} />
                          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                          <Tooltip labelFormatter={(val) => trendsGranularity === 'day' ? formatHumanDate(val) : val} />
                          <Legend wrapperStyle={{ fontSize: '12px' }} formatter={(val) => formatCategory(val)} />
                          {topCats.map((cat, i) => (
                            <Area key={String(cat)} type="monotone" name={formatCategory(cat)} dataKey={String(cat)} stackId="1" stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} strokeWidth={1} dot={false} />
                          ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card title={`SLA Performance Trend (${granularityLabel})`} icon={Target}>
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={currentSlaTrend} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                          <XAxis dataKey="date" tickFormatter={(val) => trendsGranularity === 'day' ? formatChartDate(val) : val} tick={axisStyle} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="left" tick={axisStyle} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(tick) => `${tick}%`} domain={[0, 100]} />
                          <Tooltip labelFormatter={(val) => trendsGranularity === 'day' ? formatHumanDate(val) : val} />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Bar yAxisId="left" dataKey="OnTime" stackId="a" fill="#10b981" name="On Time" />
                          <Bar yAxisId="left" dataKey="Breached" stackId="a" fill="#ef4444" name="Breached" />
                          <Line yAxisId="right" type="monotone" dataKey="Compliance" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Compliance %" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              )}

              {/* TAB 4: ASSETS */}
              {activeTab === 'assets' && (
                <div className="space-y-8 animate-fade-in">
                  
                  {/* KPI TILES FOR TAB 4 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                    <MetricCard 
                      title="Critical Pest Alerts" 
                      value={globalKpis.criticalPests} 
                      icon={Bug} 
                      accent="bg-rose-600" 
                      isCritical={globalKpis.criticalPests > 0} 
                      infoText="Total complaints containing severe health-hazard keywords (Cockroach, Rodent, Pest)." 
                    />
                    <MetricCard title="Top Bottleneck Station" value={globalKpis.topBottleneckStation} icon={LucideMap} accent="bg-sky-600" />
                    <MetricCard title="Worst Coach Class" value={globalKpis.worstCoachClass} icon={TrainFront} accent="bg-purple-600" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card title="Territorial Watering Point Map">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={wateringList} layout="vertical" margin={{ left: 40, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={axisStyle} />
                            <YAxis dataKey="station" type="category" axisLine={false} tickLine={false} tick={axisStyle} dx={-10} />
                            <Tooltip cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }} />
                            <Bar dataKey="count" name="Watering Cases" radius={[0, 6, 6, 0]} barSize={20}>
                               {wateringList.map((entry, index) => {
                                  const { bg } = getHeatmapColor(entry.count, maxWateringVal, 'red');
                                  return <Cell key={`cell-${index}`} fill={bg} />;
                               })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card title="Asset Health (Coach Type vs Category)">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={coachMatrix.slice(0, 15)} layout="vertical" margin={{ left: 40, right: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={axisStyle} />
                            <YAxis dataKey="coachType" type="category" axisLine={false} tickLine={false} tick={axisStyle} dx={-10} />
                            <Tooltip cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }} />
                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} formatter={formatCategory} />
                            {topCats.map((cat, i) => (
                              <Bar key={String(cat)} dataKey={String(cat)} name={formatCategory(cat)} stackId="a" fill={COLORS[i % COLORS.length]} barSize={20} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-100 dark:border-rose-900/40 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-rose-100 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 flex items-center">
                      <Bug className="w-5 h-5 text-rose-600 mr-2" />
                      <h3 className="text-base font-bold text-rose-900 dark:text-rose-300">Pest Control & Coach Defect Tracker</h3>
                    </div>
                    {pestDefectTable.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">No target coaches identified.</div>
                    ) : (
                      <div className="overflow-x-auto max-h-96 custom-scrollbar">
                        <table className="min-w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm z-10">
                            <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                              <th className="p-4 font-bold">Ref No.</th>
                              <th className="p-4 font-bold">Date</th>
                              <th className="p-4 font-bold">Coach Type & No.</th>
                              <th className="p-4 font-bold">Train Details</th>
                              <th className="p-4 font-bold">Sub-Category & Desc.</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                            {pestDefectTable.map((row, idx) => (
                              <tr key={idx} className={`hover:bg-rose-50/50 dark:hover:bg-rose-950/20 ${row.isPest ? 'bg-rose-50/30 dark:bg-rose-900/10' : ''}`}>
                                <td className="p-4 font-mono text-[10px] text-slate-400">{row.id}</td>
                                <td className="p-4 font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatHumanDate(row.date)}</td>
                                <td className="p-4 font-bold whitespace-nowrap text-indigo-700 dark:text-indigo-300">{row.coachType} - {row.coachNo || '—'}</td>
                                <td className="p-4 font-bold text-slate-700 dark:text-slate-200">{row.train || '—'}</td>
                                <td className="p-4 max-w-md py-4">
                                  <span className={`font-bold ${row.isPest ? 'text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                    {formatCategory(row.subType)}
                                    {row.isPest && <span className="ml-2 inline-block bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">PEST FLAG</span>}
                                  </span>
                                  <div className={`text-xs mt-1 ${row.isPest ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-slate-500'}`}>
                                    {row.desc || '—'}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: SENTIMENT */}
              {activeTab === 'sentiment' && (
                <div className="space-y-8 animate-fade-in">
                  
                  {/* KPI TILES FOR TAB 5 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                    <MetricCard 
                      title='"Fake Close" Rate' 
                      value={`${globalKpis.fakeCloseRate}%`} 
                      icon={AlertTriangle} 
                      accent="bg-rose-600" 
                      infoText="Percentage of tickets closed in under 15 minutes that resulted in an 'Unsatisfactory' passenger rating."
                    />
                    <MetricCard title="Overall Unsatisfactory" value={`${globalKpis.overallUnsat}%`} icon={ThumbsDown} accent="bg-orange-600" />
                    <MetricCard title="Top Passenger Grievance" value={globalKpis.topGrievance} icon={MessageSquareWarning} accent="bg-indigo-600" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm h-[400px] overflow-hidden flex flex-col">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Sentiment Word Cloud</h3>
                      <div className="flex-1 flex flex-wrap content-start items-center justify-center gap-3 overflow-y-auto custom-scrollbar pr-2">
                        {wordCloud.map((w, i) => (
                          <span
                            key={i}
                            style={{ fontSize: `${w.fontSize}px`, color: COLORS[i % COLORS.length] }}
                            className="font-bold opacity-80 hover:opacity-100 cursor-default transition-opacity leading-none"
                          >
                            {w.text}
                          </span>
                        ))}
                      </div>
                    </div>

                    <Card title='"Quick Close" Audit — Resolution Time vs Satisfaction (%)'>
                      <div className="h-[340px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={quickCloseData} margin={{ left: 0, right: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisStyle} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(tick) => `${tick}%`} domain={[0, 100]} />
                            <Tooltip cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }} formatter={(val) => `${val}%`} />
                            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                            <Bar dataKey="Satisfactory" stackId="a" fill="#10b981" barSize={40} />
                            <Bar dataKey="Neutral" stackId="a" fill="#cbd5e1" barSize={40} />
                            <Bar dataKey="Unsatisfactory" stackId="a" fill="#ef4444" barSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-rose-50 dark:bg-rose-950/30 flex items-center">
                      <MessageSquareWarning className="w-5 h-5 text-rose-600 mr-2" />
                      <h3 className="text-base font-bold text-rose-900 dark:text-rose-300">Unsatisfactory Feedback Tracker</h3>
                    </div>
                    {unsatTable.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">No results found.</div>
                    ) : (
                      <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                        <table className="min-w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm z-10">
                            <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                              <th className="p-4 font-bold">Ref No.</th>
                              <th className="p-4 font-bold">Train</th>
                              <th className="p-4 font-bold">Disposal Time</th>
                              <th className="p-4 font-bold">Passenger Desc. & Feedback</th>
                              <th className="p-4 font-bold">Closing Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                            {unsatTable.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="p-4 font-mono text-[10px] text-slate-400 whitespace-nowrap">{row.id}</td>
                                <td className="p-4 font-bold text-slate-800 dark:text-white whitespace-nowrap">{row.train || '—'}</td>
                                <td className="p-4 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatTime(row.resTimeMins)}</td>
                                <td className="p-4 text-xs max-w-sm py-4">
                                  <ExpandableText text={cleanFeedbackText(row.desc, row.feedbackRemark)} />
                                </td>
                                <td className="p-4 text-xs text-indigo-700 dark:text-indigo-300 max-w-xs">{row.remarks || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: DATA DICTIONARY */}
              {activeTab === 'dictionary' && (
                <div className="space-y-8 animate-fade-in">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center">
                      <BookOpen className="w-5 h-5 text-indigo-600 mr-2" />
                      <h3 className="text-base font-bold text-slate-800 dark:text-white">Data Dictionary & Glossary</h3>
                    </div>
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="min-w-full text-left border-collapse">
                        <thead className="bg-white dark:bg-slate-900">
                          <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                            <th className="p-4 font-bold w-1/4">Metric / Chart Name</th>
                            <th className="p-4 font-bold w-1/3">Definition</th>
                            <th className="p-4 font-bold">Calculation Logic / SLA Rule</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="p-4 font-bold text-slate-900 dark:text-white">SLA Compliance Trend</td>
                            <td className="p-4 text-slate-600 dark:text-slate-400">Tracks the daily proportion of tickets resolved within the target timeframe.</td>
                            <td className="p-4 font-mono text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10">Resolution Time ≤ 30 mins = On Time (Green)</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="p-4 font-bold text-slate-900 dark:text-white">Sentiment Word Cloud</td>
                            <td className="p-4 text-slate-600 dark:text-slate-400">Highlights the most frequent passenger-generated nouns and adjectives.</td>
                            <td className="p-4 font-mono text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10">Excludes standard stop-words and 'AI Generated Complaint Description'</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="p-4 font-bold text-slate-900 dark:text-white">Territorial Watering Map</td>
                            <td className="p-4 text-slate-600 dark:text-slate-400">Identifies stations causing cascading watering shortages.</td>
                            <td className="p-4 font-mono text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10">Filtered strictly where compTypeName = 'Watering'</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="p-4 font-bold text-slate-900 dark:text-white">"Fake Close" Rate</td>
                            <td className="p-4 text-slate-600 dark:text-slate-400">Percentage of tickets closed suspiciously fast that still resulted in passenger dissatisfaction.</td>
                            <td className="p-4 font-mono text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10">(Unsatisfactory &lt; 15m) / (Total &lt; 15m) * 100</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="p-4 font-bold text-slate-900 dark:text-white">WoW Volume Change</td>
                            <td className="p-4 text-slate-600 dark:text-slate-400">Week-over-week percentage shift in total complaint volume.</td>
                            <td className="p-4 font-mono text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10">((Current 7 Days - Prev 7 Days) / Prev 7 Days) * 100</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="p-4 font-bold text-slate-900 dark:text-white">Critical Pest Alerts</td>
                            <td className="p-4 text-slate-600 dark:text-slate-400">Total volume of hygiene complaints containing severe health-hazard keywords.</td>
                            <td className="p-4 font-mono text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10">LIKE '%Cockroach%' OR '%Rodent%' OR '%Pest%'</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="p-4 font-bold text-slate-900 dark:text-white">Avg Resolution Time</td>
                            <td className="p-4 text-slate-600 dark:text-slate-400">Global average time elapsed from ticket creation to final closure status.</td>
                            <td className="p-4 font-mono text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10">AVG(Disposal Time Difference in Minutes)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}