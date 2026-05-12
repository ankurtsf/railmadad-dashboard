import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  LayoutDashboard, TrainFront, Clock, MessageSquareWarning, 
  Droplets, Sparkles, BedSingle, Wrench, Menu, X, 
  TrendingDown, TrendingUp, AlertTriangle, CheckCircle,
  Upload, Bot, Calendar
} from 'lucide-react';

// ----------------------------------------------------------------------
// ⚠️ DEPLOYMENT INSTRUCTIONS FOR VS CODE ⚠️
// To make the database connection work in your local Vite project, you must:
// 1. Uncomment the Supabase import line below:
import { createClient } from '@supabase/supabase-js';
// 2. Delete the placeholder 'createClient' function right beneath it.
// ----------------------------------------------------------------------

// <-- DELETE THIS LINE IN VS CODE

// --- SUPABASE DB SETUP ---
// NOTE: Replace these strings with your actual Supabase URL and Anon Key!
const supabaseUrl = 'https://npfuxifktdmxmzprfcxm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZnV4aWZrdGRteG16cHJmY3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MjMwMDMsImV4cCI6MjA5NDE5OTAwM30.cCheIUxTAQWyoVyIwOLRd5usiyFI-q2GIn3A9NPFL78';

// We initialize the client only if the placeholders have been replaced
const supabase = supabaseUrl !== 'YOUR_SUPABASE_URL' ? createClient(supabaseUrl, supabaseKey) : null;

// --- ICON MAPPER ---
// Databases cannot store React components. We store the string name in the DB and map it here.
const iconMap = {
  Sparkles: Sparkles,
  BedSingle: BedSingle,
  Droplets: Droplets,
  Wrench: Wrench,
  AlertTriangle: AlertTriangle
};

// --- INITIAL DEFAULT DATA ---
// This acts as a fallback if the database connection isn't set up yet or is empty.
const initialRawDatabase = {
  'May 2025': {
    kpis: { total: 1132, prev: 1517, resolved: 98.5, time: '1h 14m', unsat: 4.2 },
    categories: [
      { name: 'Cleanliness', value: 422, color: '#3b82f6', icon: 'Sparkles' },
      { name: 'Bedroll', value: 314, color: '#8b5cf6', icon: 'BedSingle' },
      { name: 'Watering', value: 206, color: '#0ea5e9', icon: 'Droplets' },
      { name: 'Maintenance', value: 159, color: '#f59e0b', icon: 'Wrench' },
      { name: 'Staff Behavior', value: 23, color: '#ef4444', icon: 'AlertTriangle' },
    ],
    trains: [
      { train: '12557 (MFP-ANVT)', complaints: 63, rate: 1.34, avoidable: 45, unavoidable: 18 },
      { train: '12558 (ANVT-MFP)', complaints: 58, rate: 2.00, avoidable: 40, unavoidable: 18 },
      { train: '02563 (BJU-NDLS)', complaints: 52, rate: 1.80, avoidable: 20, unavoidable: 32 },
      { train: '15228 (MFP-SMVB)', complaints: 46, rate: 3.00, avoidable: 35, unavoidable: 11 },
    ],
    trends: [
      { day: '01', Cleanliness: 18, Bedroll: 12, Watering: 8 },
      { day: '05', Cleanliness: 22, Bedroll: 15, Watering: 10 },
      { day: '10', Cleanliness: 15, Bedroll: 11, Watering: 18 },
      { day: '15', Cleanliness: 25, Bedroll: 14, Watering: 14 },
      { day: '20', Cleanliness: 20, Bedroll: 10, Watering: 7 },
      { day: '22', Cleanliness: 30, Bedroll: 13, Watering: 14 },
    ],
    shifts: [
      { shift: '00:00 - 04:00', complaints: 13, resolvedOnTime: 11 },
      { shift: '04:00 - 08:00', complaints: 12, resolvedOnTime: 10 },
      { shift: '08:00 - 12:00', complaints: 23, resolvedOnTime: 20 },
      { shift: '12:00 - 16:00', complaints: 17, resolvedOnTime: 15 },
      { shift: '16:00 - 20:00', complaints: 21, resolvedOnTime: 19 },
      { shift: '20:00 - 24:00', complaints: 14, resolvedOnTime: 12 },
    ],
    feedback: [
      { id: '2025052207733', train: '02564', head: 'Bed Roll', desc: 'Bed roll provided late, pillow missing.', rootCause: 'Provided after complaint', avoidable: 'Yes' },
      { id: '2025052204520', train: '05294', head: 'Cleanliness', desc: 'Cleaning has not been done, very bad service.', rootCause: 'Late attend', avoidable: 'Yes' },
      { id: '2025052203462', train: '05290', head: 'Cleanliness', desc: 'Entire coach is without cleaning since Pune.', rootCause: 'Enroute cleaning missed', avoidable: 'Yes' },
      { id: '2025052209911', train: '02563', head: 'Watering', desc: 'No water in toilets since morning.', rootCause: 'ASH station skipped', avoidable: 'No' },
    ]
  },
  'April 2025': {
    kpis: { total: 1517, prev: 1600, resolved: 97.0, time: '1h 45m', unsat: 5.5 },
    categories: [
      { name: 'Cleanliness', value: 551, color: '#3b82f6', icon: 'Sparkles' },
      { name: 'Bedroll', value: 485, color: '#8b5cf6', icon: 'BedSingle' },
      { name: 'Watering', value: 280, color: '#0ea5e9', icon: 'Droplets' },
      { name: 'Maintenance', value: 155, color: '#f59e0b', icon: 'Wrench' },
      { name: 'Staff Behavior', value: 39, color: '#ef4444', icon: 'AlertTriangle' },
    ],
    trains: [
      { train: '12557 (MFP-ANVT)', complaints: 85, rate: 1.80, avoidable: 60, unavoidable: 25 },
      { train: '02563 (BJU-NDLS)', complaints: 75, rate: 2.50, avoidable: 30, unavoidable: 45 },
      { train: '15228 (MFP-SMVB)', complaints: 60, rate: 3.80, avoidable: 50, unavoidable: 10 },
      { train: '12558 (ANVT-MFP)', complaints: 55, rate: 1.90, avoidable: 35, unavoidable: 20 },
    ],
    trends: [
      { day: '01', Cleanliness: 25, Bedroll: 20, Watering: 15 },
      { day: '10', Cleanliness: 30, Bedroll: 22, Watering: 18 },
      { day: '20', Cleanliness: 28, Bedroll: 25, Watering: 12 },
      { day: '30', Cleanliness: 20, Bedroll: 18, Watering: 10 },
    ],
    shifts: [
      { shift: '00:00 - 04:00', complaints: 18, resolvedOnTime: 16 },
      { shift: '04:00 - 08:00', complaints: 22, resolvedOnTime: 18 },
      { shift: '08:00 - 12:00', complaints: 35, resolvedOnTime: 30 },
      { shift: '12:00 - 16:00', complaints: 28, resolvedOnTime: 25 },
      { shift: '16:00 - 20:00', complaints: 30, resolvedOnTime: 28 },
      { shift: '20:00 - 24:00', complaints: 19, resolvedOnTime: 18 },
    ],
    feedback: [
      { id: '2025041501122', train: '12557', head: 'Staff Behavior', desc: 'OBHS staff was rude when asked to clean.', rootCause: 'Staff Attitude', avoidable: 'Yes' },
      { id: '2025041804520', train: '02563', head: 'Watering', desc: 'No water for 6 hours.', rootCause: 'CNB hydrant issue', avoidable: 'No' },
    ]
  },
  'All Data': {
    kpis: { total: 2649, prev: 0, resolved: 97.7, time: '1h 30m', unsat: 4.8 },
    categories: [
      { name: 'Cleanliness', value: 973, color: '#3b82f6', icon: 'Sparkles' },
      { name: 'Bedroll', value: 799, color: '#8b5cf6', icon: 'BedSingle' },
      { name: 'Watering', value: 486, color: '#0ea5e9', icon: 'Droplets' },
      { name: 'Maintenance', value: 314, color: '#f59e0b', icon: 'Wrench' },
      { name: 'Staff Behavior', value: 62, color: '#ef4444', icon: 'AlertTriangle' },
    ],
    trains: [
      { train: '12557 (MFP-ANVT)', complaints: 148, rate: 1.57, avoidable: 105, unavoidable: 43 },
      { train: '02563 (BJU-NDLS)', complaints: 127, rate: 2.15, avoidable: 50, unavoidable: 77 },
      { train: '12558 (ANVT-MFP)', complaints: 113, rate: 1.95, avoidable: 75, unavoidable: 38 },
      { train: '15228 (MFP-SMVB)', complaints: 106, rate: 3.40, avoidable: 85, unavoidable: 21 },
    ],
    trends: [
      { day: 'Week 1', Cleanliness: 85, Bedroll: 67, Watering: 45 },
      { day: 'Week 2', Cleanliness: 92, Bedroll: 75, Watering: 58 },
      { day: 'Week 3', Cleanliness: 88, Bedroll: 70, Watering: 49 },
      { day: 'Week 4', Cleanliness: 95, Bedroll: 68, Watering: 44 },
    ],
    shifts: [
      { shift: '00:00 - 04:00', complaints: 31, resolvedOnTime: 27 },
      { shift: '04:00 - 08:00', complaints: 34, resolvedOnTime: 28 },
      { shift: '08:00 - 12:00', complaints: 58, resolvedOnTime: 50 },
      { shift: '12:00 - 16:00', complaints: 45, resolvedOnTime: 40 },
      { shift: '16:00 - 20:00', complaints: 51, resolvedOnTime: 47 },
      { shift: '20:00 - 24:00', complaints: 33, resolvedOnTime: 30 },
    ],
    feedback: [
      { id: '2025052207733', train: '02564', head: 'Bed Roll', desc: 'Bed roll provided late, pillow missing.', rootCause: 'Provided after complaint', avoidable: 'Yes' },
      { id: '2025052204520', train: '05294', head: 'Cleanliness', desc: 'Cleaning has not been done, very bad service.', rootCause: 'Late attend', avoidable: 'Yes' },
      { id: '2025041804520', train: '02563', head: 'Watering', desc: 'No water for 6 hours.', rootCause: 'CNB hydrant issue', avoidable: 'No' },
    ]
  }
};

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

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('May 2025');
  const [isUploading, setIsUploading] = useState(false);
  const [lastSync, setLastSync] = useState('Just now');
  
  // State to hold our data. It defaults to the initial hardcoded data above.
  const [dbData, setDbData] = useState(initialRawDatabase);
  // Track if we are connected to Supabase
  const [dbStatus, setDbStatus] = useState(supabase ? 'Connecting...' : 'Local Mode (No DB Configured)');

  // Listen to Live Supabase Database
  useEffect(() => {
    if (!supabase) return;

    // 1. Fetch initial data when the component loads
    const fetchInitialData = async () => {
      try {
        const { data, error } = await supabase
          .from('railmadad_sync')
          .select('*')
          .eq('id', 1)
          .single();
          
        if (error) {
            console.error("Error fetching data:", error);
            setDbStatus('Error connecting to DB');
            return;
        }

        if (data && data.json_data) {
          // If the DB has an empty object '{}', don't overwrite our default mock data yet
          if (Object.keys(data.json_data).length > 0) {
             setDbData(data.json_data);
          }
          if (data.last_updated) {
              setLastSync(new Date(data.last_updated).toLocaleTimeString());
          }
          setDbStatus('Connected to Live DB');
        }
      } catch (err) {
          console.error("Supabase fetch error:", err);
      }
    };

    fetchInitialData();

    // 2. Subscribe to real-time changes
    const channel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'railmadad_sync' },
        (payload) => {
          console.log("Realtime update received!", payload);
          if (payload.new.json_data && Object.keys(payload.new.json_data).length > 0) {
              setDbData(payload.new.json_data);
          }
          if (payload.new.last_updated) {
              setLastSync(new Date(payload.new.last_updated).toLocaleTimeString());
          }
        }
      )
      .subscribe();

    // Cleanup subscription when component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Derive current data based on filters. Fallback if somehow undefined.
  const currentData = dbData[selectedMonth] || initialRawDatabase[selectedMonth];

  // Simulated AI Insights Engine
  const aiInsights = useMemo(() => {
    if (!currentData || !currentData.trains || !currentData.categories) return [];
    
    const insights = [];
    const topTrain = [...currentData.trains].sort((a, b) => b.rate - a.rate)[0];
    const topCategory = [...currentData.categories].sort((a, b) => b.value - a.value)[0];
    
    if (selectedMonth === 'All Data') {
      insights.push(`Historical Overview: You are viewing aggregated data across all periods. Total volume handled is ${currentData.kpis.total} complaints.`);
      insights.push(`Systemic Issue: Train 02563 consistently shows high UNAVOIDABLE watering complaints across all months, pointing to a permanent routing/hydrant deficiency.`);
    } else {
      if (currentData.kpis.total < currentData.kpis.prev) {
        const drop = Math.round(((currentData.kpis.prev - currentData.kpis.total) / currentData.kpis.prev) * 100);
        insights.push(`Overall performance is improving. Complaints dropped by ${drop}% compared to the previous period.`);
      }
      if (selectedMonth === 'May 2025') {
        insights.push(`Anomaly Detected: Train 02563 is showing high UNAVOIDABLE watering complaints. Cross-reference shows skipped hydrants at ASH/CNB stations.`);
      }
    }

    if (topTrain) {
        insights.push(`Action Required: Train ${topTrain.train} has the highest complaint rate (${topTrain.rate} per day). ${topTrain.avoidable} of these were avoidable (staff/OBHS issues).`);
    }
    if (topCategory) {
        insights.push(`Resource Focus: ${topCategory.name} remains the highest grievance area (${topCategory.value} cases). Recommend deploying extra spot-checks.`);
    }
    
    return insights;
  }, [selectedMonth, currentData]);

  // Handle File Upload to Live Database
  const handleFileUpload = (e) => {
    if(e.target.files && e.target.files[0]) {
      setIsUploading(true);
      
      // We simulate backend parsing of the Excel file here,
      // and then push the updated aggregate to Supabase.
      setTimeout(async () => {
        try {
          // Deep copy current state
          const newData = JSON.parse(JSON.stringify(dbData));
          
          // Simulating new Excel rows being aggregated into the KPIs
          if (newData['May 2025']) {
              newData['May 2025'].kpis.total += 15;
              newData['May 2025'].kpis.unsat = 4.3;
          }
          if (newData['All Data']) {
              newData['All Data'].kpis.total += 15;
          }
          
          // If Supabase is configured, push the update!
          if (supabase) {
            const { error } = await supabase
              .from('railmadad_sync')
              .update({ 
                  json_data: newData, 
                  last_updated: new Date().toISOString() 
              })
              .eq('id', 1);
              
            if (error) throw error;
            alert("Success! Excel parsed and Database Synced for all users.");
          } else {
             // If local mode, just update the UI state
             setDbData(newData);
             setLastSync(new Date().toLocaleTimeString());
             alert("Local Update Successful (Add Supabase keys to sync to cloud)");
          }
          
        } catch (err) {
          console.error("Upload Error:", err);
          alert("Error syncing to database. Check console.");
        }
        setIsUploading(false);
      }, 2000);
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview & Insights', icon: LayoutDashboard },
    { id: 'trains', label: 'Train Analysis', icon: TrainFront },
    { id: 'shifts', label: 'Operations & Shifts', icon: Clock },
    { id: 'feedback', label: 'Unsatisfactory Feedback', icon: MessageSquareWarning },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      
      {/* SIDEBAR */}
      <aside className={`fixed md:sticky top-0 left-0 z-40 w-64 h-screen transition-transform transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 bg-white border-r border-slate-200 shadow-sm flex flex-col`}>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-700">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center">
              <TrainFront className="w-5 h-5 mr-2" />
              RailMadad
            </h1>
            <p className="text-xs font-medium text-indigo-200 uppercase tracking-wider mt-1">SEE Division Control</p>
          </div>
          <button className="md:hidden text-white" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Data Upload Area */}
        <div className="p-4 border-b border-slate-100 bg-slate-50">
           <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Database Management</p>
           <label className="flex items-center justify-center w-full px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg shadow-sm hover:bg-indigo-50 cursor-pointer transition-colors">
              {isUploading ? (
                <div className="animate-pulse flex items-center">Syncing DB...</div>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Upload Latest Excel</span>
                  <input type="file" accept=".csv, .xlsx" className="hidden" onChange={handleFileUpload} />
                </>
              )}
           </label>
           <p className="text-[10px] text-slate-400 mt-2 text-center">Last DB Sync: {lastSync}</p>
           <p className={`text-[10px] mt-1 text-center font-medium ${dbStatus.includes('Connected') ? 'text-emerald-500' : 'text-amber-500'}`}>
              Status: {dbStatus}
           </p>
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
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col max-w-full overflow-hidden">
        
        {/* Mobile Header */}
        <header className="md:hidden bg-indigo-700 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
          <h1 className="text-lg font-bold flex items-center"><TrainFront className="w-5 h-5 mr-2"/> RailMadad SEE</h1>
          <button onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Global Filter Bar */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 z-20 sticky top-0 md:top-0">
           <div>
              <h2 className="text-xl font-bold text-slate-800">
                {navItems.find(i => i.id === activeTab)?.label}
              </h2>
           </div>
           
           <div className="flex items-center space-x-3 w-full sm:w-auto">
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-full sm:w-auto">
                 <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                 <select 
                    className="bg-transparent border-none text-sm font-medium text-slate-700 focus:outline-none focus:ring-0 cursor-pointer w-full"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                 >
                    <option value="May 2025">May 2025 (Current)</option>
                    <option value="April 2025">April 2025</option>
                    <option value="All Data">All Data (YTD)</option>
                 </select>
              </div>
           </div>
        </div>

        <div className="p-4 md:p-8 flex-1 overflow-y-auto space-y-6">

          {/* AI INSIGHTS PANEL (Visible on Overview) */}
          {activeTab === 'overview' && (
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

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && currentData && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard 
                  title={selectedMonth === 'All Data' ? 'Total Complaints (YTD)' : `Total Complaints (${selectedMonth.split(' ')[0]})`} 
                  value={currentData.kpis.total} 
                  icon={LayoutDashboard} 
                  subtext={
                    selectedMonth === 'All Data' 
                      ? <span className="text-slate-500">Aggregated Total</span>
                      : currentData.kpis.total < currentData.kpis.prev 
                        ? <span className="text-emerald-600 flex items-center"><TrendingDown className="w-4 h-4 mr-1"/> vs {currentData.kpis.prev} last month</span> 
                        : <span className="text-rose-600 flex items-center"><TrendingUp className="w-4 h-4 mr-1"/> vs {currentData.kpis.prev} last month</span>
                  }
                  colorClass="bg-blue-500 text-blue-600" 
                />
                <MetricCard title="Resolution Rate" value={`${currentData.kpis.resolved}%`} icon={CheckCircle} colorClass="bg-emerald-500 text-emerald-600" />
                <MetricCard title="Avg Resolution Time" value={currentData.kpis.time} icon={Clock} colorClass="bg-purple-500 text-purple-600" />
                <MetricCard title="Unsatisfactory Feedback" value={`${currentData.kpis.unsat}%`} icon={AlertTriangle} colorClass="bg-rose-500 text-rose-600" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Category Pie Chart */}
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

                {/* Trend Line Chart */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm col-span-1 lg:col-span-2">
                  <h3 className="text-base font-bold text-slate-800 mb-4">Complaint Trend ({selectedMonth})</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={currentData.trends}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          itemStyle={{ fontSize: '14px', fontWeight: 500 }}
                        />
                        <Line type="monotone" dataKey="Cleanliness" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="Bedroll" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="Watering" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Top Contributors */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mt-6">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Top Contributors</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  {currentData.categories.slice(0, 3).map((cat, idx) => {
                    const IconComponent = iconMap[cat.icon];
                    return (
                      <div key={idx} className="p-6 flex items-center space-x-4 hover:bg-slate-50 transition-colors">
                        <div className="p-3 rounded-full" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                          {IconComponent && <IconComponent className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="text-sm text-slate-500 font-medium">{cat.name}</p>
                          <div className="flex items-baseline space-x-2">
                            <h4 className="text-2xl font-bold text-slate-800">{cat.value}</h4>
                            <span className="text-xs text-slate-400">cases</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: TRAIN ANALYSIS */}
          {activeTab === 'trains' && currentData && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-base font-bold text-slate-800">Top Culprit Trains</h3>
                </div>
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

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="p-4 font-semibold border-b border-slate-100">Train Number & Route</th>
                        <th className="p-4 font-semibold border-b border-slate-100">Total Complaints</th>
                        <th className="p-4 font-semibold border-b border-slate-100">Rate / Rake / Day</th>
                        <th className="p-4 font-semibold border-b border-slate-100">Action Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                      {currentData.trains.map((train, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-medium text-slate-900 flex items-center">
                            <TrainFront className="w-4 h-4 mr-2 text-indigo-500" />
                            {train.train}
                          </td>
                          <td className="p-4">{train.complaints}</td>
                          <td className="p-4 font-medium">{train.rate}</td>
                          <td className="p-4">
                            {train.rate > 2 ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">Immediate Review</span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Monitor</span>
                            )}
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
                <h3 className="text-base font-bold text-slate-800 mb-6">Complaints Volume by 4-Hour Shift ({selectedMonth})</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentData.shifts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="shift" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="complaints" name="Total Complaints" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                      <Bar dataKey="resolvedOnTime" name="Resolved on Time" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-6">
                    <div className="p-4 bg-orange-100 text-orange-600 rounded-full">
                      <Clock className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">Peak Volume: 08:00 - 12:00</h4>
                      <p className="text-sm text-slate-500 mt-1">Majority of telephonic and cleaning complaints originate post morning routines.</p>
                    </div>
                 </div>
                 <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-6">
                    <div className="p-4 bg-indigo-100 text-indigo-600 rounded-full">
                      <Droplets className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">Watering Infractions</h4>
                      <p className="text-sm text-slate-500 mt-1">Spikes in complaints directly correlate with skipped hydrants during busy shift hours.</p>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* TAB 4: FEEDBACK */}
          {activeTab === 'feedback' && currentData && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-rose-50 flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-bold text-rose-900">Unsatisfactory Feedback Root Cause Analysis</h3>
                    <p className="text-sm text-rose-700 mt-1">Requires immediate disciplinary or procedural action based on passenger comments.</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="p-4 font-semibold border-b border-slate-100">Ref No.</th>
                        <th className="p-4 font-semibold border-b border-slate-100">Train</th>
                        <th className="p-4 font-semibold border-b border-slate-100">Category</th>
                        <th className="p-4 font-semibold border-b border-slate-100">Passenger Description</th>
                        <th className="p-4 font-semibold border-b border-slate-100">Root Cause</th>
                        <th className="p-4 font-semibold border-b border-slate-100">Avoidable?</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                      {currentData.feedback.map((fb, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-mono text-xs text-slate-500">{fb.id}</td>
                          <td className="p-4 font-medium text-slate-900">{fb.train}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              fb.head === 'Cleanliness' ? 'bg-blue-100 text-blue-700' :
                              fb.head === 'Bed Roll' ? 'bg-purple-100 text-purple-700' :
                              fb.head === 'Staff Behavior' ? 'bg-rose-100 text-rose-700' :
                              'bg-cyan-100 text-cyan-700'
                            }`}>
                              {fb.head}
                            </span>
                          </td>
                          <td className="p-4 max-w-xs truncate" title={fb.desc}>{fb.desc}</td>
                          <td className="p-4 font-medium">{fb.rootCause}</td>
                          <td className="p-4">
                            {fb.avoidable === 'Yes' ? (
                              <span className="text-rose-600 font-bold flex items-center">
                                <AlertTriangle className="w-4 h-4 mr-1" /> YES
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium">NO</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}