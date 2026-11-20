import os
import smtplib
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
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
    def brevo_api_key(self) -> str:
        return os.getenv("BREVO_API_KEY") or getattr(settings, "BREVO_API_KEY", "") or ""

    @property
    def brevo_sender_email(self) -> str:
        return os.getenv("BREVO_SENDER_EMAIL") or getattr(settings, "BREVO_SENDER_EMAIL", "") or "supporthawpulse@gmail.com"

    @property
    def resend_api_key(self) -> str:
        return os.getenv("RESEND_API_KEY") or getattr(settings, "RESEND_API_KEY", "") or ""

    @property
    def from_email(self) -> str:
        return os.getenv("EMAILS_FROM_EMAIL") or getattr(settings, "EMAILS_FROM_EMAIL", "") or self.brevo_sender_email or self.smtp_user or "supporthawpulse@gmail.com"

    @property
    def from_name(self) -> str:
        return os.getenv("EMAILS_FROM_NAME") or getattr(settings, "EMAILS_FROM_NAME", "HawPulse")

    def is_configured(self) -> bool:
        """Returns True if real email dispatch credentials are configured."""
        return bool(self.brevo_api_key.strip() or self.resend_api_key.strip() or (self.smtp_user.strip() and self.smtp_password.strip()))

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
        Sends OTP verification code via Brevo REST API, Resend API, or SMTP.
        Falls back gracefully with dev/test code preview when trial restrictions apply.
        """
        is_trial_restricted = False
        resend_error_text = ""

        # 1. Try Brevo REST API first (recommended for Railway - port 443 HTTPS & no recipient limits)
        if self.brevo_api_key.strip():
            try:
                sender_email = self.brevo_sender_email.strip() or "supporthawpulse@gmail.com"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.brevo.com/v3/smtp/email",
                        headers={
                            "api-key": self.brevo_api_key.strip(),
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        },
                        json={
                            "sender": {
                                "name": self.from_name,
                                "email": sender_email
                            },
                            "to": [
                                {
                                    "email": to_email
                                }
                            ],
                            "subject": f"🐾 Your HawPulse Login Code: {otp}",
                            "htmlContent": self._render_otp_html(otp, to_email)
                        }
                    )
                if resp.status_code in [200, 201]:
                    print(f"[SUCCESS] [Brevo Email Sent] Successfully dispatched OTP to {to_email}")
                    return {"success": True, "mode": "brevo", "message": f"OTP sent to {to_email}"}
                else:
                    print(f"[!] Brevo API notice ({resp.status_code}): {resp.text}")
            except Exception as e:
                print(f"[!] Brevo dispatch exception: {e}")

        # 2. Try Resend REST API if key provided
        if self.resend_api_key.strip():
            try:
                sender_email = self.from_email
                if not sender_email or "@gmail.com" in sender_email or "hawpulse.com" in sender_email:
                    sender_email = "onboarding@resend.dev"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {self.resend_api_key}"},
                        json={
                            "from": f"{self.from_name} <{sender_email}>",
                            "to": [to_email],
                            "subject": f"🐾 Your HawPulse Login Code: {otp}",
                            "html": self._render_otp_html(otp, to_email)
                        }
                    )
                if resp.status_code in [200, 201]:
                    print(f"[SUCCESS] [Resend Email Sent] Successfully dispatched OTP to {to_email}")
                    return {"success": True, "mode": "resend", "message": f"OTP sent to {to_email}"}
                else:
                    resend_error_text = resp.text
                    print(f"[!] Resend API notice ({resp.status_code}): {resend_error_text}")
                    if "only send testing emails to your own email address" in resend_error_text or resp.status_code == 403:
                        is_trial_restricted = True
            except Exception as e:
                print(f"[!] Resend dispatch exception: {e}")

        # 2. Try SMTP (Gmail, SES, SendGrid, etc.)
        # Note: Railway blocks outbound TCP ports 25, 465, and 587. Skip SMTP on Railway to avoid 8s timeout.
        is_railway = bool(os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RAILWAY_PROJECT_ID"))
        if not is_railway and self.smtp_user.strip() and self.smtp_password.strip():
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
                await asyncio.wait_for(asyncio.to_thread(_send_sync_smtp), timeout=8.0)
                print(f"[SUCCESS] [SMTP Email Sent] Successfully dispatched verification email to {to_email}")
                return {"success": True, "mode": "smtp", "message": f"OTP sent to {to_email}"}
            except Exception as e:
                print(f"[!] SMTP Error delivering to {to_email}: {e}")

        # 3. Fallback: Return dev_otp preview so testers are never blocked
        warning_msg = None
        if is_trial_restricted:
            warning_msg = "Resend trial key sends inbox emails to account owner (tv124473@gmail.com). Test code auto-filled."
            print(f"[!] {warning_msg}")

        print("\n" + "=" * 60)
        print(" [EMAIL DISPATCH - DEV PREVIEW]")
        print("-" * 60)
        print(f" To:       {to_email}")
        print(f" Code:     >> {otp} <<  (Expires in 10 minutes)")
        print("=" * 60 + "\n")

        return {
            "success": True,
            "mode": "dev_preview" if (is_trial_restricted or is_railway) else "console_dev",
            "message": f"OTP code ready for {to_email}",
            "dev_otp": otp,
            "warning": warning_msg
        }

    def _render_calendar_html(
        self,
        event_title: str,
        event_details: str,
        start_date: str,
        start_time: Optional[str] = None,
        location: str = "Veterinary Clinic",
        google_calendar_url: Optional[str] = None
    ) -> str:
        time_display = f"{start_date} at {start_time}" if start_time else start_date
        btn_html = ""
        if google_calendar_url:
            btn_html = f"""
            <div style="text-align: center; margin: 32px 0 24px 0;">
              <a href="{google_calendar_url}" target="_blank" style="display: inline-block; background: #1A73E8; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3);">
                📅 Save to Google Calendar (1-Click)
              </a>
            </div>
            """

        formatted_details = event_details.replace("\n", "<br>")

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }}
            .container {{ max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 32px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }}
            .logo {{ font-size: 24px; font-weight: 800; color: #0284c7; text-align: center; margin-bottom: 20px; }}
            .card {{ background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 16px; padding: 20px; margin: 20px 0; }}
            .card-title {{ font-size: 18px; font-weight: 800; color: #166534; margin-bottom: 12px; }}
            .info-row {{ font-size: 14px; color: #334155; margin-bottom: 8px; line-height: 1.5; }}
            .info-label {{ font-weight: 700; color: #0f172a; }}
            .details-box {{ background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; font-size: 13px; color: #475569; margin-top: 14px; line-height: 1.6; }}
            .ics-note {{ background: #f8fafc; border-radius: 12px; padding: 14px; font-size: 12px; color: #64748b; text-align: center; margin-top: 20px; line-height: 1.5; border: 1px dashed #cbd5e1; }}
            .footer {{ border-top: 1px solid #f1f5f9; margin-top: 28px; padding-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">🐾 HawPulse Care Schedule</div>
            <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; text-align: center; margin: 0 0 8px 0;">New Pet Care Reminder</h2>
            <p style="font-size: 14px; color: #64748b; text-align: center; margin: 0 0 20px 0;">We've scheduled this event for your companion's wellness.</p>

            <div class="card">
              <div class="card-title">📌 {event_title}</div>
              <div class="info-row"><span class="info-label">🗓️ Date:</span> {time_display}</div>
              <div class="info-row"><span class="info-label">📍 Location:</span> {location}</div>
              <div class="details-box">
                {formatted_details}
              </div>
            </div>

            {btn_html}

            <div class="ics-note">
              📎 <strong>Calendar file attached:</strong> An <code>.ics</code> invite is attached to this email. Opening it will automatically add this event to Google Calendar, Apple Calendar, or Outlook.
            </div>

            <div class="footer">
              HawPulse AI Pet Wellness Platform • Keeping tails wagging on time
            </div>
          </div>
        </body>
        </html>
        """

    async def send_calendar_invite_email(
        self,
        to_email: str,
        event_title: str,
        event_details: str,
        start_date: str,
        start_time: Optional[str] = None,
        duration_minutes: int = 30,
        location: str = "Veterinary Clinic",
        google_calendar_url: Optional[str] = None,
        ics_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends an automated calendar reminder email with:
        1. Clickable 1-Click Google Calendar CTA Button (zero permissions required)
        2. Attached .ics iCalendar file (auto-recognized by Gmail, iOS, Mac, Outlook)
        """
        html_body = self._render_calendar_html(
            event_title=event_title,
            event_details=event_details,
            start_date=start_date,
            start_time=start_time,
            location=location,
            google_calendar_url=google_calendar_url
        )

        attachments = []
        if ics_content:
            b64_ics = base64.b64encode(ics_content.encode("utf-8")).decode("utf-8")
            attachments.append({
                "filename": "hawpulse_reminder.ics",
                "content": b64_ics
            })

        # 1. Dispatch via Brevo REST API if available (HTTPS port 443, no Railway SMTP block)
        if self.brevo_api_key.strip():
            try:
                sender_email = self.brevo_sender_email.strip() or "supporthawpulse@gmail.com"
                brevo_payload = {
                    "sender": {
                        "name": self.from_name,
                        "email": sender_email
                    },
                    "to": [{"email": to_email}],
                    "subject": f"🐾 Calendar Reminder: {event_title}",
                    "htmlContent": html_body
                }
                if ics_content:
                    brevo_payload["attachment"] = [
                        {
                            "name": "hawpulse_reminder.ics",
                            "content": base64.b64encode(ics_content.encode("utf-8")).decode("utf-8")
                        }
                    ]

                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.brevo.com/v3/smtp/email",
                        headers={
                            "api-key": self.brevo_api_key.strip(),
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        },
                        json=brevo_payload
                    )
                if resp.status_code in [200, 201]:
                    print(f"[SUCCESS] [Brevo Calendar Invite Sent] Dispatched .ics reminder to {to_email}")
                    return {"success": True, "mode": "brevo", "message": f"Calendar invite dispatched to {to_email}"}
                else:
                    print(f"[!] Brevo Calendar API notice ({resp.status_code}): {resp.text}")
            except Exception as e:
                print(f"[!] Brevo calendar dispatch exception: {e}")

        # 2. Dispatch via Resend REST API if available
        if self.resend_api_key.strip():
            try:
                sender_email = self.from_email
                if not sender_email or "@gmail.com" in sender_email or "hawpulse.com" in sender_email:
                    sender_email = "onboarding@resend.dev"

                payload = {
                    "from": f"{self.from_name} <{sender_email}>",
                    "to": [to_email],
                    "subject": f"🐾 Calendar Reminder: {event_title}",
                    "html": html_body
                }
                if attachments:
                    payload["attachments"] = attachments

                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {self.resend_api_key}"},
                        json=payload
                    )
                if resp.status_code in [200, 201]:
                    print(f"[SUCCESS] [Resend Calendar Invite Sent] Dispatched .ics reminder to {to_email}")
                    return {"success": True, "mode": "resend", "message": f"Calendar invite dispatched to {to_email}"}
                else:
                    print(f"[!] Resend Calendar API notice ({resp.status_code}): {resp.text}")
            except Exception as e:
                print(f"[!] Resend calendar dispatch exception: {e}")

        # 2. Dispatch via SMTP
        if self.smtp_user.strip() and self.smtp_password.strip():
            def _send_sync_smtp():
                msg = MIMEMultipart("mixed")
                msg["Subject"] = f"🐾 Calendar Reminder: {event_title}"
                msg["From"] = f"{self.from_name} <{self.from_email}>"
                msg["To"] = to_email

                alt_part = MIMEMultipart("alternative")
                plain_text = f"HawPulse Calendar Reminder: {event_title}\nDate: {start_date} {start_time or ''}\n\n{event_details}\n\nAdd to calendar: {google_calendar_url or ''}"
                alt_part.attach(MIMEText(plain_text, "plain"))
                alt_part.attach(MIMEText(html_body, "html"))
                msg.attach(alt_part)

                if ics_content:
                    part = MIMEBase("text", "calendar", method="REQUEST", name="hawpulse_reminder.ics")
                    part.set_payload(ics_content.encode("utf-8"))
                    encoders.encode_base64(part)
                    part.add_header("Content-Disposition", "attachment; filename=hawpulse_reminder.ics")
                    msg.attach(part)

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
                print(f"[SUCCESS] [SMTP Calendar Invite Sent] Dispatched .ics reminder to {to_email}")
                return {"success": True, "mode": "smtp", "message": f"Calendar invite dispatched to {to_email}"}
            except Exception as e:
                print(f"[!] SMTP Calendar Error delivering to {to_email}: {e}")

        # 3. Development Fallback
        print(f"[DEV CALENDAR INVITE] Would dispatch .ics invite to {to_email}: {event_title}")
        return {"success": True, "mode": "dev_fallback", "message": f"Dev invite generated for {to_email}"}

email_service = EmailService()
