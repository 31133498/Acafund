"""
Live integration test against the real Monnify sandbox.

Run with:
    RUN_LIVE_MONNIFY_TESTS=1 pytest tests/test_monnify_live.py -v -s

Requires MONNIFY_API_KEY, MONNIFY_SECRET_KEY, and MONNIFY_CONTRACT_CODE to be
set in .env (or the environment).  Skipped automatically otherwise.
"""
import asyncio
import os
import uuid

import pytest

pytestmark = pytest.mark.skipif(
    not os.getenv("RUN_LIVE_MONNIFY_TESTS"),
    reason="Set RUN_LIVE_MONNIFY_TESTS=1 to run live Monnify tests",
)


def test_live_monnify_login_and_init_transaction():
    from app.services.monnify import MonnifyService

    # Fresh instance so it doesn't interfere with the singleton used in unit tests
    service = MonnifyService()

    async def _run():
        token = await service._get_access_token()
        assert token, "Expected a non-empty access token from Monnify sandbox"

        result = await service.init_transaction(
            amount=100.0,
            customer_name="AcaFund Live Test",
            customer_email="test@acafund.app",
            payment_reference=f"acafund-live-{uuid.uuid4().hex[:12]}",
            description="Live sandbox smoke test",
            redirect_url="https://acafund.app/done",
        )
        return result

    result = asyncio.run(_run())

    print(f"\n[LIVE] checkoutUrl:           {result['checkoutUrl']}")
    print(f"[LIVE] transactionReference:  {result.get('transactionReference')}")

    assert "checkoutUrl" in result, "Monnify did not return a checkoutUrl"
    assert result["checkoutUrl"].startswith("http"), "checkoutUrl looks invalid"
