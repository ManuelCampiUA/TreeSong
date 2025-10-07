import { Injectable, signal } from '@angular/core';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { GraphNode } from '../models/models';

/**
 * Service per calcolare posizioni dei nodi con ForceAtlas2
 * Pattern: Force-directed layout con physics simulation
 */
@Injectable({
  providedIn: 'root'
})
 class GraphLayout {
  
  // Configurazione algoritmo (tweakable per effetti diversi)
  private readonly layoutSettings = {
    iterations: 500,           // Numero di iterazioni (più = più stabile)
    settings: {
      gravity: 1,              // Attrazione verso il centro (0-10)
      scalingRatio: 10,        // Forza di repulsione tra nodi
      strongGravityMode: false,// Gravità più forte al centro
      barnesHutOptimize: true, // Ottimizzazione performance
      barnesHutTheta: 0.5,     // Precisione ottimizzazione
      slowDown: 1,             // Velocità convergenza (1 = normale)
      linLogMode: false,       // Modalità logaritmica
      edgeWeightInfluence: 1   // Peso delle connessioni (0-1)
    }
  };

  // Signal per tracciare se layout è in corso
  readonly isCalculating = signal(false);

  /**
   * Calcola posizioni per un array di GraphNode
   * 
   * @param nodes Array di nodi con connessioni
   * @param canvasWidth Larghezza canvas (per scalare posizioni)
   * @param canvasHeight Altezza canvas
   * @returns Array di nodi con x,y calcolati
   * 
   * Uso:
   * const positioned = graphLayout.calculatePositions(nodes, 800, 600);
   * positioned.forEach(node => {
   *   console.log(`${node.song.title} at (${node.x}, ${node.y})`);
   * });
   */
  calculatePositions(
    nodes: GraphNode[], 
    canvasWidth: number = 800, 
    canvasHeight: number = 600
  ): GraphNode[] {
    
    if (nodes.length === 0) {
      return [];
    }

    this.isCalculating.set(true);

    try {
      // 1. Crea grafo Graphology
      const graph = this.buildGraph(nodes);

      // 2. Applica ForceAtlas2
      forceAtlas2.assign(graph, this.layoutSettings);

      // 3. Estrai posizioni e scala al canvas
      const positioned = this.extractPositions(graph, nodes, canvasWidth, canvasHeight);

      console.log(`✅ Layout calculated for ${nodes.length} nodes`);
      
      return positioned;

    } catch (error) {
      console.error('❌ Layout calculation failed:', error);
      // Fallback: posizioni casuali
      return this.fallbackRandomLayout(nodes, canvasWidth, canvasHeight);
      
    } finally {
      this.isCalculating.set(false);
    }
  }

  /**
   * Calcola posizioni con animazione step-by-step (per effetto "live")
   * 
   * @param nodes Array di nodi
   * @param canvasWidth Larghezza canvas
   * @param canvasHeight Altezza canvas
   * @param onStep Callback chiamata ad ogni step con posizioni aggiornate
   * @param steps Numero di step (default: 50)
   * 
   * Uso:
   * graphLayout.calculateAnimated(nodes, 800, 600, 
   *   (positions) => {
   *     // Aggiorna canvas ogni step
   *     this.renderNodes(positions);
   *   }
   * );
   */
  calculateAnimated(
    nodes: GraphNode[],
    canvasWidth: number,
    canvasHeight: number,
    onStep: (positions: GraphNode[]) => void,
    steps: number = 50
  ): void {
    
    if (nodes.length === 0) return;

    this.isCalculating.set(true);
    
    const graph = this.buildGraph(nodes);
    const iterationsPerStep = Math.ceil(this.layoutSettings.iterations / steps);

    let currentStep = 0;

    const animate = () => {
      // Calcola prossimo step
      forceAtlas2.assign(graph, {
        iterations: iterationsPerStep,
        settings: this.layoutSettings.settings
      });

      // Estrai posizioni correnti
      const currentPositions = this.extractPositions(
        graph, 
        nodes, 
        canvasWidth, 
        canvasHeight
      );

      // Notifica consumer
      onStep(currentPositions);

      currentStep++;

      // Continua animazione o termina
      if (currentStep < steps) {
        requestAnimationFrame(animate);
      } else {
        this.isCalculating.set(false);
        console.log('✅ Animated layout complete');
      }
    };

    // Avvia animazione
    requestAnimationFrame(animate);
  }

  /**
   * Aggiorna posizioni per nuovi nodi (incrementale)
   * Utile quando aggiungi 1 canzone senza ricalcolare tutto
   * 
   * @param existingNodes Nodi già posizionati
   * @param newNodes Nuovi nodi da posizionare
   * @param canvasWidth Larghezza canvas
   * @param canvasHeight Altezza canvas
   * @returns Tutti i nodi con nuove posizioni
   */
  updateWithNewNodes(
    existingNodes: GraphNode[],
    newNodes: GraphNode[],
    canvasWidth: number,
    canvasHeight: number
  ): GraphNode[] {
    
    // Combina tutti i nodi
    const allNodes = [...existingNodes, ...newNodes];
    
    // Ricalcola con meno iterazioni (più veloce)
    const quickSettings = {
      iterations: 100, // Meno iterazioni per update incrementale
      settings: this.layoutSettings.settings
    };

    const graph = this.buildGraph(allNodes);
    
    // Inizializza nodi esistenti con le loro posizioni attuali
    existingNodes.forEach(node => {
      graph.setNodeAttribute(node.id, 'x', node.x);
      graph.setNodeAttribute(node.id, 'y', node.y);
    });

    forceAtlas2.assign(graph, quickSettings);

    return this.extractPositions(graph, allNodes, canvasWidth, canvasHeight);
  }

  // === PRIVATE HELPERS ===

  /**
   * Costruisce un grafo Graphology dai nostri GraphNode
   */
  private buildGraph(nodes: GraphNode[]): Graph {
    const graph = new Graph({ type: 'undirected' });

    // Aggiungi tutti i nodi
    nodes.forEach(node => {
      graph.addNode(node.id, {
        label: node.song.title,
        size: 10
      });
    });

    // Aggiungi edges (connessioni)
    nodes.forEach(node => {
      node.connections?.forEach(targetId => {
        // Evita edge duplicati (grafo non diretto)
        if (!graph.hasEdge(node.id, targetId)) {
          try {
            graph.addEdge(node.id, targetId);
          } catch (e) {
            // Edge già esiste o nodo target non trovato
            console.warn(`Could not add edge ${node.id} -> ${targetId}`);
          }
        }
      });
    });

    return graph;
  }

  /**
   * Estrae posizioni dal grafo e scala al canvas
   */
  private extractPositions(
    graph: Graph,
    nodes: GraphNode[],
    width: number,
    height: number
  ): GraphNode[] {
    
    // Trova bounds del layout (min/max x,y)
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    graph.forEachNode((node, attrs) => {
      minX = Math.min(minX, attrs['x']);
      maxX = Math.max(maxX, attrs['x']);
      minY = Math.min(minY, attrs['y']);
      maxY = Math.max(maxY, attrs['y']);
    });

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    // Padding (margine dal bordo)
    const padding = 50;
    const usableWidth = width - 2 * padding;
    const usableHeight = height - 2 * padding;

    // Scala e centra ogni nodo
    return nodes.map(node => {
      const attrs = graph.getNodeAttributes(node.id);
      
      // Normalizza 0-1, poi scala al canvas
      const normalizedX = (attrs['x'] - minX) / rangeX;
      const normalizedY = (attrs['y'] - minY) / rangeY;

      return {
        ...node,
        x: padding + normalizedX * usableWidth,
        y: padding + normalizedY * usableHeight
      };
    });
  }

  /**
   * Fallback: posizioni casuali se ForceAtlas2 fallisce
   */
  private fallbackRandomLayout(
    nodes: GraphNode[],
    width: number,
    height: number
  ): GraphNode[] {
    console.warn('⚠️ Using random fallback layout');
    
    const padding = 50;
    
    return nodes.map(node => ({
      ...node,
      x: padding + Math.random() * (width - 2 * padding),
      y: padding + Math.random() * (height - 2 * padding)
    }));
  }
}


// Export per uso esterno
export { GraphLayout };