"""Unit tests cho JWT role (tích hợp DB + platform_admin: tests/test_admin_database_integration.py)."""

import pytest


class TestSecurityTokenRole:
    def test_generate_admin_token_embeds_role(self):
        from core.security import security_utils

        tok = security_utils.generate_admin_token(
            "00000000-0000-0000-0000-000000000001",
            "a@b.com",
            role="platform_admin",
        )
        payload = security_utils.verify_admin_token(tok)
        assert payload is not None
        assert payload.get("role") == "platform_admin"

    def test_generate_admin_token_impersonator_claim(self):
        from core.security import security_utils

        tok = security_utils.generate_admin_token(
            "00000000-0000-0000-0000-000000000002",
            "t@b.com",
            role="tenant",
            impersonator_sub="00000000-0000-0000-0000-000000000001",
        )
        payload = security_utils.verify_admin_token(tok)
        assert payload is not None
        assert payload.get("impersonator_sub") == "00000000-0000-0000-0000-000000000001"
