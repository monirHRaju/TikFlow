import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    tenantId?: string;
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    tenantId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    tenantId?: string;
  }
}
