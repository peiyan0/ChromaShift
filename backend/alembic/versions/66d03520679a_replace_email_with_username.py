"""replace_email_with_username

Revision ID: 66d03520679a
Revises: 36cbaf3fa4fc
Create Date: 2026-06-15 03:35:19.570991

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '66d03520679a'
down_revision: Union[str, Sequence[str], None] = '36cbaf3fa4fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add column as nullable first
    op.add_column('users', sa.Column('username', sa.String(), nullable=True))
    # Populate with existing email values
    op.execute("UPDATE users SET username = email")
    # Make column NOT NULL using batch operations for SQLite compatibility
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('username', nullable=False)
        batch_op.drop_index('ix_users_email')
        batch_op.drop_column('email')
        batch_op.create_index(op.f('ix_users_username'), ['username'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('users', sa.Column('email', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.execute("UPDATE users SET email = username || '@example.com'")
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('email', nullable=False)
        batch_op.drop_index(op.f('ix_users_username'))
        batch_op.drop_column('username')
        batch_op.create_index('ix_users_email', ['email'], unique=True)
