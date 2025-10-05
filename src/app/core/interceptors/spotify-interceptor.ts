import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SpotifyAuthService } from '../services/spotify-auth';


export const spotifyAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(SpotifyAuthService);
  
  if (req.url.includes('api.spotify.com')) {

    const token = authService.accessToken();
    if (token) {
      // Clone request e aggiungi Authorization header
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      
      return next(authReq);
    }
  }
  
  // Passa attraverso richieste non-Spotify
  return next(req);
};