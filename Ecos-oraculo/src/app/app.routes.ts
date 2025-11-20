import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'bienvenida',
    pathMatch: 'full',
  },

  {
    path: 'bienvenida',
    loadComponent: () =>
      import('./components/bienvenida/bienvenida.component').then(
        (m) => m.BienvenidaComponent
      ),
  },

  {
    path: 'significado-sueños',
    loadComponent: () =>
      import(
        './components/significado-suenos/significado-suenos.component'
      ).then((m) => m.SignificadoSuenosComponent),
  },

  {
    path: 'Informacion-zodiaco',
    loadComponent: () =>
      import(
        './components/informacion-zodiaco/informacion-zodiaco.component'
      ).then((m) => m.InformacionZodiacoComponent),
  },

  {
    path: 'lectura-numerologia',
    loadComponent: () =>
      import(
        './components/lectura-numerologia/lectura-numerologia.component'
      ).then((m) => m.LecturaNumerologiaComponent),
  },

  {
    path: 'mapa-vocacional',
    loadComponent: () =>
      import('./components/mapa-vocacional/mapa-vocacional.component').then(
        (m) => m.MapaVocacionalComponent
      ),
  },

  {
    path: 'animal-interior',
    loadComponent: () =>
      import('./components/animal-interior/animal-interior.component').then(
        (m) => m.AnimalInteriorComponent
      ),
  },

  {
    path: 'tabla-nacimiento',
    loadComponent: () =>
      import('./components/tabla-nacimiento/tabla-nacimiento.component').then(
        (m) => m.TablaNacimientoComponent
      ),
  },

  {
    path: 'horoscopo',
    loadComponent: () =>
      import('./components/zodiaco-chino/zodiaco-chino.component').then(
        (m) => m.ZodiacoChinoComponent
      ),
  },

  {
    path: 'calculadora-amor',
    loadComponent: () =>
      import('./components/calculadora-amor/calculadora-amor.component').then(
        (m) => m.CalculadoraAmorComponent
      ),
  },

  {
    path: 'lectura-oraculo',
    loadComponent: () =>
      import('./components/tarot/welcome/welcome.component').then(
        (m) => m.WelcomeComponent
      ),
  },

  {
    path: 'cartas/:theme',
    loadComponent: () =>
      import('./components/tarot/cards/cards.component').then(
        (m) => m.CardsComponent
      ),
  },

  {
    path: 'descripcion-cartas',
    loadComponent: () =>
      import('./components/tarot/description/description.component').then(
        (m) => m.DescriptionComponent
      ),
  },

  {
    path: 'informacion',
    loadComponent: () =>
      import(
        './components/tarot/additional-info/additional-info.component'
      ).then((m) => m.AdditionalInfoComponent),
  },

  {
    path: 'agradecimiento',
    loadComponent: () =>
      import('./components/tarot/agradecimiento/agradecimiento.component').then(
        (m) => m.AgradecimientoComponent
      ),
  },

  {
    path: 'terminos-y-condiciones',
    loadComponent: () =>
      import(
        './components/tarot/terminos-condiciones/terminos-condiciones.component'
      ).then((m) => m.TerminosCondicionesComponent),
  },

  {
    path: 'terminos-condiciones-ecos',
    loadComponent: () =>
      import(
        './components/terminos-condiciones/terminos-condiciones.component'
      ).then((m) => m.TerminosCondicionesEcos),
  },

  {
    path: 'politicas-cookies',
    loadComponent: () =>
      import('./components/cookies/cookies.component').then(
        (m) => m.CookiesComponent
      ),
  },
];
