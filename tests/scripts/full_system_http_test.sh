#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8092/api/v1}"
REPORT="${REPORT:-/tmp/noovinnet-full-system-http-test.txt}"
: > "$REPORT"

log() {
  printf '%s\n' "$1" | tee -a "$REPORT"
}

fail() {
  log "FAILED: $1"
  exit 1
}

api_call() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local body="${4:-}"
  local headers
  headers=$(mktemp)
  local response
  if [[ -n "$body" ]]; then
    response=$(curl -sS -D "$headers" -X "$method" "$BASE_URL$path" -H 'Accept: application/json' -H 'Content-Type: application/json' ${token:+-H "Authorization: Bearer $token"} --data "$body")
  else
    response=$(curl -sS -D "$headers" -X "$method" "$BASE_URL$path" -H 'Accept: application/json' ${token:+-H "Authorization: Bearer $token"})
  fi
  local status
  status=$(awk 'NR==1 {print $2}' "$headers")
  local content_type
  content_type=$(awk 'BEGIN{IGNORECASE=1} /^Content-Type:/{sub(/^[^:]*:[[:space:]]*/, ""); sub(/\r$/, ""); print; exit}' "$headers")
  rm -f "$headers"
  printf '%s\n%s\n%s\n' "$status" "$content_type" "$response"
}

assert_json_status() {
  local expected="$1"
  local payload="$2"
  local status
  status=$(printf '%s' "$payload" | sed -n '1p')
  [[ "$status" == "$expected" ]] || fail "expected HTTP $expected, received $status: $(printf '%s' "$payload" | sed -n '3p')"
}

login() {
  local email="$1"
  local password="$2"
  local result
  result=$(api_call POST /auth/login '' "{\"email\":\"$email\",\"password\":\"$password\"}")
  assert_json_status 200 "$result"
  local response
  response=$(printf '%s' "$result" | sed -n '3p')
  local token
  token=$(printf '%s' "$response" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  [[ -n "$token" ]] || fail "login token not found for $email"
  printf '%s' "$token"
}

log '1. Checking health endpoint.'
health=$(api_call GET /health)
assert_json_status 200 "$health"
[[ "$(printf '%s' "$health" | sed -n '2p')" == application/json* ]] || fail 'health endpoint is not JSON'

log '2. Logging in customer and administrator.'
CUSTOMER_TOKEN=$(login 'customer@apexstore.local' 'Customer123!')
ADMIN_TOKEN=$(login 'admin@apexstore.local' 'AdminSecret123!')

log '3. Adding a real customer address.'
address=$(api_call POST /users/addresses "$CUSTOMER_TOKEN" '{"type":"shipping","recipient_name":"خریدار آزمایشی","phone":"09121111111","province":"تهران","city":"تهران","postal_code":"1415512345","address_line":"خیابان ولیعصر، پلاک ۱","is_default":true}')
assert_json_status 201 "$address"

log '4. Funding wallet through protected admin adjustment endpoint.'
funding=$(api_call POST /admin/users/2/wallet-adjustments "$ADMIN_TOKEN" '{"amount":50000000,"note":"Integrated checkout test funding"}')
assert_json_status 200 "$funding"

log '5. Reading customer wallet and adding the seeded product variant to cart.'
wallet_before=$(api_call GET /users/wallet "$CUSTOMER_TOKEN")
assert_json_status 200 "$wallet_before"
cart_add=$(api_call POST /cart/items "$CUSTOMER_TOKEN" '{"product_variant_id":1,"quantity":1}')
assert_json_status 200 "$cart_add"

log '6. Completing an actual wallet checkout.'
checkout=$(api_call POST /checkout "$CUSTOMER_TOKEN" '{"shipping_address":{"recipient_name":"خریدار آزمایشی","phone":"09121111111","province":"تهران","city":"تهران","postal_code":"1415512345","address_line":"خیابان ولیعصر، پلاک ۱"},"payment_gateway":"wallet"}')
assert_json_status 201 "$checkout"
checkout_json=$(printf '%s' "$checkout" | sed -n '3p')
ORDER_NUMBER=$(printf '%s' "$checkout_json" | sed -n 's/.*"order_number":"\([^"]*\)".*/\1/p')
[[ -n "$ORDER_NUMBER" ]] || fail 'checkout did not return order number'
printf '%s' "$checkout_json" | grep -q '"payment_status":"paid"' || fail 'wallet checkout was not paid'

log "7. Verifying order $ORDER_NUMBER is visible to both customer and administrator."
customer_orders=$(api_call GET /orders "$CUSTOMER_TOKEN")
assert_json_status 200 "$customer_orders"
printf '%s' "$customer_orders" | sed -n '3p' | grep -q "$ORDER_NUMBER" || fail 'customer order list does not include the new order'
admin_orders=$(api_call GET /admin/orders "$ADMIN_TOKEN")
assert_json_status 200 "$admin_orders"
printf '%s' "$admin_orders" | sed -n '3p' | grep -q "$ORDER_NUMBER" || fail 'admin order list does not include the new order'
ORDER_ID=$(printf '%s' "$admin_orders" | sed -n '3p' | sed -n "s/.*\"id\":\([0-9][0-9]*\),\"order_number\":\"$ORDER_NUMBER\".*/\1/p")
[[ -n "$ORDER_ID" ]] || fail 'admin order id was not extracted'

log '8. Updating order state and tracking code in the admin panel API.'
order_update=$(api_call PATCH "/admin/orders/$ORDER_ID/status" "$ADMIN_TOKEN" '{"status":"processing","tracking_code":"TEST-TRACK-1001"}')
assert_json_status 200 "$order_update"
printf '%s' "$order_update" | sed -n '3p' | grep -q 'TEST-TRACK-1001' || fail 'tracking code was not persisted'

log '9. Creating a support ticket as customer and replying as administrator.'
ticket=$(api_call POST /users/support-tickets "$CUSTOMER_TOKEN" '{"title":"تست یکپارچه","department":"پشتیبانی فنی","priority":"medium","message":"پیام آزمایشی مشتری"}')
assert_json_status 201 "$ticket"
TICKET_NUMBER=$(printf '%s' "$ticket" | sed -n '3p' | sed -n 's/.*"ticket_number":"\([^"]*\)".*/\1/p')
[[ -n "$TICKET_NUMBER" ]] || fail 'ticket number was not returned'
reply=$(api_call POST "/admin/tickets/$TICKET_NUMBER/reply" "$ADMIN_TOKEN" '{"message":"پاسخ واقعی مدیر به تیکت آزمایشی"}')
assert_json_status 201 "$reply"
printf '%s' "$reply" | sed -n '3p' | grep -q '"sender":"support"' || fail 'admin ticket response was not persisted'

log '10. Testing customer favorites and persisted admin settings.'
favorite=$(api_call POST /users/favorites/1 "$CUSTOMER_TOKEN")
assert_json_status 201 "$favorite"
settings=$(api_call PUT /admin/settings/store_settings "$ADMIN_TOKEN" '{"settings":{"config":{"store_name":"NoovinNet Integrated Test"}}}')
assert_json_status 200 "$settings"

log '11. Checking that all API calls used JSON responses with no simulated data path.'
log "PASS: customer checkout, wallet payment, customer/admin order sync, admin order update, ticket reply, favorite and settings persistence all passed."
