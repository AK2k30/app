import { Context, Elysia, t } from "elysia";
import { dateFormat, getCurrentDate } from "./utils";
import { Prisma, PrismaClient } from "@prisma/client";
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { capitalizeFirstChar, comparePassword, isRoleMatched, randomAlphanumericString } from "./utils/helper";
import { applyRoleFilter } from "./utils/roleFilter";
import { jwt } from "./utils/jwt";

const db = new PrismaClient();

const app = new Elysia();

app.use(swagger())
app.use(cors())

// Authentication middleware
app.derive(async ({ headers, store }) => {
    const authHeader = headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
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
                    }
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
            console.error('Token verification failed:', error);
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
        take: t.String({ pattern: '^[0-9]+$' }),
        lastCursor: t.Optional(t.String()),
        searchParam: t.Optional(t.String()),
        fromDt: t.Optional(t.String({ format: 'date-time' })),
        toDt: t.Optional(t.String({ format: 'date-time' })),
        userId: t.String(),
    })
}

export const getAccountsCustomerValidation = {
    query: t.Object({
        take: t.String({ pattern: '^[0-9]+$' }),
        lastCursor: t.Optional(t.String()),
        searchParam: t.Optional(t.String()),
        fromDt: t.Optional(t.String({ format: 'date-time' })),
        toDt: t.Optional(t.String({ format: 'date-time' })),
        userId: t.String(),
    })
}

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
            if (typeof parsedRole === 'string') {
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
                    }
                }
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
app.get(`/api/v1/site/orders-count/:param1/:param2/:param3/:param4`, async (c: Context<{ params: { param1: string, param2: string, param3: string, param4: string } }>) => {

    console.log('API CALLED: /api/v1/site/orders-count');
    console.log('Received params:', c.params);

    // Step 1: Parameter validation
    console.log('Step 1: Validating parameters...');
    if (c.params && (!c.params?.param1 || !c.params?.param2)) {
        console.log('ERROR: Parameter validation failed: Missing required parameters');
        c.set.status = 400;
        throw new Error('No path parameter provided');
    }
    console.log('SUCCESS: Parameter validation passed');

    // Step 2: Parse parameters
    console.log('Step 2: Parsing parameters...');
    let startDt = new Date(c.params.param1);
    let endDt = new Date(c.params.param2);
    let productId = c.params.param3;
    const city = c.params.param4;

    console.log('Parsed startDt:', startDt);
    console.log('Parsed endDt:', endDt);
    console.log('ProductId:', productId);
    console.log('City:', city);

    // Step 3: Build where clause
    console.log('Step 3: Building where clause...');
    const whereClause: any = {
        REGISTRATION_DATE: {
            gte: startDt,
            lte: endDt,
        },
    };
    console.log('Base where clause:', JSON.stringify(whereClause, null, 2));

    if (productId && productId !== "undefined" && productId !== "default") {
        whereClause.PRODUCT_ID = productId;
        console.log('Added PRODUCT_ID filter:', productId);
    } else {
        console.log('Skipping PRODUCT_ID filter (undefined/default)');
    }

    if (city && city !== "undefined" && city !== "default") {
        const capitalizedCity = capitalizeFirstChar(city);
        whereClause.CITY = capitalizedCity;
        console.log('Added CITY filter:', capitalizedCity);
    } else {
        console.log('Skipping CITY filter (undefined/default)');
    }

    console.log('Final where clause:', JSON.stringify(whereClause, null, 2));

    // Step 4: Database query
    console.log('Step 4: Executing database query...');
    let _dbRes;
    try {
        console.log('Calling db.sample_Details.groupBy...');
        _dbRes = await db.sample_Details.groupBy({
            by: ['CUSTOMER_ID', 'CUSTOMER_NAME'],
            where: whereClause,
            _count: {
                CUSTOMER_ID: true,
            },
        });

        console.log('SUCCESS: Database query successful');
        console.log('Raw database result count:', _dbRes?.length || 0);
        console.log('Raw database result:', JSON.stringify(_dbRes, null, 2));

    } catch (error) {
        console.error('ERROR: Database query failed:', error);
        if (error instanceof Error) {
            console.error('ERROR: Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        } else {
            console.error('ERROR: Error details:', error);
        }
        c.set.status = 500;
        return {
            status: c.set.status,
            success: false,
            message: "Error fetching sales data",
            error: error instanceof Error ? error.message : String(error)
        };
    }

    // Step 5: Check for data
    console.log('Step 5: Checking for data...');
    if (!_dbRes || _dbRes.length === 0) {
        console.log('ERROR: No data found in database result');
        c.set.status = 404;
        return {
            status: c.set.status,
            success: false,
            data: [],
            message: "No Data Found"
        };
    }
    console.log('SUCCESS: Data found, proceeding with transformation');

    // Step 6: Transform the data
    console.log('Step 6: Transforming data...');
    const transformedData = _dbRes.map((item, index) => {
        console.log(`Transforming item ${index + 1}:`, item);
        const transformed = {
            Site: item.CUSTOMER_NAME,
            Orders: item._count.CUSTOMER_ID,
            CUSTOMER_ID: item.CUSTOMER_ID
        };
        console.log(`Transformed item ${index + 1}:`, transformed);
        return transformed;
    });

    console.log('Final transformed data:', JSON.stringify(transformedData, null, 2));

    // Step 7: Return response
    console.log('Step 7: Preparing response...');
    c.set.status = 200;
    const response = {
        status: c.set.status,
        success: true,
        data: transformedData,
    };

    console.log('SUCCESS: API completed successfully');
    console.log('Sending response:', JSON.stringify(response, null, 2));

    return response;
});

// API endpoint for getting all visit information
app.get(`/api/v1/visit/all`, async (c: Context) => {
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

        // Base where clause for filtering : complete, AD_HOC, P
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
                    lastVisitDate: visit.createdAt
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
        const formattedHospitals = Array.from(hospitalMap.values()).sort((a, b) =>
            a.hospitalName.localeCompare(b.hospitalName)
        );

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
                    lastVisitDate: visit.createdAt
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
            lastVisitDate: doctor.lastVisitDate
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
});

// NEW API ENDPOINTS WITHOUT ROLE-BASED FILTERING - SALES PERSON EMAIL PARAMETER

// API endpoint for getting visit information by sales person email
app.get(`/api/v1/sales/visits/:salesPersonEmail`, async (c: Context<{ params: { salesPersonEmail: string } }>) => {
    try {
        const { salesPersonEmail } = c.params;

        if (!salesPersonEmail) {
            c.set.status = 400;
            return {
                status: 400,
                success: false,
                message: 'Sales person email parameter is required'
            };
        }

        // Decode the email parameter
        const decodedEmail = decodeURIComponent(salesPersonEmail);

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
                    }
                }
            },
            where: {
                EMAIL: decodedEmail,
                STATUS: {
                    not: null
                }
            },
            orderBy: {
                createdAt: "desc",
            }
        });

        // Get total count for metadata
        const totalCount = visitInformationData.length;

        // Format the response
        const formattedData = visitInformationData.map(visit => ({
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
                    salesPersonEmail: decodedEmail,
                    fetchedAt: new Date().toISOString(),
                }
            },
            message: `Visit information for ${decodedEmail} retrieved successfully. Total records: ${totalCount}`,
        };
    } catch (error: any) {
        console.error("Error fetching visit information by sales person email:", error);
        c.set.status = 500;
        return {
            status: c.set.status,
            success: false,
            message: error.message || "Internal Server Error while fetching visit information",
        };
    }
});

// API endpoint for getting hospitals visited by sales person email
app.get(`/api/v1/sales/hospitals/:salesPersonEmail`, async (c: Context<{ params: { salesPersonEmail: string } }>) => {
    try {
        const { salesPersonEmail } = c.params;

        if (!salesPersonEmail) {
            c.set.status = 400;
            return {
                status: 400,
                success: false,
                message: 'Sales person email parameter is required'
            };
        }

        // Decode the email parameter
        const decodedEmail = decodeURIComponent(salesPersonEmail);

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
                    }
                }
            },
            where: {
                EMAIL: decodedEmail,
                STATUS: {
                    in: ["COMPLETED", "AD_HOC"]
                }
            },
            orderBy: {
                createdAt: "desc",
            }
        });

        // Group hospitals by name and collect visit information
        const hospitalMap = new Map();

        visitedHospitalsData.forEach(visit => {
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
                    allVisitDates: []
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
        const uniqueHospitals = Array.from(hospitalMap.values()).map(hospital => ({
            ...hospital,
            allVisitDates: hospital.allVisitDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime()) // Sort descending (latest first)
        }));

        // Get total count for metadata
        const totalCount = uniqueHospitals.length;

        c.set.status = 200;
        return {
            status: c.set.status,
            success: true,
            data: {
                hospitals: uniqueHospitals,
                metadata: {
                    totalCount,
                    salesPersonEmail: decodedEmail,
                    fetchedAt: new Date().toISOString(),
                }
            },
            message: `Hospitals visited by ${decodedEmail} retrieved successfully. Total records: ${totalCount}`,
        };
    } catch (error: any) {
        console.error("Error fetching hospitals by sales person email:", error);
        c.set.status = 500;
        return {
            status: c.set.status,
            success: false,
            message: error.message || "Internal Server Error while fetching hospitals",
        };
    }
});

// API endpoint for getting doctors visited by sales person email
app.get(`/api/v1/sales/doctors/:salesPersonEmail`, async (c: Context<{ params: { salesPersonEmail: string } }>) => {
    try {
        const { salesPersonEmail } = c.params;

        if (!salesPersonEmail) {
            c.set.status = 400;
            return {
                status: 400,
                success: false,
                message: 'Sales person email parameter is required'
            };
        }

        // Decode the email parameter
        const decodedEmail = decodeURIComponent(salesPersonEmail);

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
                    }
                }
            },
            where: {
                EMAIL: decodedEmail,
                STATUS: {
                    in: ["COMPLETED", "AD_HOC"]
                }
            },
            orderBy: {
                createdAt: "desc",
            }
        });

        // Group doctors by name and hospital, collect visit information
        const doctorMap = new Map();

        visitedDoctorsData.forEach(visit => {
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
                    allVisitDates: []
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
        const uniqueDoctors = Array.from(doctorMap.values()).map(doctor => ({
            ...doctor,
            allVisitDates: doctor.allVisitDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime()) // Sort descending (latest first)
        }));

        // Get total count for metadata
        const totalCount = uniqueDoctors.length;

        c.set.status = 200;
        return {
            status: c.set.status,
            success: true,
            data: {
                doctors: uniqueDoctors,
                metadata: {
                    totalCount,
                    salesPersonEmail: decodedEmail,
                    fetchedAt: new Date().toISOString(),
                }
            },
            message: `Doctors visited by ${decodedEmail} retrieved successfully. Total records: ${totalCount}`,
        };
    } catch (error: any) {
        console.error("Error fetching doctors by sales person email:", error);
        c.set.status = 500;
        return {
            status: c.set.status,
            success: false,
            message: error.message || "Internal Server Error while fetching doctors",
        };
    }
});

// server running
app.listen(PORT);

console.log(
    `Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);