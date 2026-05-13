import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  LayoutDashboard, TrainFront, Clock, MessageSquareWarning, 
  Sparkles, Menu, X, AlertTriangle, CheckCircle, Upload, 
  Calendar, Trash2, Cpu, FileSpreadsheet, Bug, Users
} from 'lucide-react';

// --- REAL PRODUCTION IMPORTS ---
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// --- SUPABASE CONFIG ---
const supabaseUrl = 'https://npfuxifktdmxmzprfcxm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZnV4aWZrdGRteG16cHJmY3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MjMwMDMsImV4cCI6MjA5NDE5OTAwM30.cCheIUxTAQWyoVyIwOLRd5usiyFI-q2GIn3A9NPFL78';
const supabase = createClient(supabaseUrl, supabaseKey);

const COLORS = ['#3b82f6', '#8b5cf6', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#f43f5e'];

const initialRawDatabase = { records: [], staff_records: [] };

// --- HELPER FUNCTIONS ---
const parseDateTime = (raw) => {
    if (!raw) return null;
    let str = String(raw).trim();
    if (/^\d+\.\d+$/.test(str)) return null; // Ignore reference numbers like 2.2829
    
    if (!isNaN(raw) && typeof raw === 'number' && raw > 40000 && raw < 50000) {
        const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
        str = d.toISOString().replace('T', ' ').substring(0, 16);
    }

    const dateMatch = str.match(/(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/);
    const timeMatch = str.match(/(\d{1,2}):(\d{2})/);

    if (!dateMatch) return null;

    let part1 = dateMatch[1], part2 = dateMatch[2], part3 = dateMatch[3];
    let year, month, day;

    if (part1.length === 4) { year = part1; month = part2; day = part3; }
    else if (part3.length === 4) { year = part3; month = part2; day = part1; }
    else { year = '20' + part3; month = part2; day = part1; }

    month = month.padStart(2, '0');
    day = day.padStart(2, '0');

    const dateStr = `${year}-${month}-${day}`;
    const monthStr = `${year}-${month}`;

    let hour = 12;
    if (timeMatch) hour = parseInt(timeMatch[1], 10);

    // Standard 8-Hour Shifts
    let shift = '00:00 - 08:00';
    if (hour >= 8 && hour < 16) shift = '08:00 - 16:00';
    else if (hour >= 16 && hour < 24) shift = '16:00 - 24:00';

    return { date: dateStr, month: monthStr, shift };
};

const mapCategory = (rawCat, rawSub) => {
    const combined = (String(rawCat || '') + " " + String(rawSub || '')).toLowerCase();
    if (combined.includes('pest') || combined.includes('rodent') || combined.includes('cockroach') || combined.includes('rat')) return 'Pest Control';
    if (combined.includes('clean') || combined.includes('dirt') || combined.includes('garbage')) return 'Cleanliness';
    if (combined.includes('bed') || combined.includes('linen') || combined.includes('blanket')) return 'Bedroll';
    if (combined.includes('water') || combined.includes('toilet') || combined.includes('plumb') || combined.includes('washbasin')) return 'Watering';
    if (combined.includes('maintain') || combined.includes('repair') || combined.includes('mech') || combined.includes('electrical') || combined.includes('equip')) return 'Maintenance';
    if (combined.includes('staff') || combined.includes('behav') || combined.includes('rude') || combined.includes('bribe')) return 'Staff Behavior';
    if (combined.includes('security') || combined.includes('theft') || combined.includes('crowd')) return 'Security';
    return 'Other';
};

const navItems = [
  { id: 'overview', label: 'Overview & MoM', icon: LayoutDashboard },
  { id: 'category', label: 'Categories & Matrices', icon: Sparkles },
  { id: 'trains', label: 'Train Analysis', icon: TrainFront },
  { id: 'operations', label: 'Shifts & Staff', icon: Users },
  { id: 'feedback', label: 'Feedback Analytics', icon: MessageSquareWarning },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastSync, setLastSync] = useState('Checking...');
  const [dbData, setDbData] = useState(initialRawDatabase);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const lastWeekStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const [fromDate, setFromDate] = useState(lastWeekStr);
  const [toDate, setToDate] = useState(todayStr);
  
  const [toastMessage, setToastMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 5000);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data } = await supabase.from('railmadad_sync').select('*').eq('id', 1).single();
        if (data && data.json_data && data.json_data.records) {
          setDbData(data.json_data);
          setLastSync(new Date(data.last_updated).toLocaleTimeString());
          if (data.json_data.records.length > 0) {
            const sortedDates = [...data.json_data.records].map(r => r.date).sort();
            setFromDate(sortedDates[0]);
            setToDate(sortedDates[sortedDates.length - 1]);
          }
        }
      } catch (err) { console.error("Fetch Error:", err); }
    };
    fetchInitialData();

    const channel = supabase.channel('schema-db-changes').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'railmadad_sync' }, (payload) => {
        if (payload.new.json_data && payload.new.json_data.records) {
            setDbData(payload.new.json_data);
            setLastSync(new Date(payload.new.last_updated).toLocaleTimeString());
        }
    }).subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // --- CORE AGGREGATION ENGINE ---
  const { kpis, momData, catMomData, monthsSorted, trainData, uniqueCats, feedbackData, unsatTable, pestTable, shiftData, staffTableData } = useMemo(() => {
    const validRecords = (dbData.records || []).filter(r => r.date >= fromDate && r.date <= toDate);
    const validStaff = (dbData.staff_records || []).filter(r => r.date >= fromDate && r.date <= toDate);
    
    // 1. KPIs
    let unsatCount = 0;
    validRecords.forEach(r => { if ((r.rating||'').toLowerCase().includes('unsatisfactory')) unsatCount++; });
    
    const kpis = {
       total: validRecords.length,
       unsat: validRecords.length > 0 ? ((unsatCount / validRecords.length) * 100).toFixed(1) : 0,
    };

    // 2. MoM Data (Bar Chart)
    const momMap = {};
    validRecords.forEach(r => { momMap[r.month] = (momMap[r.month] || 0) + 1; });
    const momData = Object.entries(momMap).map(([month, count]) => ({ month, count })).sort((a,b) => a.month.localeCompare(b.month));

    // 3. Category Wise MoM Table
    const catMomMap = {};
    const mSet = new Set();
    validRecords.forEach(r => {
        mSet.add(r.month);
        if (!catMomMap[r.category]) catMomMap[r.category] = { Total: 0 };
        catMomMap[r.category][r.month] = (catMomMap[r.category][r.month] || 0) + 1;
        catMomMap[r.category].Total += 1;
    });
    const monthsSorted = Array.from(mSet).sort();
    const catMomData = Object.entries(catMomMap).map(([category, counts]) => ({ category, ...counts })).sort((a,b) => b.Total - a.Total);

    // 4. Train Analysis Matrix
    const trainMap = {};
    const catSet = new Set();
    validRecords.forEach(r => {
        catSet.add(r.category);
        if (!trainMap[r.train]) trainMap[r.train] = { train: r.train, Total: 0 };
        trainMap[r.train].Total += 1;
        trainMap[r.train][r.category] = (trainMap[r.train][r.category] || 0) + 1;
    });
    const trainData = Object.values(trainMap).sort((a,b) => b.Total - a.Total);
    const uniqueCats = Array.from(catSet).sort();

    // 5. Feedback Type Categorization
    const feedbackMap = {};
    validRecords.forEach(r => {
        let rate = r.rating || 'Not Rated';
        if(rate === '') rate = 'Not Rated';
        feedbackMap[rate] = (feedbackMap[rate] || 0) + 1;
    });
    const feedbackData = Object.entries(feedbackMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

    // 6. Unsatisfactory Feedback Table
    const unsatTable = validRecords.filter(r => (r.rating||'').toLowerCase().includes('unsatisfactory') || (r.desc||'').toLowerCase().includes('bad'));

    // 7. Pest Control Source
    const pestTable = validRecords.filter(r => r.category === 'Pest Control');

    // 8. Shift wise Data
    const shiftMap = { '00:00 - 08:00': 0, '08:00 - 16:00': 0, '16:00 - 24:00': 0 };
    validRecords.forEach(r => { if(shiftMap[r.shift] !== undefined) shiftMap[r.shift] += 1; });
    const shiftData = Object.entries(shiftMap).map(([shift, complaints]) => ({ shift, complaints }));

    // 9. Staff Person Wise Data
    const staffAggMap = {};
    validStaff.forEach(s => {
        if (!staffAggMap[s.staff]) staffAggMap[s.staff] = { staff: s.staff, train: new Set(), count: 0 };
        staffAggMap[s.staff].count += s.count;
        if(s.train && s.train !== 'Unknown') staffAggMap[s.staff].train.add(s.train);
    });
    const staffTableData = Object.values(staffAggMap).map(s => ({
        staff: s.staff,
        trains: Array.from(s.train).join(', ') || 'N/A',
        count: s.count
    })).sort((a,b) => b.count - a.count);

    return { kpis, momData, catMomData, monthsSorted, trainData, uniqueCats, feedbackData, unsatTable, pestTable, shiftData, staffTableData };
  }, [dbData, fromDate, toDate]);

  // --- DUPLICATE-SAFE PARSER ENGINE ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        
        const existingMap = new Map();
        (dbData.records || []).forEach(r => existingMap.set(r.id, r));
        
        const existingStaffMap = new Map();
        (dbData.staff_records || []).forEach(r => existingStaffMap.set(r.id, r));

        let newRecordsAdded = 0;
        let duplicatesSkipped = 0;
        let staffFound = 0;

        // Iterate over ALL sheets in the uploaded workbook
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonObjects = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            
            if (jsonObjects.length === 0) return;
            const keys = Object.keys(jsonObjects[0]);
            
            // Core Complaint Extraction
            const refCol = keys.find(k => k.toLowerCase().includes('refno') || k.toLowerCase().includes('ref no') || k.toLowerCase().includes('complaintref'));
            const dateCol = keys.find(k => k.toLowerCase() === 'createdon' || k.toLowerCase().includes('date') || k.toLowerCase().includes('time'));
            const catCol = keys.find(k => k.toLowerCase() === 'comptypename' || k.toLowerCase().includes('category') || k.toLowerCase().includes('head'));
            const subCatCol = keys.find(k => k.toLowerCase() === 'subtypename' || k.toLowerCase().includes('sub'));
            const trainCol = keys.find(k => k.toLowerCase() === 'trainstation' || k.toLowerCase() === 'trainnameforreport' || k.toLowerCase().includes('train'));
            const rateCol = keys.find(k => k.toLowerCase() === 'rating' || k.toLowerCase() === 'feedback');
            const descCol = keys.find(k => k.toLowerCase() === 'complaintdesc' || k.toLowerCase().includes('desc') || k.toLowerCase().includes('remark'));

            jsonObjects.forEach((row) => {
                // Find Valid Date
                let parsedObj = null;
                if (dateCol && row[dateCol]) parsedObj = parseDateTime(row[dateCol]);
                if (!parsedObj) {
                    for (let val of Object.values(row)) {
                        parsedObj = parseDateTime(val);
                        if (parsedObj) break;
                    }
                }

                // Append Complaint Record
                if (refCol && row[refCol] && parsedObj) {
                    const recordId = String(row[refCol]).trim();
                    if (!existingMap.has(recordId)) {
                        const mappedCat = mapCategory(catCol ? row[catCol] : "", subCatCol ? row[subCatCol] : "");
                        const rawTrain = (trainCol ? row[trainCol] : "") + " " + (row['trainNameForReport'] || "");
                        const matchTrain = String(rawTrain).match(/\b\d{4,5}\b/);
                        const trainNo = matchTrain ? matchTrain[0] : 'Unknown';

                        existingMap.set(recordId, {
                            id: recordId,
                            date: parsedObj.date,
                            month: parsedObj.month,
                            shift: parsedObj.shift,
                            category: mappedCat,
                            train: trainNo,
                            rating: String(rateCol ? row[rateCol] : 'Not Rated').trim(),
                            desc: String(descCol ? row[descCol] : '').substring(0, 150),
                        });
                        newRecordsAdded++;
                    } else {
                        duplicatesSkipped++;
                    }
                }

                // Extract Staff/Culprit Data from any matching columns in any sheet
                ['obhs\'s name', "acca's name", 'nominateted hk', 'ehk name', 'supervisor name'].forEach(keyToFind => {
                    const staffCol = keys.find(k => k.toLowerCase().includes(keyToFind));
                    if (staffCol && row[staffCol]) {
                        const name = String(row[staffCol]).trim().replace(/[\r\n]+/g, ' '); 
                        if (name && name.toLowerCase() !== 'nil' && name !== '-') {
                            const staffDate = parsedDate ? parsedDate.date : new Date().toISOString().split('T')[0];
                            const matchT = trainCol && row[trainCol] ? String(row[trainCol]).match(/\b\d{4,5}\b/) : null;
                            const tNo = matchT ? matchT[0] : 'Unknown';

                            const staffId = `${name}_${staffDate}_${tNo}`;
                            if (!existingStaffMap.has(staffId)) {
                                existingStaffMap.set(staffId, { id: staffId, staff: name, date: staffDate, train: tNo, count: 1 });
                            } else {
                                existingStaffMap.get(staffId).count += 1;
                            }
                            staffFound++;
                        }
                    }
                });
            });
        });

        if (newRecordsAdded > 0 || staffFound > 0) {
            const newData = { 
                records: Array.from(existingMap.values()),
                staff_records: Array.from(existingStaffMap.values())
            };

            setDbData(newData);
            setLastSync(new Date().toLocaleTimeString());
            
            if (newData.records.length > 0) {
                const sortedDates = [...newData.records].map(r => r.date).sort();
                setFromDate(sortedDates[0]);
                setToDate(sortedDates[sortedDates.length - 1]);
            }

            showToast(`Success! Added ${newRecordsAdded} new complaints & logged staff details. Skipped ${duplicatesSkipped} duplicates.`);

            await supabase.from('railmadad_sync').update({ 
                json_data: newData, 
                last_updated: new Date().toISOString() 
            }).eq('id', 1);

        } else if (duplicatesSkipped > 0) {
            showToast(`No new records added. Skipped ${duplicatesSkipped} exact duplicates.`);
        } else {
            showToast("Warning: No valid complaint dates found in uploaded file.");
        }
        
      } catch (err) {
        console.error(err);
        showToast("Error processing file. Please ensure it's a valid CSV/Excel file.");
      }
      setIsUploading(false);
      e.target.value = null; 
    };
    reader.readAsArrayBuffer(file);
  };

  const executeHardReset = async () => {
    setShowResetModal(false);
    showToast("Resetting database...");
    setDbData(initialRawDatabase); 
    const today = new Date().toISOString().split('T')[0];
    setFromDate(today); setToDate(today);

    try {
      await supabase.from('railmadad_sync').update({ json_data: initialRawDatabase, last_updated: new Date().toISOString() }).eq('id', 1);
      showToast("Database successfully wiped clean.");
    } catch (err) {
      showToast("Error resetting database.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 relative">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center animate-bounce border border-slate-700">
          <Sparkles className="w-5 h-5 mr-3 text-indigo-400" />
          <span className="font-medium text-sm leading-snug">{toastMessage}</span>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full border border-slate-100 transform transition-all">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Wipe Database?</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              This will permanently delete all appended daily reports. The dashboard will return to a completely empty state.
            </p>
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
            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-1">SEE Division Control</p>
          </div>
          <button className="md:hidden text-white" onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
        </div>

        <div className="p-5 border-b border-slate-100 bg-slate-50">
           <label className="flex items-center justify-center w-full px-4 py-3 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 cursor-pointer transition-colors active:scale-95">
              {isUploading ? (
                <span className="animate-pulse flex items-center text-sm font-bold">Scanning Document...</span>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  <span className="text-sm font-bold">Append Raw CSV</span>
                  <input type="file" accept=".csv, .xlsx" className="hidden" onChange={handleFileUpload} disabled={isUploading}/>
                </>
              )}
           </label>
           <p className="text-[10px] text-slate-400 mt-3 text-center font-medium italic">Last Sync: {lastSync}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Modules</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-500 hover:bg-slate-50 border border-transparent'}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
           <button onClick={() => setShowResetModal(true)} className="flex items-center justify-center w-full py-2 text-[11px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors mb-4">
             <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Hard Reset Database
           </button>
           <div className="flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity">
             <Cpu className="w-4 h-4 text-indigo-600 mr-2" />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Powered by Neural Mesh</span>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col max-w-full overflow-hidden bg-slate-50">
        
        <header className="md:hidden bg-indigo-700 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
          <h1 className="text-lg font-bold flex items-center"><TrainFront className="w-5 h-5 mr-2"/> RailMadad</h1>
          <button onClick={() => setIsMobileMenuOpen(true)}><Menu className="w-6 h-6" /></button>
        </header>

        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0 z-20 sticky top-0 md:top-0 shadow-sm">
           <h2 className="text-xl font-black text-slate-800 tracking-tight">{navItems.find(i => i.id === activeTab)?.label}</h2>
           <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 bg-slate-50 border border-slate-200 p-2 rounded-xl">
              <div className="flex items-center text-sm">
                 <Calendar className="w-4 h-4 text-indigo-500 mr-2 shrink-0" />
                 <span className="font-bold text-slate-600 mr-2 text-xs uppercase tracking-wider">From</span>
                 <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium" />
              </div>
              <div className="flex items-center text-sm">
                 <span className="font-bold text-slate-600 mx-2 text-xs uppercase tracking-wider">To</span>
                 <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium" />
              </div>
           </div>
        </div>

        <div className="p-4 md:p-8 flex-1 overflow-y-auto space-y-8">

          {(dbData.records || []).length === 0 ? (
             <div className="bg-white p-16 mt-10 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center max-w-2xl mx-auto shadow-sm">
               <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6"><FileSpreadsheet className="w-12 h-12 text-indigo-400" /></div>
               <h3 className="text-3xl font-black text-slate-800 tracking-tight">Database is Empty</h3>
               <p className="text-slate-500 mt-4 max-w-md leading-relaxed font-medium">
                 Click the <b>"Append Raw CSV"</b> button in the sidebar to securely upload your DRM Daily Summary reports. Exact duplicates will be skipped automatically.
               </p>
             </div>
          ) : !kpis || kpis.total === 0 ? (
             <div className="bg-white p-12 mt-10 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center max-w-2xl mx-auto shadow-sm">
               <Calendar className="w-12 h-12 text-slate-300 mb-4" />
               <h3 className="text-xl font-bold text-slate-800">No Data in Selected Timeline</h3>
               <p className="text-slate-500 mt-2 max-w-sm">No complaints found between {fromDate} and {toDate}. Please expand your timeline filters.</p>
             </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & MoM */}
              {activeTab === 'overview' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricCard title="Total Complaints" value={kpis.total} icon={LayoutDashboard} colorClass="bg-blue-600 text-white" />
                    <MetricCard title="Unsatisfactory Rating" value={`${kpis.unsat}%`} icon={AlertTriangle} colorClass="bg-rose-600 text-white" />
                    <MetricCard title="Avg Resolution Time" value={kpis.time} icon={Clock} colorClass="bg-purple-600 text-white" />
                    <MetricCard title="Database Size" value={(dbData.records||[]).length} icon={Cpu} colorClass="bg-indigo-600 text-white" />
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Month-over-Month (MoM) Trend</h3>
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
                </div>
              )}

              {/* TAB 2: CATEGORY & MATRICES */}
              {activeTab === 'category' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50"><h3 className="text-base font-bold text-slate-800">Category Wise MoM Table</h3></div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-500 text-[10px] uppercase tracking-widest">
                            <th className="p-4 font-bold border-b border-slate-200">Category</th>
                            {monthsSorted.map(m => <th key={m} className="p-4 font-bold border-b border-slate-200">{m}</th>)}
                            <th className="p-4 font-black border-b border-slate-200 text-slate-800">Total</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                          {catMomData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 font-bold text-slate-900 flex items-center"><Sparkles className="w-4 h-4 mr-2 text-indigo-400" />{row.category}</td>
                              {monthsSorted.map(m => <td key={m} className="p-4 font-medium">{row[m] || '-'}</td>)}
                              <td className="p-4 font-black text-indigo-600">{row.Total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-rose-100 bg-rose-50 flex items-center">
                       <Bug className="w-5 h-5 text-rose-600 mr-2" />
                       <h3 className="text-base font-bold text-rose-900">Pest Control & Rodent Extractions</h3>
                    </div>
                    {pestTable.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 font-medium">No Pest Control/Rodent complaints identified in this period.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100">
                              <th className="p-4 font-bold">Date</th>
                              <th className="p-4 font-bold">Train</th>
                              <th className="p-4 font-bold">Description</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                            {pestTable.map((row, idx) => (
                              <tr key={idx} className="hover:bg-rose-50/50">
                                <td className="p-4 font-medium whitespace-nowrap">{row.date}</td>
                                <td className="p-4 font-bold text-rose-700">{row.train}</td>
                                <td className="p-4 text-slate-600">{row.desc}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: TRAIN ANALYSIS */}
              {activeTab === 'trains' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Top 15 Trains by Total Complaints</h3>
                    <div className="h-80">
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

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50"><h3 className="text-base font-bold text-slate-800">Train Number vs. Category Matrix</h3></div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-500 text-[10px] uppercase tracking-widest">
                            <th className="p-4 font-bold border-b border-slate-200">Train Number</th>
                            {uniqueCats.map(c => <th key={c} className="p-4 font-bold border-b border-slate-200">{c}</th>)}
                            <th className="p-4 font-black border-b border-slate-200 text-slate-800">Total</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                          {trainData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 font-bold flex items-center text-slate-900"><TrainFront className="w-4 h-4 mr-2 text-indigo-400" />{row.train}</td>
                              {uniqueCats.map(c => <td key={c} className="p-4 font-medium text-slate-500">{row[c] || '-'}</td>)}
                              <td className="p-4 font-black text-indigo-600">{row.Total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SHIFTS & STAFF */}
              {activeTab === 'operations' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50"><h3 className="text-base font-bold text-slate-800">Shift Wise Complaints</h3></div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100">
                            <th className="p-4 font-bold">8-Hour Shift Timeline</th>
                            <th className="p-4 font-bold">Complaint Volume</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                          {shiftData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-4 font-bold text-slate-800 flex items-center"><Clock className="w-4 h-4 mr-2 text-slate-400"/>{row.shift}</td>
                              <td className="p-4 font-black text-indigo-600">{row.complaints}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50"><h3 className="text-base font-bold text-slate-800">Culprit Staff Mentions</h3></div>
                    {staffTableData.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 font-medium">No explicit Staff names found in uploaded data sheets.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100">
                              <th className="p-4 font-bold">Staff Name / ID</th>
                              <th className="p-4 font-bold">Associated Trains</th>
                              <th className="p-4 font-bold">Mentions</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                            {staffTableData.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-4 font-bold text-slate-800">{row.staff}</td>
                                <td className="p-4 text-xs font-mono text-slate-500">{row.trains}</td>
                                <td className="p-4 font-black text-rose-500">{row.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: FEEDBACK */}
              {activeTab === 'feedback' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Feedback Type Categorization</h3>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={feedbackData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={4} dataKey="value">
                              {feedbackData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                     <div className="px-6 py-5 border-b border-slate-100 bg-rose-50 flex items-center">
                         <MessageSquareWarning className="w-5 h-5 text-rose-600 mr-2" />
                         <h3 className="text-base font-bold text-rose-900">Highest Feedback: Unsatisfactory Cases</h3>
                     </div>
                     {unsatTable.length === 0 ? (
                       <div className="p-8 text-center text-slate-500 font-medium">No unsatisfactory feedback logged in this period.</div>
                     ) : (
                       <div className="overflow-x-auto">
                         <table className="min-w-full text-left border-collapse">
                           <thead>
                             <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100">
                               <th className="p-4 font-bold">Ref No.</th>
                               <th className="p-4 font-bold">Train</th>
                               <th className="p-4 font-bold">Category</th>
                               <th className="p-4 font-bold">Description</th>
                             </tr>
                           </thead>
                           <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                             {unsatTable.map((row, idx) => (
                               <tr key={idx} className="hover:bg-slate-50">
                                 <td className="p-4 font-mono text-[10px] text-slate-400 whitespace-nowrap">{row.id}</td>
                                 <td className="p-4 font-bold text-slate-800">{row.train}</td>
                                 <td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">{row.category}</span></td>
                                 <td className="p-4 text-xs text-slate-600 max-w-md">{row.desc}</td>
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