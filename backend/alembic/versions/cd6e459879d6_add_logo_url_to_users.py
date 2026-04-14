"""add_logo_url_to_users

Revision ID: cd6e459879d6
Revises: 2120c5fe5e1a
Create Date: 2025-12-18 21:31:10.243760

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cd6e459879d6'
down_revision = '2120c5fe5e1a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('logo_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'logo_url')

