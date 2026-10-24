import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app, get_settings


@pytest.fixture(autouse=True)
def demo_settings():
    app.dependency_overrides[get_settings] = lambda: Settings(mode="demo", _env_file=None)
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)
