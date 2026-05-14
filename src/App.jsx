import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import { 
  LayoutDashboard, TrainFront, Clock, MessageSquareWarning, 
  Sparkles, Menu, X, AlertTriangle, CheckCircle, Upload, 
  Calendar, Trash2, Cpu, FileSpreadsheet, Bug, BarChart3, Map as LucideMap, Filter, ChevronDown, Loader2, Target
} from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#f43f5e', '#a855f7', '#ec4899'];

// Strictly empty initial state for a fresh database.
const initialRawDatabase = { records: [] };

// --- STABLE RAW DATA PARSERS ---

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
    if (!val || String(val) === "null") return 0;
    const match = String(val).match(/(\d+):(\d+)/);
    if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    return 0;
};

const STOP_WORDS = new window.Set(['and','the','was','for','that','with','from','this','have','not','are','but','has','had','been','very','they','will','coach','train','seat','berth','number','passenger', 'is', 'it', 'to', 'in', 'of', 'on']);

const navItemsList = [
  { id: 'executive', label: '1. Executive Overview', icon: LayoutDashboard },
  { id: 'operations', label: '2. Operations & Time-Bucket', icon: Clock },
  { id: 'assets', label: '3. Root Cause & Assets', icon: Target },
  { id: 'sentiment', label: '4. Passenger Sentiment', icon: MessageSquareWarning },
];

const MetricCard = ({ title, value, icon: Icon, colorClass, subtitle }) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between h-full">
    <div className="flex justify-between items-start mb-2">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{String(title)}</p>
        <h3 className="text-2xl font-bold text-slate-800">{String(value)}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{String(subtitle)}</p>}
      </div>
      <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
    </div>
  </div>
);

// Custom label for PieChart
const renderCustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('executive');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState('Initializing...');
  const [dbData, setDbData] = useState(initialRawDatabase);
  const [supabaseClient, setSupabaseClient] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const lastMonthStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const [filters, setFilters] = useState({
      fromDate: lastMonthStr, toDate: todayStr,
      timeBucket: 'All', train: 'All', coachType: 'All', zone: 'All', location: 'All',
      category: 'All', sla: 'All', rating: 'All', status: 'All'
  });

  const [toastMessage, setToastMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  const showToast = (msg) => {
    setToastMessage(String(msg));
    setTimeout(() => setToastMessage(''), 6000);
  };

  const updateFilter = (key, value) => {
      setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyDashboardData = (dataObj, syncMessage) => {
      setDbData(dataObj);
      setLastSync(syncMessage);
      if (dataObj.records && dataObj.records.length > 0) {
          const sortedDates = [...dataObj.records].map(r => r.date).sort();
          setFilters(prev => ({ ...prev, fromDate: sortedDates[0], toDate: sortedDates[sortedDates.length - 1] }));
      }
  };

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        if (!window.XLSX) {
          await new Promise((res) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = res;
            document.head.appendChild(script);
          });
        }
        if (!window.supabase) {
          await new Promise((res) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = res;
            document.head.appendChild(script);
          });
        }
        
        const url = 'https://npfuxifktdmxmzprfcxm.supabase.co';
        const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZnV4aWZrdGRteG16cHJmY3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MjMwMDMsImV4cCI6MjA5NDE5OTAwM30.cCheIUxTAQWyoVyIwOLRd5usiyFI-q2GIn3A9NPFL78';
        const client = window.supabase.createClient(url, key);
        setSupabaseClient(client);
        fetchCloudData(client);
      } catch (err) {
        console.error("Dependency loading failed", err);
        loadLocalFallback();
      }
    };
    loadDependencies();
  }, []);

  const loadLocalFallback = () => {
      const localDataStr = localStorage.getItem('railmadad_local_sync');
      if (localDataStr) {
          try {
              const localData = JSON.parse(localDataStr);
              applyDashboardData(localData, "Loaded from Local Cache");
          } catch (e) { console.error("Local storage corrupt"); }
      } else {
          setLastSync("Empty");
      }
      setIsLoading(false);
  };

  const fetchCloudData = async (client) => {
    if (!client) { loadLocalFallback(); return; }
    try {
      const { data, error } = await client.from('railmadad_sync').select('*').eq('id', 1).single();
      if (error) { loadLocalFallback(); return; }
      if (data && data.json_data && data.json_data.records) {
        applyDashboardData(data.json_data, new Date(data.last_updated || Date.now()).toLocaleTimeString());
        localStorage.setItem('railmadad_local_sync', JSON.stringify(data.json_data));
      } else {
        loadLocalFallback();
      }
    } catch (err) { 
      loadLocalFallback();
    } finally {
      setIsLoading(false);
    }
  };

  // --- CORE MEGA AGGREGATOR ---
  const aggregated = useMemo(() => {
    const rawRecords = dbData.records || [];

    const opt = {
        buckets: new window.Set(), trains: new window.Set(), coaches: new window.Set(),
        zones: new window.Set(), locations: new window.Set(), cats: new window.Set(),
        slas: new window.Set(), ratings: new window.Set(), statuses: new window.Set()
    };

    rawRecords.forEach(r => {
        if(r.shift2) opt.buckets.add(r.shift2);
        if(r.train && r.train !== 'Unknown') opt.trains.add(r.train);
        if(r.coachType && r.coachType !== 'Unknown') opt.coaches.add(r.coachType);
        if(r.ownZone && r.ownZone !== 'Unknown') opt.zones.add(r.ownZone);
        if(r.zone && r.zone !== 'Unknown') opt.zones.add(r.zone);
        if(r.nextStation && r.nextStation !== 'Unknown') opt.locations.add(r.nextStation);
        if(r.category && r.category !== 'Uncategorized') opt.cats.add(r.category);
        if(r.sla && r.sla !== 'Unknown') opt.slas.add(r.sla);
        if(r.rating) opt.ratings.add(r.rating);
        if(r.status) opt.statuses.add(r.status);
    });

    const validRecords = rawRecords.filter(r => {
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

    // --- EXISTING AGGREGATIONS ---
    const kpis = { total: validRecords.length, bedroll: 0, clean: 0, water: 0, maint: 0 };
    const trainCatMap = new window.Map();
    const zoneDivMap = new window.Map();
    const shiftCatMap = new window.Map();
    const catResMap = new window.Map();
    const wateringMap = new window.Map();
    const pestDefectTable = [];
    const coachCatMap = new window.Map();
    const quickCloseMap = {
        '< 15m': { name: '< 15m', Satisfactory: 0, Neutral: 0, Unsatisfactory: 0 },
        '15-60m': { name: '15-60m', Satisfactory: 0, Neutral: 0, Unsatisfactory: 0 },
        '> 60m': { name: '> 60m', Satisfactory: 0, Neutral: 0, Unsatisfactory: 0 }
    };
    const wordMap = new window.Map();
    const unsatTable = [];
    const uniqueCats = new window.Set();
    const uniqueDivs = new window.Set();
    const scatterData = [];

    // --- NEW: Month-on-month maps ---
    const monthlyTotalMap = new window.Map();      // month -> count
    const monthlyCatMap = new window.Map();         // month -> { cat: count }
    const monthlyRatingMap = new window.Map();      // month -> { rating: count }
    const monthlyZoneMap = new window.Map();        // month -> { zone: count }
    const ratingTotalMap = new window.Map();        // rating -> count
    const zoneTotalMap = new window.Map();          // zone -> count

    let totalResTimeMins = 0;
    let resTimeCount = 0;
    let totalRatingScore = 0;
    let ratingScoreCount = 0;
    const resolvedStatuses = ['closed', 'resolved', 'attended', 'attended to'];
    let resolvedCount = 0;
    const uniqueZones = new window.Set();

    validRecords.forEach(r => {
        // KPIs
        const catLow = String(r.category).toLowerCase();
        if (catLow.includes('bedroll') || catLow.includes('linen')) kpis.bedroll++;
        if (catLow.includes('clean') || catLow.includes('dirt')) kpis.clean++;
        if (catLow.includes('water') || catLow.includes('plumb')) kpis.water++;
        if (catLow.includes('maintain') || catLow.includes('coach') || catLow.includes('equip')) kpis.maint++;

        // Resolved count
        const statusLow = String(r.status).toLowerCase();
        if (resolvedStatuses.some(s => statusLow.includes(s))) resolvedCount++;

        // Avg resolution time
        if (r.resTimeMins > 0) {
            totalResTimeMins += r.resTimeMins;
            resTimeCount++;
        }

        // Avg rating score (Satisfactory=3, Neutral=2, Unsatisfactory=1)
        const ratingLow = String(r.rating).toLowerCase();
        if (ratingLow.includes('satisfactory') && !ratingLow.includes('un')) { totalRatingScore += 3; ratingScoreCount++; }
        else if (ratingLow.includes('neutral')) { totalRatingScore += 2; ratingScoreCount++; }
        else if (ratingLow.includes('unsatisfactory')) { totalRatingScore += 1; ratingScoreCount++; }

        // Zone tracking
        const zoneKey = r.ownZone && r.ownZone !== 'Unknown' ? r.ownZone : (r.zone && r.zone !== 'Unknown' ? r.zone : null);
        if (zoneKey) uniqueZones.add(zoneKey);

        uniqueCats.add(String(r.category));

        // Month tracking
        const mon = r.month || 'Unknown';

        // Monthly total
        monthlyTotalMap.set(mon, (monthlyTotalMap.get(mon) || 0) + 1);

        // Monthly category
        if (!monthlyCatMap.has(mon)) monthlyCatMap.set(mon, {});
        const mCatObj = monthlyCatMap.get(mon);
        mCatObj[r.category] = (mCatObj[r.category] || 0) + 1;

        // Monthly rating
        if (!monthlyRatingMap.has(mon)) monthlyRatingMap.set(mon, {});
        const mRatObj = monthlyRatingMap.get(mon);
        const ratingKey = String(r.rating || 'Not Rated');
        mRatObj[ratingKey] = (mRatObj[ratingKey] || 0) + 1;

        // Rating total for pie
        ratingTotalMap.set(ratingKey, (ratingTotalMap.get(ratingKey) || 0) + 1);

        // Monthly zone
        if (zoneKey) {
            if (!monthlyZoneMap.has(mon)) monthlyZoneMap.set(mon, {});
            const mZoneObj = monthlyZoneMap.get(mon);
            mZoneObj[zoneKey] = (mZoneObj[zoneKey] || 0) + 1;
            zoneTotalMap.set(zoneKey, (zoneTotalMap.get(zoneKey) || 0) + 1);
        }

        // Train Matrix
        if (!trainCatMap.has(r.train)) trainCatMap.set(r.train, { train: r.train, Total: 0 });
        const tObj = trainCatMap.get(r.train);
        tObj.Total++; tObj[r.category] = (tObj[r.category] || 0) + 1;

        // Zone Correlation
        uniqueDivs.add(String(r.div));
        if (!zoneDivMap.has(r.ownZone)) zoneDivMap.set(r.ownZone, { zone: r.ownZone, Total: 0 });
        const zObj = zoneDivMap.get(r.ownZone);
        zObj.Total++; zObj[r.div] = (zObj[r.div] || 0) + 1;

        // Shift Matrix
        if (!shiftCatMap.has(r.shift2)) shiftCatMap.set(r.shift2, { shift: r.shift2, Total: 0 });
        const sObj = shiftCatMap.get(r.shift2);
        sObj.Total++; sObj[r.category] = (sObj[r.category] || 0) + 1;

        // Resolution Scatter & Bar
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

        if (String(r.rating).toLowerCase().includes('unsatisfactory')) {
            unsatTable.push(r);
        }

        const combinedText = (String(r.desc) + " " + String(r.feedbackRemark)).toLowerCase();
        const words = combinedText.replace(/[^a-z]/g, ' ').split(/\s+/);
        words.forEach(w => {
            if (w.length > 3 && !STOP_WORDS.has(w)) wordMap.set(w, (wordMap.get(w) || 0) + 1);
        });
    });

    // --- Build sorted months array ---
    const allMonths = Array.from(monthlyTotalMap.keys()).sort();

    // Monthly total bar chart data
    const monthlyTotalBar = allMonths.map(m => ({ month: m, complaints: monthlyTotalMap.get(m) || 0 }));

    // Category month-on-month table
    const uniqueCatsArray = Array.from(uniqueCats).filter(c => c !== 'Uncategorized').sort();
    const catMomTable = allMonths.map(m => {
        const row = { month: m };
        uniqueCatsArray.forEach(c => { row[c] = monthlyCatMap.get(m)?.[c] || 0; });
        row.total = monthlyTotalMap.get(m) || 0;
        return row;
    });

    // Rating pie data
    const ratingPieData = Array.from(ratingTotalMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // Rating month-on-month table
    const uniqueRatings = Array.from(new window.Set(ratingPieData.map(r => r.name))).sort();
    const ratingMomTable = allMonths.map(m => {
        const row = { month: m };
        uniqueRatings.forEach(rt => { row[rt] = monthlyRatingMap.get(m)?.[rt] || 0; });
        row.total = monthlyTotalMap.get(m) || 0;
        return row;
    });

    // Zone pie data
    const zonePieData = Array.from(zoneTotalMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    // Zone month-on-month trend (top 5 zones)
    const top5Zones = zonePieData.slice(0, 5).map(z => z.name);
    const zoneMomTable = allMonths.map(m => {
        const row = { month: m };
        top5Zones.forEach(z => { row[z] = monthlyZoneMap.get(m)?.[z] || 0; });
        row.total = Array.from(zoneTotalMap.values()).reduce((a,b)=>a+b,0);
        return row;
    });

    // KPIs for executive
    const tenureLabel = allMonths.length > 0 ? `${allMonths[0]} to ${allMonths[allMonths.length - 1]}` : 'N/A';
    const currentMonth = new Date().toISOString().substring(0, 7);
    const thisMonthCount = monthlyTotalMap.get(currentMonth) || 0;
    const avgResMins = resTimeCount > 0 ? Math.round(totalResTimeMins / resTimeCount) : 0;
    const avgResLabel = avgResMins > 0 ? `${Math.floor(avgResMins / 60)}h ${avgResMins % 60}m` : 'N/A';
    const avgRatingLabel = ratingScoreCount > 0
        ? (totalRatingScore / ratingScoreCount >= 2.5 ? 'Satisfactory' : totalRatingScore / ratingScoreCount >= 1.5 ? 'Neutral' : 'Unsatisfactory')
        : 'N/A';

    const execKpis = {
        totalComplaints: validRecords.length,
        tenureLabel,
        thisMonthCount,
        resolvedCount,
        totalRegions: uniqueZones.size,
        avgResLabel,
        avgRatingLabel,
    };

    const uniqueCatsArrayFull = Array.from(uniqueCats).sort();
    const trainMatrix = Array.from(trainCatMap.values()).sort((a,b) => b.Total - a.Total);
    const zoneDivBar = Array.from(zoneDivMap.values()).sort((a,b) => b.Total - a.Total);
    const shiftHeatmap = Array.from(shiftCatMap.values()).sort((a,b) => String(a.shift).localeCompare(String(b.shift)));
    const resSpeedBar = Array.from(catResMap.values()).map(c => ({ category: String(c.category), avgMins: Math.round(c.sum / c.count) })).sort((a,b) => b.avgMins - a.avgMins);
    const wateringList = Array.from(wateringMap.entries()).map(([station, count]) => ({ station: String(station), count })).sort((a,b) => b.count - a.count).slice(0,15);
    const coachMatrix = Array.from(coachCatMap.values()).sort((a,b) => b.Total - a.Total);
    const quickCloseData = [quickCloseMap['< 15m'], quickCloseMap['15-60m'], quickCloseMap['> 60m']];
    const wordCloud = Array.from(wordMap.entries()).map(([text, value]) => ({ text: String(text), value })).sort((a,b) => b.value - a.value).slice(0, 40).map(w => ({ ...w, fontSize: Math.max(12, Math.min(48, w.value * 1.5)) }));

    return { 
        kpis, execKpis, options: opt,
        trainMatrix, zoneDivBar, uniqueDivsArray: Array.from(uniqueDivs).sort(), shiftHeatmap, scatterData, resSpeedBar, 
        wateringList, pestDefectTable, coachMatrix, unsatTable, quickCloseData, wordCloud,
        uniqueCatsArray: uniqueCatsArrayFull,
        // New executive data
        monthlyTotalBar, catMomTable, uniqueCatsArrayForMom: uniqueCatsArray,
        ratingPieData, ratingMomTable, uniqueRatings,
        zonePieData, zoneMomTable, top5Zones,
        allMonths,
    };
  }, [dbData, filters]);

  const { 
    kpis, execKpis, options, trainMatrix, zoneDivBar, uniqueDivsArray, shiftHeatmap, scatterData, resSpeedBar, 
    wateringList, pestDefectTable, coachMatrix, unsatTable, quickCloseData, wordCloud, uniqueCatsArray,
    monthlyTotalBar, catMomTable, uniqueCatsArrayForMom,
    ratingPieData, ratingMomTable, uniqueRatings,
    zonePieData, zoneMomTable, top5Zones,
    allMonths,
  } = aggregated;

  // --- FILE PARSER ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) {
        showToast("Systems are still initializing. Please wait.");
        return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target.result;
        const workbook = window.XLSX.read(buffer, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawArray = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        
        if (!rawArray || rawArray.length === 0) throw new Error("File is empty.");

        let headerRowIdx = -1;
        let colMap = {};
        const keyHeaders = ['complaintrefno', 'refno', 'createdon', 'comptypename'];
        
        for (let i = 0; i < Math.min(100, rawArray.length); i++) {
            const row = rawArray[i];
            if (!row || !Array.isArray(row)) continue;
            const cleanRow = row.map(c => String(c || "").toLowerCase().replace(/[^a-z0-9]/g, '').trim());
            const matchCount = keyHeaders.filter(kh => cleanRow.includes(kh)).length;
            if (matchCount >= 2) {
                headerRowIdx = i;
                cleanRow.forEach((val, colIdx) => { if (val) colMap[val] = colIdx; });
                break;
            }
        }

        if (headerRowIdx === -1) {
            showToast("Standard headers not found. Check if this is a Raw Data file.");
            setIsUploading(false); e.target.value = null; return;
        }

        const getValue = (row, key) => {
            const idx = colMap[key];
            return (idx !== undefined && row[idx] !== undefined) ? row[idx] : null;
        };

        const idMap = new window.Map(); 
        const baseRecords = dbData.records || [];
        baseRecords.forEach(r => idMap.set(String(r.id), r));

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
                const rawTrain = String(trainStation || "") + " " + String(trainReportName || "");
                const matchTrain = rawTrain.match(/\b\d{4,5}\b/);
                const trainNo = matchTrain ? matchTrain[0] : (trainStation ? String(trainStation) : 'Unknown');

                idMap.set(recordId, {
                    id: recordId,
                    date: parsedObj.date,
                    month: parsedObj.month,
                    hour: parsedObj.hour,
                    shift2: parsedObj.shift2,
                    category: String(rawCat).trim(), 
                    subType: String(rawSubCat).trim(),
                    isPest: isPest,
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
            } catch (rowErr) { console.warn("Row skipped", rowErr); }
        }

        if (newRecordsAdded > 0) {
            const newData = { records: Array.from(idMap.values()) };
            applyDashboardData(newData, "Saved to Cache");
            localStorage.setItem('railmadad_local_sync', JSON.stringify(newData));
            showToast(`✅ Appended ${newRecordsAdded} records.`);

            if (supabaseClient) {
                try {
                  const { error } = await supabaseClient.from('railmadad_sync').upsert({ id: 1, json_data: newData, last_updated: new Date().toISOString() }, { onConflict: 'id' });
                  if (!error) setLastSync(new Date().toLocaleTimeString() + " (Cloud Synced)");
                } catch (e) { console.warn("Cloud save issue"); }
            }
        } else { showToast("No new records detected."); }
      } catch (err) { showToast("Error processing file format."); }
      setIsUploading(false); e.target.value = null; 
    };
    reader.readAsArrayBuffer(file);
  };

  const executeHardReset = async () => {
    setShowResetModal(false);
    showToast("Wiping database...");
    applyDashboardData(initialRawDatabase, "Wiped Clean");
    localStorage.removeItem('railmadad_local_sync');
    if (supabaseClient) {
        try { await supabaseClient.from('railmadad_sync').upsert({ id: 1, json_data: initialRawDatabase, last_updated: new Date().toISOString() }, { onConflict: 'id' }); } catch (err) {}
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <p className="text-slate-600 font-bold text-lg animate-pulse tracking-wide uppercase">Booting Railway Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center animate-bounce border border-slate-700">
          <Sparkles className="w-5 h-5 mr-3 text-indigo-400" />
          <span className="font-medium text-sm leading-snug max-w-sm">{String(toastMessage)}</span>
        </div>
      )}

      {/* Hard Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full border border-slate-100 transform transition-all">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4"><AlertTriangle className="w-6 h-6" /></div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Wipe Database?</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">Permanently delete all raw data locally and in cloud.</p>
            <div className="flex space-x-3">
              <button onClick={() => setShowResetModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={executeHardReset} className="flex-1 py-2.5 rounded-lg bg-rose-600 text-white font-semibold text-sm hover:bg-rose-700 transition-colors shadow-sm shadow-rose-200">Yes, Wipe Data</button>
            </div>
          </div>
        </div>
      )}
      
      {/* SIDEBAR */}
      <aside className={`fixed md:sticky top-0 left-0 z-40 w-64 h-screen transition-transform transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 bg-white border-r border-slate-200 shadow-sm flex flex-col`}>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-700">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center">
              <TrainFront className="w-5 h-5 mr-2" /> RailMadad
            </h1>
            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-1">SEE Division Engine</p>
          </div>
          <button className="md:hidden text-white" onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
        </div>

        <div className="p-5 border-b border-slate-100 bg-slate-50">
           <label className="flex items-center justify-center w-full px-4 py-3 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 cursor-pointer transition-colors active:scale-95">
              {isUploading ? (
                <span className="animate-pulse flex items-center text-sm font-bold">Scanning...</span>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  <span className="text-sm font-bold">Append Raw Export</span>
                  <input type="file" accept=".csv, .xlsx" className="hidden" onChange={handleFileUpload} disabled={isUploading}/>
                </>
              )}
           </label>
           <p className="text-[10px] text-slate-400 mt-3 text-center font-medium italic">Status: {String(lastSync)}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Modules</p>
          {navItemsList.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-500 hover:bg-slate-50 border border-transparent'}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{String(item.label)}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
           <button onClick={() => setShowResetModal(true)} className="flex items-center justify-center w-full py-2 text-[11px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors mb-4">
             <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Wipe Entire System
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col max-w-full overflow-hidden bg-slate-50">
        <header className="md:hidden bg-indigo-700 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
          <h1 className="text-lg font-bold flex items-center"><TrainFront className="w-5 h-5 mr-2"/> RM Dashboard</h1>
          <button onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
        </header>

        {/* GLOBAL FILTERS */}
        <div className="bg-white border-b border-slate-200 z-20 sticky top-0 md:top-0 shadow-sm">
           <div className="px-4 md:px-8 py-4 flex justify-between items-center border-b border-slate-100">
               <h2 className="text-xl font-black text-slate-800 tracking-tight">{String(navItemsList.find(i => i.id === activeTab)?.label)}</h2>
               <button onClick={() => setShowFilters(!showFilters)} className="flex items-center text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">
                  <Filter className="w-4 h-4 mr-2" /> Global Filters {showFilters ? <ChevronDown className="w-4 h-4 ml-1 rotate-180 transition-transform" /> : <ChevronDown className="w-4 h-4 ml-1 transition-transform" />}
               </button>
           </div>
           
           {showFilters && (
               <div className="px-4 md:px-8 py-4 bg-slate-50 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 border-b border-slate-200">
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-500 uppercase mb-1">From Date</span><input type="date" value={filters.fromDate} onChange={e => updateFilter('fromDate', e.target.value)} className="text-sm border border-slate-200 rounded p-1.5 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-500 uppercase mb-1">To Date</span><input type="date" value={filters.toDate} onChange={e => updateFilter('toDate', e.target.value)} className="text-sm border border-slate-200 rounded p-1.5 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Time Bucket</span><select value={filters.timeBucket} onChange={e => updateFilter('timeBucket', e.target.value)} className="text-sm border border-slate-200 rounded p-1.5 text-slate-700 outline-none"><option value="All">All Buckets</option>{Array.from(options.buckets).sort().map(o=><option key={String(o)} value={String(o)}>{String(o)}</option>)}</select></div>
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Train</span><select value={filters.train} onChange={e => updateFilter('train', e.target.value)} className="text-sm border border-slate-200 rounded p-1.5 text-slate-700 outline-none"><option value="All">All Trains</option>{Array.from(options.trains).sort().map(o=><option key={String(o)} value={String(o)}>{String(o)}</option>)}</select></div>
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Coach Type</span><select value={filters.coachType} onChange={e => updateFilter('coachType', e.target.value)} className="text-sm border border-slate-200 rounded p-1.5 text-slate-700 outline-none"><option value="All">All Types</option>{Array.from(options.coaches).sort().map(o=><option key={String(o)} value={String(o)}>{String(o)}</option>)}</select></div>
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Zone (Own/Occur)</span><select value={filters.zone} onChange={e => updateFilter('zone', e.target.value)} className="text-sm border border-slate-200 rounded p-1.5 text-slate-700 outline-none"><option value="All">All Zones</option>{Array.from(options.zones).sort().map(o=><option key={String(o)} value={String(o)}>{String(o)}</option>)}</select></div>
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Location (Next Stn)</span><select value={filters.location} onChange={e => updateFilter('location', e.target.value)} className="text-sm border border-slate-200 rounded p-1.5 text-slate-700 outline-none"><option value="All">All Locations</option>{Array.from(options.locations).sort().map(o=><option key={String(o)} value={String(o)}>{String(o)}</option>)}</select></div>
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Category</span><select value={filters.category} onChange={e => updateFilter('category', e.target.value)} className="text-sm border border-slate-200 rounded p-1.5 text-slate-700 outline-none"><option value="All">All Categories</option>{Array.from(options.cats).sort().map(o=><option key={String(o)} value={String(o)}>{String(o)}</option>)}</select></div>
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-500 uppercase mb-1">SLA Compliance</span><select value={filters.sla} onChange={e => updateFilter('sla', e.target.value)} className="text-sm border border-slate-200 rounded p-1.5 text-slate-700 outline-none"><option value="All">All SLAs</option>{Array.from(options.slas).sort().map(o=><option key={String(o)} value={String(o)}>{String(o)}</option>)}</select></div>
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Rating</span><select value={filters.rating} onChange={e => updateFilter('rating', e.target.value)} className="text-sm border border-slate-200 rounded p-1.5 text-slate-700 outline-none"><option value="All">All Ratings</option>{Array.from(options.ratings).sort().map(o=><option key={String(o)} value={String(o)}>{String(o)}</option>)}</select></div>
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Status</span><select value={filters.status} onChange={e => updateFilter('status', e.target.value)} className="text-sm border border-slate-200 rounded p-1.5 text-slate-700 outline-none"><option value="All">All Statuses</option>{Array.from(options.statuses).sort().map(o=><option key={String(o)} value={String(o)}>{String(o)}</option>)}</select></div>
               </div>
           )}
        </div>

        <div className="p-4 md:p-8 flex-1 overflow-y-auto space-y-8">
          {dbData.records.length === 0 ? (
             <div className="bg-white p-16 mt-10 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center max-w-2xl mx-auto shadow-sm">
               <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6"><FileSpreadsheet className="w-12 h-12 text-indigo-400" /></div>
               <h3 className="text-3xl font-black text-slate-800 tracking-tight">Dashboard Empty</h3>
               <p className="text-slate-500 mt-4 max-w-md leading-relaxed font-medium">Upload your Raw CSV to populate the Analytics Modules.</p>
             </div>
          ) : kpis.total === 0 ? (
             <div className="bg-white p-12 mt-10 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center max-w-2xl mx-auto shadow-sm">
               <Calendar className="w-12 h-12 text-slate-300 mb-4" />
               <h3 className="text-xl font-bold text-slate-800">No Match Found</h3>
               <p className="text-slate-500 mt-2 max-w-sm">Adjust your advanced filters to see results.</p>
             </div>
          ) : (
            <>
              {/* ============================================================ */}
              {/* TAB 1: EXECUTIVE OVERVIEW — FULLY REPLACED                   */}
              {/* ============================================================ */}
              {activeTab === 'executive' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                  {/* ── SECTION 1: KEY NUMBERS ── */}
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                      Key Numbers · {String(execKpis.tenureLabel)}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                      <MetricCard
                        title="Total Complaints"
                        value={execKpis.totalComplaints.toLocaleString()}
                        subtitle={execKpis.tenureLabel}
                        icon={LayoutDashboard}
                        colorClass="bg-blue-600"
                      />
                      <MetricCard
                        title="This Month"
                        value={execKpis.thisMonthCount.toLocaleString()}
                        subtitle={new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                        icon={Calendar}
                        colorClass="bg-indigo-600"
                      />
                      <MetricCard
                        title="Resolved"
                        value={execKpis.resolvedCount.toLocaleString()}
                        subtitle={`${execKpis.totalComplaints > 0 ? Math.round(execKpis.resolvedCount / execKpis.totalComplaints * 100) : 0}% resolution rate`}
                        icon={CheckCircle}
                        colorClass="bg-emerald-600"
                      />
                      <MetricCard
                        title="Regions Covered"
                        value={execKpis.totalRegions.toLocaleString()}
                        subtitle="Unique zones"
                        icon={LucideMap}
                        colorClass="bg-sky-600"
                      />
                      <MetricCard
                        title="Avg Resolution Time"
                        value={execKpis.avgResLabel}
                        subtitle="Across resolved cases"
                        icon={Clock}
                        colorClass="bg-amber-600"
                      />
                      <MetricCard
                        title="Avg Resolution Rating"
                        value={execKpis.avgRatingLabel}
                        subtitle="Passenger feedback"
                        icon={Sparkles}
                        colorClass="bg-purple-600"
                      />
                    </div>
                  </div>

                  {/* ── SECTION 2: TOTAL COMPLAINTS BAR + CATEGORY MOM TABLE ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Bar Chart */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">
                        Total Complaints — Month on Month
                      </h3>
                      <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyTotalBar} margin={{ left: 0, right: 10, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="month"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                              angle={-35}
                              textAnchor="end"
                              dy={10}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                            <Bar dataKey="complaints" name="Complaints" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={28} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Category Month-on-Month Table */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                          Category-wise Month on Month
                        </h3>
                      </div>
                      <div className="overflow-x-auto max-h-[360px]">
                        <table className="min-w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-slate-100 z-10">
                            <tr className="text-slate-500 text-[10px] uppercase tracking-widest">
                              <th className="p-3 font-bold border-b border-slate-200 whitespace-nowrap">Month</th>
                              {uniqueCatsArrayForMom.slice(0, 5).map(c => (
                                <th key={c} className="p-3 font-bold border-b border-slate-200 whitespace-nowrap">{c}</th>
                              ))}
                              <th className="p-3 font-black border-b border-slate-200 text-slate-800">Total</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                            {catMomTable.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 font-bold text-slate-800 whitespace-nowrap">{row.month}</td>
                                {uniqueCatsArrayForMom.slice(0, 5).map(c => (
                                  <td key={c} className="p-3 text-slate-600">{row[c] || '-'}</td>
                                ))}
                                <td className="p-3 font-black text-indigo-600">{row.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* ── SECTION 3: RATING PIE + RATING MOM TABLE ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Rating Pie Chart */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">
                        Rating Distribution
                      </h3>
                      <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={ratingPieData}
                              cx="50%"
                              cy="50%"
                              outerRadius={110}
                              dataKey="value"
                              labelLine={false}
                              label={renderCustomPieLabel}
                            >
                              {ratingPieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                            <Legend
                              formatter={(value) => <span style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>{value}</span>}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Rating Month-on-Month Table */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                          Rating-wise Month on Month
                        </h3>
                      </div>
                      <div className="overflow-x-auto max-h-[360px]">
                        <table className="min-w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-slate-100 z-10">
                            <tr className="text-slate-500 text-[10px] uppercase tracking-widest">
                              <th className="p-3 font-bold border-b border-slate-200 whitespace-nowrap">Month</th>
                              {uniqueRatings.slice(0, 4).map(r => (
                                <th key={r} className="p-3 font-bold border-b border-slate-200 whitespace-nowrap">{r}</th>
                              ))}
                              <th className="p-3 font-black border-b border-slate-200 text-slate-800">Total</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                            {ratingMomTable.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 font-bold text-slate-800 whitespace-nowrap">{row.month}</td>
                                {uniqueRatings.slice(0, 4).map(r => {
                                  const val = row[r] || 0;
                                  const rLow = String(r).toLowerCase();
                                  const chipClass = rLow.includes('unsatisfactory')
                                    ? 'bg-rose-100 text-rose-700 font-bold'
                                    : rLow.includes('neutral')
                                    ? 'bg-amber-100 text-amber-700 font-bold'
                                    : rLow.includes('satisfactory')
                                    ? 'bg-emerald-100 text-emerald-700 font-bold'
                                    : 'text-slate-500';
                                  return (
                                    <td key={r} className="p-3">
                                      {val > 0 ? <span className={`px-2 py-0.5 rounded text-xs ${chipClass}`}>{val}</span> : <span className="text-slate-300">-</span>}
                                    </td>
                                  );
                                })}
                                <td className="p-3 font-black text-indigo-600">{row.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* ── SECTION 4: REGION PIE + REGION MOM TREND ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Region Pie Chart */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">
                        Region-wise Distribution (Top 10 Zones)
                      </h3>
                      <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={zonePieData}
                              cx="50%"
                              cy="50%"
                              outerRadius={110}
                              dataKey="value"
                              labelLine={false}
                              label={renderCustomPieLabel}
                            >
                              {zonePieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                            <Legend
                              formatter={(value) => <span style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>{value}</span>}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Region Month-on-Month Trend */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">
                        Region-wise Month on Month Trend (Top 5 Zones)
                      </h3>
                      <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={zoneMomTable} margin={{ left: 0, right: 20, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="month"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                              angle={-35}
                              textAnchor="end"
                              dy={10}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                            <Legend verticalAlign="top" height={36} formatter={(value) => <span style={{ fontSize: 11, fontWeight: 600 }}>{value}</span>} />
                            {top5Zones.map((zone, i) => (
                              <Line
                                key={zone}
                                type="monotone"
                                dataKey={zone}
                                stroke={COLORS[i % COLORS.length]}
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                activeDot={{ r: 5 }}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* ── SECTION 5: EXISTING — Foreign Train Correlation ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm col-span-1 lg:col-span-3">
                      <div className="flex items-center justify-between mb-6">
                         <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Foreign Train Correlation (Coach Owning Zone vs Current Div)</h3>
                         <LucideMap className="text-slate-300 w-5 h-5"/>
                      </div>
                      <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={zoneDivBar} layout="vertical" margin={{ left: 60, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" axisLine={false} tickLine={false} />
                            <YAxis dataKey="zone" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} dx={-10}/>
                            <Tooltip cursor={{ fill: '#f8fafc' }} />
                            <Legend verticalAlign="top" height={36} />
                            {uniqueDivsArray.map((divName, i) => (
                                <Bar key={String(divName)} dataKey={String(divName)} stackId="a" fill={COLORS[i % COLORS.length]} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* ── SECTION 6: EXISTING — Major Complaint Giving Trains Matrix ── */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-fit">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50"><h3 className="text-base font-bold text-slate-800">Major Complaint Giving Trains (Matrix)</h3></div>
                    <div className="overflow-x-auto max-h-[600px]">
                      <table className="min-w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm"><tr className="text-slate-500 text-[10px] uppercase tracking-widest"><th className="p-4 font-bold border-b border-slate-200">Train</th>{uniqueCatsArray.map(c => <th key={String(c)} className="p-4 font-bold border-b border-slate-200 whitespace-nowrap">{String(c)}</th>)}<th className="p-4 font-black border-b border-slate-200 text-slate-800">Total</th></tr></thead>
                        <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                          {trainMatrix.slice(0, 50).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 font-bold flex items-center text-slate-900 whitespace-nowrap"><TrainFront className="w-4 h-4 mr-2 text-indigo-400" />{String(row.train)}</td>
                              {uniqueCatsArray.map(c => <td key={String(c)} className="p-4 font-medium text-slate-600">{String(row[c] || '-')}</td>)}
                              <td className="p-4 font-black text-indigo-600">{String(row.Total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}
              {/* ============================================================ */}
              {/* END TAB 1                                                    */}
              {/* ============================================================ */}

              {/* TAB 2: OPERATIONS & TIME BUCKETS — UNCHANGED */}
              {activeTab === 'operations' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-fit">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50"><h3 className="text-base font-bold text-slate-800">2-Hourly Shift Position Heatmap</h3></div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left border-collapse">
                        <thead><tr className="bg-white text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100"><th className="p-4 font-bold">Time Bucket</th>{uniqueCatsArray.slice(0,6).map(c=><th key={String(c)} className="p-4 font-bold">{String(c)}</th>)}<th className="p-4 font-bold text-slate-800">Total Volume</th></tr></thead>
                        <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                          {shiftHeatmap.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-4 font-bold text-slate-800 flex items-center"><Clock className="w-4 h-4 mr-2 text-slate-400"/>{String(row.shift)}</td>
                              {uniqueCatsArray.slice(0,6).map(c=>{
                                  const val = row[c] || 0;
                                  const heatClass = val > 15 ? 'bg-rose-100 text-rose-800 font-bold' : val > 5 ? 'bg-amber-100 text-amber-800 font-bold' : 'text-slate-500';
                                  return <td key={String(c)} className="p-4"><span className={`px-2 py-1 rounded ${heatClass}`}>{String(val)}</span></td>
                              })}
                              <td className="p-4 font-black text-indigo-600">{String(row.Total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-fit">
                         <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">SLA & Resolution Efficiency</h3>
                         <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis type="category" dataKey="category" name="Category" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                                <YAxis type="number" dataKey="time" name="Resolution Time (Mins)" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                                <ZAxis type="category" dataKey="name" name="Ref" />
                                <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                <Scatter name="Complaints" data={scatterData} fill="#8b5cf6" opacity={0.6} />
                                <Line dataKey="time" stroke="red" strokeDasharray="5 5" />
                              </ScatterChart>
                            </ResponsiveContainer>
                         </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-fit">
                         <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Avg Resolution Speed by Category (Mins)</h3>
                         <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={resSpeedBar} layout="vertical" margin={{ left: 80, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <YAxis dataKey="category" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} dx={-10} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} />
                                <Bar dataKey="avgMins" name="Avg Mins" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={20} />
                              </BarChart>
                            </ResponsiveContainer>
                         </div>
                      </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ASSETS & HOTSPOTS — UNCHANGED */}
              {activeTab === 'assets' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Territorial Watering Point Map</h3>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={wateringList} layout="vertical" margin={{ left: 40, right: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                              <XAxis type="number" axisLine={false} tickLine={false} />
                              <YAxis dataKey="station" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} dx={-10} />
                              <Tooltip cursor={{ fill: '#f8fafc' }} />
                              <Bar dataKey="count" name="Watering Cases" fill="#0ea5e9" radius={[0, 6, 6, 0]} barSize={20} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Asset Health (Coach Type vs Total Volume)</h3>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={coachMatrix} layout="vertical" margin={{ left: 40, right: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                              <XAxis type="number" axisLine={false} tickLine={false} />
                              <YAxis dataKey="coachType" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} dx={-10} />
                              <Tooltip cursor={{ fill: '#f8fafc' }} />
                              <Bar dataKey="Total" name="Total Defect/Complaints" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={20} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden h-fit">
                    <div className="px-6 py-5 border-b border-rose-100 bg-rose-50 flex items-center"><Bug className="w-5 h-5 text-rose-600 mr-2" /><h3 className="text-base font-bold text-rose-900">Base Depot: Pest Control & Coach Defect Tracker</h3></div>
                    {pestDefectTable.length === 0 ? (<div className="p-8 text-center text-slate-500 font-medium">No target coaches identified based on defect/pest keywords.</div>) : (
                      <div className="overflow-x-auto max-h-96">
                        <table className="min-w-full text-left border-collapse"><thead className="sticky top-0 bg-white shadow-sm z-10"><tr className="text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100"><th className="p-4 font-bold">Ref No</th><th className="p-4 font-bold">Coach Type & No.</th><th className="p-4 font-bold">Train</th><th className="p-4 font-bold">Sub-Category & Desc.</th></tr></thead>
                          <tbody className="text-sm text-slate-700 divide-y divide-slate-100">{pestDefectTable.map((row, idx) => (<tr key={idx} className="hover:bg-rose-50/50"><td className="p-4 font-mono text-[10px] text-slate-400">{String(row.id)}</td><td className="p-4 font-bold whitespace-nowrap text-indigo-700">{String(row.coachType)} - {String(row.coachNo)}</td><td className="p-4 font-bold text-slate-700">{String(row.train)}</td><td className="p-4 text-slate-600 max-w-md"><span className="font-semibold text-rose-800">{String(row.subType || "Unclassified")}</span> <br/><span className="text-xs">{String(row.desc)}</span></td></tr>))}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: SENTIMENT & FEEDBACK — UNCHANGED */}
              {activeTab === 'sentiment' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-[400px] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Sentiment Word Cloud</h3></div>
                        <div className="flex-1 flex flex-wrap content-start items-center justify-center gap-3 overflow-y-auto">
                            {wordCloud.map((w, i) => (
                                <span key={i} style={{fontSize: `${w.fontSize}px`, color: COLORS[i % COLORS.length]}} className="font-bold opacity-80 hover:opacity-100 cursor-default transition-opacity text-center leading-none">
                                    {String(w.text)}
                                </span>
                            ))}
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-[400px]">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">"Quick Close" Audit (Resolution Time vs Satisfaction)</h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={quickCloseData} margin={{ left: 0, right: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} dy={10}/>
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: '#f8fafc' }} />
                            <Legend verticalAlign="top" height={36} />
                            <Bar dataKey="Satisfactory" stackId="a" fill="#10b981" barSize={40} />
                            <Bar dataKey="Neutral" stackId="a" fill="#cbd5e1" barSize={40} />
                            <Bar dataKey="Unsatisfactory" stackId="a" fill="#ef4444" barSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-fit">
                    <div className="px-6 py-5 border-b border-slate-100 bg-rose-50 flex items-center"><MessageSquareWarning className="w-5 h-5 text-rose-600 mr-2" /><h3 className="text-base font-bold text-rose-900">Unsatisfactory Feedback Tracker</h3></div>
                    {unsatTable.length === 0 ? (<div className="p-8 text-center text-slate-500 font-medium">No results found.</div>) : (
                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="min-w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-white shadow-sm z-10"><tr className="text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100"><th className="p-4 font-bold">Ref No.</th><th className="p-4 font-bold">Train</th><th className="p-4 font-bold">Passenger Desc & Feedback</th><th className="p-4 font-bold">Closing Remarks</th></tr></thead>
                          <tbody className="text-sm text-slate-700 divide-y divide-slate-100">{unsatTable.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-4 font-mono text-[10px] text-slate-400 whitespace-nowrap">{String(row.id)}</td>
                              <td className="p-4 font-bold text-slate-800 whitespace-nowrap">{String(row.train)}</td>
                              <td className="p-4 text-xs max-w-sm">
                                <span className="text-slate-600">{String(row.desc)}</span>
                                {row.feedbackRemark && <><br/><span className="text-rose-600 font-semibold mt-1 inline-block">Passenger: "{String(row.feedbackRemark)}"</span></>}
                              </td>
                              <td className="p-4 text-xs text-indigo-700 max-w-xs">{String(row.remarks)}</td>
                            </tr>
                          ))}</tbody>
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
