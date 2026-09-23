import sys
from pathlib import Path

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
    
    # Override global database engine and session factory
    database.engine = test_engine
    database.SessionFactory = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)
    database.db_session = scoped_session(database.SessionFactory)

    # Create app
    test_app = create_app(TestConfig)
    
    # Create test admin
    session = database.db_session()
    admin = AdminUser(email="testadmin@indobid.lol")
    admin.set_password("TestSecret123!")
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
