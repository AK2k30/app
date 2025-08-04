/**
 * Enum for admin role types
 */
export enum AdminRole {
    ADMIN = 'admin',
    SUPER_ADMIN = 'super admin'
}

/**
 * Type for user role details
 */
export interface UserRoleDetails {
    id?: string;
    email?: string;
    currentRole?: string;
    [key: string]: any;
}

/**
 * Helper function to check if a role is an admin role
 * @param role The role to check
 * @returns True if the role is an admin role, false otherwise
 */
export const isAdminRole = (role: string): boolean => {
    const normalizedRole = role.toLowerCase();
    return Object.values(AdminRole).includes(normalizedRole as AdminRole);
};