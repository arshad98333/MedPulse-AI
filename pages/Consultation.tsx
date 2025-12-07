
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Plus, Trash2, CheckCircle, Printer, Loader2, Search, FileText, Database, Key, Utensils, AlertTriangle, Ban, Check, EyeOff, Eye } from 'lucide-react';
import { Patient, Vitals, Medicine, RagResult, DietCategory, DietStatus } from '../types';
import { analyzeSymptoms, generateDetailedDietPlan } from '../services/geminiService';
import { searchMedicalRecords } from '../services/ragService';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { logger } from '../services/logger';

const Consultation = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const patient: Patient = state?.patient || {
    id: 'unknown', name: 'Unknown', email: 'test@test.com', age: 0, gender: 'Other', bloodGroup: 'NA'
  };

  useEffect(() => {
    logger.info("ConsultationUI", `Started consultation for patient: ${patient.name} (${patient.id})`);
  }, [patient]);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchingRag, setSearchingRag] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [symptoms, setSymptoms] = useState('');
  const [vitals, setVitals] = useState<Vitals>({
    temperature: '', pulse: '', spo2: '', bpSystolic: '', bpDiastolic: '', weight: '', height: '', sugar: ''
  });
  
  // RAG State
  const [ragResults, setRagResults] = useState<RagResult[]>([]);
  const [ragError, setRagError] = useState('');
  const [gcpToken, setGcpToken] = useState(localStorage.getItem('gcloud_access_token') || '');
  const [showTokenInput, setShowTokenInput] = useState(false);

  // AI Analysis State
  const [analysis, setAnalysis] = useState<{diagnosisSuggestions: string[], rationale: string, suggestedTreatmentNote?: string} | null>(null);

  // Diagnosis & Plan
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [treatmentNotes, setTreatmentNotes] = useState('');
  
  // Prescription
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [newMed, setNewMed] = useState<Partial<Medicine>>({});

  // Lifestyle / Diet
  const [dietPlan, setDietPlan] = useState<DietCategory[]>([]);
  const [exercise, setExercise] = useState('30 mins moderate activity daily.');

  const handleRagSearch = async () => {
    if (!symptoms) return;
    logger.info("ConsultationUI", "User triggered RAG search");
    setSearchingRag(true);
    setRagError('');
    
    if (gcpToken) {
        localStorage.setItem('gcloud_access_token', gcpToken);
    }

    try {
      const results = await searchMedicalRecords(symptoms, gcpToken);
      setRagResults(results || []);
      if (!results || results.length === 0) {
        setRagError('No relevant records found.');
      }
    } catch (e: any) {
      setRagError(e.message || 'Failed to retrieve records. Check API Access Token.');
      setRagResults([]);
      setShowTokenInput(true);
    } finally {
      setSearchingRag(false);
    }
  };

  const handleAnalyze = async () => {
    logger.info("ConsultationUI", "User triggered AI Analysis");
    setLoading(true);
    const context = (ragResults || []).map(r => `Source: ${r.title}\nContent: ${r.snippet}`).join('\n\n');
    
    const result = await analyzeSymptoms(symptoms, vitals, context);
    setAnalysis(result);
    setFinalDiagnosis(result.diagnosisSuggestions?.[0] || ''); 
    if (result.suggestedTreatmentNote) {
        setTreatmentNotes(result.suggestedTreatmentNote);
    }
    setLoading(false);
    setStep(2);
  };

  const handleDiagnosisSelect = (diag: string) => {
      logger.info("ConsultationUI", `Diagnosis selected: ${diag}`);
      setFinalDiagnosis(diag);
      // Optional: Regenerate notes if needed, for now just keeping existing or user edited
  };

  const handleAddMedicine = () => {
    if (newMed.name && newMed.dosage) {
      logger.info("ConsultationUI", "Added medicine", newMed);
      setMedicines([...medicines, { ...newMed, id: Date.now().toString() } as Medicine]);
      setNewMed({});
    }
  };

  const removeMedicine = (id: string) => {
    setMedicines(medicines.filter(m => m.id !== id));
  };

  const handleGenerateDiet = async () => {
    logger.info("ConsultationUI", "Generating detailed diet plan");
    setLoading(true);
    const plan = await generateDetailedDietPlan(finalDiagnosis);
    setDietPlan(plan);
    setLoading(false);
    setStep(3);
  };

  const toggleDietStatus = (catIndex: number, itemIndex: number, status: DietStatus) => {
    const newPlan = [...dietPlan];
    newPlan[catIndex].items[itemIndex].status = status;
    setDietPlan(newPlan);
  };

  const toggleDietSelection = (catIndex: number, itemIndex: number) => {
    const newPlan = [...dietPlan];
    const currentSelected = newPlan[catIndex].items[itemIndex].selected;
    newPlan[catIndex].items[itemIndex].selected = currentSelected === undefined ? false : !currentSelected;
    setDietPlan(newPlan);
  };

  const handleFinalize = async () => {
    logger.info("ConsultationUI", "Finalizing consultation");
    setSaving(true);
    try {
      const consultationData = {
        patientId: patient.id,
        patientName: patient.name,
        date: new Date().toISOString(),
        symptoms,
        vitals,
        ragReferences: ragResults.map(r => r.uri),
        aiAnalysis: analysis,
        finalDiagnosis,
        treatmentNotes,
        medicines,
        dietPlan, // Detailed plan with selection state
        lifestyle: { exercise }
      };

      await addDoc(collection(db, 'consultations'), consultationData);
      logger.success("ConsultationUI", "Consultation saved to Firestore");

      if (patient.id !== 'unknown') {
        const patientRef = doc(db, 'patients', patient.id);
        await updateDoc(patientRef, {
          lastVisit: new Date().toISOString().split('T')[0]
        });
      }

      navigate('/');
    } catch (error) {
      logger.error("ConsultationUI", "Error saving consultation", error);
      alert("Failed to save record. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // --- Render Steps ---

  const renderVitalsStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
      {/* Vitals Input */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
          Patient Complaints & Vitals
        </h3>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Symptoms</label>
            <textarea 
              className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
              placeholder="Enter detailed symptoms..."
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
             {[
               { label: 'Temp (°C)', key: 'temperature' as keyof Vitals, placeholder: '37.5' },
               { label: 'Pulse (bpm)', key: 'pulse' as keyof Vitals, placeholder: '80' },
               { label: 'SpO2 (%)', key: 'spo2' as keyof Vitals, placeholder: '98' },
               { label: 'BP Sys', key: 'bpSystolic' as keyof Vitals, placeholder: '120' },
               { label: 'BP Dia', key: 'bpDiastolic' as keyof Vitals, placeholder: '80' },
               { label: 'Weight (kg)', key: 'weight' as keyof Vitals, placeholder: '70' },
             ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{field.label}</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder={field.placeholder}
                    value={vitals[field.key]}
                    onChange={(e) => setVitals({...vitals, [field.key]: e.target.value})}
                  />
                </div>
             ))}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
           {/* RAG Search Trigger */}
           <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
               <div className="flex items-center justify-between mb-3">
                  <div>
                      <h4 className="font-semibold text-slate-900 flex items-center gap-2"><Database size={16} className="text-purple-600"/> Clinical Knowledge Base</h4>
                      <p className="text-xs text-slate-500">Search Vertex AI Medical Records</p>
                  </div>
                  <button 
                    onClick={() => setShowTokenInput(!showTokenInput)}
                    className="text-slate-400 hover:text-slate-600"
                    title="Configure Access Token"
                  >
                    <Key size={14} />
                  </button>
               </div>

               {showTokenInput && (
                   <div className="mb-3">
                       <input 
                         type="password"
                         className="w-full text-xs p-2 border border-slate-300 rounded"
                         placeholder="Paste Google Cloud Access Token (gcloud auth print-access-token)"
                         value={gcpToken}
                         onChange={(e) => setGcpToken(e.target.value)}
                       />
                   </div>
               )}

               <button 
                 onClick={handleRagSearch}
                 disabled={searchingRag || !symptoms}
                 className="w-full px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
               >
                 {searchingRag ? <Loader2 size={16} className="animate-spin"/> : <Search size={16} />}
                 Retrieve Relevant Records
               </button>
               
               {ragError && <p className="text-xs text-red-500 mt-2">{ragError}</p>}
           </div>
           
           {/* RAG Results Display */}
           {ragResults.length > 0 && (
              <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 text-sm max-h-48 overflow-y-auto custom-scrollbar">
                 <p className="text-xs font-bold text-blue-800 mb-2 sticky top-0 bg-blue-50/95 py-1">Found References:</p>
                 {ragResults.map((result) => (
                    <div key={result.id} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-0 border-blue-100">
                        <p className="font-medium text-slate-800 flex items-center gap-1 text-xs">
                          <FileText size={12} className="text-blue-500"/> {result.title}
                        </p>
                        <p className="text-slate-600 mt-1 text-xs leading-relaxed">{result.snippet}</p>
                    </div>
                 ))}
              </div>
           )}

           <button 
             onClick={handleAnalyze}
             disabled={loading || !symptoms}
             className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
           >
             {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
             Analyze with Gemini AI
           </button>
        </div>
      </div>

      {/* Static Info / Patient Details */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="text-lg font-bold text-slate-900 mb-4">Patient Details</h3>
           <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">Name:</span> {patient.name}</div>
              <div><span className="text-slate-500">Age:</span> {patient.age}</div>
              <div><span className="text-slate-500">Gender:</span> {patient.gender}</div>
              <div><span className="text-slate-500">Last Visit:</span> {patient.lastVisit}</div>
           </div>
        </div>
      </div>
    </div>
  );

  const renderDiagnosisStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
       {/* Left: Diagnosis & Treatment */}
       <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">AI Clinical Analysis</h3>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                   <Sparkles size={12} /> Gemini Powered
                </span>
             </div>
             
             {/* AI Suggestions Bubble */}
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-6">
                <p className="text-sm font-semibold text-slate-700 mb-2">Diagnosis Suggestions:</p>
                <div className="flex gap-2 flex-wrap">
                   {analysis?.diagnosisSuggestions?.map((diag, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => handleDiagnosisSelect(diag)}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${finalDiagnosis === diag ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}
                      >
                        {diag}
                      </button>
                   ))}
                </div>
                <p className="text-xs text-slate-500 mt-3 italic">Rationale: {analysis?.rationale}</p>
             </div>

             <div className="space-y-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-2">Final Diagnosis</label>
                   <input 
                      type="text" 
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-900"
                      value={finalDiagnosis}
                      onChange={(e) => setFinalDiagnosis(e.target.value)}
                   />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-2">Treatment Notes</label>
                   <textarea 
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                      placeholder="Enter overall therapeutic strategy..."
                      value={treatmentNotes}
                      onChange={(e) => setTreatmentNotes(e.target.value)}
                   />
                </div>
             </div>
          </div>

          {/* Medicines List */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="text-lg font-bold text-slate-900 mb-4">Prescribed Medication</h3>
             {medicines.length === 0 ? (
               <p className="text-sm text-slate-400 text-center py-4">No medicines added yet.</p>
             ) : (
               <div className="space-y-3">
                 {medicines.map((med) => (
                   <div key={med.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div>
                        <p className="font-semibold text-slate-800">{med.name} <span className="text-xs font-normal text-slate-500">({med.dosage})</span></p>
                        <p className="text-xs text-slate-500">{med.frequency} • {med.notes}</p>
                      </div>
                      <button onClick={() => removeMedicine(med.id)} className="text-slate-400 hover:text-red-500">
                         <Trash2 size={16} />
                      </button>
                   </div>
                 ))}
               </div>
             )}
          </div>
       </div>

       {/* Right: Prescription Builder */}
       <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Add Medicine</h3>
          <div className="space-y-4">
            <input
              type="text"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="Medicine Name (e.g. Metformin)"
              value={newMed.name || ''}
              onChange={(e) => setNewMed({...newMed, name: e.target.value})}
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="Dosage (500mg)"
                value={newMed.dosage || ''}
                onChange={(e) => setNewMed({...newMed, dosage: e.target.value})}
              />
               <select 
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                value={newMed.frequency || ''}
                onChange={(e) => setNewMed({...newMed, frequency: e.target.value})}
               >
                 <option value="">Frequency</option>
                 <option value="1-0-0">Morning (1-0-0)</option>
                 <option value="1-0-1">Morn & Night (1-0-1)</option>
                 <option value="1-1-1">Thrice (1-1-1)</option>
                 <option value="0-0-1">Night (0-0-1)</option>
               </select>
            </div>
            <input
              type="text"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="Instructions (e.g. After food)"
              value={newMed.notes || ''}
              onChange={(e) => setNewMed({...newMed, notes: e.target.value})}
            />
            <button 
              onClick={handleAddMedicine}
              className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Add to List
            </button>
          </div>
          
          <div className="mt-8 pt-8 border-t border-slate-100">
             <button 
                onClick={handleGenerateDiet}
                disabled={loading}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
             >
                {loading ? <Loader2 className="animate-spin" /> : <>Next: Diet Prescription <ArrowLeft className="rotate-180" size={18} /></>}
             </button>
          </div>
       </div>
    </div>
  );

  const renderLifestyleStep = () => (
    <div className="animate-fade-in pb-20">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mb-6">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
             <Utensils size={20} />
             <h3 className="font-semibold">Diet Prescription Checklist</h3>
          </div>
          <span className="text-xs bg-white/10 px-3 py-1 rounded-full text-blue-200">
             Diagnosis: {finalDiagnosis}
          </span>
        </div>
        
        <div className="bg-yellow-50 px-4 py-2 text-xs text-yellow-800 border-b border-yellow-100 flex items-center gap-2">
           <Eye size={14} /> Only checked items will appear in the final report.
        </div>

        <div className="p-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dietPlan.map((cat, catIdx) => (
                <div key={catIdx} className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                   <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 font-semibold text-sm text-slate-700">
                      {cat.category}
                   </div>
                   <div className="p-3 space-y-2 flex-1">
                      {cat.items.map((item, itemIdx) => (
                        <div key={itemIdx} className={`flex items-center justify-between text-sm ${item.selected === false ? 'opacity-50' : ''}`}>
                           <div className="flex items-center gap-2 overflow-hidden mr-2">
                               <input 
                                 type="checkbox" 
                                 checked={item.selected !== false}
                                 onChange={() => toggleDietSelection(catIdx, itemIdx)}
                                 className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                               />
                               <span className="text-slate-700 truncate" title={item.name}>{item.name}</span>
                           </div>
                           <div className="flex gap-1 shrink-0">
                              <button 
                                onClick={() => toggleDietStatus(catIdx, itemIdx, 'allowed')}
                                className={`p-1 rounded ${item.status === 'allowed' ? 'bg-green-100 text-green-600 ring-1 ring-green-600' : 'text-slate-300 hover:bg-slate-50'}`}
                                title="Allowed"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={() => toggleDietStatus(catIdx, itemIdx, 'limited')}
                                className={`p-1 rounded ${item.status === 'limited' ? 'bg-yellow-100 text-yellow-600 ring-1 ring-yellow-600' : 'text-slate-300 hover:bg-slate-50'}`}
                                title="Limited"
                              >
                                <AlertTriangle size={14} />
                              </button>
                              <button 
                                onClick={() => toggleDietStatus(catIdx, itemIdx, 'avoid')}
                                className={`p-1 rounded ${item.status === 'avoid' ? 'bg-red-100 text-red-600 ring-1 ring-red-600' : 'text-slate-300 hover:bg-slate-50'}`}
                                title="Not Allowed"
                              >
                                <Ban size={14} />
                              </button>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
           </div>
           
           <div className="mt-8 border-t border-slate-100 pt-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Exercise / Activity Recommendation</label>
              <input 
                 type="text" 
                 className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                 value={exercise}
                 onChange={(e) => setExercise(e.target.value)}
                 placeholder="e.g. 30 mins brisk walking"
              />
           </div>
        </div>
      </div>

       {/* Final Actions */}
       <div className="flex flex-col justify-center space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
             <div>
                <h3 className="font-bold text-slate-900 mb-1">Consultation Complete</h3>
                <p className="text-sm text-slate-500">Generate PDF report with Prescription and detailed Diet Chart.</p>
             </div>
             
             <div className="flex gap-4">
               <button 
                  onClick={() => navigate('/')}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
               >
                  Cancel
               </button>
               <button 
                onClick={handleFinalize}
                disabled={saving}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
               >
                  {saving ? <Loader2 className="animate-spin" /> : <Printer size={20} />}
                  {saving ? 'Saving...' : 'Finalize & Print'}
               </button>
             </div>
          </div>
       </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
           <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div>
           <h1 className="text-2xl font-bold text-slate-900">New Consultation</h1>
           <p className="text-sm text-slate-500">Patient: {patient.name} | ID: {patient.id}</p>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="flex items-center justify-between mb-10 max-w-3xl mx-auto">
         {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
               <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step >= s ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {step > s ? <CheckCircle size={20} /> : s}
               </div>
               {s < 3 && <div className={`w-24 h-1 mx-2 rounded ${step > s ? 'bg-blue-600' : 'bg-slate-200'}`}></div>}
            </div>
         ))}
      </div>

      {/* Content Switcher */}
      {step === 1 && renderVitalsStep()}
      {step === 2 && renderDiagnosisStep()}
      {step === 3 && renderLifestyleStep()}
    </div>
  );
};

export default Consultation;
