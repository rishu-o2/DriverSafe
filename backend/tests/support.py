import os
import tempfile

_database_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_database_file.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_database_file.name.replace(os.sep, '/')}"
os.environ["SECRET_KEY"] = "test-only-key-not-used-outside-tests"
