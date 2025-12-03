import {connect} from '../src/db/connection.js';
import {app} from '../src/server.js';

// Initialize database connection for serverless environment
// This runs once per cold start
connect().catch(console.error);

export default app;
