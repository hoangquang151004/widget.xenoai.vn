"""
B-008: Unit tests cho SQL Sanitizer và Admin endpoints.
Chạy: cd apps/api && .venv\Scripts\python.exe -m pytest tests/test_backend.py -v
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from ai.sql_agent import SQLAgent


# ─────────────────────────────────────────────────────────────────────────────
# Test SQL Sanitizer (B-008)
# ─────────────────────────────────────────────────────────────────────────────

class TestSQLSanitizer:
    def setup_method(self):
        self.agent = SQLAgent.__new__(SQLAgent)
        self.agent.tenant_id = "test-tenant"

    def test_valid_select(self):
        """SELECT hợp lệ phải pass."""
        sql = "SELECT id, name FROM users"
        result = self.agent._sanitize_sql(sql)
        assert "SELECT" in result.upper()

    def test_auto_limit_added(self):
        """Nếu không có LIMIT, phải tự thêm LIMIT 100."""
        sql = "SELECT * FROM products"
        result = self.agent._sanitize_sql(sql)
        assert "LIMIT 100" in result.upper()

    def test_existing_limit_preserved(self):
        """Nếu đã có LIMIT, không được thêm lần nữa."""
        sql = "SELECT * FROM products LIMIT 10"
        result = self.agent._sanitize_sql(sql)
        assert result.upper().count("LIMIT") == 1

    def test_drop_blocked(self):
        """DROP phải bị chặn."""
        with pytest.raises(ValueError, match="Dangerous keyword"):
            self.agent._sanitize_sql("DROP TABLE users")

    def test_delete_blocked(self):
        """DELETE phải bị chặn."""
        with pytest.raises(ValueError, match="Dangerous keyword"):
            self.agent._sanitize_sql("DELETE FROM users WHERE 1=1")

    def test_update_blocked(self):
        """UPDATE phải bị chặn."""
        with pytest.raises(ValueError, match="Dangerous keyword"):
            self.agent._sanitize_sql("UPDATE users SET name='x'")

    def test_insert_blocked(self):
        """INSERT phải bị chặn."""
        with pytest.raises(ValueError, match="Dangerous keyword"):
            self.agent._sanitize_sql("INSERT INTO users VALUES (1, 'a')")

    def test_truncate_blocked(self):
        """TRUNCATE phải bị chặn."""
        with pytest.raises(ValueError, match="Dangerous keyword"):
            self.agent._sanitize_sql("TRUNCATE TABLE users")

    def test_non_select_blocked(self):
        """Statement không bắt đầu bằng SELECT phải bị từ chối."""
        with pytest.raises(ValueError, match="Only SELECT"):
            self.agent._sanitize_sql("EXEC sp_dangerous")

    def test_comment_stripped(self):
        """SQL comment phải bị loại bỏ trước khi validate."""
        sql = "SELECT * FROM users -- DROP TABLE users"
        result = self.agent._sanitize_sql(sql)
        assert "DROP" not in result.upper()

    def test_multiline_comment_stripped(self):
        """Block comment phải bị loại bỏ."""
        sql = "SELECT * FROM users /* DELETE FROM users */"
        result = self.agent._sanitize_sql(sql)
        assert "DELETE" not in result.upper()


# ─────────────────────────────────────────────────────────────────────────────
# Test Admin helper: origin normalization (v2)
# ─────────────────────────────────────────────────────────────────────────────

class TestOriginNormalization:
    def test_wildcard_origin_allowed(self):
        from api.v1.admin import _normalize_origin
        assert _normalize_origin("*") == "*"

    def test_url_origin_is_normalized_to_netloc(self):
        from api.v1.admin import _normalize_origin
        result = _normalize_origin("https://Example.com/")
        assert result == "example.com"

    def test_origin_with_path_is_rejected(self):
        from api.v1.admin import _normalize_origin
        with pytest.raises(Exception):
            _normalize_origin("example.com/path")


# ─────────────────────────────────────────────────────────────────────────────
# Test SecurityUtils (AES encryption)
# ─────────────────────────────────────────────────────────────────────────────

class TestSecurityUtils:
    def test_encrypt_decrypt_roundtrip(self):
        """Dữ liệu mã hoá rồi giải mã phải khớp với gốc."""
        from core.security import security_utils
        original = "super_secret_password_123!"
        encrypted = security_utils.encrypt(original)
        decrypted = security_utils.decrypt(encrypted)
        assert decrypted == original

    def test_encrypted_is_different(self):
        """Ciphertext phải khác plaintext."""
        from core.security import security_utils
        original = "my_password"
        encrypted = security_utils.encrypt(original)
        assert encrypted != original

    def test_is_public_key(self):
        from core.security import security_utils
        assert security_utils.is_public_key("pk_live_abc123") is True
        assert security_utils.is_public_key("sk_live_abc123") is False

    def test_is_secret_key(self):
        from core.security import security_utils
        assert security_utils.is_secret_key("sk_live_abc123") is True
        assert security_utils.is_secret_key("pk_live_abc123") is False

    def test_generate_api_key_format(self):
        from core.security import security_utils
        key = security_utils.generate_api_key("pk_live")
        assert key.startswith("pk_live_")
        assert len(key) > 20
