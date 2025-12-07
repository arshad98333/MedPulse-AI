import React, { useState } from 'react';
import { Search, ChevronRight, Clock, User, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Patient } from '../types';

const PatientSearch = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [error, setError] = useState('');
  
  // New Patient Form
  const [newPatient, setNewPatient] = useState({
    name: '',
    email: '',
    age: '',
    gender: 'Male',
    bloodGroup: 'O+'
  });

  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');

    try {
      const patientsRef = collection(db, 'patients');
      const q = query(patientsRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const patientDoc = querySnapshot.docs[0];
        const patientData = { id: patientDoc.id, ...patientDoc.data() } as Patient;
        
        navigate('/consultation', { state: { patient: patientData } });
      } else {
        setError('Patient not found. Please create a new record.');
        setCreateMode(true);
        setNewPatient(prev => ({ ...prev, email: email }));
      }
    } catch (err) {
      console.error(err);
      setError('Error searching for patient.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'patients'), {
        ...newPatient,
        age: Number(newPatient.age),
        lastVisit: 'New Patient'
      });
      
      const createdPatient = { id: docRef.id, ...newPatient, age: Number(newPatient.age) } as Patient;
      navigate('/consultation', { state: { patient: createdPatient } });
    } catch (err) {
      console.error(err);
      setError('Error creating patient record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Left Search Section */}
      <div className="w-full lg:w-1/2 p-12 flex flex-col justify-center border-r border-slate-100 transition-all">
        <div className="max-w-md mx-auto w-full">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            {createMode ? 'Create New Patient' : 'Patient Search'}
          </h1>
          <p className="text-slate-500 mb-8">
            {createMode ? 'Enter patient details to register.' : 'Enter patient email to begin consultation.'}
          </p>

          {!createMode ? (
            <form onSubmit={handleSearch} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Patient Email ID</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. johndoe@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-blue-200 flex justify-center items-center"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Start Consultation'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreatePatient} className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500">Full Name</label>
                    <input required type="text" className="w-full p-3 border rounded-lg" value={newPatient.name} onChange={e => setNewPatient({...newPatient, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500">Age</label>
                        <input required type="number" className="w-full p-3 border rounded-lg" value={newPatient.age} onChange={e => setNewPatient({...newPatient, age: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500">Gender</label>
                        <select className="w-full p-3 border rounded-lg bg-white" value={newPatient.gender} onChange={e => setNewPatient({...newPatient, gender: e.target.value})}>
                            <option>Male</option>
                            <option>Female</option>
                            <option>Other</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500">Blood Group</label>
                    <input required type="text" className="w-full p-3 border rounded-lg" placeholder="e.g. O+" value={newPatient.bloodGroup} onChange={e => setNewPatient({...newPatient, bloodGroup: e.target.value})} />
                </div>
                
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg flex justify-center items-center mt-4"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Register & Start'}
                </button>
                <button type="button" onClick={() => setCreateMode(false)} className="w-full text-slate-400 text-sm mt-2">Cancel</button>
            </form>
          )}
        </div>
      </div>

      {/* Right Section - Placeholder Image or Info */}
      <div className="hidden lg:block w-1/2 bg-slate-50 p-12 flex items-center justify-center">
        <div className="text-center">
            <div className="bg-white p-6 rounded-full inline-block shadow-sm mb-6">
                <User size={64} className="text-blue-200" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Secure Patient Records</h2>
            <p className="text-slate-500 max-w-sm mx-auto">Access patient history, vitals, and AI-assisted diagnosis in one secure location.</p>
        </div>
      </div>
    </div>
  );
};

export default PatientSearch;
