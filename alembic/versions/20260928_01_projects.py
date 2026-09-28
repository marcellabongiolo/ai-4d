"""Add private projects and link analysis sessions to projects."""
from alembic import op
import sqlalchemy as sa

revision = "20260928_01"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_projects_id", "projects", ["id"], unique=False)
    op.create_index("ix_projects_user_id", "projects", ["user_id"], unique=False)
    with op.batch_alter_table("analysis_sessions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("project_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_analysis_sessions_project_id", ["project_id"], unique=False)
        batch_op.create_foreign_key("fk_analysis_sessions_project_id", "projects", ["project_id"], ["id"])

def downgrade() -> None:
    with op.batch_alter_table("analysis_sessions", schema=None) as batch_op:
        batch_op.drop_constraint("fk_analysis_sessions_project_id", type_="foreignkey")
        batch_op.drop_index("ix_analysis_sessions_project_id")
        batch_op.drop_column("project_id")
    op.drop_index("ix_projects_user_id", table_name="projects")
    op.drop_index("ix_projects_id", table_name="projects")
    op.drop_table("projects")
