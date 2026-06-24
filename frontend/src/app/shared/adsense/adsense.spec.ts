import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Adsense, ADSENSE_CLIENT } from './adsense';

interface AdsByGoogleWindow {
  adsbygoogle?: { push: (config: object) => void };
}

function adsWindow(): AdsByGoogleWindow {
  return window as unknown as AdsByGoogleWindow;
}

function create(options: {
  slot?: string;
  client?: string;
  platform?: 'browser' | 'server';
} = {}) {
  TestBed.configureTestingModule({
    imports: [Adsense],
    providers: [
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
      ...(options.client
        ? [{ provide: ADSENSE_CLIENT, useValue: options.client }]
        : []),
    ],
  });

  const fixture = TestBed.createComponent(Adsense);
  fixture.componentRef.setInput('slot', options.slot ?? '1234567890');
  return fixture;
}

describe('Adsense', () => {
  afterEach(() => {
    delete adsWindow().adsbygoogle;
  });

  it('renderar en adsbygoogle-annonsenhet med utgivar- och slot-id', async () => {
    const fixture = create({ slot: '999', client: 'ca-pub-42' });
    await fixture.whenStable();

    const ins = (fixture.nativeElement as HTMLElement).querySelector(
      'ins.adsbygoogle',
    );
    expect(ins).not.toBeNull();
    expect(ins?.getAttribute('data-ad-client')).toBe('ca-pub-42');
    expect(ins?.getAttribute('data-ad-slot')).toBe('999');
  });

  it('begär en annons från adsbygoogle i webbläsaren', async () => {
    const push = vi.fn();
    adsWindow().adsbygoogle = { push };

    const fixture = create({ platform: 'browser' });
    await fixture.whenStable();

    expect(push).toHaveBeenCalledTimes(1);
  });

  it('rör inte adsbygoogle under server-rendering (SSR)', async () => {
    const push = vi.fn();
    adsWindow().adsbygoogle = { push };

    const fixture = create({ platform: 'server' });
    await fixture.whenStable();

    expect(push).not.toHaveBeenCalled();
  });
});
