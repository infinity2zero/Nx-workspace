export interface AppConfig {
  port: number;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  swagger: {
    title: string;
    description: string;
    version: string;
    path: string;
  };
}

export const appConfig: AppConfig = {
  port: parseInt(process.env['PORT'] || '3000'), // Nx default port
  cors: {
    origin: [
      'http://localhost:4200', // Angular dev server
      'http://localhost:3000', // API server
      'http://localhost:3001', // Electron app dev
    ],
    credentials: true,
  },
  swagger: {
    title: 'ISP Network Management API',
    description: 'RESTful API for managing ISP network infrastructure, sites, and links',
    version: '1.0.0',
    path: 'api/docs',
  },
};
