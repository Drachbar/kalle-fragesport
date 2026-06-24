import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  PLATFORM_ID,
  afterNextRender,
  inject,
  input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * AdSense-utgivar-id (ca-pub-…). Platshållare som default – sätt ditt riktiga id
 * här (eller override:a token:en) och använd samma id i `src/index.html`-scriptet.
 */
export const ADSENSE_CLIENT = new InjectionToken<string>('ADSENSE_CLIENT', {
  providedIn: 'root',
  factory: () => 'ca-pub-7100980009092894',
});

interface AdsByGoogleWindow {
  adsbygoogle?: unknown[];
}

/**
 * En enskild AdSense-annonsenhet (`<ins class="adsbygoogle">`).
 *
 * Annonsförfrågan (`adsbygoogle.push`) görs bara i webbläsaren – `adsbygoogle`
 * finns inte i Node under SSR. `ngSkipHydration` gör att Angular inte försöker
 * hydrera den DOM som AdSense injicerar i `<ins>`:en (undviker krockar).
 */
@Component({
  selector: 'app-adsense',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './adsense.html',
  styleUrl: './adsense.css',
  host: { ngSkipHydration: 'true' },
})
export class Adsense {
  /**
   * Annons-slot-id från AdSense (per annonsenhet). Tomt = ingen enhet renderas
   * (t.ex. innan kontot godkänts och slot-id finns), så ingen tom ruta visas.
   */
  readonly slot = input<string>('');

  protected readonly client = inject(ADSENSE_CLIENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    if (this.isBrowser) {
      // afterNextRender körs enbart i webbläsaren, efter att `<ins>`:en finns i
      // DOM:en, vilket är precis vad AdSense behöver för att fylla annonsen.
      afterNextRender(() => {
        if (!this.slot()) {
          return;
        }
        const win = window as unknown as AdsByGoogleWindow;
        (win.adsbygoogle = win.adsbygoogle ?? []).push({});
      });
    }
  }
}
