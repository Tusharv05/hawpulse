import React, { useEffect } from 'react';

export default function PrivacyPolicy({ onBackToHome, onOpenTerms }) {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Privacy Policy — HawPulse';
    return () => {
      document.title = "HawPulse — Your Pet's Whole World, in One Circle";
    };
  }, []);

  const handleGoHome = (e) => {
    if (e) e.preventDefault();
    if (onBackToHome) {
      onBackToHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div
      className="min-h-screen bg-[#ffffff] text-[#111111] px-5 sm:px-8 py-8 sm:py-12"
      style={{
        fontFamily: "Georgia, Cambria, 'Times New Roman', Times, serif",
      }}
    >
      <div className="max-w-[700px] mx-auto">
        {/* Top Navigation: matching reference header */}
        <div className="flex items-center gap-2 mb-8 text-[15px] sm:text-base">
          <a
            href="/"
            onClick={handleGoHome}
            className="text-[#1a0dab] hover:text-[#0b0080] underline font-medium cursor-pointer"
          >
            hawpulse
          </a>
          <img
            src="/logo.png"
            alt="HawPulse Logo"
            className="w-[22px] h-[22px] rounded-full object-contain inline-block"
          />
          <a
            href="/"
            onClick={handleGoHome}
            className="text-[#1a0dab] hover:text-[#0b0080] underline cursor-pointer ml-0.5"
          >
            Back to home
          </a>
        </div>

        {/* Header */}
        <h1 className="text-[34px] sm:text-[42px] font-bold text-[#111111] leading-tight mb-3">
          Privacy Policy
        </h1>
        <p className="text-[15px] sm:text-[16px] text-[#222222] mb-8">
          Last updated 3 November 2026
        </p>

        {/* Intro */}
        <div className="space-y-4 text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
          <p>
            HawPulse is one place for your pet’s care, food and friends. This policy explains what we collect, why, and the choices you have. We keep it plain, because your pet’s data should not need a lawyer to read.
          </p>
          <p>
            <strong>The short version.</strong> We collect only what HawPulse needs to work. We never show your exact location or home address to anyone. Your vet papers stay private. We do not sell your data or your pet’s data, and we do not use it for third-party advertising. You can delete everything at any time.
          </p>
        </div>

        {/* Who we are */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            Who we are
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            HawPulse (“we”, “us”) provides the HawPulse pet-care and pet-community app. For any privacy question, or to ask us to access, correct, export or delete your data, email{' '}
            <a
              href="mailto:supporthawpulse@gmail.com"
              className="text-[#1a0dab] hover:underline"
            >
              supporthawpulse@gmail.com
            </a>
            .
          </p>
        </section>

        {/* What we collect */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            What we collect
          </h2>
          <div className="space-y-3 text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            <p>
              <strong>Account details.</strong> You sign in with your email address, using a 6-digit code or a magic link. There are no passwords and no social logins. We also record that you confirmed you are 18 or older.
            </p>
            <p>
              <strong>Your profile.</strong> Your first name, age and a few words about your lifestyle, plus an optional short bio. If you register as a couple, the same details for your partner. You choose whether you appear as a solo parent or a couple.
            </p>
            <p>
              <strong>Your location.</strong> The area you pick, or the area your browser detects if you allow it. We use it to work out distances to other pet parents and to find emergency vets near you. We store a neighbourhood-level location, not a pin on your home.
            </p>
            <p>
              <strong>Your pet’s profile.</strong> Name, species, breed, birthday or age, weight, whether they are neutered or spayed, allergies, up to six photos, energy level, personality traits, nature notes, and their vaccination status.
            </p>
            <p>
              <strong>Care activity.</strong> Diary taps (fed, walk, water, poop, medicine, grooming, notes), who logged them and when, your meal times, the diet and grooming plans we generate, and your daily streak.
            </p>
            <p>
              <strong>Medical documents.</strong> Photos of vaccine booklets and prescriptions that you upload, and the details we read from them, such as vaccine names, dates, medicines and doses.
            </p>
            <p>
              <strong>Community activity.</strong> Who you like or pass, your matches, chat messages and photos you send, pack walk invites (day, time, park and note) and replies, plus any blocks and reports you make.
            </p>
            <p>
              <strong>Sitter passes.</strong> When you create a sitter link, the sitter’s first name, the sections you chose to share, and what the sitter logs while the link is active.
            </p>
            <p>
              <strong>Questions to Paw AI.</strong> What you ask and the answers you get.
            </p>
            <p>
              <strong>Reminders and calendar.</strong> If you turn on reminders, a browser push subscription so we can send the notification you asked for. If you turn on Google Calendar sync, the permission needed to add meals, medicines and pack walks to your calendar.
            </p>
            <p>
              <strong>Product analytics.</strong> A small set of events, for example that a plan was generated or a feeding was logged, so we can learn what helps. These are tied to your account only so we can avoid double counting.
            </p>
            <p>
              <strong>Technical basics.</strong> Standard server logs, your browser and device type, and a session cookie that keeps you signed in.
            </p>
          </div>
        </section>

        {/* How we use it */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            How we use it
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            <li>To run the app: store your profile, your pet’s profile, diary and plans, and show them to you and to people you choose to share with</li>
            <li>To generate diet and grooming guidance tuned to your pet’s breed, age, weight and allergies</li>
            <li>To read vaccine booklets and prescriptions and turn them into plain-language summaries and reminders</li>
            <li>To answer your questions in Paw AI, using your pet’s profile and records for context</li>
            <li>To suggest nearby pets and parents, create matches, and deliver chats and pack walk invites</li>
            <li>To send reminders and notifications, but only the ones you turned on</li>
            <li>To keep the community safe: review reports, remove accounts that break our rules, and block people on your request</li>
            <li>To understand, in aggregate, whether HawPulse is working, so we can improve it</li>
          </ul>
        </section>

        {/* AI features */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            AI features
          </h2>
          <div className="space-y-4 text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            <p>
              Paw AI helps with meal plans, grooming rhythms, document reading and health questions. To do this, we send the relevant details (for example your pet’s breed, age, weight, allergies, the text of your question, or an uploaded document) to our AI provider listed below, and receive the result back. We do not use your content to advertise to you.
            </p>
            <p>
              <strong>Not veterinary advice.</strong> Everything Paw AI produces is general guidance based on the information available, not a diagnosis or a prescription diet. Always check with your vet, especially if your pet has a health condition. If something looks urgent, call an emergency vet.
            </p>
          </div>
        </section>

        {/* What other people can see */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            What other people can see
          </h2>
          <div className="space-y-3 text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            <p>
              <strong>Other pet parents.</strong> On a match card and profile, people nearby can see your pet’s name, photos, age, breed, traits and nature notes, your first name and age (and your partner’s, if you added them), your lifestyle line and bio, your neighbourhood, and a rough distance anchored to public places like dog runs. They never see your email address, your exact location, your pet’s medical documents or your diary.
            </p>
            <p>
              <strong>Your matches.</strong> When you and another parent like each other, you can chat. Messages, photos and pack walk details you send are visible to that match.
            </p>
            <p>
              <strong>Caregivers you invite.</strong> A sitter with your link sees only the sections you shared, such as the pet’s profile, routine, allergies, medicines and vet contact, and your first name. You can revoke the link at any time.
            </p>
          </div>
        </section>

        {/* Who we share it with */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            Who we share it with
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222] mb-3">
            Beyond the people above, we rely on a small set of service providers that process data on our behalf:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            <li>[Database, authentication and file storage provider] for our database, sign-in and storage</li>
            <li>[Email delivery provider] to send your sign-in codes and magic links</li>
            <li>Google, for AI generation and for reading uploaded documents</li>
            <li>[Hosting provider] for hosting and delivery</li>
            <li>[Maps and places provider] for parks and emergency vet listings</li>
            <li>Your browser’s web push service, to deliver reminders you opted into</li>
            <li>Google Calendar, only if you turn on calendar sync</li>
          </ul>
          <p className="mt-4 text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            These providers may process data on servers outside your country. We do not sell your personal data. We may disclose information if the law requires it, or if it is needed to protect someone’s safety.
          </p>
        </section>

        {/* Meeting people in real life */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            Meeting people in real life
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            HawPulse does not verify who people are or run background checks. Meet in a public place, tell someone where you are going, and trust your instincts. You can unmatch, block or report anyone at any time.
          </p>
        </section>

        {/* Your choices and rights */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            Your choices and rights
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            <li>View and edit your profile and your pet’s profile at any time in the app</li>
            <li>Change your area, or deny location access and search for your city instead</li>
            <li>Switch off “Show me in Discover” to hide your pets from other people</li>
            <li>Turn reminders off at any time, which removes your push subscription</li>
            <li>Revoke a sitter’s access by turning off their link</li>
            <li>Unmatch, block or report anyone from a chat</li>
            <li>Remove a pet from your profile, which permanently deletes their diary, plans and records</li>
            <li>
              Download a copy of your data, or delete your account, from Settings or by emailing{' '}
              <a
                href="mailto:supporthawpulse@gmail.com"
                className="text-[#1a0dab] hover:underline"
              >
                supporthawpulse@gmail.com
              </a>
            </li>
          </ul>
        </section>

        {/* Storage, retention and security */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            Storage, retention and security
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            Your data is stored with the providers above and protected by access controls, so each person can reach only their own records and the diaries they have been invited to. Data is encrypted in transit. We keep your data while your account is active. When you delete your account, we remove your profile, pets, diary, documents and chats within [30 days]. We may keep a limited record of reports and blocks where needed to keep the community safe.
          </p>
        </section>

        {/* Children */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            Children
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            HawPulse is for adults. You must be 18 or older to use it, and it is not directed at anyone under 18.
          </p>
        </section>

        {/* Changes */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            Changes
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            We may update this policy as HawPulse grows. If we make a meaningful change, we will update the date above and, where appropriate, let you know in the app.
          </p>
        </section>

        {/* Footer info line */}
        <div className="mt-12 pt-6 border-t border-[#e5e5e5] text-[14px] sm:text-[15px] text-[#444444]">
          Questions:{' '}
          <a
            href="mailto:supporthawpulse@gmail.com"
            className="text-[#1a0dab] hover:underline"
          >
            supporthawpulse@gmail.com
          </a>{' '}
          · See also our{' '}
          <button
            type="button"
            onClick={onOpenTerms}
            className="text-[#1a0dab] hover:underline cursor-pointer bg-transparent border-none p-0 inline"
          >
            Terms of use
          </button>
          .
        </div>
      </div>
    </div>
  );
}

