
import { analyzeSymptoms } from './geminiService';
import { GoogleGenAI } from "@google/genai";
import { logger } from './logger';

// 1. Define Standard Vitals for context (so the AI focuses on symptoms)
const STANDARD_VITALS = {
  temperature: '37.0',
  pulse: '72',
  spo2: '98',
  bpSystolic: '120',
  bpDiastolic: '80',
  weight: '70',
  height: '175',
  sugar: '100'
};

// 2. The Test Dataset (Subset of 50 potential cases)
// In a real app, this might be loaded from a JSON file or CSV.
const TEST_CASES = [
  { 
    id: 1, 
    symptoms: "High fever (39.5C), severe headache, stiff neck, sensitivity to light, nausea.", 
    expected: "Meningitis" 
  },
  { 
    id: 2, 
    symptoms: "Chest pain radiating to left arm, shortness of breath, sweating, nausea, history of hypertension.", 
    expected: "Myocardial Infarction (Heart Attack)" 
  },
  { 
    id: 3, 
    symptoms: "Sudden onset of right lower quadrant abdominal pain, rebound tenderness, fever, vomiting.", 
    expected: "Appendicitis" 
  },
  { 
    id: 4, 
    symptoms: "Excessive thirst, frequent urination, unexplained weight loss, fatigue, blurred vision.", 
    expected: "Type 1 Diabetes Mellitus" 
  },
  { 
    id: 5, 
    symptoms: "Dry cough, wheezing, chest tightness, shortness of breath, worse at night.", 
    expected: "Asthma" 
  },
  { 
    id: 6, 
    symptoms: "Joint pain, stiffness in morning, swelling in fingers and toes, fatigue.", 
    expected: "Rheumatoid Arthritis" 
  },
  { 
    id: 7, 
    symptoms: "Sore throat, swollen lymph nodes, fever, white patches on tonsils, absence of cough.", 
    expected: "Strep Throat" 
  },
  { 
    id: 8, 
    symptoms: "Unilateral throbbing headache, aura (visual disturbances), nausea, sensitivity to sound.", 
    expected: "Migraine" 
  },
  { 
    id: 9, 
    symptoms: "Butterfly rash on face, fatigue, joint pain, sensitivity to sun.", 
    expected: "Systemic Lupus Erythematosus (SLE)" 
  },
  { 
    id: 10, 
    symptoms: "Tremor in hands at rest, slow movement (bradykinesia), rigid muscles, stooped posture.", 
    expected: "Parkinson's Disease" 
  }
];

export interface EvalResult {
  caseId: number;
  symptoms: string;
  expected: string;
  predicted: string;
  score: number; // 0 to 100
  reasoning: string;
}

// Initialize Gemini for the "Judge" role
const apiKey = process.env.API_KEY || "YOUR_API_KEY_HERE"; 
const ai = new GoogleGenAI({ apiKey: apiKey });

/**
 * LLM-as-a-Judge: Scores the prediction against the expectation.
 */
const judgeResult = async (expected: string, predicted: string): Promise<{ score: number, reasoning: string }> => {
  try {
    const prompt = `
      You are an expert Medical Board Examiner.
      
      Task: Evaluate the accuracy of a diagnosis.
      
      Expected Diagnosis: "${expected}"
      Model Predicted Diagnosis: "${predicted}"
      
      Scoring Criteria:
      - 100: Exact match or clinically identical synonym (e.g., "Heart Attack" == "Myocardial Infarction").
      - 75: Correct condition but less specific or slightly different phrasing.
      - 50: Broadly correct category (e.g., "Viral Infection" instead of "Influenza") or partial match.
      - 0: Completely incorrect or dangerous miss.
      
      Output JSON format: { "score": number, "reasoning": "short explanation" }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const parsed = JSON.parse(response.text || "{}");
    return {
      score: parsed.score || 0,
      reasoning: parsed.reasoning || "Failed to generate reasoning"
    };

  } catch (error) {
    logger.error("EvalService", "Judge failed", error);
    return { score: 0, reasoning: "Judge Error" };
  }
};

/**
 * Runs the full evaluation suite.
 */
export const runClinicalEvals = async (onProgress: (current: number, total: number, result: EvalResult) => void) => {
  logger.info("EvalService", "Starting Clinical Evaluation Suite...");
  
  const results: EvalResult[] = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    
    // 1. Run the Pipeline (Gemini Analysis)
    // We pass standard vitals to isolate the symptom analysis
    const analysis = await analyzeSymptoms(testCase.symptoms, STANDARD_VITALS);
    const topPrediction = analysis.diagnosisSuggestions?.[0] || "No Diagnosis";

    // 2. Run the Judge
    const judgment = await judgeResult(testCase.expected, topPrediction);

    const result: EvalResult = {
      caseId: testCase.id,
      symptoms: testCase.symptoms,
      expected: testCase.expected,
      predicted: topPrediction,
      score: judgment.score,
      reasoning: judgment.reasoning
    };

    results.push(result);
    onProgress(i + 1, TEST_CASES.length, result);
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
};
