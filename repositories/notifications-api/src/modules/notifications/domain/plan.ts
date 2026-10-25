import type { OrderApprovedEvent, OrderPlacedEvent, OrderRejectedEvent, OrderSubmittedEvent } from 'contracts';

// Who is told what when an order changes, as pure functions. No I/O: each event
// becomes a plan (the notifications to create, and whether the decision closes
// the ones that asked for one), and the service only carries it out.
//
//   placed, awaiting approval ... supervisor: APPROVAL_NEEDED (asks for a decision)
//                                 seller:     ORDER_AWAITING_APPROVAL
//   placed, within the limit .... nobody (submitted follows)
//   submitted ................... seller: ORDER_SENT, supervisor: ORDER_SENT (information)
//   approved .................... seller: ORDER_APPROVED; closes the pending notices
//   rejected .................... seller: ORDER_CANCELLED (with the reason); closes them

export type NotificationKind =
  | 'APPROVAL_NEEDED'
  | 'ORDER_AWAITING_APPROVAL'
  | 'ORDER_SENT'
  | 'ORDER_APPROVED'
  | 'ORDER_CANCELLED';

export type RecipientRole = 'SELLER' | 'SUPERVISOR';

// What the screen needs to write the message.
export interface NotificationData {
  clientTradeName: string;
  totalCents: number;
  decidedBy?: string;
  reasonCode?: string;
  reasonText?: string;
}

export interface PlannedNotification {
  recipientId: string;
  recipientRole: RecipientRole;
  kind: NotificationKind;
  orderId: string;
  data: NotificationData;
}

export interface Plan {
  create: PlannedNotification[];
  // The kinds that ask for something are closed once the order is decided.
  resolveOrderId: string | null;
}

// The notices that stop being relevant when the order is decided.
export const CLOSED_BY_A_DECISION: NotificationKind[] = ['APPROVAL_NEEDED', 'ORDER_AWAITING_APPROVAL'];

const NONE: Plan = { create: [], resolveOrderId: null };

type Ref = Pick<OrderPlacedEvent, 'orderId' | 'sellerId' | 'supervisorId' | 'clientTradeName' | 'totalCents'>;

const base = (e: Ref) => ({ orderId: e.orderId, data: { clientTradeName: e.clientTradeName, totalCents: e.totalCents } });

export function planPlaced(event: OrderPlacedEvent): Plan {
  if (event.status !== 'AWAITING_APPROVAL') {
    return NONE;
  }
  return {
    create: [
      { recipientId: event.supervisorId, recipientRole: 'SUPERVISOR', kind: 'APPROVAL_NEEDED', ...base(event) },
      { recipientId: event.sellerId, recipientRole: 'SELLER', kind: 'ORDER_AWAITING_APPROVAL', ...base(event) },
    ],
    resolveOrderId: null,
  };
}

export function planSubmitted(event: OrderSubmittedEvent): Plan {
  return {
    create: [
      { recipientId: event.sellerId, recipientRole: 'SELLER', kind: 'ORDER_SENT', ...base(event) },
      { recipientId: event.supervisorId, recipientRole: 'SUPERVISOR', kind: 'ORDER_SENT', ...base(event) },
    ],
    resolveOrderId: null,
  };
}

export function planApproved(event: OrderApprovedEvent): Plan {
  return {
    create: [
      {
        recipientId: event.sellerId,
        recipientRole: 'SELLER',
        kind: 'ORDER_APPROVED',
        orderId: event.orderId,
        data: { clientTradeName: event.clientTradeName, totalCents: event.totalCents, decidedBy: event.approvedBy },
      },
    ],
    resolveOrderId: event.orderId,
  };
}

export function planRejected(event: OrderRejectedEvent): Plan {
  return {
    create: [
      {
        recipientId: event.sellerId,
        recipientRole: 'SELLER',
        kind: 'ORDER_CANCELLED',
        orderId: event.orderId,
        data: {
          clientTradeName: event.clientTradeName,
          totalCents: event.totalCents,
          decidedBy: event.rejectedBy,
          reasonCode: event.reasonCode,
          ...(event.reasonText ? { reasonText: event.reasonText } : {}),
        },
      },
    ],
    resolveOrderId: event.orderId,
  };
}
