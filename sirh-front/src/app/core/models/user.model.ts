export enum Role {
  ADMIN = 'admin',
  RH = 'rh',
  AGENT = 'agent',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  position?: string;
  department?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: User;
  access_token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  position?: string;
  department?: string;
}
