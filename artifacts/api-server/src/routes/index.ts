import { Router, type IRouter } from "express";
import healthRouter from "./health";
import persistRouter from "./persist";

const router: IRouter = Router();

router.use(healthRouter);
router.use(persistRouter);

export default router;
