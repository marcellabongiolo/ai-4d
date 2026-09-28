"""Create or upgrade the persistence schema with private projects."""
from alembic import op
import sqlalchemy as sa

revision = "20260928_01"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if "users" not in tables:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("email", sa.String(length=320), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_users_id", "users", ["id"], unique=False)
        op.create_index("ix_users_email", "users", ["email"], unique=True)

    if "analysis_sessions" not in tables:
        op.create_table(
            "analysis_sessions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("signal", sa.String(length=255), nullable=False),
            sa.Column("points", sa.Integer(), nullable=False),
            sa.Column("current_value", sa.Float(), nullable=False),
            sa.Column("prediction", sa.Float(), nullable=False),
            sa.Column("trend", sa.String(length=50), nullable=False),
            sa.Column("behavior", sa.String(length=50), nullable=False),
            sa.Column("anomalies", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("signals_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("dataset_text", sa.Text(), nullable=False, server_default=""),
        )
        op.create_index("ix_analysis_sessions_id", "analysis_sessions", ["id"], unique=False)
        op.create_index("ix_analysis_sessions_user_id", "analysis_sessions", ["user_id"], unique=False)

    if "projects" not in tables:
        op.create_table(
            "projects",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_projects_id", "projects", ["id"], unique=False)
        op.create_index("ix_projects_user_id", "projects", ["user_id"], unique=False)

    session_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("analysis_sessions")}
    if "project_id" not in session_columns:
        with op.batch_alter_table("analysis_sessions", schema=None) as batch_op:
            batch_op.add_column(sa.Column("project_id", sa.Integer(), nullable=True))
            batch_op.create_index("ix_analysis_sessions_project_id", ["project_id"], unique=False)
            batch_op.create_foreign_key("fk_analysis_sessions_project_id", "projects", ["project_id"], ["id"])
    session_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("analysis_sessions")}
    if "dataset_text" not in session_columns:
        with op.batch_alter_table("analysis_sessions", schema=None) as batch_op:
            batch_op.add_column(sa.Column("dataset_text", sa.Text(), nullable=False, server_default=""))

def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "analysis_sessions" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("analysis_sessions")}
        if "project_id" in columns:
            with op.batch_alter_table("analysis_sessions", schema=None) as batch_op:
                batch_op.drop_constraint("fk_analysis_sessions_project_id", type_="foreignkey")
                batch_op.drop_index("ix_analysis_sessions_project_id")
                batch_op.drop_column("project_id")
    if "projects" in inspector.get_table_names():
        op.drop_index("ix_projects_user_id", table_name="projects")
        op.drop_index("ix_projects_id", table_name="projects")
        op.drop_table("projects")
