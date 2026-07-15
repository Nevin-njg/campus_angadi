import type { NextFunction, Request, Response } from 'express'
import type { SettingsService } from '../application/settings.service.js'
export function createMarketplaceGate(service: SettingsService, feature: 'LISTINGS' | 'ORDERS') {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      if (feature === 'LISTINGS' && request.method === 'POST' && request.path === '/')
        await service.assertCanCreateListing(request.auth!.user.id)
      if (feature === 'ORDERS' && request.method === 'POST' && request.path === '/checkout')
        await service.assertOrdersAllowed()
      next()
    } catch (error) {
      next(error)
    }
  }
}
