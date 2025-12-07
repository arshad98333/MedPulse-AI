
import { RagResult } from '../types';
import { logger } from './logger';
import { authService } from './authService';

// Configuration from your Vertex AI Search setup
const PROJECT_ID = "598482017442";
const LOCATION = "global";
const COLLECTION = "default_collection";
const ENGINE_ID = "usmanos_1765081950581";
const SERVING_CONFIG = "default_search";

const API_ENDPOINT = `https://discoveryengine.googleapis.com/v1alpha/projects/${PROJECT_ID}/locations/${LOCATION}/collections/${COLLECTION}/engines/${ENGINE_ID}/servingConfigs/${SERVING_CONFIG}:search`;

export const searchMedicalRecords = async (query: string): Promise<RagResult[]> => {
  const serviceName = "VertexAI-RAG";
  
  try {
    // AUTOMATED AUTH: Get token from service account logic
    const token = await authService.getAccessToken();

    logger.info(serviceName, `Initiating search for query: "${query}"`, { endpoint: API_ENDPOINT });

    const startTime = performance.now();
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        pageSize: 10,
        queryExpansionSpec: { condition: "AUTO" },
        spellCorrectionSpec: { mode: "AUTO" },
        languageCode: "en-US",
        contentSearchSpec: {
          snippetSpec: { returnSnippet: true }
        },
        userInfo: {
            timeZone: "Asia/Calcutta"
        }
      })
    });

    const duration = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const err = await response.json();
      const errorMessage = err.error?.message || response.statusText || "Unknown API Error";
      logger.error(serviceName, `API Error (${response.status})`, err);
      throw new Error(`Search failed: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();
    logger.success(serviceName, `Search completed in ${duration}ms`, { totalSize: data.totalSize, resultsCount: data.results?.length || 0 });
    
    if (!data.results) {
        logger.warn(serviceName, "No results returned from API.");
        return [];
    }

    const mappedResults = data.results.map((result: any) => ({
      id: result.id,
      title: result.document?.derivedStructData?.title || result.document?.structData?.title || 'Medical Record',
      snippet: result.document?.derivedStructData?.snippets?.[0]?.snippet || result.document?.structData?.snippet || '',
      uri: result.document?.derivedStructData?.link || `gs://medpulse-mvp-store/${result.id}`,
      relevanceScore: result.relevanceScore
    }));

    return mappedResults;

  } catch (error: any) {
    logger.error(serviceName, "Exception during search", error.message);
    throw error;
  }
};
