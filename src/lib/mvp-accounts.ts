export type Role = "admin" | "consultor";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
