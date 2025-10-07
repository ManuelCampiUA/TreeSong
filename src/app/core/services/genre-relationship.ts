import { Injectable } from '@angular/core';

/**
 * Service per calcolare relazioni tra generi musicali
 * Pattern: Partial word matching semplificato
 */
@Injectable({
  providedIn: 'root'
})
export class GenreRelationship {
  
  /**
   * Verifica se due generi hanno match parziale
   * 
   * @param genre1 Primo genere (es. "indie rock")
   * @param genre2 Secondo genere (es. "rock")
   * @returns true se almeno una parola è contenuta nell'altra
   */
  hasMatch(genre1: string, genre2: string): boolean {
    const words1 = genre1.toLowerCase();
    const words2 = genre2.toLowerCase();

    return words1.includes(words2) || words2.includes(words1);
  }

  /**
   * Calcola quante parole hanno in comune due generi
   * 
   * @param genre1 Primo genere
   * @param genre2 Secondo genere
   * @returns Numero di parole in comune (per future feature di "peso")
   */
  getMatchScore(genre1: string, genre2: string): number {
    const words1 = genre1.toLowerCase().split(' ');
    const words2 = genre2.toLowerCase().split(' ');

    let score = 0;
    words1.forEach(word1 => {
      words2.forEach(word2 => {
        if (word1.includes(word2) || word2.includes(word1)) {
          score++;
        }
      });
    });

    return score;
  }

  /**
   * Trova tutti i generi compatibili da una lista
   * 
   * @param targetGenres Generi della canzone target
   * @param allGenres Lista di tutti i generi disponibili
   * @returns Array di generi che matchano
   */
  findCompatibleGenres(targetGenres: string[], allGenres: string[]): string[] {
    return allGenres.filter(genre => 
      targetGenres.some(targetGenre => 
        this.hasMatch(targetGenre, genre)
      )
    );
  }

  /**
   * Verifica se due array di generi hanno ALMENO un match
   * (Usato per collegare due canzoni)
   * 
   * @param genres1 Generi della canzone 1
   * @param genres2 Generi della canzone 2
   * @returns true se esiste almeno un match tra i due array
   */
  areCompatible(genres1: string[], genres2: string[]): boolean {
    return genres1.some(g1 => 
      genres2.some(g2 => 
        this.hasMatch(g1, g2)
      )
    );
  }
}