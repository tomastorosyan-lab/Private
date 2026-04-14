"""change_user_types_to_supplier_and_customer

Revision ID: babf7999377c
Revises: 2714051bd534
Create Date: 2025-12-18 23:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'babf7999377c'
down_revision = '2714051bd534'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Создаем новый enum
    op.execute("CREATE TYPE usertype_new AS ENUM ('SUPPLIER', 'CUSTOMER', 'ADMIN')")
    
    # Добавляем временную колонку с новым типом
    op.add_column('users', sa.Column('user_type_new', postgresql.ENUM('SUPPLIER', 'CUSTOMER', 'ADMIN', name='usertype_new', create_type=False), nullable=True))
    
    # Преобразуем старые значения в новые
    op.execute("""
        UPDATE users 
        SET user_type_new = CASE 
            WHEN user_type::text = 'STORE' THEN 'CUSTOMER'::usertype_new
            WHEN user_type::text = 'RESTAURANT' THEN 'CUSTOMER'::usertype_new
            WHEN user_type::text = 'DISTRIBUTOR' THEN 'SUPPLIER'::usertype_new
            WHEN user_type::text = 'ADMIN' THEN 'ADMIN'::usertype_new
            ELSE 'CUSTOMER'::usertype_new
        END
    """)
    
    # Удаляем старую колонку
    op.drop_column('users', 'user_type')
    
    # Переименовываем новую колонку
    op.alter_column('users', 'user_type_new', new_column_name='user_type', nullable=False)
    
    # Удаляем старый enum
    op.execute("DROP TYPE usertype")
    
    # Переименовываем новый enum
    op.execute("ALTER TYPE usertype_new RENAME TO usertype")


def downgrade() -> None:
    # Создаем старый enum
    op.execute("CREATE TYPE usertype_old AS ENUM ('STORE', 'RESTAURANT', 'DISTRIBUTOR', 'ADMIN')")
    
    # Добавляем временную колонку со старым типом
    op.add_column('users', sa.Column('user_type_old', postgresql.ENUM('STORE', 'RESTAURANT', 'DISTRIBUTOR', 'ADMIN', name='usertype_old', create_type=False), nullable=True))
    
    # Преобразуем новые значения в старые (по умолчанию CUSTOMER -> STORE, SUPPLIER -> DISTRIBUTOR)
    op.execute("""
        UPDATE users 
        SET user_type_old = CASE 
            WHEN user_type::text = 'CUSTOMER' THEN 'STORE'::usertype_old
            WHEN user_type::text = 'SUPPLIER' THEN 'DISTRIBUTOR'::usertype_old
            WHEN user_type::text = 'ADMIN' THEN 'ADMIN'::usertype_old
            ELSE 'STORE'::usertype_old
        END
    """)
    
    # Удаляем новую колонку
    op.drop_column('users', 'user_type')
    
    # Переименовываем старую колонку
    op.alter_column('users', 'user_type_old', new_column_name='user_type', nullable=False)
    
    # Удаляем новый enum
    op.execute("DROP TYPE usertype")
    
    # Переименовываем старый enum
    op.execute("ALTER TYPE usertype_old RENAME TO usertype")
