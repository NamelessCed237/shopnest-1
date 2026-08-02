import type {
  LoginInput,
  LoginResponse,
  RefreshInput,
  RegisterCustomerInput,
} from '@shopnest/contracts'
import type { ApiClient, RequestOptions } from '../client.js'

export function authEndpoints(client: ApiClient) {
  return {
    /** Connexion d'un membre de l'équipe vendeur — le tenant vient du sous-domaine. */
    loginTenantUser: (input: LoginInput, options?: RequestOptions) =>
      client.post<LoginResponse>('/auth/login', input, { ...options, skipAuth: true }),

    loginCustomer: (input: LoginInput, options?: RequestOptions) =>
      client.post<LoginResponse>('/auth/customer/login', input, { ...options, skipAuth: true }),

    loginSuperAdmin: (input: LoginInput, options?: RequestOptions) =>
      client.post<LoginResponse>('/auth/admin/login', input, { ...options, skipAuth: true }),

    registerCustomer: (input: RegisterCustomerInput, options?: RequestOptions) =>
      client.post<LoginResponse>('/auth/customer/register', input, {
        ...options,
        skipAuth: true,
      }),

    refresh: (input: RefreshInput, options?: RequestOptions) =>
      client.post<LoginResponse>('/auth/refresh', input, { ...options, skipAuth: true }),

    logout: (input: RefreshInput, options?: RequestOptions) =>
      client.post<void>('/auth/logout', input, { ...options, skipAuth: true }),
  }
}
