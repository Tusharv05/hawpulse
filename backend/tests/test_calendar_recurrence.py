import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.google_calendar_service import google_calendar_service

client = TestClient(app)

def test_default_meal_recurrence_is_30_days():
    """
    Verifies that Google Calendar meal scheduling defaults to 30 days of recurrence
    with RRULE:FREQ=DAILY;COUNT=30.
    """
    response = client.post("/api/v1/calendar/schedule-feeding", json={
        "pet_name": "Cooper",
        "morning_meal": "Breakfast 8:30 AM",
        "evening_meal": "Dinner 7:30 PM"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["duration_days"] == 30
    assert "for 30 days" in data["message"]
    assert len(data["events"]) == 2
    for event in data["events"]:
        assert event["duration_days"] == 30
        assert "COUNT%3D30" in event["web_fallback_link"] or "COUNT=30" in event["web_fallback_link"]

def test_custom_meal_duration_selection():
    """
    Verifies that users can select any custom recurrence duration (e.g. 7, 14, 60, 90 days).
    """
    for duration in [7, 14, 60, 90]:
        response = client.post("/api/v1/calendar/schedule-feeding", json={
            "pet_name": "Cooper",
            "morning_meal": "Breakfast 8:30 AM",
            "evening_meal": "Dinner 7:30 PM",
            "duration_days": duration
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["duration_days"] == duration
        assert f"for {duration} days" in data["message"]
        for event in data["events"]:
            assert event["duration_days"] == duration
            assert f"COUNT%3D{duration}" in event["web_fallback_link"] or f"COUNT={duration}" in event["web_fallback_link"]

def test_service_schedule_daily_feeding_duration():
    """
    Tests direct service invocation of schedule_daily_feeding with default and custom duration.
    """
    # Default duration (30 days)
    res_default = google_calendar_service.schedule_daily_feeding(
        pet_name="Cooper",
        meal_label="Breakfast",
        portion="120g",
        ingredients="Kibble"
    )
    assert res_default["success"] is True
    assert res_default["duration_days"] == 30
    if res_default["mode"] == "live_google_calendar":
        assert res_default["event_id"] is not None
        assert "google.com" in res_default["html_link"]
    else:
        assert "COUNT=30" in res_default["html_link"] or "COUNT%3D30" in res_default["html_link"]

    # Custom duration (14 days)
    res_custom = google_calendar_service.schedule_daily_feeding(
        pet_name="Cooper",
        meal_label="Breakfast",
        portion="120g",
        ingredients="Kibble",
        duration_days=14
    )
    assert res_custom["success"] is True
    assert res_custom["duration_days"] == 14
    if res_custom["mode"] == "live_google_calendar":
        assert res_custom["event_id"] is not None
        assert "google.com" in res_custom["html_link"]
    else:
        assert "COUNT=14" in res_custom["html_link"] or "COUNT%3D14" in res_custom["html_link"]

    # Verify 1-click URL recurrence generation explicitly
    url_30 = google_calendar_service.generate_1click_calendar_url(
        title="Meal Test",
        details="Recurrence Test",
        start_date="2026-10-26",
        start_time="08:30",
        recurrence="DAILY;COUNT=30"
    )
    assert "COUNT%3D30" in url_30 or "COUNT=30" in url_30
    assert "RRULE%3AFREQ%3DDAILY" in url_30 or "RRULE:FREQ=DAILY" in url_30
