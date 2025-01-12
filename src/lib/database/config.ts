// Database configuration
import { DatabaseConfig } from './types';

// Parse ADO.NET connection string
const parseAzureConnectionString = (connStr: string): Partial<DatabaseConfig> => {
  const parts = connStr.split(';').reduce((acc: Record<string, string>, part: string) => {
    const [key, value] = part.split('=').map(s => s.trim());
    acc[key] = value;
    return acc;
  }, {});

  return {
    host: parts['Server']?.replace('tcp:', '').split(',')[0],
    database: parts['Initial Catalog'],
    ssl: parts['Encrypt'] === 'True',
    port: 1433
  };
};

const connectionString = 'Server=tcp:tender-tracking-server.database.windows.net,1433;Initial Catalog=tender-tracking-db;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;Authentication="Active Directory Default";';
const azureConfig = parseAzureConnectionString(connectionString);

export const dbConfig: DatabaseConfig = {
  host: azureConfig.host || process.env.VITE_AZURE_DB_HOST || '',
  database: azureConfig.database || process.env.VITE_AZURE_DB_NAME || '',
  user: process.env.VITE_AZURE_DB_USER || '',
  password: process.env.VITE_AZURE_DB_PASSWORD || '',
  port: azureConfig.port || 1433,
  ssl: {
    rejectUnauthorized: false
  }
};