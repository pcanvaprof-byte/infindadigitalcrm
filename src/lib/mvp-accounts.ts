export type Role = "admin" | "consultor";

export interface MockUser {
  name: string;
  email: string;
  role: Role;
}
