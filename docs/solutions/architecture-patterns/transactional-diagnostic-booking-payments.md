---
title: "State-safe diagnostic booking and payment transitions"
date: 2026-09-29
last_updated: 2026-10-02
category: architecture-patterns
module: "bookings and payments"
problem_type: architecture_pattern
component: payments
severity: high
applies_when:
  - "A booking can be changed by both a user-facing payment request and an external provider webhook"
  - "Retries, duplicate deliveries, cancellation, and authorization must preserve booking state"
tags:
  - booking
  - payments
  - webhooks
  - idempotency
  - prisma
  - authorization
---

# State-safe diagnostic booking and payment transitions

## Context

The diagnostic backend combines authenticated booking ownership, payment preparation, direct payment outcomes, cancellation, and provider webhooks. These operations can be retried or race with one another, so the payment and booking records must move together or remain unchanged.

The implementation also crosses several trust boundaries: signup and login handle credentials, catalogue and booking DTOs accept client input, and the webhook accepts provider input authenticated by an HMAC over the raw request body.

## Guidance

Use `POST /payments/prepare` to create or reuse the booking's one `PENDING` payment. The endpoint is available only to the booking owner or an admin, and it conflicts once either the booking or its payment has reached a terminal state. This is implemented in `src/payments/payments.controller.ts:17-22` and `src/payments/payments.service.ts:14-58`.

Keep direct payment and webhook transitions inside one Prisma serializable transaction. A `PENDING` payment moves to `SUCCESS` with a `CONFIRMED` booking, or to `FAILED` with a `FAILED` booking. Check authorization and the current state before conditional writes. A same-outcome terminal retry is idempotent; the opposite outcome or an inconsistent payment/booking pair is a conflict. The direct-payment flow is in `src/payments/payments.service.ts:59-121`, and cancellation follows the same conditional transaction pattern in `src/bookings/bookings.service.ts:69-97`.

For provider callbacks, verify the HMAC over the exact raw payload before opening a transaction, then persist the unique provider event ID with its payload hash. A repeated event with the same hash is a replay; the same provider ID with a different hash is a conflict. The webhook applies the same `PENDING`-to-terminal transition in `src/payments/payments.service.ts:122-190`; `rawBody` is enabled in `src/main.ts:10`, and `WebhookEvent.providerEventId` is unique in `prisma/schema.prisma:77-81`.

Put authorization at both the route and service boundaries. `JwtGuard` authenticates the bearer token, `RoleGuard` reloads the current user and role from Prisma in `src/common/auth.ts:7-17`, and booking/payment services re-check resource ownership in `src/bookings/bookings.service.ts:9-10` and `src/payments/payments.service.ts:6`.

Use DTO validation as the input contract: UUID identifiers, ISO appointment timestamps, bounded pagination, enum payment outcomes, and a constrained decimal price format are defined in `src/common/dto.ts:4-13`. Enable whitelist, non-whitelisted-property rejection, and transformation globally in `src/main.ts:11`.

## Why This Matters

Database constraints are part of the behavior, not just storage details. The unique payment-to-booking relation and webhook provider-event key in `prisma/schema.prisma:67-80` provide the final duplicate protection when concurrent requests pass application-level checks.

The same design makes retries predictable: `SUCCESS`/`CONFIRMED` and `FAILED`/`FAILED` terminal pairs return the same result for the same outcome, while an opposite outcome or inconsistent pair is rejected. Conditional status updates prevent a late payment or cancellation from overwriting a newer terminal state.

The `FAILED` booking state is part of the persisted lifecycle. Migration `20261002190000_add_failed_booking_status` adds it to `BookingStatus`; PostgreSQL enum additions are forward-only, so the migration must not be rolled back by removing the value.

Authentication and validation reduce the blast radius before the transaction runs, while request IDs and JSON request logging from `src/common/interceptors/request-id.interceptor.ts:4` make rejected or conflicting operations traceable.

## When to Apply

- When a resource has a lifecycle with terminal states and more than one writer.
- When an external callback can be duplicated, delayed, reordered, or delivered concurrently with a user request.
- When an operation must be safe to retry without creating a second record or applying a transition twice.
- When verifying the lifecycle against PostgreSQL: the e2e suite covers authorization, preparation idempotency, direct success and failure retries, signed webhook replay/conflict handling, and invalid signatures.

## Examples

The core transition shape is:

```ts
await prisma.$transaction(async (tx) => {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true },
  });

  if (!booking || booking.status !== 'PENDING') throw conflict();

  await tx.payment.updateMany({
    where: { bookingId, status: 'PENDING' },
    data: { status: outcome },
  });

  await tx.booking.updateMany({
    where: { id: bookingId, status: 'PENDING' },
    data: { status: outcome === 'SUCCESS' ? 'CONFIRMED' : 'FAILED' },
  });
}, { isolationLevel: 'Serializable' });
```

Unit coverage verifies payment preparation, terminal retry behavior, invalid webhook signatures, and webhook replay/conflict behavior in `src/payments/payments.service.spec.ts:34-190`. PostgreSQL e2e coverage now exists in `test/payments.e2e-spec.ts:8-272`; it verifies owner/admin authorization, one pending payment, direct success and failure retries, signed webhook success/failure/replay/conflict behavior, and invalid signatures. The suite runs when `DATABASE_URL` is configured.

## Related

- `src/payments/payments.service.ts`
- `src/bookings/bookings.service.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20261002190000_add_failed_booking_status/migration.sql`
- `test/payments.e2e-spec.ts`
