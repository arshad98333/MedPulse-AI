
import { getEmbedding, detectPII } from './geminiService';
import { logger } from './logger';

const ANCHORS = {
  CRITICAL: "Heart attack, cardiac arrest, stroke, severe trauma, unconscious, severe bleeding, difficulty breathing, anaphylaxis, chest pain radiating to arm, severe head injury",
  URGENT: "High fever (>39C), fracture, severe pain, infection, dehydration, deep cut, asthma attack, abdominal pain, severe migraine",
  ROUTINE: "General checkup, vaccination, mild cold, rash, follow-up, prescription refill, mild headache, fatigue, routine blood work"
};

// Cache for anchor embeddings to avoid re-fetching
let anchorEmbeddings: { [key: string]: number[] } | null = null;

const cosineSimilarity = (a: number[], b: number[]): number => {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magA * magB);
};

export interface TriageResult {
  level: 'CRITICAL' | 'URGENT' | 'ROUTINE';
  confidence: number;
  scores: { critical: number; urgent: number; routine: number };
}

export const calculateTriageLevel = async (symptoms: string): Promise<TriageResult> => {
  const serviceName = "TriageService";
  
  try {
    // 1. Initialize Anchor Embeddings if needed
    if (!anchorEmbeddings) {
      logger.info(serviceName, "Generating Anchor Embeddings (One-time)...");
      const critical = await getEmbedding(ANCHORS.CRITICAL);
      const urgent = await getEmbedding(ANCHORS.URGENT);
      const routine = await getEmbedding(ANCHORS.ROUTINE);
      
      if (!critical.length || !urgent.length || !routine.length) {
          throw new Error("Failed to generate anchor embeddings");
      }
      
      anchorEmbeddings = { CRITICAL: critical, URGENT: urgent, ROUTINE: routine };
    }

    // 2. Get Symptom Embedding
    const inputEmbedding = await getEmbedding(symptoms);
    if (!inputEmbedding.length) throw new Error("Failed to embed symptoms");

    // 3. Calculate Similarities
    const scores = {
      critical: cosineSimilarity(inputEmbedding, anchorEmbeddings.CRITICAL),
      urgent: cosineSimilarity(inputEmbedding, anchorEmbeddings.URGENT),
      routine: cosineSimilarity(inputEmbedding, anchorEmbeddings.ROUTINE)
    };

    logger.info(serviceName, "Triage Scores", scores);

    // 4. Determine Level
    let level: 'CRITICAL' | 'URGENT' | 'ROUTINE' = 'ROUTINE';
    let maxScore = scores.routine;

    if (scores.critical > scores.urgent && scores.critical > scores.routine) {
        level = 'CRITICAL';
        maxScore = scores.critical;
    } else if (scores.urgent > scores.routine) {
        level = 'URGENT';
        maxScore = scores.urgent;
    }

    // Heuristic boost: specific keywords can override embedding if confidence is low
    const lower = symptoms.toLowerCase();
    if (lower.includes('chest pain') || lower.includes('unconscious') || lower.includes('stroke')) {
        level = 'CRITICAL';
        maxScore = 0.99;
    }

    return { level, confidence: maxScore, scores };

  } catch (error) {
    logger.error(serviceName, "Triage calculation failed", error);
    return { level: 'ROUTINE', confidence: 0, scores: { critical: 0, urgent: 0, routine: 0 } };
  }
};

export const checkHipaaCompliance = async (text: string) => {
    return await detectPII(text);
};
