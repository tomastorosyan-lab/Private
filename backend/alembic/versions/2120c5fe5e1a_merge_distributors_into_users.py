"""merge_distributors_into_users

Revision ID: 2120c5fe5e1a
Revises: babf7999377c
Create Date: 2025-12-18 23:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '2120c5fe5e1a'
down_revision = 'babf7999377c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Добавляем новые поля в таблицу users
    op.add_column('users', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('contact_phone', sa.String(), nullable=True))
    op.add_column('users', sa.Column('integration_type', sa.String(), nullable=True))
    op.add_column('users', sa.Column('integration_config', postgresql.JSON(), nullable=True))
    
    # 2. Переносим данные из distributors в users для поставщиков
    op.execute("""
        UPDATE users u
        SET 
            description = d.description,
            contact_phone = d.contact_phone,
            integration_type = d.integration_type,
            integration_config = d.integration_config
        FROM distributors d
        WHERE u.email = d.contact_email 
        AND u.user_type::text = 'SUPPLIER'
    """)
    
    # 3. Создаем временные колонки для изменения внешних ключей
    # Products
    op.add_column('products', sa.Column('supplier_id', sa.Integer(), nullable=True))
    op.execute("""
        UPDATE products p
        SET supplier_id = u.id
        FROM distributors d
        JOIN users u ON u.email = d.contact_email AND u.user_type::text = 'SUPPLIER'
        WHERE p.distributor_id = d.id
    """)
    op.alter_column('products', 'supplier_id', nullable=False)
    op.drop_constraint('products_distributor_id_fkey', 'products', type_='foreignkey')
    op.drop_column('products', 'distributor_id')
    op.create_foreign_key('products_supplier_id_fkey', 'products', 'users', ['supplier_id'], ['id'])
    
    # Orders
    op.add_column('orders', sa.Column('supplier_id', sa.Integer(), nullable=True))
    op.execute("""
        UPDATE orders o
        SET supplier_id = u.id
        FROM distributors d
        JOIN users u ON u.email = d.contact_email AND u.user_type::text = 'SUPPLIER'
        WHERE o.distributor_id = d.id
    """)
    op.alter_column('orders', 'supplier_id', nullable=False)
    op.drop_constraint('orders_distributor_id_fkey', 'orders', type_='foreignkey')
    op.drop_column('orders', 'distributor_id')
    op.create_foreign_key('orders_supplier_id_fkey', 'orders', 'users', ['supplier_id'], ['id'])
    
    # Inventory
    op.add_column('inventory', sa.Column('supplier_id', sa.Integer(), nullable=True))
    op.execute("""
        UPDATE inventory i
        SET supplier_id = u.id
        FROM distributors d
        JOIN users u ON u.email = d.contact_email AND u.user_type::text = 'SUPPLIER'
        WHERE i.distributor_id = d.id
    """)
    op.alter_column('inventory', 'supplier_id', nullable=False)
    op.drop_constraint('inventory_distributor_id_fkey', 'inventory', type_='foreignkey')
    op.drop_column('inventory', 'distributor_id')
    op.create_foreign_key('inventory_supplier_id_fkey', 'inventory', 'users', ['supplier_id'], ['id'])
    
    # 4. Удаляем таблицу distributors (после того как все ссылки удалены)
    op.drop_table('distributors')


def downgrade() -> None:
    # Восстанавливаем таблицу distributors
    op.create_table('distributors',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('contact_email', sa.String(), nullable=True),
        sa.Column('contact_phone', sa.String(), nullable=True),
        sa.Column('integration_type', sa.String(), nullable=True),
        sa.Column('integration_config', postgresql.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_distributors_id'), 'distributors', ['id'], unique=False)
    op.create_index(op.f('ix_distributors_name'), 'distributors', ['name'], unique=False)
    
    # Восстанавливаем distributor_id колонки
    # Inventory
    op.add_column('inventory', sa.Column('distributor_id', sa.Integer(), nullable=True))
    op.execute("""
        UPDATE inventory i
        SET distributor_id = (
            SELECT d.id FROM distributors d 
            JOIN users u ON u.email = d.contact_email 
            WHERE u.id = i.supplier_id 
            LIMIT 1
        )
    """)
    op.alter_column('inventory', 'distributor_id', nullable=False)
    op.drop_constraint('inventory_supplier_id_fkey', 'inventory', type_='foreignkey')
    op.drop_column('inventory', 'supplier_id')
    op.create_foreign_key('inventory_distributor_id_fkey', 'inventory', 'distributors', ['distributor_id'], ['id'])
    
    # Orders
    op.add_column('orders', sa.Column('distributor_id', sa.Integer(), nullable=True))
    op.execute("""
        UPDATE orders o
        SET distributor_id = (
            SELECT d.id FROM distributors d 
            JOIN users u ON u.email = d.contact_email 
            WHERE u.id = o.supplier_id 
            LIMIT 1
        )
    """)
    op.alter_column('orders', 'distributor_id', nullable=False)
    op.drop_constraint('orders_supplier_id_fkey', 'orders', type_='foreignkey')
    op.drop_column('orders', 'supplier_id')
    op.create_foreign_key('orders_distributor_id_fkey', 'orders', 'distributors', ['distributor_id'], ['id'])
    
    # Products
    op.add_column('products', sa.Column('distributor_id', sa.Integer(), nullable=True))
    op.execute("""
        UPDATE products p
        SET distributor_id = (
            SELECT d.id FROM distributors d 
            JOIN users u ON u.email = d.contact_email 
            WHERE u.id = p.supplier_id 
            LIMIT 1
        )
    """)
    op.alter_column('products', 'distributor_id', nullable=False)
    op.drop_constraint('products_supplier_id_fkey', 'products', type_='foreignkey')
    op.drop_column('products', 'supplier_id')
    op.create_foreign_key('products_distributor_id_fkey', 'products', 'distributors', ['distributor_id'], ['id'])
    
    # Удаляем поля из users
    op.drop_column('users', 'integration_config')
    op.drop_column('users', 'integration_type')
    op.drop_column('users', 'contact_phone')
    op.drop_column('users', 'description')
