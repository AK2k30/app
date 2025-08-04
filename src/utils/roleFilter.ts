import { PrismaClient } from "@prisma/client";
import { AdminRole, UserRoleDetails, isAdminRole } from "../types/roles";

const prisma = new PrismaClient();

/**
 * Role-based filtering logic:
 * - Admin and Super Admin: Show full data (no filtering applied)
 * - All other users: Only show data where their email matches manager email in VwUser view
 */

/**
 * Apply role-based filtering to database queries
 * @param userDetails User details from the context store
 * @param baseWhereClause Base where clause for filtering
 * @param modelName The name of the model being queried
 * @returns Combined where clause with role-based filtering applied
 */
export const applyRoleFilter = async (
  userDetails: UserRoleDetails,
  baseWhereClause: any,
  modelName: string
) => {
  let combinedWhereClause = { ...baseWhereClause };

  if (!userDetails?.currentRole || !userDetails?.email) {
    return combinedWhereClause;
  }

  const userEmail = userDetails.email; // Keep original case for database queries
  const userRole = userDetails.currentRole.toLowerCase();

  // Only Admin and Super Admin roles - show full data (no filtering)
  if (isAdminRole(userRole)) {
    return combinedWhereClause;
  }

  // For all other users (including sales admin, visit admin, etc.) - only show data where their email matches manager email in VwUser
  try {
    const response: any = await prisma.$runCommandRaw({
      aggregate: "VwUser",
      pipeline: [
        {
          $match: {
            managerEmail: {
              $regex: userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i'
            }
          }
        },
        { $project: { email: 1, _id: 0 } }
      ],
      cursor: {},
    });

    const managedEmails = response?.cursor?.firstBatch?.map((user: { email: string }) => user.email) || [];
    // Include the user's own email as well
    managedEmails.push(userEmail);

    if (managedEmails.length > 0) {
      combinedWhereClause = appendEmailFilter(modelName, combinedWhereClause, managedEmails);
    } else {
      // If no managed users found, only show user's own data
      combinedWhereClause = appendEmailFilter(modelName, combinedWhereClause, [userEmail]);
    }
  } catch (error) {
    console.error("Error applying role filter for user:", error);
    // Fallback to showing only user's own data
    combinedWhereClause = appendEmailFilter(modelName, combinedWhereClause, [userEmail]);
  }

  return combinedWhereClause;
};

/**
 * Helper function to append email filtering logic to the where clause
 */
function appendEmailFilter(modelName: string, whereClause: any, emails: string[]) {
  const emailFieldMap: Record<string, string> = {
    "Visit_Information": "EMAIL",
    "Intimation": "UserEmail",
    "Sample_Details": "USER_EMAIL"
  };

  const field = emailFieldMap[modelName];
  if (!field) return whereClause;

  return {
    ...whereClause,
    [field]: {
      in: emails,
      mode: "insensitive"
    }
  };
}