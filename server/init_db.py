"""Drop and recreate the 6 tables, then insert demo data."""

import re
from pathlib import Path

import pymysql
from sqlalchemy.engine import make_url

from app.config import DATABASE_URL

BASE_DIR = Path(__file__).resolve().parent.parent
SQL_PATH = BASE_DIR / "docs" / "database.sql"

DROP_ORDER = [
    "checkins",
    "student_section_assignments",
    "class_sessions",
    "course_sections",
    "courses",
    "users",
]


def main() -> None:
    url = make_url(DATABASE_URL)
    conn = pymysql.connect(
        host=url.host,
        port=url.port or 3306,
        user=url.username,
        password=url.password,
        database=url.database,
        charset="utf8mb4",
        autocommit=True,
    )
    try:
        with conn.cursor() as cur:
            for table in DROP_ORDER:
                cur.execute(f"DROP TABLE IF EXISTS `{table}`")
            sql = SQL_PATH.read_text(encoding="utf-8")
            sql = re.sub(r"--[^\n]*", "", sql)
            for statement in sql.split(";"):
                statement = statement.strip()
                if statement:
                    cur.execute(statement)
        print("tables created")
    finally:
        conn.close()

    from seed import seed_data

    seed_data()


if __name__ == "__main__":
    main()
