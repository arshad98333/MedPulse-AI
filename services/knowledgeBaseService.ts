
import { authService } from './authService';
import { logger } from './logger';

// Bucket name from your prompt instructions
const BUCKET_NAME = "medpulse-mvp-store";

// Vertex AI Search Configuration
const PROJECT_ID = "598482017442";
const LOCATION = "global";
const COLLECTION = "default_collection";
const ENGINE_ID = "usmanos_1765081950581";

export interface GcsFile {
  name: string;
  size: string;
  updated: string;
  contentType: string;
}

export const listKnowledgeBaseFiles = async (): Promise<GcsFile[]> => {
  const serviceName = "KnowledgeBase";
  try {
    const token = await authService.getAccessToken();
    const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}/o`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // Handle 403/401 gracefully
    if (response.status === 401 || response.status === 403) {
       logger.warn(serviceName, "Access Denied. Check Service Account permissions.");
       return [];
    }

    if (!response.ok) throw new Error("Failed to list files");

    const data = await response.json();
    logger.info(serviceName, `Listed ${data.items?.length || 0} files`);
    
    return (data.items || []).map((item: any) => ({
      name: item.name,
      size: (parseInt(item.size) / 1024).toFixed(1) + ' KB',
      updated: new Date(item.updated).toLocaleDateString(),
      contentType: item.contentType
    }));
  } catch (error: any) {
    // Only log if it's a real error, not just a cancel/network blip
    if (error.name !== 'AbortError') {
       logger.error(serviceName, "List failed", error);
    }
    return [];
  }
};

export const uploadKnowledgeBaseFile = async (file: File): Promise<void> => {
  const serviceName = "KnowledgeBase";
  try {
    const token = await authService.getAccessToken();
    
    // Simple upload (media endpoint)
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o?uploadType=media&name=${encodeURIComponent(file.name)}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': file.type
      },
      body: file
    });

    if (!response.ok) throw new Error("Upload failed");
    
    logger.success(serviceName, `Uploaded ${file.name} successfully`);
  } catch (error: any) {
    logger.error(serviceName, "Upload failed", error);
    throw error;
  }
};

/**
 * SECURITY NOTE: Serverless MVP Trade-off.
 * Triggers the Vertex AI Search ingestion pipeline directly from client.
 * In production, this should be a backend trigger.
 */
export const triggerKnowledgeBaseSync = async (): Promise<string> => {
  const serviceName = "VertexAI-Ingest";
  logger.info(serviceName, "Triggering Index Update Pipeline...");

  try {
    const token = await authService.getAccessToken();
    const endpoint = `https://discoveryengine.googleapis.com/v1alpha/projects/${PROJECT_ID}/locations/${LOCATION}/collections/${COLLECTION}/engines/${ENGINE_ID}/branches/0/documents:import`;

    const payload = {
      gcsSource: {
        inputUris: [`gs://${BUCKET_NAME}/*`],
        dataSchema: "content" // unstructured data
      },
      reconciliationMode: "INCREMENTAL", // Only add new/modified files
      autoGenerateIds: true
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Ingestion trigger failed");
    }

    const data = await response.json();
    const opId = data.name?.split('/').pop();
    
    logger.success(serviceName, "Ingestion Pipeline Started", { operationId: opId });
    return `Pipeline Started (Op: ${opId})`;

  } catch (error: any) {
    logger.error(serviceName, "Failed to trigger sync", error);
    throw error;
  }
};
