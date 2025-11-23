.PHONY: dev run test fmt

dev:
	uvicorn src.app.main:app --reload --host 0.0.0.0 --port 8000

run:
	uvicorn src.app.main:app --host 0.0.0.0 --port 8000

test:
	pytest -q

fmt:
	python -m pip install ruff && ruff check --fix .
