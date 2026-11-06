import React, { useEffect } from 'react';

export default function TermsOfUse({ onBackToHome, onOpenPrivacy }) {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Terms of Use — HawPulse';
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
          Terms of Use
        </h1>
        <p className="text-[15px] sm:text-[16px] text-[#222222] mb-8">
          Last updated 3 November 2026
        </p>

        {/* Intro */}
        <div className="space-y-4 text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
          <p>
            These terms cover your use of HawPulse, the pet-care and pet-community app. By signing in and using HawPulse, you agree to them. If you do not agree, please do not use the service.
          </p>
          <p>
            <strong>Not veterinary advice.</strong> HawPulse gives general care guidance, including AI meal, grooming and health suggestions based on the details you enter, and plain-language summaries of documents you upload. It is not a diagnosis, a treatment plan, or a prescription diet, and it does not replace your veterinarian. For anything about your pet’s health, and in any emergency, contact a vet.
          </p>
        </div>

        {/* 1. What HawPulse is */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            1. What HawPulse is
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            HawPulse is one place for your pet’s care, food and friends: a pet profile, a one-tap daily diary, AI meal and grooming plans, a medical vault for vaccine and prescription papers, sitter links, and a community where you can meet nearby pet parents, chat and plan pack walks. HawPulse is an early product, so features may change, and parts of it may be unavailable from time to time.
          </p>
        </section>

        {/* 2. Your account */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            2. Your account
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            You sign in with your email address, using a 6-digit code or a magic link. You must be 18 or older to use HawPulse. Give us accurate information, and keep access to your email secure, because you are responsible for the activity that happens under your HawPulse account. Tell us at{' '}
            <a
              href="mailto:supporthawpulse@gmail.com"
              className="text-[#1a0dab] hover:underline"
            >
              supporthawpulse@gmail.com
            </a>{' '}
            if you believe your account has been used without your permission.
          </p>
        </section>

        {/* 3. Acceptable use */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            3. Acceptable use
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            <li>Use HawPulse only for looking after pets you are responsible for, or helping someone who invited you</li>
            <li>Do not upload content that is unlawful, harmful, or that infringes someone else’s rights</li>
            <li>Do not attempt to break, overload, or gain unauthorized access to the service or to other people’s accounts and diaries</li>
            <li>Do not use HawPulse to sell things, advertise, or send spam</li>
          </ul>
        </section>

        {/* 4. Community and meeting people */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            4. Community and meeting people
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222] mb-3">
            The community lets you meet other pet parents, but you are responsible for how you use it.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            <li>Be kind and respectful. Do not harass, threaten, deceive or pressure anyone, and do not send unwanted or inappropriate messages or photos</li>
            <li>Create only one profile for yourself, with your real first name and age, and use photos of your own pets</li>
            <li>Do not misuse the double opt-in: you chat only with people you have matched with</li>
            <li>You can unmatch, block or report anyone at any time. We review reports and may remove content or suspend accounts that break these terms</li>
            <li>HawPulse does not verify who people are or run background checks. If you choose to meet someone, do it in a public place, tell someone where you are going, and use your own judgement</li>
            <li>Playdates and pack walks are arranged between you and the other person. You are responsible for your own safety and for the behaviour of your pet. HawPulse is not a party to those meetups</li>
          </ul>
        </section>

        {/* 5. Sharing and caregivers */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            5. Sharing and caregivers
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            When you create a sitter link, anyone you give it to can open it and see the parts of your pet’s profile you chose to share, and log feeds, walks and medicines, until you turn the link off or it expires. You decide who to invite, and you are responsible for that choice. You can revoke access at any time.
          </p>
        </section>

        {/* 6. Your content */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            6. Your content
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            Your pet’s data is yours. By using HawPulse, you give us permission to store and process that data, and the photos, documents and messages you add, so we can run the service for you. This includes sending the details you enter to our AI provider to generate plans, summaries and answers. You promise that you have the right to upload what you add. Other people can see the profile information you choose to make visible in Discover, as described in our{' '}
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="text-[#1a0dab] hover:underline cursor-pointer bg-transparent border-none p-0 inline font-inherit"
            >
              Privacy Policy
            </button>
            .
          </p>
        </section>

        {/* 7. AI and medical documents */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            7. AI and medical documents
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            AI features, including meal plans, document reading and Ask Paw AI, can make mistakes. When HawPulse reads a vaccine booklet or a prescription, always check the result against the original, and follow your vet’s instructions if they differ. Reminders and schedules are a convenience, not a medical schedule. If something looks urgent, call an emergency vet.
          </p>
        </section>

        {/* 8. Availability and “as is” */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            8. Availability and “as is”
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            HawPulse is provided on an “as is” and “as available” basis, without warranties of any kind. We do not promise that reminders, plans, matches or the service will always be accurate, timely, or uninterrupted. Do not rely on HawPulse as the only safeguard for your pet’s wellbeing.
          </p>
        </section>

        {/* 9. Limitation of liability */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            9. Limitation of liability
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            To the extent permitted by law, HawPulse is not liable for indirect or consequential loss, for decisions made in reliance on general guidance the app provides, or for what other users say or do, including at meetups. Nothing in these terms limits liability that cannot be limited by law. [Governing law and place of jurisdiction to be added.]
          </p>
        </section>

        {/* 10. Ending use */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            10. Ending use
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            You can stop using HawPulse at any time and ask us to delete your account from Settings or by emailing{' '}
            <a
              href="mailto:supporthawpulse@gmail.com"
              className="text-[#1a0dab] hover:underline"
            >
              supporthawpulse@gmail.com
            </a>
            . We may suspend or end access if these terms are broken, if someone’s safety is at risk, or if we discontinue the service.
          </p>
        </section>

        {/* 11. Changes */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            11. Changes
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            We may update these terms as the product develops. If we make a meaningful change, we will update the date above. Continuing to use HawPulse after a change means you accept the updated terms.
          </p>
        </section>

        {/* 12. Contact */}
        <section className="mt-8">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#111111] mb-3">
            12. Contact
          </h2>
          <p className="text-[15px] sm:text-[16.5px] leading-[1.65] text-[#222222]">
            Questions about these terms:{' '}
            <a
              href="mailto:supporthawpulse@gmail.com"
              className="text-[#1a0dab] hover:underline"
            >
              supporthawpulse@gmail.com
            </a>
            .
          </p>
        </section>

        {/* Footer info line */}
        <div className="mt-12 pt-6 border-t border-[#e5e5e5] text-[14px] sm:text-[15px] text-[#444444]">
          See also our{' '}
          <button
            type="button"
            onClick={onOpenPrivacy}
            className="text-[#1a0dab] hover:underline cursor-pointer bg-transparent border-none p-0 inline font-inherit"
          >
            Privacy Policy
          </button>
          .
        </div>
      </div>
    </div>
  );
}

