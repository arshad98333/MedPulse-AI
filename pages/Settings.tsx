
import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Database, Sparkles, AlertTriangle, CheckCircle, XCircle, Trash2, Key, Terminal } from 'lucide-react';
import { logger, LogEntry } from '../services/logger';
import { searchMedicalRecords } from '../services/ragService';
import { testGeminiConnection } from '../services/geminiService';

const Settings = () => {
  const [gcpToken, setGcpToken] = useState(localStorage.getItem('gcloud_access_token') || '');
  const [activeTab, setActiveTab] = useState<'config' | 'logs'>('config');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Test States
  const [ragStatus, setRagStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ragMsg, setRagMsg] = useState('');
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [geminiMsg, setGeminiMsg] = useState('');

  useEffect(() => {
    // Subscribe to logger
    const unsubscribe = logger.subscribe((log) => {
      setLogs(prev => [...prev, log]);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom of logs
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const handleSaveToken = () => {
    localStorage.setItem('gcloud_access_token', gcpToken);
    logger.success("Settings", "GCP Access Token saved to local storage");
  };

  const runRagTest = async () => {
    setRagStatus('loading');
    setRagMsg('');
    try {
      const results = await searchMedicalRecords("fever", gcpToken); // Test query
      if (results && results.length >= 0) {
        setRagStatus('success');
        setRagMsg(`Success! Retrieved ${results.length} records.`);
      } else {
         throw new Error("No response data");
      }
    } catch (error: any) {
      setRagStatus('error');
      setRagMsg(error.message || "Connection failed");
    }
  };

  const runGeminiTest = async () => {
    setGeminiStatus('loading');
    setGeminiMsg('');
    const result = await testGeminiConnection();
    if (result.success) {
      setGeminiStatus('success');
      setGeminiMsg("Gemini API is reachable and responding.");
    } else {
      setGeminiStatus('error');
      setGeminiMsg(typeof result.error === 'string' ? result.error : "Connection failed");
    }
  };

  const clearLogs = () => {
    logger.clear();
    setLogs([]);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon size={32} className="text-slate-700" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings & Diagnostics</h1>
          <p className="text-slate-500">Configure API connections and monitor system health.</p>
        </div>
      </div>

      <div className="flex gap-6 mb-6 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('config')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'config' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Configuration & Tests
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'logs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          System Logs
        </button>
      </div>

      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Credentials Section */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Key size={18} className="text-slate-500" /> API Credentials
             </h3>
             
             <div className="space-y-4">
                <div>
                   <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Google Cloud Access Token (Vertex AI Search)</label>
                   <p className="text-xs text-slate-400 mb-2">Required for searching medical records (RAG). Generated via <code className="bg-slate-100 px-1 rounded">gcloud auth print-access-token</code>.</p>
                   <div className="flex gap-2">
                      <input 
                        type="password"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={gcpToken}
                        onChange={(e) => setGcpToken(e.target.value)}
                        placeholder="ya29.a0..."
                      />
                      <button 
                        onClick={handleSaveToken}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                      >
                        Save
                      </button>
                   </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Gemini API Key</label>
                    <p className="text-xs text-slate-400">Loaded from environment variables or hardcoded configuration.</p>
                    <div className="flex items-center gap-2 mt-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span className="text-sm font-mono text-slate-600">Configured</span>
                    </div>
                </div>
             </div>
          </div>

          {/* Diagnostics Section */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-slate-500" /> Diagnostics
             </h3>

             <div className="space-y-6">
                {/* Vertex AI RAG Test */}
                <div className="flex items-start justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                   <div>
                      <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                         <Database size={16} className="text-purple-600" /> Vertex AI Search (RAG)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">Tests connection to Google Discovery Engine.</p>
                      {ragMsg && (
                         <p className={`text-xs mt-2 font-mono ${ragStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>{ragMsg}</p>
                      )}
                   </div>
                   <button 
                     onClick={runRagTest}
                     disabled={ragStatus === 'loading'}
                     className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${ragStatus === 'loading' ? 'bg-slate-200 text-slate-500' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'}`}
                   >
                      {ragStatus === 'loading' ? 'Testing...' : 'Test Connection'}
                   </button>
                </div>

                {/* Gemini AI Test */}
                <div className="flex items-start justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                   <div>
                      <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                         <Sparkles size={16} className="text-blue-600" /> Gemini AI API
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">Tests generation capabilities of Gemini 2.0 Flash.</p>
                      {geminiMsg && (
                         <p className={`text-xs mt-2 font-mono ${geminiStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>{geminiMsg}</p>
                      )}
                   </div>
                   <button 
                     onClick={runGeminiTest}
                     disabled={geminiStatus === 'loading'}
                     className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${geminiStatus === 'loading' ? 'bg-slate-200 text-slate-500' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'}`}
                   >
                      {geminiStatus === 'loading' ? 'Testing...' : 'Test Connection'}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden flex flex-col h-[600px] border border-slate-800">
           <div className="bg-slate-800 p-3 flex justify-between items-center border-b border-slate-700">
              <div className="flex items-center gap-2 text-slate-300">
                 <Terminal size={16} />
                 <span className="text-xs font-mono font-bold">System Console</span>
              </div>
              <button onClick={clearLogs} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded transition-colors" title="Clear Logs">
                 <Trash2 size={16} />
              </button>
           </div>
           
           <div className="flex-1 overflow-auto p-4 font-mono text-xs space-y-2 custom-scrollbar">
              {logs.length === 0 ? (
                 <div className="text-slate-600 italic text-center mt-10">No logs captured yet.</div>
              ) : (
                 logs.map((log, i) => (
                    <div key={i} className="flex gap-3 hover:bg-slate-800/50 p-1 rounded">
                       <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                       <span className={`font-bold w-20 shrink-0 ${
                          log.level === 'INFO' ? 'text-blue-400' : 
                          log.level === 'SUCCESS' ? 'text-green-400' : 
                          log.level === 'WARN' ? 'text-yellow-400' : 'text-red-400'
                       }`}>
                          {log.level}
                       </span>
                       <span className="text-purple-300 w-32 shrink-0 truncate" title={log.service}>[{log.service}]</span>
                       <div className="text-slate-300 break-all">
                          {log.message}
                          {log.data && (
                             <details className="mt-1">
                                <summary className="cursor-pointer text-slate-500 hover:text-slate-400 text-[10px] select-none">View Data</summary>
                                <pre className="mt-1 p-2 bg-slate-950 rounded text-[10px] text-slate-400 overflow-x-auto">
                                   {JSON.stringify(log.data, null, 2)}
                                </pre>
                             </details>
                          )}
                       </div>
                    </div>
                 ))
              )}
              <div ref={logsEndRef} />
           </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
