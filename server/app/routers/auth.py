from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import (
    LoginResponse,
    StaffLoginRequest,
    StudentLoginRequest,
    UserOut,
)
from ..security import create_access_token, verify_password

router = APIRouter()


@router.post("/student-login", response_model=LoginResponse)
def student_login(body: StudentLoginRequest, db: Session = Depends(get_db)):
    student_no = body.student_no.strip()
    name = body.name.strip()

    if len(student_no) != 10 or not student_no.isdigit():
        raise HTTPException(status_code=400, detail="学号必须是10位数字")
    if not name:
        raise HTTPException(status_code=400, detail="请输入姓名")

    user = db.scalar(
        select(User).where(
            User.student_no == student_no,
            User.name == name,
            User.role == "student",
            User.status == "active",
        )
    )
    if user is None:
        raise HTTPException(status_code=401, detail="学号或姓名不正确")

    token = create_access_token(user.id, user.role, user.student_no)
    return LoginResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.post("/teacher-login", response_model=LoginResponse)
def teacher_login(body: StaffLoginRequest, db: Session = Depends(get_db)):
    phone = body.phone.strip()
    if not phone or not body.password:
        raise HTTPException(status_code=400, detail="请输入手机号和密码")

    user = db.scalar(
        select(User).where(
            User.phone == phone,
            User.role.in_(("teacher", "admin")),
            User.status == "active",
        )
    )
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="手机号或密码不正确")

    token = create_access_token(user.id, user.role, None)
    return LoginResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )
