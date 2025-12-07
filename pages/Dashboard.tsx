
import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Users, Calendar, Activity, TrendingUp, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
    visitsToday: 0,
    pendingReports: 0,
    avgWaitTime: 12 // Placeholder as we don't track wait time yet
  });
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [diagnosisData, setDiagnosisData] = useState<any[]>([]);
  const [visitData, setVisitData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Consultations for stats
        const consultationsRef = collection(db, 'consultations');
        const q = query(consultationsRef, orderBy('date', 'desc'), limit(20));
        const snapshot = await getDocs(q);
        
        const visits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRecentVisits(visits.slice(0, 5));

        // 2. Calculate Stats
        const todayStr = new Date().toISOString().split('T')[0];
        const todayVisits = visits.filter((v: any) => v.date.startsWith(todayStr)).length;
        
        // Simple aggregation for charts based on fetched data
        const diagCounts: Record<string, number> = {};
        visits.forEach((v: any) => {
          const d = v.finalDiagnosis || 'Unknown';
          diagCounts[d] = (diagCounts[d] || 0) + 1;
        });
        
        const chartData = Object.keys(diagCounts).map(k => ({ name: k, value: diagCounts[k] })).slice(0, 5);
        setDiagnosisData(chartData.length > 0 ? chartData : []);

        // 3. Fetch Patients Count
        const patientsSnapshot = await getDocs(collection(db, 'patients'));
        
        setStats({
          totalPatients: patientsSnapshot.size,
          visitsToday: todayVisits,
          pendingReports: 0, 
          avgWaitTime: 12
        });

        // 4. Visit Trend (mocking daily counts from fetched data timestamps if available, otherwise empty)
        // For simplicity in this demo, we'll map recent visits to days or leave empty if no data
        const tempTrend: any[] = [];
        if (visits.length > 0) {
           // Basic logic to show some data points if visits exist
           tempTrend.push({ name: 'Today', visits: todayVisits });
        }
        setVisitData(tempTrend);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back, Dr. Usman. Here is your daily overview.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Export Report</button>
          <button 
            onClick={() => navigate('/search')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-lg hover:bg-blue-700"
          >
            New Appointment
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-500 text-sm font-medium">Total Patients</span>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users size={20} className="text-blue-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalPatients}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-500 text-sm font-medium">Visits Today</span>
            <div className="p-2 bg-purple-50 rounded-lg">
              <Calendar size={20} className="text-purple-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-slate-900">{stats.visitsToday}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-500 text-sm font-medium">Pending Reports</span>
            <div className="p-2 bg-orange-50 rounded-lg">
              <Activity size={20} className="text-orange-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-slate-900">{stats.pendingReports}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-500 text-sm font-medium">Avg. Wait Time</span>
            <div className="p-2 bg-green-50 rounded-lg">
              <Activity size={20} className="text-green-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-slate-900">{stats.avgWaitTime}m</h3>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Patient Visits Overview</h3>
          <div className="h-72 flex items-center justify-center">
            {visitData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visitData}>
                  <defs>
                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1E293B', color: '#fff', borderRadius: '8px', border: 'none' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="visits" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorVisits)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
               <p className="text-slate-400">No visit data available yet.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Top Diagnoses</h3>
          <div className="h-72 flex items-center justify-center">
             {diagnosisData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={diagnosisData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#F1F5F9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fill: '#475569', fontSize: 11, fontWeight: 500}} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                      {diagnosisData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             ) : (
                <p className="text-slate-400">No diagnosis data yet.</p>
             )}
          </div>
        </div>
      </div>

      {/* Recent Visits Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">Recent Consultations</h3>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                        <th className="px-6 py-4">Patient Name</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Diagnosis</th>
                        <th className="px-6 py-4">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {recentVisits.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                No recent visits found. Start a new appointment to see data here.
                            </td>
                        </tr>
                    ) : (
                        recentVisits.map((visit) => (
                            <tr key={visit.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-slate-900">{visit.patientName}</td>
                                <td className="px-6 py-4 text-slate-500">{new Date(visit.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-slate-700">{visit.finalDiagnosis}</td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Completed</span>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
