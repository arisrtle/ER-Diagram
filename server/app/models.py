from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Time,
)
from sqlalchemy.dialects.mysql import BIGINT, TINYINT

from .db import Base

ID = BIGINT(unsigned=True)


class User(Base):
    __tablename__ = "users"

    id = Column(ID, primary_key=True, autoincrement=True)
    role = Column(String(20), nullable=False, default="student")
    openid = Column(String(64), nullable=True)
    student_no = Column(String(10), nullable=True)
    name = Column(String(50), nullable=False)
    class_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    password_hash = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)


class Course(Base):
    __tablename__ = "courses"

    id = Column(ID, primary_key=True, autoincrement=True)
    course_code = Column(String(30), nullable=False)
    course_name = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)


class CourseSection(Base):
    __tablename__ = "course_sections"

    id = Column(ID, primary_key=True, autoincrement=True)
    course_id = Column(ID, ForeignKey("courses.id"), nullable=False)
    section_code = Column(String(30), nullable=False)
    section_name = Column(String(100), nullable=False)
    teacher_id = Column(ID, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), nullable=False, default="active")
    created_by = Column(ID, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)


class ClassSession(Base):
    __tablename__ = "class_sessions"

    id = Column(ID, primary_key=True, autoincrement=True)
    section_id = Column(ID, ForeignKey("course_sections.id"), nullable=False)
    class_date = Column(Date, nullable=False)
    period_start = Column(TINYINT(unsigned=True), nullable=False)
    period_end = Column(TINYINT(unsigned=True), nullable=False)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    classroom = Column(String(50), nullable=True)
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    distance_limit = Column(Numeric(10, 2), nullable=False, default=50)
    class_status = Column(String(20), nullable=False, default="scheduled")
    checkin_status = Column(String(20), nullable=False, default="draft")
    created_by = Column(ID, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=True)
    opened_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)


class StudentSectionAssignment(Base):
    __tablename__ = "student_section_assignments"

    id = Column(ID, primary_key=True, autoincrement=True)
    student_id = Column(ID, ForeignKey("users.id"), nullable=False)
    course_id = Column(ID, ForeignKey("courses.id"), nullable=False)
    section_id = Column(ID, ForeignKey("course_sections.id"), nullable=False)
    status = Column(String(20), nullable=False, default="active")
    created_by = Column(ID, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)


class Checkin(Base):
    __tablename__ = "checkins"

    id = Column(ID, primary_key=True, autoincrement=True)
    session_id = Column(ID, ForeignKey("class_sessions.id"), nullable=False)
    student_id = Column(ID, ForeignKey("users.id"), nullable=False)
    student_no_snapshot = Column(String(10), nullable=False)
    student_name_snapshot = Column(String(50), nullable=False)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    accuracy = Column(Numeric(10, 2), nullable=True)
    distance = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), nullable=False, default="valid")
    checked_in_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=True)
