"""Insert demo students, teacher, course, section, assignment and one class session."""

from datetime import datetime, time, timedelta

from app.db import SessionLocal
from app.models import (
    Checkin,
    ClassSession,
    Course,
    CourseSection,
    StudentSectionAssignment,
    User,
)
from app.security import hash_password

STUDENTS = [
    ("2023010001", "张三"),
    ("2023010002", "李四"),
    ("2023010003", "王五"),
    ("2023010004", "赵六"),
    ("2023010005", "陈七"),
]


def seed_data() -> None:
    db = SessionLocal()
    try:
        db.query(Checkin).delete(synchronize_session=False)
        db.query(StudentSectionAssignment).delete(synchronize_session=False)
        db.query(ClassSession).delete(synchronize_session=False)
        db.query(CourseSection).delete(synchronize_session=False)
        db.query(Course).delete(synchronize_session=False)
        db.query(User).delete(synchronize_session=False)
        db.commit()

        now = datetime.now()

        admin = User(
            role="admin",
            name="系统管理员",
            phone="13800000000",
            password_hash=hash_password("admin123"),
            status="active",
            created_at=now,
            updated_at=now,
        )
        teacher = User(
            role="teacher",
            name="王老师",
            phone="13800000001",
            password_hash=hash_password("teacher123"),
            status="active",
            created_at=now,
            updated_at=now,
        )
        students = [
            User(
                role="student",
                student_no=student_no,
                name=name,
                class_name="自动化2301",
                status="active",
                created_at=now,
                updated_at=now,
            )
            for student_no, name in STUDENTS
        ]
        db.add_all([admin, teacher, *students])
        db.flush()

        course = Course(
            course_code="AC101",
            course_name="自动控制原理",
            status="active",
            created_at=now,
            updated_at=now,
        )
        db.add(course)
        db.flush()

        section = CourseSection(
            course_id=course.id,
            section_code="AC101-01",
            section_name="1班",
            teacher_id=teacher.id,
            status="active",
            created_by=admin.id,
            created_at=now,
            updated_at=now,
        )
        db.add(section)
        db.flush()

        for student in students:
            db.add(
                StudentSectionAssignment(
                    student_id=student.id,
                    course_id=course.id,
                    section_id=section.id,
                    status="active",
                    created_by=admin.id,
                    created_at=now,
                    updated_at=now,
                )
            )

        start = now + timedelta(minutes=10)
        end = now + timedelta(minutes=110)
        session = ClassSession(
            section_id=section.id,
            class_date=now.date(),
            period_start=1,
            period_end=2,
            start_time=start.time().replace(microsecond=0),
            end_time=end.time().replace(microsecond=0),
            classroom="A101",
            # 演示点位；演示阈值故意放大，方便在任意地点跑通流程。
            latitude=39.9042,
            longitude=116.4074,
            distance_limit=20000000,
            class_status="scheduled",
            checkin_status="open",
            created_by=teacher.id,
            created_at=now,
            opened_at=now,
            updated_at=now,
        )
        tomorrow_session = ClassSession(
            section_id=section.id,
            class_date=now.date() + timedelta(days=1),
            period_start=3,
            period_end=4,
            start_time=time(10, 0),
            end_time=time(11, 40),
            classroom="A102",
            latitude=39.9042,
            longitude=116.4074,
            distance_limit=50,
            class_status="scheduled",
            checkin_status="draft",
            created_by=teacher.id,
            created_at=now,
            updated_at=now,
        )
        db.add_all([session, tomorrow_session])
        db.commit()

        print("demo data inserted")
        print("students:")
        for student_no, name in STUDENTS:
            print(f"  {student_no}  {name}")
        print(f"today session id: {session.id}")
        print(f"tomorrow draft session id: {tomorrow_session.id}")
        print("note: today demo distance_limit=20,000,000 m; change to 50 for production")
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
