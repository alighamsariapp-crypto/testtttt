# Shared Kernel Module (`App\Modules\Shared`)

## Overview
The **Shared Kernel** provides cross-cutting domain primitives, value objects, immutable DTO abstractions, exception classes, and security helpers used across all future domain modules (Auth, Users, Products, Categories, Cart, Orders, Inventory, Payments, Services, Admin).

## Components

### 1. Value Objects
- **`Money`** (`ValueObjects/Money.php`):
  - Immutable currency value object storing amounts as exact integers in the smallest currency unit (e.g. IRR / Cents).
  - Eliminates IEEE 754 floating-point inaccuracies.
  - Supports `add()`, `subtract()`, `multiply()`, `isGreaterThan()`, `isLessThan()`, `isEqualTo()`, and `isZero()`. Throws on negative subtraction or currency mismatches.

### 2. Data Transfer Objects (DTOs)
- **`BaseDTO`** (`DTOs/BaseDTO.php`):
  - Abstract typed DTO with reflection-based `fromArray()`, `toArray()`, and JSON serialization.

### 3. Security & Formatting Helpers
- **`RedactionHelper`** (`Helpers/RedactionHelper.php`):
  - Recursively scrubs passwords, tokens, API keys, card numbers, and credentials from nested arrays before writing to logs.
- **`ApiResponseHelper`** (`Helpers/ApiResponseHelper.php`):
  - Generates unified JSON payloads (`success`, `data`, `message`, `error_code`, `errors`).

### 4. Exceptions
- `DomainException.php` (Base exception)
- `EntityNotFoundException.php` (HTTP 404)
- `UnauthorizedActionException.php` (HTTP 403)
- `ValidationException.php` (HTTP 422)

### 5. Middleware
- **`SecurityHeaders`**: Safe-by-default, configurable HTTP headers.
- **`ForceJsonResponse`**: Enforces `application/json` accept header for all `/api/*` routes.
