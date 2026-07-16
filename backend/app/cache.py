import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

DEFAULT_TTL = 60.0  # seconds


@dataclass
class _Entry:
    value: Any
    expires_at: float


@dataclass
class Cache:
    """Per-token, per-key in-memory TTL cache. Not persisted across restarts."""
    _store: dict[tuple, _Entry] = field(default_factory=dict)

    def get(self, key: tuple) -> Any:
        entry = self._store.get(key)
        if not entry:
            return _MISS
        if time.monotonic() > entry.expires_at:
            self._store.pop(key, None)
            return _MISS
        return entry.value

    def set(self, key: tuple, value: Any, ttl: Optional[float] = None) -> None:
        ttl = DEFAULT_TTL if ttl is None else ttl
        self._store[key] = _Entry(value=value, expires_at=time.monotonic() + ttl)

    def invalidate(self, key: tuple) -> None:
        self._store.pop(key, None)

    def invalidate_prefix(self, prefix: tuple) -> None:
        keys = [k for k in self._store if k[: len(prefix)] == prefix]
        for k in keys:
            self._store.pop(k, None)

    def clear(self) -> None:
        self._store.clear()

    def get_or_set(self, key: tuple, factory: Callable[[], Any], ttl: Optional[float] = None) -> Any:
        v = self.get(key)
        if v is _MISS:
            v = factory()
            self.set(key, v, ttl)
        return v


_MISS: Any = object()


_caches: dict[int, Cache] = {}


def get_cache(token_id: int) -> Cache:
    return _caches.setdefault(token_id, Cache())


def invalidate_token(token_id: int) -> None:
    _caches.pop(token_id, None)


def clear_all() -> None:
    _caches.clear()