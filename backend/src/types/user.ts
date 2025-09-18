export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  company_id: number;
  group_admin_id?: number;
  permissions?: string[];
  token?: string;
  // MFA-related fields
  mfa_enabled?: boolean;
  mfa_otp?: string;
  mfa_otp_expires?: Date;
  mfa_otp_attempts?: number;
  mfa_last_used?: Date;
  mfa_setup_date?: Date;
}
