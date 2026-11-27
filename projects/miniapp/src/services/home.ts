import type { ApiResponse, HomeData } from '@/types/mall'
import { requestApi } from '@/utils/apiClient'

export function getHomeData(): Promise<ApiResponse<HomeData>> {
  return requestApi<HomeData>({
    method: 'GET',
    path: '/api/home',
  })
}
