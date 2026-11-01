"""Persist raw datasets so analyses can be reopened."""
from alembic import op
import sqlalchemy as sa

revision = "20260928_02"
down_revision = "20260928_01"
branch_labels = None
depends_on = None

def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("analysis_sessions")}
    if "dataset_text" not in columns:
        with op.batch_alter_table("analysis_sessions", schema=None) as batch_op:
            batch_op.add_column(sa.Column("dataset_text", sa.Text(), nullable=False, server_default=""))

def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("analysis_sessions")}
    if "dataset_text" in columns:
        with op.batch_alter_table("analysis_sessions", schema=None) as batch_op:
            batch_op.drop_column("dataset_text")
