export interface Patient {
  id: string;
  name: string;
  email: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup: string;
  lastVisit?: string;
}

export interface Vitals {
  temperature: string;
  pulse: string;
  spo2: string;
  bpSystolic: string;
  bpDiastolic: string;
  weight: string;
  height: string;
  sugar?: string;
}

export interface Diagnosis {
  condition: string;
  confidence: number;
  reasoning: string;
  notes: string;
}

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes: string;
}

export type DietStatus = 'allowed' | 'limited' | 'avoid';

export interface DietItem {
  name: string;
  status: DietStatus;
  selected?: boolean; // Determines if item appears in final report
}

export interface DietCategory {
  category: string;
  items: DietItem[];
}

export interface ConsultationData {
  patient: Patient;
  symptoms: string;
  vitals: Vitals;
  aiAnalysis?: {
    diagnosisSuggestions: string[];
    rationale: string;
  };
  finalDiagnosis: string;
  treatmentNotes: string;
  medicines: Medicine[];
  // Replaced simple lifestyle with detailed diet plan
  dietPlan: DietCategory[];
  lifestyle?: {
    exercise: string;
  };
}

export interface RagResult {
  id: string;
  title?: string;
  snippet?: string;
  uri?: string;
  relevanceScore?: number;
}