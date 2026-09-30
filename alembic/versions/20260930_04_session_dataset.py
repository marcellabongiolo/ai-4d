"""Link analysis sessions to persisted datasets."""
from alembic import op
import sqlalchemy as sa

revision = "20260930_04"
down_revision = "20260928_03"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("analysis_sessions", sa.Column("dataset_id", sa.Integer(), nullable=True))
    op.create_index("ix_analysis_sessions_dataset_id", "analysis_sessions", ["dataset_id"])
    op.create_foreign_key(
        "fk_analysis_sessions_dataset_id",
        "analysis_sessions",
        "datasets",
        ["dataset_id"],
        ["id"],
    )

def downgrade():
    op.drop_constraint("fk_analysis_sessions_dataset_id", "analysis_sessions", type_="foreignkey")
    op.drop_index("ix_analysis_sessions_dataset_id", table_name="analysis_sessions")
    op.drop_column("analysis_sessions", "dataset_id")
