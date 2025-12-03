import {Router} from 'express';
export const router = Router();

import * as health from './health.js';
import * as tasks from './tasks.js';
import * as files from './files.js';
import * as messages from './messages.js';
import * as auth from './auth.js';

router.use('/health', health.router);
router.use('/tasks', tasks.router);
router.use('/files', files.router);
router.use('/messages', messages.router);
router.use('/auth', auth.router);
