import dotenv from 'dotenv';
dotenv.config();

/**
 * Validates and normalizes configuration values.
 * @throws Error if configuration is invalid
 */
function validateConfig() {
  const errors: string[] = [];

  // Validate PORT
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3978;
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid PORT: ${process.env.PORT} (must be 1-65535)`);
  }

  // Validate BASE_URL
  const baseUrl = process.env.BASE_URL || 'http://localhost:3978';
  try {
    new URL(baseUrl);
  } catch {
    errors.push(`Invalid BASE_URL: ${baseUrl} (must be a valid URL)`);
  }

  // Validate Google OAuth configuration
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId || googleClientId.trim().length === 0) {
    errors.push('GOOGLE_CLIENT_ID is required');
  } else if (!googleClientId.includes('.apps.googleusercontent.com')) {
    errors.push('GOOGLE_CLIENT_ID appears to be invalid (should contain .apps.googleusercontent.com)');
  }

  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!googleClientSecret || googleClientSecret.trim().length === 0) {
    errors.push('GOOGLE_CLIENT_SECRET is required');
  } else if (googleClientSecret.length < 20) {
    errors.push('GOOGLE_CLIENT_SECRET appears to be invalid (too short)');
  }

  const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!googleRedirectUri || googleRedirectUri.trim().length === 0) {
    errors.push('GOOGLE_REDIRECT_URI is required');
  } else {
    try {
      const redirectUrl = new URL(googleRedirectUri);
      if (redirectUrl.protocol !== 'http:' && redirectUrl.protocol !== 'https:') {
        errors.push('GOOGLE_REDIRECT_URI must use http or https protocol');
      }
    } catch {
      errors.push(`Invalid GOOGLE_REDIRECT_URI: ${googleRedirectUri} (must be a valid URL)`);
    }
  }

  // Validate Google Scopes
  const googleScopes = (
    process.env.GOOGLE_SCOPES ||
    'https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/gmail.readonly'
  ).split(',').map(s => s.trim()).filter(s => s.length > 0);
  
  if (googleScopes.length === 0) {
    errors.push('At least one GOOGLE_SCOPES is required');
  }
  
  const validScopePattern = /^https:\/\/www\.googleapis\.com\/auth\//;
  const invalidScopes = googleScopes.filter(scope => !validScopePattern.test(scope));
  if (invalidScopes.length > 0) {
    errors.push(`Invalid Google scopes: ${invalidScopes.join(', ')} (must start with https://www.googleapis.com/auth/)`);
  }

  // Validate Session Secret
  const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
  if (sessionSecret === 'dev-secret-change-in-production' && process.env.NODE_ENV === 'production') {
    errors.push('SESSION_SECRET must be set in production (do not use default value)');
  } else if (sessionSecret.length < 32) {
    errors.push('SESSION_SECRET should be at least 32 characters long for security');
  }

  // Validate MongoDB configuration (if provided)
  if (process.env.MONGODB_URI) {
    try {
      const mongoUrl = new URL(process.env.MONGODB_URI);
      if (mongoUrl.protocol !== 'mongodb:' && mongoUrl.protocol !== 'mongodb+srv:') {
        errors.push('MONGODB_URI must use mongodb:// or mongodb+srv:// protocol');
      }
    } catch {
      errors.push(`Invalid MONGODB_URI format: ${process.env.MONGODB_URI}`);
    }
  }

  if (errors.length > 0) {
    const errorMessage = `Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}\n\nPlease check your .env file and environment variables.`;
    console.error('[Config] Validation errors:', errors);
    throw new Error(errorMessage);
  }
}

// Validate configuration on module load
validateConfig();

export const config = {
  port: parseInt(process.env.PORT || '3978', 10),
  baseUrl: process.env.BASE_URL || 'http://localhost:3978',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
    scopes: (
      process.env.GOOGLE_SCOPES ||
      'https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/gmail.readonly'
    ).split(',').map(s => s.trim()).filter(s => s.length > 0),
  },
  session: {
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  },
};

// Log configuration status (without sensitive data)
console.log('[Config] Configuration loaded successfully');
console.log('[Config] Port:', config.port);
console.log('[Config] Base URL:', config.baseUrl);
console.log('[Config] Google Client ID:', config.google.clientId ? `${config.google.clientId.substring(0, 20)}...` : 'not set');
console.log('[Config] Google Redirect URI:', config.google.redirectUri);
console.log('[Config] Google Scopes:', config.google.scopes);
console.log('[Config] Session Secret:', config.session.secret ? '***configured***' : 'using default (not recommended)');
