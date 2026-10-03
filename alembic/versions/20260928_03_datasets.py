"""Create project-scoped dataset storage."""
from alembic import op
import sqlalchemy as sa

revision = "20260928_03"
down_revision = "20260928_02"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("signal_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("point_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_datasets_id", "datasets", ["id"])
    op.create_index("ix_datasets_user_id", "datasets", ["user_id"])
    op.create_index("ix_datasets_project_id", "datasets", ["project_id"])

def downgrade() -> None:
    op.drop_index("ix_datasets_project_id", table_name="datasets")
    op.drop_index("ix_datasets_user_id", table_name="datasets")
    op.drop_index("ix_datasets_id", table_name="datasets")
    op.drop_table("datasets")
