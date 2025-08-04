export function capitalizeFirstChar(str : string): string {
    if (!str) return ""; 
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

// Password comparison utility
export async function comparePassword(password: string, salt: string, hash: string): Promise<boolean> {
  const crypto = require('crypto');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 1000, 64, 'sha512', (err: any, derivedKey: any) => {
      if (err) reject(err);
      resolve(hash === derivedKey.toString('hex'));
    });
  });
}

// Role matching utility
export function isRoleMatched(selectedRole: string, userRoles: string[] | string): boolean {
  // Handle case where userRoles might be a string (double-encoded JSON)
  let rolesArray: string[];
  
  if (typeof userRoles === 'string') {
    try {
      // Try to parse if it's a JSON string
      rolesArray = JSON.parse(userRoles);
    } catch {
      // If parsing fails, treat as single role
      rolesArray = [userRoles];
    }
  } else if (Array.isArray(userRoles)) {
    rolesArray = userRoles;
  } else {
    return false;
  }
  
  return rolesArray.some(role => role.toLowerCase() === selectedRole.toLowerCase());
}

// Random alphanumeric string generator
export function randomAlphanumericString(length: number, prefix: string = ""): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
  