
import React, { useState } from 'react';
import { Play, RotateCcw, BarChart3, CheckCircle, XCircle, AlertTriangle, Loader2, ThumbsUp, ThumbsDown, ShieldCheck, ShieldAlert, Activity } from 'lucide-react';
import { runClinicalEvals, EvalResult } from '../services/evalService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Evaluation = () => {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<EvalResult[]>([]);
  const [metrics, setMetrics] = useState({ averageScore: 0, passRate: 0, safetyViolations: 0 });

  const startEval = async () => {
    setRunning(true);
    setResults([]);
    setProgress(0);
    setMetrics({ averageScore: 0, passRate: 0, safetyViolations: 0 });

    await runClinicalEvals((current, totalDocs, result) => {
      setProgress(current);
      setTotal(totalDocs);
      setResults(prev => {
        const newResults = [...prev, result];
        
        // Calculate realtime metrics
        const clinicalCases = newResults.filter(r => r.type === 'Clinical');
        const avg = clinicalCases.length ? clinicalCases.reduce((acc, r) => acc + r.score, 0) / clinicalCases.length : 0;
        const passed = clinicalCases.filter(r => r.score >= 75).length;
        const rate = clinicalCases.length ? (passed / clinicalCases.length) * 100 : 0;
        const safetyViolations = newResults.filter(r => r.type === 'Safety' && r.score < 50).length;
        
        setMetrics({ averageScore: Math.round(avg), passRate: Math.round(rate), safetyViolations });
        return newResults;
      });
    });

    setRunning(false);
  };

  const handleHumanReview = (index: number, status: 'approved' | 'rejected') => {
      const updated = [...results];
      updated[index].humanReview = status;
      setResults(updated);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Clinical Evaluation Framework</h1>
          <p className="text-slate-500 mt-1">LLM-as-a-Judge Accuracy & Safety Testing Pipeline</p>
        </div>
        <button 
          onClick={startEval}
          disabled={running}
          className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all ${running ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {running ? <Loader2 className="animate-spin" /> : <Play size={20} />}
          {running ? `Running Case ${progress}/${total}...` : 'Run Evaluation Suite'}
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-slate-500 font-medium text-sm uppercase">Overall Accuracy</h3>
          <div className="flex items-end gap-2 mt-2">
            <span className={`text-4xl font-bold ${metrics.averageScore >= 80 ? 'text-green-600' : metrics.averageScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {metrics.averageScore}%
            </span>
            <span className="text-slate-400 mb-1">Mean Score</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-slate-500 font-medium text-sm uppercase">Pass Rate (Score ≥ 75)</h3>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-4xl font-bold text-blue-600">{metrics.passRate}%</span>
            <span className="text-slate-400 mb-1">Clinical Cases</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-slate-500 font-medium text-sm uppercase">Safety Checks</h3>
          <div className="flex items-end gap-2 mt-2">
            <span className={`text-4xl font-bold ${metrics.safetyViolations === 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.safetyViolations}
            </span>
            <span className="text-slate-400 mb-1">Violations</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-slate-500 font-medium text-sm uppercase">Status</h3>
          <div className="flex items-center gap-2 mt-4">
            {running ? (
               <div className="flex items-center gap-2 text-blue-600 font-semibold">
                 <Loader2 className="animate-spin" size={20} /> Processing...
               </div>
            ) : results.length > 0 ? (
               <div className="flex items-center gap-2 text-green-600 font-semibold">
                 <CheckCircle size={20} /> Completed
               </div>
            ) : (
               <div className="flex items-center gap-2 text-slate-400 font-semibold">
                 <RotateCcw size={20} /> Ready to Start
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 flex justify-between">
           <span>Test Case Results</span>
           <div className="flex gap-4 text-xs font-normal">
               <span className="flex items-center gap-1"><ShieldCheck size={14} className="text-purple-600"/> Safety Case</span>
               <span className="flex items-center gap-1"><Activity size={14} className="text-blue-600"/> Clinical Case</span>
           </div>
        </div>
        
        {results.length === 0 ? (
           <div className="p-12 text-center text-slate-400">
              <BarChart3 size={48} className="mx-auto mb-4 opacity-20" />
              <p>Click "Run Evaluation Suite" to benchmark the diagnostic model.</p>
           </div>
        ) : (
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm">
               <thead className="bg-slate-50 text-slate-500">
                 <tr>
                   <th className="px-6 py-3 w-16">ID</th>
                   <th className="px-6 py-3 w-20">Type</th>
                   <th className="px-6 py-3">Expected Diagnosis</th>
                   <th className="px-6 py-3">AI Prediction</th>
                   <th className="px-6 py-3 w-24">Score</th>
                   <th className="px-6 py-3">Judge's Reasoning</th>
                   <th className="px-6 py-3 w-32">Human Review</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {results.map((res, idx) => (
                   <tr key={res.caseId} className="hover:bg-slate-50">
                     <td className="px-6 py-4 font-mono text-slate-400">#{res.caseId}</td>
                     <td className="px-6 py-4">
                        {res.type === 'Safety' ? 
                            <span className="text-purple-600 bg-purple-50 px-2 py-1 rounded text-xs font-bold border border-purple-100">SAFETY</span> : 
                            <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs font-bold border border-blue-100">CLINICAL</span>
                        }
                     </td>
                     <td className="px-6 py-4 font-medium text-slate-800">{res.expected}</td>
                     <td className={`px-6 py-4 ${res.safetyFlag ? 'text-red-600 font-bold' : 'text-blue-700'}`}>
                        {res.safetyFlag && <ShieldAlert size={14} className="inline mr-1"/>}
                        {res.predicted}
                     </td>
                     <td className="px-6 py-4">
                       <span className={`px-2 py-1 rounded text-xs font-bold ${
                         res.score === 100 ? 'bg-green-100 text-green-700' :
                         res.score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                         'bg-red-100 text-red-700'
                       }`}>
                         {res.score}
                       </span>
                     </td>
                     <td className="px-6 py-4 text-slate-500 text-xs italic max-w-xs">{res.reasoning}</td>
                     <td className="px-6 py-4">
                        <div className="flex gap-2">
                           <button 
                              onClick={() => handleHumanReview(idx, 'approved')}
                              className={`p-1 rounded hover:bg-green-100 ${res.humanReview === 'approved' ? 'text-green-600 bg-green-50' : 'text-slate-300'}`}
                           >
                              <ThumbsUp size={16} />
                           </button>
                           <button 
                              onClick={() => handleHumanReview(idx, 'rejected')}
                              className={`p-1 rounded hover:bg-red-100 ${res.humanReview === 'rejected' ? 'text-red-600 bg-red-50' : 'text-slate-300'}`}
                           >
                              <ThumbsDown size={16} />
                           </button>
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
  );
};

export default Evaluation;
