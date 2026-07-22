import base64
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from app.config import settings


class MonnifyError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"Monnify {status_code}: {message}")


class MonnifyService:
    def __init__(self):
        self._token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None

    async def _get_access_token(self) -> str:
        now = datetime.now(timezone.utc)
        if self._token and self._token_expiry and now < self._token_expiry:
            return self._token

        credentials = base64.b64encode(
            f"{settings.monnify_api_key}:{settings.monnify_secret_key}".encode()
        ).decode()

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.monnify_base_url}/api/v1/auth/login",
                headers={"Authorization": f"Basic {credentials}"},
            )

        if resp.status_code != 200:
            raise MonnifyError(resp.status_code, resp.text)

        self._token = resp.json()["responseBody"]["accessToken"]
        self._token_expiry = now + timedelta(minutes=55)
        return self._token

    async def init_transaction(
        self,
        amount: float,
        customer_name: str,
        customer_email: str,
        payment_reference: str,
        description: str,
        redirect_url: str,
    ) -> dict:
        token = await self._get_access_token()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.monnify_base_url}/api/v1/merchant/transactions/init-transaction",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "amount": amount,
                    "customerName": customer_name,
                    "customerEmail": customer_email,
                    "paymentReference": payment_reference,
                    "paymentDescription": description,
                    "currencyCode": "NGN",
                    "contractCode": settings.monnify_contract_code,
                    "redirectUrl": redirect_url,
                },
            )
        if resp.status_code != 200:
            raise MonnifyError(resp.status_code, resp.text)
        return resp.json()["responseBody"]

    async def create_reserved_account(
        self,
        community_id: int,
        community_name: str,
        admin_name: str,
        bvn: str,
    ) -> dict:
        """Create a dedicated reserved bank account for a community.

        Returns dict with keys: account_number, bank_name, account_name, status (lowercase).
        """
        token = await self._get_access_token()
        account_reference = f"acafund-comm-{community_id}"
        customer_email = f"community-{community_id}@acafund.app"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.monnify_base_url}/api/v2/bank-transfer/reserved-accounts",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "accountReference": account_reference,
                    "accountName": community_name,
                    "currencyCode": "NGN",
                    "contractCode": settings.monnify_contract_code,
                    "customerEmail": customer_email,
                    "customerName": admin_name,
                    "bvn": bvn,
                    "getAllAvailableBanks": True,
                },
            )
        if resp.status_code != 200:
            raise MonnifyError(resp.status_code, resp.text)
        body = resp.json()["responseBody"]
        accounts = body.get("accounts", [])
        first = accounts[0] if accounts else {}
        raw_status = body.get("status", "ACTIVE")
        return {
            "account_number": first.get("accountNumber", ""),
            "bank_name": first.get("bankName", ""),
            "account_name": body.get("accountName", community_name),
            "status": raw_status.lower(),
        }

    async def verify_transaction(self, payment_reference: str) -> dict:
        token = await self._get_access_token()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.monnify_base_url}/api/v2/merchant/transactions/query",
                headers={"Authorization": f"Bearer {token}"},
                params={"paymentReference": payment_reference},
            )
        if resp.status_code != 200:
            raise MonnifyError(resp.status_code, resp.text)
        return resp.json()["responseBody"]

    @staticmethod
    def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
        # Monnify signs webhooks as SHA-512(secretKey + rawBody)
        combined = settings.monnify_secret_key.encode() + raw_body
        computed = hashlib.sha512(combined).hexdigest()
        return hmac.compare_digest(computed, signature.lower())


monnify_service = MonnifyService()
