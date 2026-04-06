"""Sanity check — prompt dialect hints (TASK-01)."""

from ai.sql.generator import _dialect_hint


def test_dialect_hint_postgresql():
    assert "PostgreSQL" in _dialect_hint("postgresql")
    assert "ILIKE" in _dialect_hint("postgresql")


def test_dialect_hint_mysql():
    assert "MySQL" in _dialect_hint("mysql")
    assert "DATE_FORMAT" in _dialect_hint("mysql")
