/**
 * Core Shared Data Transfer Interfaces & Domain Value Objects
 */

export interface Money {
  amount: number; // Integer in VND (NFR-05.1)
  currency: 'VND';
}

export interface GeolocationPoint {
  latitude: number;
  longitude: number;
}

export interface ActorContext {
  userId: string;
  role: string;
  hospitalId: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}
