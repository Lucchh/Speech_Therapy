"""Shared pytest fixtures for the AI Speech Therapy Agent test suite."""

import pytest


@pytest.fixture
def sample_user_id() -> str:
    """Provide a reusable dummy user identifier for tests."""
    return "test-user-123"

