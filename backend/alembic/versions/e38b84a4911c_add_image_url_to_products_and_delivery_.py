"""add_image_url_to_products_and_delivery_address_to_users

Revision ID: e38b84a4911c
Revises: 56f25875af4e
Create Date: 2025-12-24 10:17:47.509589

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e38b84a4911c'
down_revision = '56f25875af4e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем поле image_url в таблицу products
    op.add_column('products', sa.Column('image_url', sa.String(), nullable=True))
    
    # Добавляем поле delivery_address в таблицу users
    op.add_column('users', sa.Column('delivery_address', sa.String(), nullable=True))


def downgrade() -> None:
    # Удаляем поле delivery_address из таблицы users
    op.drop_column('users', 'delivery_address')
    
    # Удаляем поле image_url из таблицы products
    op.drop_column('products', 'image_url')




