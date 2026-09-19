export type ActorType = "employee" | "admin";

export interface AuthenticatedProfile {
  id: number;
  name: string;
  email: string;
  kpcId?: string | null;
  username?: string | null;
  phone?: string | null;
  division?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  startDate?: string | null;
  avatarUrl?: string | null;
  accountType?: string | null;
  roles: string[];
  permissions: string[];
  actorType: "admin" | "user";
  emailVerified: boolean;
}
