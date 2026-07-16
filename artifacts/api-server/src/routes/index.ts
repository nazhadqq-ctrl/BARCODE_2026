import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sqlRouter from "./sql";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sqlRouter);
router.use(usersRouter);

export default router;
