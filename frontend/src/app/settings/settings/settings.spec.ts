import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Settings } from './settings';
import {
  SettingsService,
  type OpenAiKeyStatus,
} from '../settings.service';

function setup(status: OpenAiKeyStatus) {
  const service = {
    getOpenAiKeyStatus: vi.fn(() => of(status)),
    saveOpenAiKey: vi.fn(() => of(void 0)),
    deleteOpenAiKey: vi.fn(() => of(void 0)),
  };

  TestBed.configureTestingModule({
    imports: [Settings],
    providers: [{ provide: SettingsService, useValue: service }],
  });

  const fixture = TestBed.createComponent(Settings);
  fixture.detectChanges();
  return { fixture, service };
}

describe('Settings', () => {
  it('hämtar status vid init', () => {
    const { service } = setup({ envKeyPresent: false, userKeySet: false });
    expect(service.getOpenAiKeyStatus).toHaveBeenCalledOnce();
  });

  it('visar info om en delad env-nyckel finns', () => {
    const { fixture } = setup({ envKeyPresent: true, userKeySet: false });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('delad');
    // Inget formulär behövs när env-nyckeln redan används.
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('visar formulär när ingen env-nyckel finns', () => {
    const { fixture } = setup({ envKeyPresent: false, userKeySet: false });
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
  });

  it('sparar inte en ogiltig nyckel', () => {
    const { fixture, service } = setup({
      envKeyPresent: false,
      userKeySet: false,
    });
    const component = fixture.componentInstance as unknown as {
      form: { setValue: (v: { apiKey: string }) => void };
      save: () => void;
    };
    component.form.setValue({ apiKey: 'inte-en-nyckel' });
    component.save();

    expect(service.saveOpenAiKey).not.toHaveBeenCalled();
  });

  it('sparar en giltig nyckel och markerar att den är sparad', () => {
    const { fixture, service } = setup({
      envKeyPresent: false,
      userKeySet: false,
    });
    const component = fixture.componentInstance as unknown as {
      form: { setValue: (v: { apiKey: string }) => void };
      save: () => void;
      status: () => OpenAiKeyStatus | null;
    };
    component.form.setValue({ apiKey: 'sk-min-hemliga-nyckel' });
    component.save();

    expect(service.saveOpenAiKey).toHaveBeenCalledWith('sk-min-hemliga-nyckel');
    expect(component.status()?.userKeySet).toBe(true);
  });

  it('tar bort en sparad nyckel', () => {
    const { fixture, service } = setup({
      envKeyPresent: false,
      userKeySet: true,
    });
    const component = fixture.componentInstance as unknown as {
      remove: () => void;
      status: () => OpenAiKeyStatus | null;
    };
    component.remove();

    expect(service.deleteOpenAiKey).toHaveBeenCalledOnce();
    expect(component.status()?.userKeySet).toBe(false);
  });
});
