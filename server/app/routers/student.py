from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..geo import haversine
from ..models import (
    Checkin,
    ClassSession,
    Course,
    CourseSection,
    StudentSectionAssignment,
    User,
)
from ..schemas import (
    CheckinRequest,
    CheckinResponse,
    CurrentSessionOut,
)

router = APIRouter()


@router.get("/current-session", response_model=CurrentSessionOut | None)
def current_session(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="仅学生可查看")

    today = date.today()
    stmt = (
        select(ClassSession, CourseSection, Course)
        .join(CourseSection, ClassSession.section_id == CourseSection.id)
        .join(Course, CourseSection.course_id == Course.id)
        .join(
            StudentSectionAssignment,
            StudentSectionAssignment.section_id == ClassSession.section_id,
        )
        .where(
            StudentSectionAssignment.student_id == user.id,
            StudentSectionAssignment.status == "active",
            ClassSession.class_date == today,
            ClassSession.class_status == "scheduled",
        )
        .order_by(
            case((ClassSession.checkin_status == "open", 0), else_=1),
            ClassSession.start_time.asc(),
        )
        .limit(1)
    )
    row = db.execute(stmt).first()
    if row is None:
        return None

    session, section, course = row
    existing = db.scalar(
        select(Checkin).where(
            Checkin.session_id == session.id,
            Checkin.student_id == user.id,
        )
    )

    return CurrentSessionOut(
        session_id=session.id,
        course_name=course.course_name,
        section_name=section.section_name,
        classroom=session.classroom,
        class_date=session.class_date,
        start_time=session.start_time.strftime("%H:%M") if session.start_time else None,
        end_time=session.end_time.strftime("%H:%M") if session.end_time else None,
        checkin_status=session.checkin_status,
        distance_limit=float(session.distance_limit),
        latitude=float(session.latitude) if session.latitude is not None else None,
        longitude=float(session.longitude) if session.longitude is not None else None,
        already_checked_in=existing is not None,
        checked_in_at=existing.checked_in_at if existing else None,
    )


@router.post("/checkin", response_model=CheckinResponse)
def checkin(
    body: CheckinRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="仅学生可签到")

    session = db.get(ClassSession, body.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="签到活动不存在")
    if session.class_status != "scheduled":
        raise HTTPException(status_code=409, detail="本节课已取消")
    if session.checkin_status != "open":
        raise HTTPException(status_code=409, detail="签到未开放")

    assignment = db.scalar(
        select(StudentSectionAssignment).where(
            StudentSectionAssignment.student_id == user.id,
            StudentSectionAssignment.section_id == session.section_id,
            StudentSectionAssignment.status == "active",
        )
    )
    if assignment is None:
        raise HTTPException(status_code=403, detail="你不属于该教学班")

    existing = db.scalar(
        select(Checkin).where(
            Checkin.session_id == session.id,
            Checkin.student_id == user.id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="本节课已签到")

    if session.latitude is None or session.longitude is None:
        raise HTTPException(status_code=409, detail="签到点未设置")

    distance = haversine(
        body.latitude,
        body.longitude,
        float(session.latitude),
        float(session.longitude),
    )
    if distance > float(session.distance_limit):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "out_of_range",
                "message": f"距离签到点 {round(distance)} 米，超出 {float(session.distance_limit):g} 米范围",
                "distance": round(distance, 2),
            },
        )

    now = datetime.now()
    record = Checkin(
        session_id=session.id,
        student_id=user.id,
        student_no_snapshot=user.student_no or "",
        student_name_snapshot=user.name,
        latitude=body.latitude,
        longitude=body.longitude,
        accuracy=body.accuracy,
        distance=distance,
        status="valid",
        checked_in_at=now,
        updated_at=now,
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="本节课已签到") from exc

    db.refresh(record)
    return CheckinResponse(
        success=True,
        message="签到成功",
        distance=round(distance, 2),
        checked_in_at=record.checked_in_at,
    )
