import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

@Injectable({
  providedIn: 'root',
})
export class SpotifyAuthService {
  // TODO: Sposta in environment per produzione
  private readonly clientId = '340269fff4204fa39b7dec7f9f3b6e2f';
  private readonly clientSecret = 'f9a82a403ff04771890833763306a6d1';

  // State
  readonly accessToken = signal<string | null>(null);
  readonly isAuthenticated = signal<boolean>(false);

  private tokenExpiry: number = 0;

  constructor(private http: HttpClient) {}

  async authenticate(): Promise<void> {
    // Skip se token ancora valido
    if (this.isTokenValid()) {
      return;
    }

    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    });

    const body = 'grant_type=client_credentials';

    try {
      const response = await this.http
        .post<SpotifyTokenResponse>('https://accounts.spotify.com/api/token', body, { headers })
        .toPromise();

      if (response) {
        this.accessToken.set(response.access_token);
        this.isAuthenticated.set(true);

        // Salva expiry (expires_in è in secondi)
        this.tokenExpiry = Date.now() + response.expires_in * 1000;
      }
    } catch (error) {
      console.error('Spotify auth failed:', error);
      this.isAuthenticated.set(false);
      throw error;
    }
  }

  private isTokenValid(): boolean {
    return this.accessToken() !== null && Date.now() < this.tokenExpiry;
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.accessToken();
    if (!token) {
      throw new Error('No access token. Call authenticate() first.');
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }
}
