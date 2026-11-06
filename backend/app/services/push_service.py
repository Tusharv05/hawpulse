from typing import Dict, Any, List

class WebPushNotificationService:
    def __init__(self):
        self.active_subscriptions: List[Dict[str, Any]] = []

    async def register_subscription(self, user_id: str, subscription_info: Dict[str, Any]):
        """Registers browser Web Push pushManager subscription."""
        self.active_subscriptions.append({
            "user_id": user_id,
            "subscription": subscription_info
        })
        return {"status": "subscribed"}

    async def send_meal_alert(self, pet_name: str, meal_label: str, portion: str) -> Dict[str, Any]:
        """
        Dispatches actionable Web Push notification payload.
        Includes '[Mark Fed]' and '[Snooze 30m]' action triggers.
        """
        payload = {
            "title": f"🐾 Feeding Time for {pet_name}!",
            "body": f"It's time for {meal_label}. Target portion: {portion}.",
            "icon": "/icons/icon-192x192.png",
            "badge": "/icons/badge-72x72.png",
            "actions": [
                {"action": "mark_fed", "title": "✅ Mark Fed"},
                {"action": "snooze", "title": "⏰ Snooze 30m"}
            ],
            "data": {
                "meal": meal_label,
                "portion": portion
            }
        }
        return {"status": "dispatched", "payload": payload}

push_service = WebPushNotificationService()
