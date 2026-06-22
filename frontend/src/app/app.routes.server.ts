import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Auth-beroende/dynamiska sidor renderas i klienten (cookie + auth-state
  // finns inte under server-rendering, och :id-routen går inte att prerendra).
  { path: 'questions', renderMode: RenderMode.Client },
  { path: 'questions/**', renderMode: RenderMode.Client },
  // Renderas per request på servern så att frågan finns i HTML:en (SEO).
  // Startsidan slumpar fram en fråga, /quiz/:id visar en specifik.
  { path: '', renderMode: RenderMode.Server },
  { path: 'quiz/:id', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Prerender },
];
