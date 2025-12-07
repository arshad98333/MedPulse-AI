
import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Database, Sparkles, AlertTriangle, Trash2, Key, Terminal, Upload, FileText, CheckCircle, Save } from 'lucide-react';
import { logger, LogEntry } from '../services/logger';
import { searchMedicalRecords } from '../services/ragService';
import { testGeminiConnection } from '../services/geminiService';
import { authService } from '../services/authService';
import { listKnowledgeBaseFiles, uploadKnowledgeBaseFile, GcsFile } from '../services/knowledgeBaseService';

const Settings = () => {
  const [activeTab, setActiveTab] = useState<'config' | 'kb' | 'logs'>('config');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auth State
  const [saJson, setSaJson] = useState('');
  const [hasCreds, setHasCreds] = useState(authService.hasCredentials());

  // KB State
  const [files, setFiles] = useState<GcsFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Test States
  const [ragStatus, setRagStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ragMsg, setRagMsg] = useState('');
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [geminiMsg, setGeminiMsg] = useState('');

  // Subscribe to logs
  useEffect(() => {
    const unsubscribe = logger.subscribe((log) => setLogs(prev => [...prev, log]));
    return () => unsubscribe();
  }, []);

  // Effect 1: Auto-scroll logs (Depends on logs)
  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  // Effect 2: Fetch files (Depends on activeTab/creds, NOT logs)
  useEffect(() => {
    if (activeTab === 'kb' && hasCreds) {
      fetchFiles();
    }
  }, [activeTab, hasCreds]);

  const handleSaveJson = () => {
    if (authService.setCredentials(saJson)) {
      setHasCreds(true);
      setSaJson(''); // Clear input for security
      alert("Service Account Configuration Saved!");
    } else {
      alert("Invalid JSON. Please check the content.");
    }
  };

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const list = await listKnowledgeBaseFiles();
      setFiles(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploading(true);
      try {
        await uploadKnowledgeBaseFile(e.target.files[0]);
        await fetchFiles();
      } catch (e) {
        alert("Upload failed");
      } finally {
        setUploading(false);
      }
    }
  };

  const runRagTest = async () => {
    setRagStatus('loading');
    setRagMsg('');
    try {
      const results = await searchMedicalRecords("fever");
      if (results) {
        setRagStatus('success');
        setRagMsg(`Success! Retrieved ${results.length} records.`);
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
      setGeminiMsg("Gemini API is reachable.");
    } else {
      setGeminiStatus('error');
      setGeminiMsg(typeof result.error === 'string' ? result.error : "Connection failed");
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon size={32} className="text-slate-700" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings & Diagnostics</h1>
          <p className="text-slate-500">System configuration and health monitoring.</p>
        </div>
      </div>

      <div className="flex gap-6 mb-6 border-b border-slate-200">
        <button onClick={() => setActiveTab('config')} className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'config' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Configuration</button>
        <button onClick={() => setActiveTab('kb')} className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'kb' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Knowledge Base</button>
        <button onClick={() => setActiveTab('logs')} className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'logs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>System Logs</button>
      </div>

      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Credentials Section */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Key size={18} /> Credentials Setup</h3>
             
             <div className="space-y-4">
                {hasCreds ? (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100 flex items-center gap-3">
                    <CheckCircle className="text-green-600" size={20} />
                    <div>
                      <p className="font-semibold text-green-800 text-sm">Service Account Configured</p>
                      <p className="text-xs text-green-600">Automated authentication is active.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 flex items-center gap-3">
                    <AlertTriangle className="text-yellow-600" size={20} />
                    <div>
                      <p className="font-semibold text-yellow-800 text-sm">Authentication Missing</p>
                      <p className="text-xs text-yellow-600">Paste your Service Account JSON below to enable automation.</p>
                    </div>
                  </div>
                )}
                
                <div>
                   <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase">Paste Service Account JSON</label>
                   <textarea
                     className="w-full h-32 p-3 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                     placeholder='{ "type": "service_account", "project_id": "...", ... }'
                     value={saJson}
                     onChange={(e) => setSaJson(e.target.value)}
                   />
                   <button onClick={handleSaveJson} className="mt-2 w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
                     <Save size={16} /> Save Configuration
                   </button>
                </div>
             </div>
          </div>

          {/* Diagnostics Section */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Sparkles size={18} /> Connection Tests</h3>

             <div className="space-y-4">
                {/* Vertex AI RAG Test */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                   <div>
                      <h4 className="font-semibold text-sm text-slate-900">Vertex AI RAG</h4>
                      <p className={`text-xs mt-1 font-mono ${ragStatus === 'success' ? 'text-green-600' : 'text-slate-500'}`}>
                        {ragMsg || "Status: Idle"}
                      </p>
                   </div>
                   <button onClick={runRagTest} disabled={ragStatus === 'loading' || !hasCreds} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium disabled:opacity-50">
                      {ragStatus === 'loading' ? 'Testing...' : 'Test'}
                   </button>
                </div>

                {/* Gemini AI Test */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                   <div>
                      <h4 className="font-semibold text-sm text-slate-900">Gemini AI</h4>
                      <p className={`text-xs mt-1 font-mono ${geminiStatus === 'success' ? 'text-green-600' : 'text-slate-500'}`}>
                        {geminiMsg || "Status: Idle"}
                      </p>
                   </div>
                   <button onClick={runGeminiTest} disabled={geminiStatus === 'loading'} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium disabled:opacity-50">
                      {geminiStatus === 'loading' ? 'Testing...' : 'Test'}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'kb' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><Database size={18} /> RAG Knowledge Base</h3>
                <button onClick={fetchFiles} className="text-xs text-blue-600 hover:underline">Refresh</button>
              </div>
              
              {loadingFiles ? (
                <div className="text-center py-10 text-slate-400">Loading files...</div>
              ) : files.length === 0 ? (
                <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                   No files found in bucket <code>medpulse-mvp-store</code>
                </div>
              ) : (
                <div className="overflow-hidden border border-slate-200 rounded-lg">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500">
                         <tr>
                            <th className="px-4 py-2 font-medium">Filename</th>
                            <th className="px-4 py-2 font-medium">Size</th>
                            <th className="px-4 py-2 font-medium">Updated</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {files.map((f, i) => (
                           <tr key={i} className="hover:bg-slate-50">
                              <td className="px-4 py-3 flex items-center gap-2 font-medium text-slate-700">
                                 <FileText size={16} className="text-blue-400" /> {f.name}
                              </td>
                              <td className="px-4 py-3 text-slate-500">{f.size}</td>
                              <td className="px-4 py-3 text-slate-500">{f.updated}</td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
              )}
           </div>

           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Upload size={18} /> Ingest Data</h3>
              <p className="text-sm text-slate-500 mb-4">Upload clinical guidelines or medical records (PDF) to improve AI accuracy.</p>
              
              <label className={`block w-full border-2 border-dashed border-blue-200 rounded-xl p-8 text-center cursor-pointer transition-colors ${uploading ? 'bg-slate-50 opacity-50' : 'hover:bg-blue-50 hover:border-blue-400'}`}>
                 <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} disabled={uploading} />
                 <Upload className="mx-auto text-blue-400 mb-2" size={32} />
                 <span className="text-sm font-medium text-blue-600">{uploading ? 'Uploading...' : 'Click to Upload PDF'}</span>
              </label>
           </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden flex flex-col h-[600px] border border-slate-800">
           <div className="bg-slate-800 p-3 flex justify-between items-center border-b border-slate-700">
              <div className="flex items-center gap-2 text-slate-300"><Terminal size={16} /><span className="text-xs font-mono font-bold">System Console</span></div>
              <button onClick={() => { logger.clear(); setLogs([]); }} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded"><Trash2 size={16} /></button>
           </div>
           <div className="flex-1 overflow-auto p-4 font-mono text-xs space-y-2 custom-scrollbar">
              {logs.map((log, i) => (
                 <div key={i} className="flex gap-3 hover:bg-slate-800/50 p-1 rounded">
                    <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                    <span className={`font-bold w-16 shrink-0 ${log.level === 'INFO' ? 'text-blue-400' : log.level === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}`}>{log.level}</span>
                    <span className="text-purple-300 w-32 shrink-0 truncate">[{log.service}]</span>
                    <div className="text-slate-300 break-all">{log.message}</div>
                 </div>
              ))}
              <div ref={logsEndRef} />
           </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
