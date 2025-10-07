// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/graph/graph-test')
      .then(m => m.GraphTestComponent)
  }
];