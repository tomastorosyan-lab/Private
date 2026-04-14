"""
Главный роутер API v1
"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth, products, orders, distributors, inventory, categories

api_router = APIRouter()

# Теги уже определены в каждом роутере, поэтому здесь не дублируем
api_router.include_router(auth.router, prefix="/auth")
api_router.include_router(products.router, prefix="/products")
api_router.include_router(orders.router, prefix="/orders")
api_router.include_router(distributors.router, prefix="/distributors")
api_router.include_router(inventory.router, prefix="/inventory")
api_router.include_router(categories.router, prefix="/categories")

