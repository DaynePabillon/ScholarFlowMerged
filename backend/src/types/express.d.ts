// Global type augmentations for Express + Passport
// This file ensures that importing passport doesn't conflict with
// SkyFlow's AuthRequest user type.

declare global {
  namespace Express {
    interface User {
      id?: string;
      email?: string;
      name?: string;
      role?: string;
      googleId?: string;
      // ScholarSync fields
      isNew?: boolean;
      accessToken?: string;
      accountRole?: string;
      accountName?: string;
      accountEmail?: string;
      account_id?: number;
    }
  }
}

export {};
