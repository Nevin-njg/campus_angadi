import { fetch } from 'expo/fetch'

import { mobileEnv } from '../../config/env'

export type SellerProduct = {
  id: string
  slug: string
  title: string
  description: string
  price: number
  originalPrice: number | null
  stock: number
  status: string
  published: boolean
  productType: string
  sellerType: string
  storeCategoryId: string | null
  primaryImage: string | null
  createdAt: string
  updatedAt: string
}

export type ProductImageAsset = {
  uri: string
  fileName?: string | null
  mimeType?: string | null
}

export type UploadedProductImage = {
  id: string
  url: string
}

export type CreateSellerProductInput = {
  title: string
  description: string
  price: number
  storeCategoryId: string
  inStock: boolean
  imageUploadIds?: string[]
}

export type UpdateSellerProductInput = Partial<CreateSellerProductInput>

type ApiSuccess<T> = {
  success: true
  message: string
  data: T
}

type ApiFailure = {
  success: false
  error?: {
    code?: string
    message?: string
  }
}

export class SellerProductError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SellerProductError'
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  let raw = ''

  try {
    raw = await response.text()
  } catch {
    throw new SellerProductError(
      'INVALID_RESPONSE',
      'Campus Angadi returned an invalid response.',
      response.status,
    )
  }

  let payload: ApiSuccess<T> | ApiFailure

  try {
    payload = JSON.parse(raw) as ApiSuccess<T> | ApiFailure
  } catch {
    if (__DEV__) {
      console.warn('Seller product API non-JSON response', {
        status: response.status,
        body: raw.slice(0, 160),
      })
    }

    throw new SellerProductError(
      'INVALID_RESPONSE',
      'Campus Angadi returned an invalid response.',
      response.status,
    )
  }

  if (!response.ok || !payload.success) {
    const failure = payload as ApiFailure

    throw new SellerProductError(
      failure.error?.code ?? 'REQUEST_FAILED',
      failure.error?.message ?? 'Unable to complete the request.',
      response.status,
    )
  }

  return payload.data
}

async function jsonRequest<T>(
  path: string,
  accessToken: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${mobileEnv.apiUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw new SellerProductError(
      'NETWORK_ERROR',
      'Unable to connect to Campus Angadi.',
    )
  }

  return parseResponse<T>(response)
}

export function isSellerProductAuthError(error: unknown) {
  return (
    error instanceof SellerProductError &&
    (error.status === 401 ||
      error.code === 'UNAUTHORIZED' ||
      error.code === 'AUTH_REQUIRED' ||
      error.code === 'INVALID_ACCESS_TOKEN' ||
      error.code === 'TOKEN_EXPIRED')
  )
}

export const sellerProductApi = {
  list(accessToken: string) {
    return jsonRequest<SellerProduct[]>(
      '/seller/store/products',
      accessToken,
      'GET',
    )
  },

  create(accessToken: string, input: CreateSellerProductInput) {
    return jsonRequest<SellerProduct>(
      '/seller/store/products',
      accessToken,
      'POST',
      {
        title: input.title,
        description: input.description,
        price: input.price,
        storeCategoryId: input.storeCategoryId,
        stock: input.inStock ? 1 : 0,
        published: true,
        imageUploadIds: input.imageUploadIds ?? [],
      },
    )
  },

  update(
    accessToken: string,
    productId: string,
    input: UpdateSellerProductInput,
  ) {
    const body: Record<string, unknown> = {}

    if (input.title !== undefined) body.title = input.title
    if (input.description !== undefined) body.description = input.description
    if (input.price !== undefined) body.price = input.price
    if (input.storeCategoryId !== undefined) {
      body.storeCategoryId = input.storeCategoryId
    }
    if (input.inStock !== undefined) body.stock = input.inStock ? 1 : 0
    if (input.imageUploadIds !== undefined) {
      body.imageUploadIds = input.imageUploadIds
    }

    return jsonRequest<SellerProduct>(
      `/seller/store/products/${encodeURIComponent(productId)}`,
      accessToken,
      'PATCH',
      body,
    )
  },

  remove(accessToken: string, productId: string) {
    return jsonRequest<{ id: string }>(
      `/seller/store/products/${encodeURIComponent(productId)}`,
      accessToken,
      'DELETE',
    )
  },

  async uploadImage(
    accessToken: string,
    asset: ProductImageAsset,
  ): Promise<UploadedProductImage[]> {
    const form = new FormData()

    const fallbackExtension =
      asset.mimeType === 'image/png'
        ? 'png'
        : asset.mimeType === 'image/webp'
          ? 'webp'
          : 'jpg'

    const fileName =
      asset.fileName?.trim() ||
      `seller-product-${Date.now()}.${fallbackExtension}`

    form.append(
      'images',
      {
        uri: asset.uri,
        name: fileName,
        type: asset.mimeType || 'image/jpeg',
      } as unknown as Blob,
    )

    let response: Response

    try {
      // React Native's native fetch correctly serializes FormData parts
      // shaped as { uri, name, type }. expo/fetch expects Blob/File objects
      // for multipart file parts, so using it here can produce an invalid
      // upload even though image selection/preview works.
      response = await globalThis.fetch(
        `${mobileEnv.apiUrl}/uploads/product-images`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: form,
        },
      )
    } catch {
      throw new SellerProductError(
        'NETWORK_ERROR',
        'Unable to upload the product image.',
      )
    }

    return parseResponse<UploadedProductImage[]>(response)
  },
}
