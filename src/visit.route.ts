import { Elysia, t } from "elysia";
import { errorHandler } from "@gtramontina.com/elysia-error-handler";
import { swagger } from '@elysiajs/swagger';
import { getAppVersion } from "../utils/common";
import { isAuthenticated, isPermitted } from "../middlewares";
import { visitInfoAddElysiaSchema } from "../schema/visit.schema";
import { createVisit, deleteVisit, getAllVisits, getVisit, readUniqueReportingManagers, updateVisit, getAllVisitInformation, getVisitedHospitals, getVisitedDoctors } from "../controllers/visit.controller";

const visitRoutes = (app: Elysia) => {
  // app.use(
  //     swagger({
  //       path: '/swagger', // endpoint which swagger will appear on
  //       documentation: {
  //         info: {
  //           title: 'Visit Information',
  //           description: '',
  //           version: getAppVersion(),
  //         },
  //       },
  //     })
  // )
  app.group('/api/v1/visit', (app) =>
    app
      .get("/:haplid", getVisit)
      .put("/:haplid", updateVisit)
      .delete('/delete/:param', deleteVisit, {
        //beforeHandle: (c) => isPermitted(c,["/visit/delete"],"delete-by-id"),
      })
      .post('/create', createVisit, {
        beforeHandle: (c) => isAuthenticated(c),
        body: visitInfoAddElysiaSchema,
        type: 'json',
      })
      .get('/readAll/:param1/:param2/:param3/:param4/:param5', getAllVisits, {
        beforeHandle: (c) => isAuthenticated(c),
      })
      .get("/getUniqueReportingManagers", readUniqueReportingManagers)
      .get("/all", getAllVisitInformation, {
        beforeHandle: (c) => isAuthenticated(c),
      })
      .get("/hospitals", getVisitedHospitals, {
        beforeHandle: (c) => isAuthenticated(c),
      })
      .get("/doctors", getVisitedDoctors, {
        beforeHandle: (c) => isAuthenticated(c),
      })


  )
}

export default visitRoutes as any