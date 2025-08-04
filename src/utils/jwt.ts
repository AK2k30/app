// Simple JWT utility for the application
export const jwt = {
  sign: async (payload: { data: { id: string; currentRole: string } }): Promise<string> => {
    // Simple base64 encoding for demo purposes
    // In production, use a proper JWT library like jsonwebtoken
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    // Simple signature (in production, use proper HMAC)
    const signature = Buffer.from(`${encodedHeader}.${encodedPayload}.secret`).toString('base64url');
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  },

  verify: async (token: string): Promise<{ data: { id: string; currentRole: string } } | null> => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      return payload;
    } catch {
      return null;
    }
  }
};