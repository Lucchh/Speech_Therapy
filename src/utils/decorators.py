"""Generic decorators for logging, timing, and retries."""

from typing import Any, Callable, TypeVar, cast
import functools
import logging

F = TypeVar("F", bound=Callable[..., Any])


def log_execution(func: F) -> F:
    """Log function entry/exit to aid observability of critical workflows."""

    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        logging.debug("Entering %s", func.__name__)
        result = func(*args, **kwargs)
        logging.debug("Exiting %s", func.__name__)
        return result

    return cast(F, wrapper)

