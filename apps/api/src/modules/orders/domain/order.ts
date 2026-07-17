import type {
  AdminOrderListQuery,
  AssignOrderDealerInput,
  AssignOrderModeratorInput,
  CheckoutInput,
  CheckoutResult,
  OrderDetail,
  OrderListQuery,
  OrderStatus,
  PaginatedResult,
} from '@campusbaza/contracts'
import type { CartRecord, CheckoutProduct } from '../../cart/domain/cart.js'

export interface CheckoutPlanItem {
  product: CheckoutProduct
  quantity: number
}

export interface CheckoutPlanGroup {
  sellerType: 'ADMIN' | 'USER'
  sellerId: string | null
  items: CheckoutPlanItem[]
}

export interface OrderRepository {
  createCheckout(
    buyerId: string,
    input: CheckoutInput,
    checkoutGroupId: string,
    groups: CheckoutPlanGroup[],
    cart: CartRecord,
  ): Promise<CheckoutResult>
  listOwned(buyerId: string, query: OrderListQuery): Promise<PaginatedResult<OrderDetail>>
  findOwnedById(orderId: string, buyerId: string): Promise<OrderDetail | null>
  listAdmin(query: AdminOrderListQuery, moderatorId?: string): Promise<PaginatedResult<OrderDetail>>
  findAdminById(orderId: string, moderatorId?: string): Promise<OrderDetail | null>
  assignDealer(
    orderId: string,
    actorId: string,
    input: AssignOrderDealerInput,
  ): Promise<OrderDetail>
  assignModerator(
    orderId: string,
    actorId: string,
    input: AssignOrderModeratorInput,
  ): Promise<OrderDetail>
  transition(
    orderId: string,
    expectedStatus: OrderStatus,
    status: OrderStatus,
    actorId: string,
    note: string | null,
  ): Promise<OrderDetail | null>
}
