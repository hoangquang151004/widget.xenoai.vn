import os
import base64
import json
import time
import hmac
import hashlib
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from typing import Optional, Union
from core.config import settings

from passlib.context import CryptContext

class SecurityUtils:
    """Utilities for encryption, key validation and security."""
    
    _pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    @classmethod
    def hash_password(cls, password: str) -> str:
        """Hash a password using bcrypt."""
        return cls._pwd_context.hash(password)

    @classmethod
    def verify_password(cls, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against a hash."""
        return cls._pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def is_public_key(key: str) -> bool:
        """Checks if key starts with pk_live_."""
        return key.startswith("pk_live_")

    @staticmethod
    def is_secret_key(key: str) -> bool:
        """Checks if key starts with sk_live_."""
        return key.startswith("sk_live_")

    @staticmethod
    def generate_api_key(prefix: str) -> str:
        """Generates a secure random API key with given prefix."""
        import secrets
        return f"{prefix}_{secrets.token_urlsafe(32)}"

    @classmethod
    def generate_admin_token(
        cls,
        tenant_id: str,
        email: str,
        role: str = "tenant",
        *,
        impersonator_sub: Optional[str] = None,
    ) -> str:
        """Generate a signed bearer token for admin dashboard sessions.

        impersonator_sub: nếu set, token là phiên đăng nhập hộ tenant (Platform Admin).
        """
        header = {"alg": "HS256", "typ": "JWT"}
        payload = {
            "sub": tenant_id,
            "email": email,
            "role": role,
            "type": "admin",
            "exp": int(time.time()) + int(settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60),
        }
        if impersonator_sub:
            payload["impersonator_sub"] = impersonator_sub

        header_b64 = cls._b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        payload_b64 = cls._b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

        signature = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()
        signature_b64 = cls._b64url_encode(signature)
        return f"{header_b64}.{payload_b64}.{signature_b64}"

    @classmethod
    def verify_admin_token(cls, token: str) -> Optional[dict]:
        """Validate signature and expiry for an admin bearer token."""
        try:
            parts = token.split(".")
            if len(parts) != 3:
                return None

            header_b64, payload_b64, signature_b64 = parts
            signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
            expected_sig = hmac.new(
                settings.SECRET_KEY.encode("utf-8"),
                signing_input,
                hashlib.sha256,
            ).digest()
            actual_sig = cls._b64url_decode(signature_b64)

            if not hmac.compare_digest(expected_sig, actual_sig):
                return None

            payload_raw = cls._b64url_decode(payload_b64).decode("utf-8")
            payload = json.loads(payload_raw)

            if payload.get("type") != "admin":
                return None
            if int(payload.get("exp", 0)) < int(time.time()):
                return None
            if not payload.get("sub"):
                return None

            return payload
        except Exception:
            return None

    @classmethod
    def encrypt(cls, data: str) -> str:
        """
        Encrypts data using AES-256-GCM.
        Used for tenant DB credentials.
        """
        key = cls._derive_key(settings.APP_ENCRYPTION_KEY)
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, data.encode(), None)
        # Format: base64(nonce + ciphertext)
        return base64.b64encode(nonce + ciphertext).decode('utf-8')

    @classmethod
    def decrypt(cls, encrypted_data: str) -> str:
        """Decrypts AES-256-GCM encrypted data."""
        try:
            data = base64.b64decode(encrypted_data)
            nonce = data[:12]
            ciphertext = data[12:]
            key = cls._derive_key(settings.APP_ENCRYPTION_KEY)
            aesgcm = AESGCM(key)
            decrypted_data = aesgcm.decrypt(nonce, ciphertext, None)
            return decrypted_data.decode('utf-8')
        except Exception as e:
            raise ValueError(f"Failed to decrypt data: {str(e)}")

    @staticmethod
    def _derive_key(raw_key: str) -> bytes:
        """Derives a 32-byte key from string using SHA256."""
        digest = hashes.Hash(hashes.SHA256())
        digest.update(raw_key.encode())
        return digest.finalize()

    @staticmethod
    def _b64url_encode(raw: bytes) -> str:
        return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")

    @staticmethod
    def _b64url_decode(data: str) -> bytes:
        padding = "=" * (-len(data) % 4)
        return base64.urlsafe_b64decode(data + padding)

security_utils = SecurityUtils()
