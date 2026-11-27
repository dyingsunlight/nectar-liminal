import type { ApiResponse, Category, Product, ProductQueryParams } from '@/types/mall'
import { requestApi } from '@/utils/apiClient'

export type { ProductQueryParams }

export function getCategories(): Promise<ApiResponse<Category[]>> {
  return requestApi<Category[]>({
    method: 'GET',
    path: '/api/categories',
  })
}

export function getProductList(
  params?: ProductQueryParams
): Promise<ApiResponse<Product[]>> {
  return requestApi<Product[]>({
    method: 'GET',
    path: '/api/products',
    query: {
      categoryId: params?.categoryId,
      keyword: params?.keyword,
    },
  })
}

export function getProductDetail(id: string): Promise<ApiResponse<Product | null>> {
  return requestApi<Product | null>({
    method: 'GET',
    path: `/api/products/${encodeURIComponent(id)}`,
  })
}
