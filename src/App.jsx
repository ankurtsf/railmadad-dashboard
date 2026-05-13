import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import {
  LayoutDashboard, TrainFront, Clock, MessageSquareWarning,
  Sparkles, Menu, X, AlertTriangle, Upload, Calendar, Trash2,
  FileSpreadsheet, Bug, Map as LucideMap, Filter, ChevronDown, Loader2,
  Target, Moon, Sun, Download, TrendingUp, LogOut, Lock, Mail,
  Eye, EyeOff, FileText, FileBarChart
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ──────────────────────────────────────────────────────────────────
// CONFIG (Note: in production, move these to env variables)
// ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://npfuxifktdmxmzprfcxm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZnV4aWZrdGRteG16cHJmY3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MjMwMDMsImV4cCI6MjA5NDE5OTAwM30.cCheIUxTAQWyoVyIwOLRd5usiyFI-q2GIn3A9NPFL78';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981', '#f43f5e', '#a855f7', '#ec4899', '#14b8a6'];

// Initial empty database
const initialRawDatabase = { records: [] };

// Word cloud stopwords
const STOP_WORDS = new Set([
  'and', 'the', 'was', 'for', 'that', 'with', 'from', 'this', 'have', 'not',
  'are', 'but', 'has', 'had', 'been', 'very', 'they', 'will', 'coach', 'train',
  'seat', 'berth', 'number', 'passenger', 'is', 'it', 'to', 'in', 'of', 'on'
]);

// ──────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────────────────────────────
const navItemsList = [
  { id: 'executive', label: 'Executive Overview', icon: LayoutDashboard },
  { id: 'operations', label: 'Operations & Time', icon: Clock },
  { id: 'trends', label: 'Trends Over Time', icon: TrendingUp },
  { id: 'assets', label: 'Root Cause & Assets', icon: Target },
  { id: 'sentiment', label: 'Passenger Sentiment', icon: MessageSquareWarning },
];

// ──────────────────────────────────────────────────────────────────
// REUSABLE COMPONENTS
// ──────────────────────────────────────────────────────────────────
const MetricCard = ({ title, value, icon: Icon, accent }) => (
  <div className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between transition-colors">
    <div className="flex justify-between items-start mb-2">
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{title}</p>
        <h3 className="text-3xl font-black text-slate-900 dark:text-white">{value}</h3>
      </div>
      <div className={`p-2.5 rounded-lg ${accent}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
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

// ──────────────────────────────────────────────────────────────────
// LOGIN COMPONENT
// ──────────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
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
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(''); setInfo(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mode === 'signin' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mode === 'signup' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="you@railway.gov.in"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium p-3 rounded-lg">
                {error}
              </div>
            )}
            {info && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-medium p-3 rounded-lg">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-5">
            Secured by Supabase Auth. Your session is encrypted end-to-end.
          </p>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// MAIN APP
// ──────────────────────────────────────────────────────────────────
export default function App() {
  // Auth state
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Theme state
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('railmadad_theme') || 'light';
  });

  // UI state
  const [activeTab, setActiveTab] = useState('executive');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState('Initializing...');
  const [dbData, setDbData] = useState(initialRawDatabase);
  const [toastMessage, setToastMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [trendsGranularity, setTrendsGranularity] = useState('day'); // day | week | month

  // Filters state
  const todayStr = new Date().toISOString().split('T')[0];
  const lastMonthStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [filters, setFilters] = useState({
    fromDate: lastMonthStr, toDate: todayStr,
    timeBucket: 'All', train: 'All', coachType: 'All', zone: 'All', location: 'All',
    category: 'All', sla: 'All', rating: 'All', status: 'All'
  });

  // ── Theme application
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('railmadad_theme', theme);
  }, [theme]);

  // ── Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setDbData(initialRawDatabase);
  };

  const showToast = (msg) => {
    setToastMessage(String(msg));
    setTimeout(() => setToastMessage(''), 5000);
  };

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const applyDashboardData = (dataObj, syncMessage) => {
    setDbData(dataObj);
    setLastSync(syncMessage);
    if (dataObj.records && dataObj.records.length > 0) {
      const sortedDates = [...dataObj.records].map((r) => r.date).sort();
      setFilters((prev) => ({ ...prev, fromDate: sortedDates[0], toDate: sortedDates[sortedDates.length - 1] }));
    }
  };

  // ── Data loading
  const loadLocalFallback = useCallback(() => {
    try {
      const localDataStr = localStorage.getItem('railmadad_local_sync');
      if (localDataStr) {
        const localData = JSON.parse(localDataStr);
        applyDashboardData(localData, 'Loaded from Local Cache');
      } else {
        setLastSync('Empty');
      }
    } catch {
      setLastSync('Local cache error');
    }
    setIsLoading(false);
  }, []);

  const fetchCloudData = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('railmadad_sync').select('*').eq('id', 1).single();
      if (error) { loadLocalFallback(); return; }
      if (data && data.json_data && data.json_data.records) {
        applyDashboardData(data.json_data, new Date(data.last_updated || Date.now()).toLocaleTimeString());
        localStorage.setItem('railmadad_local_sync', JSON.stringify(data.json_data));
      } else {
        loadLocalFallback();
      }
    } catch {
      loadLocalFallback();
    } finally {
      setIsLoading(false);
    }
  }, [loadLocalFallback]);

  useEffect(() => {
    if (session) fetchCloudData();
  }, [session, fetchCloudData]);

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
      if (r.date < filters.fromDate || r.date > filters.toDate) return false;
      if (filters.timeBucket !== 'All' && r.shift2 !== filters.timeBucket) return false;
      if (filters.train !== 'All' && r.train !== filters.train) return false;
      if (filters.coachType !== 'All' && r.coachType !== filters.coachType) return false;
      if (filters.zone !== 'All' && r.zone !== filters.zone && r.ownZone !== filters.zone) return false;
      if (filters.location !== 'All' && r.nextStation !== filters.location) return false;
      if (filters.category !== 'All' && r.category !== filters.category) return false;
      if (filters.sla !== 'All' && r.sla !== filters.sla) return false;
      if (filters.rating !== 'All' && r.rating !== filters.rating) return false;
      if (filters.status !== 'All' && r.status !== filters.status) return false;
      return true;
    });

    const kpis = { total: validRecords.length, bedroll: 0, clean: 0, water: 0, maint: 0 };
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

    // Trends maps
    const dailyMap = new Map();
    const weeklyMap = new Map();
    const monthlyMap = new Map();
    const categoryTrendMap = new Map();
    const slaTrendMap = new Map();

    validRecords.forEach((r) => {
      const catLow = String(r.category).toLowerCase();
      if (catLow.includes('bedroll') || catLow.includes('linen')) kpis.bedroll++;
      if (catLow.includes('clean') || catLow.includes('dirt')) kpis.clean++;
      if (catLow.includes('water') || catLow.includes('plumb')) kpis.water++;
      if (catLow.includes('maintain') || catLow.includes('coach') || catLow.includes('equip')) kpis.maint++;

      uniqueCats.add(String(r.category));

      if (!trainCatMap.has(r.train)) trainCatMap.set(r.train, { train: r.train, Total: 0 });
      const tObj = trainCatMap.get(r.train);
      tObj.Total++; tObj[r.category] = (tObj[r.category] || 0) + 1;

      uniqueDivs.add(String(r.div));
      if (!zoneDivMap.has(r.ownZone)) zoneDivMap.set(r.ownZone, { zone: r.ownZone, Total: 0 });
      const zObj = zoneDivMap.get(r.ownZone);
      zObj.Total++; zObj[r.div] = (zObj[r.div] || 0) + 1;

      if (!shiftCatMap.has(r.shift2)) shiftCatMap.set(r.shift2, { shift: r.shift2, Total: 0 });
      const sObj = shiftCatMap.get(r.shift2);
      sObj.Total++; sObj[r.category] = (sObj[r.category] || 0) + 1;

      if (r.resTimeMins > 0) {
        scatterData.push({ category: r.category, time: r.resTimeMins, name: r.id });
        if (!catResMap.has(r.category)) catResMap.set(r.category, { category: r.category, sum: 0, count: 0 });
        const cr = catResMap.get(r.category);
        cr.sum += r.resTimeMins; cr.count++;

        const rateStr = String(r.rating).toLowerCase();
        const rateCat = rateStr.includes('unsatisfactory') ? 'Unsatisfactory' : (rateStr.includes('satisfactory') ? 'Satisfactory' : 'Neutral');
        if (r.resTimeMins < 15) quickCloseMap['< 15m'][rateCat]++;
        else if (r.resTimeMins <= 60) quickCloseMap['15-60m'][rateCat]++;
        else quickCloseMap['> 60m'][rateCat]++;
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

      // Trends
      const dKey = r.date;
      const wKey = getWeekKey(r.date);
      const mKey = r.month;
      dailyMap.set(dKey, (dailyMap.get(dKey) || 0) + 1);
      weeklyMap.set(wKey, (weeklyMap.get(wKey) || 0) + 1);
      monthlyMap.set(mKey, (monthlyMap.get(mKey) || 0) + 1);

      // Category trend (top categories by date)
      if (!categoryTrendMap.has(dKey)) categoryTrendMap.set(dKey, { date: dKey });
      const ctObj = categoryTrendMap.get(dKey);
      ctObj[r.category] = (ctObj[r.category] || 0) + 1;

      // SLA trend
      if (!slaTrendMap.has(dKey)) slaTrendMap.set(dKey, { date: dKey, OnTime: 0, Breached: 0 });
      const slaObj = slaTrendMap.get(dKey);
      if (String(r.sla).toLowerCase().includes('breach') || String(r.sla).toLowerCase().includes('miss')) {
        slaObj.Breached++;
      } else {
        slaObj.OnTime++;
      }
    });

    const uniqueCatsArray = Array.from(uniqueCats).sort();
    const uniqueDivsArray = Array.from(uniqueDivs).sort();
    const trainMatrix = Array.from(trainCatMap.values()).sort((a, b) => b.Total - a.Total);
    const zoneDivBar = Array.from(zoneDivMap.values()).sort((a, b) => b.Total - a.Total);
    const shiftHeatmap = Array.from(shiftCatMap.values()).sort((a, b) => String(a.shift).localeCompare(String(b.shift)));
    const resSpeedBar = Array.from(catResMap.values())
      .map((c) => ({ category: String(c.category), avgMins: Math.round(c.sum / c.count) }))
      .sort((a, b) => b.avgMins - a.avgMins);
    const wateringList = Array.from(wateringMap.entries())
      .map(([station, count]) => ({ station: String(station), count }))
      .sort((a, b) => b.count - a.count).slice(0, 15);
    const coachMatrix = Array.from(coachCatMap.values()).sort((a, b) => b.Total - a.Total);
    const quickCloseData = [quickCloseMap['< 15m'], quickCloseMap['15-60m'], quickCloseMap['> 60m']];
    const wordCloud = Array.from(wordMap.entries())
      .map(([text, value]) => ({ text: String(text), value }))
      .sort((a, b) => b.value - a.value).slice(0, 40)
      .map((w) => ({ ...w, fontSize: Math.max(12, Math.min(48, w.value * 1.5)) }));

    // Trend arrays
    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ key: date, count }))
      .sort((a, b) => a.key.localeCompare(b.key));
    const weeklyTrend = Array.from(weeklyMap.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => a.key.localeCompare(b.key));
    const monthlyTrend = Array.from(monthlyMap.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => a.key.localeCompare(b.key));

    // Top categories trend (top 5 categories, by date)
    const topCats = Array.from(catResMap.keys()).slice(0, 5);
    const categoryTrend = Array.from(categoryTrendMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const slaTrend = Array.from(slaTrendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      kpis, options: opt,
      trainMatrix, zoneDivBar, uniqueDivsArray, shiftHeatmap, scatterData, resSpeedBar,
      wateringList, pestDefectTable, coachMatrix, unsatTable, quickCloseData, wordCloud,
      uniqueCatsArray, validRecords,
      dailyTrend, weeklyTrend, monthlyTrend, categoryTrend, topCats, slaTrend
    };
  }, [dbData, filters]);

  const {
    kpis, options, trainMatrix, zoneDivBar, uniqueDivsArray, shiftHeatmap, scatterData, resSpeedBar,
    wateringList, pestDefectTable, coachMatrix, unsatTable, quickCloseData, wordCloud,
    uniqueCatsArray, validRecords,
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
        const workbook = XLSX.read(buffer, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawArray = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

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

          try {
            const { error } = await supabase.from('railmadad_sync').upsert(
              { id: 1, json_data: newData, last_updated: new Date().toISOString() },
              { onConflict: 'id' }
            );
            if (!error) setLastSync(new Date().toLocaleTimeString() + ' (Cloud Synced)');
          } catch { console.warn('Cloud save issue'); }
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
    try {
      await supabase.from('railmadad_sync').upsert(
        { id: 1, json_data: initialRawDatabase, last_updated: new Date().toISOString() },
        { onConflict: 'id' }
      );
    } catch { /* no-op */ }
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
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Records');
    XLSX.writeFile(wb, `railmadad_export_${todayStr}.xlsx`);
    showToast(`Exported ${rows.length} rows as Excel.`);
  };

  const exportPDF = () => {
    setShowExportMenu(false);
    if (!validRecords.length) { showToast('Nothing to export.'); return; }
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('RailMadad Dashboard — Filtered Export', 14, 14);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}  |  Rows: ${validRecords.length}`, 14, 20);
    doc.text(`Date Range: ${filters.fromDate} → ${filters.toDate}`, 14, 25);

    const headers = ['Ref No', 'Date', 'Train', 'Category', 'Coach', 'Status', 'SLA', 'Rating'];
    const body = validRecords.slice(0, 1000).map((r) => [
      r.id, r.date, r.train, r.category, `${r.coachType}-${r.coachNo}`, r.status, r.sla, r.rating
    ]);
    autoTable(doc, {
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
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onLogin={() => { /* auth listener will handle */ }} />;
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

  const trendData = trendsGranularity === 'day' ? dailyTrend
    : trendsGranularity === 'week' ? weeklyTrend
      : monthlyTrend;

  // Build category trend pivot for line chart (top 5 categories)
  const categoryTrendChartData = categoryTrend.map((row) => {
    const obj = { date: row.date };
    topCats.forEach((c) => { obj[c] = row[c] || 0; });
    return obj;
  });

  const axisStyle = { fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#64748b' };
  const gridStroke = theme === 'dark' ? '#1e293b' : '#f1f5f9';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row font-sans text-slate-900 dark:text-slate-100 relative transition-colors">
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

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center pt-1 truncate">
            {session?.user?.email}
          </p>
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
            <div className="px-4 md:px-8 py-4 bg-slate-50 dark:bg-slate-900/60 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 border-b border-slate-200 dark:border-slate-800">
              {[
                { lbl: 'From Date', key: 'fromDate', type: 'date' },
                { lbl: 'To Date', key: 'toDate', type: 'date' },
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
                <div key={f.key} className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{f.lbl}</span>
                  {f.type === 'date' ? (
                    <input
                      type="date"
                      value={filters[f.key]}
                      onChange={(e) => updateFilter(f.key, e.target.value)}
                      className="text-sm border border-slate-200 dark:border-slate-700 rounded p-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <select
                      value={filters[f.key]}
                      onChange={(e) => updateFilter(f.key, e.target.value)}
                      className="text-sm border border-slate-200 dark:border-slate-700 rounded p-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="All">All</option>
                      {Array.from(options[f.src] || []).sort().map((o) => (
                        <option key={String(o)} value={String(o)}>{String(o)}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MAIN CONTENT */}
        <div className="p-4 md:p-8 flex-1 overflow-y-auto space-y-8">
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
              {/* TAB: EXECUTIVE OVERVIEW */}
              {activeTab === 'executive' && (
                <div className="space-y-8 animate-fade-in">
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
                    <MetricCard title="Total Volume" value={kpis.total} icon={LayoutDashboard} accent="bg-indigo-600" />
                    <MetricCard title="Bedroll" value={kpis.bedroll} icon={Sparkles} accent="bg-purple-600" />
                    <MetricCard title="Cleanliness" value={kpis.clean} icon={Sparkles} accent="bg-emerald-600" />
                    <MetricCard title="Watering" value={kpis.water} icon={Sparkles} accent="bg-sky-600" />
                    <MetricCard title="Maintenance" value={kpis.maint} icon={Sparkles} accent="bg-amber-600" />
                  </div>

                  <Card title="Foreign Train Correlation (Coach Owning Zone vs Current Div)" icon={LucideMap}>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={zoneDivBar} layout="vertical" margin={{ left: 60, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={axisStyle} />
                          <YAxis dataKey="zone" type="category" axisLine={false} tickLine={false} tick={axisStyle} dx={-10} />
                          <Tooltip cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }} />
                          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                          {uniqueDivsArray.map((divName, i) => (
                            <Bar key={String(divName)} dataKey={String(divName)} stackId="a" fill={COLORS[i % COLORS.length]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                      <h3 className="text-base font-bold text-slate-800 dark:text-white">Major Complaint Giving Trains</h3>
                    </div>
                    <div className="overflow-x-auto max-h-[600px]">
                      <table className="min-w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10 shadow-sm">
                          <tr className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-widest">
                            <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-700">Train</th>
                            {uniqueCatsArray.map((c) => (
                              <th key={String(c)} className="p-4 font-bold border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">{c}</th>
                            ))}
                            <th className="p-4 font-black border-b border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white">Total</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                          {trainMatrix.slice(0, 50).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                              <td className="p-4 font-bold flex items-center text-slate-900 dark:text-white whitespace-nowrap">
                                <TrainFront className="w-4 h-4 mr-2 text-indigo-400" />{row.train}
                              </td>
                              {uniqueCatsArray.map((c) => (
                                <td key={String(c)} className="p-4 font-medium text-slate-600 dark:text-slate-400">{row[c] || '-'}</td>
                              ))}
                              <td className="p-4 font-black text-indigo-600 dark:text-indigo-400">{row.Total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: OPERATIONS */}
              {activeTab === 'operations' && (
                <div className="space-y-8 animate-fade-in">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                      <h3 className="text-base font-bold text-slate-800 dark:text-white">2-Hourly Shift Heatmap</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                            <th className="p-4 font-bold">Time Bucket</th>
                            {uniqueCatsArray.slice(0, 6).map((c) => <th key={String(c)} className="p-4 font-bold">{c}</th>)}
                            <th className="p-4 font-bold text-slate-800 dark:text-white">Total</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                          {shiftHeatmap.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                              <td className="p-4 font-bold text-slate-800 dark:text-white flex items-center">
                                <Clock className="w-4 h-4 mr-2 text-slate-400" />{row.shift}
                              </td>
                              {uniqueCatsArray.slice(0, 6).map((c) => {
                                const val = row[c] || 0;
                                const heatClass = val > 15
                                  ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 font-bold'
                                  : val > 5
                                    ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-bold'
                                    : 'text-slate-500 dark:text-slate-400';
                                return (
                                  <td key={String(c)} className="p-4">
                                    <span className={`px-2 py-1 rounded ${heatClass}`}>{val}</span>
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
                          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                            <XAxis type="category" dataKey="category" tick={axisStyle} tickLine={false} axisLine={false} />
                            <YAxis type="number" dataKey="time" tick={axisStyle} tickLine={false} axisLine={false} />
                            <ZAxis type="category" dataKey="name" />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter name="Complaints" data={scatterData} fill="#8b5cf6" opacity={0.6} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card title="Avg Resolution Speed by Category (Mins)">
                      <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={resSpeedBar} layout="vertical" margin={{ left: 80, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={axisStyle} />
                            <YAxis dataKey="category" type="category" axisLine={false} tickLine={false} tick={axisStyle} dx={-10} />
                            <Tooltip cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }} />
                            <Bar dataKey="avgMins" name="Avg Mins" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={20} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* TAB: TRENDS */}
              {activeTab === 'trends' && (
                <div className="space-y-8 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">Volume Trend</h3>
                    <div className="inline-flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                      {['day', 'week', 'month'].map((g) => (
                        <button
                          key={g}
                          onClick={() => setTrendsGranularity(g)}
                          className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all capitalize ${
                            trendsGranularity === g
                              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {g}ly
                        </button>
                      ))}
                    </div>
                  </div>

                  <Card title={`Complaint Volume — ${trendsGranularity}ly`} icon={TrendingUp}>
                    <div className="h-[360px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                          <XAxis dataKey="key" tick={axisStyle} tickLine={false} axisLine={false} />
                          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#trendGrad)" name="Complaints" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card title="Top 5 Categories Trend (Daily)" icon={BarChart}>
                    <div className="h-[360px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={categoryTrendChartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                          <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
                          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          {topCats.map((cat, i) => (
                            <Line key={String(cat)} type="monotone" dataKey={String(cat)} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card title="SLA Performance Trend" icon={Target}>
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={slaTrend} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                          <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
                          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Bar dataKey="OnTime" stackId="a" fill="#10b981" name="On Time" />
                          <Bar dataKey="Breached" stackId="a" fill="#ef4444" name="Breached" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              )}

              {/* TAB: ASSETS */}
              {activeTab === 'assets' && (
                <div className="space-y-8 animate-fade-in">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card title="Territorial Watering Point Map">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={wateringList} layout="vertical" margin={{ left: 40, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={axisStyle} />
                            <YAxis dataKey="station" type="category" axisLine={false} tickLine={false} tick={axisStyle} dx={-10} />
                            <Tooltip cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }} />
                            <Bar dataKey="count" name="Watering Cases" fill="#0ea5e9" radius={[0, 6, 6, 0]} barSize={20} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card title="Asset Health (Coach Type vs Total)">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={coachMatrix} layout="vertical" margin={{ left: 40, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={axisStyle} />
                            <YAxis dataKey="coachType" type="category" axisLine={false} tickLine={false} tick={axisStyle} dx={-10} />
                            <Tooltip cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }} />
                            <Bar dataKey="Total" name="Total" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={20} />
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
                      <div className="overflow-x-auto max-h-96">
                        <table className="min-w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm z-10">
                            <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                              <th className="p-4 font-bold">Ref No</th>
                              <th className="p-4 font-bold">Coach</th>
                              <th className="p-4 font-bold">Train</th>
                              <th className="p-4 font-bold">Sub-Category & Desc.</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                            {pestDefectTable.map((row, idx) => (
                              <tr key={idx} className="hover:bg-rose-50/50 dark:hover:bg-rose-950/20">
                                <td className="p-4 font-mono text-[10px] text-slate-400">{row.id}</td>
                                <td className="p-4 font-bold whitespace-nowrap text-indigo-700 dark:text-indigo-300">{row.coachType} - {row.coachNo}</td>
                                <td className="p-4 font-bold text-slate-700 dark:text-slate-200">{row.train}</td>
                                <td className="p-4 text-slate-600 dark:text-slate-400 max-w-md">
                                  <span className="font-semibold text-rose-800 dark:text-rose-300">{row.subType || 'Unclassified'}</span>
                                  <br /><span className="text-xs">{row.desc}</span>
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

              {/* TAB: SENTIMENT */}
              {activeTab === 'sentiment' && (
                <div className="space-y-8 animate-fade-in">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm h-[400px] overflow-hidden flex flex-col">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Sentiment Word Cloud</h3>
                      <div className="flex-1 flex flex-wrap content-start items-center justify-center gap-3 overflow-y-auto">
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

                    <Card title='"Quick Close" Audit — Resolution Time vs Satisfaction'>
                      <div className="h-[340px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={quickCloseData} margin={{ left: 0, right: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisStyle} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={axisStyle} />
                            <Tooltip cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }} />
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
                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="min-w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm z-10">
                            <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                              <th className="p-4 font-bold">Ref No.</th>
                              <th className="p-4 font-bold">Train</th>
                              <th className="p-4 font-bold">Passenger Desc & Feedback</th>
                              <th className="p-4 font-bold">Closing Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                            {unsatTable.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="p-4 font-mono text-[10px] text-slate-400 whitespace-nowrap">{row.id}</td>
                                <td className="p-4 font-bold text-slate-800 dark:text-white whitespace-nowrap">{row.train}</td>
                                <td className="p-4 text-xs max-w-sm">
                                  <span className="text-slate-600 dark:text-slate-400">{row.desc}</span>
                                  {row.feedbackRemark && (
                                    <><br /><span className="text-rose-600 dark:text-rose-300 font-semibold mt-1 inline-block">Passenger: &ldquo;{row.feedbackRemark}&rdquo;</span></>
                                  )}
                                </td>
                                <td className="p-4 text-xs text-indigo-700 dark:text-indigo-300 max-w-xs">{row.remarks}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
