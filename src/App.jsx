import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  LayoutDashboard, TrainFront, Clock, MessageSquareWarning, 
  Sparkles, Menu, X, AlertTriangle, CheckCircle, Upload, 
  Calendar, Trash2, Cpu, FileSpreadsheet, Bug, BarChart3, Map as MapIcon, Filter, Bot, Loader2
} from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#f43f5e', '#a855f7', '#ec4899'];

// Strictly empty initial state for a fresh database.
const initialRawDatabase = { records: [] };

// --- STABLE RAW DATA PARSERS ---

const parseRawDate = (raw) => {
    if (!raw) return null;
    const str = String(raw).trim();
    
    // Ignore floating point reference numbers masquerading as strings
    if (/^\d+\.\d+$/.test(str) && str.length > 10) return null; 

    // Handle Excel serial number conversion
    if (!isNaN(Number(raw)) && typeof raw === 'number' && raw > 40000 && raw < 70000) {
        const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
        const hour = d.getUTCHours();
        return {
            date: d.toISOString().split('T')[0],
            month: d.toISOString().substring(0, 7),
            shift: hour >= 8 && hour < 16 ? '08:00 - 16:00' : (hour >= 16 && hour < 24 ? '16:00 - 24:00' : '00:00 - 08:00')
        };
    }

    // Match DD-MM-YY HH:MM format from raw CSV
    const match = str.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!match) return null;

    let part1 = match[1], part2 = match[2], part3 = match[3];
    let year, month, day;

    if (part1.length === 4) { year = part1; month = part2; day = part3; }
    else if (part3.length === 4) { year = part3; month = part2; day = part1; }
    else { year = '20' + part3; month = part2; day = part1; }

    month = month.padStart(2, '0');
    day = day.padStart(2, '0');

    let hour = 12;
    if (match[4]) hour = parseInt(match[4], 10);

    const shift = hour >= 8 && hour < 16 ? '08:00 - 16:00' : (hour >= 16 && hour < 24 ? '16:00 - 24:00' : '00:00 - 08:00');

    return {
        date: `${year}-${month}-${day}`,
        month: `${year}-${month}`, 
        shift
    };
};

const parseResolutionTime = (val) => {
    if (!val || String(val) === "null") return 0;
    const match = String(val).match(/(\d+):(\d+)/);
    if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    return 0;
};

const formatMinutesToTime = (totalMins) => {
    if (!totalMins || isNaN(totalMins) || totalMins <= 0) return "0h 0m";
    const h = Math.floor(totalMins / 60);
    const m = Math.floor(totalMins % 60);
    return `${h}h ${m}m`;
};

const navItemsList = [
  { id: 'overview', label: 'Overview & Analytics', icon: LayoutDashboard },
  { id: 'category', label: 'Category & Pest Control', icon: Sparkles },
  { id: 'trains', label: 'Train Analysis Matrix', icon: TrainFront },
  { id: 'geo', label: 'Geo & Coach Types', icon: MapIcon },
  { id: 'operations', label: 'Shifts & Feedback', icon: Clock },
];

const MetricCard = ({ title, value, icon: Icon, colorClass }) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{String(title)}</p>
        <h3 className="text-2xl font-bold text-slate-800">{String(value)}</h3>
      </div>
      <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
    </div>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState('Initializing...');
  const [dbData, setDbData] = useState(initialRawDatabase);
  const [supabaseClient, setSupabaseClient] = useState(null);

  // Filters
  const todayStr = new Date().toISOString().split('T')[0];
  const lastMonthStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const [fromDate, setFromDate] = useState(lastMonthStr);
  const [toDate, setToDate] = useState(todayStr);
  const [selectedZone, setSelectedZone] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  
  const [toastMessage, setToastMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 6000);
  };

  // 1. Inject Dependencies Dynamically (Avoids build errors in specific environments)
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
        
        // Fetch Cloud Data immediately after initialization
        fetchCloudData(client);
      } catch (err) {
        console.error("Dependency loading failed", err);
        setIsLoading(false);
      }
    };
    loadDependencies();
  }, []);

  // 2. Persistent Data Fetching
  const fetchCloudData = async (client) => {
    if (!client) return;
    try {
      const { data, error } = await client.from('railmadad_sync').select('*').eq('id', 1).single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // If record ID 1 doesn't exist, it means the database is truly fresh
          setLastSync("Cloud Initialized (Empty)");
        } else {
          setLastSync("Connection Error");
        }
        setIsLoading(false);
        return;
      }

      if (data && data.json_data && data.json_data.records) {
        setDbData(data.json_data);
        setLastSync(new Date(data.last_updated || Date.now()).toLocaleTimeString());
        
        // Adjust default filters to match the loaded data range
        if (data.json_data.records.length > 0) {
            const sortedDates = [...data.json_data.records].map(r => r.date).sort();
            setFromDate(sortedDates[0]);
            setToDate(sortedDates[sortedDates.length - 1]);
        }
      }
    } catch (err) { 
      console.error("Fetch Cloud State failed", err); 
    } finally {
      setIsLoading(false);
    }
  };

  // --- CORE ANALYTICS AGGREGATOR ---
  const aggregated = useMemo(() => {
    const validRecords = (dbData.records || []).filter(r => {
        if (r.date < fromDate || r.date > toDate) return false;
        if (selectedZone !== 'All' && r.zone !== selectedZone) return false;
        if (selectedStatus !== 'All' && r.status !== selectedStatus) return false;
        return true;
    });
    
    // Using window.Set to avoid shadowing issues
    const zoneSet = new window.Set();
    const statusSet = new window.Set();
    (dbData.records || []).forEach(r => {
        if(r.zone && r.zone !== 'Unknown') zoneSet.add(r.zone);
        if(r.status && r.status !== 'Unknown') statusSet.add(r.status);
    });

    let unsatCount = 0;
    let resolvedCount = 0;
    let totalResTime = 0;
    let recordsWithResTime = 0;

    const momMap = {};
    const catMomMap = {};
    const mSet = new window.Set();
    const trainMap = {};
    const catSet = new window.Set();
    const feedbackMap = {};
    const shiftMap = { '00:00 - 08:00': 0, '08:00 - 16:00': 0, '16:00 - 24:00': 0 };
    const zoneMap = {};
    const coachMap = {};
    const statusMap = {};

    validRecords.forEach(r => { 
        if ((r.rating||'').toLowerCase().includes('unsatisfactory')) unsatCount++; 
        if ((r.status||'').toLowerCase().includes('closed')) resolvedCount++;
        
        if (r.resTimeMins && r.resTimeMins > 0) {
            totalResTime += r.resTimeMins;
            recordsWithResTime++;
        }

        const stat = String(r.status || 'Pending').trim();
        statusMap[stat] = (statusMap[stat] || 0) + 1;

        if (r.zone && r.zone !== 'Unknown') zoneMap[r.zone] = (zoneMap[r.zone] || 0) + 1;
        if (r.coachType && r.coachType !== 'Unknown') coachMap[r.coachType] = (coachMap[r.coachType] || 0) + 1;

        momMap[r.month] = (momMap[r.month] || 0) + 1; 
        
        mSet.add(r.month);
        if (!catMomMap[r.category]) catMomMap[r.category] = { Total: 0 };
        catMomMap[r.category][r.month] = (catMomMap[r.category][r.month] || 0) + 1;
        catMomMap[r.category].Total += 1;

        catSet.add(r.category);
        if (!trainMap[r.train]) trainMap[r.train] = { train: r.train, Total: 0 };
        trainMap[r.train].Total += 1;
        trainMap[r.train][r.category] = (trainMap[r.train][r.category] || 0) + 1;

        let rate = String(r.rating || 'Not Rated').trim();
        if(rate === '' || rate.toLowerCase() === 'null') rate = 'Not Rated';
        feedbackMap[rate] = (feedbackMap[rate] || 0) + 1;

        if(shiftMap[r.shift] !== undefined) shiftMap[r.shift] += 1;
    });

    const kpis = {
       total: validRecords.length,
       resolved: validRecords.length > 0 ? ((resolvedCount / validRecords.length) * 100).toFixed(1) : "0",
       unsat: validRecords.length > 0 ? ((unsatCount / validRecords.length) * 100).toFixed(1) : "0",
       avgResTime: recordsWithResTime > 0 ? formatMinutesToTime(totalResTime / recordsWithResTime) : "N/A",
    };

    const aiInsights = [];
    if (kpis.total > 0) {
        const topTrain = Object.values(trainMap).sort((a,b) => b.Total - a.Total)[0];
        const topCat = Object.values(catMomMap).sort((a,b) => b.Total - a.Total)[0];
        if (topTrain) aiInsights.push(`Action Required: Train ${topTrain.train} has the highest volume (${topTrain.Total} complaints).`);
        if (topCat) aiInsights.push(`Focus Area: ${topCat.category} is the leading complaint type across all zones.`);
        if (parseFloat(kpis.unsat) > 5) aiInsights.push(`Quality Alert: Unsatisfactory feedback is high (${kpis.unsat}%). Review staff closing remarks.`);
    }

    return { 
        kpis, aiInsights,
        momData: Object.entries(momMap).map(([month, count]) => ({ month, count })).sort((a,b) => a.month.localeCompare(b.month)),
        catMomData: Object.entries(catMomMap).map(([category, counts]) => ({ category, ...counts })).sort((a,b) => b.Total - a.Total),
        monthsSorted: Array.from(mSet).sort(),
        trainData: Object.values(trainMap).sort((a,b) => b.Total - a.Total),
        uniqueCats: Array.from(catSet).sort(),
        feedbackData: Object.entries(feedbackMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
        unsatTable: validRecords.filter(r => (r.rating||'').toLowerCase().includes('unsatisfactory')),
        pestTable: validRecords.filter(r => r.isPest),
        shiftData: Object.entries(shiftMap).map(([shift, complaints]) => ({ shift, complaints })),
        zoneData: Object.entries(zoneMap).map(([zone, count]) => ({ zone, count })).sort((a,b) => b.count - a.count),
        coachData: Object.entries(coachMap).map(([coachType, count]) => ({ coachType, count })).sort((a,b) => b.count - a.count),
        statusData: Object.entries(statusMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value),
        availableZones: Array.from(zoneSet).sort(),
        availableStatuses: Array.from(statusSet).sort()
    };
  }, [dbData, fromDate, toDate, selectedZone, selectedStatus]);

  const { kpis, aiInsights, momData, catMomData, monthsSorted, trainData, uniqueCats, feedbackData, unsatTable, pestTable, shiftData, zoneData, coachData, statusData, availableZones, availableStatuses } = aggregated;

  // --- STABLE FILE PARSER ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX || !supabaseClient) {
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
        const keyHeaders = ['complaintrefno', 'refno', 'createdon', 'comptypename', 'trainstation'];
        
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

        const existingMap = new window.Map();
        const baseRecords = dbData.records || [];
        baseRecords.forEach(r => existingMap.set(String(r.id), r));

        let newRecordsAdded = 0;

        for (let i = headerRowIdx + 1; i < rawArray.length; i++) {
            const row = rawArray[i];
            if (!row || row.length === 0) continue;

            try {
                const refNo = getValue(row, 'complaintrefno') || getValue(row, 'refno');
                const createdOn = getValue(row, 'createdon');
                if (!refNo || !createdOn) continue; 

                const recordId = String(refNo).trim();
                if (existingMap.has(recordId)) continue;

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

                existingMap.set(recordId, {
                    id: recordId,
                    date: parsedObj.date,
                    month: parsedObj.month,
                    shift: parsedObj.shift,
                    category: String(rawCat).trim(), 
                    subType: String(rawSubCat).trim(),
                    isPest: isPest,
                    train: trainNo,
                    rating: String(getValue(row, 'rating') || 'Not Rated').trim(),
                    status: String(getValue(row, 'status') || getValue(row, 'finalstatus') || 'Unknown').trim(),
                    zone: String(getValue(row, 'zonecode') || 'Unknown').trim(),
                    coachType: String(getValue(row, 'coachtype') || 'Unknown').trim(),
                    resTimeMins: parseResolutionTime(getValue(row, 'diff') || getValue(row, 'avgcdiff')),
                    desc: String(rawDesc).substring(0, 200),
                });
                newRecordsAdded++;
            } catch (rowErr) { console.warn("Row skipped", rowErr); }
        }

        if (newRecordsAdded > 0) {
            const newData = { records: Array.from(existingMap.values()) };
            
            // Critical: Update Cloud BEFORE local state to ensure persistence
            const { error } = await supabaseClient.from('railmadad_sync').upsert({ 
                id: 1, 
                json_data: newData, 
                last_updated: new Date().toISOString() 
            }, { onConflict: 'id' });

            if (error) {
                console.error("Cloud Upsert failed", error);
                showToast("⚠️ Cloud Sync failed. Data saved locally only.");
            } else {
                setDbData(newData);
                setLastSync(new Date().toLocaleTimeString());
                const sortedDates = [...newData.records].map(r => r.date).sort();
                setFromDate(sortedDates[0]); setToDate(sortedDates[sortedDates.length - 1]);
                showToast(`✅ Successfully synced ${newRecordsAdded} records.`);
            }
        } else {
            showToast("No new records detected.");
        }
      } catch (err) {
        console.error("Parse Error:", err);
        showToast("Error processing file format.");
      }
      setIsUploading(false); e.target.value = null; 
    };
    reader.readAsArrayBuffer(file);
  };

  const executeHardReset = async () => {
    if (!supabaseClient) return;
    setShowResetModal(false);
    showToast("Wiping database...");
    setDbData(initialRawDatabase); 
    setFromDate(lastMonthStr); setToDate(todayStr);
    setSelectedZone('All'); setSelectedStatus('All');
    try {
      await supabaseClient.from('railmadad_sync').upsert({ id: 1, json_data: initialRawDatabase, last_updated: new Date().toISOString() }, { onConflict: 'id' });
      showToast("✅ Database wiped clean.");
    } catch (err) { showToast("Cloud reset failed."); }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <p className="text-slate-600 font-bold text-lg animate-pulse tracking-wide uppercase">Connecting to Indian Railways Cloud...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 relative">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center animate-bounce border border-slate-700">
          <Sparkles className="w-5 h-5 mr-3 text-indigo-400" />
          <span className="font-medium text-sm leading-snug">{String(toastMessage)}</span>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full border border-slate-100 transform transition-all">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Wipe Database?</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">Permanently delete all raw data locally and in cloud.</p>
            <div className="flex space-x-3">
              <button onClick={() => setShowResetModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={executeHardReset} className="flex-1 py-2.5 rounded-lg bg-rose-600 text-white font-semibold text-sm hover:bg-rose-700 transition-colors shadow-sm shadow-rose-200">Yes, Wipe Data</button>
            </div>
          </div>
        </div>
      )}
      
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
              <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
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
           <div className="flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity">
             <Cpu className="w-4 h-4 text-indigo-600 mr-2" />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Neural Mesh Analytics</span>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col max-w-full overflow-hidden bg-slate-50">
        <header className="md:hidden bg-indigo-700 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
          <h1 className="text-lg font-bold flex items-center"><TrainFront className="w-5 h-5 mr-2"/> RailMadad Dashboard</h1>
          <button onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
        </header>

        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0 z-20 sticky top-0 md:top-0 shadow-sm">
           <h2 className="text-xl font-black text-slate-800 tracking-tight">{String(navItemsList.find(i => i.id === activeTab)?.label)}</h2>
           <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 bg-slate-50 border border-slate-200 p-2 rounded-xl flex-wrap">
              <div className="flex items-center text-sm">
                 <Filter className="w-4 h-4 text-indigo-500 mr-2 shrink-0" />
                 <span className="font-bold text-slate-600 mr-2 text-[10px] uppercase tracking-wider">Zone</span>
                 <select value={selectedZone} onChange={e => setSelectedZone(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium max-w-[100px]">
                    <option value="All">All</option>
                    {availableZones.map(z => <option key={String(z)} value={String(z)}>{String(z)}</option>)}
                 </select>
              </div>
              <div className="flex items-center text-sm">
                 <span className="font-bold text-slate-600 mx-2 text-[10px] uppercase tracking-wider">Status</span>
                 <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium max-w-[100px]">
                    <option value="All">All</option>
                    {availableStatuses.map(s => <option key={String(s)} value={String(s)}>{String(s)}</option>)}
                 </select>
              </div>
              <div className="flex items-center text-sm">
                 <span className="font-bold text-slate-600 mx-2 text-[10px] uppercase tracking-wider">From</span>
                 <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium" />
              </div>
              <div className="flex items-center text-sm">
                 <span className="font-bold text-slate-600 mx-2 text-[10px] uppercase tracking-wider">To</span>
                 <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium" />
              </div>
           </div>
        </div>

        <div className="p-4 md:p-8 flex-1 overflow-y-auto space-y-8">
          {dbData.records.length === 0 ? (
             <div className="bg-white p-16 mt-10 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center max-w-2xl mx-auto shadow-sm">
               <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6"><FileSpreadsheet className="w-12 h-12 text-indigo-400" /></div>
               <h3 className="text-3xl font-black text-slate-800 tracking-tight">Dashboard Empty</h3>
               <p className="text-slate-500 mt-4 max-w-md leading-relaxed font-medium">Append your RailMadad Raw CSV export to see real-time analytics.</p>
             </div>
          ) : !kpis || kpis.total === 0 ? (
             <div className="bg-white p-12 mt-10 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center max-w-2xl mx-auto shadow-sm">
               <Calendar className="w-12 h-12 text-slate-300 mb-4" />
               <h3 className="text-xl font-bold text-slate-800">No Records Found</h3>
               <p className="text-slate-500 mt-2 max-w-sm">No data matches your current date, zone, or status filters.</p>
             </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center mb-4">
                        <Bot className="w-5 h-5 text-indigo-600 mr-2" />
                        <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-widest">Performance Insights</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {aiInsights.map((insight, idx) => (
                            <div key={idx} className="bg-white/80 p-3 rounded-lg border border-indigo-50 text-xs font-medium text-slate-700 flex items-start">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1 mr-2 shrink-0"></span>
                                {insight}
                            </div>
                        ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricCard title="Filtered Cases" value={String(kpis.total)} icon={LayoutDashboard} colorClass="bg-blue-600 text-white" />
                    <MetricCard title="Avg Resolution Time" value={String(kpis.avgResTime)} icon={Clock} colorClass="bg-emerald-600 text-white" />
                    <MetricCard title="Unsatisfactory Rate" value={`${String(kpis.unsat)}%`} icon={AlertTriangle} colorClass="bg-rose-600 text-white" />
                    <MetricCard title="Resolution Rate" value={`${String(kpis.resolved)}%`} icon={CheckCircle} colorClass="bg-indigo-600 text-white" />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-6"><h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">MoM Volume Trend</h3><BarChart3 className="text-slate-300 w-5 h-5"/></div>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={momData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="count" name="Total Complaints" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={50} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6"><h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Status Distribution</h3><CheckCircle className="text-slate-300 w-5 h-5"/></div>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={statusData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={4} dataKey="value">
                                {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                              </Pie>
                              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                              <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'category' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-fit">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50"><h3 className="text-base font-bold text-slate-800">Category Wise MoM Summary</h3></div>
                    <div className="overflow-x-auto max-h-[500px]">
                      <table className="min-w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm"><tr className="text-slate-500 text-[10px] uppercase tracking-widest"><th className="p-4 font-bold border-b border-slate-200">Category</th>{monthsSorted.map(m => <th key={String(m)} className="p-4 font-bold border-b border-slate-200">{String(m)}</th>)}<th className="p-4 font-black border-b border-slate-200 text-slate-800">Total</th></tr></thead>
                        <tbody className="text-sm text-slate-700 divide-y divide-slate-100">{catMomData.map((row, idx) => (<tr key={idx} className="hover:bg-slate-50 transition-colors"><td className="p-4 font-bold text-slate-900 flex items-center"><Sparkles className="w-4 h-4 mr-2 text-indigo-400" />{String(row.category)}</td>{monthsSorted.map(m => <td key={String(m)} className="p-4 font-medium text-slate-600">{String(row[m] || '-')}</td>)}<td className="p-4 font-black text-indigo-600">{String(row.Total)}</td></tr>))}</tbody>
                      </table>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden h-fit">
                    <div className="px-6 py-5 border-b border-rose-100 bg-rose-50 flex items-center"><Bug className="w-5 h-5 text-rose-600 mr-2" /><h3 className="text-base font-bold text-rose-900">Pest Control & Rodent Target List</h3></div>
                    {pestTable.length === 0 ? (<div className="p-8 text-center text-slate-500 font-medium">No records found.</div>) : (
                      <div className="overflow-x-auto max-h-96">
                        <table className="min-w-full text-left border-collapse"><thead className="sticky top-0 bg-white shadow-sm z-10"><tr className="text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100"><th className="p-4 font-bold">Ref No</th><th className="p-4 font-bold">Date</th><th className="p-4 font-bold">Train</th><th className="p-4 font-bold">Details</th></tr></thead>
                          <tbody className="text-sm text-slate-700 divide-y divide-slate-100">{pestTable.map((row, idx) => (<tr key={idx} className="hover:bg-rose-50/50"><td className="p-4 font-mono text-[10px] text-slate-400">{String(row.id)}</td><td className="p-4 font-medium whitespace-nowrap">{String(row.date)}</td><td className="p-4 font-bold text-rose-700">{String(row.train)}</td><td className="p-4 text-slate-600 max-w-md"><span className="font-semibold text-slate-800">{String(row.subType || "Unclassified")}</span> <br/><span className="text-xs">{String(row.desc)}</span></td></tr>))}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'trains' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-fit">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Affected Trains Analysis</h3>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trainData.slice(0, 15)} layout="vertical" margin={{ left: 60, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                          <YAxis dataKey="train" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} dx={-10} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="Total" name="Total Cases" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-fit">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50"><h3 className="text-base font-bold text-slate-800">Train Number vs. Category Matrix</h3></div>
                    <div className="overflow-x-auto max-h-[600px]">
                      <table className="min-w-full text-left border-collapse"><thead className="sticky top-0 bg-slate-100 z-10 shadow-sm"><tr className="text-slate-500 text-[10px] uppercase tracking-widest"><th className="p-4 font-bold border-b border-slate-200">Train</th>{uniqueCats.map(c => <th key={String(c)} className="p-4 font-bold border-b border-slate-200 whitespace-nowrap">{String(c)}</th>)}<th className="p-4 font-black border-b border-slate-200 text-slate-800">Total</th></tr></thead>
                        <tbody className="text-sm text-slate-700 divide-y divide-slate-100">{trainData.map((row, idx) => (<tr key={idx} className="hover:bg-slate-50 transition-colors"><td className="p-4 font-bold flex items-center text-slate-900 whitespace-nowrap"><TrainFront className="w-4 h-4 mr-2 text-indigo-400" />{String(row.train)}</td>{uniqueCats.map(c => <td key={String(c)} className="p-4 font-medium text-slate-600">{String(row[c] || '-')}</td>)}<td className="p-4 font-black text-indigo-600">{String(row.Total)}</td></tr>))}</tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'geo' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-fit">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Zone Breakdown</h3>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={zoneData} layout="vertical" margin={{ left: 20, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                          <YAxis dataKey="zone" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} />
                          <Bar dataKey="count" name="Cases" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-fit">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Coach Type Distribution</h3>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={coachData} layout="vertical" margin={{ left: 20, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                          <YAxis dataKey="coachType" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} />
                          <Bar dataKey="count" name="Cases" fill="#10b981" radius={[0, 6, 6, 0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'operations' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-fit">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50"><h3 className="text-base font-bold text-slate-800">Shift Volume</h3></div>
                    <div className="overflow-x-auto"><table className="min-w-full text-left border-collapse"><thead><tr className="bg-white text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100"><th className="p-4 font-bold">Shift Bracket</th><th className="p-4 font-bold">Volume</th></tr></thead><tbody className="text-sm text-slate-700 divide-y divide-slate-100">{shiftData.map((row, idx) => (<tr key={idx} className="hover:bg-slate-50"><td className="p-4 font-bold text-slate-800 flex items-center"><Clock className="w-4 h-4 mr-2 text-slate-400"/>{String(row.shift)}</td><td className="p-4 font-black text-indigo-600">{String(row.complaints)}</td></tr>))}</tbody></table></div>
                  </div>
                  <div className="space-y-8 h-fit">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Feedback Type</h3>
                        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={feedbackData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">{feedbackData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend verticalAlign="bottom" height={36} iconType="circle" /></PieChart></ResponsiveContainer></div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                       <div className="px-6 py-5 border-b border-slate-100 bg-rose-50 flex items-center"><MessageSquareWarning className="w-5 h-5 text-rose-600 mr-2" /><h3 className="text-base font-bold text-rose-900">Highest Feedback: Unsatisfactory Cases</h3></div>
                       {unsatTable.length === 0 ? (<div className="p-8 text-center text-slate-500 font-medium">No results found.</div>) : (
                         <div className="overflow-x-auto max-h-96"><table className="min-w-full text-left border-collapse"><thead className="sticky top-0 bg-white shadow-sm z-10"><tr className="text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100"><th className="p-4 font-bold">Ref No.</th><th className="p-4 font-bold">Train</th><th className="p-4 font-bold">Desc</th></tr></thead><tbody className="text-sm text-slate-700 divide-y divide-slate-100">{unsatTable.map((row, idx) => (
                           <tr key={idx} className="hover:bg-slate-50">
                             <td className="p-4 font-mono text-[10px] text-slate-400 whitespace-nowrap">{String(row.id)}</td>
                             <td className="p-4 font-bold text-slate-800">{String(row.train)}</td>
                             <td className="p-4 text-xs text-slate-600 max-w-md">{String(row.desc)}</td>
                           </tr>
                         ))}</tbody></table></div>
                       )}
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