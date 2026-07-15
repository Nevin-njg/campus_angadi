import type {
  AdminOrderListQuery,
  AssignOrderDealerInput,
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
  listAdmin(query: AdminOrderListQuery): Promise<PaginatedResult<OrderDetail>>
  findAdminById(orderId: string): Promise<OrderDetail | null>
  assignDealer(
    orderId: string,
    actorId: string,
    input: AssignOrderDealerInput,
  ): Promise<OrderDetail>
  recordWhatsappRedirect(orderId: string, buyerId: string): Promise<OrderDetail | null>
  transition(
    orderId: string,
    expectedStatus: OrderStatus,
    status: OrderStatus,
    actorId: string,
    note: string | null,
  ): Promise<OrderDetail | null>
}
