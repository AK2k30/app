import { Context, Elysia, t } from "elysia";
import { dateFormat, getCurrentDate } from "./utils";
import { Prisma, PrismaClient } from "@prisma/client";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import {
  capitalizeFirstChar,
  comparePassword,
  isRoleMatched,
  randomAlphanumericString,
} from "./utils/helper";
import { applyRoleFilter } from "./utils/roleFilter";
import { jwt } from "./utils/jwt";

const db = new PrismaClient();

const app = new Elysia();

app.use(swagger());
app.use(cors());

// Authentication middleware
app.derive(async ({ headers, store }) => {
  const authHeader = headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);

    try {
      const decoded = await jwt.verify(token);
      if (decoded) {
        // Get user details from database
        const user = await db.user.findFirst({
          where: { id: decoded.data.id },
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            role: true,
            managerEmail: true,
            managerId: true,
          },
        });

        if (user) {
          store.userDetails = {
            id: user.id,
            email: user.email,
            name: user.name,
            username: user.username,
            currentRole: decoded.data.currentRole,
            role: user.role,
            managerEmail: user.managerEmail,
            managerId: user.managerId,
          };
        }
      }
    } catch (error) {
      console.error("Token verification failed:", error);
    }
  }

  return {};
});

const PORT = 3003;

// Types for login
interface UserLoginBody {
  email: string;
  password: string;
  role: string;
}

export const getAccountsOrdersValidation = {
  query: t.Object({
    take: t.String({ pattern: "^[0-9]+$" }),
    lastCursor: t.Optional(t.String()),
    searchParam: t.Optional(t.String()),
    fromDt: t.Optional(t.String({ format: "date-time" })),
    toDt: t.Optional(t.String({ format: "date-time" })),
    userId: t.String(),
  }),
};

export const getAccountsCustomerValidation = {
  query: t.Object({
    take: t.String({ pattern: "^[0-9]+$" }),
    lastCursor: t.Optional(t.String()),
    searchParam: t.Optional(t.String()),
    fromDt: t.Optional(t.String({ format: "date-time" })),
    toDt: t.Optional(t.String({ format: "date-time" })),
    userId: t.String(),
  }),
};

// Login API endpoint
app.post(`/api/v1/auth/login`, async (c: Context) => {
  try {
    // Check for body
    if (!c.body) throw new Error("No body provided");

    const { email, password, role } = c.body as UserLoginBody;

    // validate duplicate email address
    const _user = await db.user.findFirst({
      where: {
        email,
      },
      select: {
        id: true,
        hash: true,
        salt: true,
        email: true,
        role: true,
        username: true,
        name: true,
        managerEmail: true,
        managerId: true,
      },
    });

    if (!_user) {
      c.set.status = 400;
      return {
        status: 400,
        success: false,
        data: null,
        message: "Invalid credentials",
      };
    }

    // verify password
    const match = await comparePassword(password, _user.salt, _user.hash);
    if (!match) {
      c.set.status = 400;
      return {
        status: 400,
        success: false,
        data: null,
        message: "Invalid credentials",
      };
    }

    // validate if role matches
    console.log(_user);
    console.log("JSON role", _user.role);

    // Handle double-encoded JSON string
    let userRoles: string[];
    try {
      // First, try to parse the outer JSON
      let parsedRole = JSON.parse(_user.role);
      // If it's still a string, parse again
      if (typeof parsedRole === "string") {
        userRoles = JSON.parse(parsedRole);
      } else {
        userRoles = parsedRole;
      }
    } catch (error) {
      console.error("Error parsing user roles:", error);
      userRoles = [_user.role]; // Fallback to treating as single role
    }

    console.log("Parsed user roles:", userRoles);

    if (!isRoleMatched(role, userRoles)) {
      c.set.status = 400;
      return {
        status: 400,
        success: false,
        data: null,
        message: "Invalid role",
      };
    }

    if (_user.role != "Super Admin" && _user.role != "Admin") {
      const _userIsActive = await db.user_Verification_Info.findFirst({
        where: {
          userId: _user.id,
        },
      });
      console.log("_userIsActive", _userIsActive);

      if (_userIsActive == null || !_userIsActive.IS_ACTIVE) {
        c.set.status = 400;
        return {
          status: 400,
          success: false,
          data: null,
          message: "Profile InActive",
        };
      }
    }

    if (role != "Super Admin" && role != "Admin") {
      const _userIsActive = await db.user_Verification_Info.findFirst({
        where: {
          userId: _user.id,
        },
      });
      console.log("_userIsActive", _userIsActive);

      if (_userIsActive == null || !_userIsActive.IS_ACTIVE) {
        c.set.status = 400;
        return {
          status: 400,
          success: false,
          data: null,
          message: "Profile InActive",
        };
      }
    }

    // Generate token
    const accessToken = await jwt.sign({
      data: { id: _user.id, currentRole: role },
    });
    const refreshToken = await jwt.sign({
      data: { id: _user.id, currentRole: role },
    });

    let accessTokenExpiry = String(Number(86400 * 3)); // 3 days
    let refreshTokenExpiry = String(Number(86400 * 3)); // 3 days

    // validate is auth exists
    const _isAuthExists = await db.auth.findFirst({
      where: {
        userId: _user.id,
      },
    });

    if (_isAuthExists) {
      // Update auth
      const _auth = await db.auth.update({
        where: {
          id: _isAuthExists.id,
        },
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          access_token_expiry: accessTokenExpiry,
          refresh_token_expiry: refreshTokenExpiry,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create auth
      const _auth = await db.auth.create({
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          userId: _user.id,
          access_token_expiry: accessTokenExpiry,
          refresh_token_expiry: refreshTokenExpiry,
        },
      });
    }

    // validate is session exists
    const _isSessionExists = await db.session.findFirst({
      where: {
        userId: _user.id,
      },
    });

    let _session;
    if (_isSessionExists) {
      _session = await db.session.update({
        where: {
          id: _isSessionExists.id,
        },
        data: {
          session_token:
            _user.id +
            "." +
            randomAlphanumericString(16, "#A") +
            "." +
            Date.now(),
          session_token_expiry: accessTokenExpiry,
          updatedAt: new Date(),
        },
      });
    } else {
      _session = await db.session.create({
        data: {
          session_token:
            _user.id +
            "." +
            randomAlphanumericString(16, "#A") +
            "." +
            Date.now(),
          userId: _user.id,
          session_token_expiry: accessTokenExpiry,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    let managerEmail = _user.managerEmail;
    let managerId = _user.managerId;
    const sanitizedRole = role.trim().toLowerCase();

    if (sanitizedRole === "super admin" || sanitizedRole === "admin") {
      managerEmail = _user.email;
      managerId = _user.id;
    }

    // Return success response
    let finalObj = {
      accessToken: accessToken,
      accessTokenExpiry: accessTokenExpiry,
      refreshToken: refreshToken,
      refreshTokenExpiry: refreshTokenExpiry,
      sessionToken: _session.session_token,
      sessionTokenExpiry: _session.session_token_expiry,
      userInfo: {
        id: _user.id,
        username: _user.username,
        name: _user.name,
        role: role,
        email: email,
        managerEmail: managerEmail,
        managerId: managerId,
      },
    };

    c.set.status = 200;
    return {
      status: 200,
      success: true,
      data: finalObj,
      message: "Login successfully",
    };
  } catch (error: any) {
    console.error("Login error:", error);
    c.set.status = 500;
    return {
      status: 500,
      success: false,
      data: null,
      message: error.message || "Internal server error during login",
    };
  }
});

app.get(`/api/v1/order/my-orders/accounts`, async (c: Context) => {
  console.log("API END POINT:- ");
  const params = {
    take: "1",
    lastCursor: "0",
    searchTerm: "null",
    fromDt: "2025-04-24",
    toDt: "2025-05-24",
  };
  let { lastCursor, searchTerm, fromDt, toDt } = params;

  const startDt = new Date(fromDt);
  const endDt = new Date(toDt);
  let take = parseInt(params?.take);

  try {
    if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
      c.set.status = 400;
      throw new Error("Invalid date parameters");
    }
    endDt.setHours(23, 59, 59, 999);

    const sanitizedSearchTerm = decodeURIComponent(searchTerm)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const baseWhere: Prisma.Order_Basic_InfoWhereInput = {
      createdAt: {
        gte: startDt.toISOString(),
        lte: endDt.toISOString(),
      },
    };

    const searchFilters: Prisma.Order_Basic_InfoWhereInput =
      sanitizedSearchTerm && sanitizedSearchTerm !== "null"
        ? {
            AND: [
              {
                createdAt: {
                  gte: startDt,
                  lte: endDt,
                },
              },
              {
                OR: [
                  {
                    Order_Sample_Info: {
                      some: {
                        OR: [
                          {
                            Patient_Master: {
                              FIRST_NAME: {
                                contains: sanitizedSearchTerm,
                                mode: "default",
                              },

                              LAST_NAME: {
                                contains: sanitizedSearchTerm,
                                mode: "insensitive",
                              },
                            },
                          },
                          {
                            CURRENT_STATUS: {
                              contains: sanitizedSearchTerm,
                              mode: "insensitive",
                            },
                          },

                          {
                            INTIMATION_HAPL_ID: {
                              contains: sanitizedSearchTerm,
                              mode: "default",
                            },
                          },

                          {
                            SAMPLE_ID: {
                              contains: sanitizedSearchTerm,
                              mode: "default",
                            },
                          },
                        ],
                      },
                    },
                  },
                  {
                    Customer_Master: {
                      OR: [
                        {
                          FIRST_NAME: {
                            contains: sanitizedSearchTerm,
                            mode: "insensitive",
                          },
                        },
                        {
                          LAST_NAME: {
                            contains: sanitizedSearchTerm,
                            mode: "insensitive",
                          },
                        },
                      ],
                    },
                  },
                  {
                    ORDER_ID: {
                      contains: sanitizedSearchTerm,
                      mode: "insensitive",
                    },
                  },
                  {
                    PRODUCT_NAME: {
                      contains: sanitizedSearchTerm,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            ],
          }
        : {};

    const whereClause: Prisma.Order_Basic_InfoWhereInput = {
      AND: [baseWhere, searchFilters],
    };

    const totalCount = await db.order_Basic_Info.count({ where: whereClause });

    const queryOptions: Prisma.Order_Basic_InfoFindManyArgs = {
      where: whereClause,
      take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        Customer_Master: true,
        Sample_Lab_Event_log: true,
        Order_Sample_Info: {
          include: {
            Patient_Master: true,
            Sample_Lab_Event_log: true,
          },
        },
        Order_Payment_Info: true,
      },
    };

    if (lastCursor && lastCursor !== "0") {
      const [cursorCreatedAt, cursorId] = lastCursor.split("_");
      queryOptions.cursor = {
        id: cursorId,
        createdAt: new Date(cursorCreatedAt),
      };
      queryOptions.skip = 1;
    }
    const result = await db.order_Basic_Info.findMany(queryOptions);

    let hasNextPage = false;

    if (result.length >= take) {
      hasNextPage = true;
    }

    const lastItem = result[result.length - 1];
    const lastCursorValue = lastItem
      ? `${lastItem.createdAt.toISOString()}_${lastItem.id}`
      : null;

    const response = {
      data: result,
      metaData: {
        totalCount,
        lastCursor: lastCursorValue,
        hasNextPage,
      },
    };

    c.set.status = 200;
    return { status: 200, success: true, data: response };
  } catch (error: any) {
    console.error("error while getting orders :", error);
    c.set.status = error.status || 500;
    return {
      status: c.set.status,
      success: false,
      message: error.message || "error while getting orders",
    };
  }
});

app.get(`/api/v1/customer/orders`, async (c: Context) => {
  const params = {
    take: "20",
    lastCursor: "0",
    searchTerm: "null",
    fromDt: "2025-04-24",
    toDt: "2025-05-24",
  };
  let { lastCursor, searchTerm, fromDt, toDt } = params;

  const startDt = new Date(fromDt);
  const endDt = new Date(toDt);
  let take = parseInt(params?.take);

  try {
    if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
      c.set.status = 400;
      throw new Error("Invalid date parameters");
    }
    endDt.setHours(23, 59, 59, 999);

    const sanitizedSearchTerm = decodeURIComponent(searchTerm)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const baseWhere: Prisma.Customer_MasterWhereInput = {
      // createdAt: {
      //   gte: startDt.toISOString(),
      //   lte: endDt.toISOString(),
      // },
    };

    // TODO :- ADD SEARCH FILTERS
    const whereClause: Prisma.Customer_MasterWhereInput = {
      AND: [baseWhere],
    };

    const totalCount = await db.customer_Master.count({ where: whereClause });

    const queryOptions: Prisma.Customer_MasterFindManyArgs = {
      where: whereClause,
      take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        Order_Sample_Info: {
          include: {
            Patient_Master: true,
            Sample_Lab_Event_log: true,
          },
        },
      },
    };

    if (lastCursor && lastCursor !== "0") {
      const [cursorCreatedAt, cursorId] = lastCursor.split("_");
      queryOptions.cursor = {
        id: cursorId,
        createdAt: new Date(cursorCreatedAt),
      };
      queryOptions.skip = 1;
    }
    const result = await db.customer_Master.findMany(queryOptions);

    let hasNextPage = false;

    if (result.length >= take) {
      hasNextPage = true;
    }

    const lastItem = result[result.length - 1];
    const lastCursorValue = lastItem
      ? `${lastItem.createdAt.toISOString()}_${lastItem.id}`
      : null;

    const response = {
      data: result,
      metaData: {
        totalCount,
        lastCursor: lastCursorValue,
        hasNextPage,
      },
    };

    c.set.status = 200;
    return { status: 200, success: true, data: response };
  } catch (error: any) {
    console.error("error while getting orders :", error);
    c.set.status = error.status || 500;
    return {
      status: c.set.status,
      success: false,
      message: error.message || "error while getting orders",
    };
  }
});

// New API endpoint for getting orders count by site
app.get(
  `/api/v1/site/orders-count/:param1/:param2/:param3/:param4`,
  async (
    c: Context<{
      params: {
        param1: string;
        param2: string;
        param3: string;
        param4: string;
      };
    }>
  ) => {
    console.log("API CALLED: /api/v1/site/orders-count");
    console.log("Received params:", c.params);

    // Step 1: Parameter validation
    console.log("Step 1: Validating parameters...");
    if (c.params && (!c.params?.param1 || !c.params?.param2)) {
      console.log(
        "ERROR: Parameter validation failed: Missing required parameters"
      );
      c.set.status = 400;
      throw new Error("No path parameter provided");
    }
    console.log("SUCCESS: Parameter validation passed");

    // Step 2: Parse parameters
    console.log("Step 2: Parsing parameters...");
    let startDt = new Date(c.params.param1);
    let endDt = new Date(c.params.param2);
    let productId = c.params.param3;
    const city = c.params.param4;

    console.log("Parsed startDt:", startDt);
    console.log("Parsed endDt:", endDt);
    console.log("ProductId:", productId);
    console.log("City:", city);

    // Step 3: Build where clause
    console.log("Step 3: Building where clause...");
    const whereClause: any = {
      REGISTRATION_DATE: {
        gte: startDt,
        lte: endDt,
      },
    };
    console.log("Base where clause:", JSON.stringify(whereClause, null, 2));

    if (productId && productId !== "undefined" && productId !== "default") {
      whereClause.PRODUCT_ID = productId;
      console.log("Added PRODUCT_ID filter:", productId);
    } else {
      console.log("Skipping PRODUCT_ID filter (undefined/default)");
    }

    if (city && city !== "undefined" && city !== "default") {
      const capitalizedCity = capitalizeFirstChar(city);
      whereClause.CITY = capitalizedCity;
      console.log("Added CITY filter:", capitalizedCity);
    } else {
      console.log("Skipping CITY filter (undefined/default)");
    }

    console.log("Final where clause:", JSON.stringify(whereClause, null, 2));

    // Step 4: Database query
    console.log("Step 4: Executing database query...");
    let _dbRes;
    try {
      console.log("Calling db.sample_Details.groupBy...");
      _dbRes = await db.sample_Details.groupBy({
        by: ["CUSTOMER_ID", "CUSTOMER_NAME"],
        where: whereClause,
        _count: {
          CUSTOMER_ID: true,
        },
      });

      console.log("SUCCESS: Database query successful");
      console.log("Raw database result count:", _dbRes?.length || 0);
      console.log("Raw database result:", JSON.stringify(_dbRes, null, 2));
    } catch (error) {
      console.error("ERROR: Database query failed:", error);
      if (error instanceof Error) {
        console.error("ERROR: Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      } else {
        console.error("ERROR: Error details:", error);
      }
      c.set.status = 500;
      return {
        status: c.set.status,
        success: false,
        message: "Error fetching sales data",
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Step 5: Check for data
    console.log("Step 5: Checking for data...");
    if (!_dbRes || _dbRes.length === 0) {
      console.log("ERROR: No data found in database result");
      c.set.status = 404;
      return {
        status: c.set.status,
        success: false,
        data: [],
        message: "No Data Found",
      };
    }
    console.log("SUCCESS: Data found, proceeding with transformation");

    // Step 6: Transform the data
    console.log("Step 6: Transforming data...");
    const transformedData = _dbRes.map((item, index) => {
      console.log(`Transforming item ${index + 1}:`, item);
      const transformed = {
        Site: item.CUSTOMER_NAME,
        Orders: item._count.CUSTOMER_ID,
        CUSTOMER_ID: item.CUSTOMER_ID,
      };
      console.log(`Transformed item ${index + 1}:`, transformed);
      return transformed;
    });

    console.log(
      "Final transformed data:",
      JSON.stringify(transformedData, null, 2)
    );

    // Step 7: Return response
    console.log("Step 7: Preparing response...");
    c.set.status = 200;
    const response = {
      status: c.set.status,
      success: true,
      data: transformedData,
    };

    console.log("SUCCESS: API completed successfully");
    console.log("Sending response:", JSON.stringify(response, null, 2));

    return response;
  }
);

// API endpoint for getting all visit information
app.get(`/api/v1/visit/all`, async (c: Context) => {
  try {
    const userDetails = c.store.userDetails || {};

    if (!userDetails?.currentRole || !userDetails?.email) {
      c.set.status = 401;
      return {
        status: 401,
        success: false,
        message: "Unauthorized - User authentication required",
      };
    }

    // Base where clause for filtering : complete, AD_HOC, P
    let baseWhereClause = {
      STATUS: {
        not: null,
      },
    };

    // Apply role-based filtering using the centralized utility
    const combinedWhereClause = await applyRoleFilter(
      userDetails,
      baseWhereClause,
      "Visit_Information"
    );

    // Fetch visit information with only sales person name, visit type and visit status
    const visitInformationData = await db.visit_Information.findMany({
      select: {
        id: true,
        HAPLID: true,
        YOUR_NAME: true, // Sales person name
        VISIT_TYPE: true, // Visit type
        STATUS: true, // Visit status
        createdAt: true,
        UserDetails: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      where: combinedWhereClause,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get total count for metadata
    const totalCount = await db.visit_Information.count({
      where: combinedWhereClause,
    });

    // Format the response to show only required fields
    const formattedData = visitInformationData.map((visit) => ({
      id: visit.id,
      haplId: visit.HAPLID,
      salesPersonName: visit.YOUR_NAME,
      visitType: visit.VISIT_TYPE,
      visitStatus: visit.STATUS,
      createdAt: visit.createdAt,
      userDetails: visit.UserDetails,
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
        },
      },
      message: `Visit information retrieved successfully. Total records: ${totalCount}`,
    };
  } catch (error: any) {
    console.error("Error fetching all visit information:", error);
    c.set.status = 500;
    return {
      status: c.set.status,
      success: false,
      message:
        error.message ||
        "Internal Server Error while fetching visit information",
    };
  }
});

// API endpoint for getting visited hospitals
app.get(`/api/v1/visit/hospitals`, async (c: Context) => {
  try {
    const userDetails = c.store.userDetails || {};

    if (!userDetails?.currentRole || !userDetails?.email) {
      c.set.status = 401;
      return {
        status: 401,
        success: false,
        message: "Unauthorized - User authentication required",
      };
    }

    // Base where clause for filtering - only get completed and ad hoc visits
    let baseWhereClause = {
      STATUS: {
        in: ["COMPLETED", "AD_HOC"],
      },
    };

    // Apply role-based filtering using the centralized utility
    const combinedWhereClause = await applyRoleFilter(
      userDetails,
      baseWhereClause,
      "Visit_Information"
    );

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
          },
        },
      },
      where: combinedWhereClause,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Group hospitals by name and collect user information
    const hospitalMap = new Map();

    visitedHospitals.forEach((visit) => {
      const hospitalName = visit.HOSPITAL_NAME;

      if (!hospitalMap.has(hospitalName)) {
        hospitalMap.set(hospitalName, {
          hospitalName,
          visitedBy: [],
          totalVisits: 0,
          firstVisitDate: visit.createdAt,
          lastVisitDate: visit.createdAt,
        });
      }

      const hospital = hospitalMap.get(hospitalName);
      hospital.totalVisits++;

      // Update visit dates
      if (visit.createdAt < hospital.firstVisitDate) {
        hospital.firstVisitDate = visit.createdAt;
      }
      if (visit.createdAt > hospital.lastVisitDate) {
        hospital.lastVisitDate = visit.createdAt;
      }

      // Add user info if not already present
      const existingUser = hospital.visitedBy.find(
        (user: any) =>
          user.email === visit.UserEmail ||
          user.email === visit.UserDetails?.email
      );

      if (!existingUser) {
        hospital.visitedBy.push({
          name: visit.YOUR_NAME || visit.UserDetails?.name,
          email: visit.UserEmail || visit.UserDetails?.email,
          lastVisitType: visit.VISIT_TYPE,
          lastVisitStatus: visit.STATUS,
        });
      }
    });

    // Convert map to array and sort by hospital name
    const formattedHospitals = Array.from(hospitalMap.values()).sort((a, b) =>
      a.hospitalName.localeCompare(b.hospitalName)
    );

    // Get unique hospital names only (simplified version)
    const uniqueHospitalNames = [
      ...new Set(visitedHospitals.map((visit) => visit.HOSPITAL_NAME)),
    ].sort();

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
        },
      },
      message: `Visited hospitals retrieved successfully. Found ${uniqueHospitalNames.length} unique hospitals.`,
    };
  } catch (error: any) {
    console.error("Error fetching visited hospitals:", error);
    c.set.status = 500;
    return {
      status: c.set.status,
      success: false,
      message:
        error.message ||
        "Internal Server Error while fetching visited hospitals",
    };
  }
});

// API endpoint for getting visited doctors
app.get(`/api/v1/visit/doctors`, async (c: Context) => {
  try {
    const userDetails = c.store.userDetails || {};

    if (!userDetails?.currentRole || !userDetails?.email) {
      c.set.status = 401;
      return {
        status: 401,
        success: false,
        message: "Unauthorized - User authentication required",
      };
    }

    // Base where clause for filtering - only get completed and ad hoc visits
    let baseWhereClause = {
      STATUS: {
        in: ["COMPLETED", "AD_HOC"],
      },
    };

    // Apply role-based filtering using the centralized utility
    const combinedWhereClause = await applyRoleFilter(
      userDetails,
      baseWhereClause,
      "Visit_Information"
    );

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
          },
        },
      },
      where: combinedWhereClause,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Group doctors by name and collect user information
    const doctorMap = new Map();

    visitedDoctors.forEach((visit) => {
      const doctorName = visit.DOCTOR_NAME;

      if (!doctorMap.has(doctorName)) {
        doctorMap.set(doctorName, {
          doctorName,
          hospitals: new Set(),
          visitedBy: [],
          totalVisits: 0,
          firstVisitDate: visit.createdAt,
          lastVisitDate: visit.createdAt,
        });
      }

      const doctor = doctorMap.get(doctorName);
      doctor.totalVisits++;

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
      const existingUser = doctor.visitedBy.find(
        (user: any) =>
          user.email === visit.UserEmail ||
          user.email === visit.UserDetails?.email
      );

      if (!existingUser) {
        doctor.visitedBy.push({
          name: visit.YOUR_NAME || visit.UserDetails?.name,
          email: visit.UserEmail || visit.UserDetails?.email,
          lastVisitType: visit.VISIT_TYPE,
          lastVisitStatus: visit.STATUS,
          lastHospitalVisited: visit.HOSPITAL_NAME,
        });
      }
    });

    // Convert map to array and format the data
    const formattedDoctors = Array.from(doctorMap.values())
      .map((doctor) => ({
        doctorName: doctor.doctorName,
        associatedHospitals: Array.from(doctor.hospitals).sort(),
        totalHospitals: doctor.hospitals.size,
        visitedBy: doctor.visitedBy,
        totalVisits: doctor.totalVisits,
        firstVisitDate: doctor.firstVisitDate,
        lastVisitDate: doctor.lastVisitDate,
      }))
      .sort((a, b) => a.doctorName.localeCompare(b.doctorName));

    // Get unique doctor names only (simplified version)
    const uniqueDoctorNames = [
      ...new Set(visitedDoctors.map((visit) => visit.DOCTOR_NAME)),
    ].sort();

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
        },
      },
      message: `Visited doctors retrieved successfully. Found ${uniqueDoctorNames.length} unique doctors.`,
    };
  } catch (error: any) {
    console.error("Error fetching visited doctors:", error);
    c.set.status = 500;
    return {
      status: c.set.status,
      success: false,
      message:
        error.message || "Internal Server Error while fetching visited doctors",
    };
  }
});

// NEW API ENDPOINTS WITHOUT ROLE-BASED FILTERING - SALES PERSON EMAIL PARAMETER

// API endpoint for getting visit information by sales person email
app.get(
  `/api/v1/sales/visits/:salesPersonEmail`,
  async (c: Context<{ params: { salesPersonEmail: string } }>) => {
    try {
      const { salesPersonEmail } = c.params;
      const { start, end } = c.query;

      if (!salesPersonEmail) {
        c.set.status = 400;
        return {
          status: 400,
          success: false,
          message: "Sales person email parameter is required",
        };
      }

      // Decode the email parameter
      const decodedEmail = decodeURIComponent(salesPersonEmail);

      // Build date filter conditions
      let dateFilter: any = {};

      if (start || end) {
        const createdAtFilter: any = {};

        if (start) {
          const startDate = new Date(start as string);
          if (isNaN(startDate.getTime())) {
            c.set.status = 400;
            return {
              status: 400,
              success: false,
              message:
                "Invalid start date format. Please use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)",
            };
          }
          createdAtFilter.gte = startDate;
        }

        if (end) {
          const endDate = new Date(end as string);
          if (isNaN(endDate.getTime())) {
            c.set.status = 400;
            return {
              status: 400,
              success: false,
              message:
                "Invalid end date format. Please use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)",
            };
          }
          // Set end of day if only date is provided (no time)
          if (end.length === 10) {
            endDate.setHours(23, 59, 59, 999);
          }
          createdAtFilter.lte = endDate;
        }

        // Validate date range
        if (start && end) {
          const startDate = new Date(start as string);
          const endDate = new Date(end as string);
          if (startDate > endDate) {
            c.set.status = 400;
            return {
              status: 400,
              success: false,
              message: "Start date cannot be after end date",
            };
          }
        }

        dateFilter.createdAt = createdAtFilter;
      }

      // Fetch visit information for the specific sales person
      const visitInformationData = await db.visit_Information.findMany({
        select: {
          id: true,
          HAPLID: true,
          YOUR_NAME: true,
          VISIT_TYPE: true,
          STATUS: true,
          DOCTOR_NAME: true,
          HOSPITAL_NAME: true,
          CLIENT_NAME: true,
          EMAIL: true,
          createdAt: true,
          UserDetails: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        where: {
          EMAIL: decodedEmail,
          STATUS: {
            not: null,
          },
          ...dateFilter,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Get total count for metadata
      const totalCount = visitInformationData.length;

      // Format the response
      const formattedData = visitInformationData.map((visit) => ({
        id: visit.id,
        haplId: visit.HAPLID,
        salesPersonName: visit.YOUR_NAME,
        salesPersonEmail: visit.EMAIL,
        visitType: visit.VISIT_TYPE,
        visitStatus: visit.STATUS,
        doctorName: visit.DOCTOR_NAME,
        hospitalName: visit.HOSPITAL_NAME,
        clientName: visit.CLIENT_NAME,
        createdAt: visit.createdAt,
        userDetails: visit.UserDetails,
      }));

      // ---- Generate summary based on visitStatus ----
      const normalizeStatus = (s?: string) =>
        (s ?? "")
          .toLowerCase()
          .trim()
          .replace(/[^a-z]/g, "");
      // e.g. "AD_HOC" -> "adhoc", "Ad-Hoc" -> "adhoc", " COMPLETED " -> "completed"

      const summary = formattedData.reduce(
        (acc, visit) => {
          const s = normalizeStatus(visit.visitStatus);

          switch (s) {
            case "completed":
            case "complete":
              acc.complete += 1;
              break;
            case "adhoc": // handles AD_HOC, ad-hoc, ad hoc, etc.
              acc.adHoc += 1;
              break;
            case "pending":
              acc.pending += 1;
              break;
            case "cancel":
            case "canceled":
            case "cancelled":
            case "cancle": // common typo
              acc.cancel += 1;
              break;
            default:
              // ignore unknown statuses (or log them if needed)
              break;
          }
          return acc;
        },
        { complete: 0, adHoc: 0, pending: 0, cancel: 0 }
      );

      // Create a human-readable summary text
      const summaryText = `Summary: ${summary.complete} completed, ${summary.adHoc} ad-hoc, ${summary.pending} pending, ${summary.cancel} cancel`;

      // ---- Final response ----
      c.set.status = 200;

      // Build metadata with date range info
      const metadata: any = {
        totalCount,
        salesPersonEmail: decodedEmail,
        fetchedAt: new Date().toISOString(),
      };

      // Add date range info if filters were applied
      if (start || end) {
        metadata.dateRange = {
          start: start ? new Date(start as string).toISOString() : null,
          end: end ? new Date(end as string).toISOString() : null,
        };
      }

      // Build response message
      let message = `Visit information for ${decodedEmail} retrieved successfully. Total records: ${totalCount}`;
      if (start || end) {
        const dateRangeText =
          start && end
            ? `from ${start} to ${end}`
            : start
            ? `from ${start} onwards`
            : `up to ${end}`;
        message += ` (filtered ${dateRangeText})`;
      }

      return {
        status: c.set.status,
        success: true,
        data: {
          visits: formattedData,
          metadata,
          summary,
          summaryText,
        },
        message,
      };
    } catch (error: any) {
      console.error(
        "Error fetching visit information by sales person email:",
        error
      );
      c.set.status = 500;
      return {
        status: c.set.status,
        success: false,
        message:
          error.message ||
          "Internal Server Error while fetching visit information",
      };
    }
  }
);

// API endpoint for getting hospitals visited by sales person email
app.get(
  `/api/v1/sales/hospitals/:salesPersonEmail`,
  async (c: Context<{ params: { salesPersonEmail: string } }>) => {
    try {
      const { salesPersonEmail } = c.params;
      const { start, end } = c.query;

      if (!salesPersonEmail) {
        c.set.status = 400;
        return {
          status: 400,
          success: false,
          message: "Sales person email parameter is required",
        };
      }

      // Decode the email parameter
      const decodedEmail = decodeURIComponent(salesPersonEmail);

      // Build date filter conditions
      let dateFilter: any = {};

      if (start || end) {
        const createdAtFilter: any = {};

        if (start) {
          const startDate = new Date(start as string);
          if (isNaN(startDate.getTime())) {
            c.set.status = 400;
            return {
              status: 400,
              success: false,
              message:
                "Invalid start date format. Please use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)",
            };
          }
          createdAtFilter.gte = startDate;
        }

        if (end) {
          const endDate = new Date(end as string);
          if (isNaN(endDate.getTime())) {
            c.set.status = 400;
            return {
              status: 400,
              success: false,
              message:
                "Invalid end date format. Please use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)",
            };
          }
          // Set end of day if only date is provided (no time)
          if (end.length === 10) {
            endDate.setHours(23, 59, 59, 999);
          }
          createdAtFilter.lte = endDate;
        }

        // Validate date range
        if (start && end) {
          const startDate = new Date(start as string);
          const endDate = new Date(end as string);
          if (startDate > endDate) {
            c.set.status = 400;
            return {
              status: 400,
              success: false,
              message: "Start date cannot be after end date",
            };
          }
        }

        dateFilter.createdAt = createdAtFilter;
      }

      // Fetch hospitals visited by the specific sales person
      const visitedHospitalsData = await db.visit_Information.findMany({
        select: {
          id: true,
          HAPLID: true,
          HOSPITAL_NAME: true,
          YOUR_NAME: true,
          STATUS: true,
          EMAIL: true,
          createdAt: true,
          UserDetails: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        where: {
          EMAIL: decodedEmail,
          STATUS: {
            in: ["COMPLETED", "AD_HOC"],
          },
          ...dateFilter,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Group hospitals by name and collect visit information
      const hospitalMap = new Map();

      visitedHospitalsData.forEach((visit) => {
        const hospitalName = visit.HOSPITAL_NAME;

        if (!hospitalMap.has(hospitalName)) {
          hospitalMap.set(hospitalName, {
            id: visit.id,
            haplId: visit.HAPLID,
            hospitalName: visit.HOSPITAL_NAME,
            salesPersonName: visit.YOUR_NAME,
            salesPersonEmail: visit.EMAIL,
            visitStatus: visit.STATUS,
            userDetails: visit.UserDetails,
            totalVisits: 0,
            visitDate: visit.createdAt, // Latest visit date
            firstVisitDate: visit.createdAt,
            allVisitDates: [],
          });
        }

        const hospital = hospitalMap.get(hospitalName);
        hospital.totalVisits++;
        hospital.allVisitDates.push(visit.createdAt);

        // Update latest visit date
        if (visit.createdAt > hospital.visitDate) {
          hospital.visitDate = visit.createdAt;
          hospital.visitStatus = visit.STATUS; // Update status to latest visit
        }

        // Update first visit date
        if (visit.createdAt < hospital.firstVisitDate) {
          hospital.firstVisitDate = visit.createdAt;
        }
      });

      // Convert map to array and sort visit dates
      const uniqueHospitals = Array.from(hospitalMap.values()).map(
        (hospital) => ({
          ...hospital,
          allVisitDates: hospital.allVisitDates.sort(
            (a, b) => new Date(b).getTime() - new Date(a).getTime()
          ), // Sort descending (latest first)
        })
      );

      // Get total count for metadata
      const totalCount = uniqueHospitals.length;

      c.set.status = 200;

      // Build metadata with date range info
      const metadata: any = {
        totalCount,
        salesPersonEmail: decodedEmail,
        fetchedAt: new Date().toISOString(),
      };

      // Add date range info if filters were applied
      if (start || end) {
        metadata.dateRange = {
          start: start ? new Date(start as string).toISOString() : null,
          end: end ? new Date(end as string).toISOString() : null,
        };
      }

      // Build response message
      let message = `Hospitals visited by ${decodedEmail} retrieved successfully. Total records: ${totalCount}`;
      if (start || end) {
        const dateRangeText =
          start && end
            ? `from ${start} to ${end}`
            : start
            ? `from ${start} onwards`
            : `up to ${end}`;
        message += ` (filtered ${dateRangeText})`;
      }

      return {
        status: c.set.status,
        success: true,
        data: {
          hospitals: uniqueHospitals,
          metadata,
        },
        message,
      };
    } catch (error: any) {
      console.error("Error fetching hospitals by sales person email:", error);
      c.set.status = 500;
      return {
        status: c.set.status,
        success: false,
        message:
          error.message || "Internal Server Error while fetching hospitals",
      };
    }
  }
);

// API endpoint for getting doctors visited by sales person email
app.get(
  `/api/v1/sales/doctors/:salesPersonEmail`,
  async (c: Context<{ params: { salesPersonEmail: string } }>) => {
    try {
      const { salesPersonEmail } = c.params;
      const { start, end } = c.query;

      if (!salesPersonEmail) {
        c.set.status = 400;
        return {
          status: 400,
          success: false,
          message: "Sales person email parameter is required",
        };
      }

      // Decode the email parameter
      const decodedEmail = decodeURIComponent(salesPersonEmail);

      // Build date filter conditions
      let dateFilter: any = {};

      if (start || end) {
        const createdAtFilter: any = {};

        if (start) {
          const startDate = new Date(start as string);
          if (isNaN(startDate.getTime())) {
            c.set.status = 400;
            return {
              status: 400,
              success: false,
              message:
                "Invalid start date format. Please use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)",
            };
          }
          createdAtFilter.gte = startDate;
        }

        if (end) {
          const endDate = new Date(end as string);
          if (isNaN(endDate.getTime())) {
            c.set.status = 400;
            return {
              status: 400,
              success: false,
              message:
                "Invalid end date format. Please use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)",
            };
          }
          // Set end of day if only date is provided (no time)
          if (end.length === 10) {
            endDate.setHours(23, 59, 59, 999);
          }
          createdAtFilter.lte = endDate;
        }

        // Validate date range
        if (start && end) {
          const startDate = new Date(start as string);
          const endDate = new Date(end as string);
          if (startDate > endDate) {
            c.set.status = 400;
            return {
              status: 400,
              success: false,
              message: "Start date cannot be after end date",
            };
          }
        }

        dateFilter.createdAt = createdAtFilter;
      }

      // Fetch doctors visited by the specific sales person
      const visitedDoctorsData = await db.visit_Information.findMany({
        select: {
          id: true,
          HAPLID: true,
          DOCTOR_NAME: true,
          HOSPITAL_NAME: true,
          YOUR_NAME: true,
          STATUS: true,
          EMAIL: true,
          createdAt: true,
          UserDetails: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        where: {
          EMAIL: decodedEmail,
          STATUS: {
            in: ["COMPLETED", "AD_HOC"],
          },
          ...dateFilter,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Group doctors by name and hospital, collect visit information
      const doctorMap = new Map();

      visitedDoctorsData.forEach((visit) => {
        const doctorKey = `${visit.DOCTOR_NAME}_${visit.HOSPITAL_NAME}`;

        if (!doctorMap.has(doctorKey)) {
          doctorMap.set(doctorKey, {
            id: visit.id,
            haplId: visit.HAPLID,
            doctorName: visit.DOCTOR_NAME,
            hospitalName: visit.HOSPITAL_NAME,
            salesPersonName: visit.YOUR_NAME,
            salesPersonEmail: visit.EMAIL,
            visitStatus: visit.STATUS,
            userDetails: visit.UserDetails,
            totalVisits: 0,
            visitDate: visit.createdAt, // Latest visit date
            firstVisitDate: visit.createdAt,
            allVisitDates: [],
          });
        }

        const doctor = doctorMap.get(doctorKey);
        doctor.totalVisits++;
        doctor.allVisitDates.push(visit.createdAt);

        // Update latest visit date
        if (visit.createdAt > doctor.visitDate) {
          doctor.visitDate = visit.createdAt;
          doctor.visitStatus = visit.STATUS; // Update status to latest visit
        }

        // Update first visit date
        if (visit.createdAt < doctor.firstVisitDate) {
          doctor.firstVisitDate = visit.createdAt;
        }
      });

      // Convert map to array and sort visit dates
      const uniqueDoctors = Array.from(doctorMap.values()).map((doctor) => ({
        ...doctor,
        allVisitDates: doctor.allVisitDates.sort(
          (a, b) => new Date(b).getTime() - new Date(a).getTime()
        ), // Sort descending (latest first)
      }));

      // Get total count for metadata
      const totalCount = uniqueDoctors.length;

      c.set.status = 200;

      // Build metadata with date range info
      const metadata: any = {
        totalCount,
        salesPersonEmail: decodedEmail,
        fetchedAt: new Date().toISOString(),
      };

      // Add date range info if filters were applied
      if (start || end) {
        metadata.dateRange = {
          start: start ? new Date(start as string).toISOString() : null,
          end: end ? new Date(end as string).toISOString() : null,
        };
      }

      // Build response message
      let message = `Doctors visited by ${decodedEmail} retrieved successfully. Total records: ${totalCount}`;
      if (start || end) {
        const dateRangeText =
          start && end
            ? `from ${start} to ${end}`
            : start
            ? `from ${start} onwards`
            : `up to ${end}`;
        message += ` (filtered ${dateRangeText})`;
      }

      return {
        status: c.set.status,
        success: true,
        data: {
          doctors: uniqueDoctors,
          metadata,
        },
        message,
      };
    } catch (error: any) {
      console.error("Error fetching doctors by sales person email:", error);
      c.set.status = 500;
      return {
        status: c.set.status,
        success: false,
        message:
          error.message || "Internal Server Error while fetching doctors",
      };
    }
  }
);

app.get(
  `/api/v1/sales/samples/:salesPersonEmail`,
  async (c: Context<{ params: { salesPersonEmail: string } }>) => {
    try {
      const { salesPersonEmail } = c.params;
      const { start, end } = c.query;

      if (!salesPersonEmail) {
        c.set.status = 400;
        return {
          status: 400,
          success: false,
          message: "Sales person email parameter is required",
        };
      }

      // Decode the email
      const decodedEmail = decodeURIComponent(salesPersonEmail);

      // Build date filter
      let dateFilter: any = {};
      if (start || end) {
        const createdAtFilter: any = {};

        if (start) {
          const startDate = new Date(start as string);
          if (isNaN(startDate.getTime())) {
            c.set.status = 400;
            return {
              status: 400,
              success: false,
              message:
                "Invalid start date format. Use ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)",
            };
          }
          createdAtFilter.gte = startDate;
        }

        if (end) {
          const endDate = new Date(end as string);
          if (isNaN(endDate.getTime())) {
            c.set.status = 400;
            return {
              status: 400,
              success: false,
              message:
                "Invalid end date format. Use ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)",
            };
          }
          if (end.length === 10) endDate.setHours(23, 59, 59, 999); // end of day
          createdAtFilter.lte = endDate;
        }

        if (
          start &&
          end &&
          new Date(start as string) > new Date(end as string)
        ) {
          c.set.status = 400;
          return {
            status: 400,
            success: false,
            message: "Start date cannot be after end date",
          };
        }

        dateFilter.createdAt = createdAtFilter;
      }

      // Query from MongoDB (via Prisma Mongo connector)
      const sampleData = await db.sample_Details.findMany({
        select: {
          REF_DOCTOR_NAME: true,
          ORGANISATION_NAME: true,
          PRODUCT: true,
          createdAt: true,
        },
        where: {
          SALESSPOC_ID: decodedEmail,
          ...dateFilter,
        },
        orderBy: { createdAt: "desc" },
      });

      // Group by doctor + month
      const doctorMap = new Map();

      sampleData.forEach((sample) => {
        const monthKey = `${sample.createdAt.getFullYear()}-${
          sample.createdAt.getMonth() + 1
        }`;
        const doctorKey = `${sample.REF_DOCTOR_NAME}_${monthKey}`;

        if (!doctorMap.has(doctorKey)) {
          doctorMap.set(doctorKey, {
            doctorName: sample.REF_DOCTOR_NAME,
            hospitalName: sample.ORGANISATION_NAME,
            month: sample.createdAt.getMonth() + 1,
            year: sample.createdAt.getFullYear(),
            totalSamples: 0,
            products: new Set<string>(),
          });
        }

        const doc = doctorMap.get(doctorKey);
        doc.totalSamples++;
        doc.products.add(sample.PRODUCT);
      });

      // Convert map to array and clean product sets
      const doctors = Array.from(doctorMap.values()).map((doc) => ({
        ...doc,
        products: Array.from(doc.products),
      }));

      const totalCount = doctors.length;

      c.set.status = 200;

      return {
        status: 200,
        success: true,
        data: {
          doctors,
          metadata: {
            totalCount,
            salesPersonEmail: decodedEmail,
            fetchedAt: new Date().toISOString(),
            dateRange: start || end ? { start, end } : null,
          },
        },
        message: `Doctor sample data for ${decodedEmail} retrieved successfully. Total records: ${totalCount}`,
      };
    } catch (error: any) {
      console.error("Error fetching doctor samples:", error);
      c.set.status = 500;
      return {
        status: 500,
        success: false,
        message:
          error.message || "Internal Server Error while fetching samples",
      };
    }
  }
);

app.get(
  "/api/v1/sales/summary/:salesPersonEmail",
  async (c: Context<{ params: { salesPersonEmail: string } }>) => {
    try {
      const { salesPersonEmail } = c.params;
      const { start, end } = c.query;

      if (!salesPersonEmail) {
        c.set.status = 400;
        return { success: false, message: "Sales person email is required" };
      }

      const decodedEmail = decodeURIComponent(salesPersonEmail);

      // Date filter
      let dateFilter: any = {};
      if (start || end) {
        dateFilter.createdAt = {};
        if (start) dateFilter.createdAt.gte = new Date(start as string);
        if (end) {
          const endDate = new Date(end as string);
          if ((end as string).length === 10) {
            endDate.setHours(23, 59, 59, 999);
          }
          dateFilter.createdAt.lte = endDate;
        }
      }

      // 1️⃣ Fetch visits by salesperson
      const visits = await db.visit_Information.findMany({
        where: {
          EMAIL: decodedEmail,
          STATUS: { in: ["COMPLETED", "AD_HOC"] },
          ...dateFilter,
        },
        select: {
          DOCTOR_NAME: true,
          HOSPITAL_NAME: true,
          createdAt: true,
          STATUS: true,
          YOUR_NAME: true,
        },
      });

      if (!visits.length) {
        return {
          success: true,
          message: "No visits found for this salesperson in given date range",
          data: [],
          metadata: {
            salesperson: decodedEmail,
            totalVisits: 0,
            totalDoctors: 0,
            totalSamples: 0,
            dateRange: { start: start || null, end: end || null },
          },
        };
      }

      // 2️⃣ Fetch samples ordered by visited doctors
      const doctorNames = [...new Set(visits.map((v) => v.DOCTOR_NAME))];

      const samples = await db.sample_Details.findMany({
        where: {
          REF_DOCTOR_NAME: { in: doctorNames },
          ...dateFilter,
        },
        select: {
          REF_DOCTOR_NAME: true,
          PRODUCT: true,
          createdAt: true,
        },
      });

      // 3️⃣ Merge visits with samples
      const doctorMap: Record<string, any> = {};

      visits.forEach((visit) => {
        if (!doctorMap[visit.DOCTOR_NAME]) {
          doctorMap[visit.DOCTOR_NAME] = {
            doctorName: visit.DOCTOR_NAME,
            hospitalName: visit.HOSPITAL_NAME,
            salesperson: visit.YOUR_NAME,
            visits: [],
            totalSamples: 0, // per doctor counter
            samples: [],
          };
        }
        doctorMap[visit.DOCTOR_NAME].visits.push({
          date: visit.createdAt,
          status: visit.STATUS,
        });
      });

      samples.forEach((sample) => {
        if (doctorMap[sample.REF_DOCTOR_NAME]) {
          doctorMap[sample.REF_DOCTOR_NAME].samples.push({
            product: sample.PRODUCT,
            date: sample.createdAt,
          });
          doctorMap[sample.REF_DOCTOR_NAME].totalSamples++;
        }
      });

      // 4️⃣ Calculate summary totals
      const totalVisits = visits.length;
      const totalDoctors = Object.keys(doctorMap).length;
      const totalSamples = samples.length;

      return {
        success: true,
        data: Object.values(doctorMap),
        metadata: {
          salesperson: decodedEmail,
          totalVisits,
          totalDoctors,
          totalSamples,
          dateRange: { start: start || null, end: end || null },
        },
      };
    } catch (error: any) {
      console.error("Error fetching sales summary:", error);
      c.set.status = 500;
      return { success: false, message: "Internal Server Error" };
    }
  }
);

app.get("/api/v1/doctors/summary", async (c: Context) => {
  try {
    const { start, end } = c.query;

    // 1️⃣ Date filter
    let dateFilter: any = {};
    if (start || end) {
      dateFilter.createdAt = {};
      if (start) dateFilter.createdAt.gte = new Date(start as string);
      if (end) {
        const endDate = new Date(end as string);
        if ((end as string).length === 10) {
          endDate.setHours(23, 59, 59, 999);
        }
        dateFilter.createdAt.lte = endDate;
      }
    }

    // 2️⃣ Fetch visits within date range
    const visits = await db.visit_Information.findMany({
      where: {
        STATUS: { in: ["COMPLETED", "AD_HOC"] },
        ...dateFilter,
      },
      select: {
        DOCTOR_NAME: true,
        HOSPITAL_NAME: true,
        YOUR_NAME: true,
        createdAt: true,
        STATUS: true,
      },
    });

    if (!visits.length) {
      return {
        success: true,
        message: "No doctor visits found in given date range",
        data: [],
        metadata: {
          totalVisits: 0,
          totalDoctors: 0,
          totalSamples: 0,
          dateRange: { start: start || null, end: end || null },
        },
      };
    }

    // 3️⃣ Get unique doctor names
    const doctorNames = [...new Set(visits.map((v) => v.DOCTOR_NAME))];

    // 4️⃣ Fetch samples for those doctors in date range
    const samples = await db.sample_Details.findMany({
      where: {
        REF_DOCTOR_NAME: { in: doctorNames },
        ...dateFilter,
      },
      select: {
        REF_DOCTOR_NAME: true,
        PRODUCT: true,
        createdAt: true,
      },
    });

    // 5️⃣ Merge visits and samples per doctor
    const doctorMap: Record<string, any> = {};

    visits.forEach((visit) => {
      if (!doctorMap[visit.DOCTOR_NAME]) {
        doctorMap[visit.DOCTOR_NAME] = {
          doctorName: visit.DOCTOR_NAME,
          hospitalName: visit.HOSPITAL_NAME,
          salesperson: visit.YOUR_NAME,
          visits: [],
          totalVisits: 0,
          totalSamples: 0,
          samples: [],
        };
      }
      doctorMap[visit.DOCTOR_NAME].visits.push({
        date: visit.createdAt,
        status: visit.STATUS,
      });
      doctorMap[visit.DOCTOR_NAME].totalVisits++;
    });

    samples.forEach((sample) => {
      if (doctorMap[sample.REF_DOCTOR_NAME]) {
        doctorMap[sample.REF_DOCTOR_NAME].samples.push({
          product: sample.PRODUCT,
          date: sample.createdAt,
        });
        doctorMap[sample.REF_DOCTOR_NAME].totalSamples++;
      }
    });

    // 6️⃣ Summary metadata
    const totalVisits = visits.length;
    const totalDoctors = Object.keys(doctorMap).length;
    const totalSamples = samples.length;

    return {
      success: true,
      message: "Doctor summary fetched successfully",
      data: Object.values(doctorMap),
      metadata: {
        totalVisits,
        totalDoctors,
        totalSamples,
        dateRange: { start: start || null, end: end || null },
      },
    };
  } catch (error: any) {
    console.error("Error fetching doctor summary:", error);
    c.set.status = 500;
    return { success: false, message: "Internal Server Error" };
  }
});

app.get("/api/v1/salesperson/products-summary", async (c: Context) => {
  try {
    const { salesperson, period, start, end } = c.query;

    // 1️⃣ Validate period
    if (!["week", "month", "year"].includes(period as string)) {
      return {
        success: false,
        message: "Invalid period. Use 'week', 'month', or 'year'.",
      };
    }

    // 2️⃣ Date filter
    const dateFilter: any = {};
    if (start || end) {
      dateFilter.createdAt = {};
      if (start) dateFilter.createdAt.gte = new Date(start as string);

      if (end) {
        const endDate = new Date(end as string);
        if ((end as string).length === 10) {
          endDate.setHours(23, 59, 59, 999); // include full day
        }
        dateFilter.createdAt.lte = endDate;
      }
    }

    // 3️⃣ Where clause
    const whereClause: any = { ...dateFilter };
    if (salesperson) {
      whereClause.SALESSPOC_ID = decodeURIComponent(salesperson as string);
    }

    // 4️⃣ Fetch samples
    const samples = await db.sample_Details.findMany({
      where: whereClause,
      select: { PRODUCT: true, SALESSPOC_ID: true, createdAt: true },
    });

    if (!samples.length) {
      return {
        success: true,
        message: "No samples found for given filters",
        data: [],
        metadata: {
          salesperson: salesperson || "ALL",
          totalSamples: 0,
          totalPeriods: 0,
          period,
          dateRange: { start: start || null, end: end || null },
        },
      };
    }

    // 5️⃣ Helper: format key by period
    const formatKey = (date: Date) => {
      const d = new Date(date);
      if (period === "year") return d.getFullYear().toString();
      if (period === "month")
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (period === "week") {
        const firstDay = new Date(d.getFullYear(), 0, 1);
        const days = Math.floor((d.getTime() - firstDay.getTime()) / 86400000);
        const week = Math.ceil((days + firstDay.getDay() + 1) / 7);
        return `${d.getFullYear()}-W${week}`;
      }
    };

    // 6️⃣ Build summary map
    const summaryMap: Record<
      string,
      {
        period: string;
        salesperson: string;
        products: Record<string, number>;
        totalSamples: number;
        changes: { total: number; products: Record<string, number> };
      }
    > = {};

    for (const sample of samples) {
      const key = formatKey(sample.createdAt);
      if (!key) continue;

      const sp = salesperson || sample.SALESSPOC_ID || "unknown";
      const mapKey = `${sp}_${key}`;

      if (!summaryMap[mapKey]) {
        summaryMap[mapKey] = {
          period: key,
          salesperson: sp,
          products: {},
          totalSamples: 0,
          changes: { total: 0, products: {} },
        };
      }

      const product = sample.PRODUCT || "unknown";
      summaryMap[mapKey].products[product] =
        (summaryMap[mapKey].products[product] || 0) + 1;
      summaryMap[mapKey].totalSamples++;
    }

    // 7️⃣ Convert to array & sort
    const data = Object.values(summaryMap).sort((a, b) =>
      a.period.localeCompare(b.period)
    );

    // 8️⃣ Format response with trends
    const formattedData = data.map((current, i) => {
      // previous record for same salesperson
      const previous = data
        .slice(0, i)
        .reverse()
        .find((d) => d.salesperson === current.salesperson);

      // 🔹 Summary section
      let totalChange = `No previous ${period} data`;
      if (previous) {
        const diff = current.totalSamples - previous.totalSamples;
        const pct = previous.totalSamples
          ? Math.round((diff / previous.totalSamples) * 100)
          : 100;

        totalChange = `${diff >= 0 ? "+" : "-"}${Math.abs(
          pct
        )}% compared to previous ${period} (${previous.totalSamples} → ${current.totalSamples})`;
      }

      // 🔹 Products section
      const productsArr = Array.from(
        new Set([
          ...(previous ? Object.keys(previous.products) : []),
          ...Object.keys(current.products),
        ])
      ).map((prod) => {
        const prevCount = previous?.products[prod] || 0;
        const currCount = current.products[prod] || 0;

        let changeMsg = "0% (no change)";
        if (previous && prevCount > 0) {
          const diff = currCount - prevCount;
          const pct = Math.round((diff / prevCount) * 100);
          changeMsg = `${diff >= 0 ? "+" : "-"}${Math.abs(pct)}%`;
        } else if (previous && prevCount === 0 && currCount > 0) {
          changeMsg = "+100% (new orders)";
        } else if (!previous) {
          changeMsg = "No previous data";
        }

        const trend = previous
          ? `${previous.period} = ${prevCount} → ${current.period} = ${currCount}`
          : `${current.period} = ${currCount} (first entry)`;

        return { name: prod, trend, change: changeMsg };
      });

      return {
        period: current.period,
        salesperson: current.salesperson,
        summary: { totalSamples: current.totalSamples, totalChange },
        products: productsArr,
      };
    });

    // 9️⃣ Final response
    return {
      success: true,
      message: "Salesperson product summary fetched successfully",
      data: formattedData,
      metadata: {
        salesperson: salesperson || "ALL",
        totalSamples: samples.length,
        totalPeriods: formattedData.length,
        period,
        dateRange: { start: start || null, end: end || null },
      },
    };
  } catch (error: any) {
    console.error("Error fetching salesperson summary:", error);
    c.set.status = 500;
    return { success: false, message: "Internal Server Error" };
  }
});


// server running
app.listen(PORT);

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
