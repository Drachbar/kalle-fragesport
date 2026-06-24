import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';

/** Googles CMP (Funding Choices) exponerar detta på window när scriptet laddats. */
interface GoogleFcWindow {
  googlefc?: { showRevocationMessage?: () => void };
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected logout(): void {
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/login'));
  }

  /**
   * Öppnar Googles samtyckesruta igen så att besökaren kan ändra eller återkalla
   * sitt annonssamtycke. `googlefc` finns bara i webbläsaren, och först efter att
   * AdSense-/CMP-scriptet hunnit ladda – därför guard:ar vi mot båda fallen.
   */
  protected manageAdConsent(): void {
    if (!this.isBrowser) {
      return;
    }
    const fc = (window as GoogleFcWindow).googlefc;
    fc?.showRevocationMessage?.();
  }
}
