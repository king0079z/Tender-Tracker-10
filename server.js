import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import compression from 'compression';
import pg from 'pg';
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Enable gzip compression
app.use(compression());
app.use(express.json());

// Parse ADO.NET connection string
const parseAzureConnectionString = (connStr) => {
  const parts = connStr.split(';').reduce((acc, part) => {
    const [key, value] = part.split('=').map(s => s.trim());
    acc[key] = value;
    return acc;
  }, {});

  return {
    host: parts['Server']?.replace('tcp:', '').split(',')[0],
    database: parts['Initial Catalog'],
    ssl: parts['Encrypt'] === 'True',
    port: 1433,
    connectionTimeout: parseInt(parts['Connection Timeout'] || '30', 10)
  };
};

const connectionString = 'Server=tcp:tender-tracking-server.database.windows.net,1433;Initial Catalog=tender-tracking-db;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;Authentication="Active Directory Default";';
const azureConfig = parseAzureConnectionString(connectionString);

// Database connection management
let pool = null;
let isConnected = false;
let connectionRetries = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;
const KEEPALIVE_INTERVAL = 30000; // 30 seconds

const createPool = () => {
  return new Pool({
    host: azureConfig.host || process.env.VITE_AZURE_DB_HOST,
    database: azureConfig.database || process.env.VITE_AZURE_DB_NAME,
    user: process.env.VITE_AZURE_DB_USER,
    password: process.env.VITE_AZURE_DB_PASSWORD,
    port: azureConfig.port,
    ssl: {
      rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: azureConfig.connectionTimeout * 1000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  });
};

const connectDB = async () => {
  if (isConnected) return true;

  try {
    if (pool) {
      await pool.end().catch(() => {});
    }

    pool = createPool();
    
    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    isConnected = true;
    connectionRetries = 0;
    console.log('Connected to database');
    
    // Set up keepalive
    setInterval(async () => {
      try {
        if (!pool) return;
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
      } catch (error) {
        console.error('Keepalive query failed:', error);
        isConnected = false;
        connectDB();
      }
    }, KEEPALIVE_INTERVAL);
    
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    isConnected = false;
    pool = null;

    if (connectionRetries < MAX_RETRIES) {
      connectionRetries++;
      console.log(`Retrying connection (${connectionRetries}/${MAX_RETRIES}) in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectDB();
    } else {
      console.log('Max connection retries reached');
      return false;
    }
  }
};

// Rest of the server.js code remains the same...