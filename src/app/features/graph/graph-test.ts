// src/app/features/graph-test/graph-test.component.ts

import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MusicApi } from '../../core/services/music-api';
import { SongCollection } from '../../core/services/song-collection';
import { GraphLayout } from '../../core/services/graph-layout';
import { GraphNode, Song } from '../../core/models/models';

@Component({
  selector: 'app-graph-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './graph-test.html',
  styleUrl: './graph-test.scss'
})
export class GraphTestComponent {
  // === SERVICES ===
  private readonly musicApi = inject(MusicApi);
  private readonly songCollection = inject(SongCollection);
  private readonly graphLayout = inject(GraphLayout);

  // === STATE (Signals) ===
  readonly searchQuery = signal('');
  readonly searchResults = signal<Song[]>([]);
  readonly isSearching = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // === COMPUTED ===
  readonly allSongs = this.songCollection.allSongs;
  readonly songCount = this.songCollection.songCount;
  readonly allGenres = this.songCollection.allGenres;
  readonly connectionStats = this.songCollection.connectionStats;

  readonly hasResults = computed(() => this.searchResults().length > 0);
  readonly hasSongs = computed(() => this.songCount() > 0);

  // === METHODS ===

  /**
   * Cerca canzoni su Spotify
   */
  onSearch(): void {
    const query = this.searchQuery().trim();
    
    if (!query) {
      this.errorMessage.set('Please enter a search query');
      return;
    }

    this.isSearching.set(true);
    this.errorMessage.set(null);

    this.musicApi.searchTracks(query, 10).subscribe({
      next: (results) => {
        this.searchResults.set(results);
        this.isSearching.set(false);
        
        if (results.length === 0) {
          this.errorMessage.set('No results found');
        }
      },
      error: (error) => {
        console.error('Search failed:', error);
        this.errorMessage.set('Search failed. Please try again.');
        this.isSearching.set(false);
      }
    });
  }

  /**
   * Aggiunge una canzone alla collezione
   */
  onAddSong(song: Song): void {
    const added = this.songCollection.addSong(song);
    
    if (added) {
      console.log(`✅ Added: ${song.title}`);
      // Opzionale: rimuovi dai risultati
      this.searchResults.update(results => 
        results.filter(s => s.id !== song.id)
      );
    } else {
      alert('Song already in collection!');
    }
  }

  /**
   * Rimuove una canzone dalla collezione
   */
  onRemoveSong(songId: string): void {
    this.songCollection.removeSong(songId);
  }

  /**
   * Pulisce tutta la collezione
   */
  onClearAll(): void {
    if (confirm('Remove all songs?')) {
      this.songCollection.clearAll();
      this.searchResults.set([]);
    }
  }

  /**
   * Ottiene canzoni connesse per visualizzazione
   */
  getConnectedSongs(songId: string): Song[] {
    return this.songCollection.getConnectedSongs(songId);
  }

  /**
   * Calcola layout (test senza visualizzazione)
   */
  onCalculateLayout(): void {
    const nodes = this.songCollection.exportGraphNodes();
    
    if (nodes.length === 0) {
      alert('Add some songs first!');
      return;
    }

    const positioned = this.graphLayout.calculatePositions(nodes, 800, 600);
    
    console.log('📊 Layout calculated:');
    positioned.forEach((node: GraphNode) => {
      console.log(`${node.song.title}: (${node.x.toFixed(1)}, ${node.y.toFixed(1)})`);
    });
    
    alert(`Layout calculated! Check console for positions.`);
  }

  /**
   * Pulisce la ricerca
   */
  onClearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.errorMessage.set(null);
  }
}

