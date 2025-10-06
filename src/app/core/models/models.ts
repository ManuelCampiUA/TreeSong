
export interface Song {
    id: string;
    title: string;
    artist: string;
    genres: string[];
    subgenre?: string;
    addedAt: Date;
}

export interface GraphNode {
    id: string;
    song: Song;
    x: number;
    y: number;
    connections?: string[] // sarà a connesso agli id di altri nodi
}

export interface GenreMapping {
    primary : string;
    related: string[];
    weight: number;
}