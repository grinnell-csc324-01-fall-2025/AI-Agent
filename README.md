# AI Agent Employee

A Google Workspace AI agent with MongoDB storage, AI-powered task inference, and Google Suite integrations.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
# Create a .env file in the root directory with the required variables (see below)

# 3. Run development server
npm run dev
```

The server will start on port 3978 by default.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

### Required Variables

```bash
# Google OAuth Configuration
# Get these from https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3978/auth/callback
GOOGLE_SCOPES=https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/gmail.readonly

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=ai-agent-db
```

### Optional Variables

```bash
# Server Configuration
PORT=3978
BASE_URL=http://localhost:3978

# Session Secret (defaults to 'dev-secret-change-in-production' if not set)
# Generate a random string for production: openssl rand -base64 32
SESSION_SECRET=your-random-secret-key

# CORS Configuration (comma-separated list of allowed origins)
ALLOWED_ORIGINS=http://localhost:3978
```

## MongoDB Setup

This application uses MongoDB for data persistence. You can use either a local MongoDB instance or MongoDB Atlas (cloud).

### Option 1: Local MongoDB

1. **Install MongoDB** (if not already installed):
   ```bash
   # macOS (using Homebrew)
   brew tap mongodb/brew
   brew install mongodb-community
   
   # Start MongoDB
   brew services start mongodb-community
   ```

2. **Configure `.env`**:
   ```bash
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB_NAME=ai-agent-db
   ```

### Option 2: MongoDB Atlas (Cloud)

1. **Create a free cluster** at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)

2. **Get your connection string** from the Atlas dashboard

3. **Configure `.env`**:
   ```bash
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB_NAME=ai-agent-db
   ```

### Verify Connection

The application will automatically connect to MongoDB on startup. Look for:
```
Successfully connected to MongoDB
Database: ai-agent-db
```

You can also check the database health at: `GET /api/health/db`

## Architecture

This project follows a layered architecture with clear separation of concerns:

- **`src/google/`** - Google Workspace API integrations (Gmail, Calendar, Drive)
- **`src/db/`** - MongoDB data access layer (schemas, repositories, aggregations)
- **`src/ai/`** - AI/NLP processing and task inference
- **`src/api/`** - REST API endpoints
- **`src/auth/`** - OAuth authentication
- **`src/server.ts`** - Express server setup


