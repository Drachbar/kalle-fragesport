import { Routes } from '@angular/router';
import { adminGuard } from './auth/admin-guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home').then((m) => m.Home),
  },
  {
    path: 'quiz/:id',
    loadComponent: () => import('./home/home').then((m) => m.Home),
  },
  {
    path: 'integritetspolicy',
    loadComponent: () =>
      import('./legal/privacy/privacy').then((m) => m.Privacy),
  },
  {
    path: 'kontakt',
    loadComponent: () => import('./contact/contact').then((m) => m.Contact),
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./auth/register/register').then((m) => m.Register),
  },
  {
    path: 'questions',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./questions/question-list/question-list').then(
        (m) => m.QuestionList,
      ),
  },
  {
    path: 'questions/new',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./questions/question-form/question-form').then(
        (m) => m.QuestionForm,
      ),
  },
  {
    path: 'questions/suggestions',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./questions/suggestion-review/suggestion-review').then(
        (m) => m.SuggestionReview,
      ),
  },
  {
    path: 'questions/:id/edit',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./questions/question-form/question-form').then(
        (m) => m.QuestionForm,
      ),
  },
  {
    path: 'settings',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./settings/settings/settings').then((m) => m.Settings),
  },
];
