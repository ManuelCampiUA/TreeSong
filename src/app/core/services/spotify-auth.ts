import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface TokenState {
  token: string | null;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class SpotifyAuthService {
  // TODO: Sposta in environment.ts per produzione
  private readonly clientId = '340269fff4204fa39b7dec7f9f3b6e2f';
  private readonly clientSecret = 'f9a82a403ff04771890833763306a6d1';
  private readonly TOKEN_URL = 'https://accounts.spotify.com/api/token';

  // Singolo signal per lo stato del token (più efficiente)
  private readonly tokenState = signal<TokenState>({
    token: null,
    expiresAt: 0,
  });

  // Computed signals (auto-aggiornati quando tokenState cambia)
  readonly accessToken = computed(() => this.tokenState().token);
  readonly isAuthenticated = computed(() => this.isTokenValid());
  readonly tokenExpiresIn = computed(() => {
    const expiresAt = this.tokenState().expiresAt;
    if (expiresAt === 0) return 0;
    return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  });

  constructor(private http: HttpClient) {}

  /**
   * Autentica con Spotify usando Client Credentials Flow
   * @returns Observable che emette il token o errore
   */
  authenticate(): Observable<string> {
    // Se token valido, restituiscilo immediatamente
    if (this.isTokenValid()) {
      return of(this.accessToken()!);
    }

    // Altrimenti richiedi nuovo token
    return this.requestNewToken();
  }

    /**
   * Verifica se il token è ancora valido
   * Usa buffer di 60 secondi per evitare race conditions
   */
  private isTokenValid(): boolean {
    const { token, expiresAt } = this.tokenState();
    const BUFFER_TIME = 60 * 1000; // 60 secondi
    
    return token !== null && Date.now() < expiresAt - BUFFER_TIME;
  }

  /**
   * Forza refresh del token (anche se ancora valido)
   */
  forceRefresh(): Observable<string> {
    return this.requestNewToken();
  }

  /**
   * Richiede un nuovo token a Spotify
   * Pattern: HTTP request → RxJS operators → Signal update
   */
  private requestNewToken(): Observable<string> {
    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    });

    const body = 'grant_type=client_credentials';

    return this.http
      .post<SpotifyTokenResponse>(this.TOKEN_URL, body, { headers })
      .pipe(
        // tap: side-effect per aggiornare lo state
        tap((response) => {
          const expiresAt = Date.now() + response.expires_in * 1000;
          
          // Aggiorna il signal (trigger computed signals)
          this.tokenState.set({
            token: response.access_token,
            expiresAt,
          });

          console.log(`Spotify auth success. Expires in ${response.expires_in}s`);
        }),

        // Trasforma response in semplice string (il token)
        switchMap((response) => of(response.access_token)),

        // Error handling: logga e ri-emetti errore
        catchError((error) => {
          console.error('❌ Spotify auth failed:', error);
          
          // Reset state su errore
          this.tokenState.set({ token: null, expiresAt: 0 });
          
          // Ri-lancia errore per chi chiama authenticate()
          return throwError(() => new Error('Spotify authentication failed'));
        })
      );
  }

  /**
   * Logout/clear token (opzionale, per future feature)
   */
  clearAuth(): void {
    this.tokenState.set({ token: null, expiresAt: 0 });
    console.log('🔓 Auth cleared');
  }
}