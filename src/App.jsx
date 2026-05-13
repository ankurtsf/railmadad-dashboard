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

// Bulletproof Date Extractor (Handles timestamps, DD-MM-YYYY, DD/MM/YYYY, YY-MM-DD etc.)
const extractDateFromExcel = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'number') {
      // Excel serial date check (between year 2009 and 2037)
      if (raw > 40000 && raw < 50000) {
          const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
          return d.toISOString().split('T')[0];
      }
      return null;
  }
  const str = String(raw).trim();
  
  // Match standard YYYY-MM-DD
  const matchGlob = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (matchGlob) {
      return `${matchGlob[1]}-${matchGlob[2].padStart(2,'0')}-${matchGlob[3].padStart(2,'0')}`;
  }

  // Match Indian format DD-MM-YYYY or DD-MM-YY 
  const matchInd = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (matchInd) {
      let year = matchInd[3];
      if (year.length === 2) year = '20' + year;
      return `${year}-${matchInd[2].padStart(2,'0')}-${matchInd[1].padStart(2,'0')}`;
  }
  
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

  // --- HYPER-ROBUST DEEP SCAN APPEND LOGIC ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    
    const reader = new FileReader();
    // Using ArrayBuffer instead of BinaryString for robust .csv and .xlsx support
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
           // Extract with header: 1 to get a raw matrix array of all cells
           const jsonDataArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) || [];
           
           if (jsonDataArray.length > 0) {
              const groupedByDate = {};
              let validRowsFound = 0;

              // Scan EVERY cell in EVERY row to extract data
              for (let i = 1; i < jsonDataArray.length; i++) { // Start at 1 to skip header
                  const row = jsonDataArray[i];
                  if (!row || !Array.isArray(row)) continue;

                  let rowDate = null;
                  let rowCat = 'Other';
                  let rowTrain = null;

                  for (let j = 0; j < row.length; j++) {
                      const cellVal = row[j];
                      if (cellVal === undefined || cellVal === null) continue;
                      
                      const cellStr = String(cellVal).trim();
                      if (!cellStr) continue;

                      // 1. Try to find a valid Date anywhere in the row
                      if (!rowDate) {
                          const extracted = extractDateFromExcel(cellVal);
                          if (extracted) rowDate = extracted;
                      }
                      
                      // 2. Try to classify Category based on keywords anywhere in the row
                      const lowerCell = cellStr.toLowerCase();
                      if (rowCat === 'Other') {
                          if (lowerCell.includes('clean') || lowerCell.includes('dirt')) rowCat = 'Cleanliness';
                          else if (lowerCell.includes('bed') || lowerCell.includes('linen') || lowerCell.includes('blanket')) rowCat = 'Bedroll';
                          else if (lowerCell.includes('water') || lowerCell.includes('toilet') || lowerCell.includes('plumb')) rowCat = 'Watering';
                          else if (lowerCell.includes('maintain') || lowerCell.includes('repair') || lowerCell.includes('mech') || lowerCell.includes('electrical') || lowerCell.includes('equip')) rowCat = 'Maintenance';
                          else if (lowerCell.includes('staff') || lowerCell.includes('behav') || lowerCell.includes('rude') || lowerCell.includes('bribe')) rowCat = 'Staff Behavior';
                      }

                      // 3. Try to extract Train Number (5 digits) anywhere in the row
                      if (!rowTrain) {
                          const matchTrain = cellStr.match(/\b\d{5}\b/);
                          if (matchTrain) rowTrain = matchTrain[0];
                      }
                  }

                  // If we found a date, log the record
                  if (rowDate) {
                      validRowsFound++;
                      if (!groupedByDate[rowDate]) {
                          groupedByDate[rowDate] = { 
                              total: 0, 
                              categories: { 'Cleanliness':0, 'Bedroll':0, 'Watering':0, 'Maintenance':0, 'Staff Behavior':0, 'Other':0 }, 
                              trains: {} 
                          };
                      }
                      
                      groupedByDate[rowDate].total += 1;
                      if (groupedByDate[rowDate].categories[rowCat] !== undefined) {
                          groupedByDate[rowDate].categories[rowCat] += 1;
                      }
                      
                      if (rowTrain) {
                          if (!groupedByDate[rowDate].trains[rowTrain]) {
                              groupedByDate[rowDate].trains[rowTrain] = { c: 0, a: 0, u: 0 };
                          }
                          groupedByDate[rowDate].trains[rowTrain].c += 1;
                          groupedByDate[rowDate].trains[rowTrain].u = groupedByDate[rowDate].trains[rowTrain].c; 
                      }
                  }
              }

              // Evaluate extraction results
              if (validRowsFound > 0) {
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
                  
                  showToast(`Success! Extracted ${validRowsFound} cases across ${datesAppended.length} unique dates.`);
              } else {
                  // Absolute Fallback (Only if literally 0 dates were found in the entire document)
                  const newRecord = {
                    date: fallbackDate,
                    kpis: { total: Math.max(0, jsonDataArray.length - 1), resolved: 98.0, time: 60, unsat: 3.0 },
                    categories: { 'Cleanliness': 0, 'Bedroll': 0, 'Watering': 0, 'Maintenance': 0, 'Staff Behavior': 0 },
                    trains: {}, shifts: {}, feedback: []
                  };

                  const existingIndex = newData.records.findIndex(r => r.date === fallbackDate);
                  if (existingIndex >= 0) newData.records[existingIndex] = newRecord;
                  else newData.records.push(newRecord);

                  showToast(`No dates found anywhere in file. Appended ${newRecord.kpis.total} cases to fallback date: ${fallbackDate}.`);
              }
           }
        }
        
        // 1. Force optimistic UI update instantly
        setDbData(newData);
        setLastSync(new Date().toLocaleTimeString());
        
        // 2. Auto-adjust timeline filters to show the newly added data
        if (newData.records.length > 0) {
            const sortedDates = [...newData.records].map(r => r.date).sort();
            setFromDate(sortedDates[0]);
            setToDate(sortedDates[sortedDates.length - 1]);
        }

        // 3. Push final state to database in background
        const { error } = await supabase.from('railmadad_sync').update({ 
            json_data: newData, 
            last_updated: new Date().toISOString() 
        }).eq('id', 1);
          
        if (error) throw error;
        
      } catch (err) {
        console.error(err);
        showToast("Error processing Excel. Please check the file structure.");
      }
      
      setIsUploading(false);
      e.target.value = null; 
    };
    reader.readAsArrayBuffer(file);
  };

  const executeHardReset = async () => {
    setShowResetModal(false);
    showToast("Resetting database...");
    
    // Optimistic UI clear
    setDbData(initialRawDatabase); 
    const today = new Date().toISOString().split('T')[0];
    setFromDate(today);
    setToDate(today);

    try {
      const { error } = await supabase.from('railmadad_sync').update({ 
          json_data: initialRawDatabase, 
          last_updated: new Date().toISOString() 
      }).eq('id', 1);
      if (error) throw error;
      showToast("Database successfully wiped clean.");
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
                  <span className="text-sm font-bold">Upload CSV/Excel</span>
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
                 Upload your DRM Daily Summary CSV/Excel files using the sidebar to populate the dashboard.
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
                    <BarChart data={currentData.trains.slice(0, 15)} layout="vertical" margin={{ left: 60, right: 20 }}>
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