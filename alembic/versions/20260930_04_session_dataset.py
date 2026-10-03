"""Link analysis sessions to persisted datasets."""
from alembic import op
import sqlalchemy as sa

revision = "20260930_04"
down_revision = "20260928_03"
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table("analysis_sessions") as batch_op:
        batch_op.add_column(sa.Column("dataset_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_analysis_sessions_dataset_id", ["dataset_id"])
        batch_op.create_foreign_key(
            "fk_analysis_sessions_dataset_id",
            "datasets",
            ["dataset_id"],
            ["id"],
        )

def downgrade():
    with op.batch_alter_table("analysis_sessions") as batch_op:
        batch_op.drop_constraint("fk_analysis_sessions_dataset_id", type_="foreignkey")
        batch_op.drop_index("ix_analysis_sessions_dataset_id")
        batch_op.drop_column("dataset_id")
