"""Utilities for fetching and rendering the NEPSE index.

This module is intentionally framework-agnostic so it can be reused by a
terminal/dashboard app header renderer.
"""

from __future__ import annotations

import re
import time
from typing import Any, Iterable

import requests

NEPSE_URL = "https://nepsealpha.com/trading-ta?frame=1D&symbol=NEPSE&fs=1630"
REQUEST_TIMEOUT_SECONDS = 10
MIN_REQUEST_INTERVAL_SECONDS = 5

_last_index: float | None = None
_last_fetch_monotonic: float = 0.0


def _extract_first_number(values: Iterable[Any]) -> float | None:
    """Return the first usable float from nested values."""
    for value in values:
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value.replace(",", ""))
            except ValueError:
                continue
        if isinstance(value, dict):
            nested = _extract_from_json_payload(value)
            if nested is not None:
                return nested
        elif isinstance(value, (list, tuple)):
            nested = _extract_first_number(value)
            if nested is not None:
                return nested
    return None


def _extract_from_json_payload(payload: Any) -> float | None:
    """Extract latest/live index from a JSON payload with flexible shapes."""
    if isinstance(payload, (int, float)):
        return float(payload)

    if isinstance(payload, list):
        # Usually time-series data; latest value tends to be at the end.
        latest = _extract_first_number(reversed(payload))
        return latest

    if isinstance(payload, dict):
        preferred_keys = (
            "live",
            "last",
            "close",
            "current",
            "value",
            "index",
            "ltp",
            "price",
        )
        # Prefer semantically relevant keys first.
        for key in preferred_keys:
            if key in payload:
                candidate = payload[key]
                value = _extract_from_json_payload(candidate)
                if value is not None:
                    return value

        # Fallback: scan all nested values.
        return _extract_first_number(payload.values())

    if isinstance(payload, str):
        try:
            return float(payload.replace(",", ""))
        except ValueError:
            return None

    return None


def _extract_from_text(text: str) -> float | None:
    """Extract a likely NEPSE index value from arbitrary response text."""
    # Try contextual labels first.
    contextual_patterns = [
        r"(?:nepse(?:\s*index)?|index)\D{0,25}(-?\d{3,5}(?:\.\d+)?)",
        r"(?:close|last|live|ltp|current)\D{0,20}(-?\d{3,5}(?:\.\d+)?)",
    ]
    for pattern in contextual_patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return float(match.group(1).replace(",", ""))

    # Fallback: choose the last plausible index-like number in text.
    number_matches = re.findall(r"-?\d{3,5}(?:\.\d+)?", text.replace(",", ""))
    if number_matches:
        return float(number_matches[-1])

    return None


def get_nepse_index(url: str = NEPSE_URL) -> float | None:
    """Fetch and return NEPSE index value with safe fallbacks.

    Behavior:
    - max 1 HTTP request per 5 seconds (rate limiting)
    - parse JSON when possible
    - safely parse raw text when response isn't valid JSON
    - on failures, keep and return last known index value
    """
    global _last_index, _last_fetch_monotonic

    now = time.monotonic()
    elapsed = now - _last_fetch_monotonic
    if _last_fetch_monotonic and elapsed < MIN_REQUEST_INTERVAL_SECONDS:
        return _last_index

    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        _last_fetch_monotonic = time.monotonic()

        value: float | None = None
        try:
            payload = response.json()
            value = _extract_from_json_payload(payload)
        except ValueError:
            value = _extract_from_text(response.text)

        if value is not None:
            _last_index = value
            return value

        print("Warning: Could not extract NEPSE index from response; using last known value.")
        return _last_index

    except requests.RequestException as exc:
        print(f"Warning: NEPSE request failed ({exc}); using last known value.")
        return _last_index


def render_header(index: float | None) -> str:
    """Render the header display string for terminal/dashboard output."""
    value = f"{index:,.2f}" if index is not None else "N/A"
    return f"NEPSE INDEX: {value}"


def run_header_loop(interval_seconds: int = 5) -> None:
    """Example loop that refreshes and prints the header every 5-10 seconds."""
    if interval_seconds < 5 or interval_seconds > 10:
        raise ValueError("interval_seconds must be between 5 and 10")

    while True:
        index = get_nepse_index()
        print(render_header(index))
        time.sleep(interval_seconds)


if __name__ == "__main__":
    run_header_loop(interval_seconds=5)
