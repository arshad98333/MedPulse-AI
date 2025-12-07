
import { logger } from './logger';

const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/cloud-platform.read-only'
];

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

class AuthService {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private credentials: ServiceAccountCreds | null = null;

  constructor() {
    const saved = localStorage.getItem('service_account_creds');
    if (saved) {
      try {
        this.credentials = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved credentials");
      }
    }
  }

  setCredentials(json: string) {
    try {
      const creds = JSON.parse(json);
      if (!creds.client_email || !creds.private_key) {
        throw new Error("Invalid Service Account JSON");
      }
      this.credentials = creds;
      localStorage.setItem('service_account_creds', json);
      // Clear existing token to force refresh
      this.token = null;
      this.tokenExpiry = 0;
      logger.success("AuthService", "Credentials saved successfully");
      return true;
    } catch (error: any) {
      logger.error("AuthService", "Invalid JSON credentials", error);
      return false;
    }
  }

  hasCredentials(): boolean {
    return !!this.credentials;
  }

  async getAccessToken(): Promise<string> {
    // Return cached token if valid (with 5 min buffer)
    if (this.token && Date.now() < this.tokenExpiry - 300000) {
      return this.token;
    }

    if (!this.credentials) {
      // Fallback to manual token if no service account
      const manualToken = localStorage.getItem('gcloud_access_token');
      if (manualToken) return manualToken;
      throw new Error("No Service Account credentials configured. Please go to Settings.");
    }

    logger.info("AuthService", "Refreshing Google Cloud Access Token...");

    try {
      const token = await this.createJwt(this.credentials);
      const accessToken = await this.exchangeJwtForToken(token, this.credentials.token_uri);
      
      this.token = accessToken.access_token;
      this.tokenExpiry = Date.now() + (accessToken.expires_in * 1000);
      
      // Update local storage fallback for legacy components
      localStorage.setItem('gcloud_access_token', this.token || '');
      
      logger.success("AuthService", "Token refreshed successfully");
      return this.token!;
    } catch (error: any) {
      logger.error("AuthService", "Token refresh failed", error);
      throw error;
    }
  }

  // --- Private Helpers for Web Crypto JWT ---

  private async createJwt(creds: ServiceAccountCreds): Promise<string> {
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claimSet = {
      iss: creds.client_email,
      scope: SCOPES.join(' '),
      aud: creds.token_uri,
      exp: now + 3600,
      iat: now,
    };

    const encodedHeader = this.base64url(JSON.stringify(header));
    const encodedClaimSet = this.base64url(JSON.stringify(claimSet));
    const unsignedToken = `${encodedHeader}.${encodedClaimSet}`;

    const signature = await this.sign(unsignedToken, creds.private_key);
    return `${unsignedToken}.${signature}`;
  }

  private async sign(data: string, privateKeyPem: string): Promise<string> {
    // 1. Parse PEM to binary
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = privateKeyPem
      .replace(pemHeader, "")
      .replace(pemFooter, "")
      .replace(/\s/g, "");
    
    const binaryDerString = window.atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    // 2. Import Key
    const key = await window.crypto.subtle.importKey(
      "pkcs8",
      binaryDer.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // 3. Sign
    const encoder = new TextEncoder();
    const signature = await window.crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      encoder.encode(data)
    );

    // 4. Convert signature to Base64Url
    return this.arrayBufferToBase64Url(signature);
  }

  private async exchangeJwtForToken(jwt: string, tokenUri: string) {
    const params = new URLSearchParams();
    params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    params.append('assertion', jwt);

    const response = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error_description || "OAuth token exchange failed");
    }

    return response.json();
  }

  private base64url(source: string): string {
    return btoa(source).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  private arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return this.base64url(binary);
  }
}

export const authService = new AuthService();
