
import { GoogleGenAI, Type } from "@google/genai";
import { Vitals, DietCategory } from "../types";
import { logger } from "./logger";

// NOTE: In a real production app, never expose API keys on the client side.
const apiKey = process.env.API_KEY || "YOUR_API_KEY_HERE"; 
const ai = new GoogleGenAI({ apiKey: apiKey });

export const testGeminiConnection = async () => {
    const serviceName = "GeminiAI-Test";
    logger.info(serviceName, "Testing connectivity...");
    try {
        const prompt = "Reply with 'Connection Successful' if you receive this.";
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        const text = response.text;
        logger.success(serviceName, "Connection Verified", { response: text });
        return { success: true, message: text };
    } catch (error: any) {
        logger.error(serviceName, "Connection Failed", error);
        return { success: false, error: error.message };
    }
};

export const getEmbedding = async (text: string): Promise<number[]> => {
  try {
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: { parts: [{ text }] }
    });
    return response.embeddings?.[0]?.values || [];
  } catch (e) {
    logger.error("GeminiAI-Embedding", "Failed to get embedding", e);
    return [];
  }
};

export const detectPII = async (text: string): Promise<{ containsPII: boolean, redactedText: string, identifiedTypes: string[] }> => {
  const serviceName = "GeminiAI-HIPAA";
  try {
    const prompt = `
      Analyze the following text for Personally Identifiable Information (PII) according to HIPAA guidelines.
      Text: "${text}"
      
      Identify if it contains specific names, phone numbers, SSNs, or addresses.
      Return JSON: { "containsPII": boolean, "redactedText": string (replace PII with [REDACTED]), "identifiedTypes": string[] }
    `;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || '{"containsPII": false, "redactedText": "", "identifiedTypes": []}');
  } catch (e) {
    logger.error(serviceName, "PII Detection Failed", e);
    return { containsPII: false, redactedText: text, identifiedTypes: [] };
  }
};

export const analyzeSymptoms = async (symptoms: string, vitals: Vitals, ragContext: string = '') => {
  const serviceName = "GeminiAI-Analysis";
  logger.info(serviceName, "Starting symptom analysis", { symptoms, vitals });

  try {
    const startTime = performance.now();
    const prompt = `
      Act as a senior clinical diagnostic AI assistant.
      
      Patient Vitals:
      - Temperature: ${vitals.temperature}°C
      - Pulse: ${vitals.pulse} bpm
      - SpO2: ${vitals.spo2}%
      - BP: ${vitals.bpSystolic}/${vitals.bpDiastolic} mmHg
      
      Patient Symptoms: "${symptoms}"

      ${ragContext ? `
      Relevant Medical Records / Guidelines (RAG Context):
      ${ragContext}
      
      Instructions: Use the provided context to refine your diagnosis if relevant.
      ` : ''}
      
      Provide a JSON response with:
      1. A list of 3 potential diagnosis suggestions (ranked by probability).
      2. A clinical rationale explaining why these match the symptoms and vitals.
      3. A suggested "Treatment Note" summarizing the therapeutic strategy.
      
      Return ONLY valid JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diagnosisSuggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            rationale: { type: Type.STRING },
            suggestedTreatmentNote: { type: Type.STRING }
          }
        }
      }
    });

    const duration = Math.round(performance.now() - startTime);
    logger.success(serviceName, `Analysis generated in ${duration}ms`);

    const parsed = JSON.parse(response.text || "{}");
    logger.info(serviceName, "Parsed AI Response", parsed);

    return {
      diagnosisSuggestions: Array.isArray(parsed.diagnosisSuggestions) ? parsed.diagnosisSuggestions : [],
      rationale: parsed.rationale || "No rationale provided.",
      suggestedTreatmentNote: parsed.suggestedTreatmentNote || ""
    };
  } catch (error) {
    logger.error(serviceName, "Analysis Failed", error);
    return {
      diagnosisSuggestions: ["Consultation Required", "Viral Screen", "General Checkup"],
      rationale: "AI service is currently unavailable.",
      suggestedTreatmentNote: "Monitor vitals and treat symptomatically."
    };
  }
};

const MASTER_DIET_ITEMS = {
  "Deep Fried food": ["Samosa", "Dosa", "Udid-Wada", "Pakodas", "Fried Papad", "Namkeens", "Potato chips", "French fries", "Puri"],
  "Sweets": ["Sugar", "All sweets", "Cakes", "Jam", "Honey", "Sweetened Biscuits", "Sweetened Drinks", "Fruit shakes", "Sweet fruits (Mango, Grapes)"],
  "Green vegetables": ["Cauliflower", "Cabbage", "Lady's finger", "Tomato", "Brinjal", "Radish", "Pumpkin", "Cucumber"],
  "Tubers": ["Potato", "Sweet Potato"],
  "Milk": ["Milk with Protein powder", "Complan/Bournvita"],
  "Liquids": ["Water", "Lime water", "Coconut water", "Electral water", "Buttermilk"],
  "Hot drinks": ["Tea", "Coffee", "Herbal tea", "Warm milk", "Soups"],
  "Cold drinks": ["Aerated drinks", "Ice-cream"],
  "Soft food (Breakfast)": ["Idli", "Sheera", "Bread", "Toast", "Khakra", "Cornflakes"],
  "Soft food (Meal)": ["Ganji (Rice/Sabu)", "Payasam", "Soft rice with milk/Ghee/Plain Daal", "Salads", "Boiled vegetables"],
  "Regular food (Breakfast)": ["Upma", "Puri-Bhaji"],
  "Regular food (Meals)": ["Chapati", "Phulka", "Roti", "Spicy vegetables"],
  "Fast Foods": ["Hamburger", "Pizza"],
  "Fruits": ["Banana", "Apple", "Pear", "Papaya", "Watermelon", "Mango"],
  "Sour fruits": ["Citrus fruits (Orange, Lemon, Mosambi)"],
  "Dry fruits": ["Dates", "Manuka", "Pista", "Almond"],
  "Non-veg": ["Egg-white", "Egg-Yellow", "Omlet", "Boiled Egg", "Meat", "Lean meat"],
  "Sea food": ["Fish"]
};

export const generateDetailedDietPlan = async (diagnosis: string): Promise<DietCategory[]> => {
  const serviceName = "GeminiAI-DietPlan";
  logger.info(serviceName, `Generating diet plan for diagnosis: ${diagnosis}`);

  try {
    const categories = Object.keys(MASTER_DIET_ITEMS);
    const itemsJson = JSON.stringify(MASTER_DIET_ITEMS);

    const prompt = `
      The patient has been diagnosed with: ${diagnosis}.
      You are a Clinical Dietician.
      
      Here is the Master List of food items categorized:
      ${itemsJson}
      
      For EACH item in the master list, assign a status: 'allowed', 'limited', or 'avoid' based on the diagnosis.
      
      Return a JSON object where keys are the category names and values are arrays of objects with { "name": "ItemName", "status": "allowed" | "limited" | "avoid" }.
      Ensure ALL items from the master list are included.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    logger.success(serviceName, "Diet plan generated successfully");
    
    // Transform into DietCategory[]
    const dietPlan: DietCategory[] = Object.entries(MASTER_DIET_ITEMS).map(([cat, items]) => {
      return {
        category: cat,
        items: (items as string[]).map(itemName => {
          // Check if AI returned a status for this item, otherwise default to allowed
          const aiCat = parsed[cat] || [];
          const aiItem = aiCat.find((i: any) => i.name === itemName);
          return {
            name: itemName,
            status: aiItem?.status || 'allowed',
            selected: true // Default all to selected so doctor can decide what to keep
          };
        })
      };
    });

    return dietPlan;

  } catch (error) {
    logger.error(serviceName, "Diet Generation Error", error);
    // Fallback: Return default structure with everything allowed and selected
    return Object.entries(MASTER_DIET_ITEMS).map(([cat, items]) => ({
      category: cat,
      items: (items as string[]).map(i => ({ name: i, status: 'allowed', selected: true }))
    }));
  }
};
