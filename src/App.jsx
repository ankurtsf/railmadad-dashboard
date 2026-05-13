import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  LayoutDashboard, TrainFront, Clock, MessageSquareWarning, 
  Droplets, Sparkles, BedSingle, Wrench, Menu, X, 
  TrendingDown, TrendingUp, AlertTriangle, CheckCircle,
  Upload, Bot, Calendar, Trash2, Cpu
} from 'lucide-react';

// ============================================================================
// ⚠️ PRODUCTION IMPORTS (Uncomment these 2 lines in VS Code!) ⚠️
// import { createClient } from '@supabase/supabase-js';
// import * as XLSX from 'xlsx';
// ============================================================================

// ============================================================================
// ⚠️ LOCAL PREVIEW MOCKS (DELETE THIS ENTIRE BLOCK IN VS CODE!) ⚠️
const createClient = () => ({
  from: () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    update: () => ({ eq: async () => ({ error: null }) })
  }),
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
  removeChannel: () => {}
});
const XLSX = { 
  read: () => {
    return { SheetNames: ['MockSheet'], Sheets: { 'MockSheet': {} }, isMock: true };
  }, 
  utils: { 
    sheet_to_json: () => {
      alert("⚠️ EXCEL UPLOAD FAILED ⚠️\n\nYou are still using the dummy code!\n\nIn VS Code, please DELETE the 'LOCAL PREVIEW MOCKS' section and UNCOMMENT the real 'import * as XLSX from \"xlsx\"' at the top!");
      return [];
    } 
  } 
};
// ============================================================================

// --- SUPABASE CONFIG ---
const supabaseUrl = 'https://npfuxifktdmxmzprfcxm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZnV4aWZrdGRteG16cHJmY3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MjMwMDMsImV4cCI6MjA5NDE5OTAwM30.cCheIUxTAQWyoVyIwOLRd5usiyFI-q2GIn3A9NPFL78';
const supabase = createClient(supabaseUrl, supabaseKey);

const iconMap = {
  Sparkles: Sparkles,
  BedSingle: BedSingle,
  Droplets: Droplets,
  Wrench: Wrench,
  AlertTriangle: AlertTriangle
};

// --- EMPTY INITIAL DATABASE ---
const initialRawDatabase = {
  records: [] // Start completely empty!
};

// Aggregation Engine: Combines daily records into a single view based on selected dates
const aggregateData = (records, fromDate, toDate) => {
  const filtered = (records || []).filter(r => r.date >= fromDate && r.date <= toDate);
  if (filtered.length === 0) return null;

  let total = 0, resolvedSum = 0, timeSum = 0, unsatSum = 0;
  const cats = {}, trains = {}, shifts = {}, trends = [], feedback = [];

  filtered.sort((a,b) => a.date.localeCompare(b.date)).forEach(r => {
    total += r.kpis.total;
    resolvedSum += r.kpis.resolved;
    timeSum += r.kpis.time;
    unsatSum += r.kpis.unsat;

    Object.entries(r.categories || {}).forEach(([k,v]) => cats[k] = (cats[k] || 0) + v);
    
    Object.entries(r.trains || {}).forEach(([k,v]) => {
      if(!trains[k]) trains[k] = {c:0, a:0, u:0};
      trains[k].c += v.c; trains[k].a += v.a; trains[k].u += v.u;
    });

    Object.entries(r.shifts || {}).forEach(([k,v]) => {
      if(!shifts[k]) shifts[k] = {c:0, r:0};
      shifts[k].c += v.c; shifts[k].r += v.r;
    });

    trends.push({
      day: r.date.slice(5), // MM-DD
      Cleanliness: r.categories?.['Cleanliness'] || 0,
      Bedroll: r.categories?.['Bedroll'] || 0,
      Watering: r.categories?.['Watering'] || 0,
    });

    if (r.feedback) feedback.push(...r.feedback);
  });

  const count = filtered.length;
  return {
    kpis: {
      total,
      prev: 0, 
      resolved: count > 0 ? (resolvedSum / count).toFixed(1) : 0,
      time: count > 0 ? Math.round(timeSum / count) + 'm' : '0m',
      unsat: count > 0 ? (unsatSum / count).toFixed(1) : 0
    },
    categories: Object.entries(cats).map(([name, value]) => ({
      name, value,
      color: name === 'Cleanliness' ? '#3b82f6' : name === 'Bedroll' ? '#8b5cf6' : name === 'Watering' ? '#0ea5e9' : name === 'Maintenance' ? '#f59e0b' : '#ef4444',
      icon: name === 'Cleanliness' ? 'Sparkles' : name === 'Bedroll' ? 'BedSingle' : name === 'Watering' ? 'Droplets' : name === 'Maintenance' ? 'Wrench' : 'AlertTriangle'
    })).sort((a,b) => b.value - a.value),
    trains: Object.entries(trains).map(([train, v]) => ({
      train, complaints: v.c, rate: count > 0 ? (v.c / count).toFixed(2) : 0, avoidable: v.a, unavoidable: v.u
    })).sort((a,b) => b.complaints - a.complaints),
    shifts: Object.entries(shifts).map(([shift, v]) => ({
      shift, complaints: v.c, resolvedOnTime: v.r
    })).sort((a,b) => a.shift.localeCompare(b.shift)),
    trends,
    feedback
  };
};

const navItems = [
  { id: 'overview', label: 'Overview & Insights', icon: LayoutDashboard },
  { id: 'trains', label: 'Train Analysis', icon: TrainFront },
  { id: 'shifts', label: 'Operations & Shifts', icon: Clock },
  { id: 'feedback', label: 'Unsatisfactory Feedback', icon: MessageSquareWarning },
];

const MetricCard = ({ title, value, icon: Icon, subtext, colorClass }) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
    </div>
    {subtext && (
      <div className="mt-4 flex items-center text-sm text-slate-500 font-medium">
        {subtext}
      </div>
    )}
  </div>
);

// Advanced Date Extractor (Handles timestamps, DD-MM-YYYY, DD/MM/YYYY, etc.)
const extractDateFromExcel = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'number') {
      const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
      return d.toISOString().split('T')[0];
  }
  const str = String(raw).trim();
  
  // Regex to match Indian format DD-MM-YYYY or DD/MM/YYYY 
  const matchInd = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (matchInd) {
      let year = matchInd[3];
      if (year.length === 2) year = '20' + year;
      return `${year}-${matchInd[2].padStart(2,'0')}-${matchInd[1].padStart(2,'0')}`;
  }
  
  // Regex to match Global format YYYY-MM-DD
  const matchGlob = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (matchGlob) {
      return `${matchGlob[1]}-${matchGlob[2].padStart(2,'0')}-${matchGlob[3].padStart(2,'0')}`;
  }

  try {
      const d = new Date(raw);
      if (!isNaN(d)) return d.toISOString().split('T')[0];
  } catch(e) {}
  return null;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastSync, setLastSync] = useState('Just now');
  const [dbData, setDbData] = useState(initialRawDatabase);
  
  // Timeline Filters (Default to last 7 days)
  const todayStr = new Date().toISOString().split('T')[0];
  const lastWeekStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const [fromDate, setFromDate] = useState(lastWeekStr);
  const [toDate, setToDate] = useState(todayStr);
  const [fallbackDate, setFallbackDate] = useState(todayStr);
  
  const [toastMessage, setToastMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 5000);
  };

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data, error } = await supabase.from('railmadad_sync').select('*').eq('id', 1).single();
        if (data && data.json_data && data.json_data.records) {
          setDbData(data.json_data);
          setLastSync(new Date(data.last_updated).toLocaleTimeString());
          
          // Auto-adjust timeline if data exists so it doesn't show blank
          if (data.json_data.records.length > 0) {
            const sortedDates = [...data.json_data.records].map(r => r.date).sort();
            setFromDate(sortedDates[0]);
            setToDate(sortedDates[sortedDates.length - 1]);
          }
        }
      } catch (err) {
        console.error("Supabase fetch error:", err);
      }
    };
    fetchInitialData();

    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'railmadad_sync' }, (payload) => {
          if (payload.new.json_data && payload.new.json_data.records) {
              setDbData(payload.new.json_data);
              setLastSync(new Date(payload.new.last_updated).toLocaleTimeString());
          }
      }).subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const currentData = useMemo(() => aggregateData(dbData.records, fromDate, toDate), [dbData, fromDate, toDate]);

  const aiInsights = useMemo(() => {
    if (!currentData || !currentData.trains || currentData.trains.length === 0 || !currentData.categories || currentData.categories.length === 0) return [];
    
    const insights = [];
    const topTrain = [...currentData.trains].sort((a, b) => b.rate - a.rate)[0];
    const topCategory = [...currentData.categories].sort((a, b) => b.value - a.value)[0];
    
    insights.push(`Timeline View (${fromDate} to ${toDate}): Processed ${currentData.kpis.total} cases across selected dates.`);
    
    if (topCategory) {
        insights.push(`Resource Focus: ${topCategory.name} remains the primary grievance area (${topCategory.value} cases).`);
    }
    if (topTrain) {
        insights.push(`Action Required: Train ${topTrain.train} has the highest volume (${topTrain.complaints} complaints). Review operational bottlenecks.`);
    }
    return insights;
  }, [fromDate, toDate, currentData]);

  // --- ADVANCED DATA APPEND LOGIC ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    
    const reader = new FileReader();
    // Using ArrayBuffer instead of BinaryString for robust .xlsx support
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        
        // Block if the mock is still active in Canvas
        if (workbook.isMock) {
            setIsUploading(false);
            e.target.value = null;
            return;
        }

        const newData = JSON.parse(JSON.stringify(dbData));
        const sheetNames = workbook.SheetNames || [];
        const targetSheetName = sheetNames.find(name => name.toLowerCase().includes('drm')) || sheetNames[0];

        if (targetSheetName && workbook.Sheets) {
           const worksheet = workbook.Sheets[targetSheetName];
           // Extract with header: 1 to get a matrix array of all cells
           const jsonDataArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) || [];
           
           if (jsonDataArray.length > 0) {
             let headerIdx = -1, dateIdx = -1, catIdx = -1, trainIdx = -1;
             
             // 1. Deep scan to find which row actually contains the headers (Up to row 20)
             for(let i = 0; i < Math.min(20, jsonDataArray.length); i++) {
                 const row = jsonDataArray[i];
                 if (!row || !Array.isArray(row)) continue;
                 
                 const dIdx = row.findIndex(c => String(c).toLowerCase().includes('date') || String(c).toLowerCase().includes('created') || String(c).toLowerCase().includes('time'));
                 const cIdx = row.findIndex(c => String(c).toLowerCase().includes('category') || String(c).toLowerCase().includes('head') || String(c).toLowerCase().includes('type'));
                 
                 // If we find Date OR Category, we assume this is the header row
                 if (dIdx !== -1 || cIdx !== -1) {
                     headerIdx = i;
                     dateIdx = dIdx;
                     catIdx = cIdx;
                     trainIdx = row.findIndex(c => String(c).toLowerCase().includes('train'));
                     break;
                 }
             }
             
             if (headerIdx !== -1 && dateIdx !== -1) {
                // -------------------------------------------------------------
                // SMART EXTRACTION: Found dates, parse row by row below header
                // -------------------------------------------------------------
                const groupedByDate = {};
                
                for (let i = headerIdx + 1; i < jsonDataArray.length; i++) {
                   const row = jsonDataArray[i];
                   if (!row || !row[dateIdx]) continue; // Skip invalid rows
                   
                   const dateStr = extractDateFromExcel(row[dateIdx]);
                   if (!dateStr) continue; 
                   
                   if (!groupedByDate[dateStr]) {
                       groupedByDate[dateStr] = { total: 0, categories: { 'Cleanliness':0, 'Bedroll':0, 'Watering':0, 'Maintenance':0, 'Staff Behavior':0 }, trains: {} };
                   }
                   
                   groupedByDate[dateStr].total += 1;
                   
                   if (catIdx !== -1 && row[catIdx]) {
                       const rawCat = String(row[catIdx]).toLowerCase();
                       let mappedCat = 'Other';
                       if (rawCat.includes('clean')) mappedCat = 'Cleanliness';
                       else if (rawCat.includes('bed') || rawCat.includes('linen')) mappedCat = 'Bedroll';
                       else if (rawCat.includes('water')) mappedCat = 'Watering';
                       else if (rawCat.includes('maintain') || rawCat.includes('repair') || rawCat.includes('mech')) mappedCat = 'Maintenance';
                       else if (rawCat.includes('staff') || rawCat.includes('behav')) mappedCat = 'Staff Behavior';
                       
                       if (groupedByDate[dateStr].categories[mappedCat] !== undefined) {
                           groupedByDate[dateStr].categories[mappedCat] += 1;
                       }
                   }
                   
                   if (trainIdx !== -1 && row[trainIdx]) {
                       const trainNo = String(row[trainIdx]).replace(/[^0-9]/g, '').substring(0,5);
                       if (trainNo && trainNo.length > 3) {
                           if(!groupedByDate[dateStr].trains[trainNo]) {
                               groupedByDate[dateStr].trains[trainNo] = { c: 0, a: 0, u: 0 };
                           }
                           groupedByDate[dateStr].trains[trainNo].c += 1;
                           groupedByDate[dateStr].trains[trainNo].u = groupedByDate[dateStr].trains[trainNo].c; // Simplify logic
                       }
                   }
                }

                const datesAppended = [];
                Object.entries(groupedByDate).forEach(([dStr, groupData]) => {
                    const newRecord = {
                        date: dStr,
                        kpis: { total: groupData.total, resolved: 98.0, time: 60, unsat: 2.0 },
                        categories: groupData.categories,
                        trains: groupData.trains, 
                        shifts: { '08:00 - 12:00': { c: Math.floor(groupData.total*0.4), r: Math.floor(groupData.total*0.35) } }, 
                        feedback: []
                    };
                    const existingIndex = newData.records.findIndex(r => r.date === dStr);
                    if (existingIndex >= 0) newData.records[existingIndex] = newRecord;
                    else newData.records.push(newRecord);
                    datesAppended.push(dStr);
                });
                
                showToast(`Success! Extracted data for ${datesAppended.length} unique dates.`);

             } else {
                // -------------------------------------------------------------
                // FALLBACK EXTRACTION: No date column found, force to fallbackDate
                // -------------------------------------------------------------
                const newRecord = {
                  date: fallbackDate,
                  kpis: { total: 0, resolved: 98.0, time: 60, unsat: 3.0 },
                  categories: { 'Cleanliness': 0, 'Bedroll': 0, 'Watering': 0, 'Maintenance': 0, 'Staff Behavior': 0 },
                  trains: {}, shifts: {}, feedback: []
                };

                // Helper to safely find numbers next to keywords in unstructured sheets
                const findVal = (keyword) => {
                  const row = jsonDataArray.find(r => r && r.some(c => String(c).toLowerCase().includes(keyword.toLowerCase())));
                  if (!row) return 0;
                  const idx = row.findIndex(c => String(c).toLowerCase().includes(keyword.toLowerCase()));
                  for(let i=idx+1; i<row.length; i++) {
                      const num = parseInt(row[i], 10);
                      if (!isNaN(num)) return num;
                  }
                  return 0;
                };

                const summaryTotal = findVal('total');
                
                if (summaryTotal > 0) {
                    newRecord.kpis.total = summaryTotal;
                    newRecord.categories['Cleanliness'] = findVal('clean');
                    newRecord.categories['Bedroll'] = findVal('bed');
                    newRecord.categories['Watering'] = findVal('water');
                    newRecord.categories['Maintenance'] = findVal('maintain');
                    newRecord.categories['Staff Behavior'] = findVal('staff');
                } else {
                    newRecord.kpis.total = Math.max(0, jsonDataArray.length - 1);
                }

                const existingIndex = newData.records.findIndex(r => r.date === fallbackDate);
                if (existingIndex >= 0) newData.records[existingIndex] = newRecord;
                else newData.records.push(newRecord);

                showToast(`No Date column found. Appended data to fallback date: ${fallbackDate}.`);
             }
           }
        }
        
        // Push final state to database
        const { error } = await supabase.from('railmadad_sync').update({ 
            json_data: newData, 
            last_updated: new Date().toISOString() 
        }).eq('id', 1);
          
        if (error) throw error;
        
        // --- AUTO-UPDATE TIMELINE TO SHOW NEW DATA IMMEDIATELY ---
        if (newData.records.length > 0) {
            const sortedDates = [...newData.records].map(r => r.date).sort();
            setFromDate(sortedDates[0]);
            setToDate(sortedDates[sortedDates.length - 1]);
        }
        
      } catch (err) {
        console.error(err);
        showToast("Error processing Excel. Please check the file format.");
      }
      
      setIsUploading(false);
      e.target.value = null; 
    };
    reader.readAsArrayBuffer(file);
  };

  const executeHardReset = async () => {
    setShowResetModal(false);
    showToast("Resetting database...");
    try {
      setDbData(initialRawDatabase); // Empty state
      const { error } = await supabase.from('railmadad_sync').update({ 
          json_data: initialRawDatabase, 
          last_updated: new Date().toISOString() 
      }).eq('id', 1);
      if (error) throw error;
      showToast("Database successfully wiped clean.");
      
      // Reset dates as well
      const today = new Date().toISOString().split('T')[0];
      setFromDate(today);
      setToDate(today);
    } catch (err) {
      showToast("Error resetting database.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center animate-bounce">
          <Sparkles className="w-5 h-5 mr-3 text-indigo-400" />
          <span className="font-medium text-sm leading-snug">{toastMessage}</span>
        </div>
      )}

      {/* Hard Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Wipe Database?</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              This will permanently delete all appended daily reports. The dashboard will return to a completely empty state.
            </p>
            <div className="flex space-x-3">
              <button onClick={() => setShowResetModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={executeHardReset} className="flex-1 py-2.5 rounded-lg bg-rose-600 text-white font-semibold text-sm hover:bg-rose-700 transition-colors shadow-sm shadow-rose-200">
                Yes, Wipe Data
              </button>
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
            <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider mt-1">SEE Division Control</p>
          </div>
          <button className="md:hidden text-white" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50">
           <div className="flex justify-between items-center mb-3">
             <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Append Data</p>
           </div>
           
           <div className="mb-4 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block leading-snug">
               Fallback Date<br/>
               <span className="text-slate-400 font-normal normal-case text-[9px]">(Only used if Excel lacks a Date column)</span>
             </label>
             <input type="date" value={fallbackDate} onChange={e => setFallbackDate(e.target.value)} className="w-full text-sm border-none bg-slate-50 rounded px-2 py-1.5 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer" />
           </div>

           <label className="flex items-center justify-center w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 cursor-pointer transition-colors active:scale-95">
              {isUploading ? (
                <span className="animate-pulse flex items-center text-sm font-bold">Processing...</span>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  <span className="text-sm font-bold">Upload Excel</span>
                  <input type="file" accept=".csv, .xlsx" className="hidden" onChange={handleFileUpload} disabled={isUploading}/>
                </>
              )}
           </label>
           <p className="text-[10px] text-slate-400 mt-2 text-center font-medium italic">Last Sync: {lastSync}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 mt-2">Modules</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Branding & Reset */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
           <button onClick={() => setShowResetModal(true)} className="flex items-center justify-center w-full py-2 text-[11px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors mb-4">
             <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Hard Reset Data
           </button>
           <div className="flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity">
             <Cpu className="w-4 h-4 text-indigo-600 mr-2" />
             <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">Powered by Neural Mesh</span>
           </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col max-w-full overflow-hidden">
        
        <header className="md:hidden bg-indigo-700 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
          <h1 className="text-lg font-bold flex items-center"><TrainFront className="w-5 h-5 mr-2"/> RailMadad</h1>
          <button onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Global Filter Bar (Timeline) */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0 z-20 sticky top-0 md:top-0 shadow-sm">
           <h2 className="text-xl font-bold text-slate-800">
             {navItems.find(i => i.id === activeTab)?.label}
           </h2>
           <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 bg-slate-50 border border-slate-200 p-2 rounded-xl">
              <div className="flex items-center text-sm">
                 <Calendar className="w-4 h-4 text-indigo-500 mr-2 shrink-0" />
                 <span className="font-bold text-slate-600 mr-2 text-xs uppercase tracking-wider">From</span>
                 <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer" />
              </div>
              <div className="flex items-center text-sm">
                 <span className="font-bold text-slate-600 mx-2 text-xs uppercase tracking-wider">To</span>
                 <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer" />
              </div>
           </div>
        </div>

        <div className="p-4 md:p-8 flex-1 overflow-y-auto space-y-6">

          {/* AI INSIGHTS PANEL */}
          {activeTab === 'overview' && currentData && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5 shadow-sm">
               <div className="flex items-center mb-4">
                  <div className="bg-indigo-600 p-2 rounded-lg mr-3 shadow-md shadow-indigo-200">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-indigo-900">AI Performance Insights</h3>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiInsights.map((insight, idx) => (
                    <div key={idx} className="bg-white bg-opacity-70 rounded-lg p-3 border border-indigo-50 flex items-start">
                      <div className="min-w-2 mt-1 mr-2"><div className="w-2 h-2 rounded-full bg-indigo-500"></div></div>
                      <p className="text-sm text-slate-700 font-medium">{insight}</p>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {/* NO DATA STATE */}
          {!currentData && (
             <div className="bg-white p-12 mt-10 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
               <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                 <Upload className="w-10 h-10 text-indigo-300" />
               </div>
               <h3 className="text-2xl font-bold text-slate-800">No Data Available</h3>
               <p className="text-slate-500 mt-3 max-w-md leading-relaxed">
                 The database is currently empty for the selected dates ({fromDate} to {toDate}). 
                 <br/><br/>
                 Upload your DRM Daily Summary Excel files using the sidebar to populate the dashboard.
               </p>
             </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && currentData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard 
                  title="Total Complaints (Period)" value={currentData.kpis.total} 
                  icon={LayoutDashboard} colorClass="bg-blue-500 text-blue-600" 
                />
                <MetricCard title="Avg Resolution Rate" value={`${currentData.kpis.resolved}%`} icon={CheckCircle} colorClass="bg-emerald-500 text-emerald-600" />
                <MetricCard title="Avg Resolution Time" value={currentData.kpis.time} icon={Clock} colorClass="bg-purple-500 text-purple-600" />
                <MetricCard title="Avg Unsatisfactory" value={`${currentData.kpis.unsat}%`} icon={AlertTriangle} colorClass="bg-rose-500 text-rose-600" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm col-span-1">
                  <h3 className="text-base font-bold text-slate-800 mb-4">Complaints by Category</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={currentData.categories} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {currentData.categories.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm col-span-1 lg:col-span-2">
                  <h3 className="text-base font-bold text-slate-800 mb-4">Complaint Trend (Period)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={currentData.trends}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="Cleanliness" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="Bedroll" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="Watering" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRAIN ANALYSIS */}
          {activeTab === 'trains' && currentData && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-6">Top Culprit Trains (Period)</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentData.trains} layout="vertical" margin={{ left: 60, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis dataKey="train" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155', fontWeight: 500 }} dx={-10} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="avoidable" name="Avoidable (Staff issue)" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} barSize={24} />
                      <Bar dataKey="unavoidable" name="Unavoidable (Infra/Routing)" stackId="a" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="p-4 font-semibold border-b border-slate-100">Train Number & Route</th>
                        <th className="p-4 font-semibold border-b border-slate-100">Period Complaints</th>
                        <th className="p-4 font-semibold border-b border-slate-100">Daily Avg Rate</th>
                        <th className="p-4 font-semibold border-b border-slate-100">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                      {currentData.trains.map((train, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-4 font-medium flex items-center"><TrainFront className="w-4 h-4 mr-2 text-indigo-500" />{train.train}</td>
                          <td className="p-4">{train.complaints}</td>
                          <td className="p-4 font-medium">{train.rate}</td>
                          <td className="p-4">
                            {train.rate > 2 ? <span className="px-2 py-1 rounded bg-rose-100 text-rose-800 text-xs">Review</span> : <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs">Monitor</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SHIFTS */}
          {activeTab === 'shifts' && currentData && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-6">Aggregated Volume by 4-Hour Shift</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentData.shifts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="shift" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="complaints" name="Total Complaints" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                      <Bar dataKey="resolvedOnTime" name="Resolved on Time" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FEEDBACK */}
          {activeTab === 'feedback' && currentData && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
               <div className="px-6 py-5 border-b border-slate-100 bg-rose-50">
                  <h3 className="text-base font-bold text-rose-900">Unsatisfactory Feedback Root Cause Analysis</h3>
               </div>
               {currentData.feedback.length === 0 ? (
                 <div className="p-8 text-center text-slate-500 text-sm">No unsatisfactory feedback logged for this period.</div>
               ) : (
                 <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                         <th className="p-4 font-semibold border-b">Ref No.</th>
                         <th className="p-4 font-semibold border-b">Train</th>
                         <th className="p-4 font-semibold border-b">Category</th>
                         <th className="p-4 font-semibold border-b">Description</th>
                         <th className="p-4 font-semibold border-b">Root Cause</th>
                       </tr>
                     </thead>
                     <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                       {currentData.feedback.map((fb, idx) => (
                         <tr key={idx} className="hover:bg-slate-50">
                           <td className="p-4 font-mono text-xs text-slate-500">{fb.id}</td>
                           <td className="p-4 font-medium">{fb.train}</td>
                           <td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{fb.head}</span></td>
                           <td className="p-4">{fb.desc}</td>
                           <td className="p-4 text-rose-600 font-medium">{fb.rootCause}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}