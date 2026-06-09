"""V4 — Pydantic schemas for auto-reply rules and logs."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Target = Literal["dm", "comment"]
MatchType = Literal["contains", "exact", "starts_with", "any"]
CommentAction = Literal["reply_public", "reply_private", "both"]


class AutoReplyRuleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    target: Target
    match_type: MatchType
    keywords: list[str] = Field(default_factory=list)
    case_sensitive: bool = False
    reply_text: str = Field(..., min_length=1, max_length=1000)
    comment_action: CommentAction | None = None
    priority: int = 0
    is_active: bool = True

    @field_validator("keywords")
    @classmethod
    def _clean_keywords(cls, v: list[str]) -> list[str]:
        return [k.strip() for k in v if k and k.strip()]

    @model_validator(mode="after")
    def _check_rules(self):
        # keywords required unless match_type == 'any'
        if self.match_type != "any" and not self.keywords:
            raise ValueError("keywords required unless match_type is 'any'")
        # comment_action only valid for comment target; default it for comments
        if self.target == "comment" and self.comment_action is None:
            self.comment_action = "reply_public"
        if self.target == "dm":
            self.comment_action = None
        return self


class AutoReplyRuleCreate(AutoReplyRuleBase):
    pass


class AutoReplyRuleUpdate(BaseModel):
    """All fields optional for PATCH. Cross-field rules re-checked in the router."""
    name: str | None = Field(None, min_length=1, max_length=120)
    target: Target | None = None
    match_type: MatchType | None = None
    keywords: list[str] | None = None
    case_sensitive: bool | None = None
    reply_text: str | None = Field(None, min_length=1, max_length=1000)
    comment_action: CommentAction | None = None
    priority: int | None = None
    is_active: bool | None = None


class AutoReplyRuleOut(AutoReplyRuleBase):
    id: uuid.UUID
    account_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class AutoReplyLogOut(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    rule_id: uuid.UUID | None = None
    event_type: str
    ig_object_id: str
    sender_ig_id: str | None = None
    incoming_text: str | None = None
    matched_keyword: str | None = None
    reply_text: str | None = None
    status: str
    error_detail: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
