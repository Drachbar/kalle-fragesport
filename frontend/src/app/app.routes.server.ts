import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Auth-beroende/dynamiska sidor renderas i klienten (cookie + auth-state
  // finns inte under server-rendering, och :id-routen går inte att prerendra).
  { path: 'questions', renderMode: RenderMode.Client },
  { path: 'questions/**', renderMode: RenderMode.Client },
  // :id går inte att prerendra (känns inte vid byggtid) – rendera i klienten.
  { path: 'quiz/:id', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
