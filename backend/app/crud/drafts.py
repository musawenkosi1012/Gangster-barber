"""
CRUD for payment_drafts — the durable equivalent of the paynow microservice's
in-memory _draft_store dict that couldn't survive Vercel Lambda cold starts.

All writes go through here so that the consumed_at compare-and-set remains
the single source of idempotency truth.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models import PaymentDraft


class DraftCRUD:
    def store(
        self,
        db: Session,
        *,
        paynow_ref: str,
        draft_token: str,
        expires_at: datetime,
    ) -> PaymentDraft:
        """
        Insert a draft row. If a row with this paynow_ref already exists it is
        replaced — this handles a retry after a failed /initiate gracefully.
        """
        existing = (
            db.query(PaymentDraft)
            .filter(PaymentDraft.paynow_ref == paynow_ref)
            .first()
        )
        if existing:
            existing.draft_token = draft_token
            existing.expires_at = expires_at
            existing.consumed_at = None
            db.add(existing)
            db.flush()
            return existing

        draft = PaymentDraft(
            paynow_ref=paynow_ref,
            draft_token=draft_token,
            expires_at=expires_at,
        )
        db.add(draft)
        db.flush()
        return draft

    def consume(self, db: Session, paynow_ref: str) -> Optional[PaymentDraft]:
        """
        Atomically claim a draft for confirmation. Returns the draft row only
        if this call was the one to flip consumed_at from NULL → NOW(). Returns
        None if the draft was already consumed (duplicate webhook) or missing
        or expired.

        A single UPDATE ... RETURNING avoids the classic check-then-write race
        between concurrent webhook retries.
        """
        result = db.execute(
            text(
                """
                UPDATE public.payment_drafts
                SET    consumed_at = NOW()
                WHERE  paynow_ref  = :paynow_ref
                  AND  consumed_at IS NULL
                  AND  expires_at  > NOW()
                RETURNING paynow_ref, draft_token, expires_at, consumed_at, created_at
                """
            ),
            {"paynow_ref": paynow_ref},
        ).mappings().first()

        if not result:
            return None

        # Hydrate into the model instance for consistent downstream access
        draft = PaymentDraft(
            paynow_ref=result["paynow_ref"],
            draft_token=result["draft_token"],
            expires_at=result["expires_at"],
            consumed_at=result["consumed_at"],
            created_at=result["created_at"],
        )
        return draft

    def peek(self, db: Session, paynow_ref: str) -> Optional[PaymentDraft]:
        """
        Non-destructive lookup — used for diagnostics and already-consumed
        detection in the webhook path, so we can return an idempotent
        success response instead of an error.
        """
        return (
            db.query(PaymentDraft)
            .filter(PaymentDraft.paynow_ref == paynow_ref)
            .first()
        )

    def purge_expired(self, db: Session) -> int:
        """
        Delete rows past their expiry that were never consumed.
        Returns the number of rows purged. Safe to run on any schedule.
        """
        result = db.execute(
            text(
                """
                DELETE FROM public.payment_drafts
                WHERE expires_at < NOW()
                  AND consumed_at IS NULL
                """
            )
        )
        return result.rowcount or 0


draft_crud = DraftCRUD()
