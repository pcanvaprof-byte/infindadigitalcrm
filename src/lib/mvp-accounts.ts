export type Role = "admin" | "consultor";

export interface MockUser {
  name: string;
  email: string;
  role: Role;
}

export interface AccountSeed extends MockUser {
  password: string;
}

export const SEED_ACCOUNTS: AccountSeed[] = [
  {
    name: "Danielly",
    email: "danielly@infinda.com",
    password: "danielly123",
    role: "admin",
  },
  {
    name: "Valdinei",
    email: "valdinei@infinda.com",
    password: "valdinei123",
    role: "consultor",
  },
];