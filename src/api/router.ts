
import { Router } from "express";
export const router = Router();

import * as tasks from "./tasks.js";
import * as files from "./files.js";
import * as messages from "./messages.js";

router.use("/tasks", tasks.router);
router.use("/files", files.router);
router.use("/messages", messages.router);
