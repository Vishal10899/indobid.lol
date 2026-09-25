import os
import sys
from pathlib import Path

# Force in-memory SQLite and disable production flag for testing
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["RENDER"] = "false"

# Add project root directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker, scoped_session
import database
from models import Base, AdminUser
from app import create_app
from config import TestConfig

@pytest.fixture(scope="session")
def app():
    # Setup shared in-memory SQLite test engine
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=test_engine)
    
    # Reconfigure database engine and session factory
    database.db_session.remove()
    database.engine = test_engine
    database.SessionFactory = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)
    database.db_session.configure(bind=test_engine)

    # Create app with TestConfig
    test_app = create_app(TestConfig)
    
    # Create test admin user in test db
    session = database.db_session()
    admin = session.query(AdminUser).filter_by(email=TestConfig.ADMIN_EMAIL).first()
    if not admin:
        admin = AdminUser(email=TestConfig.ADMIN_EMAIL)
        admin.set_password(TestConfig.ADMIN_PASSWORD)
        session.add(admin)
        session.commit()
    session.close()

    yield test_app

    # Teardown
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def db_sess(app):
    session = database.db_session()
    yield session
    session.rollback()
    session.close()

import uuid

@pytest.fixture(autouse=True)
def mock_razorpay_gateway(monkeypatch):
    """
    Default mock for Razorpay API calls in test suite.
    Mocked Razorpay responses ONLY exist inside the test suite.
    """
    def default_create_order(key_id, key_secret, amount_subunits, currency, receipt, notes):
        return {
            "id": f"order_{uuid.uuid4().hex[:14]}",
            "amount": amount_subunits,
            "currency": currency,
            "status": "created",
            "receipt": receipt
        }

    def default_get_payment(key_id, key_secret, payment_id):
        return {
            "id": payment_id,
            "amount": 200,
            "currency": "USD",
            "status": "captured"
        }

    monkeypatch.setattr("routes.main.create_razorpay_order_api", default_create_order)
    monkeypatch.setattr("routes.main.get_razorpay_payment_api", default_get_payment)

