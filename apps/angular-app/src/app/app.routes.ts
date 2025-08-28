import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    {
        path: '',redirectTo: 'layout', pathMatch: 'full'
    },
    {
        path: 'layout', loadComponent: () => import('./layout/shell.component').then(m => m.ShellComponent),
        children: [
            {   path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            {
                path: 'dashboard', loadComponent: () => import('./faetures/dashboard/dashboard').then(m => m.Dashboard)
            },
            {
                path: 'geomap', loadComponent: () => import('./faetures/geomaplibre/geomaplibre').then(m => m.Geomaplibre),
            },
            {
                path: 'dbsettings', loadComponent: () => import('./faetures/dbsettings/dbsettings').then(m => m.DbSettings)
            },
            {
                path:'pathfinder', loadComponent: () => import('./faetures/pathfinder/path-finder').then(m => m.PathFinderComponent)
            }
        ]    
    }
];
