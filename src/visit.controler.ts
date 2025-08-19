import { Context } from 'elysia'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../utils/bcrypt'
import { dateFormat, extractDateOnly, getCurrentDate } from '../utils'
import { visitInfoAddElysiaSchema, visitInfoUpdateElysiaSchema, VisitParamsSchema } from '../schema/visit.schema'
import { applyRoleFilter } from '../utils/roleFilters'

const db = new PrismaClient()

export const createVisit = async (c: Context) => {

  console.log("Controller called ")
  try {
    if (!c.body) throw new Error('No body provided')

    const bodyDef = c.body as typeof visitInfoAddElysiaSchema;
    const userDetails = c.store.userDetails || {};

    let docName: string = ''
    let hosName: string = ''

    if (typeof bodyDef.DOCTOR_NAME === 'string') {
      docName = bodyDef.DOCTOR_NAME
    } else {
      docName = bodyDef.DOCTOR_NAME.name
    }

    if (typeof bodyDef.HOSPITAL_NAME === 'string') {
      hosName = bodyDef.HOSPITAL_NAME
    } else {
      hosName = bodyDef.HOSPITAL_NAME.name
    }

    const isExists = await db.visit_Information.findMany({
      where: {
        AND: [
          {
            CAPTURED_DATE: extractDateOnly(new Date(getCurrentDate()))
          }
        ]
      },
    });

    let visitCount: number = 0
    const visitedType: string = bodyDef.VISIT_TYPE;

    if (isExists && visitedType === "New Visit") {
      visitCount = isExists.length + 1
    } else {
      visitCount = 1
    }

    const _createData = await db.visit_Information.create({
      data: {
        HAPLID: `HAPL-${Date.now()}`,
        userId: userDetails?.id,
        UserEmail: userDetails?.email,
        ManagerEmail: userDetails?.managerEmail,
        ManagerId: userDetails?.managerId,
        EMAIL: bodyDef.EMAIL,
        STATUS: bodyDef.STATUS,
        VISIT_TYPE: bodyDef.VISIT_TYPE,
        CUSTOMER_TYPE: bodyDef.CUSTOMER_TYPE,
        DOCTOR_NAME: docName,
        HOSPITAL_NAME: hosName,
        ORGANIZATION_ID: bodyDef?.ORGANIZATION_ID,
        CUSTOMER_ID: bodyDef?.CUSTOMER_ID,
        YOUR_NAME: bodyDef.YOUR_NAME,
        REPORT_TYPE: bodyDef.REPORT_TYPE,
        CLIENT_NAME: bodyDef.CLIENT_NAME,
        TODAY_VISIT_COUNT: visitCount,
        REPORTING_MANAGER_NAME: bodyDef.REPORTING_MANAGER_NAME,
        TAGS: bodyDef.TAGS,
        PINCODE_CLIENT: Number(bodyDef.PINCODE_CLIENT),
        CLIENT_EMAIL: bodyDef.CLIENT_EMAIL,
        CLIENT_PHONE: bodyDef.CLIENT_PHONE,
        CLIENT: bodyDef.CLIENT,
        ADDRESS_CLIENT: bodyDef.ADDRESS_CLIENT,
        NAME_OF_PERSON_MET: bodyDef.NAME_OF_PERSON_MET,
        DESIGNATION_OF_PERSON: bodyDef.DESIGNATION_OF_PERSON,
        QUESTIONS_BY_CLIENT: bodyDef.QUESTIONS_BY_CLIENT,
        NEXT_STEPS: bodyDef.NEXT_STEPS,
        VISIT_OR_CALL_HIGHLIGHTS: bodyDef.VISIT_OR_CALL_HIGHLIGHTS,
        IN_DATETIME: new Date(bodyDef.IN_DATETIME),
        OUT_DATETIME: new Date(bodyDef.OUT_DATETIME),
        PLANNED_IN_DATE_TIME: new Date(bodyDef.OUT_DATETIME),
        PLANNED_OUT_DATE_TIME: new Date(bodyDef.OUT_DATETIME),
        IN_DATE: extractDateOnly(new Date(bodyDef.IN_DATETIME)),
        OUT_DATE: extractDateOnly(new Date(bodyDef.OUT_DATETIME)),
        IN_TIME: bodyDef.IN_TIME,
        OUT_TIME: bodyDef.OUT_TIME,
        LATLNG: bodyDef.LATLNG,
        GEOLOCATION: '',
        CAPTURED_DATE: extractDateOnly(new Date(getCurrentDate()))
      }
    });

    if (!_createData) {
      c.set.status = 400
      return {
        status: c.set.status,
        success: false,
        data: null,
        message: "Invalid data!",
      };
    }

    c.set.status = 201
    return {
      status: c.set.status,
      success: true,
      data: { _createData },
      message: 'Visit info added successfully',
    }
  } catch (error) {
    c.set.status = 500
    return {
      status: c.set.status,
      success: false,
      data: null,
      message: error instanceof Error ? error.message : 'An unexpected error occurred while creating the visit',
    };
  }
}

export const getAllVisits = async (c: Context<{ params: { param1: string, param2: string, param3: string, param4: string, param5: string } }>) => {
  try {
    if (c.params && (!c.params?.param1 || !c.params?.param2 || !c.params?.param3 || !c.params?.param4 || !c.params?.param5)) {
      c.set.status = 400;
      throw new Error('No path parameter provided');
    }

    const take: number = parseInt(c.params?.param1 as string) || 10;
    const lastCursor: string | undefined = c.params?.param2 as string;
    const searchTerm: string | undefined = c.params?.param3 as string;

    const userDetails = c.store.userDetails || {};

    if (!userDetails?.currentRole || !userDetails?.email) {
      c.set.status = 401;
      return { status: 401, success: false, error: 'Unauthorized' };
    }

    // Parse and validate the start and end dates
    const startDt = new Date(c.params?.param4);
    const endDt = new Date(c.params?.param5);

    if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
      c.set.status = 400;
      throw new Error("Invalid date parameters provided");
    }

    // Ensure endDt includes the full day
    endDt.setHours(23, 59, 59, 999);

    // Properly decode the search term and trim whitespace
    const sanitizedSearchTerm = searchTerm && searchTerm !== 'null'
      ? decodeURIComponent(searchTerm).trim()
      : null;

    let baseWhereClause = {
      createdAt: {
        gte: startDt.toISOString(),
        lte: endDt.toISOString(),
      },
    };

    // Apply role-based filtering using the centralized utility
    const combinedWhereClause = await applyRoleFilter(userDetails, baseWhereClause, "Visit_Information");

    const searchWhereClause = sanitizedSearchTerm ? {
      AND: [
        combinedWhereClause,
        {
          OR: [
            {
              CLIENT_NAME: {
                contains: sanitizedSearchTerm,
                mode: "insensitive",
              },
            },
            {
              HOSPITAL_NAME: {
                contains: sanitizedSearchTerm,
                mode: "insensitive",
              },
            },
            {
              DOCTOR_NAME: {
                contains: sanitizedSearchTerm,
                mode: "insensitive",
              },
            }
          ]
        },
      ],
    } : combinedWhereClause;

    let result: any;
    let nextPage: any;
    let hasNextPage = false;

    const visitTotalCount = await db.visit_Information.count({
      where: searchWhereClause
    });

    const queryOptions: any = {
      take,
      ...(lastCursor && lastCursor !== '0' && {
        skip: 1,
        cursor: {
          id: lastCursor,
        },
      }),
      orderBy: {
        createdAt: "desc",
      },
    };

    result = await db.visit_Information.findMany({
      ...queryOptions,
      where: searchWhereClause,
    });

    if (result.length > 0) {
      const lastDataInResults = result[result.length - 1];
      const cursor = lastDataInResults.id;

      nextPage = await db.visit_Information.findMany({
        take,
        skip: 1,
        cursor: {
          id: cursor,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      hasNextPage = nextPage.length > 0;
    }

    const data = {
      data: result,
      metaData: {
        lastCursor: result.length > 0 ? result[result.length - 1].id : null,
        hasNextPage,
        totalCount: visitTotalCount,
      },
    };

    c.set.status = 200;
    return {
      status: c.set.status,
      success: true,
      data: data,
    };
  } catch (error: any) {
    console.error("Error fetching visits:", error);
    c.set.status = 500;
    return {
      status: c.set.status,
      success: false,
      message: error.message || "Internal Server Error",
    };
  }
};


export const getVisit = async (c: Context) => {
  try {
    const validationId = VisitParamsSchema.safeParse(c.params.haplid);

    if (!validationId.success) {
      c.set.status = 400;
      return {
        status: c.set.status,
        success: false,
        data: null,
        message: "Invalid visit ID format",
        error: validationId.error.errors
      }
    }


    const haplId = validationId?.data;


    const visit = await db.visit_Information.findUnique({
      where: {
        HAPLID: haplId
      }
    });


    if (!visit) {
      c.set.status = 404
      return {
        status: c.set.status,
        success: false,
        data: null,
        message: "Visit not found",
      }
    }






    c.set.status = 200;

    return {
      status: c.set.status,
      success: true,
      data: visit,
      message: "visit fetching successfully"
    }

  } catch (error) {
    console.error("Error while fetching visit", error);
    c.set.status = 500;
    return {
      status: 500,
      success: false,
      data: null,
      message: "Internal server error while fetching visit",
      error: error
    }
  }
}

export const updateVisit = async (c: Context) => {
  try {
    const validationId = VisitParamsSchema.safeParse(c.params.haplid);

    const bodyDef = c.body as typeof visitInfoUpdateElysiaSchema;

    let docName: string = ''
    let hosName: string = ''



    if (typeof bodyDef.DOCTOR_NAME === 'string') {
      docName = bodyDef.DOCTOR_NAME
    } else {
      docName = bodyDef.DOCTOR_NAME.name
    }

    if (typeof bodyDef.HOSPITAL_NAME === 'string') {
      hosName = bodyDef.HOSPITAL_NAME
    } else {
      hosName = bodyDef.HOSPITAL_NAME.name
    }

    if (!validationId.success) {
      c.set.status = 400;
      return {
        status: c.set.status,
        success: false,
        data: null,
        message: "Invalid visit ID format",
        error: validationId.error.errors
      }
    }



    const isExists = await db.visit_Information.findMany({
      where: {
        AND: [
          {
            CAPTURED_DATE: extractDateOnly(new Date(getCurrentDate()))
          }

        ]
      },

    });

    let visitCount: number = 0

    const visitedType: string = bodyDef.VISIT_TYPE;

    if (isExists && visitedType === "New Visit") {
      visitCount = isExists.length + 1
    } else {
      visitCount = 1
    }

    const haplId = validationId?.data;

    const visit = await db.visit_Information.findUnique({
      where: {
        HAPLID: haplId
      }
    });


    if (!visit) {
      c.set.status = 404
      return {
        status: c.set.status,
        success: false,
        data: null,
        message: "Visit not found",
      }
    }


    const updatedVisit = await db.visit_Information.update({
      where: {
        HAPLID: haplId,
      },
      data: {
        EMAIL: bodyDef.EMAIL,
        VISIT_TYPE: "New Visit",
        STATUS: "COMPLETED",
        DOCTOR_NAME: docName,
        HOSPITAL_NAME: hosName,
        YOUR_NAME: bodyDef.YOUR_NAME,
        REPORT_TYPE: bodyDef.REPORT_TYPE,
        CLIENT_NAME: bodyDef.CLIENT_NAME,
        TODAY_VISIT_COUNT: visitCount,
        REPORTING_MANAGER_NAME: bodyDef.REPORTING_MANAGER_NAME,
        TAGS: bodyDef.TAGS,
        PINCODE_CLIENT: Number(bodyDef.PINCODE_CLIENT),
        CLIENT_EMAIL: bodyDef.CLIENT_EMAIL,
        CLIENT_PHONE: bodyDef.CLIENT_PHONE,
        CLIENT: bodyDef.CLIENT,
        NAME_OF_PERSON_MET: bodyDef.NAME_OF_PERSON_MET,
        DESIGNATION_OF_PERSON: bodyDef.DESIGNATION_OF_PERSON,
        QUESTIONS_BY_CLIENT: bodyDef.QUESTIONS_BY_CLIENT,
        NEXT_STEPS: bodyDef.NEXT_STEPS,
        VISIT_OR_CALL_HIGHLIGHTS: bodyDef.VISIT_OR_CALL_HIGHLIGHTS,
        IN_DATETIME: new Date(bodyDef.IN_DATETIME),
        OUT_DATETIME: new Date(bodyDef.OUT_DATETIME),
        IN_DATE: extractDateOnly(new Date(bodyDef.IN_DATETIME)),
        OUT_DATE: extractDateOnly(new Date(bodyDef.OUT_DATETIME)),
        IN_TIME: bodyDef.IN_TIME,
        OUT_TIME: bodyDef.OUT_TIME,
        LATLNG: bodyDef.LATLNG,
        GEOLOCATION: '',
        CAPTURED_DATE: extractDateOnly(new Date(getCurrentDate()))
      }
    });

    c.set.status = 200;
    return {
      status: c.set.status,
      success: true,
      data: updatedVisit,
      message: "Visit updated successfully",
    };

  } catch (error) {
    console.error("Error while updating visit", error);
    c.set.status = 500;
    return {
      status: 500,
      success: false,
      data: null,
      message: "Internal server error while updating visit",
      error: error
    }
  }
}


export const deleteVisit = async (c: Context<{ params: { param: string } }>) => {
  if (c.params && !c.params?.param) {
    c.set.status = 400
    throw new Error('No path parameter provided')
  }

  const _dbRes = await db.visit_Information.delete(
    {
      where: {
        HAPLID: c.params.param
      }
    }
  )

  // Check for data
  if (!_dbRes) {
    c.set.status = 404
    throw new Error('No data found!')
  }

  // Return success response
  return {
    status: c.set.status,
    success: true,
    data: _dbRes,
  }
}

export const readUniqueReportingManagers = async (c: Context) => {
  try {
    // Use a more efficient query with proper filtering
    const uniqueManagers = await db.visit_Information.findMany({
      select: {
        REPORTING_MANAGER_NAME: true,
        id: true,
      },
      where: {
        REPORTING_MANAGER_NAME: {
          not: "",
        },
      },
      distinct: ['REPORTING_MANAGER_NAME'],
      orderBy: {
        REPORTING_MANAGER_NAME: "asc",
      },
      take: 500, // Limit results
    });

    // Filter out null values after query (since Prisma has type issues with null in string filters)
    const filteredManagers = uniqueManagers.filter(
      manager => manager.REPORTING_MANAGER_NAME !== null
    );

    c.set.status = 200;
    // Add cache headers to allow client caching
    c.set.headers['Cache-Control'] = 'public, max-age=3600'; // Cache for 1 hour

    return {
      status: c.set.status,
      data: filteredManagers,
      message: "Data retrieved successfully",
    };
  } catch (error: any) {
    c.set.status = 500;
    return {
      status: c.set.status,
      success: false,
      message: error.message || "Failed to fetch unique managers",
    };
  }
}

//get all visit data api

export const getAllVisitInformation = async (c: Context) => {
  try {
    const userDetails = c.store.userDetails || {};

    if (!userDetails?.currentRole || !userDetails?.email) {
      c.set.status = 401;
      return {
        status: 401,
        success: false,
        message: 'Unauthorized - User authentication required'
      };
    }

    // Base where clause for filtering
    let baseWhereClause = {
      STATUS: {
        not: null
      }
    };

    // Apply role-based filtering using the centralized utility
    const combinedWhereClause = await applyRoleFilter(userDetails, baseWhereClause, "Visit_Information");

    // Fetch visit information with only sales person name, visit type and visit status
    const visitInformationData = await db.visit_Information.findMany({
      select: {
        id: true,
        HAPLID: true,
        YOUR_NAME: true,   // Sales person name
        VISIT_TYPE: true,  // Visit type
        STATUS: true,      // Visit status
        createdAt: true,
        UserDetails: {
          select: {
            name: true,
            email: true,
          }
        }
      },
      where: combinedWhereClause,
      orderBy: {
        createdAt: "desc",
      }
    });

    // Get total count for metadata
    const totalCount = await db.visit_Information.count({
      where: combinedWhereClause
    });

    // Format the response to show only required fields
    const formattedData = visitInformationData.map(visit => ({
      id: visit.id,
      haplId: visit.HAPLID,
      salesPersonName: visit.YOUR_NAME,
      visitType: visit.VISIT_TYPE,
      visitStatus: visit.STATUS,
      createdAt: visit.createdAt,
      userDetails: visit.UserDetails
    }));

    c.set.status = 200;
    return {
      status: c.set.status,
      success: true,
      data: {
        visits: formattedData,
        metadata: {
          totalCount,
          fetchedAt: new Date().toISOString(),
        }
      },
      message: `Visit information retrieved successfully. Total records: ${totalCount}`,
    };
  } catch (error: any) {
    console.error("Error fetching all visit information:", error);
    c.set.status = 500;
    return {
      status: c.set.status,
      success: false,
      message: error.message || "Internal Server Error while fetching visit information",
    };
  }
}

//hospital visit api

export const getVisitedHospitals = async (c: Context) => {
  try {
    const userDetails = c.store.userDetails || {};

    if (!userDetails?.currentRole || !userDetails?.email) {
      c.set.status = 401;
      return {
        status: 401,
        success: false,
        message: 'Unauthorized - User authentication required'
      };
    }

    // Base where clause for filtering - only get completed and ad hoc visits
    let baseWhereClause = {
      STATUS: {
        in: ["COMPLETED", "AD_HOC"]
      }
    };

    // Apply role-based filtering using the centralized utility
    const combinedWhereClause = await applyRoleFilter(userDetails, baseWhereClause, "Visit_Information");

    // Fetch unique hospital names that users have visited
    const visitedHospitals = await db.visit_Information.findMany({
      select: {
        HOSPITAL_NAME: true,
        YOUR_NAME: true,
        UserEmail: true,
        createdAt: true,
        VISIT_TYPE: true,
        STATUS: true,
        UserDetails: {
          select: {
            name: true,
            email: true,
          }
        }
      },
      where: combinedWhereClause,
      orderBy: {
        createdAt: "desc",
      }
    });

    // Group hospitals by name and collect user information
    const hospitalMap = new Map();

    visitedHospitals.forEach(visit => {
      const hospitalName = visit.HOSPITAL_NAME;

      if (!hospitalMap.has(hospitalName)) {
        hospitalMap.set(hospitalName, {
          hospitalName,
          visitedBy: [],
          totalVisits: 0,
          firstVisitDate: visit.createdAt,
          lastVisitDate: visit.createdAt,
          allVisitDates: []
        });
      }

      const hospital = hospitalMap.get(hospitalName);
      hospital.totalVisits++;

      // Add visit date to array
      hospital.allVisitDates.push(visit.createdAt);

      // Update visit dates
      if (visit.createdAt < hospital.firstVisitDate) {
        hospital.firstVisitDate = visit.createdAt;
      }
      if (visit.createdAt > hospital.lastVisitDate) {
        hospital.lastVisitDate = visit.createdAt;
      }

      // Add user info if not already present
      const existingUser = hospital.visitedBy.find((user: any) =>
        user.email === visit.UserEmail || user.email === visit.UserDetails?.email
      );

      if (!existingUser) {
        hospital.visitedBy.push({
          name: visit.YOUR_NAME || visit.UserDetails?.name,
          email: visit.UserEmail || visit.UserDetails?.email,
          lastVisitType: visit.VISIT_TYPE,
          lastVisitStatus: visit.STATUS
        });
      }
    });

    // Convert map to array and sort by hospital name
    const formattedHospitals = Array.from(hospitalMap.values()).map(hospital => ({
      ...hospital,
      allVisitDates: hospital.allVisitDates.sort((a: Date, b: Date) => new Date(b).getTime() - new Date(a).getTime())
    })).sort((a, b) => a.hospitalName.localeCompare(b.hospitalName));

    // Get unique hospital names only (simplified version)
    const uniqueHospitalNames = [...new Set(visitedHospitals.map(visit => visit.HOSPITAL_NAME))].sort();

    c.set.status = 200;
    return {
      status: c.set.status,
      success: true,
      data: {
        hospitals: formattedHospitals,
        hospitalNames: uniqueHospitalNames,
        metadata: {
          totalUniqueHospitals: uniqueHospitalNames.length,
          totalVisits: visitedHospitals.length,
          fetchedAt: new Date().toISOString(),
        }
      },
      message: `Visited hospitals retrieved successfully. Found ${uniqueHospitalNames.length} unique hospitals.`,
    };
  } catch (error: any) {
    console.error("Error fetching visited hospitals:", error);
    c.set.status = 500;
    return {
      status: c.set.status,
      success: false,
      message: error.message || "Internal Server Error while fetching visited hospitals",
    };
  }
}

//doctor visit api

export const getVisitedDoctors = async (c: Context) => {
  try {
    const userDetails = c.store.userDetails || {};

    if (!userDetails?.currentRole || !userDetails?.email) {
      c.set.status = 401;
      return {
        status: 401,
        success: false,
        message: 'Unauthorized - User authentication required'
      };
    }

    // Base where clause for filtering - only get completed and ad hoc visits
    let baseWhereClause = {
      STATUS: {
        in: ["COMPLETED", "AD_HOC"]
      }
    };

    // Apply role-based filtering using the centralized utility
    const combinedWhereClause = await applyRoleFilter(userDetails, baseWhereClause, "Visit_Information");

    // Fetch unique doctor names that users have visited
    const visitedDoctors = await db.visit_Information.findMany({
      select: {
        DOCTOR_NAME: true,
        HOSPITAL_NAME: true,
        YOUR_NAME: true,
        UserEmail: true,
        createdAt: true,
        VISIT_TYPE: true,
        STATUS: true,
        UserDetails: {
          select: {
            name: true,
            email: true,
          }
        }
      },
      where: combinedWhereClause,
      orderBy: {
        createdAt: "desc",
      }
    });

    // Group doctors by name and collect user information
    const doctorMap = new Map();

    visitedDoctors.forEach(visit => {
      const doctorName = visit.DOCTOR_NAME;

      if (!doctorMap.has(doctorName)) {
        doctorMap.set(doctorName, {
          doctorName,
          hospitals: new Set(),
          visitedBy: [],
          totalVisits: 0,
          firstVisitDate: visit.createdAt,
          lastVisitDate: visit.createdAt,
          allVisitDates: []
        });
      }

      const doctor = doctorMap.get(doctorName);
      doctor.totalVisits++;

      // Add visit date to array
      doctor.allVisitDates.push(visit.createdAt);

      // Add hospital to the set of hospitals this doctor is associated with
      if (visit.HOSPITAL_NAME) {
        doctor.hospitals.add(visit.HOSPITAL_NAME);
      }

      // Update visit dates
      if (visit.createdAt < doctor.firstVisitDate) {
        doctor.firstVisitDate = visit.createdAt;
      }
      if (visit.createdAt > doctor.lastVisitDate) {
        doctor.lastVisitDate = visit.createdAt;
      }

      // Add user info if not already present
      const existingUser = doctor.visitedBy.find((user: any) =>
        user.email === visit.UserEmail || user.email === visit.UserDetails?.email
      );

      if (!existingUser) {
        doctor.visitedBy.push({
          name: visit.YOUR_NAME || visit.UserDetails?.name,
          email: visit.UserEmail || visit.UserDetails?.email,
          lastVisitType: visit.VISIT_TYPE,
          lastVisitStatus: visit.STATUS,
          lastHospitalVisited: visit.HOSPITAL_NAME
        });
      }
    });

    // Convert map to array and format the data
    const formattedDoctors = Array.from(doctorMap.values()).map(doctor => ({
      doctorName: doctor.doctorName,
      associatedHospitals: Array.from(doctor.hospitals).sort(),
      totalHospitals: doctor.hospitals.size,
      visitedBy: doctor.visitedBy,
      totalVisits: doctor.totalVisits,
      firstVisitDate: doctor.firstVisitDate,
      lastVisitDate: doctor.lastVisitDate,
      allVisitDates: doctor.allVisitDates.sort((a: Date, b: Date) => new Date(b).getTime() - new Date(a).getTime())
    })).sort((a, b) => a.doctorName.localeCompare(b.doctorName));

    // Get unique doctor names only (simplified version)
    const uniqueDoctorNames = [...new Set(visitedDoctors.map(visit => visit.DOCTOR_NAME))].sort();

    c.set.status = 200;
    return {
      status: c.set.status,
      success: true,
      data: {
        doctors: formattedDoctors,
        doctorNames: uniqueDoctorNames,
        metadata: {
          totalUniqueDoctors: uniqueDoctorNames.length,
          totalVisits: visitedDoctors.length,
          fetchedAt: new Date().toISOString(),
        }
      },
      message: `Visited doctors retrieved successfully. Found ${uniqueDoctorNames.length} unique doctors.`,
    };
  } catch (error: any) {
    console.error("Error fetching visited doctors:", error);
    c.set.status = 500;
    return {
      status: c.set.status,
      success: false,
      message: error.message || "Internal Server Error while fetching visited doctors",
    };
  }
}
