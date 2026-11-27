import type {
  ApiResponse,
  AuthLoginResult,
  UpdateUserProfileInput,
  UserProfile,
} from '@/types/mall'
import { requestApi } from '@/utils/apiClient'

export function loginWithWechat(): Promise<ApiResponse<AuthLoginResult>> {
  return requestApi<AuthLoginResult>({
    method: 'POST',
    path: '/api/auth/login',
  })
}

export function getUserProfile(): Promise<ApiResponse<UserProfile>> {
  return requestApi<UserProfile>({
    method: 'GET',
    path: '/api/me',
  })
}

export function updateUserProfile(
  input: UpdateUserProfileInput
): Promise<ApiResponse<UserProfile>> {
  return requestApi<UserProfile>({
    method: 'PUT',
    path: '/api/me',
    body: input,
  })
}
