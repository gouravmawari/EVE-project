# Diagnostic Booking API

The Diagnostic Booking API manages diagnostic centres, tests, authenticated bookings, and payment state transitions through PostgreSQL and Prisma.

## Contents

- [Conventions](#conventions)
- [Health](#health)
- [Authentication](#authentication)
- [Diagnostic centres](#diagnostic-centres)
- [Diagnostic tests](#diagnostic-tests)
- [Bookings](#bookings)
- [Payments](#payments)
- [Data model](#data-model)
- [Postman test sequence](#postman-test-sequence)
- [Known limitations](#known-limitations)

## Conventions

### Base URL

Use `http://localhost:3000` for a local process. Docker Compose exposes the API at `http://localhost:3001` by default.

### Requests and authentication

- Send JSON requests with `Content-Type: application/json`.
- Send JWT-protected requests with `Authorization: Bearer <access-token>`.
- Public endpoints require no JWT. Admin endpoints require a user with the `ADMIN` role.
- Validation rejects unknown JSON properties and validates UUIDs, email, passwords, ISO 8601 timestamps, enums, names, addresses, prices, and pagination values.
- Decimal prices and amounts are returned as strings.

### Pagination

`GET /diagnostic-centres`, `GET /diagnostic-tests`, and `GET /bookings` accept `page` (default `1`, integer minimum `1`) and `limit` (default `20`, integer `1` through `100`). Responses use:

```json
{
  "data": [],
  "page": 1,
  "limit": 20,
  "total": 0
}
```

### Errors

Errors use this stable envelope. `message` may be a string or a validation-error array.

```json
{
  "statusCode": 400,
  "message": "Request-specific message",
  "error": "Request Error",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "path": "/resource"
}
```

Unexpected errors use status `500` and `error: "Internal Server Error"`.

## Health

### `GET /health`

**Auth:** None

**Success `200`:**

```json
{
  "status": "ok"
}
```

## Authentication

### `POST /auth/signup`

**Auth:** None

**Request JSON:**

```json
{
  "email": "user@example.com",
  "password": "<your-password>"
}
```

Password must be at least 8 characters.

**Success `201`:**

```json
{
  "accessToken": "<jwt-access-token>",
  "user": {
    "id": "00000000-0000-4000-8000-000000000001",
    "email": "user@example.com",
    "role": "USER"
  }
}
```

**Errors:** `400` invalid input; `409` email already registered.

### `POST /auth/login`

Verifies credentials and returns the same response shape as signup.

**Auth:** None

**Request JSON:**

```json
{
  "email": "user@example.com",
  "password": "<your-password>"
}
```

**Success `201`:** Same shape as signup.

**Errors:** `400` invalid input; `401` invalid credentials.

## Diagnostic centres

### `GET /diagnostic-centres`

Lists centres ordered by name.

**Auth:** None  
**Query:** `page`, `limit` as described in [Pagination](#pagination).

**Success `200`:** A paginated response whose items contain `id`, `name`, `address`, and `createdAt`.

```json
{
  "data": [
    {
      "id": "00000000-0000-4000-8000-000000000010",
      "name": "Central Lab",
      "address": "1 Example Street",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

**Errors:** `400` invalid pagination.

### `POST /diagnostic-centres`

**Auth:** Admin JWT

**Request JSON:**

```json
{
  "name": "Central Lab",
  "address": "1 Example Street"
}
```

`name` is required and limited to 120 characters. `address` is required and limited to 500 characters.

**Success `201`:** Returns the created centre object.

```json
{
  "id": "00000000-0000-4000-8000-000000000010",
  "name": "Central Lab",
  "address": "1 Example Street",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

**Errors:** `400` invalid input; `401` missing or invalid JWT; `403` non-admin user.

### `PATCH /diagnostic-centres/:id`

**Auth:** Admin JWT  
**Path:** `id` is the centre UUID.  
**Request JSON:** Same as `POST /diagnostic-centres`.

**Success `200`:** Returns the updated centre object.

```json
{
  "id": "00000000-0000-4000-8000-000000000010",
  "name": "Central Lab",
  "address": "1 Example Street",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

**Errors:** `400` invalid input; `401` missing or invalid JWT; `403` non-admin; `404` centre not found.

### `DELETE /diagnostic-centres/:id`

**Auth:** Admin JWT  
**Path:** `id` is the centre UUID.

**Success `200`:** Returns the deleted centre object.

```json
{
  "id": "00000000-0000-4000-8000-000000000010",
  "name": "Central Lab",
  "address": "1 Example Street",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

**Errors:** `401` missing or invalid JWT; `403` non-admin; `404` centre not found; `409` centre is referenced by tests or bookings.

## Diagnostic tests

### `GET /diagnostic-tests`

Lists tests ordered by name; each item includes its centre.

**Auth:** None  
**Query:** `page`, `limit` as described in [Pagination](#pagination).

**Success `200`:** A paginated response. Each test contains `id`, `name`, `price`, `centreId`, and a `centre` object.

```json
{
  "data": [
    {
      "id": "00000000-0000-4000-8000-000000000020",
      "name": "Blood test",
      "price": "25.00",
      "centreId": "00000000-0000-4000-8000-000000000010",
      "centre": {
        "id": "00000000-0000-4000-8000-000000000010",
        "name": "Central Lab",
        "address": "1 Example Street",
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

**Errors:** `400` invalid pagination.

### `POST /diagnostic-tests`

**Auth:** Admin JWT

**Request JSON:**

```json
{
  "name": "Blood test",
  "price": "25.00",
  "centreId": "00000000-0000-4000-8000-000000000010"
}
```

`price` is a non-negative decimal with up to two fractional digits; `name` is limited to 120 characters.

**Success `201`:** Returns the created test object.

```json
{
  "id": "00000000-0000-4000-8000-000000000020",
  "name": "Blood test",
  "price": "25.00",
  "centreId": "00000000-0000-4000-8000-000000000010"
}
```

**Errors:** `400` invalid input; `401` missing or invalid JWT; `403` non-admin; `404` centre not found.

### `PATCH /diagnostic-tests/:id`

**Auth:** Admin JWT  
**Path:** `id` is the test UUID.  
**Request JSON:** Same as `POST /diagnostic-tests`.

**Success `200`:** Returns the updated test object.

```json
{
  "id": "00000000-0000-4000-8000-000000000020",
  "name": "Blood test",
  "price": "25.00",
  "centreId": "00000000-0000-4000-8000-000000000010"
}
```

**Errors:** `400` invalid input; `401` missing or invalid JWT; `403` non-admin; `404` test or centre not found; `409` a booked test cannot change centre or price.

### `DELETE /diagnostic-tests/:id`

**Auth:** Admin JWT  
**Path:** `id` is the test UUID.

**Success `200`:** Returns the deleted test object.

```json
{
  "id": "00000000-0000-4000-8000-000000000020",
  "name": "Blood test",
  "price": "25.00",
  "centreId": "00000000-0000-4000-8000-000000000010"
}
```

**Errors:** `401` missing or invalid JWT; `403` non-admin; `404` test not found; `409` test has bookings or cannot be deleted because of a database relation.

## Bookings

Bookings belong to the authenticated user unless the caller is an admin. Appointment times must be in the future, and the test must belong to the selected centre.

### `POST /bookings`

Creates a pending booking and captures the current test price as its amount.

**Auth:** User or admin JWT

**Request JSON:**

```json
{
  "centreId": "00000000-0000-4000-8000-000000000010",
  "testId": "00000000-0000-4000-8000-000000000020",
  "appointmentAt": "2099-01-01T10:00:00.000Z"
}
```

**Success `201`:** Returns the booking with an amount string.

```json
{
  "id": "00000000-0000-4000-8000-000000000030",
  "userId": "00000000-0000-4000-8000-000000000001",
  "centreId": "00000000-0000-4000-8000-000000000010",
  "testId": "00000000-0000-4000-8000-000000000020",
  "appointmentAt": "2099-01-01T10:00:00.000Z",
  "amount": "25.00",
  "status": "PENDING",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

**Errors:** `400` invalid input, past appointment, or test/centre mismatch; `401` missing or invalid JWT; `409` duplicate active booking.

### `GET /bookings`

Lists bookings. Regular users see their own; admins see all. Items include centre, test, and payment relations.

**Auth:** User or admin JWT  
**Query:** `page`, `limit` as described in [Pagination](#pagination).

**Success `200`:** Paginated booking objects.

```json
{
  "data": [],
  "page": 1,
  "limit": 20,
  "total": 0
}
```

**Errors:** `400` invalid pagination; `401` missing or invalid JWT.

### `GET /bookings/:id`

Returns one booking with centre, test, and payment relations.

**Auth:** User or admin JWT  
**Path:** `id` is the booking UUID.

**Success `200`:** Returns the booking object with its related objects.

```json
{
  "id": "00000000-0000-4000-8000-000000000030",
  "status": "PENDING",
  "amount": "25.00",
  "centre": {},
  "test": {},
  "payment": null
}
```

**Errors:** `401` missing or invalid JWT; `403` booking belongs to another user; `404` booking not found.

### `PATCH /bookings/:id`

Cancels a pending booking.

**Auth:** User or admin JWT  
**Path:** `id` is the booking UUID.

**Request JSON:**

```json
{
  "status": "CANCELLED"
}
```

**Success `200`:** Returns the updated booking with `status: "CANCELLED"`.

```json
{
  "id": "00000000-0000-4000-8000-000000000030",
  "status": "CANCELLED"
}
```

**Errors:** `400` status is not `CANCELLED`; `401` missing or invalid JWT; `403` booking belongs to another user; `404` booking not found; `409` booking is no longer pending.

## Payments

### Lifecycle and preparation flow

New bookings start `PENDING`. A prepared payment starts `PENDING`. `SUCCESS` changes the payment to `SUCCESS` and the booking to `CONFIRMED`; `FAILED` changes the payment to `FAILED` and the booking to `FAILED`. A pending booking can instead be cancelled, changing the booking to `CANCELLED`. Payment transitions are terminal and cannot be reversed.

The client flow is: sign up or log in, use the JWT to create a booking, call `POST /payments/prepare`, then apply an outcome with `POST /payments` or the signed webhook. Preparation and direct payment require the booking owner or an admin; they are not unauthenticated endpoints.

### `POST /payments/prepare`

Creates the booking's single pending payment. Repeating the request while the payment is pending returns the same result without creating another payment.

**Auth:** Booking owner or admin JWT

**Request JSON:**

```json
{
  "bookingId": "00000000-0000-4000-8000-000000000030"
}
```

**Success `201`:**

```json
{
  "bookingId": "00000000-0000-4000-8000-000000000030",
  "status": "PENDING"
}
```

**Errors:** `400` invalid UUID; `401` missing or invalid JWT; `404` booking not found or inaccessible; `409` booking is not pending, payment is terminal, or a concurrent state change requires retry.

### `POST /payments`

Applies a direct payment outcome and is idempotent for a repeated matching terminal outcome.

**Auth:** Booking owner or admin JWT

**Request JSON:**

```json
{
  "bookingId": "00000000-0000-4000-8000-000000000030",
  "outcome": "SUCCESS"
}
```

`outcome` must be `SUCCESS` or `FAILED`. A pending payment need not already exist; this endpoint can create it atomically.

**Success `201`:**

```json
{
  "bookingId": "00000000-0000-4000-8000-000000000030",
  "status": "SUCCESS"
}
```

Repeating the same outcome returns the same response. The opposite outcome returns `409` without changing state.

**Errors:** `400` invalid input; `401` missing or invalid JWT; `404` booking not found or inaccessible; `409` terminal, inconsistent, no-longer-pending, or concurrently changed state.

### `POST /payments/webhook`

Accepts a provider outcome for a payment that has already been prepared.

**Auth:** No JWT; HMAC signature required.

**Headers:**

```text
Content-Type: application/json
x-provider-signature: <hex-hmac-sha256>
```

Compute lowercase hexadecimal HMAC-SHA256 over the exact raw request-body bytes using the server's `WEBHOOK_SECRET` as the key. The parsed JSON must match the signed bytes.

**Request JSON:**

```json
{
  "providerEventId": "00000000-0000-4000-8000-000000000040",
  "bookingId": "00000000-0000-4000-8000-000000000030",
  "outcome": "SUCCESS"
}
```

The booking and its payment must both be `PENDING`. `providerEventId` is the idempotency key.

**Success `201` (first event):**

```json
{
  "accepted": true,
  "replay": false
}
```

An identical signed event returns `201` with `"replay": true` and does not apply the transition again. Reusing an event ID with a different payload returns `409`. Invalid signatures return `401` before state changes.

**Errors:** `400` invalid event data; `401` missing or invalid signature; `409` conflicting payload, invalid transition, payment no longer pending, or concurrent state change.

## Data model

- **User:** UUID, unique email, role (`USER` or `ADMIN`), and password hash. Passwords are never returned.
- **DiagnosticCentre:** UUID, name, address, and related tests/bookings.
- **DiagnosticTest:** UUID, name, two-decimal price string, and required centre.
- **Booking:** UUID, user, centre, test, future appointment time, captured amount string, status (`PENDING`, `CONFIRMED`, `FAILED`, or `CANCELLED`), and optional payment.
- **Payment:** One per booking, with status `PENDING`, `SUCCESS`, or `FAILED`.
- **WebhookEvent:** Unique provider event ID and payload hash for replay detection.

Relations use restrictive deletes, so referenced centres and tests cannot be removed accidentally.

## Postman test sequence

1. Call `GET /health`.
2. Call `POST /auth/signup` and save `accessToken`.
3. Call `POST /auth/login` to verify credentials and obtain a current token.
4. With an admin token, create a centre, then a test using its UUID.
5. With the regular user token, list centres and tests.
6. Create a future booking, list it, fetch it by ID, and optionally cancel it while pending.
7. Prepare a separate booking and repeat `POST /payments/prepare` to verify idempotency.
8. Complete it with `POST /payments` using `SUCCESS` or `FAILED`; repeat the same outcome, then verify the opposite returns `409`.
9. For webhook testing, prepare another booking, sign the exact JSON bytes with `WEBHOOK_SECRET`, send `x-provider-signature`, repeat the event, and verify changed reuse returns `409`.

## Known limitations

- Payment endpoints model provider outcomes; they are not a real payment gateway.
- Webhook delivery requires exact raw-body HMAC signing and does not provide HTTPS itself.
- Rate limiting is in-memory and process-local, not shared across API instances.
- Catalogue filtering, sorting, API schema generation, and production deployment configuration are not implemented.
- The e2e suite does not cover every catalogue and booking concurrency case.

The legacy `/users` scaffold routes are intentionally unsupported and excluded from this reference. They are not part of the supported user-management API.
