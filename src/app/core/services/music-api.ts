import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { SpotifyAuthService } from './spotify-auth';
import { Song } from '../models/models';

// === SPOTIFY API INTERFACES ===
interface SpotifyArtist {
  id: string;
  name: string;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
    total: number;
  };
}

interface SpotifyArtistResponse {
  id: string;
  name: string;
  genres: string[];
}

// === SERVICE ===
@Injectable({
  providedIn: 'root',
})
export class MusicApi {
  private readonly http = inject(HttpClient);
  private readonly spotifyAuth = inject(SpotifyAuthService);
  private readonly API_BASE = 'https://api.spotify.com/v1';

  /**
   * Cerca tracce su Spotify E popola i generi da TUTTI gli artisti
   * Pattern: Search Track → Get ALL Artists → Merge Genres
   * 
   * @param query Testo ricerca (es. "Bohemian Rhapsody")
   * @param limit Max risultati (default: 5)
   * @returns Observable<Song[]> con generi popolati da tutti gli artisti
   * 
   * Uso:
   * musicApi.searchTracks('Pink Floyd').subscribe(songs => {
   *   songs.forEach(s => console.log(s.title, s.genres));
   * });
   */
  searchTracks(query: string, limit: number = 5): Observable<Song[]> {
    return this.spotifyAuth.authenticate().pipe(
      switchMap(() => {
        const params = new HttpParams()
          .set('q', query)
          .set('type', 'track')
          .set('limit', limit.toString())
          .set('market', 'IT');

        return this.http
          .get<SpotifySearchResponse>(`${this.API_BASE}/search`, { params })
          .pipe(
            switchMap((response) => {
              const tracks = response.tracks.items;
              
              if (tracks.length === 0) {
                return of([]);
              }

              // Per ogni track, fetch genres di TUTTI gli artisti
              const songObservables = tracks.map((track) =>
                this.enrichTrackWithGenres(track)
              );

              // forkJoin aspetta che TUTTE le richieste completino
              return forkJoin(songObservables);
            }),
            catchError((error) => {
              console.error('Search failed:', error);
              return of([]);
            })
          );
      })
    );
  }

  /**
   * Ottiene dettagli completi di una traccia + generi di tutti gli artisti
   * @param trackId Spotify track ID
   * @returns Observable<Song> con generi popolati
   */
  getTrackWithGenres(trackId: string): Observable<Song | null> {
    return this.spotifyAuth.authenticate().pipe(
      switchMap(() =>
        this.http.get<SpotifyTrack>(`${this.API_BASE}/tracks/${trackId}`).pipe(
          switchMap((track) => this.enrichTrackWithGenres(track)),
          catchError((error) => {
            console.error(`Failed to get track ${trackId}:`, error);
            return of(null);
          })
        )
      )
    );
  }

  /**
   * Ottiene generi di un artista
   * @param artistId Spotify artist ID
   * @returns Observable<string[]> array di generi
   */
  getArtistGenres(artistId: string): Observable<string[]> {
    return this.spotifyAuth.authenticate().pipe(
      switchMap(() =>
        this.http
          .get<SpotifyArtistResponse>(`${this.API_BASE}/artists/${artistId}`)
          .pipe(
            map((artist) => artist.genres),
            catchError((error) => {
              console.warn(`Failed to get genres for artist ${artistId}:`, error);
              return of(['unknown']); // Fallback
            })
          )
      )
    );
  }

  // === PRIVATE HELPERS ===

  /**
   * Arricchisce una SpotifyTrack con i generi di TUTTI i suoi artisti
   * Pattern: Track → Fetch ALL Artists Genres → Merge → Song
   */
  private enrichTrackWithGenres(track: SpotifyTrack): Observable<Song> {
    // Estrai IDs di TUTTI gli artisti
    const artistIds = track.artists.map((a) => a.id);
    
    // Crea Observable per ogni artista
    const genreObservables = artistIds.map((id) => this.getArtistGenres(id));

    // forkJoin: aspetta che tutti completino
    return forkJoin(genreObservables).pipe(
      map((genresArrays) => {
        // Set rimuove duplicati: ['pop', 'rock', 'metal', 'alternative']
        const allGenres = [...new Set(genresArrays.flat())];
        
        // Artista principale (primo della lista)
        const primaryArtist = track.artists[0];
        
        // Se collaborazione, concatena tutti i nomi
        const artistName = track.artists.length > 1
          ? track.artists.map((a) => a.name).join(', ')
          : primaryArtist.name;

        return {
          id: track.id,
          title: track.name,
          artist: artistName,
          artistId: primaryArtist.id,
          genres: allGenres.length > 0 ? allGenres : ['unknown'],
          addedAt: new Date(),
        };
      })
    );
  }
}