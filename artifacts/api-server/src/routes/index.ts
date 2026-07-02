import { Router, type IRouter } from "express";
import healthRouter from "./health";
import persistRouter from "./persist";
import vesselsRouter from "./vessels";
import queriesRouter from "./queries";

const router: IRouter = Router();

router.use(healthRouter);
router.use(persistRouter);
router.use(queriesRouter);
router.use(vesselsRouter);

export default router;
