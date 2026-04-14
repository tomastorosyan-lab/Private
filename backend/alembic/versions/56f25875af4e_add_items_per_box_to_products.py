"""add_items_per_box_to_products

Revision ID: 56f25875af4e
Revises: cd6e459879d6
Create Date: 2025-12-19 20:25:56.911950

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '56f25875af4e'
down_revision = 'cd6e459879d6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем колонку items_per_box
    op.add_column('products', sa.Column('items_per_box', sa.Integer(), nullable=True))
    
    # Обновляем unit для всех товаров на "шт" если не указано
    op.execute("UPDATE products SET unit = 'шт' WHERE unit IS NULL OR unit = ''")


def downgrade() -> None:
    # Удаляем колонку items_per_box
    op.drop_column('products', 'items_per_box')

