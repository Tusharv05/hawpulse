import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional
import httpx

import sys
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from app.core.config import settings

class EmailService:
    """
    HawPulse Email Dispatch Service:
    - Real SMTP Delivery (Gmail SMTP, SendGrid, Mailgun, Amazon SES)
    - Resend REST API Support
    - Styled HTML Email Templates with HawPulse Branding
    - Development Fallback Mode (prints OTP to console when credentials not yet set)
    """

    @property
    def smtp_host(self) -> str:
        return os.getenv("SMTP_HOST") or settings.SMTP_HOST or "smtp.gmail.com"

    @property
    def smtp_port(self) -> int:
        port_val = os.getenv("SMTP_PORT") or settings.SMTP_PORT or 587
        try:
            return int(port_val)
        except ValueError:
            return 587

    @property
    def smtp_user(self) -> str:
        return os.getenv("SMTP_USER") or settings.SMTP_USER or ""

    @property
    def smtp_password(self) -> str:
        return os.getenv("SMTP_PASSWORD") or settings.SMTP_PASSWORD or ""

    @property
    def resend_api_key(self) -> str:
        return os.getenv("RESEND_API_KEY") or getattr(settings, "RESEND_API_KEY", "") or ""

    @property
    def from_email(self) -> str:
        return os.getenv("EMAILS_FROM_EMAIL") or getattr(settings, "EMAILS_FROM_EMAIL", "") or self.smtp_user or "noreply@hawpulse.com"

    @property
    def from_name(self) -> str:
        return os.getenv("EMAILS_FROM_NAME") or getattr(settings, "EMAILS_FROM_NAME", "HawPulse Team")

    def is_configured(self) -> bool:
        """Returns True if real email dispatch credentials are configured."""
        return bool(self.resend_api_key.strip() or (self.smtp_user.strip() and self.smtp_password.strip()))

    def _render_otp_html(self, otp: str, email: str) -> str:
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }}
            .container {{ max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
            .logo {{ font-size: 24px; font-weight: bold; color: #0284c7; text-align: center; margin-bottom: 24px; }}
            .title {{ font-size: 20px; font-weight: 700; color: #0f172a; text-align: center; margin-bottom: 8px; }}
            .subtext {{ font-size: 15px; color: #64748b; text-align: center; margin-bottom: 24px; line-height: 1.5; }}
            .otp-box {{ background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%); border: 2px dashed #0284c7; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }}
            .otp-code {{ font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0369a1; font-family: 'Courier New', monospace; }}
            .warning {{ font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.4; }}
            .footer {{ border-top: 1px solid #f1f5f9; margin-top: 28px; padding-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">🐾 HawPulse</div>
            <div class="title">Your Verification Code</div>
            <div class="subtext">Use this one-time code to sign in to your HawPulse pet parent account.</div>
            
            <div class="otp-box">
              <div class="otp-code">{otp}</div>
            </div>
            
            <div class="warning">
              ⏰ This code expires in <strong>10 minutes</strong>.<br>
              Never share this code with anyone. HawPulse staff will never ask for it.
            </div>
            
            <div class="footer">
              Sent to {email} • HawPulse AI Pet Wellness Platform
            </div>
          </div>
        </body>
        </html>
        """

    async def send_otp_email(self, to_email: str, otp: str) -> Dict[str, Any]:
        """
        Sends OTP verification code via Resend API or SMTP.
        Falls back gracefully to console output in development mode.
        """
        # 1. Try Resend REST API if key provided
        if self.resend_api_key.strip():
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {self.resend_api_key}"},
                        json={
                            "from": f"{self.from_name} <{self.from_email}>",
                            "to": [to_email],
                            "subject": f"🐾 Your HawPulse Login Code: {otp}",
                            "html": self._render_otp_html(otp, to_email)
                        }
                    )
                if resp.status_code in [200, 201]:
                    print(f"[SUCCESS] [Resend Email Sent] Successfully dispatched OTP to {to_email}")
                    return {"success": True, "mode": "resend", "message": f"OTP sent to {to_email}"}
                else:
                    print(f"[!] Resend API error ({resp.status_code}): {resp.text}")
            except Exception as e:
                print(f"[!] Resend dispatch exception: {e}")

        # 2. Try SMTP (Gmail, SES, SendGrid, etc.)
        if self.smtp_user.strip() and self.smtp_password.strip():
            def _send_sync_smtp():
                msg = MIMEMultipart("alternative")
                msg["Subject"] = f"Your HawPulse Login Code: {otp}"
                msg["From"] = f"{self.from_name} <{self.from_email}>"
                msg["To"] = to_email

                plain_text = f"Your HawPulse verification code is: {otp}\nThis code expires in 10 minutes."
                html_text = self._render_otp_html(otp, to_email)

                msg.attach(MIMEText(plain_text, "plain"))
                msg.attach(MIMEText(html_text, "html"))

                if self.smtp_port == 465:

                    server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=8.0)
                else:
                    server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=8.0)
                    server.starttls()

                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, [to_email], msg.as_string())
                server.quit()
                return True

            try:
                import asyncio
                await asyncio.wait_for(asyncio.to_thread(_send_sync_smtp), timeout=10.0)
                print(f"[SUCCESS] [SMTP Email Sent] Successfully dispatched verification email to {to_email}")
                return {"success": True, "mode": "smtp", "message": f"OTP sent to {to_email}"}
            except Exception as e:
                print(f"[!] SMTP Error delivering to {to_email}: {e}")

        # 3. Development / Sandbox Console Fallback
        print("\n" + "=" * 60)
        print(" [EMAIL DISPATCH - DEV SANDBOX]")
        print("-" * 60)
        print(f" To:       {to_email}")
        print(f" Subject:  Your PawCircle Login Code: {otp}")
        print(f" Code:     >> {otp} <<  (Expires in 10 minutes)")
        print("-" * 60)
        print(" Notice: To send real emails to inboxes, add to backend/.env:")
        print("   SMTP_USER=your_email@gmail.com")
        print("   SMTP_PASSWORD=your_gmail_app_password  (from myaccount.google.com/apppasswords)")
        print("=" * 60 + "\n")

        return {
            "success": True,
            "mode": "console_dev",
            "message": f"OTP generated (dev mode). Check server logs for code: {otp}"
        }

email_service = EmailService()
