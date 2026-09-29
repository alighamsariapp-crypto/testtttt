#!/usr/bin/env python3
"""Local-only customer purchase acceptance test.
Never target production: this script exits unless the base URL is loopback.
"""
from __future__ import annotations

import json
import sys
import time
from decimal import Decimal
from pathlib import Path
from typing import Any

import requests

BASE_URL = "http://127.0.0.1:8000"
API = f"{BASE_URL}/api/v1"
REPORT_PATH = Path(__file__).resolve().parents[2] / ".customer-purchase-acceptance-result.json"

if not BASE_URL.startswith(("http://127.0.0.1", "http://localhost")):
    raise SystemExit("Safety stop: acceptance test may only target the local environment.")

results: list[dict[str, Any]] = []


def as_decimal(value: Any) -> Decimal:
    return Decimal(str(value or 0))


def check(condition: bool, name: str, detail: str, **extra: Any) -> None:
    record = {"name": name, "passed": bool(condition), "detail": detail, **extra}
    results.append(record)
    if not condition:
        raise AssertionError(f"{name}: {detail}")


def request(method: str, path: str, *, token: str | None = None, **kwargs: Any) -> requests.Response:
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    response = requests.request(method, f"{API}{path}", headers=headers, timeout=15, **kwargs)
    return response


def data_of(response: requests.Response) -> dict[str, Any]:
    body = response.json()
    if not body.get("success"):
        raise AssertionError(f"API unsuccessful: {response.status_code} {body}")
    return body.get("data") or {}


def select_sellable_variant(products: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any], int]:
    candidates: list[tuple[int, int, dict[str, Any], dict[str, Any]]] = []
    for product in products:
        for variant in product.get("variants") or []:
            active = variant.get("is_active") is True
            inventory = variant.get("inventory") or {}
            stock = int(variant.get("stock_quantity") or (int(inventory.get("quantity") or 0) - int(inventory.get("reserved_quantity") or 0)))
            if active and stock >= 3:
                color_score = 1 if (variant.get("attributes") or {}).get("color") else 0
                candidates.append((color_score, stock, product, variant))
    if not candidates:
        raise AssertionError("No active product variant with at least three units is available locally.")
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    _, stock, product, variant = candidates[0]
    return product, variant, stock


def main() -> None:
    started = int(time.time())
    email = f"acceptance.customer.{started}@local.test"
    password = "LocalAccept#2026"

    health = request("GET", "/health")
    check(health.status_code == 200 and health.json().get("success") is True, "A0 سلامت API", "API محلی پاسخ سالم داد.")

    registration = request("POST", "/auth/register", json={
        "name": "مشتری آزمون پذیرش",
        "email": email,
        "phone": f"0912{str(started)[-7:]}",
        "password": password,
        "password_confirmation": password,
    })
    register_data = data_of(registration)
    token = register_data.get("token")
    check(registration.status_code == 201 and bool(token), "A1 ثبت‌نام مشتری", "حساب مشتری آزمایشی و token ساخته شد.", email=email)

    me = request("GET", "/auth/me", token=token)
    me_data = data_of(me)
    check(me.status_code == 200 and me_data.get("email") == email, "A1 ورود و نشست مشتری", "نشست Sanctum مشتری معتبر است.")

    catalog = request("GET", "/products?per_page=100")
    catalog_data = data_of(catalog)
    products = catalog_data.get("data", catalog_data if isinstance(catalog_data, list) else [])
    product, variant, available_stock = select_sellable_variant(products)
    product_slug = product.get("slug")
    variant_id = variant.get("id")
    check(bool(product_slug and variant_id), "A2 کاتالوگ و variant", "یک variant فعال و قابل فروش برای آزمون پیدا شد.", product=product.get("name"), variant=variant.get("name"), available_stock=available_stock)

    detail = request("GET", f"/products/{product_slug}")
    detail_data = data_of(detail)
    detail_variants = detail_data.get("variants") or []
    selected_live_variant = next((row for row in detail_variants if row.get("id") == variant_id), None)
    check(selected_live_variant is not None and selected_live_variant.get("is_active") is True, "A2 جزئیات محصول", "variant انتخاب‌شده در صفحهٔ جزئیات فعال است.")

    added = request("POST", "/cart/items", token=token, json={"product_variant_id": variant_id, "quantity": 1})
    added_data = data_of(added)
    cart_items = added_data.get("items") or []
    cart_item = next((row for row in cart_items if row.get("variant_id") == variant_id), None)
    check(added.status_code == 200 and cart_item is not None, "A3 افزودن به سبد", "variant فعال با موفقیت به سبد مشتری افزوده شد.")
    cart_item_id = cart_item.get("id")

    raised = request("PATCH", f"/cart/items/{cart_item_id}", token=token, json={"quantity": 2})
    raised_data = data_of(raised)
    raised_item = next((row for row in raised_data.get("items") or [] if row.get("id") == cart_item_id), None)
    check(raised.status_code == 200 and int((raised_item or {}).get("quantity") or 0) == 2, "A4 افزایش تعداد", "تعداد سبد تا مقدار مجاز افزایش یافت.")

    lowered = request("PATCH", f"/cart/items/{cart_item_id}", token=token, json={"quantity": 1})
    lowered_data = data_of(lowered)
    lowered_item = next((row for row in lowered_data.get("items") or [] if row.get("id") == cart_item_id), None)
    check(lowered.status_code == 200 and int((lowered_item or {}).get("quantity") or 0) == 1, "A4 کاهش تعداد", "کاهش تعداد سبد صحیح است.")

    overstock = request("PATCH", f"/cart/items/{cart_item_id}", token=token, json={"quantity": available_stock + 1})
    overstock_body = overstock.json()
    check(overstock.status_code in (400, 422) and overstock_body.get("success") is False and overstock_body.get("error_code") == "INSUFFICIENT_STOCK", "A5 سقف موجودی و ناموجودی", "افزایش بالاتر از موجودی فعال توسط سرور رد شد.", status=overstock.status_code)

    cart_after_rejection = request("GET", "/cart", token=token)
    cart_after_data = data_of(cart_after_rejection)
    current_item = next((row for row in cart_after_data.get("items") or [] if row.get("id") == cart_item_id), None)
    check(int((current_item or {}).get("quantity") or 0) == 1, "A6 پایداری سبد پس از خطا", "پس از رد افزایش، مقدار معتبر سبد بدون تغییر ماند.")

    subtotal = as_decimal(cart_after_data.get("subtotal"))
    grand_total = as_decimal(cart_after_data.get("grand_total"))
    check(subtotal > 0 and grand_total >= subtotal, "A7 جمع مبالغ سبد", "subtotal و grand_total معتبر و غیرمنفی هستند.", subtotal=str(subtotal), grand_total=str(grand_total))

    checkout = request("POST", "/checkout", token=token, json={
        "shipping_address": {
            "recipient_name": "مشتری آزمون پذیرش",
            "phone": "09123456789",
            "province": "تهران",
            "city": "تهران",
            "postal_code": "1234567890",
            "address_line": "نشانی صرفاً برای آزمون محلی",
        },
        "payment_gateway": "test",
    })
    checkout_data = data_of(checkout)
    intent = checkout_data.get("payment_intent") or {}
    reference = intent.get("reference") or intent.get("reference_id")
    order_id = checkout_data.get("order_id")
    check(checkout.status_code == 201 and checkout_data.get("status") == "pending" and bool(order_id and reference), "A8 checkout آزمایشی", "سفارش pending و payment intent test ساخته شد.", order_id=order_id, reference=reference)
    check(as_decimal(checkout_data.get("grand_total")) == grand_total, "A8 جمع سفارش", "جمع سفارش با جمع سبد پیش از checkout یکسان است.")

    admin_login = request("POST", "/auth/login", json={"email": "admin@apexstore.local", "password": "AdminPass#2026"})
    admin_token = data_of(admin_login).get("token")
    paid = request("POST", "/payments/test/simulate", token=admin_token, json={"reference": reference, "reason": "acceptance_test"})
    paid_data = data_of(paid)
    check(paid.status_code == 200, "A9 پرداخت آزمایشی", "gateway test با احراز هویت ادمین بدون تراکنش واقعی پرداخت را شبیه‌سازی کرد.")

    order = request("GET", f"/orders/{order_id}", token=token)
    order_data = data_of(order)
    check(order.status_code == 200 and order_data.get("status") == "paid", "A9 وضعیت سفارش پس از پرداخت", "سفارش پس از شبیه‌سازی پرداخت به paid رسید.")

    detail_after = request("GET", f"/products/{product_slug}")
    detail_after_data = data_of(detail_after)
    after_variant = next((row for row in detail_after_data.get("variants") or [] if row.get("id") == variant_id), None)
    after_inventory = (after_variant or {}).get("inventory") or {}
    after_stock = int((after_variant or {}).get("stock_quantity") or (int(after_inventory.get("quantity") or 0) - int(after_inventory.get("reserved_quantity") or 0)))
    check(after_stock == available_stock - 1, "A9 همگام‌سازی موجودی پس از checkout", "موجودی variant دقیقاً به‌اندازهٔ سفارش کم شد.", before=available_stock, after=after_stock)

    results.append({"name": "نتیجهٔ کلی", "passed": True, "detail": "تمام سناریوهای پذیرش مشتری محلی با gateway test موفق بودند."})


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # Preserve the full failure in a local report.
        results.append({"name": "نتیجهٔ کلی", "passed": False, "detail": str(exc)})
        REPORT_PATH.write_text(json.dumps({"results": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"results": results}, ensure_ascii=False, indent=2))
        sys.exit(1)
    REPORT_PATH.write_text(json.dumps({"results": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"results": results}, ensure_ascii=False, indent=2))
