
import { authService } from './authService';
import { logger } from './logger';

// Bucket name from your prompt instructions
const BUCKET_NAME = "medpulse-mvp-store";

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
    logger.error(serviceName, "List failed", error);
    throw error;
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
