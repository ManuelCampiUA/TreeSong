import { Injectable, signal, computed, inject } from '@angular/core';
import { Song, GraphNode } from '../models/models';
import { GenreRelationship } from './genre-relationship';

/**
 * Service per gestire la collezione di canzoni e i loro collegamenti
 */
@Injectable({
  providedIn: 'root'
})
export class SongCollection {
  private readonly genreService = inject(GenreRelationship);

  // === STATE (Signals) ===
  
  /**
   * Collezione di tutte le canzoni aggiunte
   * Chiave: song.id, Valore: Song
   */
  private readonly songs = signal<Map<string, Song>>(new Map());

  /**
   * Mappa delle connessioni tra canzoni
   * Chiave: songId, Valore: Set di songIds connessi
   * 
   * Esempio:
   * {
   *   "song1": Set(["song2", "song3"]),
   *   "song2": Set(["song1"]),
   *   "song3": Set(["song1"])
   * }
   */
  private readonly connections = signal<Map<string, Set<string>>>(new Map());

  // === COMPUTED SIGNALS (Auto-aggiornati) ===

  /**
   * Array di tutte le canzoni (per iterazione facile)
   */
  readonly allSongs = computed(() => 
    Array.from(this.songs().values())
  );

  /**
   * Numero totale di canzoni
   */
  readonly songCount = computed(() => this.songs().size);

  /**
   * Tutti i generi unici presenti nella collezione
   */
  readonly allGenres = computed(() => {
    const genreSet = new Set<string>();
    this.allSongs().forEach(song => {
      song.genres.forEach(genre => genreSet.add(genre));
    });
    return Array.from(genreSet).sort();
  });

  /**
   * Statistiche sui collegamenti
   */
  readonly connectionStats = computed(() => {
    const connMap = this.connections();
    let totalConnections = 0;
    
    connMap.forEach(connSet => {
      totalConnections += connSet.size;
    });

    return {
      totalConnections: totalConnections / 2, // Diviso 2 perché ogni conn è bidirezionale
      avgConnectionsPerSong: this.songCount() > 0 
        ? (totalConnections / this.songCount()).toFixed(2) 
        : '0'
    };
  });

  // === PUBLIC METHODS ===

  /**
   * Aggiunge una canzone alla collezione e calcola i collegamenti
   * 
   * @param song Canzone da aggiungere
   * @returns true se aggiunta, false se già esistente
   */
  addSong(song: Song): boolean {
    // Previeni duplicati
    if (this.songs().has(song.id)) {
      console.warn(`Song ${song.id} already exists`);
      return false;
    }

    // Aggiungi canzone
    this.songs.update(map => {
      const newMap = new Map(map);
      newMap.set(song.id, song);
      return newMap;
    });

    // Calcola e aggiungi collegamenti con canzoni esistenti
    this.updateConnectionsForSong(song.id);

    console.log(`✅ Added "${song.title}" by ${song.artist}`);
    return true;
  }

  /**
   * Rimuove una canzone e tutti i suoi collegamenti
   * 
   * @param songId ID della canzone da rimuovere
   * @returns true se rimossa, false se non trovata
   */
  removeSong(songId: string): boolean {
    if (!this.songs().has(songId)) {
      return false;
    }

    // Rimuovi canzone
    this.songs.update(map => {
      const newMap = new Map(map);
      newMap.delete(songId);
      return newMap;
    });

    // Rimuovi tutti i collegamenti
    this.removeAllConnectionsForSong(songId);

    return true;
  }

  /**
   * Ottiene una canzone per ID
   */
  getSong(songId: string): Song | undefined {
    return this.songs().get(songId);
  }

  /**
   * Ottiene tutte le canzoni connesse a una specifica canzone
   * 
   * @param songId ID della canzone
   * @returns Array di canzoni connesse
   */
  getConnectedSongs(songId: string): Song[] {
    const connectedIds = this.connections().get(songId);
    if (!connectedIds) return [];

    return Array.from(connectedIds)
      .map(id => this.getSong(id))
      .filter((song): song is Song => song !== undefined);
  }

  /**
   * Verifica se due canzoni sono connesse
   */
  areConnected(songId1: string, songId2: string): boolean {
    const connections1 = this.connections().get(songId1);
    return connections1?.has(songId2) ?? false;
  }

  /**
   * Pulisce tutta la collezione
   */
  clearAll(): void {
    this.songs.set(new Map());
    this.connections.set(new Map());
  }

  /**
   * Esporta i dati per GraphLayout (formato GraphNode[])
   */
  exportGraphNodes(): GraphNode[] {
    return this.allSongs().map(song => ({
      id: song.id,
      song: song,
      x: 0, // Sarà calcolato da GraphLayout
      y: 0,
      connections: Array.from(this.connections().get(song.id) || [])
    }));
  }

  // === PRIVATE METHODS ===

  /**
   * Calcola e aggiorna i collegamenti per una canzone specifica
   * Confronta con TUTTE le altre canzoni nella collezione
   */
  private updateConnectionsForSong(newSongId: string): void {
    const newSong = this.getSong(newSongId);
    if (!newSong) return;

    const newConnections = new Set<string>();

    // Confronta con ogni altra canzone
    this.allSongs().forEach(existingSong => {
      // Skip se è la stessa canzone
      if (existingSong.id === newSongId) return;

      // Verifica compatibilità generi
      if (this.genreService.areCompatible(newSong.genres, existingSong.genres)) {
        // Aggiungi connessione bidirezionale
        newConnections.add(existingSong.id);
        this.addConnection(existingSong.id, newSongId);
      }
    });

    // Salva connessioni per la nuova canzone
    if (newConnections.size > 0) {
      this.connections.update(map => {
        const newMap = new Map(map);
        newMap.set(newSongId, newConnections);
        return newMap;
      });
    }
  }

  /**
   * Aggiunge una connessione unidirezionale
   */
  private addConnection(fromId: string, toId: string): void {
    this.connections.update(map => {
      const newMap = new Map(map);
      const existing = newMap.get(fromId) || new Set();
      existing.add(toId);
      newMap.set(fromId, existing);
      return newMap;
    });
  }

  /**
   * Rimuove tutte le connessioni di una canzone
   */
  private removeAllConnectionsForSong(songId: string): void {
    this.connections.update(map => {
      const newMap = new Map(map);
      
      // Rimuovi la entry della canzone
      newMap.delete(songId);
      
      // Rimuovi riferimenti in altre canzoni
      newMap.forEach((connSet, id) => {
        connSet.delete(songId);
      });
      
      return newMap;
    });
  }
}