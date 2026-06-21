import { Routes } from '@angular/router';
import { adminGuard } from './auth/admin-guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home').then((m) => m.Home),
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
    path: 'questions/:id/edit',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./questions/question-form/question-form').then(
        (m) => m.QuestionForm,
      ),
  },
];
